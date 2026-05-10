"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { 
  ArrowLeft, Package, Plus, Search, AlertTriangle, 
  Layers, Store, X, CheckCircle2, PackagePlus, Box, ShoppingCart, Target, Edit,
  Trash2, RefreshCw, PlusCircle, MinusCircle, Settings2, DollarSign
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface RawBalance {
  branch_id: string;
  quantity: number;
}

interface StockItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  min_alert: number;
  target_quantity: number;
  price_per_unit: number; // 🌟 เพิ่มราคาต่อหน่วย
  current_quantity: number; 
  raw_balances: RawBalance[]; 
}

export default function StockPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 Modal State (แก้ไขข้อมูลสินค้า)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    category: "แพคเกจจิ้ง",
    unit: "ชิ้น",
    min_alert: 10,
    target_quantity: 50,
    price_per_unit: 0, // 🌟 เพิ่มราคาต่อหน่วย
    initial_qty: 0,
    initial_branch: ""
  });

  // 🌟 Modal State (ปรับยอดสต๊อก)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({
    itemId: "",
    itemName: "",
    unit: "",
    branchId: "",
    type: "add", // 'add', 'deduct', 'set'
    amount: 0
  });

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message: string, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const fetchStockData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from("stock_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (itemsError) throw itemsError;

      const { data: balancesData, error: balancesError } = await supabase
        .from("stock_balances")
        .select("*");

      if (balancesError) throw balancesError;

      const mergedData = (itemsData || []).map((item) => {
        const itemBalances = (balancesData || []).filter((b) => b.item_id === item.id);
        
        const filteredBalances = selectedBranch === "ALL" 
          ? itemBalances 
          : itemBalances.filter(b => b.branch_id === selectedBranch);
          
        const totalQty = filteredBalances.reduce((sum, b) => sum + (b.quantity || 0), 0);
        
        return {
          ...item,
          target_quantity: item.target_quantity || 0,
          price_per_unit: item.price_per_unit || 0, // 🌟 ดึงราคาต่อหน่วย
          current_quantity: totalQty,
          raw_balances: itemBalances
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
      if (data) {
        setBranches(data);
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, initial_branch: data[0].id }));
        }
      }
    };
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: "",
      category: "แพคเกจจิ้ง",
      unit: "ชิ้น",
      min_alert: 10,
      target_quantity: 50,
      price_per_unit: 0,
      initial_qty: 0,
      initial_branch: selectedBranch !== "ALL" ? selectedBranch : (branches[0]?.id || "")
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: StockItem) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      category: item.category,
      unit: item.unit,
      min_alert: item.min_alert,
      target_quantity: item.target_quantity,
      price_per_unit: item.price_per_unit,
      initial_qty: 0, 
      initial_branch: ""
    });
    setIsModalOpen(true);
  };

  const openAdjustModal = (item: StockItem) => {
    setAdjustData({
      itemId: item.id,
      itemName: item.name,
      unit: item.unit,
      branchId: selectedBranch !== "ALL" ? selectedBranch : (branches[0]?.id || ""),
      type: "add",
      amount: 0
    });
    setIsAdjustModalOpen(true);
  };

  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const itemData = {
        name: formData.name.trim(),
        category: formData.category,
        unit: formData.unit.trim(),
        min_alert: formData.min_alert,
        target_quantity: formData.target_quantity,
        price_per_unit: formData.price_per_unit // 🌟 เซฟลงฐานข้อมูล
      };

      if (editingId) {
        const { error } = await supabase.from("stock_items").update(itemData).eq("id", editingId);
        if (error) throw error;
        showToast("บันทึกการแก้ไขสำเร็จ!");
      } else {
        const { data: newItemData, error: itemError } = await supabase
          .from("stock_items")
          .insert([itemData])
          .select();

        if (itemError) throw itemError;

        if (formData.initial_qty > 0 && formData.initial_branch && newItemData && newItemData.length > 0) {
          const { error: balanceError } = await supabase
            .from("stock_balances")
            .insert([{
              item_id: newItemData[0].id,
              branch_id: formData.initial_branch,
              quantity: formData.initial_qty
            }]);
            
          if (balanceError) throw balanceError;
        }
        showToast("เพิ่มรายการสินค้าใหม่สำเร็จ!");
      }

      setIsModalOpen(false);
      fetchStockData(); 
    } catch (error) {
      console.error("Error saving item:", error);
      showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    const isConfirmed = window.confirm(`⚠️ คำเตือน: คุณกำลังจะลบสินค้า "${name}"\n\nข้อมูลสต๊อกของสินค้านี้ใน "ทุกสาขา" จะถูกลบทิ้งถาวร แน่ใจหรือไม่?`);
    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from("stock_items").delete().eq("id", id);
      if (error) throw error;
      showToast("ลบสินค้าสำเร็จ!");
      fetchStockData();
    } catch (error) {
      console.error("Error deleting item:", error);
      showToast("เกิดข้อผิดพลาดในการลบ", "error");
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const currentItem = stockItems.find(i => i.id === adjustData.itemId);
      const currentBalance = currentItem?.raw_balances.find(b => b.branch_id === adjustData.branchId)?.quantity || 0;

      let newQuantity = currentBalance;
      const adjustVal = Number(adjustData.amount);

      if (adjustData.type === "add") newQuantity += adjustVal;
      else if (adjustData.type === "deduct") newQuantity = Math.max(0, newQuantity - adjustVal); 
      else if (adjustData.type === "set") newQuantity = Math.max(0, adjustVal);

      const { error } = await supabase.from("stock_balances").upsert(
        { item_id: adjustData.itemId, branch_id: adjustData.branchId, quantity: newQuantity },
        { onConflict: 'item_id, branch_id' }
      );

      if (error) throw error;

      showToast("อัปเดตยอดสต๊อกเรียบร้อยแล้ว!");
      setIsAdjustModalOpen(false);
      fetchStockData();
    } catch (error) {
      console.error("Error adjusting stock:", error);
      showToast("เกิดข้อผิดพลาดในการอัปเดตสต๊อก", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = stockItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = stockItems.length;
  const lowStockItems = stockItems.filter(item => item.current_quantity <= item.min_alert).length;
  
  // 🌟 คำนวณมูลค่าสต๊อกรวม
  const totalStockValue = stockItems.reduce((sum, item) => sum + (item.current_quantity * item.price_per_unit), 0);

  const activeAdjustItem = stockItems.find(i => i.id === adjustData.itemId);
  const activeAdjustBalance = activeAdjustItem?.raw_balances.find(b => b.branch_id === adjustData.branchId)?.quantity || 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl z-50 ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>
        {toast.type === 'error' ? <AlertTriangle size={18} className="text-rose-400 mr-2" /> : <CheckCircle2 size={18} className="text-emerald-400 mr-2" />}
        <span className="font-bold text-sm tracking-wide">{toast.message}</span>
      </div>

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
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/20 text-sm cursor-pointer"
          >
            <Plus size={16} /> <span className="hidden sm:inline">เพิ่มสินค้า</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        
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

        {/* 🌟 3 กล่องสถิติ (เพิ่มมูลค่าสต๊อกรวม) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">แจ้งเตือนต้องซื้อเพิ่ม</p>
              <h2 className={`text-3xl font-black ${lowStockItems > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                {lowStockItems}
              </h2>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${lowStockItems > 0 ? 'bg-rose-50 text-rose-500 animate-pulse' : 'bg-emerald-50 text-emerald-500'}`}>
              {lowStockItems > 0 ? <ShoppingCart size={28} /> : <CheckCircle2 size={28} />}
            </div>
          </div>
          <div className="bg-emerald-500 p-6 rounded-3xl border border-emerald-400 shadow-lg shadow-emerald-500/20 flex items-center justify-between text-white relative overflow-hidden">
            <DollarSign className="absolute -right-4 -bottom-4 text-emerald-600 opacity-50" size={100} />
            <div className="relative z-10">
              <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest mb-1">มูลค่าสต๊อกรวม (ต้นทุน)</p>
              <h2 className="text-3xl font-black">฿{totalStockValue.toLocaleString()}</h2>
            </div>
          </div>
        </div>

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
                กดปุ่ม &quot;เพิ่มสินค้า&quot; ด้านบนเพื่อเริ่มจัดทำรายการวัตถุดิบ
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-250">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4 font-black w-16 text-center border-r border-slate-100">ลบ</th>
                    <th className="p-4 font-black">ชื่อสินค้า / หมวดหมู่</th>
                    <th className="p-4 font-black text-center border-l border-slate-100">ปริมาณคงเหลือ</th>
                    <th className="p-4 font-black text-center border-l border-slate-100">ราคา/หน่วย</th>
                    <th className="p-4 font-black text-center border-l border-slate-100">มูลค่ารวม</th>
                    <th className="p-4 font-black text-center text-slate-600 border-l border-slate-100">เป้าหมาย (ควรมี)</th>
                    <th className="p-4 font-black text-center text-rose-500 border-l border-slate-100">ต้องซื้อเพิ่ม</th>
                    <th className="p-4 font-black text-center border-l border-slate-100">สถานะ</th>
                    <th className="p-4 font-black text-center border-l border-slate-100 w-32">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredItems.map(item => {
                    const needToBuy = item.current_quantity < item.target_quantity 
                      ? item.target_quantity - item.current_quantity 
                      : 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-center border-r border-slate-50">
                          <button 
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="p-2 text-rose-300 hover:text-white hover:bg-rose-500 rounded-xl transition-all cursor-pointer active:scale-95"
                            title="ลบสินค้านี้"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>

                        <td className="p-4">
                          <div className="font-black text-slate-800 text-base">{item.name}</div>
                          <div className="text-xs text-slate-500 font-medium mt-1 bg-slate-100 inline-block px-2 py-0.5 rounded-md">
                            {item.category}
                          </div>
                        </td>
                        
                        <td className="p-4 text-center border-l border-slate-50">
                          <span className={`text-xl font-black ${item.current_quantity <= item.min_alert ? 'text-rose-600' : 'text-slate-800'}`}>
                            {item.current_quantity}
                          </span>
                          <span className="text-xs text-slate-500 font-bold ml-1">{item.unit}</span>
                          <div className="text-[10px] text-slate-400 mt-1 font-bold">(เตือนเมื่อต่ำกว่า {item.min_alert})</div>
                        </td>

                        {/* 🌟 ราคาต่อหน่วย */}
                        <td className="p-4 text-center border-l border-slate-50">
                          <div className="font-bold text-slate-600">฿{item.price_per_unit.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">/{item.unit}</div>
                        </td>

                        {/* 🌟 มูลค่ารวม */}
                        <td className="p-4 text-center border-l border-slate-50">
                          <div className="font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 inline-block">
                            ฿{(item.current_quantity * item.price_per_unit).toLocaleString()}
                          </div>
                        </td>

                        <td className="p-4 text-center border-l border-slate-50">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                            <Target size={14} className="text-slate-400" />
                            <span className="font-black text-slate-600">{item.target_quantity}</span>
                          </div>
                        </td>

                        <td className={`p-4 text-center border-l border-slate-50 ${needToBuy > 0 ? 'bg-rose-50/20' : ''}`}>
                          {needToBuy > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="text-lg font-black text-rose-600">+{needToBuy}</span>
                              <span className="text-[10px] font-bold text-rose-400 bg-rose-100 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap">ซื้อเติมสต๊อก</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-black">-</span>
                          )}
                        </td>

                        <td className="p-4 text-center border-l border-slate-50">
                          {item.current_quantity === 0 ? (
                            <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-black border border-rose-200 shadow-sm whitespace-nowrap">
                              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div> ของหมด!
                            </span>
                          ) : item.current_quantity <= item.min_alert ? (
                            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-black border border-amber-200 shadow-sm whitespace-nowrap">
                              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div> ใกล้หมด
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-100">
                              <CheckCircle2 size={14} /> ปกติ
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-center border-l border-slate-50">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => openAdjustModal(item)}
                              className="px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl transition-all cursor-pointer active:scale-95 font-bold text-xs flex items-center gap-1 shadow-sm"
                              title="ปรับยอดคงเหลือ"
                            >
                              <RefreshCw size={14} /> ปรับยอด
                            </button>
                            <button 
                              onClick={() => openEditModal(item)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer active:scale-95"
                              title="แก้ไขข้อมูลสินค้า"
                            >
                              <Edit size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 🌟 Modal 1: ป๊อปอัปเพิ่ม/แก้ไขข้อมูลหลักสินค้า */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                {editingId ? <Edit className="text-blue-500" size={20} /> : <PackagePlus className="text-orange-500" size={20} />} 
                {editingId ? "แก้ไขข้อมูลสินค้า" : "เพิ่มสินค้าเข้าระบบ"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer active:scale-95">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto thin-scrollbar">
              <form id="stock-form" onSubmit={handleSubmitItem} className="p-6 space-y-6">
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

                {/* 🌟 ช่องใส่ราคาต่อหน่วย */}
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-2 uppercase tracking-wide">ราคาต่อหน่วย (บาท) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">฿</span>
                    <input 
                      type="number" min="0" step="0.01" required
                      value={formData.price_per_unit || ""}
                      onChange={e => setFormData({...formData, price_per_unit: parseFloat(e.target.value) || 0})}
                      className="w-full pl-8 pr-4 py-3.5 bg-white border border-emerald-200 rounded-xl text-sm font-black text-emerald-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-inner"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">
                      เป้าหมายที่ควรมี (Target)
                    </label>
                    <input 
                      type="number" min="0" required
                      value={formData.target_quantity}
                      onChange={e => setFormData({...formData, target_quantity: parseInt(e.target.value) || 0})}
                      className="w-full text-center p-3 bg-white border border-slate-300 rounded-xl text-sm font-black text-blue-600 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">
                      แจ้งเตือนเมื่อต่ำกว่า (Min)
                    </label>
                    <input 
                      type="number" min="0" required
                      value={formData.min_alert}
                      onChange={e => setFormData({...formData, min_alert: parseInt(e.target.value) || 0})}
                      className="w-full text-center p-3 bg-white border border-slate-300 rounded-xl text-sm font-black text-rose-600 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all"
                    />
                  </div>
                </div>

                {!editingId && (
                  <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl space-y-4">
                    <h4 className="text-xs font-black text-orange-600 uppercase tracking-widest flex items-center">
                      <Layers size={14} className="mr-1.5" /> ที่ซื้อเข้ามา
                    </h4>
                    
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" min="0"
                        value={formData.initial_qty}
                        onChange={e => setFormData({...formData, initial_qty: parseInt(e.target.value) || 0})}
                        className="w-24 text-center p-3.5 bg-white border border-slate-200 rounded-xl text-base font-black text-slate-800 outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all"
                      />
                      <span className="text-sm font-bold text-slate-500">{formData.unit}</span>
                    </div>

                    {formData.initial_qty > 0 && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wide">เก็บไว้ที่สาขาไหน?</label>
                        <select 
                          required
                          value={formData.initial_branch}
                          onChange={e => setFormData({...formData, initial_branch: e.target.value})}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all cursor-pointer shadow-sm"
                        >
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-3 shrink-0 bg-white">
              <button 
                type="button" onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-sm"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" form="stock-form" disabled={isSubmitting}
                className="flex-1 py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-blue-600 transition-all cursor-pointer shadow-lg active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed text-sm"
              >
                {isSubmitting ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Modal 2: ป๊อปอัปปรับยอดสต๊อก */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <RefreshCw className="text-emerald-500" size={20} /> ปรับยอดสต๊อก
              </h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer active:scale-95">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAdjustStock} className="p-6 space-y-6">
              
              <div className="text-center">
                <h4 className="text-xl font-black text-slate-800">{adjustData.itemName}</h4>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wide">จัดการของสาขา</label>
                <select 
                  value={adjustData.branchId}
                  onChange={e => setAdjustData({...adjustData, branchId: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <div className="mt-2 text-center text-xs font-bold text-slate-500">
                  ยอดปัจจุบันในสาขานี้: <span className="text-emerald-600 text-lg font-black">{activeAdjustBalance}</span> {adjustData.unit}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">รูปแบบการปรับยอด</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    type="button"
                    onClick={() => setAdjustData({...adjustData, type: 'add'})}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all cursor-pointer ${adjustData.type === 'add' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                  >
                    <PlusCircle size={18} /> <span className="text-[10px] font-black">รับเข้า</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAdjustData({...adjustData, type: 'deduct'})}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all cursor-pointer ${adjustData.type === 'deduct' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                  >
                    <MinusCircle size={18} /> <span className="text-[10px] font-black">เบิกออก</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAdjustData({...adjustData, type: 'set'})}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all cursor-pointer ${adjustData.type === 'set' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                  >
                    <Settings2 size={18} /> <span className="text-[10px] font-black">แก้เลขเป๊ะๆ</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">
                  ระบุจำนวน ({adjustData.unit})
                </label>
                <input 
                  type="number" min="0" required
                  value={adjustData.amount || ""}
                  onChange={e => setAdjustData({...adjustData, amount: parseInt(e.target.value) || 0})}
                  className="w-full text-center p-4 bg-white border border-slate-200 rounded-xl text-2xl font-black text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-inner"
                  placeholder="0"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-sm"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all cursor-pointer shadow-lg active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed text-sm"
                >
                  {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการปรับยอด"}
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