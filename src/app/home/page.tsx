"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { 
  Store, MapPin, ChevronRight, Activity, 
  LogOut, Loader2, Clock, ShieldCheck
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

  useEffect(() => {
    const fetchBranchesAndStats = async () => {
      // 1. เช็ค Auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/Home");
        return;
      }

      // 2. ดึงข้อมูลสาขาทั้งหมด
      const { data: branchesData, error } = await supabase
        .from("branches")
        .select("*")
        .order("created_at", { ascending: true });

      if (error || !branchesData) {
        console.error("Error fetching branches:", error);
        setIsLoading(false);
        return;
      }

      // 3. ดึงจำนวนออเดอร์ที่กำลัง "ค้างอยู่" ของทุกสาขา
      const { data: activeOrders } = await supabase
        .from("orders")
        .select("branch_id")
        .in("status", ["New", "กำลังทำ", "รับงาน"]);

      // 4. นำข้อมูลมานับรวมกัน
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
    router.push("/Login");
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-12 flex flex-col items-center">
      
      {/* 🌟 Header */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-10 bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-inner">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">ระบบจัดการสาขา</h1>
            <p className="text-xs md:text-sm text-slate-500 font-bold">เลือกสาขาที่ต้องการเข้าสู่กระดาน (Board)</p>
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
                href={`/Home/${branch.id}`} 
                key={branch.id}
                className="bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-xl border border-slate-100 hover:border-indigo-200 transition-all duration-300 group cursor-pointer relative overflow-hidden block"
              >
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 opacity-50 transition-transform group-hover:scale-110"></div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Store size={28} />
                    </div>
                    
                    {/* Badge คิวงาน */}
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

                {/* แถบกดเข้าบอร์ด */}
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