'use client'
import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Calendar as CalendarIcon, Edit, Trash2, Plus, Loader2, X, 
  ChevronLeft, ChevronRight, Clock, Copy, ShieldCheck, AlertTriangle, Info, Wand2, Users, Check
} from "lucide-react";

// --- 🌟 Interfaces (No Any 100%) ---
interface ProfileInfo {
  username: string;
  role: string;
}

interface Schedule {
  id: string;
  user_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  profiles?: ProfileInfo;
}

interface UserOption {
  id: string;
  username: string;
  role: string;
}

interface FormData {
  user_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'danger' | 'info';
  confirmText: string;
}

interface ShiftPreset {
  id: string;
  name: string;
  start: string;
  end: string;
}

interface RoleQuota {
  [role: string]: number;
}

interface QuotaConfig {
  [shiftId: string]: RoleQuota;
}

interface NewSchedulePayload {
  user_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

const getLocalFormattedDate = (year: number, month: number, day: number): string => {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userRole, setUserRole] = useState<string>("rider");
  const [loading, setLoading] = useState<boolean>(true);
  const [isCopying, setIsCopying] = useState<boolean>(false);

  const [filterRole, setFilterRole] = useState<string>("all");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>("");
  const [selectedShiftPreset, setSelectedShiftPreset] = useState<string>("morning");
  
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false, title: "", message: "", onConfirm: () => {}, type: 'danger', confirmText: "ตกลง"
  });
  
  // --- 🪄 AI Auto Schedule Config States ---
  const [isAutoModalOpen, setIsAutoModalOpen] = useState<boolean>(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState<boolean>(false);
  
  const [autoAvailabilities, setAutoAvailabilities] = useState<Record<string, boolean>>({});
  const [shiftPresets, setShiftPresets] = useState<ShiftPreset[]>([
    { id: "morning", name: "กะเช้า", start: "10:00", end: "19:00" },
    { id: "evening", name: "กะค่ำ", start: "17:00", end: "02:00" }
  ]);
  const [quotas, setQuotas] = useState<QuotaConfig>({
    morning: { kitchen: 2, rider: 2, admin: 1 },
    evening: { kitchen: 2, rider: 3, admin: 1 }
  });

  const [formData, setFormData] = useState<FormData>({
    user_id: "", start_time: "10:00", end_time: "19:00", status: "ทำงาน"
  });

  // --- 🌟 ดึงค่า AI Setting จาก Local Storage (จำค่าถาวร) ---
  useEffect(() => {
    try {
      const savedAvail = localStorage.getItem('ai_availabilities');
      if (savedAvail) setAutoAvailabilities(JSON.parse(savedAvail));

      const savedQuotas = localStorage.getItem('ai_quotas');
      if (savedQuotas) setQuotas(JSON.parse(savedQuotas));

      const savedShifts = localStorage.getItem('ai_shifts');
      if (savedShifts) setShiftPresets(JSON.parse(savedShifts));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      console.error("Failed to parse AI settings from local storage");
    }
  }, []);

  // --- 🌟 เซฟค่า AI Setting ลง Local Storage เมื่อมีการเปลี่ยนแปลง ---
  useEffect(() => { localStorage.setItem('ai_availabilities', JSON.stringify(autoAvailabilities)); }, [autoAvailabilities]);
  useEffect(() => { localStorage.setItem('ai_quotas', JSON.stringify(quotas)); }, [quotas]);
  useEffect(() => { localStorage.setItem('ai_shifts', JSON.stringify(shiftPresets)); }, [shiftPresets]);

  useEffect(() => {
    fetchData();
    setSelectedDays([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]); 

  const fetchData = async (): Promise<void> => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/login"; return; }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile) setUserRole(profile.role);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const startOfMonth = getLocalFormattedDate(year, month, 1);
    const endOfMonth = getLocalFormattedDate(year, month, daysInMonth);

    const { data: scheduleData } = await supabase
      .from('work_schedules')
      .select('*, profiles (username, role)')
      .gte('work_date', startOfMonth)
      .lte('work_date', endOfMonth)
      .order('start_time', { ascending: true });

    if (scheduleData) setSchedules(scheduleData as unknown as Schedule[]);

    if (profile?.role === 'superadmin') {
      const { data: usersData } = await supabase.from('profiles').select('id, username, role');
      if (usersData) {
        setUsers(usersData as UserOption[]);
        if (usersData.length > 0 && !formData.user_id) setFormData(prev => ({ ...prev, user_id: usersData[0].id }));
      }
    }
    
    setLoading(false);
  };

  const detectShiftName = (start: string, end: string): string => {
  // มั่นใจว่าข้อมูลที่เทียบคือ 24 ชั่วโมงเสมอ
  const s = start.substring(0, 5); 
  const e = end.substring(0, 5);
  const found = shiftPresets.find(p => p.start === s && p.end === e);
  return found ? found.name : "กะพิเศษ";
};

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: (string | null)[] = Array(firstDay).fill(null); 
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(getLocalFormattedDate(year, month, i));
    }
    return days;
  }, [currentDate]);

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setFormError("");
    setEditingId(null);
    setSelectedShiftPreset("morning");
    setFormData(prev => ({ ...prev, start_time: shiftPresets[0].start, end_time: shiftPresets[0].end, status: "ทำงาน" }));
  };

  const toggleDaySelection = (e: React.MouseEvent, dateStr: string) => {
    e.stopPropagation(); 
    if (userRole !== 'superadmin') return;
    setSelectedDays(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleEditClick = (schedule: Schedule) => {
    setEditingId(schedule.id);
    const sTime = schedule.start_time.substring(0, 5);
    const eTime = schedule.end_time.substring(0, 5);
    const matchedPreset = shiftPresets.find(p => p.start === sTime && p.end === eTime);
    setSelectedShiftPreset(matchedPreset ? matchedPreset.id : "custom");
    setFormData({ user_id: schedule.user_id, start_time: sTime, end_time: eTime, status: schedule.status });
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleShiftPresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetId = e.target.value;
    setSelectedShiftPreset(presetId);
    if (presetId !== "custom") {
      const preset = shiftPresets.find(p => p.id === presetId);
      if (preset) setFormData(prev => ({ ...prev, start_time: preset.start, end_time: preset.end }));
    }
  };

  const handleTimeChange = (type: 'start_time' | 'end_time', part: 'hour' | 'minute', value: string) => {
    setSelectedShiftPreset("custom");
    setFormData(prev => {
      const [currentHour, currentMinute] = prev[type].split(':');
      const newTime = part === 'hour' ? `${value}:${currentMinute}` : `${currentHour}:${value}`;
      return { ...prev, [type]: newTime };
    });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedDate) return;
    setFormError("");
    setIsSubmitting(true);

    try {
      const payload = { ...formData, work_date: selectedDate };
      if (editingId) {
        const { error } = await supabase.from('work_schedules').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('work_schedules').insert([payload]);
        if (error) throw error;
      }
      
      await fetchData();
      setEditingId(null);
      setSelectedShiftPreset("morning");
      setFormData(prev => ({ ...prev, start_time: shiftPresets[0].start, end_time: shiftPresets[0].end })); 
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const newSchedules: NewSchedulePayload[] = [];
      for (const dateStr of selectedDays) {
        const isExist = schedules.some(s => s.user_id === formData.user_id && s.work_date === dateStr && s.start_time.substring(0, 5) === formData.start_time);
        if (!isExist) {
          newSchedules.push({ ...formData, work_date: dateStr });
        }
      }

      if (newSchedules.length > 0) {
        const { error } = await supabase.from('work_schedules').insert(newSchedules);
        if (error) throw error;
      }

      alert(`✅ เพิ่มกะเรียบร้อย สำเร็จ ${newSchedules.length} วัน`);
      await fetchData();
      setIsBulkModalOpen(false);
      setSelectedDays([]);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkDelete = () => {
    setConfirmDialog({
      isOpen: true, title: "ยืนยันการล้างกะทั้งหมด", message: `คุณต้องการลบตารางงานของทุกคน\nใน ${selectedDays.length} วันที่เลือกไว้ ใช่หรือไม่?`, type: 'danger', confirmText: "ล้างตาราง",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          const { error } = await supabase.from('work_schedules').delete().in('work_date', selectedDays);
          if (error) throw error;
          await fetchData();
          setSelectedDays([]);
        } catch (err: unknown) { alert("ลบไม่สำเร็จ: " + (err instanceof Error ? err.message : "")); }
      }
    });
  };

  const handleDeleteClick = (id: string) => {
    setConfirmDialog({
      isOpen: true, title: "ยืนยันการลบกะทำงาน", message: "คุณต้องการลบตารางงานช่วงเวลานี้ใช่หรือไม่?", type: 'danger', confirmText: "ลบทิ้ง",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          const { error } = await supabase.from('work_schedules').delete().eq('id', id);
          if (error) throw error;
          setSchedules(prev => prev.filter(s => s.id !== id));
        } catch (err: unknown) { alert("ลบไม่สำเร็จ: " + (err instanceof Error ? err.message : "")); }
      }
    });
  };

  // --- 🪄 AI Config Logic ---
  const toggleAutoAvailability = (userId: string, dayIdx: number, shiftId: string) => {
    const key = `${userId}-${dayIdx}-${shiftId}`;
    setAutoAvailabilities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleQuotaChange = (shiftId: string, role: string, value: string) => {
    setQuotas(prev => ({ ...prev, [shiftId]: { ...prev[shiftId], [role]: parseInt(value) || 0 } }));
  };

  const handleShiftTimeUpdate = (shiftId: string, type: 'start' | 'end', value: string) => {
    setShiftPresets(prev => prev.map(p => p.id === shiftId ? { ...p, [type]: value } : p));
  };

  const handleRunAutoSchedule = async (): Promise<void> => {
    setConfirmDialog({
      isOpen: true,
      title: "🤖 เริ่มให้ AI จัดกะ?",
      message: "AI จะกระจายพนักงานลงกะตามโควต้าและวันว่างที่ตั้งไว้\nหากวันไหนไม่มีพนักงานว่าง ระบบจะปล่อยช่องนั้นว่างไว้",
      type: 'info',
      confirmText: "เริ่มจัดตาราง",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsAutoGenerating(true);

        try {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const newSchedules: NewSchedulePayload[] = [];

          for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = getLocalFormattedDate(year, month, i);
            const dayOfWeek = new Date(year, month, i).getDay(); 

            for (const shift of shiftPresets) {
              for (const role of ['kitchen', 'rider', 'admin']) {
                const requiredQuota = quotas[shift.id]?.[role] || 0;
                if (requiredQuota === 0) continue;

                const availableUsers = users.filter(u => u.role === role && autoAvailabilities[`${u.id}-${dayOfWeek}-${shift.id}`]);
                const shuffledUsers = availableUsers.sort(() => 0.5 - Math.random());
                
                let assignedCount = 0;
                for (const user of shuffledUsers) {
                  if (assignedCount >= requiredQuota) break; 
                  const isExist = schedules.some(s => s.user_id === user.id && s.work_date === dateStr && s.start_time.substring(0, 5) === shift.start);
                  const isQueued = newSchedules.some(s => s.user_id === user.id && s.work_date === dateStr && s.start_time === shift.start);
                  
                  if (!isExist && !isQueued) {
                    newSchedules.push({
                      user_id: user.id,
                      work_date: dateStr,
                      start_time: shift.start,
                      end_time: shift.end,
                      status: "ทำงาน"
                    });
                    assignedCount++;
                  }
                }
              }
            }
          }

          if (newSchedules.length === 0) {
            alert("ไม่สามารถจัดตารางเพิ่มได้ครับ (ไม่มีคิวว่าง หรือจัดครบแล้ว)");
            setIsAutoGenerating(false);
            return;
          }

          const { error } = await supabase.from('work_schedules').insert(newSchedules);
          if (error) throw error;

          alert(`✨ AI จัดตารางเรียบร้อย ได้พนักงานลงกะเพิ่ม ${newSchedules.length} คิวงานครับ!`);
          setIsAutoModalOpen(false);
          fetchData();
        } catch (err: unknown) {
          alert("เกิดข้อผิดพลาด: " + (err instanceof Error ? err.message : ""));
        } finally {
          setIsAutoGenerating(false);
        }
      }
    });
  };

  const handleCopyPrevMonthClick = () => {
    setConfirmDialog({
      isOpen: true,
      title: "คัดลอกข้อมูลแบบรายวัน?",
      message: "ระบบจะคัดลอกกะการทำงานจากวันที่ 1->1, 2->2 ตามลำดับ\n(ข้อควรระวัง: วันในสัปดาห์จะเลื่อนตามปฏิทิน แนะนำให้ใช้ AI จัดตารางดีกว่าครับ)",
      type: 'info',
      confirmText: "เข้าใจแล้ว คัดลอกเลย",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsCopying(true);
        try {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const prevMonth = month === 0 ? 11 : month - 1;
          const prevYear = month === 0 ? year - 1 : year;
          const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
          const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

          const prevMonthStart = getLocalFormattedDate(prevYear, prevMonth, 1);
          const prevMonthEnd = getLocalFormattedDate(prevYear, prevMonth, daysInPrevMonth);

          const { data: prevSchedules } = await supabase.from('work_schedules').select('*').gte('work_date', prevMonthStart).lte('work_date', prevMonthEnd);

          if (!prevSchedules || prevSchedules.length === 0) { alert("ไม่มีข้อมูลให้ดึงครับ"); return; }

          const newSchedules: NewSchedulePayload[] = [];
          prevSchedules.forEach((s: Schedule) => {
            const dayNum = parseInt(s.work_date.split('-')[2], 10);
            if (dayNum <= daysInCurrentMonth) {
              newSchedules.push({
                user_id: s.user_id,
                work_date: getLocalFormattedDate(year, month, dayNum),
                start_time: s.start_time,
                end_time: s.end_time,
                status: s.status
              });
            }
          });

          if(newSchedules.length > 0) {
            const { error } = await supabase.from('work_schedules').insert(newSchedules);
            if (error) throw error;
          }
          fetchData();
        } catch (err: unknown) {
          alert("ดึงข้อมูลไม่สำเร็จ: " + (err instanceof Error ? err.message : ""));
        } finally { setIsCopying(false); }
      }
    });
  };

  const pageTitle = (userRole === 'admin' || userRole === 'superadmin') ? "ระบบจัดตารางงาน" : "ตารางงาน";
  const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const dayNamesShort = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  
  // 🌟 สร้าง 00 - 59 สำหรับเวลา 24 ชม.
  const hoursOptions = Array.from({length: 24}).map((_, i) => i.toString().padStart(2, '0'));
  const minutesOptions = Array.from({length: 60}).map((_, i) => i.toString().padStart(2, '0'));

  if (loading && schedules.length === 0) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-slate-50/50 relative pb-24">
      
      {/* --- Header --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
        <h1 className="text-2xl font-black flex items-center gap-3 text-slate-800">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><CalendarIcon size={24} /></div>
          {pageTitle}
        </h1>
        <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
          <button onClick={handlePrevMonth} className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"><ChevronLeft size={20}/></button>
          <div className="text-lg font-bold text-slate-700 min-w-37.5 text-center">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear() + 543}</div>
          <button onClick={handleNextMonth} className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"><ChevronRight size={20}/></button>
        </div>
      </div>

      {/* --- 🌟 ฟิลเตอร์กรองตำแหน่ง & ปุ่ม AI --- */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
          <span className="text-xs font-black text-slate-400 uppercase mr-2"><Users size={14} className="inline mr-1"/> ตัวกรอง:</span>
          {['all', 'kitchen', 'rider', 'admin'].map(role => (
            <button 
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filterRole === role ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {role === 'all' ? 'ทั้งหมด' : role === 'kitchen' ? '🍳 แม่ครัว' : role === 'rider' ? '🛵 ไรเดอร์' : '🌟 แอดมิน'}
            </button>
          ))}
        </div>

        {userRole === 'superadmin' && (
          <div className="flex gap-2 w-full md:w-auto">
            {schedules.length === 0 && (
              <button onClick={handleCopyPrevMonthClick} disabled={isCopying} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all shadow-sm active:scale-95 text-xs cursor-pointer">
                {isCopying ? <Loader2 className="animate-spin" size={16}/> : <Copy size={16} />} ใช้ข้อมูลเดือนที่แล้ว
              </button>
            )}
            <button onClick={() => setIsAutoModalOpen(true)} className="flex-1 md:flex-none bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-md active:scale-95 text-xs cursor-pointer">
              <Wand2 size={16} /> เทรน AI อัตโนมัติ
            </button>
          </div>
        )}
      </div>

      {/* --- Calendar View Table --- */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
          {dayNamesShort.map((day, i) => (
            <div key={i} className={`p-3 md:p-4 text-center text-xs md:text-sm font-black uppercase ${i === 0 || i === 6 ? 'text-rose-500' : 'text-slate-500'}`}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[120px] md:auto-rows-[160px]">
          {calendarDays.map((dateStr, idx) => {
            if (!dateStr) return <div key={`empty-${idx}`} className="border-b border-r border-slate-50 bg-slate-50/30"></div>;
            const dayNum = parseInt(dateStr.split('-')[2]);
            const isToday = dateStr === getLocalFormattedDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
            const isSelected = selectedDays.includes(dateStr);

            const daySchedules = schedules.filter(s => 
              s.work_date === dateStr && (filterRole === 'all' || s.profiles?.role === filterRole)
            );

            return (
              <div key={dateStr} onClick={() => handleDayClick(dateStr)} className={`border-b border-r border-slate-100 p-1.5 md:p-3 relative group transition-all cursor-pointer ${isToday ? 'bg-blue-50/30' : 'hover:bg-blue-50/50'} ${isSelected ? 'bg-violet-50/50 ring-inset ring-2 ring-violet-200' : ''}`}>
                
                <div className={`text-right text-xs md:text-sm mb-2 flex justify-end`}>
                  <button 
                    onClick={(e) => toggleDaySelection(e, dateStr)}
                    disabled={userRole !== 'superadmin'}
                    className={`w-7 h-7 md:w-8 md:h-8 rounded-xl flex items-center justify-center font-bold transition-all ${
                      isSelected ? 'bg-violet-600 text-white shadow-md ring-2 ring-violet-200 scale-110' : 
                      isToday ? 'bg-blue-100 text-blue-600' : 
                      userRole === 'superadmin' ? 'text-slate-400 hover:bg-slate-100 cursor-pointer' : 'text-slate-400 cursor-default'
                    }`}
                  >
                    {dayNum}
                  </button>
                </div>
                
                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-17.5 md:max-h-25 scrollbar-hide">
                  {daySchedules.map(s => {
                    const sName = detectShiftName(s.start_time, s.end_time);
                    const bgClass = sName === 'กะเช้า' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                    sName === 'กะค่ำ' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-700 border-slate-200';
                    return (
                      <div key={s.id} className={`text-[9px] md:text-xs px-1.5 md:px-2 py-1 rounded font-bold flex flex-col border truncate ${bgClass}`}>
                        <span className="truncate">[{sName}] {s.profiles?.username || 'พนักงาน'}</span>
                        <span className="opacity-70 text-[9px] mt-0.5 font-mono">
                            {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)} น.
                        </span>                      
                      </div>
                    );
                  })}
                </div>
                
                {userRole === 'superadmin' && !isSelected && (
                  <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"><div className="bg-white text-blue-500 rounded-md p-1 shadow-sm border border-slate-100"><Plus size={14}/></div></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- 🌟 แถบเครื่องมือจัดการหลายวัน (Bulk Action Floating Bar) --- */}
      {selectedDays.length > 0 && userRole === 'superadmin' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300 w-[90%] max-w-lg">
          <div className="bg-slate-800 text-white rounded-full shadow-2xl p-2.5 flex items-center justify-between border border-slate-700 ring-4 ring-slate-800/20">
             <div className="flex items-center gap-3 pl-4">
                <div className="bg-violet-500 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs">{selectedDays.length}</div>
                <span className="font-bold text-sm hidden sm:inline">วันที่เลือก</span>
             </div>
             <div className="flex gap-2">
                <button onClick={() => setIsBulkModalOpen(true)} className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer"><Plus size={14}/> เพิ่มกะ</button>
                <button onClick={handleBulkDelete} className="bg-rose-500 hover:bg-rose-400 text-white px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer"><Trash2 size={14}/> ล้างข้อมูล</button>
                <button onClick={() => setSelectedDays([])} className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 rounded-full text-xs font-bold transition-all cursor-pointer"><X size={14}/></button>
             </div>
          </div>
        </div>
      )}

      {/* --- 🌟 Bulk Manage Modal (เพิ่มกะลงหลายวัน) --- */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="font-black text-xl text-slate-800">จัดการหลายวันพร้อมกัน</h3>
              <p className="text-sm font-bold text-blue-600 mt-1">จะเพิ่มกะนี้ลงใน {selectedDays.length} วันที่คุณเลือกไว้</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleBulkSubmit} className="space-y-4">
                {formError && <div className="p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{formError}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">เลือกพนักงาน</label>
                    <select name="user_id" value={formData.user_id} onChange={handleFormChange} required className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none cursor-pointer">
                      {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">เลือกช่วงกะเวลา</label>
                    <select value={selectedShiftPreset} onChange={handleShiftPresetChange} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-blue-600 bg-blue-50/50 outline-none cursor-pointer">
                      {shiftPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value="custom">⏱️ กำหนดเอง</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-4 border-t border-slate-100 mt-4">
                  <button type="button" onClick={() => setIsBulkModalOpen(false)} className="px-5 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm cursor-pointer">ยกเลิก</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer">
                    {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <><Check size={16}/> บันทึกลงทั้ง {selectedDays.length} วัน</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- 🌟 Day Popup Management Modal --- */}
      {selectedDate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-black text-xl text-slate-800">ตารางประจำวัน</h3>
                <p className="text-sm font-bold text-blue-600 mt-1">วันที่ {new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-slate-200 text-slate-400 rounded-full transition-colors cursor-pointer"><X size={20}/></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-slate-50/50">
              {schedules.filter(s => s.work_date === selectedDate).length === 0 ? (
                 <p className="text-center text-slate-400 font-medium py-6 text-sm">ไม่มีกะเวลางานบันทึกไว้ในวันนี้</p>
              ) : (
                schedules.filter(s => s.work_date === selectedDate).map(schedule => (
                  <div key={schedule.id} className={`bg-white p-4 rounded-2xl border shadow-sm flex justify-between items-center transition-all ${editingId === schedule.id ? 'border-blue-400 ring-2 ring-blue-100 scale-[1.01]' : 'border-slate-100'}`}>
                    <div>
                      <p className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                        {schedule.profiles?.username || 'พนักงาน'}
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-wider font-bold">{schedule.profiles?.role}</span>
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs font-bold text-slate-500">
                        <span className="flex items-center gap-1">
  <Clock size={12}/> 
  ({detectShiftName(schedule.start_time, schedule.end_time)}) 
  {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)} น.
</span>
                        <span className={`${schedule.status === 'ทำงาน' ? 'text-emerald-500' : 'text-rose-500'}`}>{schedule.status}</span>
                      </div>
                    </div>
                    {userRole === 'superadmin' && (
                      <div className="flex gap-1">
                        <button onClick={() => handleEditClick(schedule)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"><Edit size={16}/></button>
                        <button onClick={() => handleDeleteClick(schedule.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"><Trash2 size={16}/></button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {userRole === 'superadmin' && (
              <div className="p-6 border-t border-slate-100 bg-white">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && <div className="p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{formError}</div>}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">เลือกพนักงาน</label>
                      <select name="user_id" value={formData.user_id} onChange={handleFormChange} required className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none cursor-pointer">
                        {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">เลือกช่วงกะเวลา</label>
                      <select value={selectedShiftPreset} onChange={handleShiftPresetChange} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-blue-600 bg-blue-50/50 outline-none cursor-pointer">
                        {shiftPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        <option value="custom">⏱️ กำหนดเอง</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">สถานะ</label>
                      <select name="status" value={formData.status} onChange={handleFormChange} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none cursor-pointer">
                        <option value="ทำงาน">🟢 ทำงาน</option>
                        <option value="ลา">🟠 ลา</option>
                        <option value="หยุด">🔴 หยุด</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">เวลาเข้างาน</label>
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border">
                        <select value={formData.start_time.split(':')[0]} onChange={(e) => handleTimeChange('start_time', 'hour', e.target.value)} className="w-full p-2 text-sm font-bold text-center outline-none bg-transparent cursor-pointer">
                          {hoursOptions.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span className="font-bold text-slate-300">:</span>
                        <select value={formData.start_time.split(':')[1]} onChange={(e) => handleTimeChange('start_time', 'minute', e.target.value)} className="w-full p-2 text-sm font-bold text-center outline-none bg-transparent cursor-pointer">
                          {minutesOptions.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">เวลาเลิกงาน</label>
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border">
                        <select value={formData.end_time.split(':')[0]} onChange={(e) => handleTimeChange('end_time', 'hour', e.target.value)} className="w-full p-2 text-sm font-bold text-center outline-none bg-transparent cursor-pointer">
                          {hoursOptions.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span className="font-bold text-slate-300">:</span>
                        <select value={formData.end_time.split(':')[1]} onChange={(e) => handleTimeChange('end_time', 'minute', e.target.value)} className="w-full p-2 text-sm font-bold text-center outline-none bg-transparent cursor-pointer">
                          {minutesOptions.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {editingId && <button type="button" onClick={() => { setEditingId(null); setSelectedShiftPreset("morning"); }} className="px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm transition-all cursor-pointer">ยกเลิก</button>}
                    <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-sm shadow-md active:scale-95 flex items-center justify-center gap-2 transition-all cursor-pointer">
                      {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : (editingId ? "บันทึกการปรับปรุง" : "บันทึกลงตารางงาน")}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- 🌟 AI Auto Schedule Configuration Modal --- */}
      {isAutoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-linear-to-r from-violet-50 to-fuchsia-50">
              <div>
                <h3 className="font-black text-xl text-violet-800 flex items-center gap-2"><Wand2 size={24}/> เทรน AI จัดตารางงาน</h3>
                <p className="text-sm font-bold text-violet-600/70 mt-1">กำหนดเวลาเข้างาน โควต้า และเลือกวันว่างของพนักงานแต่ละคน</p>
              </div>
              <button onClick={() => setIsAutoModalOpen(false)} className="p-2 text-slate-400 hover:bg-white/50 rounded-full cursor-pointer"><X size={20}/></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
              
              <div className="bg-white p-5 rounded-3xl border shadow-sm">
  <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
    <Clock size={18} className="text-violet-500"/> 1. ระบุเวลาเข้า-เลิกงานของร้าน
  </h4>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {shiftPresets.map(preset => (
      <div key={preset.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
        <span className="font-black text-slate-700">{preset.name}</span>
        <div className="flex items-center gap-2">
          {/* --- เริ่มต้นกะ (Custom 24H Picker) --- */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border w-full">
            <select value={preset.start.split(':')[0]} onChange={(e) => handleShiftTimeUpdate(preset.id, 'start', `${e.target.value}:${preset.start.split(':')[1]}`)} className="w-full p-2 text-xs font-bold text-center outline-none bg-transparent cursor-pointer">
              {Array.from({length: 24}).map((_, i) => { const h = i.toString().padStart(2, '0'); return <option key={h} value={h}>{h}</option>; })}
            </select>
            <span className="font-bold text-slate-300">:</span>
            <select value={preset.start.split(':')[1]} onChange={(e) => handleShiftTimeUpdate(preset.id, 'start', `${preset.start.split(':')[0]}:${e.target.value}`)} className="w-full p-2 text-xs font-bold text-center outline-none bg-transparent cursor-pointer">
              {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)} 
            </select>
          </div>
          <span className="text-slate-400 font-bold">-</span>
          {/* --- สิ้นสุดกะ (Custom 24H Picker) --- */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border w-full">
            <select value={preset.end.split(':')[0]} onChange={(e) => handleShiftTimeUpdate(preset.id, 'end', `${e.target.value}:${preset.end.split(':')[1]}`)} className="w-full p-2 text-xs font-bold text-center outline-none bg-transparent cursor-pointer">
              {Array.from({length: 24}).map((_, i) => { const h = i.toString().padStart(2, '0'); return <option key={h} value={h}>{h}</option>; })} 
            </select>
            <span className="font-bold text-slate-300">:</span>
            <select value={preset.end.split(':')[1]} onChange={(e) => handleShiftTimeUpdate(preset.id, 'end', `${preset.end.split(':')[0]}:${e.target.value}`)}  className="w-full p-2 text-xs font-bold text-center outline-none bg-transparent cursor-pointer">
              {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)} 
            </select>
          </div>
        </div>
      </div>
    ))}
  </div>
</div>

              <div className="bg-white p-5 rounded-3xl border shadow-sm">
                <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2"><Users size={18} className="text-violet-500"/> 2. โควต้าพนักงาน (คน/กะ/วัน)</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {shiftPresets.map(preset => (
                    <div key={preset.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="block font-black text-slate-700 mb-3">{preset.name}</span>
                      <div className="flex gap-2 md:gap-4">
                        <div className="flex-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase">แม่ครัว</label>
                          <input type="number" min="0" value={quotas[preset.id]?.kitchen || 0} onChange={(e) => handleQuotaChange(preset.id, 'kitchen', e.target.value)} className="w-full p-2 rounded-lg border bg-white font-bold text-center outline-none focus:border-violet-400 mt-1"/>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase">ไรเดอร์</label>
                          <input type="number" min="0" value={quotas[preset.id]?.rider || 0} onChange={(e) => handleQuotaChange(preset.id, 'rider', e.target.value)} className="w-full p-2 rounded-lg border bg-white font-bold text-center outline-none focus:border-violet-400 mt-1"/>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase">แอดมิน</label>
                          <input type="number" min="0" value={quotas[preset.id]?.admin || 0} onChange={(e) => handleQuotaChange(preset.id, 'admin', e.target.value)} className="w-full p-2 rounded-lg border bg-white font-bold text-center outline-none focus:border-violet-400 mt-1"/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border shadow-sm">
                <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2"><CalendarIcon size={18} className="text-violet-500"/> 3. เลือกวันว่างให้พนักงาน</h4>
                {users.map(user => (
                  <div key={user.id} className="mb-4 last:mb-0 border border-slate-100 rounded-2xl overflow-hidden">
                    <div className="bg-slate-50 p-3 border-b flex justify-between items-center">
                      <span className="font-black text-slate-800">{user.username}</span>
                      <span className="text-[10px] font-black uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">{user.role}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-white">
                      {dayNamesShort.map((dayName, dayIdx) => (
                        <div key={dayIdx} className="p-2 flex flex-row sm:flex-col items-center justify-between sm:justify-start gap-2">
                          <span className={`text-xs font-black ${dayIdx === 0 || dayIdx === 6 ? 'text-rose-500' : 'text-slate-500'}`}>{dayName}</span>
                          <div className="flex sm:flex-col gap-1 w-full">
                            {shiftPresets.map(shift => {
                              const key = `${user.id}-${dayIdx}-${shift.id}`;
                              const isChecked = !!autoAvailabilities[key];
                              return (
                                <button key={shift.id} type="button" onClick={() => toggleAutoAvailability(user.id, dayIdx, shift.id)} className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-all border cursor-pointer ${isChecked ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                  {shift.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex gap-3">
              <button onClick={() => setIsAutoModalOpen(false)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl active:scale-95 cursor-pointer">ยกเลิก</button>
              <button onClick={handleRunAutoSchedule} disabled={isAutoGenerating} className="flex-2 py-3.5 bg-linear-to-r from-violet-600 to-fuchsia-600 text-white font-black rounded-xl shadow-lg active:scale-95 flex justify-center gap-2 cursor-pointer">
                {isAutoGenerating ? <Loader2 size={18} className="animate-spin"/> : <><Wand2 size={18}/> ให้ AI จัดตารางเลย!</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 🌟 Custom Beautiful Confirmation Popup --- */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 border border-slate-100">
            <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${confirmDialog.type === 'danger' ? 'bg-rose-100' : 'bg-blue-100'}`}>
              {confirmDialog.type === 'danger' ? <AlertTriangle className="h-8 w-8 text-rose-600" /> : <Info className="h-8 w-8 text-blue-600" />}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-500 text-sm mb-6 whitespace-pre-line leading-relaxed font-medium">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl active:scale-95 cursor-pointer">ยกเลิก</button>
              <button onClick={confirmDialog.onConfirm} className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg cursor-pointer ${confirmDialog.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmDialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}