"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { 
  Store, MapPin, ChevronRight, Activity, 
  LogOut, Loader2, Clock, ShieldCheck,Package,Menu,X,Settings,
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cut_off_hour: number;
  active_count: number;
}

export default function BranchSelectorPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const fetchBranchesAndStats = async () => {
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

    fetchBranchesAndStats();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-12 flex flex-col items-center">
      
      {/* 🌟 Header */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-10 bg-white p-5 rounded-4xl shadow-sm border border-slate-100 relative z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 bg-slate-100 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer text-slate-600 hover:text-indigo-700 active:scale-95"
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
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-black rounded-xl transition-colors active:scale-95 text-sm border border-rose-100"
        >
          <LogOut size={18} />
          <span className="hidden md:inline">ออกจากระบบ</span>
        </button>
      </div>

      {/* 🌟 Sidebar Menu (แฮมเบอร์เกอร์หน้าโฮม) */}
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
            
            <div className="flex-1 p-5 space-y-3 overflow-y-auto">
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

              {/* ปล่อยเบลอไว้ก่อน สำหรับฟีเจอร์ในอนาคต */}
              <button
                className="w-full flex items-center p-4 text-slate-400 bg-slate-50 rounded-2xl transition-all font-bold border border-slate-100 cursor-not-allowed opacity-70"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center mr-4">
                  <Settings size={20} className="text-slate-500" />
                </div>
                ตั้งค่าระบบรวม (เร็วๆ นี้)
              </button>
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
        <h2 className="text-lg font-black text-slate-700 mb-6 flex items-center gap-2">
          <Store size={20} className="text-indigo-500" /> สาขาทั้งหมดของร้าน ({branches.length})
        </h2>

        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-4">
            <Loader2 size={48} className="animate-spin text-indigo-500" />
            <p className="font-bold tracking-widest animate-pulse uppercase">กำลังดึงข้อมูลสาขา...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
            {branches.map((branch) => (
              <Link 
                href={`/board/${branch.id}`}
                prefetch={false}
                key={branch.id}
                className="bg-white rounded-4xl p-6 shadow-sm hover:shadow-xl border border-slate-100 hover:border-indigo-200 transition-all duration-300 group cursor-pointer relative overflow-hidden block"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 opacity-50 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Store size={28} />
                    </div>
                    {branch.active_count > 0 ? (
                      <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-xs font-black shadow-sm border border-amber-200 animate-pulse">
                        <Activity size={14} /> ค้าง {branch.active_count} คิว
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full text-xs font-black border border-slate-200">
                        ว่าง (ไม่มีคิว)
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                    {branch.name}
                  </h3>
                  <div className="space-y-2 mt-4 text-xs font-bold text-slate-500">
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <MapPin size={14} className="text-rose-400" />
                      พิกัด: {branch.lat.toFixed(4)}, {branch.lng.toFixed(4)}
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <Clock size={14} className="text-blue-400" />
                      เวลาตัดยอด (ตี): {branch.cut_off_hour}:00 น.
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-black text-indigo-500 group-hover:text-indigo-600">
                  เข้าสู่กระดานจัดการ
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 group-hover:translate-x-1 transition-all">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}