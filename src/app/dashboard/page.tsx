"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { 
  ArrowLeft, LayoutDashboard, TrendingUp, DollarSign, 
  CreditCard, Wallet, Store, Bike, Calendar, Loader2, Trophy
} from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";

interface OrderData {
  id: string;
  total_price: number;
  payment_method: string;
  status: string;
  branch_id: string;
  rider_id: string | null;
  rider_name: string | null;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
}

type TimeRange = "today" | "7days" | "30days" | "all";

export default function DashboardPage() {
  const router = useRouter();
  const [, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [cutOffHour, setCutOffHour] = useState<number>(4);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "kitchen") { 
      router.push("/rider"); 
      return; 
    }
    setCurrentUser(session.user);

    // ดึงค่าตั้งเวลาตัดยอด
    const { data: settings } = await supabase.from("store_settings").select("cut_off_hour").eq("id", 1).single();
    if (settings && settings.cut_off_hour !== undefined) {
      setCutOffHour(settings.cut_off_hour);
    }

    // ดึงสาขาทั้งหมด
    const { data: branchData } = await supabase.from("branches").select("id, name");
    if (branchData) setBranches(branchData);

    // ดึงออเดอร์ทั้งหมด (รวมที่ archive ไปแล้วเพื่อดูสถิติ)
    const { data: orderData } = await supabase
      .from("orders")
      .select("id, total_price, payment_method, status, branch_id, rider_id, rider_name, created_at");
      
    if (orderData) {
      setOrders(orderData as OrderData[]);
    }
    
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const init = async () => {
      await fetchDashboardData();
    };
    init();
  }, [fetchDashboardData]);

  // 🌟 ประมวลผลข้อมูลตามช่วงเวลาที่เลือก
  const filteredOrders = useMemo(() => {
    const now = new Date();
    let startDate = new Date(0); // All time

    if (timeRange === "today") {
      startDate = new Date(now);
      if (now.getHours() < cutOffHour) startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(cutOffHour, 0, 0, 0);
    } else if (timeRange === "7days") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === "30days") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    return orders.filter(o => new Date(o.created_at) >= startDate);
  }, [orders, timeRange, cutOffHour]);

  // 🌟 คำนวณสรุปยอด (รวมเฉพาะที่สถานะ "ส่งแล้ว/เสร็จ")
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let transferRevenue = 0;
    let cashRevenue = 0;
    let completedCount = 0;

    filteredOrders.forEach(o => {
      if (o.status === "ส่งแล้ว/เสร็จ") {
        completedCount += 1;
        const price = Number(o.total_price) || 0;
        totalRevenue += price;
        if (o.payment_method === "โอน") transferRevenue += price;
        else cashRevenue += price;
      }
    });

    return { totalRevenue, transferRevenue, cashRevenue, completedCount, totalOrders: filteredOrders.length };
  }, [filteredOrders]);

  // 🌟 คำนวณยอดขายแต่ละสาขา
  const branchStats = useMemo(() => {
    const bStats: Record<string, { name: string, revenue: number, count: number }> = {};
    branches.forEach(b => { bStats[b.id] = { name: b.name, revenue: 0, count: 0 }; });

    filteredOrders.forEach(o => {
      if (o.status === "ส่งแล้ว/เสร็จ" && bStats[o.branch_id]) {
        bStats[o.branch_id].revenue += Number(o.total_price) || 0;
        bStats[o.branch_id].count += 1;
      }
    });

    return Object.values(bStats).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, branches]);

  // 🌟 คำนวณอันดับไรเดอร์ (Leaderboard)
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

  // หายอดสูงสุดเพื่อทำ CSS Progress Bar
  const maxBranchRevenue = Math.max(...branchStats.map(b => b.revenue), 1);
  const maxRiderTrips = Math.max(...riderStats.map(r => r.trips), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <Loader2 size={48} className="animate-spin text-blue-600" />
        <p className="font-bold tracking-widest animate-pulse uppercase text-slate-500">กำลังคำนวณสถิติ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 bg-white shadow-sm border border-slate-200 cursor-pointer active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <LayoutDashboard className="text-blue-600" size={24} /> 
              Dashboard สถิติรวม
            </h1>
          </div>
          
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <Calendar size={14} className="text-slate-500 ml-2 mr-1 hidden sm:block" />
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer p-1.5"
            >
              <option value="today">🔥 กะวันนี้</option>
              <option value="7days">📅 ย้อนหลัง 7 วัน</option>
              <option value="30days">🗓️ ย้อนหลัง 30 วัน</option>
              <option value="all">📊 ทั้งหมด</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
        
        {/* 🌟 1. Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                <DollarSign size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-md">ส่งสำเร็จ</span>
            </div>
            <div>
              <p className="text-sm font-black text-slate-500 mb-1 uppercase tracking-wide">ยอดขายรวมสุทธิ</p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tighter">฿{stats.totalRevenue.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                <CreditCard size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{((stats.transferRevenue / (stats.totalRevenue || 1)) * 100).toFixed(0)}%</span>
            </div>
            <div>
              <p className="text-sm font-black text-slate-500 mb-1 uppercase tracking-wide">รับเงินโอน</p>
              <h3 className="text-3xl font-black text-indigo-600 tracking-tighter">฿{stats.transferRevenue.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                <Wallet size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{((stats.cashRevenue / (stats.totalRevenue || 1)) * 100).toFixed(0)}%</span>
            </div>
            <div>
              <p className="text-sm font-black text-slate-500 mb-1 uppercase tracking-wide">เงินสด (ปลายทาง)</p>
              <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">฿{stats.cashRevenue.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shadow-inner">
                <TrendingUp size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-md">ออเดอร์ทั้งหมด</span>
            </div>
            <div>
              <p className="text-sm font-black text-slate-500 mb-1 uppercase tracking-wide">งานเสร็จ / รวมทั้งหมด</p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tighter">
                <span className="text-orange-600">{stats.completedCount}</span> <span className="text-slate-300 text-2xl">/ {stats.totalOrders}</span>
              </h3>
            </div>
          </div>
        </div>

        {/* 🌟 2. Charts (Branch & Rider) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Branch Performance */}
          <div className="bg-white rounded-4xl p-6 md:p-8 shadow-sm border border-slate-200 flex flex-col h-full">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6 shrink-0">
              <Store size={20} className="text-blue-500" /> ยอดขายแยกตามสาขา
            </h2>
            <div className="space-y-6 flex-1">
              {branchStats.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 font-bold">ไม่มีข้อมูล</div>
              ) : (
                branchStats.map((b, idx) => {
                  const percent = (b.revenue / maxBranchRevenue) * 100;
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-slate-700">{b.name} <span className="text-[10px] text-slate-400 ml-1">({b.count} ออเดอร์)</span></span>
                        <span className="font-black text-slate-800">฿{b.revenue.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                        <div 
                          className="bg-blue-500 h-3 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Rider Leaderboard */}
          <div className="bg-white rounded-4xl p-6 md:p-8 shadow-sm border border-slate-200 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Bike size={20} className="text-emerald-500" /> ผลงานไรเดอร์ (รอบวิ่ง)
              </h2>
              <Trophy size={20} className="text-amber-400" />
            </div>
            
            <div className="space-y-4 flex-1 overflow-y-auto thin-scrollbar pr-2 max-h-100">
              {riderStats.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 font-bold">ไม่มีข้อมูล</div>
              ) : (
                riderStats.map((r, idx) => {
                  const percent = (r.trips / maxRiderTrips) * 100;
                  const isTop = idx === 0;
                  return (
                    <div key={idx} className={`p-4 rounded-2xl border transition-colors ${isTop ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-sm ${isTop ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {idx + 1}
                          </div>
                          <span className="font-black text-slate-700">{r.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-600 text-base block leading-none">{r.trips} รอบ</span>
                          <span className="text-[10px] text-slate-400 font-bold tracking-wide">ยอดเก็บ: ฿{r.revenue.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden shadow-inner">
                        <div 
                          className={`${isTop ? 'bg-amber-400' : 'bg-emerald-400'} h-2 rounded-full transition-all duration-1000 ease-out`} 
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>
      </div>

      <style jsx global>{`
        .thin-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .thin-scrollbar::-webkit-scrollbar-thumb { background: rgba(203, 213, 225, 1); border-radius: 10px; }
        .thin-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 1); }
      `}</style>
    </div>
  );
}