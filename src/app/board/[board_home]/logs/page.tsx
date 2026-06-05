"use client";
import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ClipboardList, ChevronLeft, Search } from "lucide-react";

interface ActivityLog {
  id: string;
  created_at: string;
  user_name: string;
  action: string;
  details: string;
}

export default function LogsPage({ params }: { params: Promise<{ board_home: string }> }) {
  const resolvedParams = use(params);
  const branchSlug = resolvedParams.board_home;
  const router = useRouter();
  
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      const { data: branchData } = await supabase.from("branches").select("id").eq("slug", branchSlug).single();
      if (!branchData) return;

      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("branch_id", branchData.id)
        .order("created_at", { ascending: false })
        .limit(100); // โชว์ 100 รายการล่าสุด

      if (!error && data) setLogs(data as ActivityLog[]);
      setIsLoading(false);
    };

    fetchLogs();
  }, [branchSlug]);

  const filteredLogs = logs.filter(log => 
    log.user_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    log.details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActionColor = (action: string) => {
    if (action.includes("DELETE")) return "text-rose-500 bg-rose-50 border-rose-200";
    if (action.includes("RESTORE")) return "text-emerald-500 bg-emerald-50 border-emerald-200";
    if (action.includes("CREATE")) return "text-blue-500 bg-blue-50 border-blue-200";
    return "text-slate-500 bg-slate-50 border-slate-200";
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4 w-full">
            <button onClick={() => router.back()} className="p-3 bg-white shadow-sm border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"><ChevronLeft size={20}/></button>
            <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2"><ClipboardList className="text-indigo-500"/> ประวัติการใช้งาน (System Logs)</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">ตรวจสอบการเปลี่ยนแปลงและการลบข้อมูล (100 รายการล่าสุด)</p>
            </div>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
            <input 
              type="text" placeholder="ค้นหาชื่อแอดมิน, เลขออเดอร์..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-sm"
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-2 overflow-hidden">
          {isLoading ? (
            <div className="p-20 text-center text-slate-400 font-bold">กำลังโหลดข้อมูล...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-20 text-center text-slate-400 font-bold">ไม่พบประวัติการใช้งาน</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLogs.map(log => (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800">{log.details}</span>
                    <span className="text-xs font-medium text-slate-500 mt-1">ดำเนินการโดย: <span className="font-bold text-indigo-600">{log.user_name}</span></span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-xs text-slate-400 font-bold bg-slate-100 px-2.5 py-1 rounded-lg">
                      {new Date(log.created_at).toLocaleString('th-TH')}
                    </span>
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