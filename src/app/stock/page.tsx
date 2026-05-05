"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { 
  ArrowLeft, Package, Plus, Search, Filter, AlertTriangle, 
  Layers, Store, X, CheckCircle2, PackagePlus, Box 
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface StockItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  min_alert: number;
  current_quantity: number; // 🌟 คอลัมน์พิเศษที่เราจะคำนวณบวกเลขมาใส่
}

export default function StockPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // 🌟 State สำหรับข้อมูลสต๊อก
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 State สำหรับ Modal เพิ่มสินค้า
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "แพคเกจจิ้ง",
    unit: "ชิ้น",
    min_alert: 10
  });

  // 🌟 State สำหรับแจ้งเตือน (Toast)
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message: string, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  // 🌟 ฟังก์ชันดึงข้อมูลสินค้าและยอดคงเหลือ
  const fetchStockData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. ดึงรายการสินค้าทั้งหมดที่เป็น Master Data
      const { data: itemsData, error: itemsError } = await supabase
        .from("stock_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (itemsError) throw itemsError;

      // 2. ดึงยอดคงเหลือตามสาขาที่เลือก
      let balancesQuery = supabase.from("stock_balances").select("*");
      if (selectedBranch !== "ALL") {
        balancesQuery = balancesQuery.eq("branch_id", selectedBranch);
      }
      const { data: balancesData, error: balancesError } = await balancesQuery;

      if (balancesError) throw balancesError;

      // 3. จับคู่ข้อมูล (คำนวณยอดรวม ถ้ารวมสาขาก็บวกเลขเข้าด้วยกัน)
      const mergedData = (itemsData || []).map((item) => {
        const itemBalances = (balancesData || []).filter((b) => b.item_id === item.id);
        const totalQty = itemBalances.reduce((sum, b) => sum + (b.quantity || 0), 0);
        
        return {
          ...item,
          current_quantity: totalQty
        };
      });

      setStockItems(mergedData);
    } catch (error) {
      console.error("Error fetching stock:", error);
      showToast("เกิดข้อผิดพลาดในการดึงข้อมูล", "error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    const fetchBranches = async () => {
      const { data } = await supabase.from("branches").select("id, name").order("created_at");
      if (data) setBranches(data);
    };
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // 🌟 ฟังก์ชันบันทึกสินค้าใหม่ลง Database
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from("stock_items").insert([{
        name: formData.name.trim(),
        category: formData.category,
        unit: formData.unit.trim(),
        min_alert: formData.min_alert
      }]);

      if (error) throw error;

      showToast("เพิ่มรายการสินค้าใหม่สำเร็จ!");
      setIsAddModalOpen(false);
      setFormData({ name: "", category: "แพคเกจจิ้ง", unit: "ชิ้น", min_alert: 10 });
      fetchStockData(); // ดึงข้อมูลใหม่มาแสดง
    } catch (error) {
      console.error("Error adding item:", error);
      showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🌟 ตัวกรองสำหรับช่องค้นหา
  const filteredItems = stockItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 🌟 คำนวณสถิติ
  const totalItems = stockItems.length;
  const lowStockItems = stockItems.filter(item => item.current_quantity <= item.min_alert).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      
      {/* 🌟 Toast Notification */}
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl z-50 ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>
        {toast.type === 'error' ? <AlertTriangle size={18} className="text-rose-400 mr-2" /> : <CheckCircle2 size={18} className="text-emerald-400 mr-2" />}
        <span className="font-bold text-sm tracking-wide">{toast.message}</span>
      </div>

      {/* 🌟 Header */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 bg-white shadow-sm border border-slate-100 cursor-pointer active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center">
              <Package className="mr-2 text-orange-500" size={24} /> 
              คลังสินค้า <span className="text-slate-400 font-medium ml-2 text-sm hidden sm:inline">| Inventory</span>
            </h1>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/20 text-sm cursor-pointer"
          >
            <Plus size={16} /> <span className="hidden sm:inline">เพิ่มสินค้าใหม่</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        
        {/* 🌟 ตัวกรองสาขา */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-8 flex overflow-x-auto thin-scrollbar gap-2">
          <button
            onClick={() => setSelectedBranch("ALL")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm whitespace-nowrap transition-all cursor-pointer ${
              selectedBranch === "ALL" 
                ? "bg-orange-50 text-orange-600 border border-orange-200 shadow-sm" 
                : "text-slate-500 hover:bg-slate-50 border border-transparent"
            }`}
          >
            <Layers size={18} /> ภาพรวมทุกสาขา
          </button>
          
          <div className="w-px bg-slate-200 mx-1 my-2 shrink-0"></div>
          
          {branches.map(branch => (
            <button
              key={branch.id}
              onClick={() => setSelectedBranch(branch.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all cursor-pointer ${
                selectedBranch === branch.id 
                  ? "bg-blue-50 text-blue-600 border border-blue-200 shadow-sm" 
                  : "text-slate-500 hover:bg-slate-50 border border-transparent"
              }`}
            >
              <Store size={18} /> {branch.name}
            </button>
          ))}
        </div>

        {/* 🌟 การ์ดสรุปยอด */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">รายการทั้งหมด (แบบ)</p>
              <h2 className="text-3xl font-black text-slate-800">{totalItems}</h2>
            </div>
            <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
              <Box size={28} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">แจ้งเตือนใกล้หมด / หมด</p>
              <h2 className={`text-3xl font-black ${lowStockItems > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                {lowStockItems}
              </h2>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${lowStockItems > 0 ? 'bg-rose-50 text-rose-500 animate-pulse' : 'bg-emerald-50 text-emerald-500'}`}>
              {lowStockItems > 0 ? <AlertTriangle size={28} /> : <CheckCircle2 size={28} />}
            </div>
          </div>
        </div>

        {/* 🌟 พื้นที่รายการสินค้า */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="ค้นหาชื่อสินค้า, หมวดหมู่..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 font-bold"
              />
            </div>
            <button className="px-4 py-3 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors">
              <Filter size={18} /> หมวดหมู่
            </button>
          </div>

          {isLoading ? (
            <div className="p-20 flex justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
                <Package size={40} />
              </div>
              <h3 className="text-lg font-black text-slate-700 mb-2">ไม่พบข้อมูลสินค้า</h3>
              <p className="text-slate-500 font-medium text-sm max-w-xs">
                กดปุ่ม &quot;เพิ่มสินค้าใหม่&quot; ด้านบนเพื่อเริ่มจัดทำรายการวัตถุดิบและแพคเกจจิ้ง
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="p-4 font-black">ชื่อสินค้า / หมวดหมู่</th>
                    <th className="p-4 font-black text-center">ยอดคงเหลือ</th>
                    <th className="p-4 font-black text-center">จุดแจ้งเตือน</th>
                    <th className="p-4 font-black text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-black text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-500 font-medium mt-1 bg-slate-100 inline-block px-2 py-0.5 rounded-md">
                          {item.category}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-lg font-black text-slate-800">{item.current_quantity}</span>
                        <span className="text-xs text-slate-500 font-bold ml-1">{item.unit}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-slate-500 font-bold text-xs border border-slate-200 px-2 py-1 rounded-lg">
                          &lt;= {item.min_alert}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {item.current_quantity === 0 ? (
                          <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-black">
                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div> หมดสต๊อก
                          </span>
                        ) : item.current_quantity <= item.min_alert ? (
                          <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-black">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div> ใกล้หมด
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-100">
                            ปกติ
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 🌟 Modal ป๊อปอัปสำหรับเพิ่มสินค้าใหม่ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <PackagePlus className="text-orange-500" size={20} /> เพิ่มสินค้าเข้าระบบ
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer active:scale-95">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddItem} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-wide">ชื่อสินค้า *</label>
                <input 
                  type="text" required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  placeholder="เช่น ถุงหูหิ้วไซส์ M, เนื้อหมูกรอบ"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-wide">หมวดหมู่</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="แพคเกจจิ้ง">แพคเกจจิ้ง (กล่อง, ถุง)</option>
                    <option value="วัตถุดิบอาหาร">วัตถุดิบอาหาร (ของสด)</option>
                    <option value="เครื่องดื่ม">เครื่องดื่ม / ของแห้ง</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-wide">หน่วยนับ</label>
                  <input 
                    type="text" required
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                    placeholder="เช่น ชิ้น, กก., แพ็ค"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-wide flex items-center justify-between">
                  แจ้งเตือนเมื่อเหลือน้อยกว่า 
                  <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded text-[10px]">ระบบจะขึ้นไฟแดงเตือน</span>
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" min="0" required
                    value={formData.min_alert}
                    onChange={e => setFormData({...formData, min_alert: parseInt(e.target.value) || 0})}
                    className="w-24 text-center p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl text-base font-black text-rose-600 outline-none focus:bg-white focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all"
                  />
                  <span className="text-sm font-bold text-slate-500">{formData.unit}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button 
                  type="button" onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-sm"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-blue-600 transition-all cursor-pointer shadow-lg active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed text-sm"
                >
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกสินค้า"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .thin-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .thin-scrollbar::-webkit-scrollbar-thumb { background: rgba(203, 213, 225, 1); border-radius: 10px; }
        .thin-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 1); }
      `}</style>
    </div>
  );
}