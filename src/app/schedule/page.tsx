'use client'
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Calendar, Edit, Trash2, Plus, Loader2, X, Save, Clock } from "lucide-react";

// --- 🌟 Interfaces (No Any) ---
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
  work_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userRole, setUserRole] = useState<string>("rider");
  const [loading, setLoading] = useState<boolean>(true);

  // --- Modal States ---
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>("");
  const [formData, setFormData] = useState<FormData>({
    user_id: "",
    work_date: new Date().toISOString().split('T')[0], // ค่าเริ่มต้นเป็นวันนี้
    start_time: "08:00",
    end_time: "17:00",
    status: "ทำงาน"
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async (): Promise<void> => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      window.location.href = "/login";
      return;
    }

    // 1. เช็คสิทธิ์คนล็อกอิน
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile) setUserRole(profile.role);

    // 2. ดึงตารางงาน
    const { data: scheduleData } = await supabase
      .from('work_schedules')
      .select('*, profiles (username, role)')
      .order('work_date', { ascending: true });

    if (scheduleData) setSchedules(scheduleData as unknown as Schedule[]);

    // 3. ถ้าเป็น Superadmin ให้ดึงรายชื่อพนักงานมาเตรียมไว้ใน Dropdown ด้วย
    if (profile?.role === 'superadmin') {
      const { data: usersData } = await supabase.from('profiles').select('id, username, role');
      if (usersData) setUsers(usersData as UserOption[]);
    }
    
    setLoading(false);
  };

  // --- Functions สำหรับจัดการ Form ---
  const handleOpenModal = (schedule?: Schedule): void => {
    setFormError("");
    if (schedule) {
      // เปิดเพื่อ "แก้ไข"
      setEditingId(schedule.id);
      setFormData({
        user_id: schedule.user_id,
        work_date: schedule.work_date,
        start_time: schedule.start_time.substring(0, 5), // ตัดวินาทีออก ให้เหลือแค่ HH:mm
        end_time: schedule.end_time.substring(0, 5),
        status: schedule.status
      });
    } else {
      // เปิดเพื่อ "เพิ่มใหม่"
      setEditingId(null);
      setFormData({
        user_id: users.length > 0 ? users[0].id : "",
        work_date: new Date().toISOString().split('T')[0],
        start_time: "08:00",
        end_time: "17:00",
        status: "ทำงาน"
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = (): void => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    setFormData((prev: FormData) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormError("");

    if (!formData.user_id) {
      setFormError("กรุณาเลือกพนักงาน");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingId) {
        // อัปเดตข้อมูลเดิม
        const { error } = await supabase.from('work_schedules').update(formData).eq('id', editingId);
        if (error) throw error;
      } else {
        // เพิ่มข้อมูลใหม่
        const { error } = await supabase.from('work_schedules').insert([formData]);
        if (error) throw error;
      }
      
      // บันทึกเสร็จให้โหลดข้อมูลใหม่และปิด Modal
      await fetchSchedules();
      handleCloseModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm("คุณแน่ใจหรือไม่ที่จะลบตารางงานนี้?")) return;

    try {
      const { error } = await supabase.from('work_schedules').delete().eq('id', id);
      if (error) throw error;
      setSchedules((prev: Schedule[]) => prev.filter(s => s.id !== id));
    } catch (err: unknown) {
      alert("ลบข้อมูลไม่สำเร็จ: " + (err instanceof Error ? err.message : ""));
    }
  };

  // --- UI ---
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h1 className="text-2xl font-black flex items-center gap-2 text-gray-800">
          <Calendar className="text-blue-600" /> ระบบจัดตารางงาน
        </h1>
        
        {userRole === 'superadmin' && (
          <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all shadow-md shadow-blue-200 active:scale-95 cursor-pointer text-sm">
            <Plus size={18} /> จัดกะใหม่
          </button>
        )}
      </div>

      {schedules.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
           <Clock size={48} className="mx-auto text-gray-300 mb-4" />
           <p className="text-gray-500 font-medium">ยังไม่มีตารางงานในระบบ</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {schedules.map((schedule: Schedule) => (
            <div key={schedule.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center transition-all hover:shadow-md hover:border-blue-100 group">
              <div className="space-y-1.5">
                {(userRole === 'admin' || userRole === 'superadmin') && (
                  <p className="font-black text-slate-800 text-lg flex items-center gap-2">
                    {schedule.profiles?.username || 'ไม่มีชื่อ'} 
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest ${
                      schedule.profiles?.role === 'kitchen' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {schedule.profiles?.role}
                    </span>
                  </p>
                )}
                
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-400"/> 
                    {new Date(schedule.work_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <span className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 flex items-center gap-1.5">
                    <Clock size={14} className="text-slate-400"/> 
                    {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)} น.
                  </span>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                    schedule.status === 'ทำงาน' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                    schedule.status === 'ลา' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}>
                    {schedule.status}
                  </span>
                </div>
              </div>

              {userRole === 'superadmin' && (
                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(schedule)} className="p-2.5 text-blue-400 hover:text-white hover:bg-blue-500 bg-blue-50 rounded-xl transition-all cursor-pointer shadow-sm">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => handleDelete(schedule.id)} className="p-2.5 text-rose-400 hover:text-white hover:bg-rose-500 bg-rose-50 rounded-xl transition-all cursor-pointer shadow-sm">
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* --- Modal Form --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="font-black text-xl flex items-center gap-2 text-slate-800">
                {editingId ? "แก้ไขตารางงาน" : "จัดกะทำงานใหม่"}
              </h3>
              <button onClick={handleCloseModal} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-colors"><X size={20}/></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-rose-50 text-rose-600 text-sm font-bold rounded-xl">{formError}</div>}
              
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">พนักงาน</label>
                <select name="user_id" value={formData.user_id} onChange={handleChange} required className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-slate-700 bg-slate-50">
                  <option value="" disabled>-- เลือกพนักงาน --</option>
                  {users.map((u: UserOption) => (
                    <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">วันที่ทำงาน</label>
                <input type="date" name="work_date" value={formData.work_date} onChange={handleChange} required className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-slate-700 bg-slate-50" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">เวลาเริ่มงาน</label>
                  <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} required className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-slate-700 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">เวลาเลิกงาน</label>
                  <input type="time" name="end_time" value={formData.end_time} onChange={handleChange} required className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-slate-700 bg-slate-50" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">สถานะ</label>
                <select name="status" value={formData.status} onChange={handleChange} required className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-slate-700 bg-slate-50">
                  <option value="ทำงาน">🟢 ทำงาน</option>
                  <option value="ลา">🟠 ลา</option>
                  <option value="หยุด">🔴 หยุด</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all cursor-pointer text-sm">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all shadow-md active:scale-95 cursor-pointer text-sm flex justify-center items-center gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> บันทึกข้อมูล</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}