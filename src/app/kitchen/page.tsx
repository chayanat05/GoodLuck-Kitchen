"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { 
  ArrowLeft, Calendar, Loader2, Trophy, PiggyBank,
  Clock, ChefHat, Banknote, CalendarDays, Utensils, Camera, X, LogOut
} from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import Swal from "sweetalert2";
import { toast } from "sonner";

type TimeRange = "today" | "shift1" | "shift2" | "yesterday" | "7days" | "30days" | "cycle" | "custom" | "all";

interface AttendanceRecord {
  id: string;
  check_in: string;
  check_out: string | null;
  check_in_image: string | null;
  check_out_image: string | null;
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

interface Branch {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

// Helper function to show alerts
const showAlert = (title: string, message: string, icon: "success" | "error" | "warning" | "info" = "info") => {
  if (icon === "success") {
    toast.success(title, { description: message });
  } else if (icon === "error") {
    toast.error(title, { description: message });
  } else {
    Swal.fire({ title, text: message, icon, confirmButtonColor: "#3b82f6", confirmButtonText: "รับทราบ" });
  }
};

const getLocalYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getInitialBizDate = (businessDayStart: string = "07:00") => {
  const [bizHour, bizMin] = businessDayStart ? businessDayStart.split(':').map(Number) : [7, 0];
  const now = new Date();
  if (now.getHours() < bizHour || (now.getHours() === bizHour && now.getMinutes() < bizMin)) {
    now.setDate(now.getDate() - 1);
  }
  return getLocalYMD(now);
};

const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function KitchenDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [userName, setUserName] = useState("");
  const [userBranchId, setUserBranchId] = useState("");
  const [userRole, setUserRole] = useState("");

  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [businessDayStart, setBusinessDayStart] = useState<string>("07:00");
  const [shift1Start, setShift1Start] = useState<string>("12:00");
  const [shift1End, setShift1End] = useState<string>("20:00");
  const [shift2Start, setShift2Start] = useState<string>("19:00");
  const [shift2End, setShift2End] = useState<string>("04:00");

