'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, PaintBucket, Image as ImageIcon, Trash2, MoonStar, Settings, CheckCircle2, ChevronRight, AlertTriangle, Palette, ImagePlus, Maximize, Minimize, LayoutGrid, Clock
} from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';

const COLORS = [
  // ⚪ โทนสว่าง / เทา / ดำ
  '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#475569', '#1e293b',
  // 🔴 โทนแดง / ชมพู
  '#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#be123c', '#881337',
  // 🟠 โทนส้ม / เหลือง / ทอง
  '#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f59e0b', '#c2410c', '#7c2d12',
  // 🟢 โทนเขียว / ธรรมชาติ
  '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#15803d', '#14532d',
  // 🔵 โทนฟ้า / น้ำเงิน / คราม
  '#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#1d4ed8', '#1e3a8a',
  // 🟣 โทนม่วง / ไวน์
  '#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#7e22ce', '#4c1d95',
  // 🟤 โทนเอิร์ธโทน / มินิมอล
  '#faf4ed', '#f5eae1', '#eaddcf', '#e4d4c8', '#d6d3d1', '#a8a29e', '#57534e', '#292524'
];

type SettingView = 'menu' | 'theme' | 'store' | 'cutoff'; // 🌟 เพิ่ม cutoff view
type BgOption = 'cover' | 'contain' | 'repeat';

interface Branch {
  id: string;
  name: string;
}

