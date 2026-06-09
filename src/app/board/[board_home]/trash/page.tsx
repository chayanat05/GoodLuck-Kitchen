"use client";
import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Trash2, RefreshCcw, AlertTriangle, ChevronLeft, Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";

interface DeletedOrder {
  id: string;
  order_number: string;
  job_type: string;
  total_price: number;
  deleted_at: string;
  branch_id: string;
}

export default function TrashPage({ params }: { params: Promise<{ board_home: string }> }) {
  const resolvedParams = use(params);
  const branchSlug = resolvedParams.board_home;
  const router = useRouter();
  
  const [deletedOrders, setDeletedOrders] = useState<DeletedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentBranchId, setCurrentBranchId] = useState<string>("");
  const [adminName, setAdminName] = useState<string>("");

  const fetchDeletedOrders = async (branchId: string) => {
    setIsLoading(true);

    // 🌟 1. ระบบ Auto-Cleanup: ลบออเดอร์ที่ลบไปเกิน 7 วันทิ้งแบบถาวร
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // สั่งลบข้อมูลที่ is_deleted = true และเวลาลบน้อยกว่า (เก่ากว่า) 7 วันที่แล้ว
    await supabase
      .from("orders")
      .delete()
      .eq("branch_id", branchId)
      .eq("is_deleted", true)
      .lt("deleted_at", sevenDaysAgo.toISOString());

    // 🌟 2. ดึงข้อมูลถังขยะที่ยังไม่หมดอายุมาแสดงผลตามปกติ
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, job_type, total_price, deleted_at, branch_id")
      .eq("branch_id", branchId)
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });

    if (!error && data) setDeletedOrders(data as DeletedOrder[]);
    setIsLoading(false);
  };

  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");

      const { data: profile } = await supabase.from("profiles").select("role, username").eq("id", session.user.id).single();
      if (profile?.role !== "admin" && profile?.role !== "superadmin") return router.push("/rider");
      setAdminName(profile.username || "แอดมิน");

      const { data: branchData } = await supabase.from("branches").select("id").eq("slug", branchSlug).single();
      if (branchData) {
        setCurrentBranchId(branchData.id);
        fetchDeletedOrders(branchData.id);
      }
    };
    initPage();
  }, [branchSlug, router]);

  const handleRestore = async (id: string, orderNum: string) => {
    const { error } = await supabase.from("orders").update({ is_deleted: false, deleted_at: null }).eq("branch_id", currentBranchId).eq("id", id);
    if (!error) {
      await supabase.from("activity_logs").insert([{
        branch_id: currentBranchId, user_name: adminName, action: "RESTORE_ORDER", details: `กู้คืนออเดอร์ #${orderNum} จากถังขยะ`
      }]);
      toast.success(`กู้คืนออเดอร์ #${orderNum} สำเร็จ!`);
      setDeletedOrders(prev => prev.filter(o => o.id !== id));
    } else {
      toast.error(`เกิดข้อผิดพลาดในการกู้คืน: ${error.message}`);
    }
  };

  const handleForceDelete = async (id: string, orderNum: string) => {
    Swal.fire({
      title: "ลบทิ้งถาวร?", text: "การกระทำนี้ไม่สามารถย้อนกลับได้ ข้อมูลจะหายไปตลอดกาล!", icon: "error",
      showCancelButton: true, confirmButtonColor: "#ef4444", cancelButtonColor: "#cbd5e1", confirmButtonText: "ลบถาวร", cancelButtonText: "ยกเลิก"
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { error } = await supabase.from("orders").delete().eq("branch_id", currentBranchId).eq("id", id);
        if (!error) {
          await supabase.from("activity_logs").insert([{
            branch_id: currentBranchId, user_name: adminName, action: "FORCE_DELETE", details: `ลบออเดอร์ #${orderNum} ทิ้งแบบถาวร`
          }]);
          toast.success("ลบข้อมูลถาวรเรียบร้อย");
          setDeletedOrders(prev => prev.filter(o => o.id !== id));
        } else {
          toast.error(`เกิดข้อผิดพลาดในการลบถาวร: ${error.message}`);
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-3 bg-white shadow-sm border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"><ChevronLeft size={20}/></button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Trash2 className="text-rose-500"/> ถังขยะ (Recycle Bin)</h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">ออเดอร์ที่ถูกลบไปแล้ว สามารถกู้คืนได้ที่นี่</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-20 text-center text-slate-400 font-bold">กำลังโหลดข้อมูล...</div>
          ) : deletedOrders.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center text-slate-400">
              <CheckCircle2 size={48} className="mb-4 text-emerald-400 opacity-50"/>
              <p className="font-black text-lg">ถังขยะว่างเปล่า</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase font-black text-slate-500 tracking-wider">
                <tr><th className="p-5">เลขออเดอร์</th><th className="p-5">ประเภท</th><th className="p-5">เวลาที่ลบ</th><th className="p-5 text-right">จัดการ</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-sm">
                {deletedOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-5 text-slate-800">{order.order_number}</td>
                    <td className="p-5"><span className="px-2 py-1 bg-slate-100 rounded-md text-xs">{order.job_type}</span></td>
                    <td className="p-5 text-slate-500">{new Date(order.deleted_at).toLocaleString('th-TH')}</td>
                    <td className="p-5 flex justify-end gap-2">
                      <button onClick={() => handleRestore(order.id, order.order_number)} className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl transition-all flex items-center gap-2"><RefreshCcw size={14}/> กู้คืน</button>
                      <button onClick={() => handleForceDelete(order.id, order.order_number)} className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex items-center gap-2"><AlertTriangle size={14}/> ลบถาวร</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}