  const [customStartDate, setCustomStartDate] = useState<string>(getInitialBizDate("07:00"));
  const [customEndDate, setCustomEndDate] = useState<string>(getInitialBizDate("07:00"));

  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // State for photo check-in
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraAction, setCameraAction] = useState<'in' | 'out'>('in');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isProcessingAttendance, setIsProcessingAttendance] = useState(false);
  
  const activeShift = useMemo(() => attendances.find(a => !a.check_out), [attendances]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    
    const { data: profile } = await supabase.from("profiles").select("role, username, branch_id").eq("id", session.user.id).single();
    if (profile?.role !== "kitchen" && profile?.role !== "admin" && profile?.role !== "superadmin") { 
      router.push("/login"); 
      return; 
    }
    setCurrentUser(session.user);
    setUserName(profile.username || "แม่ครัว");
    setUserBranchId(profile.branch_id || "");
    setUserRole(profile.role);

    // Fetch all branches for distance calculation
    const { data: bData } = await supabase.from("branches").select("id, name, lat, lng").order("created_at", { ascending: true });
    if (bData) setBranches(bData as Branch[]);

    const { data: settings } = await supabase.from("store_settings").select("*").eq("id", 1).single();
    if (settings) {
      if (settings.business_day_start) {
        setBusinessDayStart(settings.business_day_start);
        setCustomStartDate(getInitialBizDate(settings.business_day_start));
        setCustomEndDate(getInitialBizDate(settings.business_day_start));
      }
      if (settings.shift1_start) setShift1Start(settings.shift1_start);
      if (settings.shift1_end) setShift1End(settings.shift1_end);
      if (settings.shift2_start) setShift2Start(settings.shift2_start);
      if (settings.shift2_end) setShift2End(settings.shift2_end);
    }

    const { data: attData } = await supabase
      .from("kitchen_attendance")
      .select("*")
      .eq("kitchen_id", session.user.id)
      .order("check_in", { ascending: false })
      .limit(5000);
    if (attData) setAttendances(attData as AttendanceRecord[]);

    if (profile.branch_id) {
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, created_at, status")
        .eq("branch_id", profile.branch_id)
        .eq("job_type", "ร้าน") 
        .not("is_deleted", "eq", true)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (orderData) setOrders(orderData as OrderRecord[]);
    }
    
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // GPS Location Effect
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setMyLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("GPS Error:", error);
          setMyLocation(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const submitAttendance = async () => {
    if (!photoFile || !currentUser) return;

    const isSuper = userRole === "superadmin" || userRole === "admin";
    if (!isSuper) {
      if (!myLocation) {
        showAlert("ไม่พบพิกัด GPS", "กำลังค้นหาตำแหน่งของคุณ กรุณารอสักครู่...", "warning");
        return;
      }

      let minDistance = Infinity;
      branches.forEach(b => {
        if (b.lat && b.lng) {
          const dist = getDistanceFromLatLonInKm(myLocation.lat, myLocation.lng, b.lat, b.lng) * 1000;
          if (dist < minDistance) {
            minDistance = dist;
          }
        }
      });

      if (minDistance > 50) {
        showAlert("อยู่ไกลเกินไป ❌", `ต้องอยู่ในรัศมี 50 เมตรจากร้านเพื่อตอกบัตร (ตอนนี้อยู่ห่าง ${Math.round(minDistance)} เมตร)`, "error");
        return;
      }
    }

    setIsProcessingAttendance(true);
    try {
      const fileExt = photoFile.name.split('.').pop() || 'jpg';
      const fileName = `attendance-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('rider-applications').upload(fileName, photoFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('rider-applications').getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      if (cameraAction === 'in') {
        const { error } = await supabase.from('kitchen_attendance').insert([{
          kitchen_id: currentUser.id,
          check_in_image: imageUrl
        }]);
        if (error) throw error;
        showAlert("เข้างานสำเร็จ!", "ตอกบัตรเข้างานเรียบร้อย", "success");
      } else {
        if (!activeShift) return;
        const now = new Date();
        const checkInDate = new Date(activeShift.check_in);
        const minutes = Math.floor((now.getTime() - checkInDate.getTime()) / 60000);
        
        const { error } = await supabase.from('kitchen_attendance').update({
          check_out: now.toISOString(),
          total_minutes: minutes,
          check_out_image: imageUrl
        }).eq('id', activeShift.id);
        if (error) throw error;
        showAlert("เลิกงานสำเร็จ!", "ตอกบัตรออกงานเรียบร้อย", "success");
      }
      
      setShowCameraModal(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      await fetchData(); // Refresh all data
    } catch (err) {
      console.error(err);
      showAlert("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกข้อมูลตอกบัตรได้", "error");
    } finally {
      setIsProcessingAttendance(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date(0); 
    let endDate = new Date(8640000000000000); 

    const [bizHour, bizMin] = businessDayStart ? businessDayStart.split(':').map(Number) : [7, 0];
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
      if (eH < sH || (eH === sH && eM < sM)) endDate.setDate(endDate.getDate() + 1); 
    } else if (timeRange === "shift2") {
      const [sH, sM] = shift2Start.split(':').map(Number);
      const [eH, eM] = shift2End.split(':').map(Number);
      startDate = new Date(y, m, d, sH, sM, 0, 0);
      endDate = new Date(y, m, d, eH, eM, 0, 0);
      if (eH < sH || (eH === sH && eM < sM)) endDate.setDate(endDate.getDate() + 1); 
    } else if (timeRange === "yesterday") {
      startDate = new Date(y, m, d - 1, bizHour, bizMin, 0, 0);
      endDate = new Date(y, m, d, bizHour, bizMin, 0, 0);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    } else if (timeRange === "7days") {
      startDate = new Date(y, m, d - 6, bizHour, bizMin, 0, 0);
      endDate = new Date(y, m, d + 1, bizHour, bizMin, 0, 0);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    } else if (timeRange === "30days") {
      startDate = new Date(y, m, d - 29, bizHour, bizMin, 0, 0);
      endDate = new Date(y, m, d + 1, bizHour, bizMin, 0, 0);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    } else if (timeRange === "cycle") {
      startDate = new Date(now);
      if (now.getDate() >= 26) startDate.setDate(26);
      else { startDate.setMonth(startDate.getMonth() - 1); startDate.setDate(26); }
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === "custom") {
      if (customStartDate) { 
        const [sy, sm, sd] = customStartDate.split('-').map(Number);
        startDate = new Date(sy, sm - 1, sd, bizHour, bizMin, 0, 0); 
      }
      if (customEndDate) { 
        const [ey, em, ed] = customEndDate.split('-').map(Number);
        endDate = new Date(ey, em - 1, ed + 1, bizHour, bizMin, 0, 0); 
        endDate.setMilliseconds(endDate.getMilliseconds() - 1); 
      }
    }
    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRange();

  const filteredAttendances = useMemo(() => {
    return attendances.filter(a => {
      const checkInDate = new Date(a.check_in);
      return checkInDate >= startDate && checkInDate <= endDate;
    });
  }, [attendances, startDate, endDate]);

  const stats = useMemo(() => {
    let totalMins = 0;
    let totalPay = 0;

    filteredAttendances.forEach(a => {
      if (!a.check_out) {
        const checkInTime = new Date(a.check_in).getTime();
        const mins = Math.max(0, Math.floor((currentTime.getTime() - checkInTime) / 60000));
        totalMins += mins;
        
        let rate = 40;
        if ((a.base_pay || 0) > 0 && (a.total_minutes || 0) > 0) rate = (a.base_pay / a.total_minutes) * 60;
        totalPay += (mins / 60) * rate;
      } else {
        totalMins += a.total_minutes || 0;
        totalPay += a.total_pay || a.base_pay || 0;
      }
    });

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
       {showCameraModal && (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-4xl p-6 w-full max-w-sm flex flex-col items-center shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black mb-2 text-slate-800">
              {cameraAction === 'in' ? '📸 ถ่ายรูปเข้างาน' : '📸 ถ่ายรูปเลิกงาน'}
            </h3>
            <p className="text-xs text-slate-500 mb-6 text-center">ต้องถ่ายรูปเซลฟี่กับหน้าร้านเพื่อยืนยันตัวตนเข้าระบบ</p>
            
            {photoPreview ? (
               <div className="relative w-full aspect-square rounded-3xl overflow-hidden mb-6 shadow-md border-4 border-slate-100">
                <img src={photoPreview} className="object-cover w-full h-full" alt="Preview" />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="absolute top-3 right-3 bg-rose-500/90 backdrop-blur-md text-white p-2.5 rounded-full shadow-lg hover:bg-rose-600 transition-colors cursor-pointer">
                  <X size={18} strokeWidth={3}/>
                </button>
              </div>
            ) : (
              <label className="w-full aspect-square bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center mb-6 cursor-pointer hover:bg-slate-100 hover:border-blue-400 transition-all group">
                <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Camera size={36} className="text-blue-500" />
                </div>
                <span className="font-black text-slate-600 text-lg">แตะเพื่อถ่ายรูป</span>
                <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">เปิดกล้องมือถือ</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="user" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      setPhotoFile(file);
                      setPhotoPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
            )}

            <div className="flex gap-3 w-full">
              <button 
                onClick={() => {setShowCameraModal(false); setPhotoFile(null); setPhotoPreview(null);}} 
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors active:scale-95 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                disabled={!photoFile || isProcessingAttendance} 
                onClick={submitAttendance}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black disabled:bg-slate-300 transition-colors shadow-lg shadow-blue-500/30 flex justify-center items-center active:scale-95 cursor-pointer"
              >
                {isProcessingAttendance ? <Loader2 className="animate-spin" size={20}/> : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

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
           {activeShift ? (
              <button onClick={() => { setCameraAction('out'); setShowCameraModal(true); }} className="px-6 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-rose-500/30 active:scale-95 transition-all cursor-pointer flex justify-center items-center gap-2">
                <LogOut size={16} /> ออกงาน
              </button>
            ) : (
              <button onClick={() => { setCameraAction('in'); setShowCameraModal(true); }} className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-500/30 active:scale-95 transition-all cursor-pointer flex justify-center items-center gap-2">
                <Clock size={16} /> เข้างาน
              </button>
            )}
        </div>

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
                    <div className="text-right flex items-center gap-2">
                       {a.check_in_image && <img src={a.check_in_image} alt="Check in" className="w-10 h-10 rounded-md object-cover" />}
                       {a.check_out_image && <img src={a.check_out_image} alt="Check out" className="w-10 h-10 rounded-md object-cover" />}
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
