// board/[board_home]/dashboard/page.tsx
"use client";
import { useState, useEffect, useMemo, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, LayoutDashboard, TrendingUp, DollarSign, 
  CreditCard, Wallet, Bike, Calendar, Loader2, Trophy,
  Receipt, CheckCircle, Percent, Store, Award,
  Utensils, Timer, Truck, Activity
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from "recharts";
import { User as SupabaseUser } from "@supabase/supabase-js";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e'];
type DateFilterType = "today" | "singleDay" | "yesterday" | "7days" | "month" | "all" | "custom";

interface OrderData {
  id: string;
  order_number: string;
  total_price: number;
  payment_method: string;
  status: string;
  job_type: string;
  rider_name: string | null;
  menu: string | null;
  created_at: string;
  start_time: string | null; // อิงจากฐานข้อมูลจริง
  end_time: string | null;   // อิงจากฐานข้อมูลจริง
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-xl shadow-xl border border-white/10 text-white">
        <p className="font-bold text-sm mb-1 text-slate-300">{label}</p>
        <p className="font-black text-lg text-blue-400">฿{payload[0].value?.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

export default function BranchDashboardPage({ params }: { params: Promise<{ board_home: string }> }) {
  const resolvedParams = use(params);
  const branchSlug = resolvedParams.board_home;
  
  const router = useRouter();
  const [, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState<string>("");

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [businessDayStart, setBusinessDayStart] = useState<string>("07:00");
  
  // Filters
  const [timeRange, setTimeRange] = useState<DateFilterType>("today");
  const [singleDate, setSingleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
    if (!["admin", "superadmin", "kitchen"].includes(profile?.role || "")) { 
      router.push("/rider"); return; 
    }
    setCurrentUser(session.user);

    const { data: settings } = await supabase.from("store_settings").select("business_day_start").eq("id", 1).single();
    if (settings && settings.business_day_start) setBusinessDayStart(settings.business_day_start);

    const { data: branchData } = await supabase.from("branches").select("id, name").eq("slug", branchSlug).single();
    if (!branchData) { router.push("/home"); return; }
    setBranchName(branchData.name);

    const { data: orderData } = await supabase
      .from("orders")
      .select("id, order_number, total_price, payment_method, status, job_type, rider_name, menu, created_at, start_time, end_time")
      .eq("branch_id", branchData.id);
      
    if (orderData) setOrders(orderData as OrderData[]);
    setLoading(false);
  }, [router, branchSlug]);

  useEffect(() => {
    const init = async () => {
      await fetchDashboardData();
    };
    init();
  }, [fetchDashboardData]);

  const filteredOrders = useMemo(() => {
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
    else if (timeRange === "singleDay" && singleDate) {
      const target = new Date(singleDate);
      startDate = new Date(target.getFullYear(), target.getMonth(), target.getDate(), bizHour, bizMin, 0, 0);
      endDate = new Date(target.getFullYear(), target.getMonth(), target.getDate() + 1, bizHour, bizMin, 0, 0);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    }
    else if (timeRange === "yesterday") {
      startDate = new Date(y, m, d - 1, bizHour, bizMin, 0, 0);
      endDate = new Date(y, m, d, bizHour, bizMin, 0, 0);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    } 
    else if (timeRange === "7days") {
      startDate = new Date(y, m, d - 7, bizHour, bizMin, 0, 0);
    } 
    else if (timeRange === "month") {
      startDate = new Date(y, m, 1, bizHour, bizMin, 0, 0);
    }
    else if (timeRange === "custom" && customStart && customEnd) {
      startDate = new Date(customStart); startDate.setHours(bizHour, bizMin, 0, 0);
      endDate = new Date(customEnd); endDate.setDate(endDate.getDate() + 1); endDate.setHours(bizHour, bizMin, 0, 0);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    }

    return orders.filter(o => {
      const orderDate = new Date(o.created_at);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }, [orders, timeRange, businessDayStart, singleDate, customStart, customEnd]);

  const stats = useMemo(() => {
    let totalRevenue = 0; let transferRevenue = 0; let cashRevenue = 0; let completedCount = 0;
    let shopeeRevenue = 0; let storeRevenue = 0;
    const revenueByDate: Record<string, number> = {};
    const typeCount: Record<string, number> = {};

    const prepTimes: number[] = [];
    const deliveryTimes: number[] = [];
    const orderHourCounts: Record<string, number> = {};

    filteredOrders.forEach(o => {
      // นับออเดอร์รายชั่วโมง
      const dateObj = new Date(o.created_at);
      const hourLabel = `${dateObj.getHours().toString().padStart(2, '0')}:00`;
      orderHourCounts[hourLabel] = (orderHourCounts[hourLabel] || 0) + 1;

      if (o.status === "ส่งแล้ว/เสร็จ") {
        completedCount += 1;
        const price = Number(o.total_price) || 0;
        totalRevenue += price;
        
        if (o.payment_method === "โอน") transferRevenue += price;
        else cashRevenue += price;

        if (o.job_type === "shopee") shopeeRevenue += price;
        else storeRevenue += price;

        const dateStr = new Date(o.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        revenueByDate[dateStr] = (revenueByDate[dateStr] || 0) + price;

        // 🌟 คำนวณเวลาจากคอลัมน์จริงของฐานข้อมูล (start_time และ end_time)
        if (o.start_time) {
          const createdMs = new Date(o.created_at).getTime();
          const startMs = new Date(o.start_time).getTime();
          const diffMins = (startMs - createdMs) / 60000;
          if (diffMins > 0 && diffMins < 1440) prepTimes.push(diffMins);
        }
        if (o.start_time && o.end_time) {
          const startMs = new Date(o.start_time).getTime();
          const endMs = new Date(o.end_time).getTime();
          const diffMins = (endMs - startMs) / 60000;
          if (diffMins > 0 && diffMins < 1440) deliveryTimes.push(diffMins);
        }
      }
      typeCount[o.job_type] = (typeCount[o.job_type] || 0) + 1;
    });

    const barChartData = Object.keys(revenueByDate).map(date => ({ date, revenue: revenueByDate[date] })).reverse();
    const pieChartData = Object.keys(typeCount).map(type => ({ name: type, value: typeCount[type] }));
    const averagePerOrder = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;
    const successRate = filteredOrders.length > 0 ? Math.round((completedCount / filteredOrders.length) * 100) : 0;

    const minPrep = prepTimes.length ? Math.round(Math.min(...prepTimes)) : 0;
    const maxPrep = prepTimes.length ? Math.round(Math.max(...prepTimes)) : 0;
    const avgPrep = prepTimes.length ? Math.round(prepTimes.reduce((a,b) => a+b, 0) / prepTimes.length) : 0;

    const minDel = deliveryTimes.length ? Math.round(Math.min(...deliveryTimes)) : 0;
    const maxDel = deliveryTimes.length ? Math.round(Math.max(...deliveryTimes)) : 0;
    const avgDel = deliveryTimes.length ? Math.round(deliveryTimes.reduce((a,b) => a+b, 0) / deliveryTimes.length) : 0;

    const hoursList = Object.keys(orderHourCounts);
    let maxHourCount = 0; let peakHour = "-";
    let minHourCount = Infinity; let quietHour = "-";

    hoursList.forEach(h => {
       const c = orderHourCounts[h];
       if (c > maxHourCount) { maxHourCount = c; peakHour = h; }
       if (c < minHourCount) { minHourCount = c; quietHour = h; }
    });
    if (minHourCount === Infinity) minHourCount = 0;
    const avgOrdersPerHour = hoursList.length ? Math.round(filteredOrders.length / hoursList.length) : 0;

    return { 
      totalRevenue, transferRevenue, cashRevenue, completedCount, totalOrders: filteredOrders.length, 
      averagePerOrder, successRate, barChartData, pieChartData, shopeeRevenue, storeRevenue,
      minPrep, maxPrep, avgPrep, minDel, maxDel, avgDel,
      peakHour, maxHourCount, quietHour, minHourCount, avgOrdersPerHour
    };
  }, [filteredOrders]);

  const riderStats = useMemo(() => {
    const rStats: Record<string, { name: string, trips: number, revenue: number }> = {};
    filteredOrders.forEach(o => {
      if (o.status === "ส่งแล้ว/เสร็จ" && o.rider_name) {
        if (!rStats[o.rider_name]) rStats[o.rider_name] = { name: o.rider_name, trips: 0, revenue: 0 };
        rStats[o.rider_name].trips += 1;
        rStats[o.rider_name].revenue += Number(o.total_price) || 0;
      }
    });
    return Object.values(rStats).sort((a, b) => b.trips - a.trips);
  }, [filteredOrders]);

  const topMenus = useMemo(() => {
    const counts: Record<string, { name: string, qty: number }> = {};
    filteredOrders.forEach(o => {
      if (o.status === 'ส่งแล้ว/เสร็จ' && o.menu) {
        const lines = o.menu.split('\n');
        lines.forEach(line => {
          const cleanLine = line.trim();
          if (!cleanLine) return;
          const nameMatch = cleanLine.replace(/[0-9]/g, '').replace(/^[-*•]\s*/, '').trim();
          const qtyMatch = cleanLine.match(/\d+/g);
          const qty = qtyMatch ? parseInt(qtyMatch[qtyMatch.length - 1], 10) : 1;
          
          if (nameMatch && nameMatch.length > 1) {
             if (!counts[nameMatch]) counts[nameMatch] = { name: nameMatch, qty: 0 };
             counts[nameMatch].qty += qty;
          }
        });
      }
    });
    return Object.values(counts).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [filteredOrders]);

  const maxRiderTrips = Math.max(...riderStats.map(r => r.trips), 1);
  const maxMenuQty = Math.max(...topMenus.map(m => m.qty), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <Loader2 size={48} className="animate-spin text-blue-600" />
        <p className="font-bold tracking-widest animate-pulse uppercase text-slate-500">กำลังคำนวณสถิติสาขา...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 shrink-0">
            <button onClick={() => router.push(`/board/${branchSlug}`)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 bg-white shadow-sm border border-slate-200 cursor-pointer active:scale-95">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Store className="text-blue-600" size={24} /> สถิติสาขา: {branchName}
              </h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">Branch Performance</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner flex-1 sm:flex-none">
              <Calendar size={14} className="text-slate-500 ml-2 mr-1 hidden sm:block" />
              <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as DateFilterType)} className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer p-2 w-full sm:w-auto">
                <option value="today">🔥 วันนี้</option>
                <option value="singleDay">📌 เลือกดูเฉพาะวัน...</option>
                <option value="yesterday">⏪ เมื่อวาน</option>
                <option value="7days">📅 ย้อนหลัง 7 วัน</option>
                <option value="month">🗓️ เดือนนี้</option>
                <option value="custom">⚙️ กำหนดเวลาเอง...</option>
                <option value="all">📊 ทั้งหมด</option>
              </select>
            </div>

            {timeRange === 'singleDay' && (
              <div className="flex items-center bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-2">
                <input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} className="py-1.5 bg-transparent text-xs font-bold text-blue-600 outline-none cursor-pointer" />
              </div>
            )}

            {timeRange === 'custom' && (
              <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-2">
                <span className="text-slate-500 font-bold text-xs shrink-0">จาก</span>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="bg-transparent text-xs font-bold text-blue-600 outline-none cursor-pointer" />
                <span className="text-slate-300 font-bold mx-1">-</span>
                <span className="text-slate-500 font-bold text-xs shrink-0">ถึง</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="bg-transparent text-xs font-bold text-blue-600 outline-none cursor-pointer" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2 relative z-10">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><DollarSign size={20} /></div>
              <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-1 rounded-md">ส่งสำเร็จ</span>
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-slate-500 mb-1">ยอดขายรวมสุทธิ</p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">฿{stats.totalRevenue.toLocaleString()}</h3>
              <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-500">หน้าร้าน: <b className="text-blue-600">฿{stats.storeRevenue.toLocaleString()}</b></span>
                <span className="text-[10px] font-bold text-slate-500">Shopee: <b className="text-orange-500">฿{stats.shopeeRevenue.toLocaleString()}</b></span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><CreditCard size={20} /></div>
              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{((stats.transferRevenue / (stats.totalRevenue || 1)) * 100).toFixed(0)}%</span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-500 mb-1">รับเงินโอน</p>
              <h3 className="text-2xl font-black text-indigo-600 tracking-tighter">฿{stats.transferRevenue.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><Wallet size={20} /></div>
              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{((stats.cashRevenue / (stats.totalRevenue || 1)) * 100).toFixed(0)}%</span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-500 mb-1">เงินสด (ปลายทาง)</p>
              <h3 className="text-2xl font-black text-emerald-600 tracking-tighter">฿{stats.cashRevenue.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center"><TrendingUp size={20} /></div>
              <span className="text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-1 rounded-md">สำเร็จ {stats.successRate}%</span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-500 mb-1">งานเสร็จ / รวมทั้งหมด</p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter"><span className="text-orange-600">{stats.completedCount}</span> <span className="text-slate-300 text-xl">/ {stats.totalOrders}</span></h3>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center"><Receipt size={20} /></div>
              <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-1 rounded-md">AOV</span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-500 mb-1">ยอดเฉลี่ยต่อบิล</p>
              <h3 className="text-2xl font-black text-pink-600 tracking-tighter">฿{stats.averagePerOrder.toLocaleString()}</h3>
            </div>
          </div>
        </div>

        {/* 🌟 โซนวิเคราะห์เวลาและความหนาแน่น (ฟีเจอร์ใหม่) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group hover:border-orange-200 transition-colors">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity"><Timer size={100} /></div>
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Timer size={18} className="text-orange-500"/> เวลาเตรียมอาหาร (นาที)
            </h3>
            <div className="flex items-end gap-6 mb-2">
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">เฉลี่ย</p><span className="text-4xl font-black text-orange-600 leading-none">{stats.avgPrep}</span></div>
              <div className="pb-1"><p className="text-[10px] font-bold text-slate-400 uppercase">ไวสุด</p><span className="text-xl font-bold text-emerald-500">{stats.minPrep}</span></div>
              <div className="pb-1"><p className="text-[10px] font-bold text-slate-400 uppercase">ช้าสุด</p><span className="text-xl font-bold text-rose-500">{stats.maxPrep}</span></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group hover:border-blue-200 transition-colors">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity"><Truck size={100} /></div>
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Truck size={18} className="text-blue-500"/> เวลาจัดส่ง (นาที)
            </h3>
            <div className="flex items-end gap-6 mb-2">
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">เฉลี่ย</p><span className="text-4xl font-black text-blue-600 leading-none">{stats.avgDel}</span></div>
              <div className="pb-1"><p className="text-[10px] font-bold text-slate-400 uppercase">ไวสุด</p><span className="text-xl font-bold text-emerald-500">{stats.minDel}</span></div>
              <div className="pb-1"><p className="text-[10px] font-bold text-slate-400 uppercase">ช้าสุด</p><span className="text-xl font-bold text-rose-500">{stats.maxDel}</span></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group hover:border-fuchsia-200 transition-colors">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={100} /></div>
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity size={18} className="text-fuchsia-500"/> ออเดอร์เฉลี่ย/ชม.
            </h3>
            <div className="flex items-end gap-4 mb-2">
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">เฉลี่ยต่อชั่วโมง</p><span className="text-4xl font-black text-fuchsia-600 leading-none">{stats.avgOrdersPerHour} <span className="text-lg text-fuchsia-300">บิล</span></span></div>
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
               <span className="text-[11px] font-bold text-slate-500">🔥 พีคสุด: <b className="text-rose-500">{stats.peakHour}</b> <span className="text-slate-400">({stats.maxHourCount})</span></span>
               <span className="text-[11px] font-bold text-slate-500">🧊 น้อยสุด: <b className="text-blue-400">{stats.quietHour}</b> <span className="text-slate-400">({stats.minHourCount})</span></span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
            <h3 className="text-lg font-black text-slate-800 mb-6">📈 แนวโน้มยอดขาย (ส่งสำเร็จ)</h3>
            <div className="h-75 w-full min-h-75">
              {stats.barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="revenue" fill="url(#colorRevenue)" radius={[8, 8, 0, 0]} animationDuration={1500} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">ไม่มีข้อมูลยอดขายในฟิลเตอร์นี้</div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-black text-slate-800 mb-6">📊 สัดส่วนประเภทงาน</h3>
            <div className="h-75 w-full min-h-75">
              {stats.pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.pieChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" animationDuration={1500}>
                      {stats.pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity outline-none" />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">ไม่มีข้อมูลออเดอร์</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-4xl p-6 shadow-sm border border-slate-100 flex flex-col h-full max-h-100">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2"><Bike size={20} className="text-emerald-500" /> ผลงานไรเดอร์ประจำสาขา</h2>
              <Trophy size={20} className="text-amber-400" />
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto thin-scrollbar pr-2">
              {riderStats.length === 0 ? <div className="text-center text-slate-400 font-bold py-10">ไม่มีข้อมูล</div> : (
                riderStats.map((r, idx) => {
                  const percent = (r.trips / maxRiderTrips) * 100;
                  const isTop = idx === 0;
                  return (
                    <div key={idx} className={`p-4 rounded-2xl border transition-colors ${isTop ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-sm ${isTop ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600'}`}>{idx + 1}</div>
                          <span className="font-black text-slate-700">{r.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-600 text-base block leading-none">{r.trips} รอบ</span>
                          <span className="text-[10px] text-slate-400 font-bold">ยอดเก็บ: ฿{r.revenue.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden shadow-inner"><div className={`${isTop ? 'bg-amber-400' : 'bg-emerald-400'} h-2 rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }}></div></div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="bg-white rounded-4xl p-6 shadow-sm border border-slate-100 flex flex-col h-full max-h-100">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2"><Award size={20} className="text-rose-500" /> 5 อันดับเมนูขายดีของสาขานี้</h2>
              <Utensils size={20} className="text-rose-300" />
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto thin-scrollbar pr-2">
              {topMenus.length === 0 ? <div className="text-center text-slate-400 font-bold py-10">ไม่มีข้อมูลเมนู</div> : (
                topMenus.map((m, idx) => {
                  const percent = (m.qty / maxMenuQty) * 100;
                  return (
                    <div key={idx} className="p-4 rounded-2xl border bg-rose-50/30 border-rose-100/50">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-rose-400 text-sm">#{idx + 1}</span>
                          <span className="font-bold text-slate-700 text-sm">{m.name}</span>
                        </div>
                        <span className="font-black text-rose-600 bg-rose-100 px-2 py-1 rounded-lg text-xs">{m.qty} กล่อง</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-rose-400 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${percent}%` }}></div></div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}