export default function SettingPage() {
  const router = useRouter();
  const [, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeView, setActiveView] = useState<SettingView>('menu');
  const [isDragOver, setIsDragOver] = useState(false);
  
  // 🌟 State จัดการสาขา
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');

  // ธีม State
  const [bgColor, setBgColor] = useState<string>('#f8fafc');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgOption, setBgOption] = useState<BgOption>('cover');

  // 🌟 State จำกัดออเดอร์ไรเดอร์
  const [riderOrderLimit, setRiderOrderLimit] = useState<number>(3);
  const [isSavingLimit, setIsSavingLimit] = useState(false);

  // 🌟 State ตัดยอด (ย้ายมาจาก Home)
  const [cutOffHour, setCutOffHour] = useState<number>(4);
  const [isSavingTime, setIsSavingTime] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success'|'error'}>({ show: false, message: '', type: 'success' });

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  }, []);

  // 🌟 ดึงข้อมูลตอนเปิดหน้า (ย้ายฟังก์ชันมาเรียกใน useEffect โดยตรงแก้ ESLint Error)
  useEffect(() => {
    let isMounted = true;

    const checkAuthAndSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role !== 'admin') { window.location.href = '/rider'; return; }
      
      if(isMounted) setCurrentUser(session.user);

      // ดึงข้อมูลสาขาทั้งหมด
      const { data: branchData } = await supabase.from('branches').select('id, name').order('created_at', { ascending: true });
      if (branchData && isMounted) {
        setBranches(branchData);
        if (branchData.length > 0) {
          setSelectedBranchId(branchData[0].id);
        }
      }

      // ดึงค่าตั้งค่าระบบรวม (Limit ไรเดอร์ และ เวลาตัดยอด)
      const { data: settings } = await supabase.from('store_settings').select('rider_order_limit, cut_off_hour').eq('id', 1).single();
      if (settings && isMounted) {
        if (settings.rider_order_limit !== undefined) setRiderOrderLimit(settings.rider_order_limit);
        if (settings.cut_off_hour !== undefined) setCutOffHour(settings.cut_off_hour);
      }

      if(isMounted) setLoading(false);
    };

    checkAuthAndSettings();
    return () => { isMounted = false; };
  }, []);

  // 🌟 ฟังก์ชันดึง Theme เมื่อเปลี่ยนสาขา
  useEffect(() => {
    let isMounted = true;
    const loadTheme = async () => {
      if (selectedBranchId === 'ALL') return;
      const { data } = await supabase.from('branches').select('theme_bg_color, theme_bg_image, theme_bg_option').eq('id', selectedBranchId).single();
      
      if (data && isMounted) {
        setBgColor(data.theme_bg_color || '#f8fafc');
        setBgImage(data.theme_bg_image || null);
        setBgOption((data.theme_bg_option as BgOption) || 'cover');
      }
    };
    loadTheme();
    return () => { isMounted = false; };
  }, [selectedBranchId]);

  const saveThemeToDB = async (color: string, image: string | null, option: BgOption) => {
    if (selectedBranchId === 'ALL') {
      const promises = branches.map(b => 
        supabase.from('branches').update({ 
          theme_bg_color: color, 
          theme_bg_image: image, 
          theme_bg_option: option 
        }).eq('id', b.id)
      );
      await Promise.all(promises);
    } else {
      await supabase.from('branches').update({ 
        theme_bg_color: color, 
        theme_bg_image: image, 
        theme_bg_option: option 
      }).eq('id', selectedBranchId);
    }
  };

  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้นครับ');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = reader.result as string;
        setBgImage(base64String);
        await saveThemeToDB(bgColor, base64String, bgOption);
        showToast('อัปโหลดรูปพื้นหลังสำเร็จ!');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        alert('รูปภาพมีขนาดใหญ่เกินไป กรุณาใช้รูปที่มีขนาดเล็กลงครับ');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          break;
        }
      }
    }
  };

  const handleColorSelect = async (color: string) => {
    setBgColor(color);
    setBgImage(null); 
    await saveThemeToDB(color, null, bgOption);
    showToast('เปลี่ยนสีพื้นหลังสำเร็จ!');
  };

  const handleRemoveImage = async () => {
    setBgImage(null);
    await saveThemeToDB(bgColor, null, bgOption);
    showToast('ลบรูปพื้นหลังสำเร็จ!');
  };

  const handleBgOptionSelect = async (option: BgOption) => {
    setBgOption(option);
    await saveThemeToDB(bgColor, bgImage, option);
    showToast('เปลี่ยนรูปแบบการจัดวางสำเร็จ!');
  };

  // 🌟 บันทึก Limit ไรเดอร์
  const handleSaveRiderLimit = async () => {
    setIsSavingLimit(true);
    const { error } = await supabase.from('store_settings').update({ rider_order_limit: riderOrderLimit }).eq('id', 1);
    setIsSavingLimit(false);
    if (error) {
      console.error(error);
      showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    } else {
      showToast('บันทึกจำกัดงานไรเดอร์สำเร็จ!');
    }
  };

  // 🌟 บันทึก เวลาตัดยอด
  const handleSaveCutOffTime = async () => {
    setIsSavingTime(true);
    const { error } = await supabase.from('store_settings').update({ cut_off_hour: cutOffHour }).eq('id', 1);
    setIsSavingTime(false);
    if (error) {
      console.error(error);
      showToast('เกิดข้อผิดพลาดในการบันทึกเวลาตัดยอด', 'error');
    } else {
      showToast('บันทึกเวลาตัดยอดสำเร็จ!');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex justify-center items-center font-bold text-gray-400 animate-pulse">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="min-h-screen pb-12 transition-all duration-500 bg-slate-50">
      
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl z-50 ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>
        {toast.type === 'error' ? <AlertTriangle size={18} className="text-red-400 mr-2" /> : <CheckCircle2 size={18} className="text-green-400 mr-2" />}
        <span className="font-bold text-sm tracking-wide">{toast.message}</span>
      </div>

      <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                if (activeView === 'menu') router.push('/home');
                else setActiveView('menu');
              }} 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 bg-white shadow-sm border border-gray-100 cursor-pointer active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center">
              {activeView === 'menu' && <><Settings className="mr-2 text-slate-600" size={24} /> ตั้งค่าระบบรวม</>}
              {activeView === 'theme' && <><PaintBucket className="mr-2 text-blue-500" size={24} /> ตั้งค่าธีมสาขา</>}
              {activeView === 'store' && <><MoonStar className="mr-2 text-indigo-500" size={24} /> ตั้งค่าไรเดอร์</>}
              {activeView === 'cutoff' && <><Clock className="mr-2 text-emerald-500" size={24} /> ตั้งเวลาตัดยอดร้าน</>}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="bg-white rounded-4xl p-6 md:p-8 shadow-sm border border-slate-200 min-h-[50vh] relative overflow-hidden">
          
          {/* เมนูหลัก */}
          {activeView === 'menu' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-3">
              <button 
                onClick={() => setActiveView('theme')}
                className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md rounded-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                    <PaintBucket size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-black text-slate-800 text-lg">ตั้งค่าธีมประจำสาขา</h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">เปลี่ยนสีพื้นหลังและรูปภาพของแต่ละสาขา</p>
                  </div>
                </div>
                <ChevronRight size={24} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
              </button>

              <button 
                onClick={() => setActiveView('store')}
                className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 hover:shadow-md rounded-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                    <MoonStar size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-black text-slate-800 text-lg">ตั้งค่าการรับงาน (ไรเดอร์)</h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">จำกัดจำนวนออเดอร์ที่ไรเดอร์รับได้พร้อมกัน</p>
                  </div>
                </div>
                <ChevronRight size={24} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </button>

              <button 
                onClick={() => setActiveView('cutoff')}
                className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 hover:shadow-md rounded-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                    <Clock size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-black text-slate-800 text-lg">ตั้งเวลาตัดยอด (กะดึก)</h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">กำหนดเวลาเปลี่ยนวันใหม่ของระบบ (อิงตามเซิร์ฟเวอร์)</p>
                  </div>
                </div>
                <ChevronRight size={24} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </button>
            </div>
          )}

          {/* 🌟 หน้าตั้งค่าเวลาตัดยอดร้าน */}
          {activeView === 'cutoff' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6 py-4">
              <div className="bg-emerald-50/50 rounded-4xl p-6 md:p-8 border border-emerald-100 relative overflow-hidden">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-emerald-500 shrink-0">
                    <Clock size={32} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-xl">เวลาตัดยอดจบวัน</h4>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                      ระบบจะใช้นับสถิติ (Dashboard) และประวัติของไรเดอร์ (ตั้งให้ตรงกันทุกสาขา)
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
                  <label className="block text-sm font-black text-slate-700">
                    ระบุเวลาตัดยอด (ระบุเป็นตัวเลข 0 - 23)
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      min="0" max="23"
                      value={cutOffHour}
                      onChange={(e) => setCutOffHour(Number(e.target.value))}
                      className="w-24 text-center bg-slate-50 border border-slate-200 p-4 rounded-xl text-xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-black text-emerald-600 shadow-inner"
                    />
                    <span className="text-lg font-black text-slate-500">: 00 น.</span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold">
                    * เช่น ถ้าร้านปิด 02:00 น. แนะนำให้ใส่เลข 4 (ตี 4)
                  </p>
                </div>

                <button 
                  onClick={handleSaveCutOffTime}
                  disabled={isSavingTime}
                  className="mt-6 w-full flex items-center justify-center py-4 text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl transition-all font-black shadow-lg cursor-pointer active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed text-base"
                >
                  {isSavingTime ? 'กำลังบันทึก...' : 'บันทึกเวลาตัดยอด'}
                </button>
              </div>
            </div>
          )}

          {/* 🌟 หน้าตั้งค่าการรับงานไรเดอร์ */}
          {activeView === 'store' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6 py-4">
              <div className="bg-indigo-50/50 rounded-4xl p-6 md:p-8 border border-indigo-100 relative overflow-hidden">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-500 shrink-0">
                    <MoonStar size={32} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-xl">จำกัดงานไรเดอร์</h4>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                      ป้องกันไรเดอร์กดยึดออเดอร์ไว้คนเดียวเยอะเกินไป
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
                  <label className="block text-sm font-black text-slate-700">
                    ให้ไรเดอร์ 1 คน ถืองานได้สูงสุดกี่บิล?
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      min="1" max="20"
                      value={riderOrderLimit}
                      onChange={(e) => setRiderOrderLimit(Number(e.target.value))}
                      className="w-24 text-center bg-slate-50 border border-slate-200 p-4 rounded-xl text-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-black text-indigo-600 shadow-inner"
                    />
                    <span className="text-lg font-black text-slate-500">บิล / คน</span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold">
                    * ค่าเริ่มต้นคือ 3 งาน (ถ้ารับครบจำนวนแล้ว ไรเดอร์จะกดรับเพิ่มไม่ได้จนกว่าจะส่งของในมือเสร็จ)
                  </p>
                </div>

                <button 
                  onClick={handleSaveRiderLimit}
                  disabled={isSavingLimit}
                  className="mt-6 w-full flex items-center justify-center py-4 text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-all font-black shadow-lg cursor-pointer active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed text-base"
                >
                  {isSavingLimit ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </div>
          )}

          {/* 🌟 หน้าตั้งค่าธีมสาขา */}
          {activeView === 'theme' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8 pb-4">
              
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <label className="block text-xs font-black text-blue-800 mb-2 uppercase tracking-wide">จัดการธีมของสาขา</label>
                <select 
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full p-3 bg-white border border-blue-200 rounded-xl text-sm font-bold text-blue-900 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer shadow-sm"
                >
                  <option value="ALL">🌟 เปลี่ยนทุกสาขาเป็นธีมเดียวกัน</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>เปลี่ยนเฉพาะสาขา: {b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <h4 className="font-black text-slate-800 text-base flex items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <PaintBucket size={20} className="mr-2 text-blue-500"/> เลือกสีจากพาเลท (56 เฉดสี)
                </h4>
                <div className="grid grid-cols-6 md:grid-cols-8 gap-2 px-2">
                  {COLORS.map(color => (
                    <button 
                      key={color} 
                      onClick={() => handleColorSelect(color)}
                      title={color}
                      className={`h-10 w-full rounded-xl border-2 transition-all cursor-pointer ${bgColor === color && !bgImage ? 'border-blue-500 scale-110 shadow-lg z-10' : 'border-slate-200 shadow-sm hover:scale-110 hover:z-10 hover:border-blue-300'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center justify-between shadow-sm mx-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm">
                    <Palette size={20} />
                  </div>
                  <div>
                    <h5 className="font-black text-slate-800">จานผสมสีตามใจชอบ</h5>
                    <p className="text-[11px] font-bold text-slate-500">จิ้มที่กล่องสีขวามือเพื่อปรับเฉดสีเอง</p>
                  </div>
                </div>
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md border-2 border-white cursor-pointer hover:scale-105 transition-transform" style={{ backgroundColor: bgColor }}>
                  <input 
                    type="color" 
                    value={bgColor} 
                    onChange={(e) => handleColorSelect(e.target.value)}
                    className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer opacity-0"
                    title="คลิกเพื่อผสมสี"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-100">
                <h4 className="font-black text-slate-800 text-base flex items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <ImageIcon size={20} className="mr-2 text-purple-500"/> อัปโหลดรูปภาพพื้นหลัง
                </h4>
                
                {bgImage ? (
                  <div className="space-y-3">
                    <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden border-4 border-purple-500 shadow-lg group mx-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={bgImage} 
                        alt="Background Preview" 
                        className="w-full h-full opacity-90"
                        style={{ objectFit: bgOption === 'contain' ? 'contain' : 'cover' }} 
                      />
                      <button onClick={handleRemoveImage} className="absolute top-3 right-3 p-3 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-sm font-black shadow-xl hover:bg-red-600 cursor-pointer hover:scale-105">
                        <Trash2 size={18} /> ลบรูปภาพนี้
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mx-2">
                      <button onClick={() => handleBgOptionSelect('cover')} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer ${bgOption === 'cover' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                        <Maximize size={18} className="mb-1" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">เต็มจอ (Cover)</span>
                      </button>
                      <button onClick={() => handleBgOptionSelect('contain')} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer ${bgOption === 'contain' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                        <Minimize size={18} className="mb-1" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">พอดีจอ (Fit)</span>
                      </button>
                      <button onClick={() => handleBgOptionSelect('repeat')} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer ${bgOption === 'repeat' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                        <LayoutGrid size={18} className="mb-1" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">ต่อลาย (Tile)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onPaste={handlePaste}
                    tabIndex={0}
                    className={`h-40 mx-2 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm outline-none
                      ${isDragOver ? 'border-blue-500 bg-blue-100 text-blue-600 scale-105' : 'border-slate-300 bg-slate-50/50 text-slate-400 hover:border-purple-500 hover:bg-purple-50 hover:text-purple-500'}
                    `}
                  >
                    <ImagePlus size={36} className={`mb-3 ${isDragOver ? 'animate-bounce' : ''}`} />
                    <span className="text-sm md:text-base font-bold text-center px-4">
                      {isDragOver ? 'ปล่อยรูปภาพที่นี่เลย!' : 'คลิก ลากไฟล์มาวาง หรือ กด Ctrl+V'}
                    </span>
                  </div>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}