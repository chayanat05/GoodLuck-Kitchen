"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useDashboard } from "@/hooks/useDashboard";
import { DASH_BG, DashboardBody, DashboardHeader } from "@/components/dashboard/DashboardUI";

export default function BranchDashboardPage({ params }: { params: Promise<{ board_home: string }> }) {
  const { board_home: branchSlug } = use(params);
  const router = useRouter();
  const [branch, setBranch] = useState<{ id: string; name: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      if (profile?.role !== "admin" && profile?.role !== "superadmin") return router.push("/rider");
      const { data } = await supabase.from("branches").select("id, name").eq("slug", branchSlug).maybeSingle();
      if (data) setBranch(data);
      else setNotFound(true);
    };
    void check();
  }, [branchSlug, router]);

  const dash = useDashboard({ branchId: branch?.id ?? null, enabled: !!branch });

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-500">
        <p className="font-bold">ไม่พบสาขา “{branchSlug}”</p>
        <button type="button" onClick={() => router.push("/home")} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white cursor-pointer">
          กลับหน้าแรก
        </button>
      </div>
    );
  }

  return (
    <div className={DASH_BG}>
      <DashboardHeader
        title={branch ? `สถิติ ${branch.name}` : "สถิติสาขา"}
        subtitle="แดชบอร์ดสาขา"
        onBack={() => router.push(`/board/${branchSlug}`)}
        dash={dash}
      />
      <DashboardBody dash={dash} />
    </div>
  );
}
