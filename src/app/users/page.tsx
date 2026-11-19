"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase"; 
import { 
  ChevronLeft, Users, Search, ShieldCheck, Navigation, 
  Mail, Calendar, CheckCircle2, X, AlertTriangle, Info, UserCheck, Store, Ban, Power, Loader2, Trash2
} from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  branch_id: string | null; // null = เห็นงานทุกสาขา (ทุกสาขาอยู่ที่เดียวกัน)
  is_approved: boolean | null; // false = ปิดการใช้งาน (เข้าแอปไม่ได้)
  last_seen: string | null;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
}

type StatusFilter = "all" | "active" | "inactive";

const ROLE_STYLE: Record<string, { label: string; chip: string; avatar: string; bar: string }> = {
  superadmin: { label: "👑 ซุปเปอร์แอดมิน", chip: "bg-amber-50 text-amber-800 border-amber-200", avatar: "bg-amber-100 text-amber-700", bar: "bg-amber-400" },
  admin: { label: "🌟 แอดมิน", chip: "bg-indigo-50 text-indigo-700 border-indigo-200", avatar: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500" },
  kitchen: { label: "🍳 ครัว", chip: "bg-orange-50 text-orange-700 border-orange-200", avatar: "bg-orange-100 text-orange-700", bar: "bg-orange-400" },
  rider: { label: "🛵 ไรเดอร์", chip: "bg-sky-50 text-sky-700 border-sky-200", avatar: "bg-sky-100 text-sky-700", bar: "bg-sky-500" },
};
const roleStyle = (role: string) => ROLE_STYLE[role] || ROLE_STYLE.rider;

const normalizeName = (name: string | null | undefined) => (name || "").trim().toLowerCase();

// superadmin เข้าระบบได้เสมอ จึงไม่นับว่าเป็น "รออนุมัติ / ปิดใช้งาน"
const isInactive = (p: { is_approved: boolean | null; role: string }) =>
  p.is_approved === false && p.role !== "superadmin";

type PopupConfig = {
  isOpen: boolean;
  type: "alert" | "confirm";
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  icon?: "success" | "error" | "warning" | "info";
};

export default function UsersManagementPage() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("rider");
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const router = useRouter();

  const [popup, setPopup] = useState<PopupConfig>({ isOpen: false, type: "alert", title: "", message: "" });
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 2500);
  }, []);

  const showAlert = useCallback((title: string, message: string, icon: "success" | "error" | "warning" | "info" = "info") => {
    setPopup({ isOpen: true, type: "alert", title, message, icon });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmText = "ยืนยัน", cancelText = "ยกเลิก") => {
    setPopup({ isOpen: true, type: "confirm", title, message, onConfirm, confirmText, cancelText, icon: "warning" });
  }, []);

  const closePopup = useCallback(() => setPopup(prev => ({ ...prev, isOpen: false })), []);

  const fetchProfilesAndBranches = useCallback(async () => {
    setLoading(true);

    const { data: bData } = await supabase.from("branches").select("id, name").order("created_at", { ascending: true });
    if (bData) setBranches(bData);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, email, role, branch_id, is_approved, last_seen, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      showAlert("เกิดข้อผิดพลาด", "ไม่สามารถดึงข้อมูลสมาชิกได้", "error");
    } else if (data) {
      setProfiles(data as UserProfile[]);
    }
    setLoading(false);
  }, [showAlert]);

  useEffect(() => {
    const checkAdminAndFetchUsers = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      // 🌟 แก้ไข: อนุญาตให้ทั้ง admin และ superadmin เข้าหน้านี้ได้
      if (adminProfile?.role !== "admin" && adminProfile?.role !== "superadmin") {
        window.location.href = "/rider";
        return;
      }

      setCurrentUser(session.user);
      if (adminProfile) {
        setCurrentUserRole(adminProfile.role);
      }
      fetchProfilesAndBranches();
    };

    checkAdminAndFetchUsers();
  }, [fetchProfilesAndBranches]);

  const handleRoleChange = async (userId: string, newRole: string, username: string) => {
    if (userId === currentUser?.id) {
      showAlert("ผิดพลาด", "คุณไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้ครับ!", "warning");
      return;
    }

    // 🌟 แก้ไข: เพิ่มเงื่อนไขให้ครอบคลุมทุก Role
    let roleNameTh = "ไรเดอร์ (Rider)";
    if (newRole === "admin") roleNameTh = "แอดมิน (Admin)";
    if (newRole === "kitchen") roleNameTh = "แม่ครัว (Kitchen)";
    if (newRole === "superadmin") roleNameTh = "ซุปเปอร์แอดมิน (Superadmin)";

    showConfirm(
      "ยืนยันการเปลี่ยนสิทธิ์?",
      `คุณต้องการเปลี่ยนสิทธิ์ของ ${username} ให้เป็น "${roleNameTh}" ใช่หรือไม่?`,
      async () => {
        closePopup();
        const { error } = await supabase
          .from("profiles")
          .update({ role: newRole })
          .eq("id", userId);

        if (error) {
          showToast("เปลี่ยนสิทธิ์ไม่สำเร็จ: " + error.message, "error");
        } else {
          showToast(`เปลี่ยน ${username} เป็น ${roleNameTh} แล้ว`);
          setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
        }
      },
      "ยืนยันการเปลี่ยน",
      "ยกเลิก"
    );
  };

  const updateProfile = async (profile: UserProfile, changes: Partial<Pick<UserProfile, "branch_id" | "is_approved">>, successMsg: string) => {
    setSavingId(profile.id);
    const { error } = await supabase.from("profiles").update(changes).eq("id", profile.id);
    setSavingId(null);

    if (error) {
      showToast("บันทึกไม่สำเร็จ: " + error.message, "error");
      return;
    }
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, ...changes } : p));
    showToast(successMsg);
  };

  // ค่าใน dropdown: ALL = เห็นทุกสาขา, <branch id> = เห็นเฉพาะสาขา (ตรงกับหน้าตั้งค่าระบบ)
  const handleBranchChange = (profile: UserProfile, value: string) => {
    const newBranchId = value === "ALL" ? null : value;
    const branchName = branches.find(b => b.id === newBranchId)?.name;
    updateProfile(
      profile,
      { branch_id: newBranchId },
      branchName ? `${profile.username} เห็นเฉพาะสาขา ${branchName}` : `${profile.username} เห็นงานทุกสาขา`
    );
  };

  // ปิด/เปิดการใช้งาน แทนการลบ เพื่อให้ประวัติงานและเงินเดือนยังอยู่ และบัญชีเข้าแอปไม่ได้จริง
  const handleToggleActive = (profile: UserProfile) => {
    if (profile.id === currentUser?.id) {
      showAlert("ผิดพลาด", "คุณไม่สามารถปิดการใช้งานบัญชีตัวเองได้!", "warning");
      return;
    }

    if (profile.is_approved === false) {
      updateProfile(profile, { is_approved: true }, `อนุมัติ / เปิดการใช้งาน ${profile.username} แล้ว`);
      return;
    }

    showConfirm(
      "ปิดการใช้งานบัญชีนี้?",
      `${profile.username} จะเข้าแอปและเห็นข้อมูลร้านไม่ได้ ประวัติงานและเงินเดือนยังเก็บไว้ครบ เปิดกลับได้ทุกเมื่อ`,
      () => {
        closePopup();
        updateProfile(profile, { is_approved: false }, `ปิดการใช้งาน ${profile.username} แล้ว`);
      },
      "ปิดการใช้งาน",
      "ยกเลิก"
    );
  };

  const isViewerSuperadmin = currentUserRole === "superadmin";

  // ===== ลบบัญชีถาวร (เฉพาะ superadmin และต้องปิดใช้งานก่อน) =====
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const openDeleteDialog = (profile: UserProfile) => {
    setDeleteTarget(profile);
    setDeleteConfirmText("");
  };

  const closeDeleteDialog = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
    setDeleteConfirmText("");
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", "error");
        return;
      }

      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      const result = await res.json().catch(() => ({ success: false, error: "เซิร์ฟเวอร์ไม่ตอบกลับ" }));

      if (!res.ok || !result.success) {
        showToast(result.error || "ลบบัญชีไม่สำเร็จ", "error");
        return;
      }

      const deletedId = deleteTarget.id;
      setProfiles(prev => prev.filter(p => p.id !== deletedId));
      showToast(`ลบบัญชี ${deleteTarget.username} ออกจากระบบแล้ว`);
      setDeleteTarget(null);
      setDeleteConfirmText("");
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteNameMatches =
    !!deleteTarget && deleteConfirmText.trim() === (deleteTarget.username || "").trim();

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diffMins = (new Date().getTime() - new Date(lastSeen).getTime()) / 60000;
    return diffMins < 5;
  };

  const inactiveCount = profiles.filter(isInactive).length;
  const statusCounts: Record<StatusFilter, number> = {
    all: profiles.length,
    active: profiles.length - inactiveCount,
    inactive: inactiveCount,
  };

  // ชื่อเล่นใช้ล็อกอินได้ ถ้าซ้ำกัน คนหนึ่งจะล็อกอินด้วยชื่อเล่นไม่ได้
  const nameCounts = profiles.reduce<Record<string, number>>((acc, p) => {
    const key = normalizeName(p.username);
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const isDuplicateName = (p: UserProfile) => (nameCounts[normalizeName(p.username)] || 0) > 1;

  const filteredProfiles = profiles
    .filter(profile => {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        profile.username?.toLowerCase().includes(term) ||
        profile.email?.toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "inactive" ? isInactive(profile) : !isInactive(profile));
      return matchesSearch && matchesStatus;
    })
    // คนที่รออนุมัติขึ้นก่อน จะได้ไม่ตกหล่น
    .sort((a, b) => Number(isInactive(b)) - Number(isInactive(a)));

  const renderPopupIcon = (type: string) => {
    switch (type) {
      case "success": return <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>;
      case "error": return <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><X className="h-8 w-8 text-red-600" /></div>;
      case "warning": return <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4"><AlertTriangle className="h-8 w-8 text-yellow-600" /></div>;
      default: return <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4"><Info className="h-8 w-8 text-blue-600" /></div>;
    }
  };

  if (loading && profiles.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* Toast */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 transition-all duration-300 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl z-60 ${toast.show ? "translate-y-0 opacity-100" : "-translate-y-20 opacity-0 pointer-events-none"}`}>
        {toast.type === "error" ? <AlertTriangle size={18} className="text-red-400 mr-2" /> : <CheckCircle2 size={18} className="text-green-400 mr-2" />}
        <span className="font-bold text-sm">{toast.message}</span>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push("/home")} 
              className="flex items-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer active:scale-95 bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              <ChevronLeft size={20} className="mr-1" /> กลับหน้าโฮม
            </button>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center">
              <Users className="mr-2 text-blue-600" size={24} />
              จัดการพนักงาน / สาขา
            </h1>
          </div>
          
          {statusCounts.inactive > 0 ? (
            <button
              onClick={() => setStatusFilter("inactive")}
              className="bg-rose-50 text-rose-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
            >
              <UserCheck size={18} className="mr-2" />
              มี {statusCounts.inactive} บัญชีรออนุมัติ / ปิดใช้งาน
            </button>
          ) : (
            <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center border border-blue-100">
              <UserCheck size={18} className="mr-2" />
              สมาชิกทั้งหมด {profiles.length} คน
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* ช่องค้นหา + ตัวกรองสถานะ */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative w-full md:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อเล่น หรือ อีเมล..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>

          <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
            {([
              { key: "all", label: "ทั้งหมด" },
              { key: "active", label: "ใช้งานอยู่" },
              { key: "inactive", label: "รออนุมัติ / ปิดใช้งาน" },
            ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => {
              const active = statusFilter === key;
              const highlight = key === "inactive" && statusCounts.inactive > 0;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? key === "inactive" ? "bg-rose-500 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                    active ? "bg-white/25" : highlight ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"
                  }`}>
                    {statusCounts[key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* รายชื่อสมาชิก */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProfiles.map((profile) => {
            // 🌟 แก้ไข: เช็คให้ครอบคลุมทั้ง admin และ superadmin
            const isAdmin = profile.role === "admin" || profile.role === "superadmin";
            const isMe = profile.id === currentUser?.id;
            const online = isOnline(profile.last_seen);
            const isTargetSuperadmin = profile.role === "superadmin";
            // superadmin เข้าระบบได้เสมอ (ไม่ขึ้นกับ is_approved) และแอดมินทั่วไปแก้ superadmin ไม่ได้
            const canEdit = !isMe && (!isTargetSuperadmin || isViewerSuperadmin);
            const canToggleActive = canEdit && !isTargetSuperadmin;
            const isDisabled = isInactive(profile);
            const isSaving = savingId === profile.id;
            const rs = roleStyle(profile.role);
            const duplicateName = isDuplicateName(profile);

            return (
              <div key={profile.id} className={`bg-white rounded-3xl p-5 border shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden ${isMe ? "border-blue-300 ring-1 ring-blue-100" : isDisabled ? "border-rose-200 bg-rose-50/30" : "border-gray-200"}`}>

                {/* แถบสีด้านบนการ์ด: สีตามสิทธิ์ / แดงถ้ารออนุมัติ */}
                <div className={`absolute top-0 left-0 w-full h-1.5 ${isDisabled ? "bg-rose-400" : rs.bar}`}></div>

                {/* ปุ่มลบถาวร (เฉพาะ superadmin, ต้องปิดใช้งานก่อน) + ปุ่มปิด/เปิดการใช้งาน */}
                {canToggleActive && (
                  <div className="absolute top-4 right-4 flex gap-1.5">
                    {isViewerSuperadmin && isDisabled && (
                      <button
                        onClick={() => openDeleteDialog(profile)}
                        disabled={isSaving}
                        className="p-2 rounded-xl transition-all cursor-pointer disabled:opacity-50 text-rose-500 bg-rose-50 hover:text-white hover:bg-rose-600"
                        title="ลบบัญชีนี้ออกจากระบบถาวร"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  <button
                    onClick={() => handleToggleActive(profile)}
                    disabled={isSaving}
                    className={`p-2 rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                      isDisabled
                        ? "text-emerald-600 bg-emerald-50 hover:text-white hover:bg-emerald-500"
                        : "text-rose-300 hover:text-white hover:bg-rose-500"
                    }`}
                    title={isDisabled ? "อนุมัติ / เปิดการใช้งานบัญชีนี้" : "ปิดการใช้งานบัญชีนี้"}
                  >
                    {isDisabled ? <Power size={16} /> : <Ban size={16} />}
                  </button>
                  </div>
                )}

                {/* หัวการ์ด: เว้นขวาไว้ให้ปุ่ม จะได้ไม่ทับชื่อยาวๆ */}
                <div className="flex items-center gap-3.5 pr-24 mt-1">
                  <div className={`relative shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black uppercase ${isDisabled ? "bg-slate-100 text-slate-400" : rs.avatar}`}>
                    {profile.username?.charAt(0) || "?"}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-slate-300"}`}
                      title={online ? "กำลังออนไลน์" : "ออฟไลน์"}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-base truncate">
                      {profile.username || "ไม่มีชื่อ"}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center mt-0.5 min-w-0">
                      <Mail size={12} className="mr-1 shrink-0" />
                      <span className="truncate">{profile.email}</span>
                    </p>
                  </div>
                </div>

                {/* ป้ายสถานะ */}
                <div className="flex flex-wrap gap-1.5 mt-3.5">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${rs.chip}`}>{rs.label}</span>
                  {isMe && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200">คุณ</span>}
                  {isDisabled && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-rose-50 text-rose-700 border-rose-200">รออนุมัติ / ปิดใช้งาน</span>}
                  {duplicateName && (
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-amber-50 text-amber-800 border-amber-300"
                      title="ชื่อเล่นซ้ำกับคนอื่น ทำให้ล็อกอินด้วยชื่อเล่นไม่ได้ ให้เข้าด้วยอีเมล หรือเปลี่ยนชื่อให้ต่างกัน"
                    >
                      ⚠️ ชื่อซ้ำ
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">
                  <span className="flex items-center"><Calendar size={13} className="mr-1.5" /> สมัคร {new Date(profile.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</span>
                  <span className={`flex items-center font-bold ${online ? "text-emerald-600" : "text-slate-400"}`}>
                    {isAdmin ? <ShieldCheck size={13} className="mr-1" /> : <Navigation size={13} className="mr-1" />}
                    {online ? "ออนไลน์" : "ออฟไลน์"}
                  </span>
                </div>

                {/* ตัวปรับเปลี่ยนสาขา */}
                <div className="mt-3 flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-wide flex items-center">
                      <Store size={12} className="mr-1"/> เห็นงานสาขา
                      {isSaving && <Loader2 size={12} className="ml-1 animate-spin text-blue-500" />}
                    </label>
                    <select
                      value={profile.branch_id || "ALL"}
                      disabled={!canEdit || isSaving}
                      onChange={(e) => handleBranchChange(profile, e.target.value)}
                      className={`w-full text-xs font-bold p-2.5 rounded-xl outline-none transition-all border shadow-sm ${
                        !canEdit
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-white border-gray-200 hover:border-blue-400 text-slate-700 cursor-pointer"
                      }`}
                    >
                      <option value="ALL">🌐 ทุกสาขา</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>🏠 เฉพาะ {b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* ตัวปรับเปลี่ยนสิทธิ์ */}
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-wide flex items-center"><ShieldCheck size={12} className="mr-1"/> สิทธิ์</label>
                    <select
                      disabled={isMe || (profile.role === "superadmin" && currentUserRole !== "superadmin")}
                      value={profile.role}
                      onChange={(e) => handleRoleChange(profile.id, e.target.value, profile.username)}
                      className={`w-full text-xs font-bold p-2.5 rounded-xl outline-none transition-all cursor-pointer border shadow-sm ${
                        isMe || (profile.role === "superadmin" && currentUserRole !== "superadmin")
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
                        : "bg-white border-gray-200 hover:border-blue-400 text-slate-700"
                      }`}
                    >
                      <option value="rider">🛵 ไรเดอร์</option>
                      <option value="kitchen">🍳 ครัว</option>
                      <option value="admin"> 🌟 แอดมิน</option>
                      {/* เฉพาะ superadmin เท่านั้นที่แต่งตั้ง superadmin ได้ (ตรงกับ trigger ในฐานข้อมูล) */}
                      {(isViewerSuperadmin || isTargetSuperadmin) && (
                        <option value="superadmin">👑 ซุปเปอร์แอดมิน</option>
                      )}
                    </select>
                  </div>
                </div>

              </div>
            );
          })}
          
          {filteredProfiles.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
              <Users size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">
                {statusFilter === "inactive" && !searchTerm ? "ไม่มีบัญชีที่รออนุมัติหรือถูกปิดใช้งาน" : "ไม่พบชื่อสมาชิกที่คุณค้นหา"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: ลบบัญชีถาวร */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-rose-100 mb-4">
              <Trash2 className="h-8 w-8 text-rose-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2 text-center">ลบ {deleteTarget.username} ถาวร?</h3>
            <p className="text-gray-500 text-sm mb-3 leading-relaxed font-medium text-center">
              ลบแล้วกู้คืนไม่ได้ อีเมลนี้จะสมัครใหม่ได้
            </p>
            <ul className="text-xs text-slate-600 bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-4 space-y-1.5 font-medium">
              <li>❌ บัญชีล็อกอินและโปรไฟล์</li>
              <li>❌ ประวัติตอกบัตร / เข้างาน</li>
              <li>❌ ประวัติจ่ายเงินเดือน และตารางงาน</li>
              <li className="text-emerald-700">✅ ออเดอร์และยอดขายยังอยู่ครบ</li>
            </ul>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">
              พิมพ์ <span className="text-rose-600 font-black">{deleteTarget.username}</span> เพื่อยืนยัน
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              disabled={isDeleting}
              autoFocus
              className="w-full px-4 py-3 mb-5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500"
            />
            <div className="flex gap-3">
              <button
                onClick={closeDeleteDialog}
                disabled={isDeleting}
                className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={!deleteNameMatches || isDeleting}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all cursor-pointer active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 size={16} className="animate-spin" />}
                {isDeleting ? "กำลังลบ..." : "ลบถาวร"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Popup Modal */}
      {popup.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center transform animate-in zoom-in-95 duration-200 border border-gray-100">
            {renderPopupIcon(popup.icon || "info")}
            <h3 className="text-xl font-black text-gray-900 mb-2">{popup.title}</h3>
            <p className="text-gray-500 text-sm mb-6 whitespace-pre-line leading-relaxed font-medium">{popup.message}</p>
            {popup.type === "alert" ? (
              <button onClick={closePopup} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all duration-200 shadow-md cursor-pointer active:scale-95">ตกลง</button>
            ) : (
              <div className="flex gap-3">
                <button onClick={closePopup} className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all duration-200 cursor-pointer active:scale-95">{popup.cancelText}</button>
                <button onClick={popup.onConfirm} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-200 cursor-pointer active:scale-95">{popup.confirmText}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}