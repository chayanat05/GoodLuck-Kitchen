"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, Search, Plus, Edit, Trash2, Store, 
  Utensils, DollarSign, Loader2, AlertTriangle, CheckCircle2, X,
  LayoutList, MapPin
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface BranchMenu {
  id: string;
  branch_id: string;
  menu_name: string;
  price: number;
}

interface ContactSource {
  id: string;
  branch_id: string;
  name: string;
}

export default function MenusManagementPage() {
  const router = useRouter();
  
  // 🌟 State ข้อมูล
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  
  const [menus, setMenus] = useState<BranchMenu[]>([]);
  const [sources, setSources] = useState<ContactSource[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"menus" | "sources">("menus");
  
  // 🌟 Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // 🌟 Form States
  const [menuForm, setMenuForm] = useState({ menu_name: "", price: "" });
  const [sourceForm, setSourceForm] = useState({ name: "" });

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = useCallback((message: string, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  }, []);

  // 1. ดึงข้อมูลสาขาทั้งหมดตอนเปิดหน้าแรก
  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role !== "admin" && profile?.role !== "superadmin") {
        router.push("/rider");
        return;
      }

      // ดึงรายชื่อสาขา
      const { data: branchData } = await supabase.from("branches").select("id, name").order("name");
      if (branchData && branchData.length > 0) {
        setBranches(branchData);
        setSelectedBranchId(branchData[0].id); // เลือกสาขาแรกเป็นค่าเริ่มต้น
      }
    };
    initPage();
  }, [router]);

  // 2. ดึงข้อมูลเมนูและร้าน เมื่อมีการเปลี่ยนสาขา
  useEffect(() => {
    const fetchDataByBranch = async () => {
      if (!selectedBranchId) return;
      setIsLoading(true);
      
      // ดึงเมนูเฉพาะสาขาที่เลือก
      const { data: menuData } = await supabase
        .from("branch_menus")
        .select("*")
        .eq("branch_id", selectedBranchId)
        .order("menu_name", { ascending: false });

      // ดึงแหล่งที่มาเฉพาะสาขาที่เลือก
      const { data: sourceData } = await supabase
        .from("contact_sources")
        .select("*")
        .eq("branch_id", selectedBranchId)
        .order("created_at", { ascending: true });

      setMenus((menuData as BranchMenu[]) || []);
      setSources((sourceData as ContactSource[]) || []);
      setIsLoading(false);
    };

    fetchDataByBranch();
  }, [selectedBranchId]);

  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (activeTab === "menus") {
      return menus.filter(m => m.menu_name.toLowerCase().includes(query));
    } else {
      return sources.filter(s => s.name.toLowerCase().includes(query));
    }
  }, [menus, sources, searchQuery, activeTab]);

  const openModal = (item?: BranchMenu | ContactSource) => {
    if (!selectedBranchId) {
      showToast("กรุณาเลือกสาขาก่อนเพิ่มข้อมูล", "error");
      return;
    }

    if (activeTab === "menus") {
      const menu = item as BranchMenu;
      setEditingId(menu?.id || null);
      setMenuForm({ 
        menu_name: menu?.menu_name || "", 
        price: menu?.price ? menu.price.toString() : "" 
      });
    } else {
      const source = item as ContactSource;
      setEditingId(source?.id || null);
      setSourceForm({ name: source?.name || "" });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`ยืนยันการลบ "${name}" ใช่หรือไม่?`)) return;

    const table = activeTab === "menus" ? "branch_menus" : "contact_sources";
    const { error } = await supabase.from(table).delete().eq("id", id);
    
    const broadcastSync = () => {
      const channel = supabase.channel("public:sync_menus_sources");
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({ type: "broadcast", event: "sync", payload: { branch_id: selectedBranchId } }).then(() => supabase.removeChannel(channel));
        }
      });
    };

    if (error) {
      showToast("ลบข้อมูลไม่สำเร็จ", "error");
    } else {
      showToast("ลบข้อมูลเรียบร้อยแล้ว", "success");
      if (activeTab === "menus") setMenus(prev => prev.filter(m => m.id !== id));
      else setSources(prev => prev.filter(s => s.id !== id));
      broadcastSync();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // 🌟 ระบบเช็คข้อมูลซ้ำ (Duplicate Check)
    const checkName = activeTab === "menus" ? menuForm.menu_name.trim() : sourceForm.name.trim();
    let isDuplicate = false;

    if (activeTab === "menus") {
      isDuplicate = menus.some(
        (m) => m.menu_name.toLowerCase() === checkName.toLowerCase() && m.id !== editingId
      );
    } else {
      isDuplicate = sources.some(
        (s) => s.name.toLowerCase() === checkName.toLowerCase() && s.id !== editingId
      );
    }

    // 🌟 ถ้าเจอชื่อซ้ำ ให้เด้ง Error แล้วหยุดการทำงานทันที
    if (isDuplicate) {
      showToast(`ชื่อ${activeTab === "menus" ? "เมนู" : "แหล่งที่มา"}นี้มีอยู่แล้วในสาขานี้!`, "error");
      setIsSubmitting(false);
      return;
    }

    const table = activeTab === "menus" ? "branch_menus" : "contact_sources";
    
    let payload: {
      branch_id?: string;
      menu_name?: string;
      price?: number;
      name?: string;
    };

    if (activeTab === "menus") {
      const priceNum = parseInt(menuForm.price.replace(/[^0-9]/g, ""), 10) || 0;
      payload = { branch_id: selectedBranchId, menu_name: checkName, price: priceNum };
    } else {
      payload = { branch_id: selectedBranchId, name: checkName };
    }

    const broadcastSync = () => {
      const channel = supabase.channel("public:sync_menus_sources");
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({ type: "broadcast", event: "sync", payload: { branch_id: selectedBranchId } }).then(() => supabase.removeChannel(channel));
        }
      });
    };

    if (editingId) {
      const { data, error } = await supabase.from(table).update(payload).eq("id", editingId).select();
      if (error) showToast("แก้ไขไม่สำเร็จ", "error");
      else {
        if (activeTab === "menus") setMenus(prev => prev.map(m => m.id === editingId ? data[0] as BranchMenu : m));
        else setSources(prev => prev.map(s => s.id === editingId ? data[0] as ContactSource : s));
        showToast("อัปเดตข้อมูลเรียบร้อย", "success");
        setIsModalOpen(false);
        broadcastSync();
      }
    } else {
      const { data, error } = await supabase.from(table).insert([payload]).select();
      if (error) showToast("เพิ่มข้อมูลไม่สำเร็จ", "error");
      else {
        // 🌟 ดันของใหม่ขึ้นไปอยู่ตำแหน่งบนสุดของ Array (เพื่อให้เห็นทันทีว่าใหม่สุด)
        if (activeTab === "menus") setMenus(prev => [data[0] as BranchMenu, ...prev]);
        else setSources(prev => [data[0] as ContactSource, ...prev]);
        showToast("เพิ่มข้อมูลใหม่เรียบร้อย", "success");
        setIsModalOpen(false);
        broadcastSync();
      }
    }
    setIsSubmitting(false);
};

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl z-150 ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>
        {toast.type === 'error' ? <AlertTriangle size={18} className="text-rose-400 mr-2" /> : <CheckCircle2 size={18} className="text-emerald-400 mr-2" />}
        <span className="font-bold text-sm tracking-wide">{toast.message}</span>
      </div>

      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/home")} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer active:scale-95">
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Utensils className="text-blue-600" size={24} /> ฐานข้อมูลร้านและเมนู
              </h1>
              <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">แยกตามสาขา</p>
            </div>
          </div>

          {/* 🌟 ตัวเลือกสาขา */}
          <div className="w-full md:w-auto flex items-center gap-2">
            <MapPin size={18} className="text-slate-400" />
            <select 
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="flex-1 md:w-48 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="" disabled>เลือกสาขา...</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-slate-100 pt-2 pb-2">
          <div className="flex gap-4 w-full sm:w-auto">
            <button 
              onClick={() => setActiveTab("menus")}
              className={`px-4 py-3 text-sm font-black border-b-2 transition-all flex items-center gap-2 ${activeTab === "menus" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
            >
              <LayoutList size={16} /> จัดการเมนู ({menus.length})
            </button>
            <button 
              onClick={() => setActiveTab("sources")}
              className={`px-4 py-3 text-sm font-black border-b-2 transition-all flex items-center gap-2 ${activeTab === "sources" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
            >
              <Store size={16} /> แหล่งที่มา/ร้าน ({sources.length})
            </button>
          </div>
          <button 
            onClick={() => openModal()} 
            disabled={!selectedBranchId}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2"
          >
            <Plus size={18} /> {activeTab === "menus" ? "เพิ่มเมนู" : "เพิ่มแหล่งที่มา"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder={activeTab === "menus" ? "ค้นหาชื่อเมนู..." : "ค้นหาแหล่งที่มา..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm text-slate-700"
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
            <p className="font-bold tracking-widest uppercase text-xs">กำลังโหลดข้อมูลสาขา...</p>
          </div>
        ) : !selectedBranchId ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
            <MapPin size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-black text-slate-700 mb-2">กรุณาเลือกสาขาด้านบน</h3>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
            {activeTab === "menus" ? <Utensils size={48} className="mx-auto text-slate-300 mb-4" /> : <Store size={48} className="mx-auto text-slate-300 mb-4" />}
            <h3 className="text-lg font-black text-slate-700 mb-2">ไม่พบข้อมูลในสาขานี้</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
            {activeTab === "menus" 
              ? (filteredData as BranchMenu[]).map((menu) => (
                  <div key={menu.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-base font-black text-slate-800 line-clamp-2 pr-2">{menu.menu_name}</h3>
                      <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => openModal(menu)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"><Edit size={14} /></button>
                        <button onClick={() => handleDelete(menu.id, menu.menu_name)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="flex items-center text-emerald-600 font-black text-lg pt-3 border-t border-slate-50">
                      <DollarSign size={16} className="text-emerald-500 mr-0.5" /> 
                      {menu.price.toLocaleString('th-TH')} <span className="text-xs text-slate-400 font-bold ml-1 mt-1">บาท</span>
                    </div>
                  </div>
                ))
              : (filteredData as ContactSource[]).map((source) => (
                  <div key={source.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all group flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                        <Store size={20} />
                      </div>
                      <h3 className="text-sm font-black text-slate-800">{source.name}</h3>
                    </div>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openModal(source)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(source.id, source.name)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))
            }
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                {editingId ? <Edit className="text-blue-500" size={20}/> : <Plus className="text-blue-500" size={20}/>} 
                {editingId ? `แก้ไข${activeTab === "menus" ? "เมนู" : "แหล่งที่มา"}` : `เพิ่ม${activeTab === "menus" ? "เมนูใหม่" : "แหล่งที่มาใหม่"}`}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-2 rounded-full transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-slate-50/50">
              {activeTab === "menus" ? (
                <>
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-2 tracking-wide uppercase">ชื่อเมนู *</label>
                    <input 
                      required
                      className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
                      value={menuForm.menu_name}
                      onChange={(e) => setMenuForm({...menuForm, menu_name: e.target.value})}
                      placeholder="เช่น ข้าวมันไก่พิเศษ"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-2 tracking-wide uppercase">ราคา (บาท) *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <DollarSign size={16} className="text-emerald-500" />
                      </div>
                      <input 
                        required type="text" inputMode="numeric"
                        className="w-full bg-white border border-slate-200 pl-10 pr-4 py-3.5 rounded-xl text-lg font-black text-emerald-600 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm"
                        value={menuForm.price}
                        onChange={(e) => setMenuForm({...menuForm, price: e.target.value.replace(/[^0-9]/g, "")})}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-2 tracking-wide uppercase">ชื่อแหล่งที่มา (เพจ / ร้าน) *</label>
                  <input 
                    required
                    className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
                    value={sourceForm.name}
                    onChange={(e) => setSourceForm({...sourceForm, name: e.target.value})}
                    placeholder="เช่น เพจหลักขอนแก่น, Grab สาขา 2..."
                  />
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 bg-slate-200 text-slate-700 font-black rounded-xl hover:bg-slate-300 transition-colors cursor-pointer text-sm uppercase">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-[1.5] py-3.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all cursor-pointer text-sm uppercase flex justify-center items-center gap-2 active:scale-95 disabled:bg-slate-400 disabled:shadow-none">
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {editingId ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}