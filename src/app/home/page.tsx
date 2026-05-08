"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { 
  Store, MapPin, ChevronRight, Activity, 
  LogOut, Loader2, Clock, ShieldCheck, Package, Menu, X, 
  Settings, MoonStar, AlertTriangle, CheckCircle2, Users, ScanSearch,
  Search, CheckSquare, Banknote, LayoutDashboard
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cut_off_hour: number;
  active_count: number;
  slug: string;
}

interface RiderProfile {
  id: string;
  username: string;
  branch_id: string | null; 
}

interface Attendance {
  id: string;
  rider_id: string;
  check_in: string;
  check_out: string | null;
}

export default function BranchSelectorPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // 🌟 State สำหรับระบบ HR ไรเดอร์
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  
  // 🌟 State สำหรับระบบค้นหา และเลือกหลายคน
  const [riderSearch, setRiderSearch] = useState("");
  const [selectedRiders, setSelectedRiders] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const [isCutoffOpen, setIsCutoffOpen] = useState(false);
  const [isClearBoardOpen, setIsClearBoardOpen] = useState(false);

  const [cutoffForm, setCutoffForm] = useState({ target: "ALL", hour: 4 });
  const [clearTarget, setClearTarget] = useState("ALL");

  const showToast = useCallback((message: string, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  }, []);

  const fetchBranchesAndStats = useCallback(async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const { data: branchesData, error: branchError } = await supabase
      .from("branches")
      .select("*")
      .order("created_at", { ascending: true });

    if (branchError || !branchesData) {
      console.error("Error fetching branches:", branchError);
      setIsLoading(false);
      return;
    }

    const { data: activeOrders } = await supabase
      .from("orders")
      .select("branch_id")
      .in("status", ["New", "กำลังทำ", "รับงาน"]);

    const branchList = branchesData.map(branch => {
      const count = activeOrders?.filter(o => o.branch_id === branch.id).length || 0;
      return { ...branch, active_count: count };
    });

    setBranches(branchList);

    // ดึงข้อมูลไรเดอร์พร้อมสาขา
    const { data: ridersData } = await supabase
      .from("profiles")
      .select("id, username, branch_id")
      .eq("role", "rider");
    
    if (ridersData) setRiders(ridersData);

    // ดึงข้อมูลการเข้างานวันนี้
    const today = new Date().toISOString().split('T')[0];
    const { data: attendanceData } = await supabase
      .from("rider_attendance")
      .select("*")
      .gte("check_in", `${today}T00:00:00Z`);

    if (attendanceData) {
      const attMap: Record<string, Attendance> = {};
      attendanceData.forEach(att => {
        attMap[att.rider_id] = att;
      });
      setAttendances(attMap);
    }

    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    fetchBranchesAndStats();
  }, [fetchBranchesAndStats]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleUpdateCutoff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let query = supabase.from("branches").update({ cut_off_hour: cutoffForm.hour });
      if (cutoffForm.target !== "ALL") {
        query = query.eq("id", cutoffForm.target);
      } else {
        query = query.not("id", "is", null); 
      }
      
      const { error } = await query;
      if (error) throw error;
      
      showToast("อัปเดตเวลาตัดยอดสำเร็จ!");
      setIsCutoffOpen(false);
      setIsMenuOpen(false);
      fetchBranchesAndStats();
    } catch (error) {
      console.error(error);
      showToast("เกิดข้อผิดพลาดในการอัปเดตเวลา", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    const isConfirmed = window.confirm("⚠️ ยืนยันการปิดยอดจบวัน?\nออเดอร์ในสาขาที่เลือกจะถูกซ่อนออกจากกระดานทันที");
    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      let query = supabase.from("orders").update({ is_archived: true }).neq("is_archived", true);
      if (clearTarget !== "ALL") {
        query = query.eq("branch_id", clearTarget);
      }
      
      const { error } = await query;
      if (error) throw error;
      
      showToast("🌙 ปิดยอดจบวัน (ล้างกระดาน) เรียบร้อย!");
      setIsClearBoardOpen(false);
      setIsMenuOpen(false);
      fetchBranchesAndStats();
    } catch (error) {
      console.error(error);
      showToast("เกิดข้อผิดพลาดในการล้างบอร์ด", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ฟังก์ชันจัดการตอกบัตรเดี่ยวๆ
  const handleSingleAction = async (riderId: string, type: 'in' | 'out') => {
    setIsSubmitting(true);
    try {
      if (type === 'in') {
        const { data, error } = await supabase
          .from("rider_attendance")
          .insert([{ rider_id: riderId }])
          .select()
          .single();
        if (error) throw error;
        setAttendances(prev => ({ ...prev, [riderId]: data }));
        showToast("เข้างานสำเร็จ! 🟢");
      } else {
        const att = attendances[riderId];
        if (!att) return;
        const now = new Date();
        const checkInDate = new Date(att.check_in);
        const minutes = Math.floor((now.getTime() - checkInDate.getTime()) / 60000);

        const { data, error } = await supabase
          .from("rider_attendance")
          .update({
            check_out: now.toISOString(),
            total_minutes: minutes,
          })
          .eq("id", att.id)
          .select()
          .single();
        if (error) throw error;
        setAttendances(prev => ({ ...prev, [riderId]: data }));
        showToast("ออกงานสำเร็จ! 🔴");
      }
    } catch (error) {
      console.error(error);
      showToast("เกิดข้อผิดพลาด", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ฟังก์ชันจัดการตอกบัตรหลายคนพร้อมกัน (Bulk Action)
  const handleBulkAction = async (type: 'in' | 'out') => {
    if (selectedRiders.length === 0) return;
    const isConfirmed = window.confirm(`ยืนยันการตอก${type === 'in' ? 'เข้า' : 'ออก'}งาน ${selectedRiders.length} คนพร้อมกัน?`);
    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      const promises = selectedRiders.map(async (id) => {
        const att = attendances[id];
        const isActive = att && !att.check_out;

        if (type === 'in' && !isActive) {
          const { data } = await supabase.from("rider_attendance").insert([{ rider_id: id }]).select().single();
          return { id, data };
        } else if (type === 'out' && isActive) {
          const now = new Date();
          const checkInDate = new Date(att.check_in);
          const minutes = Math.floor((now.getTime() - checkInDate.getTime()) / 60000);
          const { data } = await supabase.from("rider_attendance").update({
            check_out: now.toISOString(),
            total_minutes: minutes,
          }).eq("id", att.id).select().single();
          return { id, data };
        }
        return null;
      });

      const results = await Promise.all(promises);
      const newAtts = { ...attendances };
      results.forEach(res => {
        if (res?.data) newAtts[res.id] = res.data;
      });
      setAttendances(newAtts);
      setSelectedRiders([]);
      showToast(`ทำรายการ ${selectedRiders.length} รายการสำเร็จ!`);
    } catch (error) {
      console.error(error);
      showToast("เกิดข้อผิดพลาดบางรายการ", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRiderSelect = (id: string) => {
    setSelectedRiders(prev => prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]);
  };

  // กรอง เรียงลำดับ(คนที่เข้างานให้อยู่บน) และค้นหาไรเดอร์
  const sortedAndFilteredRiders = useMemo(() => {
    let result = riders;
    if (riderSearch.trim() !== "") {
      result = result.filter(r => r.username.toLowerCase().includes(riderSearch.toLowerCase()));
    }
    return result.sort((a, b) => {
      const isAActive = attendances[a.id] && !attendances[a.id].check_out ? 1 : 0;
      const isBActive = attendances[b.id] && !attendances[b.id].check_out ? 1 : 0;
      if (isAActive !== isBActive) return isBActive - isAActive; 
      return a.username.localeCompare(b.username); 
    });
  }, [riders, attendances, riderSearch]);

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return "ไม่ระบุสาขา";
    const b = branches.find(x => x.id === branchId);
    return b ? b.name : "ไม่ระบุสาขา";
  };

  const isAllSelected = sortedAndFilteredRiders.length > 0 && selectedRiders.length === sortedAndFilteredRiders.length;
  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedRiders([]);
    else setSelectedRiders(sortedAndFilteredRiders.map(r => r.id));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-12 flex flex-col items-center pb-20">
      
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl z-[150] ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>
        {toast.type === 'error' ? <AlertTriangle size={18} className="text-rose-400 mr-2" /> : <CheckCircle2 size={18} className="text-emerald-400 mr-2" />}
        <span className="font-bold text-sm tracking-wide">{toast.message}</span>
      </div>

      <div className="w-full max-w-7xl flex justify-between items-center mb-10 bg-white p-5 rounded-4xl shadow-sm border border-slate-100 relative z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 bg-slate-100 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer text-slate-600 hover:text-indigo-700 active:scale-95 shadow-sm"
          >
            <Menu size={24} />
          </button>
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl hidden sm:flex items-center justify-center shadow-inner">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">ระบบจัดการส่วนกลาง</h1>
            <p className="text-xs md:text-sm text-slate-500 font-bold">เลือกสาขา หรือจัดการระบบรวมของร้าน</p>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-black rounded-xl transition-colors active:scale-95 text-sm border border-rose-100 shadow-sm"
        >
          <LogOut size={18} />
          <span className="hidden md:inline">ออกจากระบบ</span>
        </button>
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 flex z-50">
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsMenuOpen(false)}
          ></div>
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 z-10 rounded-r-3xl overflow-hidden">
            <div className="bg-linear-to-br from-indigo-600 to-blue-800 p-8 text-white relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full pointer-events-none"></div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="absolute top-6 right-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all cursor-pointer backdrop-blur-md active:scale-90"
              >
                <X size={18} />
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-5 text-2xl font-black uppercase shadow-inner border border-white/20">
                A
              </div>
              <h2 className="font-black text-2xl mb-1 tracking-tight">
                ศูนย์บัญชาการหลัก
              </h2>
              <p className="text-indigo-200 text-xs font-bold tracking-wide flex items-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 shadow-md shadow-emerald-400"></span>{" "}
                ระบบจัดการรวม (ADMIN)
              </p>
            </div>
            
            <div className="flex-1 p-5 space-y-3 overflow-y-auto thin-scrollbar">
              
              {/* 🌟 1. ปุ่มจ่ายเงินไรเดอร์ (Payroll) */}
              <Link
                href="/payroll"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-2xl transition-all font-bold border border-transparent hover:border-emerald-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Banknote size={20} className="text-emerald-600" />
                </div>
                จ่ายเงินไรเดอร์ (Payroll)
              </Link>
              
              {/* 🌟 2. Dashboard สถิติรวม */}
              <Link
                href="/dashboard"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-2xl transition-all font-bold border border-transparent hover:border-blue-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <LayoutDashboard size={20} className="text-blue-600" />
                </div>
                Dashboard สถิติรวม
              </Link>

              <div className="h-px bg-slate-100 my-2"></div>

              {/* 🌟 3. จัดการสมาชิก */}
              <Link
                href="/users"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-2xl transition-all font-bold border border-transparent hover:border-indigo-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Users size={20} className="text-indigo-600" />
                </div>
                จัดการพนักงาน / ไรเดอร์
              </Link>

              <Link
                href="/stock"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-orange-50 hover:text-orange-700 rounded-2xl transition-all font-bold border border-transparent hover:border-orange-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Package size={20} className="text-orange-600" />
                </div>
                ระบบคลังสินค้า (Stock)
              </Link>

              <Link
                href="/slips"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-teal-50 hover:text-teal-700 rounded-2xl transition-all font-bold border border-transparent hover:border-teal-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <ScanSearch size={20} className="text-teal-600" />
                </div>
                ประวัติการโอนเงิน (สลิป)
              </Link>

              <div className="h-px bg-slate-100 my-2"></div>

              <button
                onClick={() => setIsCutoffOpen(true)}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-amber-50 hover:text-amber-700 rounded-2xl transition-all font-bold border border-transparent hover:border-amber-100 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Clock size={20} className="text-amber-600" />
                </div>
                ตั้งเวลาตัดยอดร้าน
              </button>

              <button
                onClick={() => setIsClearBoardOpen(true)}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-rose-50 hover:text-rose-700 rounded-2xl transition-all font-bold border border-transparent hover:border-rose-100 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <MoonStar size={20} className="text-rose-600" />
                </div>
                ปิดยอดจบวัน (ล้างบอร์ด)
              </button>

              <div className="h-px bg-slate-100 my-2"></div>

              <Link
                href="/setting"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-2xl transition-all font-bold cursor-pointer border border-transparent hover:border-slate-200 group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform group-hover:rotate-45">
                  <Settings size={20} className="text-slate-600" />
                </div>
                ตั้งค่าระบบรวม
              </Link>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center p-4 text-slate-500 bg-white border border-slate-200 hover:bg-slate-800 hover:text-white hover:border-slate-800 rounded-2xl transition-all duration-300 font-black cursor-pointer shadow-sm active:scale-95 group/logout"
              >
                <LogOut
                  size={18}
                  className="mr-2 group-hover/logout:-translate-x-1 transition-transform duration-300"
                />{" "}
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 ใช้งาน CSS Grid แบ่ง 2 ฝั่ง */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* 🟡 ฝั่งซ้าย: สาขาทั้งหมด (กินพื้นที่ 3 ส่วน) */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-slate-700 flex items-center gap-2">
              <Store size={20} className="text-indigo-500" /> สาขาทั้งหมดของร้าน ({branches.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-4">
              <Loader2 size={48} className="animate-spin text-indigo-500" />
              <p className="font-bold tracking-widest animate-pulse uppercase">กำลังดึงข้อมูล...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
              {branches.map((branch) => (
                <Link 
                  href={`/board/${branch.slug || branch.id}`} 
                  prefetch={false}
                  key={branch.id}
                  className="bg-white rounded-4xl p-6 shadow-sm hover:shadow-xl border border-slate-100 hover:border-indigo-200 transition-all duration-300 group cursor-pointer relative overflow-hidden block"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 opacity-50 transition-transform group-hover:scale-110"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
                        <Store size={28} />
                      </div>
                      {branch.active_count > 0 ? (
                        <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-xs font-black shadow-sm border border-amber-200 animate-pulse">
                          <Activity size={14} /> ค้าง {branch.active_count} คิว
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full text-xs font-black border border-slate-200 shadow-sm">
                          ว่าง (ไม่มีคิว)
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                      {branch.name}
                    </h3>
                    <div className="space-y-2 mt-4 text-xs font-bold text-slate-500">
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <MapPin size={14} className="text-rose-400 shrink-0" />
                        <span className="truncate">พิกัด: {branch.lat.toFixed(4)}, {branch.lng.toFixed(4)}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <Clock size={14} className="text-emerald-500 shrink-0" />
                        เวลาตัดยอด (ตี): {branch.cut_off_hour}:00 น.
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-black text-indigo-500 group-hover:text-indigo-600">
                    เข้าสู่กระดานจัดการ
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 group-hover:translate-x-1 transition-all shadow-sm">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 🟢 ฝั่งขวา: ระบบเข้างานไรเดอร์ (HR) กินพื้นที่ 2 ส่วน */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-4xl p-6 shadow-sm border border-slate-100 flex flex-col h-full max-h-[800px]">
            <h2 className="text-lg font-black text-slate-700 flex items-center gap-2 mb-4 shrink-0">
              <Users size={20} className="text-emerald-500" /> ควบคุมไรเดอร์
            </h2>

            {/* ระบบค้นหาและตัวเลือก Bulk */}
            <div className="space-y-3 mb-4 shrink-0">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อไรเดอร์..."
                  value={riderSearch}
                  onChange={(e) => setRiderSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {sortedAndFilteredRiders.length > 0 && (
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors px-2">
                    <CheckSquare size={16} className={isAllSelected ? "text-emerald-500" : "text-slate-400"} />
                    {isAllSelected ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"} ({selectedRiders.length})
                  </button>
                  {selectedRiders.length > 0 && (
                    <div className="flex gap-2">
                      <button onClick={() => handleBulkAction('in')} disabled={isSubmitting} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-[10px] font-black uppercase transition-colors shadow-sm disabled:opacity-50">
                        เข้างาน
                      </button>
                      <button onClick={() => handleBulkAction('out')} disabled={isSubmitting} className="px-3 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg text-[10px] font-black uppercase transition-colors shadow-sm disabled:opacity-50">
                        เลิกงาน
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* List ไรเดอร์ (Scroll ได้) */}
            <div className="space-y-3 overflow-y-auto thin-scrollbar flex-1 pr-1">
              {sortedAndFilteredRiders.length === 0 && !isLoading && (
                <p className="text-center text-slate-400 font-medium py-10">ไม่พบรายชื่อไรเดอร์</p>
              )}
              
              {sortedAndFilteredRiders.map(rider => {
                const att = attendances[rider.id];
                const isActive = att && !att.check_out; 
                const isSelected = selectedRiders.includes(rider.id);
                
                return (
                  <div key={rider.id} className={`flex items-center p-3 sm:p-4 border rounded-2xl transition-all cursor-pointer ${isActive ? 'bg-white border-emerald-200 shadow-sm shadow-emerald-500/5' : 'bg-slate-50 border-slate-100 opacity-80'} ${isSelected ? 'ring-2 ring-emerald-400' : ''}`} onClick={() => toggleRiderSelect(rider.id)}>
                    
                    <div className="shrink-0 mr-3">
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                        <CheckCircle2 size={14} />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-slate-800 text-sm truncate">{rider.username}</h4>
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-bold whitespace-nowrap hidden sm:inline-block">
                          {getBranchName(rider.branch_id)}
                        </span>
                      </div>

                      {isActive ? (
                        <p className="text-[10px] text-emerald-600 font-bold flex items-center">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                          เข้างาน: {new Date(att.check_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute:'2-digit' })} น.
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-bold flex items-center">
                          <span className="w-1.5 h-1.5 bg-slate-300 rounded-full mr-1.5"></span>
                          ยังไม่เข้างาน
                        </p>
                      )}
                    </div>
                    
                    <div className="shrink-0">
                      {isActive ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleSingleAction(rider.id, 'out'); }}
                          disabled={isSubmitting}
                          className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white border border-rose-100 rounded-xl text-xs font-black transition-colors active:scale-95 shadow-sm whitespace-nowrap"
                        >
                          ตอกออก
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleSingleAction(rider.id, 'in'); }}
                          disabled={isSubmitting}
                          className="px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-100 rounded-xl text-xs font-black transition-colors active:scale-95 shadow-sm whitespace-nowrap"
                        >
                          ตอกเข้า
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* 🌟 Modal: ตัดยอด */}
      {isCutoffOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Clock className="text-emerald-500" size={20} /> เวลาตัดยอดจบวัน
              </h3>
              <button onClick={() => setIsCutoffOpen(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer active:scale-95">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateCutoff} className="p-6 space-y-5">
              <div>
                <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wide">จัดการของสาขา</label>
                <select 
                  value={cutoffForm.target}
                  onChange={e => setCutoffForm({...cutoffForm, target: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value="ALL">🌟 ปรับให้ทุกสาขาพร้อมกัน</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-500 mb-1.5 uppercase tracking-wide">ตั้งเวลา (น.)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" min="0" max="23" required
                    value={cutoffForm.hour}
                    onChange={e => setCutoffForm({...cutoffForm, hour: parseInt(e.target.value) || 0})}
                    className="w-24 text-center p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-2xl font-black text-emerald-700 outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-inner"
                  />
                  <span className="text-xl font-black text-slate-500">: 00 น.</span>
                </div>
                <p className="text-[11px] text-slate-400 font-bold mt-2">
                  * ถ้าร้านปิดตี 2 แนะนำให้ตั้งเวลาเป็น 4 (ตี 4) เพื่อเปลี่ยนวันใหม่ในสถิติ
                </p>
              </div>
              <div className="pt-2 flex gap-3">
                <button 
                  type="button" onClick={() => setIsCutoffOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-sm"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all cursor-pointer shadow-lg active:scale-95 disabled:bg-slate-300 text-sm"
                >
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกเวลา"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 Modal: ล้างกระดานออเดอร์ */}
      {isClearBoardOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col p-8 text-center relative">
            <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <MoonStar size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">
              ล้างกระดานออเดอร์
            </h3>
            <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
              เลือกสาขาที่ต้องการปิดยอดจบวัน ออเดอร์ทั้งหมดจะถูกซ่อนจากกระดาน (ดูย้อนหลังได้ในหน้าสถิติ)
            </p>
            
            <form onSubmit={handleClearBoard} className="space-y-6">
              <select 
                value={clearTarget}
                onChange={e => setClearTarget(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all cursor-pointer text-center"
              >
                <option value="ALL">⚠️ ล้างกระดานทุกสาขาพร้อมกัน</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>เฉพาะ {b.name}</option>
                ))}
              </select>

              <div className="flex gap-3">
                <button 
                  type="button" onClick={() => setIsClearBoardOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all cursor-pointer active:scale-95 text-sm"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" disabled={isSubmitting}
                  className="flex-1 py-3.5 text-white font-black rounded-2xl transition-all cursor-pointer shadow-lg active:scale-95 text-sm bg-rose-500 hover:bg-rose-600 shadow-rose-500/30 disabled:bg-slate-300 disabled:shadow-none"
                >
                  {isSubmitting ? "กำลังล้าง..." : "ล้างกระดานเลย!"}
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