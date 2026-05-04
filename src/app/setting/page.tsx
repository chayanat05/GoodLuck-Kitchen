'use client'
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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

type SettingView = 'menu' | 'theme' | 'advanced' | 'store';
type BgOption = 'cover' | 'contain' | 'repeat';

export default function SettingPage() {
  const [, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeView, setActiveView] = useState<SettingView>('menu');
  const [isDragOver, setIsDragOver] = useState(false);
  
  // ธีม State
  const [bgColor, setBgColor] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('boardBgColor') || '#f8fafc';
    return '#f8fafc';
  });
  const [bgImage, setBgImage] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('boardBgImage');
    return null;
  });
  const [bgOption, setBgOption] = useState<BgOption>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('boardBgOption') as BgOption) || 'cover';
    return 'cover';
  });

  // 🌟 State จัดการเวลาตัดยอดร้าน
  const [cutOffHour, setCutOffHour] = useState<number>(4);
  const [isSavingTime, setIsSavingTime] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{show: boolean, message: string}>({ show: false, message: '' });

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  useEffect(() => {
    const checkAuthAndSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role !== 'admin') { window.location.href = '/rider'; return; }
      
      setCurrentUser(session.user);

      // 🌟 ดึงค่าตั้งค่าเวลาตัดยอดจาก Database
      const { data: settings } = await supabase.from('store_settings').select('cut_off_hour').eq('id', 1).single();
      if (settings && settings.cut_off_hour !== undefined) {
        setCutOffHour(settings.cut_off_hour);
      }

      setLoading(false);
    };

    checkAuthAndSettings();
  }, []);

  // 🌟 ฟังก์ชันจัดการไฟล์รูปภาพ (อ่านไฟล์เป็น Base64)
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้นครับ');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const base64String = reader.result as string;
        setBgImage(base64String);
        localStorage.setItem('boardBgImage', base64String);
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

  // 🌟 ฟังก์ชันจัดการ Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  // 🌟 ฟังก์ชันจัดการ Copy & Paste (Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          break; // เอาแค่รูปแรก
        }
      }
    }
  };

  const handleColorSelect = (color: string) => {
    setBgColor(color);
    setBgImage(null); 
    localStorage.setItem('boardBgColor', color);
    localStorage.removeItem('boardBgImage');
    showToast('เปลี่ยนสีพื้นหลังสำเร็จ!');
  };

  const handleRemoveImage = () => {
    setBgImage(null);
    localStorage.removeItem('boardBgImage');
    showToast('ลบรูปพื้นหลังสำเร็จ!');
  };

  const handleBgOptionSelect = (option: BgOption) => {
    setBgOption(option);
    localStorage.setItem('boardBgOption', option);
    showToast('เปลี่ยนรูปแบบการจัดวางสำเร็จ!');
  };

  // 🌟 ฟังก์ชันบันทึกเวลาตัดยอดร้าน
  const handleSaveCutOffTime = async () => {
    setIsSavingTime(true);
    const { error } = await supabase.from('store_settings').upsert({ id: 1, cut_off_hour: cutOffHour });
    setIsSavingTime(false);
    
    if (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการบันทึกเวลาตัดยอด รบกวนตรวจสอบตาราง store_settings ในระบบหลังบ้าน');
    } else {
      showToast('บันทึกเวลาตัดยอดสำเร็จ!');
    }
  };

  const handleEndDay = async () => {
    const confirmFirst = window.confirm('⚠️ คุณต้องการ "ปิดยอดจบวัน" ใช่หรือไม่?\n\nออเดอร์ทั้งหมดในกระดานจะถูกซ่อน (แต่ยังดูย้อนหลังได้ในหน้าสถิติ)');
    if (!confirmFirst) return;
    const confirmSecond = window.confirm('🛑 ยืนยันการปิดยอดอีกครั้ง! เมื่อกดตกลง ออเดอร์ทั้งหมดจะหายไปจากกระดานทันที');
    if (!confirmSecond) return;

    const { error } = await supabase.from('orders').update({ is_archived: true }).neq('is_archived', true); 

    if (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการปิดยอด');
    } else {
      showToast('🌙 ปิดยอดจบวันเรียบร้อย กระดานว่างเปล่าแล้ว!');
      setActiveView('menu'); 
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex justify-center items-center font-bold text-gray-400 animate-pulse">กำลังโหลดข้อมูล...</div>;

  return (
    <div 
      className="min-h-screen pb-12 transition-all duration-500" 
      style={{ 
        backgroundColor: bgColor, 
        backgroundImage: bgImage ? `url(${bgImage})` : 'none', 
        backgroundSize: bgOption === 'repeat' ? 'auto' : bgOption, 
        backgroundRepeat: bgOption === 'repeat' ? 'repeat' : 'no-repeat',
        backgroundPosition: 'center', 
        backgroundAttachment: 'fixed' 
      }}
    >
      
      {/* Toast Notification */}
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`} style={{ zIndex: 150 }}>
        <CheckCircle2 size={18} className="text-green-400 mr-2" />
        <span className="font-bold text-sm tracking-wide">{toast.message}</span>
      </div>

      <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          {activeView === 'menu' ? (
            <Link href="/board" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 bg-white shadow-sm border border-gray-100">
              <ArrowLeft size={20} />
            </Link>
          ) : (
            <button onClick={() => setActiveView('menu')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 bg-white shadow-sm border border-gray-100 cursor-pointer">
              <ArrowLeft size={20} />
            </button>
          )}
          
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center">
            {activeView === 'menu' && <><Settings className="mr-2 text-slate-600" size={24} /> ตั้งค่าระบบ</>}
            {activeView === 'theme' && <><PaintBucket className="mr-2 text-blue-500" size={24} /> ตั้งค่าธีม / พื้นหลัง</>}
            {activeView === 'store' && <><Clock className="mr-2 text-emerald-500" size={24} /> ตั้งค่าเวลาร้าน</>}
            {activeView === 'advanced' && <><AlertTriangle className="mr-2 text-red-500" size={24} /> ตั้งค่าขั้นสูง</>}
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="bg-white/95 backdrop-blur-md rounded-4xl p-6 md:p-8 shadow-xl border border-white/50 min-h-[50vh] relative overflow-hidden">
          
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
                    <h3 className="font-black text-slate-800 text-lg">ตั้งค่าธีม และสีพื้นหลัง</h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">เลือกจากพาเลท ผสมสีเอง หรือ อัปโหลดรูปภาพ</p>
                  </div>
                </div>
                <ChevronRight size={24} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
              </button>

              {/* 🌟 ปุ่มเข้าหน้าตั้งค่าเวลาร้าน */}
              <button 
                onClick={() => setActiveView('store')}
                className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 hover:shadow-md rounded-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                    <Clock size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-black text-slate-800 text-lg">ตั้งค่าเวลาตัดยอด (กะดึก)</h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">กำหนดเวลาเปลี่ยนวันสำหรับสถิติ Dashboard</p>
                  </div>
                </div>
                <ChevronRight size={24} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </button>

              <button 
                onClick={() => setActiveView('advanced')}
                className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 hover:border-red-200 hover:bg-red-50/50 hover:shadow-md rounded-2xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-black text-slate-800 text-lg">ตั้งค่าขั้นสูง (อันตราย)</h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">ปิดยอดจบวัน และจัดการข้อมูลกระดาน</p>
                  </div>
                </div>
                <ChevronRight size={24} className="text-slate-300 group-hover:text-red-500 transition-colors" />
              </button>
            </div>
          )}

          {/* 🌟 หน้าตั้งค่าเวลาตัดยอดร้าน */}
          {activeView === 'store' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6 py-4">
              <div className="bg-emerald-50/50 rounded-4xl6 md:p-8 border border-emerald-100 relative overflow-hidden">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-emerald-500 shrink-0">
                    <Clock size={32} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-xl">เวลาตัดยอดจบวัน</h4>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                      ระบบจะใช้นับสถิติ (Dashboard) และประวัติของไรเดอร์ (แนะนำให้ตั้งหลังร้านปิด 2 ชั่วโมง)
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

          {/* ตั้งค่าธีม */}
          {activeView === 'theme' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8 pb-4">
              
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

              {/* กล่องเลือกสีอิสระ */}
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

                    {/* ออปชันตั้งค่าการแสดงผลรูปภาพ */}
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
                  // Drag & Drop
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

          {/* ตั้งค่าขั้นสูง */}
          {activeView === 'advanced' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col justify-center py-10">
              <div className="bg-red-50/90 rounded-4xl p-6 md:p-8 border border-red-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <div className="relative z-10 text-center mb-8">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-md mb-4 text-red-500">
                    <MoonStar size={40} />
                  </div>
                  <h4 className="font-black text-red-700 text-xl md:text-2xl mb-2">ล้างกระดานออเดอร์</h4>
                  <p className="text-sm font-medium text-red-500 leading-relaxed max-w-sm mx-auto">
                    เมื่อกดปุ่มนี้ ออเดอร์ทั้งหมดบนกระดานจะถูกซ่อนทันทีเพื่อเริ่มต้นวันใหม่ (คุณยังสามารถดูออเดอร์ย้อนหลังได้ในหน้าสถิติร้าน)
                  </p>
                </div>

                <button 
                  onClick={handleEndDay} 
                  className="w-full flex items-center justify-center py-4 text-white bg-red-600 hover:bg-red-700 rounded-2xl transition-all font-black shadow-lg cursor-pointer active:scale-95 group relative z-10 text-base"
                >
                  <MoonStar size={22} className="mr-3 group-hover:animate-pulse" /> 
                  <span className="group-hover:animate-[shake_0.5s_ease-in-out]">ยืนยันการปิดยอดจบวัน</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px) rotate(-1deg); }
          50% { transform: translateX(2px) rotate(1deg); }
          75% { transform: translateX(-2px) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
}