'use client'
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Calendar as CalendarIcon, Edit, Trash2, Plus, Loader2, X, ChevronLeft, ChevronRight,
  Clock, AlertTriangle, Info, Wand2, Users, Check, Search, MapPin, Settings, ArrowLeft, List, LayoutGrid, CheckSquare, Copy
} from "lucide-react";

// ---------- Types ----------
interface ProfileInfo { username: string; role: string; branch_id?: string | null }
interface Schedule { id: string; user_id: string; work_date: string; start_time: string; end_time: string; status: string; created_at: string; profiles?: ProfileInfo }
interface UserOption { id: string; username: string; role: string; branch_id?: string | null }
interface Branch { id: string; name: string }
interface FormData { user_id: string; start_time: string; end_time: string; status: string }
interface ShiftPreset { id: string; name: string; start: string; end: string; roleTimes?: { [role: string]: { start: string; end: string } } }
interface CopyRow { user_id: string; work_date: string; start_time: string; end_time: string; status: string; profiles?: { branch_id?: string | null; role: string } | null }
interface QuotaConfig { [shiftId: string]: { [role: string]: number } }
interface NewSchedulePayload { user_id: string; work_date: string; start_time: string; end_time: string; status: string }
interface ConfirmState { isOpen: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'info'; confirmText: string }

