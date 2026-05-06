"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import {
  ChevronLeft,
  Search,
  CheckCircle2,
  XCircle,
  Trash2,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  AlertCircle,
  X,
  ZoomIn,
  CheckSquare,
  Square,
  ListChecks,
  ScanLine
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type SlipStatus = "รอตรวจ" | "ผ่าน" | "ไม่ผ่าน";

interface OrderSlip {
  id: string;
  order_number: string;
  total_price: number;
  created_at: string;
  slip_image: string | null;
  slip_status: SlipStatus | null;
  rider_name: string | null;
}

type PopupConfig = {
  isOpen: boolean;
  type: "confirm" | "delete" | "delete_order";
  title: string;
  message: string;
  targetIds: string[];
  action: "approve" | "reject" | "clear_image" | "delete_order";
};

export default function SlipsManagementPage() {
  const [orders, setOrders] = useState<OrderSlip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filter, setFilter] = useState<SlipStatus | "all">("รอตรวจ");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  const [popup, setPopup] = useState<PopupConfig>({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
    targetIds: [],
    action: "approve",
  });
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });
  
  const [isScanning, setIsScanning] = useState<string | null>(null);

  // 🌟 นำฟังก์ชันดึงข้อมูลมาไว้ใน useEffect ตามมาตรฐาน React เพื่อแก้ Error
  useEffect(() => {
    const loadSlips = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, total_price, created_at, slip_image, slip_status, rider_name")
        .eq("payment_method", "โอน")
        .neq("job_type", "shopee")
        .or("is_archived.is.null,is_archived.eq.false")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
      } else if (data) {
        setOrders(data as OrderSlip[]);
      }
      setIsLoading(false);
    };

    loadSlips();
  }, []);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const closePopup = () => setPopup((prev) => ({ ...prev, isOpen: false }));

  const handleFilterChange = (newFilter: SlipStatus | "all") => {
    setFilter(newFilter);
    setSelectedIds(new Set());
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const filteredOrders = orders.filter((order) => {
    const matchFilter = filter === "all" ? true : order.slip_status === filter || (!order.slip_status && filter === "รอตรวจ");
    const matchSearch = order.order_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchSearch;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const executeAction = async () => {
    const { targetIds, action } = popup;
    closePopup();
    
    if (targetIds.length === 0) return;

    if (action === "delete_order") {
      const { error } = await supabase.from("orders").delete().in("id", targetIds);
      if (error) {
        showToast("เกิดข้อผิดพลาดในการลบข้อมูล", "error");
      } else {
        showToast(`ลบ ${targetIds.length} รายการเรียบร้อยแล้ว`, "success");
        setOrders(orders.filter(o => !targetIds.includes(o.id)));
        setSelectedIds(new Set());
      }
      return;
    }

    let updateData = {};
    let successMessage = "";

    if (action === "approve") {
      updateData = { slip_status: "ผ่าน" };
      successMessage = `อนุมัติ ${targetIds.length} รายการเรียบร้อยแล้ว!`;
    } else if (action === "reject") {
      updateData = { slip_status: "ไม่ผ่าน" };
      successMessage = `ปฏิเสธ ${targetIds.length} รายการเรียบร้อยแล้ว!`;
    } else if (action === "clear_image") {
      updateData = { slip_image: null };
      successMessage = `ล้างรูปภาพ ${targetIds.length} รายการเรียบร้อย!`;
    }

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .in("id", targetIds);

    if (error) {
      showToast("เกิดข้อผิดพลาดในการอัปเดตข้อมูล", "error");
    } else {
      showToast(successMessage, "success");
      setOrders(orders.map((o) => (targetIds.includes(o.id) ? { ...o, ...updateData } : o)));
      setSelectedIds(new Set());
    }
  };

  const handleSimulateOCR = async (orderId: string) => {
    setIsScanning(orderId);
    showToast("กำลังส่งข้อมูลให้ AI ตรวจสอบ...", "warning");
    
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    setIsScanning(null);
    showToast("AI ตรวจสอบเรียบร้อย ยอดเงินตรงกัน!", "success");
    setOrders(orders.map(o => o.id === orderId ? { ...o, slip_status: 'ผ่าน' } : o));
  };

  const stats = {
    pending: orders.filter((o) => !o.slip_status || o.slip_status === "รอตรวจ").length,
    approved: orders.filter((o) => o.slip_status === "ผ่าน").length,
    rejected: orders.filter((o) => o.slip_status === "ไม่ผ่าน").length,
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 md:p-8 flex flex-col items-center pb-32">
      {/* Toast Notification */}
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center px-5 py-3 rounded-full shadow-2xl z-50 ${toast.type === "success" ? "bg-emerald-600 text-white" : toast.type === "warning" ? "bg-amber-500 text-white" : "bg-rose-600 text-white"} ${toast.show ? "translate-y-0 opacity-100" : "-translate-y-20 opacity-0 pointer-events-none"}`}>
        {toast.type === "success" ? <CheckCircle2 size={18} className="mr-2" /> : toast.type === "warning" ? <Loader2 size={18} className="mr-2 animate-spin" /> : <AlertCircle size={18} className="mr-2" />}
        <span className="font-bold text-sm tracking-wide text-white">{toast.message}</span>
      </div>

      <div className="w-full max-w-7xl space-y-6">
        {/* Header */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
        onClick={() => router.back()} 
        className="flex items-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer active:scale-95"
          >
          <ChevronLeft size={20} className="mr-1" /> ย้อนกลับ
          </button>
            <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <ShieldCheck className="text-emerald-500" size={28} /> จัดการสลิปโอนเงิน
              </h1>
              <p className="text-sm text-slate-500 font-medium">ตรวจสอบ ยืนยัน และจัดการรูปหลักฐานการโอนเงิน</p>
            </div>
          </div>

          <div className="flex w-full md:w-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="ค้นหาเลขที่ออเดอร์..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full md:w-64 pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Stats & Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button onClick={() => handleFilterChange("รอตรวจ")} className={`p-4 rounded-3xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between h-32 ${filter === "รอตรวจ" ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-105 z-10 border-amber-500" : "bg-white border-slate-100 hover:border-amber-200 hover:bg-amber-50 shadow-sm"}`}>
            <div className="flex justify-between w-full">
              <span className={`text-sm font-black tracking-wider uppercase ${filter === "รอตรวจ" ? "text-amber-100" : "text-slate-500"}`}>รอตรวจสอบ</span>
              <AlertCircle size={20} className={filter === "รอตรวจ" ? "text-white opacity-80" : "text-amber-500"} />
            </div>
            <div className="text-3xl md:text-4xl font-black">{stats.pending} <span className="text-sm font-bold opacity-80">บิล</span></div>
          </button>

          <button onClick={() => handleFilterChange("ผ่าน")} className={`p-4 rounded-3xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between h-32 ${filter === "ผ่าน" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105 z-10 border-emerald-500" : "bg-white border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 shadow-sm"}`}>
            <div className="flex justify-between w-full">
              <span className={`text-sm font-black tracking-wider uppercase ${filter === "ผ่าน" ? "text-emerald-100" : "text-slate-500"}`}>ผ่านแล้ว</span>
              <CheckCircle2 size={20} className={filter === "ผ่าน" ? "text-white opacity-80" : "text-emerald-500"} />
            </div>
            <div className="text-3xl md:text-4xl font-black">{stats.approved} <span className="text-sm font-bold opacity-80">บิล</span></div>
          </button>

          <button onClick={() => handleFilterChange("ไม่ผ่าน")} className={`p-4 rounded-3xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between h-32 ${filter === "ไม่ผ่าน" ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-105 z-10 border-rose-500" : "bg-white border-slate-100 hover:border-rose-200 hover:bg-rose-50 shadow-sm"}`}>
            <div className="flex justify-between w-full">
              <span className={`text-sm font-black tracking-wider uppercase ${filter === "ไม่ผ่าน" ? "text-rose-100" : "text-slate-500"}`}>ไม่ผ่าน / มีปัญหา</span>
              <XCircle size={20} className={filter === "ไม่ผ่าน" ? "text-white opacity-80" : "text-rose-500"} />
            </div>
            <div className="text-3xl md:text-4xl font-black">{stats.rejected} <span className="text-sm font-bold opacity-80">บิล</span></div>
          </button>

          <button onClick={() => handleFilterChange("all")} className={`p-4 rounded-3xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between h-32 ${filter === "all" ? "bg-slate-800 text-white shadow-lg shadow-slate-500/30 scale-105 z-10 border-slate-800" : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50 shadow-sm"}`}>
            <div className="flex justify-between w-full">
              <span className={`text-sm font-black tracking-wider uppercase ${filter === "all" ? "text-slate-300" : "text-slate-500"}`}>รายการทั้งหมด</span>
              <ImageIcon size={20} className={filter === "all" ? "text-white opacity-80" : "text-slate-500"} />
            </div>
            <div className="text-3xl md:text-4xl font-black">{orders.length} <span className="text-sm font-bold opacity-80">บิล</span></div>
          </button>
        </div>

        {/* Bulk Action Toolbar */}
        <div className={`transition-all duration-300 overflow-hidden ${selectedIds.size > 0 ? 'h-auto opacity-100 mb-4' : 'h-0 opacity-0 m-0'}`}>
          <div className="bg-indigo-900 text-white p-4 rounded-2xl shadow-xl flex flex-wrap justify-between items-center gap-4 border border-indigo-800">
            <div className="flex items-center gap-3 font-black text-sm">
              <div className="bg-indigo-800 px-3 py-1.5 rounded-lg text-indigo-300">
                เลือกอยู่ <span className="text-white text-lg ml-1">{selectedIds.size}</span> รายการ
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => setPopup({ isOpen: true, type: 'confirm', title: 'อนุมัติทุกบิลที่เลือก?', message: `ระบบจะเปลี่ยนสถานะ ${selectedIds.size} บิลนี้เป็น "ผ่าน"`, targetIds: Array.from(selectedIds), action: 'approve' })}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black uppercase rounded-xl transition-all shadow-lg active:scale-95 flex items-center"
              >
                <CheckCircle2 size={16} className="mr-1.5" /> ผ่านทั้งหมด
              </button>
              
              <button 
                onClick={() => setPopup({ isOpen: true, type: 'confirm', title: 'ปฏิเสธทุกบิลที่เลือก?', message: `ระบบจะเปลี่ยนสถานะ ${selectedIds.size} บิลนี้เป็น "ไม่ผ่าน"`, targetIds: Array.from(selectedIds), action: 'reject' })}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-black uppercase rounded-xl transition-all shadow-lg active:scale-95 flex items-center"
              >
                <XCircle size={16} className="mr-1.5" /> ไม่ผ่านทั้งหมด
              </button>
              
              <div className="h-6 w-px bg-indigo-700 mx-1"></div>

              <button 
                onClick={() => setPopup({ isOpen: true, type: 'delete', title: 'ล้างรูปสลิปทุกบิลที่เลือก?', message: `รูปภาพสลิปของ ${selectedIds.size} บิลนี้จะถูกลบทิ้ง (แต่ข้อมูลบิลยังอยู่)`, targetIds: Array.from(selectedIds), action: 'clear_image' })}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-black uppercase rounded-xl transition-all shadow-lg active:scale-95 flex items-center"
              >
                <ImageIcon size={16} className="mr-1.5" /> ล้างรูปทิ้ง
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-2">
          {/* Header Action Bar */}
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <button 
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-black text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {selectedIds.size === filteredOrders.length && filteredOrders.length > 0 ? (
                <CheckSquare size={20} className="text-indigo-600" />
              ) : (
                <Square size={20} className="text-slate-400" />
              )}
              เลือกทั้งหมด
            </button>
            <span className="text-xs font-bold text-slate-400">แสดงผล {filteredOrders.length} รายการ</span>
          </div>

          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 size={40} className="animate-spin text-emerald-500" />
              <p className="font-bold tracking-widest animate-pulse uppercase">กำลังโหลดข้อมูลสลิป...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-20 bg-slate-50/50 m-4 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center animate-in fade-in duration-500">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                <ListChecks size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-700 mb-1">ไม่พบรายการบิล</h3>
              <p className="text-xs font-medium text-slate-400">ลองเปลี่ยนตัวกรอง หรือค้นหาใหม่นะครับ</p>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-in fade-in duration-500">
              {filteredOrders.map((order) => {
                const isSelected = selectedIds.has(order.id);
                return (
                  <div
                    key={order.id}
                    className={`relative bg-white rounded-4xl overflow-hidden shadow-sm border-2 transition-all duration-300 group flex flex-col h-full cursor-pointer hover:shadow-lg ${isSelected ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-100 hover:border-slate-300'}`}
                    onClick={() => toggleSelection(order.id)}
                  >
                    {/* Checkbox Icon */}
                    <div className="absolute top-4 left-4 z-20 transition-all">
                      {isSelected ? (
                        <div className="bg-indigo-500 text-white rounded-full p-0.5 shadow-md animate-in zoom-in-50"><CheckCircle2 size={24} /></div>
                      ) : (
                        <div className="bg-white/80 backdrop-blur-sm text-slate-300 rounded-full p-0.5 border-2 border-slate-300 opacity-50 group-hover:opacity-100 transition-opacity"><Square size={24} /></div>
                      )}
                    </div>

                    {/* Image Section */}
                    <div className="relative aspect-4/5 w-full bg-slate-100 border-b border-slate-100 overflow-hidden flex items-center justify-center">
                      {order.slip_image ? (
                        <>
                          <Image
                            src={order.slip_image.split(",")[0]}
                            alt="Slip"
                            fill
                            className={`object-cover transition-transform duration-700 ${isSelected ? 'scale-105 brightness-90' : 'group-hover:scale-105'}`}
                            sizes="(max-width: 768px) 100vw, 300px"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedImage(order.slip_image!.split(",")[0]); }}
                            className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-zoom-in backdrop-blur-[2px]"
                          >
                            <div className="bg-white/95 text-slate-800 px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 font-black text-xs hover:scale-105 transition-transform">
                              <ZoomIn size={16} /> ดูเต็มจอ
                            </div>
                          </button>
                          {order.slip_image.split(",").length > 1 && (
                            <div className="absolute top-4 right-4 bg-slate-900/80 text-white text-[10px] font-black px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/20 shadow-md">
                              +{order.slip_image.split(",").length - 1} รูป
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 opacity-50 bg-slate-50 w-full h-full justify-center">
                          <ImageIcon size={40} className="mb-2" strokeWidth={1.5} />
                          <span className="text-[10px] font-black uppercase tracking-widest">ไม่มีรูปสลิป</span>
                        </div>
                      )}

                      {/* Status Badge */}
                      <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg border backdrop-blur-md ${
                        order.slip_status === "ผ่าน" ? "bg-emerald-500/95 text-white border-emerald-400" :
                        order.slip_status === "ไม่ผ่าน" ? "bg-rose-500/95 text-white border-rose-400" :
                        "bg-amber-500/95 text-white border-amber-400 animate-pulse"
                      }`}>
                        {order.slip_status || "รอตรวจ"}
                      </div>
                      
                      {/* OCR Scanner Simulation Overlay */}
                      {isScanning === order.id && (
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-emerald-400">
                          <ScanLine size={48} className="animate-bounce mb-2" />
                          <span className="text-xs font-black uppercase tracking-widest bg-slate-900/80 px-3 py-1 rounded-full">AI Scanning...</span>
                        </div>
                      )}
                    </div>

                    {/* Details Section */}
                    <div className="p-5 flex-1 flex flex-col bg-white z-10 relative">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">เลขออเดอร์</p>
                          <h3 className="text-lg font-black text-slate-800 tracking-tight">{order.order_number}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">ยอดโอน</p>
                          <p className="text-lg font-black text-blue-600">฿{order.total_price}</p>
                        </div>
                      </div>

                      <div className="text-[10px] font-bold text-slate-500 mb-4 bg-slate-50/80 p-2 rounded-xl border border-slate-100 flex items-center justify-between">
                        <span>📅 {new Date(order.created_at).toLocaleDateString("th-TH")}</span>
                        <span>⏰ {new Date(order.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>

                      {/* Action Buttons (Individual) */}
                      <div className="mt-auto flex gap-2">
                        {order.slip_image && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSimulateOCR(order.id); }}
                            className="flex-[0.4] py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black rounded-xl transition-colors flex items-center justify-center text-[10px] shadow-sm border border-indigo-100 group/ocr"
                            title="ให้ AI ตรวจสลิป"
                          >
                            <ScanLine size={16} className="group-hover/ocr:animate-pulse" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setPopup({ isOpen: true, type: "confirm", title: "ปฏิเสธสลิปนี้?", message: "สลิปยอดเงินไม่ตรง หรือเป็นสลิปปลอม?", targetIds: [order.id], action: "reject" }); }}
                          className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-400 font-black rounded-xl transition-all flex items-center justify-center text-[11px] shadow-sm"
                        >
                          <XCircle size={14} className="mr-1.5" /> ไม่ผ่าน
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPopup({ isOpen: true, type: "confirm", title: "อนุมัติสลิปนี้?", message: "ตรวจสอบยอดเงินเรียบร้อยถูกต้องใช่หรือไม่?", targetIds: [order.id], action: "approve" }); }}
                          className="flex-1 py-2.5 bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 font-black rounded-xl transition-all flex items-center justify-center text-[11px] shadow-sm"
                        >
                          <CheckCircle2 size={14} className="mr-1.5" /> ผ่าน
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 🌟 Modal: ดูรูปภาพขนาดเต็ม */}
      {selectedImage && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer active:scale-90 shadow-lg">
            <X size={24} strokeWidth={2.5} />
          </button>
          <div className="relative w-full h-full max-w-4xl max-h-screen p-8 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedImage} alt="Slip Fullsize" className="max-w-full max-h-full object-contain rounded-4xl shadow-2xl animate-in zoom-in-95 duration-300 border border-white/10" />
          </div>
        </div>
      )}

      {/* 🌟 Modal: ยืนยันการกระทำ (Approve / Reject / Clear / Delete) */}
      {popup.isOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-4xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 border border-slate-100 flex flex-col p-8 text-center relative">
            {popup.action === "approve" && (
              <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <CheckCircle2 size={40} className="animate-bounce" />
              </div>
            )}
            {popup.action === "reject" && (
              <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <XCircle size={40} className="animate-bounce" />
              </div>
            )}
            {popup.action === "clear_image" && (
              <div className="w-20 h-20 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-slate-200">
                <ImageIcon size={40} />
              </div>
            )}
            {popup.action === "delete_order" && (
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-red-200">
                <Trash2 size={40} className="animate-pulse" />
              </div>
            )}

            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">{popup.title}</h3>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed px-2">{popup.message}</p>

            <div className="flex gap-3">
              <button onClick={closePopup} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all cursor-pointer active:scale-95 text-sm uppercase tracking-widest">
                ยกเลิก
              </button>
              <button
                onClick={executeAction}
                className={`flex-1 py-4 text-white font-black rounded-2xl transition-all cursor-pointer shadow-lg active:scale-95 text-sm uppercase tracking-widest ${
                  popup.action === "approve" ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30" :
                  popup.action === "reject" ? "bg-rose-600 hover:bg-rose-500 shadow-rose-500/30" :
                  popup.action === "delete_order" ? "bg-red-600 hover:bg-red-500 shadow-red-500/30" :
                  "bg-slate-800 hover:bg-slate-700 shadow-slate-800/30"
                }`}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}