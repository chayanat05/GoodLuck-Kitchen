'use client'
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { 
  ArrowLeft, Users, Search, ShieldCheck, Navigation, 
  Mail, Calendar, CheckCircle2, X, AlertTriangle, Info, UserCheck
} from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
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
  const [searchTerm, setSearchTerm] = useState('');
  
  const [popup, setPopup] = useState<PopupConfig>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showAlert = useCallback((title: string, message: string, icon: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setPopup({ isOpen: true, type: 'alert', title, message, icon });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') => {
    setPopup({ isOpen: true, type: 'confirm', title, message, onConfirm, confirmText, cancelText, icon: 'warning' });
  }, []);

  const closePopup = useCallback(() => setPopup(prev => ({ ...prev, isOpen: false })), []);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
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

      // เช็คสิทธิ์ว่าเป็น Admin หรือไม่
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
      fetchProfiles();
    };

    checkAdminAndFetchUsers();
  }, [fetchProfiles]);

  // 🌟 ฟังก์ชันเปลี่ยนสิทธิ์ผู้ใช้งาน
  const handleRoleChange = async (userId: string, newRole: string, username: string) => {
    // ป้องกันไม่ให้แอดมินเปลี่ยนสิทธิ์ตัวเอง (เดี๋ยวจะเข้าหน้าแอดมินไม่ได้)
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
          // อัปเดต State หน้าเว็บให้เห็นผลทันทีโดยไม่ต้องโหลดใหม่
          setProfiles(profiles.map(p => p.id === userId ? { ...p, role: newRole } : p));
        }
      },
      'ยืนยันการเปลี่ยน',
      'ยกเลิก'
    );
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
            <Link href="/board" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center">
              <Users className="mr-2 text-blue-600" size={24} />
              จัดการสมาชิกในระบบ
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

            return (
              <div key={profile.id} className={`bg-white rounded-3xl p-6 border shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 relative overflow-hidden ${isMe ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}>
                
                {/* แถบสีด้านบนการ์ด บ่งบอกสถานะ */}
                <div className={`absolute top-0 left-0 w-full h-1.5 ${isAdmin ? 'bg-indigo-500' : 'bg-green-500'}`}></div>

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold uppercase shadow-inner ${
                      isAdmin ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600'
                    }`}>
                      {profile.username?.charAt(0) || '?'}
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
                      สิทธิ์ปัจจุบัน
                    </span>
                    <span className={`font-bold px-2.5 py-1 rounded-md text-xs uppercase tracking-wider ${
                      isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {isAdmin ? 'แอดมิน' : 'ไรเดอร์'}
                    </span>
                  </div>
                </div>

                {/* ตัวปรับเปลี่ยนสิทธิ์ (Dropdown) */}
                <div className="mt-5 pt-4 border-t border-gray-50">
                  <label className="block text-xs font-bold text-gray-600 mb-2">เปลี่ยนสิทธิ์การใช้งาน</label>
                  <select
                    disabled={isMe}
                    value={profile.role}
                    onChange={(e) => handleRoleChange(profile.id, e.target.value, profile.username)}
                    className={`w-full text-sm font-bold p-2.5 rounded-xl outline-none transition-all cursor-pointer border ${
                      isMe 
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                      : 'bg-white border-gray-200 hover:border-blue-400 focus:ring-2 focus:ring-blue-500/20 text-gray-800'
                    }`}
                  >
                    <option value="rider">🛵 ไรเดอร์ (รับงานเท่านั้น)</option>
                    <option value="admin">👑 แอดมิน (จัดการระบบได้ทั้งหมด)</option>
                  </select>
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
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform animate-in zoom-in-95 duration-200 border border-gray-100">
            {renderPopupIcon(popup.icon || 'info')}
            <h3 className="text-xl font-bold text-gray-900 mb-2">{popup.title}</h3>
            <p className="text-gray-500 text-sm mb-6 whitespace-pre-line leading-relaxed">{popup.message}</p>
            {popup.type === 'alert' ? (
              <button onClick={closePopup} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 hover:scale-[1.03] text-white font-bold rounded-xl transition-all duration-200 focus:ring-4 focus:ring-blue-100 shadow-md cursor-pointer">ตกลง</button>
            ) : (
              <div className="flex gap-3">
                <button onClick={closePopup} className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 hover:scale-[1.03] text-gray-700 font-bold rounded-xl transition-all duration-200 cursor-pointer">{popup.cancelText}</button>
                <button onClick={popup.onConfirm} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 hover:scale-[1.03] text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-200 cursor-pointer">{popup.confirmText}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}