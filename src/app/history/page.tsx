"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  ChevronLeft,
  Search,
  Loader2,
  Calendar,
  History,
  Store,
  Clock,
  MapPin,
  Utensils,
  Receipt,
  User
} from "lucide-react";
import { useRouter } from "next/navigation";

// 🌟 เพิ่ม Type สำหรับเวลา
type TimeRange = "today" | "yesterday" | "custom" | "all";

interface OrderHistory {
  id: string;
  order_number: string;
  branch_id: string;
  total_price: number;
  delivery_fee: number;
  created_at: string;
  end_time: string | null;
  rider_name: string | null;
  menu: string;
  address: string | null;
  job_type: string;
  payment_method: string;
  status: string;
  is_archived: boolean;
}

export default function HistoryPage() {
  const [orders, setOrders] = useState<OrderHistory[]>([]);
  const [branches, setBranches] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  // 🌟 State ใหม่สำหรับระบบเวลา
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [businessDayStart, setBusinessDayStart] = useState<string>("07:00");
  const [customDate, setCustomDate] = useState<string>("");

  const router = useRouter();

  // 🌟 ดึงค่า Settings เวลา, สาขา และ ออเดอร์ที่ถูก archive
  useEffect(() => {
    const loadData = async () => {
      // 1. ดึงตั้งค่าเวลา
      const { data: settings } = await supabase.from("store_settings").select("business_day_start").eq("id", 1).single();
      if (settings && settings.business_day_start) {
        setBusinessDayStart(settings.business_day_start);
      }

      // 2. ดึงข้อมูลสาขา
      const { data: branchesData } = await supabase.from("branches").select("id, name");
      if (branchesData) {
        const branchMap: Record<string, string> = {};
        branchesData.forEach(b => branchMap[b.id] = b.name);
        setBranches(branchMap);
      }

      // 3. ดึงออเดอร์ที่ archive แล้ว
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("is_archived", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching history:", error);
      } else if (data) {
        setOrders(data as OrderHistory[]);
      }
      setIsLoading(false);
    };

    loadData();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // 🌟 Step 1: กรองเฉพาะช่วงเวลา (Business Day) ก่อน
  const timeFilteredOrders = useMemo(() => {
    if (timeRange === "all") return orders;

    const now = new Date();
    let startDate = new Date(0); 
    let endDate = new Date(8640000000000000); 

    const [bizHour, bizMin] = businessDayStart.split(':').map(Number);
    const currentBizDate = new Date(now);
    if (now.getHours() < bizHour || (now.getHours() === bizHour && now.getMinutes() < bizMin)) {
      currentBizDate.setDate(currentBizDate.getDate() - 1);
    }
    const y = currentBizDate.getFullYear();
    const m = currentBizDate.getMonth();
    const d = currentBizDate.getDate();

    if (timeRange === "today") {
      startDate = new Date(y, m, d, bizHour, bizMin, 0, 0);
      endDate = new Date(y, m, d + 1, bizHour, bizMin, 0, 0);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    } 
    else if (timeRange === "yesterday") {
      startDate = new Date(y, m, d - 1, bizHour, bizMin, 0, 0);
      endDate = new Date(y, m, d, bizHour, bizMin, 0, 0);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    } 
    else if (timeRange === "custom") {
      if (customDate) {
        startDate = new Date(customDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customDate);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    return orders.filter(o => {
      const orderDate = new Date(o.created_at);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }, [orders, timeRange, businessDayStart, customDate]);

  // 🌟 Step 2: กรองตามสาขา และ คำค้นหา (สำหรับแสดงผล)
  const filteredOrders = useMemo(() => {
    return timeFilteredOrders.filter((order) => {
      const matchBranch = selectedBranch === "all" ? true : order.branch_id === selectedBranch;
      const matchSearch = 
        (order.order_number?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (order.menu?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (order.rider_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (order.address?.toLowerCase() || "").includes(searchQuery.toLowerCase());
      
      return matchBranch && matchSearch;
    });
  }, [timeFilteredOrders, selectedBranch, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 md:p-8 flex flex-col items-center pb-32">
      <div className="w-full max-w-7xl space-y-6">
        {/* Header */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => router.back()} 
              className="flex items-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer active:scale-95 bg-slate-50 px-3 py-2 rounded-xl"
            >
              <ChevronLeft size={20} className="mr-1" /> กลับ
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <History className="text-indigo-500" size={28} /> ประวัติงานที่จบไปแล้ว
              </h1>
              <p className="text-sm text-slate-500 font-medium">ดูประวัติออเดอร์ที่ถูกล้างออกจากบอร์ด</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
             {/* 🌟 ตัวเลือกสาขา */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner w-full md:w-auto">
              <Store size={14} className="text-slate-500 ml-3 mr-1 hidden sm:block" />
              <select 
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer p-2 w-full md:w-auto"
              >
                <option value="all">🏢 ทุกสาขา</option>
                {Object.entries(branches).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>

            {/* 🌟 ตัวเลือกช่วงเวลา */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner w-full md:w-auto">
              <Calendar size={14} className="text-slate-500 ml-3 mr-1 hidden sm:block" />
              <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer p-2 w-full md:w-auto"
              >
                <option value="today">🔥 วันนี้</option>
                <option value="yesterday">⏪ เมื่อวาน</option>
                <option value="custom">⚙️ กำหนดเวลาเอง...</option>
                <option value="all">📊 ทั้งหมด</option>
              </select>
            </div>
            
            {/* 🌟 ช่องค้นหา */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="ค้นหาเลขออเดอร์, เมนู, ไรเดอร์..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* 🌟 ตัวเลือกกำหนดวันที่เอง (ถ้าเลือก custom) */}
        {timeRange === 'custom' && (
          <div className="flex items-center gap-1.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto justify-end animate-in fade-in slide-in-from-top-2">
            <span className="text-slate-500 font-bold text-xs shrink-0">เลือกวันที่</span>
            <input 
              type="date" 
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none cursor-pointer"
            />
          </div>
        )}

        {/* Content List */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-2">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
            <span className="text-sm font-black text-slate-600">แสดงผล <span className="text-indigo-600">{filteredOrders.length}</span> รายการ</span>
            <span className="text-xs font-bold text-slate-400 hidden sm:inline-block">เรียงจากล่าสุดไปเก่าสุด</span>
          </div>

          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 size={40} className="animate-spin text-indigo-500" />
              <p className="font-bold tracking-widest animate-pulse uppercase">กำลังโหลดข้อมูลประวัติ...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-20 bg-slate-50/50 m-4 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center animate-in fade-in duration-500">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                <History size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-700 mb-1">ไม่พบประวัติออเดอร์</h3>
              <p className="text-xs font-medium text-slate-400">ยังไม่มีการล้างบอร์ดในช่วงเวลานี้ หรือค้นหาไม่พบ</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredOrders.map((order) => (
                <div key={order.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row gap-4 sm:gap-6 animate-in fade-in duration-300">
                  {/* Left Column: Order Meta */}
                  <div className="shrink-0 w-full sm:w-48 space-y-2">
                    <div className="flex items-center justify-between sm:justify-start gap-2">
                      <h3 className="text-xl font-black text-slate-800">#{order.order_number}</h3>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                        order.job_type === 'shopee' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-blue-50 text-blue-600 border-blue-200'
                      }`}>
                        {order.job_type === 'shopee' ? 'Shopee' : 'หน้าร้าน'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <Store size={14} className="text-slate-400" /> {branches[order.branch_id] || 'ไม่ระบุสาขา'}
                    </div>
                    <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <Clock size={14} className="text-slate-400" /> {new Date(order.created_at).toLocaleDateString('th-TH')} {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Middle Column: Details */}
                  <div className="flex-1 space-y-3">
                    <div className="bg-slate-100/50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-start gap-2">
                        <Utensils size={16} className="text-slate-400 shrink-0 mt-0.5" />
                        <div className="text-sm font-medium text-slate-700 whitespace-pre-line">
                          {order.menu || '-'}
                        </div>
                      </div>
                    </div>
                    
                    {order.job_type !== 'shopee' && (
                      <div className="flex items-start gap-2 text-xs font-bold text-slate-600">
                        <MapPin size={14} className="text-rose-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{order.address || 'ไม่ระบุสถานที่ส่ง'}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Status & Price */}
                  <div className="shrink-0 w-full sm:w-48 flex flex-col justify-between items-start sm:items-end gap-3 sm:gap-0">
                    <div className="flex items-center gap-2">
                      {order.rider_name && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                          <User size={12} /> {order.rider_name}
                        </span>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-wider bg-slate-800 text-white px-2 py-1 rounded shadow-sm">
                        {order.status}
                      </span>
                    </div>

                    <div className="w-full sm:w-auto bg-slate-50 p-3 rounded-xl border border-slate-100 text-right">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-end gap-1">
                        <Receipt size={12} /> ยอดรวม
                      </div>
                      <div className="text-xl font-black text-indigo-600">
                        ฿{order.total_price}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 mt-1">
                        ค่าส่ง ฿{order.delivery_fee || 0} • ชำระ: {order.payment_method || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
