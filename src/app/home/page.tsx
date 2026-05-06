"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { 
  Store, MapPin, ChevronRight, Activity, 
  LogOut, Loader2, Clock, ShieldCheck, Package, Menu, X, 
  Settings, MoonStar, AlertTriangle, CheckCircle2, Users, ScanSearch
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

export default function BranchSelectorPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const [isCutoffOpen, setIsCutoffOpen] = useState(false);
  const [isClearBoardOpen, setIsClearBoardOpen] = useState(false);

  const [cutoffForm, setCutoffForm] = useState({ target: "ALL", hour: 4 });
  const [clearTarget, setClearTarget] = useState("ALL");

  const showToast = (message: string, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const fetchBranchesAndStats = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const { data: branchesData, error } = await supabase
      .from("branches")
      .select("*")
      .order("created_at", { ascending: true });

    if (error || !branchesData) {
      console.error("Error fetching branches:", error);
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
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBranchesAndStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-12 flex flex-col items-center pb-20">
      
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl z-[100] ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>
        {toast.type === 'error' ? <AlertTriangle size={18} className="text-rose-400 mr-2" /> : <CheckCircle2 size={18} className="text-emerald-400 mr-2" />}
        <span className="font-bold text-sm tracking-wide">{toast.message}</span>
      </div>

      <div className="w-full max-w-5xl flex justify-between items-center mb-10 bg-white p-5 rounded-4xl shadow-sm border border-slate-100 relative z-20">
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
              
              {/* 🌟 1. เมนูคลังสินค้า */}
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

              {/* 🌟 2. เมนูจัดการสมาชิก (ย้ายมาโฮม) */}
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

              {/* 🌟 3. เมนูจัดการสลิป (ย้ายมาโฮม) */}
              <Link
                href="/slips"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-2xl transition-all font-bold border border-transparent hover:border-emerald-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <ScanSearch size={20} className="text-emerald-600" />
                </div>
                ประวัติการโอนเงิน (สลิป)
              </Link>

              <div className="h-px bg-slate-100 my-2"></div>

              {/* 🌟 4. เมนูตั้งเวลาตัดยอด */}
              <button
                onClick={() => setIsCutoffOpen(true)}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-2xl transition-all font-bold border border-transparent hover:border-blue-100 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Clock size={20} className="text-blue-600" />
                </div>
                ตั้งเวลาตัดยอดร้าน
              </button>

              {/* 🌟 5. เมนูล้างบอร์ด */}
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

              {/* 🌟 6. เมนูตั้งค่า */}
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

      {/* 🌟 Content */}
      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-slate-700 flex items-center gap-2">
            <Store size={20} className="text-indigo-500" /> สาขาทั้งหมดของร้าน ({branches.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-4">
            <Loader2 size={48} className="animate-spin text-indigo-500" />
            <p className="font-bold tracking-widest animate-pulse uppercase">กำลังดึงข้อมูลสาขา...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
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

      {/* 🌟 Modal: ตั้งเวลาตัดยอด */}
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

      {/* 🌟 Modal 3: ล้างกระดานออเดอร์ */}
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