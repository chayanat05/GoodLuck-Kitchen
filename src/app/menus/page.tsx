"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, Search, Plus, Edit, Trash2, Store, 
  Utensils, DollarSign, Loader2, AlertTriangle, CheckCircle2, X,
  LayoutList
} from "lucide-react";

interface ShopMenu {
  id: string;
  shop_name: string;
  menu_name: string;
  price: number;
}

interface ContactSource {
  id: string;
  name: string;
}

export default function MenusManagementPage() {
  const router = useRouter();
  
  // 🌟 State ข้อมูล
  const [menus, setMenus] = useState<ShopMenu[]>([]);
  const [sources, setSources] = useState<ContactSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"menus" | "sources">("menus");
  
  // 🌟 Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // 🌟 Form States
  const [menuForm, setMenuForm] = useState({ shop_name: "", menu_name: "", price: "" });
  const [sourceForm, setSourceForm] = useState({ name: "" });

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = useCallback((message: string, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    // ดึงข้อมูลเมนู
    const { data: menuData, error: menuError } = await supabase
      .from("shop_menus")
      .select("*")
      .order("shop_name", { ascending: true })
      .order("menu_name", { ascending: true });

    // ดึงข้อมูลร้าน
    const { data: sourceData, error: sourceError } = await supabase
      .from("contact_sources")
      .select("*")
      .order("name", { ascending: true });

    if (menuError || sourceError) {
      console.error(menuError, sourceError);
      showToast("ดึงข้อมูลไม่สำเร็จ", "error");
    } else {
      setMenus(menuData as ShopMenu[]);
      setSources(sourceData as ContactSource[]);
    }
    setIsLoading(false);
  }, [showToast]);

  useEffect(() => {
    const checkAuth = async () => {
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

      fetchData();
    };
    checkAuth();
  }, [router, fetchData]);

  // 🌟 กรองข้อมูลตาม Tab และ Search
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (activeTab === "menus") {
      return menus.filter(m => m.menu_name.toLowerCase().includes(query) || m.shop_name.toLowerCase().includes(query));
    } else {
      return sources.filter(s => s.name.toLowerCase().includes(query));
    }
  }, [menus, sources, searchQuery, activeTab]);

  // 🌟 เปิด Modal จัดการ
  const openModal = (item?: ShopMenu | ContactSource) => {
    if (activeTab === "menus") {
      const menu = item as ShopMenu;
      setEditingId(menu?.id || null);
      setMenuForm({ 
        shop_name: menu?.shop_name || (sources.length > 0 ? sources[0].name : ""), 
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

  // 🌟 ลบข้อมูล
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`ยืนยันการลบ "${name}" ใช่หรือไม่?`)) return;

    const table = activeTab === "menus" ? "shop_menus" : "contact_sources";
    const { error } = await supabase.from(table).delete().eq("id", id);
    
    if (error) {
      showToast("ลบข้อมูลไม่สำเร็จ (อาจมีข้อมูลผูกกันอยู่)", "error");
    } else {
      showToast("ลบข้อมูลเรียบร้อยแล้ว", "success");
      if (activeTab === "menus") setMenus(prev => prev.filter(m => m.id !== id));
      else setSources(prev => prev.filter(s => s.id !== id));
    }
  };

  // 🌟 บันทึกข้อมูล
 // 🌟 บันทึกข้อมูล
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const table = activeTab === "menus" ? "shop_menus" : "contact_sources";
    
    // 🌟 สร้าง Type มารองรับ payload แทนการใช้ any
    let payload: {
      shop_name?: string;
      menu_name?: string;
      price?: number;
      name?: string;
    };

    if (activeTab === "menus") {
      const priceNum = parseInt(menuForm.price.replace(/[^0-9]/g, ""), 10) || 0;
      payload = { shop_name: menuForm.shop_name.trim(), menu_name: menuForm.menu_name.trim(), price: priceNum };
    } else {
      payload = { name: sourceForm.name.trim() };
    }

    if (editingId) {
      const { data, error } = await supabase.from(table).update(payload).eq("id", editingId).select();
      if (error) showToast("แก้ไขไม่สำเร็จ (ชื่อร้านอาจซ้ำ)", "error");
      else {
        if (activeTab === "menus") setMenus(prev => prev.map(m => m.id === editingId ? data[0] as ShopMenu : m));
        else setSources(prev => prev.map(s => s.id === editingId ? data[0] as ContactSource : s));
        showToast("อัปเดตข้อมูลเรียบร้อย", "success");
        setIsModalOpen(false);
      }
    } else {
      const { data, error } = await supabase.from(table).insert([payload]).select();
      if (error) showToast("เพิ่มข้อมูลไม่สำเร็จ (ชื่อร้านอาจซ้ำ)", "error");
      else {
        if (activeTab === "menus") setMenus(prev => [...prev, data[0] as ShopMenu]);
        else setSources(prev => [...prev, data[0] as ContactSource]);
        showToast("เพิ่มข้อมูลใหม่เรียบร้อย", "success");
        setIsModalOpen(false);
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
              <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">Master Database Center</p>
            </div>
          </div>
          <button onClick={() => openModal()} className="w-full md:w-auto px-5 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center gap-2">
            <Plus size={18} /> {activeTab === "menus" ? "เพิ่มเมนูใหม่" : "เพิ่มแหล่งที่มา (ร้าน)"}
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-4 border-t border-slate-100 pt-2">
          <button 
            onClick={() => setActiveTab("menus")}
            className={`px-4 py-3 text-sm font-black border-b-2 transition-all flex items-center gap-2 ${activeTab === "menus" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
          >
            <LayoutList size={16} /> จัดการเมนูอาหาร ({menus.length})
          </button>
          <button 
            onClick={() => setActiveTab("sources")}
            className={`px-4 py-3 text-sm font-black border-b-2 transition-all flex items-center gap-2 ${activeTab === "sources" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
          >
            <Store size={16} /> แหล่งที่มา/ร้าน ({sources.length})
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
            placeholder={activeTab === "menus" ? "ค้นหาชื่อเมนู หรือ ชื่อร้าน..." : "ค้นหาแหล่งที่มา..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm text-slate-700"
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
            <p className="font-bold tracking-widest uppercase text-xs">กำลังโหลดฐานข้อมูล...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
            {activeTab === "menus" ? <Utensils size={48} className="mx-auto text-slate-300 mb-4" /> : <Store size={48} className="mx-auto text-slate-300 mb-4" />}
            <h3 className="text-lg font-black text-slate-700 mb-2">ไม่พบข้อมูล</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
            {activeTab === "menus" 
              ? (filteredData as ShopMenu[]).map((menu) => (
                  <div key={menu.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-full">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100 flex items-center gap-1 uppercase tracking-wider">
                          <Store size={10} /> {menu.shop_name}
                        </span>
                        <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => openModal(menu)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"><Edit size={14} /></button>
                          <button onClick={() => handleDelete(menu.id, menu.menu_name)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <h3 className="text-base font-black text-slate-800 mb-2 line-clamp-2">{menu.menu_name}</h3>
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
                {editingId ? `แก้ไข${activeTab === "menus" ? "เมนู" : "ร้าน"}` : `เพิ่ม${activeTab === "menus" ? "เมนูใหม่" : "ร้านใหม่"}`}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-2 rounded-full transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-slate-50/50">
              
              {activeTab === "menus" ? (
                <>
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-2 tracking-wide uppercase">แหล่งที่มา (ร้าน) *</label>
                    <select 
                      required
                      className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm cursor-pointer"
                      value={menuForm.shop_name}
                      onChange={(e) => setMenuForm({...menuForm, shop_name: e.target.value})}
                    >
                      <option value="" disabled>-- เลือกร้าน --</option>
                      {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
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
                    placeholder="เช่น เพจหลัก, Grab, Shopee..."
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