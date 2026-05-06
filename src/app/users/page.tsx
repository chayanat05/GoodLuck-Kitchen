'use client'
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase'; // ระวังเรื่องพาร์ท ../ ถ้า error ให้เปลี่ยนเป็น ../../
import { 
  ChevronLeft, Users, Search, ShieldCheck, Navigation, 
  Mail, Calendar, CheckCircle2, X, AlertTriangle, Info, UserCheck, Trash2, Store
} from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  branch_id: string | null;
  last_seen: string | null;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
}

type PopupConfig = {
  isOpen: boolean;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  icon?: 'success' | 'error' | 'warning' | 'info';
};

export default function UsersManagementPage() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  
  const [popup, setPopup] = useState<PopupConfig>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showAlert = useCallback((title: string, message: string, icon: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setPopup({ isOpen: true, type: 'alert', title, message, icon });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') => {
    setPopup({ isOpen: true, type: 'confirm', title, message, onConfirm, confirmText, cancelText, icon: 'warning' });
  }, []);

  const closePopup = useCallback(() => setPopup(prev => ({ ...prev, isOpen: false })), []);

  const fetchProfilesAndBranches = useCallback(async () => {
    setLoading(true);

    // 1. โหลดข้อมูลสาขามาให้ครบ เพื่อเอาไปใส่ Dropdown
    const { data: bData } = await supabase.from('branches').select('id, name');
    if (bData) setBranches(bData);

    // 2. โหลดโปรไฟล์พนักงาน + last_seen, branch_id
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, email, role, branch_id, last_seen, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลสมาชิกได้', 'error');
    } else if (data) {
      setProfiles(data as UserProfile[]);
    }
    setLoading(false);
  }, [showAlert]);

  useEffect(() => {
    const checkAdminAndFetchUsers = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = '/login';
        return;
      }

      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (adminProfile?.role !== 'admin') {
        window.location.href = '/rider';
        return;
      }

      setCurrentUser(session.user);
      fetchProfilesAndBranches();
    };

    checkAdminAndFetchUsers();
  }, [fetchProfilesAndBranches]);

  // 🌟 ฟังก์ชันเปลี่ยนสิทธิ์ผู้ใช้งาน
  const handleRoleChange = async (userId: string, newRole: string, username: string) => {
    if (userId === currentUser?.id) {
      showAlert('ผิดพลาด', 'คุณไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้ครับ!', 'warning');
      return;
    }

    const roleNameTh = newRole === 'admin' ? 'แอดมิน (Admin)' : 'ไรเดอร์ (Rider)';

    showConfirm(
      'ยืนยันการเปลี่ยนสิทธิ์?',
      `คุณต้องการเปลี่ยนสิทธิ์ของ ${username} ให้เป็น "${roleNameTh}" ใช่หรือไม่?`,
      async () => {
        closePopup();
        const { error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId);

        if (error) {
          showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถเปลี่ยนสิทธิ์ได้: ' + error.message, 'error');
        } else {
          showAlert('สำเร็จ!', `เปลี่ยนสิทธิ์ ${username} เป็น ${roleNameTh} เรียบร้อยแล้ว`, 'success');
          setProfiles(profiles.map(p => p.id === userId ? { ...p, role: newRole } : p));
        }
      },
      'ยืนยันการเปลี่ยน',
      'ยกเลิก'
    );
  };

  // 🌟 ฟังก์ชันใหม่: เปลี่ยนสาขาให้ไรเดอร์/พนักงาน
  const handleBranchChange = async (userId: string, newBranchId: string, username: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ branch_id: newBranchId || null })
      .eq('id', userId);

    if (error) {
      showAlert('เกิดข้อผิดพลาด', 'ย้ายสาขาไม่สำเร็จ', 'error');
    } else {
      setProfiles(profiles.map(p => p.id === userId ? { ...p, branch_id: newBranchId } : p));
      showAlert('อัปเดตสาขาเรียบร้อย', `ย้ายพนักงาน ${username} ไปสาขาใหม่แล้ว`, 'success');
    }
  };

  // 🌟 ฟังก์ชันใหม่: ลบโปรไฟล์ผู้ใช้งาน (Soft-Delete จากตาราง)
  const handleDeleteUser = (userId: string, username: string) => {
    if (userId === currentUser?.id) {
      showAlert('ผิดพลาด', 'คุณไม่สามารถลบบัญชีตัวเองได้!', 'warning');
      return;
    }

    showConfirm(
      'ยืนยันการลบผู้ใช้?',
      `⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้ คุณต้องการลบข้อมูลของ ${username} ออกจากระบบถาวรใช่หรือไม่?`,
      async () => {
        closePopup();
        const { error } = await supabase.from('profiles').delete().eq('id', userId);
        
        if (error) {
          showAlert('เกิดข้อผิดพลาด', 'ลบผู้ใช้งานไม่สำเร็จ: ' + error.message, 'error');
        } else {
          showAlert('สำเร็จ', `ลบผู้ใช้ ${username} ออกจากระบบเรียบร้อยแล้ว`, 'success');
          setProfiles(profiles.filter(p => p.id !== userId));
        }
      },
      'ลบทิ้งเลย',
      'ยกเลิก'
    );
  };

  // 🌟 ฟังก์ชันใหม่: คำนวณออนไลน์/ออฟไลน์ (อัปเดตภายใน 5 นาทีถือว่า Online)
  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diffMins = (new Date().getTime() - new Date(lastSeen).getTime()) / 60000;
    return diffMins < 5;
  };

  const filteredProfiles = profiles.filter(profile => 
    profile.username?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    profile.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderPopupIcon = (type: string) => {
    switch (type) {
      case 'success': return <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>;
      case 'error': return <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><X className="h-8 w-8 text-red-600" /></div>;
      case 'warning': return <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4"><AlertTriangle className="h-8 w-8 text-yellow-600" /></div>;
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/home')} 
              className="flex items-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer active:scale-95 bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              <ChevronLeft size={20} className="mr-1" /> กลับหน้าโฮม
            </button>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center">
              <Users className="mr-2 text-blue-600" size={24} />
              จัดการพนักงาน (Users)
            </h1>
          </div>
          
          <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center border border-blue-100">
            <UserCheck size={18} className="mr-2" />
            จำนวนสมาชิกทั้งหมด: {profiles.length} คน
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* ช่องค้นหา */}
        <div className="relative max-w-md">
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

        {/* รายชื่อสมาชิก */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProfiles.map((profile) => {
            const isAdmin = profile.role === 'admin';
            const isMe = profile.id === currentUser?.id;
            const online = isOnline(profile.last_seen);

            return (
              <div key={profile.id} className={`bg-white rounded-3xl p-6 border shadow-sm transition-all duration-300 relative overflow-hidden ${isMe ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}>
                
                {/* แถบสีด้านบนการ์ด บ่งบอกสถานะ */}
                <div className={`absolute top-0 left-0 w-full h-1.5 ${isAdmin ? 'bg-indigo-500' : 'bg-green-500'}`}></div>

                {/* 🌟 ปุ่มลบ (ถ้าไม่ใช่ตัวเอง) */}
                {!isMe && (
                  <button 
                    onClick={() => handleDeleteUser(profile.id, profile.username)}
                    className="absolute top-4 right-4 p-2 text-rose-300 hover:text-white hover:bg-rose-500 rounded-xl transition-all cursor-pointer"
                    title="ลบพนักงานคนนี้"
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold uppercase shadow-inner ${
                      isAdmin ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600'
                    }`}>
                      {profile.username?.charAt(0) || '?'}
                      {/* จุดบอกสถานะออนไลน์ */}
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                        {profile.username || 'ไม่มีชื่อ'}
                        {isMe && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">คุณ</span>}
                      </h3>
                      <p className="text-xs text-gray-500 flex items-center mt-1">
                        <Mail size={12} className="mr-1" /> {profile.email}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-50">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 flex items-center"><Calendar size={14} className="mr-1.5" /> วันที่สมัคร</span>
                    <span className="font-medium text-gray-700">{new Date(profile.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 flex items-center">
                      {isAdmin ? <ShieldCheck size={14} className="mr-1.5" /> : <Navigation size={14} className="mr-1.5" />} 
                      สถานะ
                    </span>
                    <span className={`font-bold px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider ${
                      online ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                      {online ? '🟢 กำลังออนไลน์' : '⚫ ออฟไลน์'}
                    </span>
                  </div>
                </div>

                {/* 🌟 ตัวปรับเปลี่ยนสาขา */}
                <div className="mt-5 pt-4 border-t border-gray-50 flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-wide flex items-center"><Store size={12} className="mr-1"/> ประจำสาขา</label>
                    <select
                      value={profile.branch_id || ''}
                      onChange={(e) => handleBranchChange(profile.id, e.target.value, profile.username)}
                      className="w-full text-xs font-bold p-2.5 rounded-xl outline-none transition-all cursor-pointer border bg-white border-gray-200 hover:border-blue-400 text-slate-700 shadow-sm"
                    >
                      <option value="">ไม่ได้กำหนดสาขา</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 🌟 ตัวปรับเปลี่ยนสิทธิ์ */}
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-wide flex items-center"><ShieldCheck size={12} className="mr-1"/> สิทธิ์</label>
                    <select
                      disabled={isMe}
                      value={profile.role}
                      onChange={(e) => handleRoleChange(profile.id, e.target.value, profile.username)}
                      className={`w-full text-xs font-bold p-2.5 rounded-xl outline-none transition-all cursor-pointer border shadow-sm ${
                        isMe 
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                        : 'bg-white border-gray-200 hover:border-blue-400 text-slate-700'
                      }`}
                    >
                      <option value="rider">🛵 ไรเดอร์</option>
                      <option value="admin">👑 แอดมิน</option>
                    </select>
                  </div>
                </div>

              </div>
            );
          })}
          
          {filteredProfiles.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
              <Users size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">ไม่พบชื่อสมาชิกที่คุณค้นหา</p>
            </div>
          )}
        </div>
      </div>

      {/* Custom Popup Modal */}
      {popup.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center transform animate-in zoom-in-95 duration-200 border border-gray-100">
            {renderPopupIcon(popup.icon || 'info')}
            <h3 className="text-xl font-black text-gray-900 mb-2">{popup.title}</h3>
            <p className="text-gray-500 text-sm mb-6 whitespace-pre-line leading-relaxed font-medium">{popup.message}</p>
            {popup.type === 'alert' ? (
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