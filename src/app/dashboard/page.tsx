"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/hooks/useDashboard";
import { AllTimeRiders, DASH_BG, DashboardBody, DashboardHeader } from "@/components/dashboard/DashboardUI";

interface Branch {
  id: string;
  name: string;
}

export default function GlobalDashboardPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("all");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      if (profile?.role !== "admin" && profile?.role !== "superadmin") return router.push("/rider");
      const { data } = await supabase.from("branches").select("id, name").order("name");
      setBranches(data ?? []);
      setAuthed(true);
    };
    void check();
  }, [router]);

  const branchId = branchFilter === "all" ? null : branchFilter;
  const dash = useDashboard({ branchId, enabled: authed });
  const branchName = branches.find((b) => b.id === branchId)?.name;

  return (
    <div className={DASH_BG}>
      <DashboardHeader
        title="สถิติร้าน"
        subtitle={branchName ? `เฉพาะ ${branchName}` : "ทุกสาขารวมกัน"}
        onBack={() => router.back()}
        dash={dash}
      >
        <label className="hidden sm:flex items-center gap-1.5 rounded-xl bg-slate-100 pl-3 pr-1 py-1">
          <Store size={14} className="text-slate-500" />
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer py-1.5"
          >
            <option value="all">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </DashboardHeader>

      {/* มือถือ: ตัวเลือกสาขาอยู่ใต้หัว */}
      <div className="sm:hidden px-4 pt-4">
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none"
        >
          <option value="all">ทุกสาขารวมกัน</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <DashboardBody dash={dash} extra={authed ? <AllTimeRiders branchId={branchId} /> : null} />
    </div>
  );
}
