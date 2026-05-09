"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { 
  ArrowLeft, Calendar, Loader2, Trophy, PiggyBank,
  Clock, ChefHat, Banknote, CalendarDays, Utensils
} from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";

type TimeRange = "today" | "shift1" | "shift2" | "yesterday" | "7days" | "30days" | "cycle" | "custom" | "all";

interface AttendanceRecord {
  id: string;
  check_in: string;
  check_out: string | null;
  total_minutes: number;
  base_pay: number;
  diligence_bonus: number;
  accumulated_savings: number;
  total_pay: number;
}

interface OrderRecord {
  id: string;
  created_at: string;
  status: string;
}

export default function KitchenDashboardPage() {
  const router = useRouter();
  const [, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [userName, setUserName] = useState("");
  const [userBranchId, setUserBranchId] = useState("");

  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [businessDayStart, setBusinessDayStart] = useState<string>("07:00");
  const [shift1Start, setShift1Start] = useState<string>("10:00");
  const [shift1End, setShift1End] = useState<string>("17:00");
  const [shift2Start, setShift2Start] = useState<string>("17:00");
  const [shift2End, setShift2End] = useState<string>("03:00");

  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // อัปเดตเวลาสดทุก 1 นาที
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    
    const { data: profile } = await supabase.from("profiles").select("role, username, branch_id").eq("id", session.user.id).single();
    if (profile?.role !== "kitchen" && profile?.role !== "admin") { 
      router.push("/login"); 
      return; 
    }
    setCurrentUser(session.user);
    setUserName(profile.username || "แม่ครัว");
    setUserBranchId(profile.branch_id || "");

    const { data: settings } = await supabase.from("store_settings").select("*").eq("id", 1).single();
    if (settings) {
      if (settings.business_day_start) setBusinessDayStart(settings.business_day_start);
      if (settings.shift1_start) setShift1Start(settings.shift1_start);
      if (settings.shift1_end) setShift1End(settings.shift1_end);
      if (settings.shift2_start) setShift2Start(settings.shift2_start);
      if (settings.shift2_end) setShift2End(settings.shift2_end);
    }

    const { data: attData } = await supabase
      .from("rider_attendance")
      .select("*")
      .eq("rider_id", session.user.id)
      .order("check_in", { ascending: false });
    if (attData) setAttendances(attData as AttendanceRecord[]);

    if (profile.branch_id) {
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, created_at, status")
        .eq("branch_id", profile.branch_id)
        .eq("job_type", "ร้าน"); // สนใจแค่งานร้าน
      if (orderData) setOrders(orderData as OrderRecord[]);
    }
    
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ฟังก์ชันหาช่วงเวลา (Business Day Logic)
  const getDateRange = () => {
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
    } else if (timeRange === "shift1") {
      const [sH, sM] = shift1Start.split(':').map(Number);
      const [eH, eM] = shift1End.split(':').map(Number);
      startDate = new Date(y, m, d, sH, sM, 0, 0);
      endDate = new Date(y, m, d, eH, eM, 0, 0);
      if (eH < sH) endDate.setDate(endDate.getDate() + 1); 
    } else if (timeRange === "shift2") {
      const [sH, sM] = shift2Start.split(':').map(Number);
      const [eH, eM] = shift2End.split(':').map(Number);
      startDate = new Date(y, m, d, sH, sM, 0, 0);
      endDate = new Date(y, m, d, eH, eM, 0, 0);
      if (eH < sH) endDate.setDate(endDate.getDate() + 1); 
    } else if (timeRange === "yesterday") {
      startDate = new Date(y, m, d - 1, bizHour, bizMin, 0, 0);
      endDate = new Date(y, m, d, bizHour, bizMin, 0, 0);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    } else if (timeRange === "7days") {
      startDate = new Date(y, m, d - 7, bizHour, bizMin, 0, 0);
    } else if (timeRange === "30days") {
      startDate = new Date(y, m, d - 30, bizHour, bizMin, 0, 0);
    } else if (timeRange === "cycle") {
      startDate = new Date(now);
      if (now.getDate() >= 26) startDate.setDate(26);
      else { startDate.setMonth(startDate.getMonth() - 1); startDate.setDate(26); }
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === "custom") {
      if (customStartDate) { startDate = new Date(customStartDate); startDate.setHours(0, 0, 0, 0); }
      if (customEndDate) { endDate = new Date(customEndDate); endDate.setHours(23, 59, 59, 999); }
    }
    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRange();

  // กรองเวลาเข้างาน
  const filteredAttendances = useMemo(() => {
    return attendances.filter(a => {
      const checkInDate = new Date(a.check_in);
      return checkInDate >= startDate && checkInDate <= endDate;
    });
  }, [attendances, startDate, endDate]);

  // คำนวณสถิติ
  const stats = useMemo(() => {
    let totalMins = 0;
    let totalPay = 0;

    filteredAttendances.forEach(a => {
      if (!a.check_out) {
        // กำลังทำงาน (คำนวณสด)
        const checkInTime = new Date(a.check_in).getTime();
        const mins = Math.max(0, Math.floor((currentTime.getTime() - checkInTime) / 60000));
        totalMins += mins;
        
        // สมมติเรทครัว 40 บาท/ชม. (ถ้าไม่เคยตั้งค่า base_pay)
        let rate = 40;
        if ((a.base_pay || 0) > 0 && (a.total_minutes || 0) > 0) rate = (a.base_pay / a.total_minutes) * 60;
        totalPay += (mins / 60) * rate;
      } else {
        totalMins += a.total_minutes || 0;
        totalPay += a.total_pay || a.base_pay || 0;
      }
    });

    // นับออเดอร์ร้านที่เสร็จแล้ว ในช่วงเวลาที่เลือก
    let completedOrders = 0;
    orders.forEach(o => {
      const orderDate = new Date(o.created_at);
      if (orderDate >= startDate && orderDate <= endDate) {
        if (o.status === "รับงาน" || o.status === "ส่งแล้ว/เสร็จ") {
          completedOrders++;
        }
      }
    });

    return {
      minutes: totalMins,
      hours: (totalMins / 60).toFixed(1),
      pay: Math.round(totalPay),
      completedOrders
    };
  }, [filteredAttendances, orders, currentTime, startDate, endDate]);

  // คำนวณสะสมรอบบิล (โบนัส/เงินเก็บ ไม่สน Time Filter)
  const cycleStats = useMemo(() => {
    const now = new Date();
    const cStart = new Date(now);
    if (now.getDate() >= 26) cStart.setDate(26);
    else { cStart.setMonth(cStart.getMonth() - 1); cStart.setDate(26); }
    cStart.setHours(0, 0, 0, 0);

    let mBonus = 0;
    let mSavings = 0;
    attendances.forEach(a => {
      const checkInDate = new Date(a.check_in);
      if (checkInDate >= cStart) {
        mBonus += a.diligence_bonus || 0;
        mSavings += a.accumulated_savings || 0;
      }
    });
    return { mBonus, mSavings };
  }, [attendances]);

  const activeShift = attendances.find(a => !a.check_out);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <Loader2 size={48} className="animate-spin text-orange-500" />
        <p className="font-bold tracking-widest animate-pulse uppercase text-slate-500">กำลังเปิดครัว...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 shrink-0">
            <button 
              onClick={() => router.push(userBranchId ? `/board/${userBranchId}` : '/home')} 
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 bg-white shadow-sm border border-slate-200 cursor-pointer active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <ChefHat className="text-orange-500" size={24} /> 
              แดชบอร์ดแม่ครัว
            </h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner shrink-0 w-full sm:w-auto justify-end">
              <Calendar size={14} className="text-slate-500 ml-2 mr-1 hidden sm:block" />
              <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer p-1.5 w-full sm:w-auto text-right sm:text-left"
              >
                <option value="today">🔥 วันนี้ (รวมทั้งหมด)</option>
                <option value="shift1">☀️ เฉพาะกะเช้า</option>
                <option value="shift2">🌙 เฉพาะกะดึก</option>
                <option value="yesterday">⏪ เมื่อวาน</option>
                <option value="7days">📅 ย้อนหลัง 7 วัน</option>
                <option value="30days">🗓️ ย้อนหลัง 30 วัน</option>
                <option value="cycle">🔄 รอบบิลปัจจุบัน (26 - 25)</option>
                <option value="custom">⚙️ กำหนดเวลาเอง...</option>
                <option value="all">📊 ทั้งหมด</option>
              </select>
            </div>

            {timeRange === 'custom' && (
              <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto justify-end">
                <span className="text-slate-500 font-bold text-xs shrink-0">จาก</span>
                <input 
                  type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                />
                <span className="text-slate-300 font-bold mx-0.5">-</span>
                <span className="text-slate-500 font-bold text-xs shrink-0">ถึง</span>
                <input 
                  type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
        
        {/* Profile Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 flex items-center">
          <div className="w-14 h-14 bg-linear-to-br from-orange-400 to-red-500 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner mr-4 uppercase">
            {userName.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{userName}</h2>
            <div className="text-xs text-slate-500 flex items-center mt-1 font-bold">
              <div className={`w-2 h-2 rounded-full mr-2 shadow-sm ${activeShift ? 'bg-emerald-400 shadow-emerald-400/50 animate-pulse' : 'bg-slate-300'}`}></div>
              {activeShift ? 'กำลังเข้างาน (ทำอาหารอยู่)' : 'ออฟไลน์ (เลิกงานแล้ว)'}
            </div>
          </div>
        </div>

        {/* สถิติหลัก */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute -right-4 -top-4 bg-emerald-50 w-24 h-24 rounded-full flex items-end justify-start p-5">
              <Banknote size={32} className="text-emerald-500 opacity-20" />
            </div>
            <div className="relative z-10">
              <p className="text-sm font-black text-slate-500 mb-1 uppercase tracking-wide flex items-center gap-1.5"><Banknote size={16}/> ค่าแรง (ประมาณ)</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-black text-emerald-600 tracking-tighter">฿{stats.pay.toLocaleString()}</h3>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-2">*คำนวณจากชั่วโมงทำงานจริง</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute -right-4 -top-4 bg-blue-50 w-24 h-24 rounded-full flex items-end justify-start p-5">
              <Clock size={32} className="text-blue-500 opacity-20" />
            </div>
            <div className="relative z-10">
              <p className="text-sm font-black text-slate-500 mb-1 uppercase tracking-wide flex items-center gap-1.5"><Clock size={16}/> เวลาทำงาน</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-black text-blue-600 tracking-tighter">{stats.hours}</h3>
                <span className="text-sm font-bold text-slate-500">ชม.</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-2">รวม {stats.minutes.toLocaleString()} นาที</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute -right-4 -top-4 bg-orange-50 w-24 h-24 rounded-full flex items-end justify-start p-5">
              <Utensils size={32} className="text-orange-500 opacity-20" />
            </div>
            <div className="relative z-10">
              <p className="text-sm font-black text-slate-500 mb-1 uppercase tracking-wide flex items-center gap-1.5"><Utensils size={16}/> ออเดอร์ที่ทำเสร็จ</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-black text-orange-600 tracking-tighter">{stats.completedOrders}</h3>
                <span className="text-sm font-bold text-slate-500">บิล</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-2">*นับเฉพาะบิลร้าน (ไม่รวมรับหิ้ว)</p>
            </div>
          </div>
        </div>

        {/* ยอดสะสมรายเดือน */}
        <div className="bg-white rounded-4xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-sm font-black text-slate-700 flex items-center gap-2 mb-4 shrink-0">
            <CalendarDays size={18} className="text-indigo-500" /> สะสมรอบบิลปัจจุบัน (26 - 25)
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-4 bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-500 shrink-0"><Trophy size={24}/></div>
              <div>
                <div className="text-[10px] font-black text-amber-600/70 uppercase tracking-wider mb-0.5">โบนัสขยัน</div>
                <div className="text-xl font-black text-amber-700">฿{cycleStats.mBonus.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-500 shrink-0"><PiggyBank size={24}/></div>
              <div>
                <div className="text-[10px] font-black text-indigo-600/70 uppercase tracking-wider mb-0.5">เงินเก็บ</div>
                <div className="text-xl font-black text-indigo-700">฿{cycleStats.mSavings.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ล็อกตอกบัตร */}
        <div>
          <h3 className="font-black text-slate-700 mb-3 px-1 text-sm flex items-center justify-between">
            ประวัติการเข้างาน (ช่วงเวลาที่เลือก)
          </h3>
          <div className="space-y-3">
            {filteredAttendances.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-sm font-bold text-slate-400">ไม่มีประวัติในเวลานี้</p>
              </div>
            ) : (
              filteredAttendances.map(a => {
                const isWorking = !a.check_out;
                return (
                  <div key={a.id} className={`bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center ${isWorking ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'}`}>
                    <div>
                      <div className="font-black text-slate-800 text-sm flex items-center gap-2 mb-1">
                        {new Date(a.check_in).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {isWorking && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase border border-emerald-200 animate-pulse">กำลังทำ</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400" />
                        {new Date(a.check_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. 
                        - 
                        {isWorking ? ' ปัจจุบัน' : ` ${new Date(a.check_out!).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`}
                      </div>
                    </div>
                    <div className="text-right">
                      {isWorking ? (
                        <div className="text-sm font-black text-emerald-600">
                          {Math.floor((currentTime.getTime() - new Date(a.check_in).getTime()) / 60000)} นาที
                        </div>
                      ) : (
                        <div className="text-sm font-black text-slate-600">
                          {a.total_minutes} นาที
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}