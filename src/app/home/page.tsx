"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Store, MapPin, ChevronRight, Activity, 
  LogOut, Loader2, Clock, ShieldCheck, Package, Menu, X, 
  Settings, AlertTriangle, CheckCircle2, Users, ScanSearch,
  Search, CheckSquare, Banknote, LayoutDashboard, Landmark,PieChart,
  ImagePlus,
  Utensils,
  Calendar,
  UserSquare2,
  History
} from "lucide-react";
import SharedGallery from "@/components/SharedGallery";

interface Branch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cut_off_hour: number;
  active_count: number;
  slug: string;
}

interface EmployeeProfile {
  id: string;
  username: string;
  branch_id: string | null; 
  role: string; 
}

interface Attendance {
  id: string;
  rider_id: string;
  check_in: string;
  check_out: string | null;
}

export default function BranchSelectorPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const [businessDayStart, setBusinessDayStart] = useState<string>("07:00");
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const [adminName, setAdminName] = useState<string>("กำลังโหลด...");
  const [currentUserRole, setCurrentUserRole] = useState<string>("admin");
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);


  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); 
    return () => clearInterval(timer);
  }, []);

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

    // 🌟 ล็อกประตู! อนุญาตให้ admin และ superadmin เข้าหน้า Home ได้
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
      
    if (profile?.role !== "admin" && profile?.role !== "superadmin") { 
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

    const { data: ordersData } = await supabase
      .from("orders")
      .select("branch_id, is_deleted")
      .in("status", ["ออเดอร์ใหม่", "กำลังทำ", "รับงาน"])
      .or("is_archived.is.null,is_archived.eq.false");

    const activeOrders = ordersData?.filter(o => o.is_deleted !== true) || [];

    const branchList = branchesData.map(branch => {
      const count = activeOrders.filter(o => o.branch_id === branch.id).length || 0;
      return { ...branch, active_count: count };
    });

    setBranches(branchList);

    const { data: employeeData } = await supabase
      .from("profiles")
      .select("id, username, branch_id, role");
    
    if (employeeData) setEmployees(employeeData);

    const { data: settings } = await supabase.from('store_settings').select('business_day_start').eq('id', 1).single();
    let bizStartStr = "07:00";
    if (settings && settings.business_day_start) {
      setBusinessDayStart(settings.business_day_start);
      bizStartStr = settings.business_day_start;
    }

    const now = new Date();
    const [bizHour, bizMin] = bizStartStr.split(':').map(Number);
    const currentBizDate = new Date(now);
    if (now.getHours() < bizHour || (now.getHours() === bizHour && now.getMinutes() < bizMin)) {
      currentBizDate.setDate(currentBizDate.getDate() - 1);
    }
    const startDate = new Date(currentBizDate.getFullYear(), currentBizDate.getMonth(), currentBizDate.getDate(), bizHour, bizMin, 0, 0);
    const isoStart = startDate.toISOString();

    const { data: attendanceData } = await supabase
      .from("rider_attendance")
      .select("*")
      .or(`check_out.is.null,check_in.gte.${isoStart}`)
      .order("check_in", { ascending: true });

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

  const handleSingleAction = async (employeeId: string, type: 'in' | 'out') => {
    setIsSubmitting(true);
    try {
      if (type === 'in') {
        const { data, error } = await supabase
          .from("rider_attendance")
          .insert([{ rider_id: employeeId }])
          .select()
          .single();
        if (error) throw error;
        setAttendances(prev => ({ ...prev, [employeeId]: data }));
        showToast("เข้างานสำเร็จ! 🟢");
      } else {
        const att = attendances[employeeId];
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
        setAttendances(prev => ({ ...prev, [employeeId]: data }));
        showToast("ออกงานสำเร็จ! 🔴");
      }
    } catch (error) {
      console.error(error);
      showToast("เกิดข้อผิดพลาด", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkAction = async (type: 'in' | 'out') => {
    if (selectedEmployees.length === 0) return;
    const isConfirmed = window.confirm(`ยืนยันการ${type === 'in' ? 'เข้า' : 'ออก'}งาน ${selectedEmployees.length} คนพร้อมกัน?`);
    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      const promises = selectedEmployees.map(async (id) => {
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
      setSelectedEmployees([]);
      showToast(`ทำรายการ ${selectedEmployees.length} รายการสำเร็จ!`);
    } catch (error) {
      console.error(error);
      showToast("เกิดข้อผิดพลาดบางรายการ", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleEmployeeSelect = (id: string) => {
    setSelectedEmployees(prev => prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]);
  };

  const sortedAndFilteredEmployees = useMemo(() => {
    let result = employees;
    if (searchQuery.trim() !== "") {
      result = result.filter(e => e.username.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return result.sort((a, b) => {
      const isAActive = attendances[a.id] && !attendances[a.id].check_out ? 1 : 0;
      const isBActive = attendances[b.id] && !attendances[b.id].check_out ? 1 : 0;
      if (isAActive !== isBActive) return isBActive - isAActive; 
      
      if (a.role !== b.role) {
        if (a.role === 'admin' || a.role === 'superadmin') return -1;
        if (b.role === 'admin' || b.role === 'superadmin') return 1;
        return a.role === 'rider' ? -1 : 1;
      }

      return a.username.localeCompare(b.username); 
    });
  }, [employees, attendances, searchQuery]);

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return "ไม่ระบุสาขา";
    const b = branches.find(x => x.id === branchId);
    return b ? b.name : "ไม่ระบุสาขา";
  };

  const isAllSelected = sortedAndFilteredEmployees.length > 0 && selectedEmployees.length === sortedAndFilteredEmployees.length;
  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedEmployees([]);
    else setSelectedEmployees(sortedAndFilteredEmployees.map(e => e.id));
  };

  const selectByRole = (role: string) => {
    const roleIds = sortedAndFilteredEmployees.filter(e => e.role === role).map(e => e.id);
    if (roleIds.length === 0) return;
    
    const allRoleSelected = roleIds.every(id => selectedEmployees.includes(id));
    if (allRoleSelected) {
      setSelectedEmployees(prev => prev.filter(id => !roleIds.includes(id)));
    } else {
      const newSelection = new Set([...selectedEmployees, ...roleIds]);
      setSelectedEmployees(Array.from(newSelection));
    }
  };
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, role")
          .eq("id", session.user.id)
          .single();
        
        if (profile) {
          setAdminName(profile.username || "แอดมิน");
          // 🌟 แก้ไข: ไม่ต้องใส่ || "superadmin" ให้ใช้ค่า role ตรงๆ เลย
          setCurrentUserRole(profile.role || "admin");
        }
      }
    };
    fetchUserProfile();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-12 flex flex-col items-center pb-20">
      
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl z-150 ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>
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
              
              <Link
  href="/schedule"
  prefetch={false}
  className="w-full flex items-center p-4 text-slate-600 hover:bg-teal-50 hover:text-teal-700 rounded-2xl transition-all font-bold border border-transparent hover:border-teal-100 group"
>
  <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
    <Calendar size={20} className="text-teal-600" />
  </div>
  ตารางงาน (Schedule)
</Link>

              <Link
                href="/payroll"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-2xl transition-all font-bold border border-transparent hover:border-emerald-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Banknote size={20} className="text-emerald-600" />
                </div>
                จ่ายเงินพนักงาน (รายวัน)
              </Link>

              <Link
                href="/monthly-payroll"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-2xl transition-all font-bold border border-transparent hover:border-indigo-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Landmark size={20} className="text-indigo-600" />
                </div>
                สรุปเงินเดือน (รายเดือน)
              </Link>
              
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

              <button 
    onClick={() => { setIsMenuOpen(false); setIsGalleryOpen(true); }}
      className="w-full flex items-center p-4 text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-2xl transition-all font-bold border border-transparent hover:border-blue-100 group"  >
    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
      <ImagePlus size={16} className="text-indigo-600" />
    </div>
    คลังรูปภาพส่วนกลาง
    </button>
  
              <div className="h-px bg-slate-100 my-2"></div>

              <Link
                href="/users"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-2xl transition-all font-bold border border-transparent hover:border-indigo-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Users size={20} className="text-indigo-600" />
                </div>
                จัดการพนักงาน / สาขา
              </Link>

              <Link 
            href="/dorms"
            className="flex items-center gap-6 p-4 w-full text-left rounded-xl hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-colors font-bold group"
            >
            <div className="w-8 h-8 bg-slate-100 group-hover:bg-indigo-100 rounded-lg flex items-center justify-center transition-colors">
              <MapPin size={20} className="text-slate-500 group-hover:text-indigo-600" />
            </div>
            <div>
            <div className="text-l font-black">ฐานข้อมูลหอพัก</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Dormitory Bank</div>
            </div>
            </Link>

            <div className="h-px bg-slate-100 my-2"></div>
<Link
  href="/admin/applications"
  prefetch={false}
  className="w-full flex items-center p-4 text-slate-600 hover:bg-violet-50 hover:text-violet-700 rounded-2xl transition-all font-bold border border-transparent hover:border-violet-100 group"
>
  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
    <UserSquare2 size={20} className="text-violet-600" />
  </div>
  ดูใบสมัครพนักงาน 
</Link>

            <Link
                    href="/menus"
                    prefetch={false}
                    className="w-full flex items-center p-4 text-slate-600 hover:bg-pink-50 hover:text-pink-700 rounded-2xl transition-all font-bold border border-transparent hover:border-pink-100 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                      <Utensils size={20} className="text-pink-600" />
                    </div>
                    จัดการเมนูและราคา
                  </Link>
                  <div className="h-px bg-slate-100 my-2"></div>
                  
            <div className="h-px bg-slate-100 my-2"></div>

              <Link
                href="/accounting"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-2xl transition-all font-bold border border-transparent hover:border-emerald-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <PieChart size={20} className="text-emerald-600" />
                </div>
                ระบบบัญชีร้าน (Accounting)
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

              <Link
                href="/history"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-2xl transition-all font-bold border border-transparent hover:border-indigo-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <History size={20} className="text-indigo-600" />
                </div>
                ประวัติงาน (ออเดอร์ย้อนหลัง)
              </Link>

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

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-slate-700 flex items-center gap-2">
              <Store size={20} className="text-indigo-500" /> 
              สาขาทั้งหมดของร้าน ({branches.length})
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
                        เวลาตัดยอด (เริ่มวันใหม่): {businessDayStart} น.
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

        {/* 🟢 ฝั่งขวา: ระบบลงเวลาพนักงาน (HR) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-4xl p-6 shadow-sm border border-slate-100 flex flex-col h-full max-h-200">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-black text-slate-700 flex items-center gap-2">
                <Users size={20} className="text-emerald-500" /> ควบคุมเวลาเข้างาน (HR)
              </h2>
              <Link
                href="/rider"
                prefetch={false}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl transition-colors active:scale-95 text-xs border border-blue-100 shadow-sm"
              >
                <MapPin size={16} />
                <span>หน้ารับงาน (Rider)</span>
              </Link>
            </div>

            <div className="space-y-3 mb-4 shrink-0">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อพนักงาน..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {sortedAndFilteredEmployees.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors px-2">
                      <CheckSquare size={16} className={isAllSelected ? "text-emerald-500" : "text-slate-400"} />
                      {isAllSelected ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"} ({selectedEmployees.length})
                    </button>
                    
                    <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block"></div>
                    
                    {/* 🌟 ปุ่มเลือกแยกตำแหน่ง */}
                    <div className="flex items-center gap-1.5 border-l border-slate-200 sm:border-none pl-3 sm:pl-0 ml-1 sm:ml-0">
                      <span className="text-[9px] font-bold text-slate-400 mr-1 hidden sm:inline-block">เลือกด่วน:</span>
                      <button onClick={() => selectByRole('admin')} className="text-[10px] font-black px-2 py-1 rounded-md border bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100 transition-colors active:scale-95">👑 แอดมิน</button>
                      <button onClick={() => selectByRole('kitchen')} className="text-[10px] font-black px-2 py-1 rounded-md border bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100 transition-colors active:scale-95">🍳 ครัว</button>
                      <button onClick={() => selectByRole('rider')} className="text-[10px] font-black px-2 py-1 rounded-md border bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 transition-colors active:scale-95">🛵 ไรเดอร์</button>
                    </div>
                  </div>

                  {selectedEmployees.length > 0 && (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => handleBulkAction('in')} disabled={isSubmitting} className="flex-1 sm:flex-none px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-[10px] font-black uppercase transition-colors shadow-sm disabled:opacity-50">
                        เข้างาน
                      </button>
                      <button onClick={() => handleBulkAction('out')} disabled={isSubmitting} className="flex-1 sm:flex-none px-4 py-2 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg text-[10px] font-black uppercase transition-colors shadow-sm disabled:opacity-50">
                        เลิกงาน
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-3 overflow-y-auto thin-scrollbar flex-1 pr-1">
              {sortedAndFilteredEmployees.length === 0 && !isLoading && (
                <p className="text-center text-slate-400 font-medium py-10">ไม่พบรายชื่อพนักงาน</p>
              )}
              
              {sortedAndFilteredEmployees.map(employee => {
                const att = attendances[employee.id];
                const isActive = att && !att.check_out; 
                const isSelected = selectedEmployees.includes(employee.id);
                
                let displayMinutes = 0;
                if (isActive) {
                  const checkInTime = new Date(att.check_in).getTime();
                  displayMinutes = Math.floor((currentTime.getTime() - checkInTime) / 60000);
                }
                
                return (
                  <div key={employee.id} className={`flex items-center p-3 sm:p-4 border rounded-2xl transition-all cursor-pointer ${isActive ? 'bg-white border-emerald-200 shadow-sm shadow-emerald-500/5' : 'bg-slate-50 border-slate-100 opacity-80'} ${isSelected ? 'ring-2 ring-emerald-400' : ''}`} onClick={() => toggleEmployeeSelect(employee.id)}>
                    
                    <div className="shrink-0 mr-3">
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                        <CheckCircle2 size={14} />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-slate-800 text-sm truncate">{employee.username}</h4>
                        {/* 🌟 ปรับเงื่อนไขป้ายกำกับให้ครอบคลุม superadmin ด้วย */}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap hidden sm:inline-block border ${
                          (employee.role === 'admin' || employee.role === 'superadmin') ? 'bg-purple-50 text-purple-600 border-purple-100' :
                          employee.role === 'kitchen' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                          'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                          {(employee.role === 'admin' || employee.role === 'superadmin') ? '🌟 แอดมิน' : employee.role === 'kitchen' ? '🍳 ครัว' : '🛵 ไรเดอร์'}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-bold whitespace-nowrap hidden sm:inline-block border border-slate-200">
                          {getBranchName(employee.branch_id)}
                        </span>
                      </div>

                      {isActive ? (
                        <div className="flex flex-col gap-0.5 mt-1">
                          <p className="text-[10px] text-emerald-600 font-bold flex items-center">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                            เข้างาน: {new Date(att.check_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute:'2-digit' })} น.
                          </p>
                          <p className="text-[10px] text-blue-600 font-bold flex items-center ml-3">
                            <Clock size={10} className="mr-1" />
                            เวลาทำ: {displayMinutes >= 60 ? `${Math.floor(displayMinutes / 60)} ชม. ${displayMinutes % 60} นาที` : `${displayMinutes} นาที`}
                          </p>
                        </div>
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
                          onClick={(e) => { e.stopPropagation(); handleSingleAction(employee.id, 'out'); }}
                          disabled={isSubmitting}
                          className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white border border-rose-100 rounded-xl text-xs font-black transition-colors active:scale-95 shadow-sm whitespace-nowrap"
                        >
                          ออกงาน
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleSingleAction(employee.id, 'in'); }}
                          disabled={isSubmitting}
                          className="px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-100 rounded-xl text-xs font-black transition-colors active:scale-95 shadow-sm whitespace-nowrap"
                        >
                          เข้างาน
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
              
      <style jsx global>{`
        .thin-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .thin-scrollbar::-webkit-scrollbar-thumb { background: rgba(203, 213, 225, 1); border-radius: 10px; }
        .thin-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 1); }
      `}</style>

      {isGalleryOpen && (
    <SharedGallery 
      userName={adminName}  // 🌟 ใช้ชื่อที่ดึงมาจากฐานข้อมูลจริง
      userRole={currentUserRole} 
      onClose={() => setIsGalleryOpen(false)} 
    />
  )}

    </div>
  );
}