// ---------- Helpers ----------
const fmtDate = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const hm = (t: string) => t.substring(0, 5);
const ROLE_LABEL: Record<string, string> = { admin: 'แอดมิน', superadmin: 'แอดมิน', kitchen: 'แม่ครัว', rider: 'ไรเดอร์' };
const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const PALETTE = [
  { chip: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  { chip: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500' },
  { chip: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
];
const OTHER = { chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' };
const pal = (i: number) => (i >= 0 ? PALETTE[i % PALETTE.length] : OTHER);
const SHIFT_ROLES = ['kitchen', 'rider', 'admin'] as const;
const roleKey = (r?: string) => (r === 'superadmin' ? 'admin' : r || '');
const timesFor = (p: ShiftPreset, role?: string) => p.roleTimes?.[roleKey(role)] || { start: p.start, end: p.end };
const weekStart = (d: string) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() - x.getDay()); return x; };
const addDays = (x: Date, n: number) => { const y = new Date(x); y.setDate(y.getDate() + n); return y; };
const dstr = (x: Date) => fmtDate(x.getFullYear(), x.getMonth(), x.getDate());
const weekLabel = (d: string) => {
  if (!d) return '';
  const a = weekStart(d), f = (x: Date) => x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  return `${f(a)} – ${f(addDays(a, 6))}`;
};

// ---------- Small UI parts ----------
function Modal({ title, subtitle, onClose, children, footer, wide }: { title: React.ReactNode; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`bg-white w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]`}>
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-lg text-slate-800">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="ปิด" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer"><X size={20} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="p-4 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-slate-500 mb-1">{label}</span>
    {children}
  </label>
);
const inputCls = "w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

// ---------- Page ----------
export default function SchedulePage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userRole, setUserRole] = useState("rider");
  const [loading, setLoading] = useState(true);
  const [globalBranch, setGlobalBranch] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [multiMode, setMultiMode] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [selectedShiftPreset, setSelectedShiftPreset] = useState("morning");
  const [formData, setFormData] = useState<FormData>({ user_id: "", start_time: "12:00", end_time: "20:00", status: "ทำงาน" });

  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>({ isOpen: false, title: "", message: "", onConfirm: () => {}, type: 'danger', confirmText: "ตกลง" });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [isAutoOpen, setIsAutoOpen] = useState(false);
  const [isShiftSettingOpen, setIsShiftSettingOpen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copyFrom, setCopyFrom] = useState("");
  const [copyTo, setCopyTo] = useState("");
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [aiDateRange, setAiDateRange] = useState({ start: "", end: "" });
  const [aiSearchText, setAiSearchText] = useState("");
  const [aiFilterRole, setAiFilterRole] = useState("all");
  const [autoAvailabilities, setAutoAvailabilities] = useState<Record<string, boolean>>({});
  const [shiftPresets, setShiftPresets] = useState<ShiftPreset[]>([
    { id: "morning", name: "กะเช้า", start: "12:00", end: "20:00" },
    { id: "evening", name: "กะค่ำ", start: "19:00", end: "04:00" },
  ]);
  const [quotas, setQuotas] = useState<QuotaConfig>({
    morning: { kitchen: 2, rider: 2, admin: 1 },
    evening: { kitchen: 2, rider: 3, admin: 1 },
  });
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const notify = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  // ----- settings load / autosave (unchanged logic) -----
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('schedule_settings').select('*').eq('id', 1).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
          if (data.availabilities_data) setAutoAvailabilities(data.availabilities_data);
          if (data.quotas_data) setQuotas(data.quotas_data);
          if (data.shifts_data) setShiftPresets(data.shifts_data);
        } else {
          await supabase.from('schedule_settings').insert([{ id: 1 }]);
        }
      } catch (e) { console.error("Failed to fetch settings", e); }
      finally { setIsSettingsLoaded(true); }
    })();
    if (typeof window !== 'undefined' && window.innerWidth < 768) setView('list');
  }, []);

  useEffect(() => {
    if (!isSettingsLoaded) return;
    const t = setTimeout(async () => {
      try {
        await supabase.from('schedule_settings').update({ availabilities_data: autoAvailabilities, quotas_data: quotas, shifts_data: shiftPresets }).eq('id', 1);
      } catch (e) { console.error("Auto-save failed", e); }
    }, 1000);
    return () => clearTimeout(t);
  }, [autoAvailabilities, quotas, shiftPresets, isSettingsLoaded]);

  useEffect(() => {
    fetchData();
    setSelectedDays([]);
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    setAiDateRange({ start: fmtDate(y, m, 1), end: fmtDate(y, m, new Date(y, m + 1, 0).getDate()) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/login"; return; }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile) setUserRole(profile.role);

    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    let query = supabase.from('work_schedules').select('*, profiles (username, role, branch_id)')
      .gte('work_date', fmtDate(y, m, 1)).lte('work_date', fmtDate(y, m, new Date(y, m + 1, 0).getDate()))
      .order('start_time', { ascending: true });
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') query = query.eq('user_id', session.user.id);
    const { data: scheduleData } = await query;
    if (scheduleData) setSchedules(scheduleData as unknown as Schedule[]);

    if (profile?.role === 'admin' || profile?.role === 'superadmin') {
      const { data: bData } = await supabase.from('branches').select('id, name');
      if (bData) setBranches(bData as Branch[]);
      const { data: usersData } = await supabase.from('profiles').select('id, username, role, branch_id');
      if (usersData) {
        setUsers(usersData as UserOption[]);
        if (usersData.length > 0 && !formData.user_id) setFormData(p => ({ ...p, user_id: usersData[0].id }));
      }
    }
    setLoading(false);
  };

  // ----- derived data -----
  const shiftIdx = (s: Schedule) => {
    const st = hm(s.start_time), en = hm(s.end_time), role = s.profiles?.role;
    const exact = shiftPresets.findIndex(p => { const t = timesFor(p, role); return t.start === st && t.end === en; });
    return exact >= 0 ? exact : shiftPresets.findIndex(p => timesFor(p, role).start === st);
  };

  const visible = useMemo(() => schedules.filter(s =>
    (filterRole === 'all' || s.profiles?.role === filterRole || (filterRole === 'admin' && s.profiles?.role === 'superadmin')) &&
    (globalBranch === 'all' || s.profiles?.branch_id === globalBranch || s.profiles?.role === 'superadmin')
  ), [schedules, filterRole, globalBranch]);

  const byDate = useMemo(() => {
    const m: Record<string, Schedule[]> = {};
    visible.forEach(s => { (m[s.work_date] ||= []).push(s); });
    return m;
  }, [visible]);

  const groupByShift = (list: Schedule[]) => {
    const g = new Map<number, Schedule[]>();
    list.forEach(s => { const i = shiftIdx(s); g.set(i, [...(g.get(i) || []), s]); });
    return [...g.entries()].sort((a, b) => a[0] - b[0]);
  };

  const dayChips = (list: Schedule[]) => {
    if (!isAdmin) return list.map(s => ({
      key: s.id,
      label: s.status === 'ทำงาน' ? `${hm(s.start_time)}–${hm(s.end_time)}` : s.status,
      cls: s.status === 'ทำงาน' ? pal(shiftIdx(s)).chip : 'bg-rose-100 text-rose-700',
    }));
    const counts = new Map<number, number>(); let off = 0;
    list.forEach(s => { if (s.status === 'ทำงาน') counts.set(shiftIdx(s), (counts.get(shiftIdx(s)) || 0) + 1); else off++; });
    const out = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([i, n]) => ({ key: `g${i}`, label: `${i >= 0 ? shiftPresets[i].name : 'พิเศษ'} ${n}`, cls: pal(i).chip }));
    if (off) out.push({ key: 'off', label: `ลา/หยุด ${off}`, cls: 'bg-slate-100 text-slate-500' });
    return out;
  };

  const calendarDays = useMemo(() => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    const days: (string | null)[] = Array(new Date(y, m, 1).getDay()).fill(null);
    for (let i = 1; i <= new Date(y, m + 1, 0).getDate(); i++) days.push(fmtDate(y, m, i));
    return days;
  }, [currentDate]);

  const activeBranchUsers = useMemo(() => globalBranch === "all" ? users : users.filter(u => u.branch_id === globalBranch || u.role === 'superadmin'), [users, globalBranch]);
  const filteredAiUsers = activeBranchUsers.filter(u =>
    u.username.toLowerCase().includes(aiSearchText.toLowerCase()) &&
    (aiFilterRole === 'all' || u.role === aiFilterRole || (aiFilterRole === 'admin' && u.role === 'superadmin')));

  const today = new Date();
  const todayStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());
  const longDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const branchName = (id?: string | null) => branches.find(b => b.id === id)?.name || '';

  // ----- handlers -----
  const goMonth = (delta: number) => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));

  // เวลากะขึ้นกับตำแหน่งของพนักงานที่เลือก
  const roleOf = (id: string) => users.find(u => u.id === id)?.role;
  const applyPreset = (presetId: string, userId: string) => {
    const preset = shiftPresets.find(p => p.id === presetId);
    if (!preset) return;
    const t = timesFor(preset, roleOf(userId));
    setFormData(p => ({ ...p, start_time: t.start, end_time: t.end }));
  };
  const timeLabel = (p: ShiftPreset) => { const t = timesFor(p, roleOf(formData.user_id)); return `${p.name} (${t.start}–${t.end})`; };

  const handleDayClick = (dateStr: string) => {
    if (multiMode && isAdmin) {
      setSelectedDays(p => p.includes(dateStr) ? p.filter(d => d !== dateStr) : [...p, dateStr]);
      return;
    }
    setSelectedDate(dateStr); setFormError(""); setEditingId(null);
    setSelectedShiftPreset(shiftPresets[0].id);
    setFormData(p => ({ ...p, status: "ทำงาน" }));
    applyPreset(shiftPresets[0].id, formData.user_id);
  };

  const toggleMulti = () => { setMultiMode(m => !m); setSelectedDays([]); };

  const handleEditClick = (s: Schedule) => {
    setEditingId(s.id);
    const st = hm(s.start_time), en = hm(s.end_time);
    const match = shiftPresets.find(p => { const t = timesFor(p, s.profiles?.role); return t.start === st && t.end === en; });
    setSelectedShiftPreset(match ? match.id : "custom");
    setFormData({ user_id: s.user_id, start_time: st, end_time: en, status: s.status });
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
    if (name === 'user_id' && selectedShiftPreset !== 'custom') applyPreset(selectedShiftPreset, value);
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value; setSelectedShiftPreset(id);
    applyPreset(id, formData.user_id);
  };

  const handleTimeChange = (type: 'start_time' | 'end_time', value: string) => {
    setSelectedShiftPreset("custom");
    setFormData(p => ({ ...p, [type]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    setFormError(""); setIsSubmitting(true);
    try {
      const payload = { ...formData, work_date: selectedDate };
      const { error } = editingId
        ? await supabase.from('work_schedules').update(payload).eq('id', editingId)
        : await supabase.from('work_schedules').insert([payload]);
      if (error) throw error;
      await fetchData();
      notify(editingId ? "บันทึกการแก้ไขแล้ว" : "เพิ่มกะแล้ว");
      setEditingId(null);
      setSelectedShiftPreset(shiftPresets[0].id);
      setFormData(p => ({ ...p, status: "ทำงาน" }));
      applyPreset(shiftPresets[0].id, formData.user_id);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally { setIsSubmitting(false); }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(""); setIsSubmitting(true);
    try {
      const rows: NewSchedulePayload[] = selectedDays
        .filter(d => !schedules.some(s => s.user_id === formData.user_id && s.work_date === d && hm(s.start_time) === formData.start_time))
        .map(d => ({ ...formData, status: "ทำงาน", work_date: d }));
      if (rows.length > 0) {
        const { error } = await supabase.from('work_schedules').insert(rows);
        if (error) throw error;
      }
      const skipped = selectedDays.length - rows.length;
      notify(`เพิ่มกะ ${rows.length} วัน${skipped ? ` (ข้าม ${skipped} วันที่มีอยู่แล้ว)` : ''}`);
      await fetchData();
      setIsBulkOpen(false); setSelectedDays([]); setMultiMode(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
    } finally { setIsSubmitting(false); }
  };

  const closeConfirm = () => setConfirmDialog(p => ({ ...p, isOpen: false }));

  const handleBulkDelete = () => setConfirmDialog({
    isOpen: true, type: 'danger', confirmText: "ล้างตาราง", title: "ล้างกะในวันที่เลือก",
    message: `ลบตารางงานของทุกคนใน ${selectedDays.length} วันที่เลือก\nการลบนี้ย้อนกลับไม่ได้`,
    onConfirm: async () => {
      closeConfirm();
      try {
        let q = supabase.from('work_schedules').delete().in('work_date', selectedDays);
        if (globalBranch !== 'all') {
          const ids = users.filter(u => u.branch_id === globalBranch || u.role === 'superadmin').map(u => u.id);
          if (ids.length === 0) throw new Error("ไม่มีพนักงานในสาขานี้ให้ลบ");
          q = q.in('user_id', ids);
        }
        const { error } = await q;
        if (error) throw error;
        await fetchData(); setSelectedDays([]); notify("ล้างตารางแล้ว");
      } catch (err: unknown) { notify("ลบไม่สำเร็จ: " + (err instanceof Error ? err.message : ""), false); }
    },
  });

  const handleDeleteClick = (id: string) => setConfirmDialog({
    isOpen: true, type: 'danger', confirmText: "ลบกะนี้", title: "ลบกะทำงาน", message: "ต้องการลบกะนี้ใช่หรือไม่?",
    onConfirm: async () => {
      closeConfirm();
      try {
        const { error } = await supabase.from('work_schedules').delete().eq('id', id);
        if (error) throw error;
        setSchedules(p => p.filter(s => s.id !== id)); notify("ลบกะแล้ว");
      } catch (err: unknown) { notify("ลบไม่สำเร็จ: " + (err instanceof Error ? err.message : ""), false); }
    },
  });

  const toggleAvail = (userId: string, day: number, shiftId: string) => {
    const k = `${userId}-${day}-${shiftId}`;
    setAutoAvailabilities(p => ({ ...p, [k]: !p[k] }));
  };
  const setAllAvail = (userId: string, on: boolean) => setAutoAvailabilities(p => {
    const n = { ...p };
    for (let d = 0; d < 7; d++) shiftPresets.forEach(s => { n[`${userId}-${d}-${s.id}`] = on; });
    return n;
  });
  const handleQuota = (shiftId: string, role: string, v: string) =>
    setQuotas(p => ({ ...p, [shiftId]: { ...p[shiftId], [role]: parseInt(v) || 0 } }));
  const handleShiftUpdate = (id: string, field: 'name' | 'start' | 'end', v: string) =>
    setShiftPresets(p => p.map(s => s.id === id ? { ...s, [field]: v } : s));

  const updateRoleTime = (id: string, role: string, f: 'start' | 'end', v: string) =>
    setShiftPresets(prev => prev.map(s => s.id === id ? { ...s, roleTimes: { ...s.roleTimes, [role]: { ...timesFor(s, role), [f]: v } } } : s));
  const toggleRoleTimes = (id: string, on: boolean) =>
    setShiftPresets(prev => prev.map(s => {
      if (s.id !== id) return s;
      if (on) return { ...s, roleTimes: Object.fromEntries(SHIFT_ROLES.map(r => [r, { start: s.start, end: s.end }])) };
      const n = { ...s }; delete n.roleTimes; return n;
    }));
  const addShift = () => {
    const id = `shift_${Date.now()}`;
    setShiftPresets(p => [...p, { id, name: `กะที่ ${p.length + 1}`, start: "09:00", end: "17:00" }]);
    setQuotas(q => ({ ...q, [id]: { kitchen: 1, rider: 1, admin: 0 } }));
  };
  const removeShift = (id: string) => setConfirmDialog({
    isOpen: true, type: 'danger', confirmText: "ลบกะ", title: "ลบกะนี้?",
    message: "กะที่ลงในตารางแล้วจะยังอยู่ แต่จะแสดงเป็นเวลาพิเศษ",
    onConfirm: () => { closeConfirm(); setShiftPresets(p => p.filter(s => s.id !== id)); },
  });

  const openCopy = () => {
    const w = weekStart(todayStr);
    setCopyFrom(dstr(w)); setCopyTo(dstr(addDays(w, 7))); setIsCopyOpen(true);
  };
  const handleCopyWeek = async () => {
    if (!copyFrom || !copyTo) return;
    const src = weekStart(copyFrom), dst = weekStart(copyTo);
    if (dstr(src) === dstr(dst)) { notify("เลือกสัปดาห์ต้นทางและปลายทางให้ต่างกัน", false); return; }
    setIsCopying(true);
    try {
      const { data, error } = await supabase.from('work_schedules')
        .select('user_id, work_date, start_time, end_time, status, profiles (branch_id, role)')
        .gte('work_date', dstr(src)).lte('work_date', dstr(addDays(src, 6))).eq('status', 'ทำงาน');
      if (error) throw error;
      const { data: ex, error: exErr } = await supabase.from('work_schedules').select('user_id, work_date, start_time')
        .gte('work_date', dstr(dst)).lte('work_date', dstr(addDays(dst, 6)));
      if (exErr) throw exErr;
      const exist = new Set((ex || []).map(r => `${r.user_id}|${r.work_date}|${hm(r.start_time)}`));
      const diff = Math.round((dst.getTime() - src.getTime()) / 86400000);
      const source = ((data || []) as unknown as CopyRow[]).filter(r =>
        globalBranch === 'all' || r.profiles?.branch_id === globalBranch || r.profiles?.role === 'superadmin');
      const rows: NewSchedulePayload[] = [];
      source.forEach(r => {
        const date = dstr(addDays(new Date(r.work_date + 'T00:00:00'), diff));
        if (!exist.has(`${r.user_id}|${date}|${hm(r.start_time)}`)) rows.push({ user_id: r.user_id, work_date: date, start_time: r.start_time, end_time: r.end_time, status: r.status });
      });
      if (rows.length === 0) { notify(source.length ? "ปลายทางมีกะครบแล้ว ไม่มีอะไรให้คัดลอก" : "สัปดาห์ต้นทางไม่มีกะให้คัดลอก", false); return; }
      const { error: insErr } = await supabase.from('work_schedules').insert(rows);
      if (insErr) throw insErr;
      const skipped = source.length - rows.length;
      notify(`คัดลอก ${rows.length} กะแล้ว${skipped ? ` (ข้าม ${skipped} กะที่มีอยู่แล้ว)` : ''}`);
      setIsCopyOpen(false);
      const td = new Date(dstr(dst) + 'T00:00:00');
      if (td.getMonth() === currentDate.getMonth() && td.getFullYear() === currentDate.getFullYear()) fetchData();
      else setCurrentDate(new Date(td.getFullYear(), td.getMonth(), 1));
    } catch (err: unknown) {
      notify("คัดลอกไม่สำเร็จ: " + (err instanceof Error ? err.message : ""), false);
    } finally { setIsCopying(false); }
  };

  const handleRunAutoSchedule = () => {
    if (!aiDateRange.start || !aiDateRange.end) { notify("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด", false); return; }
    setConfirmDialog({
      isOpen: true, type: 'info', confirmText: "เริ่มจัดตาราง", title: "จัดกะอัตโนมัติ?",
      message: `จัดตารางวันที่ ${aiDateRange.start} ถึง ${aiDateRange.end}\n${globalBranch === "all" ? 'ทุกสาขา (ใช้โควต้าเท่ากันทุกสาขา)' : 'เฉพาะสาขาที่เลือก'}\nกะที่มีอยู่แล้วจะไม่ถูกแก้ไข`,
      onConfirm: async () => {
        closeConfirm(); setIsAutoGenerating(true);
        try {
          const rows: NewSchedulePayload[] = [];
          const end = new Date(aiDateRange.end + 'T00:00:00');
          const branchIds = globalBranch === "all" ? branches.map(b => b.id) : [globalBranch];
          for (let d = new Date(aiDateRange.start + 'T00:00:00'); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = fmtDate(d.getFullYear(), d.getMonth(), d.getDate());
            const dow = d.getDay();
            for (const bId of branchIds) {
              const branchUsers = users.filter(u => u.branch_id === bId || u.role === 'superadmin');
              for (const shift of shiftPresets) {
                for (const role of ['kitchen', 'rider', 'admin']) {
                  const need = quotas[shift.id]?.[role] || 0;
                  if (need === 0) continue;
                  const pool = branchUsers
                    .filter(u => (role === 'admin' ? (u.role === 'admin' || u.role === 'superadmin') : u.role === role) && autoAvailabilities[`${u.id}-${dow}-${shift.id}`])
                    .sort(() => 0.5 - Math.random());
                  let n = 0;
                  for (const u of pool) {
                    if (n >= need) break;
                    const t = timesFor(shift, role);
                    const exists = schedules.some(s => s.user_id === u.id && s.work_date === dateStr && hm(s.start_time) === t.start);
                    const queued = rows.some(s => s.user_id === u.id && s.work_date === dateStr && s.start_time === t.start);
                    if (!exists && !queued) { rows.push({ user_id: u.id, work_date: dateStr, start_time: t.start, end_time: t.end, status: "ทำงาน" }); n++; }
                  }
                }
              }
            }
          }
          if (rows.length === 0) { notify("ไม่มีกะให้เพิ่ม (ไม่มีคนว่าง หรือจัดครบแล้ว)", false); return; }
          const { error } = await supabase.from('work_schedules').insert(rows);
          if (error) throw error;
          notify(`จัดตารางเรียบร้อย เพิ่ม ${rows.length} กะ`);
          setIsAutoOpen(false); fetchData();
        } catch (err: unknown) {
          notify("เกิดข้อผิดพลาด: " + (err instanceof Error ? err.message : ""), false);
        } finally { setIsAutoGenerating(false); }
      },
    });
  };

  // ----- reusable form pieces -----
  const shiftFields = (withStatus: boolean) => (
    <div className="space-y-3">
      <div className={`grid grid-cols-1 ${withStatus ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
        <Field label="พนักงาน">
          <select name="user_id" value={formData.user_id} onChange={handleFormChange} required className={inputCls}>
            {activeBranchUsers.map(u => <option key={u.id} value={u.id}>{u.username} ({ROLE_LABEL[u.role] || u.role})</option>)}
          </select>
        </Field>
        <Field label="กะ">
          <select value={selectedShiftPreset} onChange={handlePresetChange} className={inputCls}>
            {shiftPresets.map(p => <option key={p.id} value={p.id}>{timeLabel(p)}</option>)}
            <option value="custom">กำหนดเวลาเอง</option>
          </select>
        </Field>
        {withStatus && (
          <Field label="สถานะ">
            <select name="status" value={formData.status} onChange={handleFormChange} className={inputCls}>
              <option value="ทำงาน">ทำงาน</option><option value="ลา">ลา</option><option value="หยุด">หยุด</option>
            </select>
          </Field>
        )}
      </div>
      {selectedShiftPreset === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="เวลาเข้า"><input type="time" value={formData.start_time} onChange={e => handleTimeChange('start_time', e.target.value)} className={inputCls} /></Field>
          <Field label="เวลาออก"><input type="time" value={formData.end_time} onChange={e => handleTimeChange('end_time', e.target.value)} className={inputCls} /></Field>
        </div>
      )}
    </div>
  );

  const scheduleRow = (s: Schedule, showActions: boolean) => (
    <div key={s.id} className={`flex items-center justify-between gap-3 py-2.5 ${editingId === s.id ? 'bg-blue-50 -mx-2 px-2 rounded-lg' : ''}`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {s.profiles?.username || 'พนักงาน'}
          <span className="ml-2 text-xs font-normal text-slate-400">{ROLE_LABEL[s.profiles?.role || ''] || ''}{globalBranch === 'all' && branchName(s.profiles?.branch_id) ? ` · ${branchName(s.profiles?.branch_id)}` : ''}</span>
        </p>
        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
          <Clock size={12} /> {hm(s.start_time)}–{hm(s.end_time)} น.
          {s.status !== 'ทำงาน' && <span className="px-1.5 rounded bg-rose-50 text-rose-600 font-medium">{s.status}</span>}
        </p>
      </div>
      {showActions && isAdmin && (
        <div className="flex gap-1 shrink-0">
          <button onClick={() => handleEditClick(s)} aria-label="แก้ไข" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"><Edit size={16} /></button>
          <button onClick={() => handleDeleteClick(s.id)} aria-label="ลบ" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"><Trash2 size={16} /></button>
        </div>
      )}
    </div>
  );

  if (loading && schedules.length === 0) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={36} /></div>;
  }

  const btnGhost = "px-3.5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer active:scale-95 transition";
  const dayList = selectedDate ? (byDate[selectedDate] || []) : [];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto min-h-screen bg-slate-50 pb-28">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} aria-label="ย้อนกลับ" className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"><ArrowLeft size={18} /></button>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><CalendarIcon size={22} className="text-blue-600" />{isAdmin ? "ระบบจัดตารางงาน" : "ตารางงานของฉัน"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => goMonth(-1)} aria-label="เดือนก่อน" className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"><ChevronLeft size={18} /></button>
          <span className="min-w-[140px] text-center font-semibold text-slate-700">{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear() + 543}</span>
          <button onClick={() => goMonth(1)} aria-label="เดือนถัดไป" className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"><ChevronRight size={18} /></button>
          <button onClick={() => setCurrentDate(new Date())} className="ml-1 px-3 py-2 text-sm font-medium rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer">วันนี้</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600">
              <MapPin size={15} />
              <select value={globalBranch} onChange={e => { setGlobalBranch(e.target.value); setSelectedDays([]); }} className="bg-transparent font-medium text-blue-700 outline-none cursor-pointer">
                <option value="all">ทุกสาขา</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          {isAdmin && (
            <div className="flex rounded-xl bg-slate-100 p-1">
              {[['all', 'ทั้งหมด'], ['kitchen', 'แม่ครัว'], ['rider', 'ไรเดอร์'], ['admin', 'แอดมิน']].map(([r, label]) => (
                <button key={r} onClick={() => setFilterRole(r)} className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer transition ${filterRole === r ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
              ))}
            </div>
          )}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button onClick={() => setView('calendar')} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 cursor-pointer ${view === 'calendar' ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-500'}`}><LayoutGrid size={15} />ปฏิทิน</button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 cursor-pointer ${view === 'list' ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-500'}`}><List size={15} />รายการ</button>
          </div>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={toggleMulti} className={`${btnGhost} ${multiMode ? '!bg-violet-600 !text-white !border-violet-600' : ''}`}><CheckSquare size={16} />{multiMode ? 'เลือกวันอยู่…' : 'เลือกหลายวัน'}</button>
            <button onClick={openCopy} className={btnGhost}><Copy size={16} />คัดลอกสัปดาห์</button>
            <button onClick={() => setIsShiftSettingOpen(true)} className={btnGhost}><Settings size={16} />ตั้งค่ากะ</button>
            <button onClick={() => setIsAutoOpen(true)} className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer active:scale-95 transition"><Wand2 size={16} />จัดกะอัตโนมัติ</button>
          </div>
        )}
      </div>

      {/* Legend + hint */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 mb-3 text-xs text-slate-500">
        {shiftPresets.map((p, i) => <span key={p.id} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${pal(i).dot}`} />{p.name} {p.roleTimes ? '(เวลาต่างตามตำแหน่ง)' : `${p.start}–${p.end}`}</span>)}
        <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${OTHER.dot}`} />เวลาพิเศษ</span>
        {multiMode && <span className="text-violet-600 font-medium">แตะวันที่ในปฏิทินเพื่อเลือก แล้วกด “เพิ่มกะ” หรือ “ล้างกะ” ด้านล่าง</span>}
        {!multiMode && isAdmin && view === 'calendar' && <span>แตะที่วันเพื่อดูและจัดการกะ</span>}
      </div>

      {/* Calendar */}
      {view === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {DAYS.map((d, i) => <div key={i} className={`py-2.5 text-center text-xs md:text-sm font-semibold ${i === 0 || i === 6 ? 'text-rose-500' : 'text-slate-500'}`}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 auto-rows-[84px] md:auto-rows-[120px]">
            {calendarDays.map((dateStr, idx) => {
              if (!dateStr) return <div key={`e${idx}`} className="border-b border-r border-slate-100 bg-slate-50/40" />;
              const list = byDate[dateStr] || [];
              const chips = dayChips(list);
              const isToday = dateStr === todayStr, isSel = selectedDays.includes(dateStr);
              return (
                <button key={dateStr} onClick={() => handleDayClick(dateStr)}
                  className={`border-b border-r border-slate-100 p-1 md:p-2 text-left flex flex-col gap-1 overflow-hidden cursor-pointer transition ${isSel ? 'bg-violet-50 ring-2 ring-inset ring-violet-400' : 'hover:bg-blue-50/50'}`}>
                  <span className={`self-start text-xs md:text-sm font-semibold w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{parseInt(dateStr.split('-')[2])}</span>
                  <div className="flex flex-col gap-0.5 w-full">
                    {chips.slice(0, 3).map(c => <span key={c.key} className={`truncate px-1.5 py-0.5 rounded text-[10px] md:text-xs font-medium ${c.cls}`}>{c.label}</span>)}
                    {chips.length > 3 && <span className="text-[10px] text-slate-400 px-1">+{chips.length - 3}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-3">
          {Object.keys(byDate).length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 py-14 text-center text-slate-500 text-sm">ยังไม่มีกะในเดือนนี้{isAdmin && ' — กด “จัดกะอัตโนมัติ” หรือแตะวันในมุมมองปฏิทินเพื่อเพิ่ม'}</div>
          )}
          {Object.keys(byDate).sort().map(d => (
            <div key={d} onClick={() => handleDayClick(d)} className={`bg-white rounded-2xl border p-4 cursor-pointer hover:border-blue-300 transition ${d === todayStr ? 'border-blue-400' : 'border-slate-200'}`}>
              <p className="font-semibold text-slate-800 mb-2">{new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}{d === todayStr && <span className="ml-2 text-xs text-blue-600 font-medium">วันนี้</span>}</p>
              <div className="space-y-1.5">
                {groupByShift(byDate[d]).map(([i, items]) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${pal(i).chip}`}>{i >= 0 ? shiftPresets[i].name : 'พิเศษ'}</span>
                    <span className="text-slate-600">
                      {isAdmin ? items.map(s => s.profiles?.username || 'พนักงาน').join(', ') : items.map(s => `${hm(s.start_time)}–${hm(s.end_time)} น.${s.status !== 'ทำงาน' ? ` (${s.status})` : ''}`).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Multi-select bar */}
      {isAdmin && multiMode && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-xl bg-slate-800 text-white rounded-2xl shadow-2xl p-3 flex items-center justify-between gap-2">
          <span className="pl-2 text-sm font-medium">เลือกแล้ว {selectedDays.length} วัน</span>
          <div className="flex gap-2">
            <button disabled={!selectedDays.length} onClick={() => { setFormError(""); setIsBulkOpen(true); }} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-400 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"><Plus size={15} />เพิ่มกะ</button>
            <button disabled={!selectedDays.length} onClick={handleBulkDelete} className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500 hover:bg-rose-400 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"><Trash2 size={15} />ล้างกะ</button>
            <button onClick={toggleMulti} className="px-3 py-2 rounded-xl text-sm bg-slate-600 hover:bg-slate-500 cursor-pointer">เสร็จ</button>
          </div>
        </div>
      )}

      {/* Day modal */}
      {selectedDate && (
        <Modal title={longDate(selectedDate)} subtitle={dayList.length ? `${dayList.length} กะในวันนี้` : undefined} onClose={() => setSelectedDate(null)}
          footer={isAdmin && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">{editingId ? 'แก้ไขกะ' : 'เพิ่มกะในวันนี้'}</p>
              {formError && <div className="p-2.5 bg-rose-50 text-rose-600 text-sm rounded-xl">{formError}</div>}
              {shiftFields(true)}
              <div className="flex gap-2">
                {editingId && <button type="button" onClick={() => { setEditingId(null); setSelectedShiftPreset(shiftPresets[0].id); }} className="px-4 py-2.5 bg-slate-100 text-slate-600 font-medium rounded-xl text-sm cursor-pointer">ยกเลิกการแก้ไข</button>}
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : editingId ? "บันทึกการแก้ไข" : "เพิ่มกะ"}
                </button>
              </div>
            </form>
          )}>
          {dayList.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">ยังไม่มีกะในวันนี้</p>
          ) : (
            <div className="space-y-5">
              {groupByShift(dayList).map(([i, items]) => (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${pal(i).chip}`}>{i >= 0 ? shiftPresets[i].name : 'เวลาพิเศษ'}</span>
                    <span className="text-xs text-slate-400">{items.length} คน</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {items.sort((a, b) => (a.profiles?.role || '').localeCompare(b.profiles?.role || '')).map(s => scheduleRow(s, true))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Bulk add modal */}
      {isBulkOpen && (
        <Modal title="เพิ่มกะหลายวัน" subtitle={`ลงให้พนักงาน 1 คนใน ${selectedDays.length} วันที่เลือก`} onClose={() => setIsBulkOpen(false)}>
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            {formError && <div className="p-2.5 bg-rose-50 text-rose-600 text-sm rounded-xl">{formError}</div>}
            {shiftFields(false)}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setIsBulkOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-600 font-medium rounded-xl text-sm cursor-pointer">ยกเลิก</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer">
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} />เพิ่มกะ {selectedDays.length} วัน</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Shift settings modal */}
      {isShiftSettingOpen && (
        <Modal title="ตั้งค่ากะ" subtitle="ตั้งเวลาแต่ละกะ และแยกเวลาตามตำแหน่งได้ · บันทึกให้อัตโนมัติ" onClose={() => setIsShiftSettingOpen(false)}
          footer={
            <div className="flex gap-2">
              <button onClick={addShift} className={btnGhost}><Plus size={16} />เพิ่มกะ</button>
              <button onClick={() => setIsShiftSettingOpen(false)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm cursor-pointer">เสร็จสิ้น</button>
            </div>}>
          <div className="space-y-4">
            {shiftPresets.map((p, i) => (
              <div key={p.id} className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><span className={`w-2.5 h-2.5 rounded-full ${pal(i).dot}`} />กะที่ {i + 1}</span>
                  {shiftPresets.length > 1 && <button onClick={() => removeShift(p.id)} aria-label="ลบกะ" className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"><Trash2 size={15} /></button>}
                </div>
                <Field label="ชื่อกะ"><input type="text" value={p.name} onChange={e => handleShiftUpdate(p.id, 'name', e.target.value)} className={inputCls} /></Field>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={!!p.roleTimes} onChange={e => toggleRoleTimes(p.id, e.target.checked)} className="w-4 h-4 accent-blue-600" />
                  เวลาเข้า–ออกไม่เหมือนกันในแต่ละตำแหน่ง
                </label>
                {p.roleTimes ? (
                  <div className="space-y-2">
                    {SHIFT_ROLES.map(r => (
                      <div key={r} className="grid grid-cols-[64px_1fr_1fr] items-center gap-2">
                        <span className="text-sm font-medium text-slate-600">{ROLE_LABEL[r]}</span>
                        <input type="time" aria-label={`${ROLE_LABEL[r]} เวลาเข้า`} value={timesFor(p, r).start} onChange={e => updateRoleTime(p.id, r, 'start', e.target.value)} className={inputCls} />
                        <input type="time" aria-label={`${ROLE_LABEL[r]} เวลาออก`} value={timesFor(p, r).end} onChange={e => updateRoleTime(p.id, r, 'end', e.target.value)} className={inputCls} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="เวลาเข้า"><input type="time" value={p.start} onChange={e => handleShiftUpdate(p.id, 'start', e.target.value)} className={inputCls} /></Field>
                    <Field label="เวลาออก"><input type="time" value={p.end} onChange={e => handleShiftUpdate(p.id, 'end', e.target.value)} className={inputCls} /></Field>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Copy week modal */}
      {isCopyOpen && (
        <Modal title="คัดลอกตารางสัปดาห์" subtitle="สัปดาห์นับอาทิตย์–เสาร์ เลือกวันไหนก็ได้ในสัปดาห์นั้น" onClose={() => setIsCopyOpen(false)}
          footer={
            <div className="flex gap-2">
              <button onClick={() => setIsCopyOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-600 font-medium rounded-xl text-sm cursor-pointer">ยกเลิก</button>
              <button onClick={handleCopyWeek} disabled={isCopying} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer">
                {isCopying ? <Loader2 size={16} className="animate-spin" /> : <><Copy size={16} />คัดลอก</>}
              </button>
            </div>}>
          <div className="space-y-4">
            <div>
              <Field label="คัดลอกจากสัปดาห์ของวันที่"><input type="date" value={copyFrom} onChange={e => setCopyFrom(e.target.value)} className={inputCls} /></Field>
              <p className="text-xs text-slate-500 mt-1">{weekLabel(copyFrom)}</p>
            </div>
            <div>
              <Field label="ไปยังสัปดาห์ของวันที่"><input type="date" value={copyTo} onChange={e => setCopyTo(e.target.value)} className={inputCls} /></Field>
              <p className="text-xs text-slate-500 mt-1">{weekLabel(copyTo)}</p>
            </div>
            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3 leading-relaxed">
              คัดลอก{globalBranch === 'all' ? 'ทุกสาขา' : 'เฉพาะสาขาที่เลือก'} ตรงวันและเวลาเดิมของแต่ละคน ข้ามกะที่มีอยู่แล้วในสัปดาห์ปลายทาง และไม่คัดลอกวันลา/หยุด
            </p>
          </div>
        </Modal>
      )}

      {/* Auto schedule modal */}
      {isAutoOpen && (
        <Modal wide title={<span className="flex items-center gap-2"><Wand2 size={20} className="text-violet-600" />จัดกะอัตโนมัติ · {globalBranch === "all" ? "ทุกสาขา" : branchName(globalBranch)}</span>}
          subtitle="ตั้งช่วงวันที่ จำนวนคนต่อกะ และวันว่างของพนักงาน แล้วให้ระบบสุ่มจัดให้" onClose={() => setIsAutoOpen(false)}
          footer={
            <div className="flex gap-2">
              <button onClick={() => setIsAutoOpen(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-medium rounded-xl cursor-pointer">ยกเลิก</button>
              <button onClick={handleRunAutoSchedule} disabled={isAutoGenerating} className="flex-[2] py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl flex justify-center items-center gap-2 cursor-pointer">
                {isAutoGenerating ? <Loader2 size={18} className="animate-spin" /> : <><Wand2 size={18} />จัดตาราง</>}
              </button>
            </div>}>
          <div className="space-y-6">
            <section>
              <h4 className="font-semibold text-slate-800 mb-2">1. ช่วงวันที่</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ตั้งแต่"><input type="date" value={aiDateRange.start} onChange={e => setAiDateRange({ ...aiDateRange, start: e.target.value })} className={inputCls} /></Field>
                <Field label="ถึง"><input type="date" value={aiDateRange.end} onChange={e => setAiDateRange({ ...aiDateRange, end: e.target.value })} className={inputCls} /></Field>
              </div>
            </section>

            <section>
              <h4 className="font-semibold text-slate-800 mb-2">2. จำนวนคนต่อกะ (ต่อสาขา)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {shiftPresets.map((p, i) => (
                  <div key={p.id} className="p-3 rounded-2xl border border-slate-200">
                    <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${pal(i).dot}`} />{p.name} <span className="font-normal text-slate-400">{p.roleTimes ? 'เวลาต่างตามตำแหน่ง' : `${p.start}–${p.end}`}</span></p>
                    <div className="grid grid-cols-3 gap-2">
                      {[['kitchen', 'แม่ครัว'], ['rider', 'ไรเดอร์'], ['admin', 'แอดมิน']].map(([r, label]) => (
                        <Field key={r} label={label}><input type="number" min="0" value={quotas[p.id]?.[r] || 0} onChange={e => handleQuota(p.id, r, e.target.value)} className={`${inputCls} text-center`} /></Field>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h4 className="font-semibold text-slate-800 mb-2">3. วันที่พนักงานว่าง <span className="font-normal text-sm text-slate-400">(แตะกะที่ลงได้ในแต่ละวัน)</span></h4>
              <div className="flex gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="ค้นหาชื่อพนักงาน" value={aiSearchText} onChange={e => setAiSearchText(e.target.value)} className={`${inputCls} pl-9`} />
                </div>
                <select value={aiFilterRole} onChange={e => setAiFilterRole(e.target.value)} className={`${inputCls} !w-auto`}>
                  <option value="all">ทุกตำแหน่ง</option><option value="kitchen">แม่ครัว</option><option value="rider">ไรเดอร์</option><option value="admin">แอดมิน</option>
                </select>
              </div>
              {filteredAiUsers.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 rounded-2xl">ไม่พบพนักงานตามที่ค้นหา</div>
              ) : filteredAiUsers.map(u => {
                const allOn = DAYS.every((_, d) => shiftPresets.every(s => autoAvailabilities[`${u.id}-${d}-${s.id}`]));
                return (
                  <div key={u.id} className="mb-3 border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">{u.username} <span className="text-xs font-normal text-slate-400">{ROLE_LABEL[u.role] || u.role}</span></span>
                      <button onClick={() => setAllAvail(u.id, !allOn)} className="text-xs font-medium text-violet-600 hover:underline cursor-pointer">{allOn ? 'ล้างทั้งหมด' : 'เลือกทุกวัน'}</button>
                    </div>
                    <div className="grid grid-cols-7 divide-x divide-slate-100">
                      {DAYS.map((dn, d) => (
                        <div key={d} className="p-1 md:p-2 flex flex-col items-center gap-1">
                          <span className={`text-[11px] font-semibold ${d === 0 || d === 6 ? 'text-rose-500' : 'text-slate-500'}`}>{dn}</span>
                          {shiftPresets.map((s, i) => {
                            const on = !!autoAvailabilities[`${u.id}-${d}-${s.id}`];
                            return <button key={s.id} type="button" onClick={() => toggleAvail(u.id, d, s.id)} aria-pressed={on} title={s.name}
                              className={`w-full py-1 rounded text-[10px] md:text-xs font-medium border cursor-pointer ${on ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>{s.name.replace('กะ', '') || i + 1}</button>;
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        </Modal>
      )}

      {/* Confirm dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-3 ${confirmDialog.type === 'danger' ? 'bg-rose-100' : 'bg-blue-100'}`}>
              {confirmDialog.type === 'danger' ? <AlertTriangle className="h-7 w-7 text-rose-600" /> : <Info className="h-7 w-7 text-blue-600" />}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1.5">{confirmDialog.title}</h3>
            <p className="text-slate-500 text-sm mb-5 whitespace-pre-line leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-2">
              <button onClick={closeConfirm} className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-medium rounded-xl cursor-pointer">ยกเลิก</button>
              <button onClick={confirmDialog.onConfirm} className={`flex-1 py-2.5 text-white font-semibold rounded-xl cursor-pointer ${confirmDialog.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmDialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div role="status" className={`fixed top-5 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok ? 'bg-emerald-600' : 'bg-rose-600'}`}>{toast.msg}</div>
      )}
    </div>
  );
}