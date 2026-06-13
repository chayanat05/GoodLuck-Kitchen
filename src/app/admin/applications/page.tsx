"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, ArrowLeft, ZoomIn, ChefHat, Bike, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface Application {
  id: string;
  created_at: string;
  full_name: string;
  fb_profile_image: string;
  phone_number: string;
  status: string;
  app_type: 'rider' | 'kitchen' | 'admin';
  age?: number;
  // ไรเดอร์
  faculty?: string;
  vehicle_model?: string;
  driving_license_status?: string;
  experience_and_area?: string;
  start_date_and_commitment?: string;
  // แม่ครัว
  current_address?: string;
  can_commute?: string;
  education?: string;
  experience?: string;
  can_work_late?: string;
  family_approval?: string;
  handle_pressure?: string;
  start_date?: string;
  days_per_week?: string;
  about_me?: string;
  // แอดมิน
  address_commute?: string;
  faculty_year?: string;
  prev_admin_exp?: string;
  typing_speed_focus?: string;
  availability?: string;
}

export default function ApplicationsDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<'rider' | 'kitchen' | 'admin'>('rider');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      const [riderRes, kitchenRes, adminRes] = await Promise.all([
        supabase.from('rider_applications').select('*').order('created_at', { ascending: false }),
        supabase.from('kitchen_applications').select('*').order('created_at', { ascending: false }),
        supabase.from('admin_applications').select('*').order('created_at', { ascending: false })
      ]);

      const riderApps: Application[] = (riderRes.data || []).map(a => ({ ...a, app_type: 'rider', status: a.status || 'pending' }));
      const kitchenApps: Application[] = (kitchenRes.data || []).map(a => ({ ...a, app_type: 'kitchen', status: 'pending' }));
      const adminApps: Application[] = (adminRes.data || []).map(a => ({ ...a, app_type: 'admin', status: a.status || 'pending' }));

      setApplications([...riderApps, ...kitchenApps, ...adminApps]);
    };

    fetchApplications();
  }, []);

  const updateStatus = async (id: string, type: 'rider' | 'kitchen' | 'admin', newStatus: string) => {
    const tableMap = { rider: 'rider_applications', kitchen: 'kitchen_applications', admin: 'admin_applications' };
    const table = tableMap[type];
    const { error } = await supabase.from(table).update({ status: newStatus }).eq('id', id);

    if (error) { alert("เกิดข้อผิดพลาด"); return; }
    
    setApplications(apps => apps.map(app => app.id === id ? { ...app, status: newStatus } : app));
    if (selectedApp?.id === id) setSelectedApp({ ...selectedApp, status: newStatus });
  };

  const filteredApps = applications.filter(app => 
    app.app_type === viewMode && 
    (app.full_name.toLowerCase().includes(search.toLowerCase()) || app.phone_number.includes(search))
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link href="/home" className="p-2 bg-white rounded-full shadow-sm border border-slate-200"><ArrowLeft size={20} /></Link>
            <div>
              <h1 className="text-2xl font-black text-slate-800">จัดการใบสมัคร</h1>
              <p className="text-xs font-bold text-slate-500">คัดกรองผู้สมัคร {viewMode}</p>
            </div>
          </div>

          {/* 🌟 ปรับปรุง View Switcher ให้ดูพรีเมียม */}
<div className="flex p-1 bg-slate-100 border border-slate-200 rounded-2xl w-full md:w-auto shadow-inner">
  <button 
    onClick={() => {setViewMode('rider'); setSelectedApp(null);}} 
    className={`flex-1 md:w-32 py-2.5 px-4 text-xs font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 
    ${viewMode === 'rider' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
  >
    <Bike size={14} /> ไรเดอร์
  </button>
  <button 
    onClick={() => {setViewMode('kitchen'); setSelectedApp(null);}} 
    className={`flex-1 md:w-32 py-2.5 px-4 text-xs font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 
    ${viewMode === 'kitchen' ? 'bg-white text-amber-600 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
  >
    <ChefHat size={14} /> แม่ครัว
  </button>
  <button 
    onClick={() => {setViewMode('admin'); setSelectedApp(null);}} 
    className={`flex-1 md:w-32 py-2.5 px-4 text-xs font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 
    ${viewMode === 'admin' ? 'bg-white text-rose-600 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
  >
    <ShieldCheck size={14} /> แอดมิน
  </button>
</div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row h-[75vh]">
          <div className="w-full md:w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/50">
            {/* Search Input */}
            <div className="p-4"><input className="w-full p-2.5 rounded-xl border border-slate-200 text-sm" placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div className="flex-1 overflow-y-auto">
              {filteredApps.map(app => (
                <div key={app.id} onClick={() => setSelectedApp(app)} className={`p-4 border-b cursor-pointer ${selectedApp?.id === app.id ? 'bg-indigo-50' : ''}`}>
                  <h4 className="text-sm font-black truncate">{app.full_name}</h4>
                  <p className="text-[10px] text-slate-500 font-bold">{app.phone_number}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            {selectedApp ? (
              <div className="animate-in fade-in">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative group cursor-pointer" onClick={() => setSelectedFullImage(selectedApp.fb_profile_image)}>
                      <Image 
                        src={selectedApp.fb_profile_image} 
                        width={80} 
                        height={80} 
                        alt="Profile" 
                        className="rounded-2xl object-cover transition-opacity group-hover:opacity-80" 
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn className="text-white" size={24} />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-xl font-black">{selectedApp.full_name}</h2>
                      <p className="text-sm font-bold">{selectedApp.phone_number}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(selectedApp.id, selectedApp.app_type, 'approved')} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-black">รับ</button>
                    <button onClick={() => updateStatus(selectedApp.id, selectedApp.app_type, 'rejected')} className="px-4 py-2 bg-rose-500 text-white rounded-lg text-xs font-black">ปฏิเสธ</button>
                  </div>
                </div>
                
                {/* Dynamic Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {/* แอดมินโชว์ข้อมูลเฉพาะ */}
                   {selectedApp.app_type === 'admin' && (
                    <>
                      <DetailItem label="อายุ" value={selectedApp.age?.toString() || '-'} />
                      <DetailItem label="คณะ/ปี" value={selectedApp.faculty_year || '-'} />
                      <DetailItem label="ประสบการณ์แอดมิน" value={selectedApp.prev_admin_exp || '-'} />
                      <DetailItem label="พิมพ์เร็ว/สมาธิ" value={selectedApp.typing_speed_focus || '-'} />
                      <DetailItem label="วันทำงาน" value={selectedApp.availability || '-'} />
                      <DetailItem label="แนะนำตัว" value={selectedApp.about_me || '-'} />
                    </>
                   )}
                   {selectedApp.app_type === 'rider' && (
                    <>
                      <DetailItem label="อายุ" value={selectedApp.age?.toString() || '-'} />
                      <DetailItem label="คณะ/สาขา" value={selectedApp.faculty || '-'} />
                      <DetailItem label="รุ่นรถ" value={selectedApp.vehicle_model || '-'} />
                      <DetailItem label="ใบขับขี่/พ.ร.บ." value={selectedApp.driving_license_status || '-'} />
                      <DetailItem label="ประสบการณ์/พื้นที่" value={selectedApp.experience_and_area || '-'} />
                      <DetailItem label="เริ่มงาน/ความตั้งใจ" value={selectedApp.start_date_and_commitment || '-'} />
                    </>
                   )}
                   {selectedApp.app_type === 'kitchen' && (
                    <>
                      <DetailItem label="อายุ" value={selectedApp.age?.toString() || '-'} />
                      <DetailItem label="ที่อยู่ปัจจุบัน" value={selectedApp.current_address || '-'} />
                      <DetailItem label="การเดินทาง" value={selectedApp.can_commute || '-'} />
                      <DetailItem label="วุฒิการศึกษา" value={selectedApp.education || '-'} />
                      <DetailItem label="ประสบการณ์" value={selectedApp.experience || '-'} />
                      <DetailItem label="ทำงานเลิกดึกได้ไหม" value={selectedApp.can_work_late || '-'} />
                      <DetailItem label="ครอบครัวอนุญาตไหม" value={selectedApp.family_approval || '-'} />
                      <DetailItem label="รับแรงกดดันได้ไหม" value={selectedApp.handle_pressure || '-'} />
                      <DetailItem label="เริ่มงานได้เมื่อไหร่" value={selectedApp.start_date || '-'} />
                      <DetailItem label="วันที่สะดวกทำงาน" value={selectedApp.days_per_week || '-'} />
                      <DetailItem label="แนะนำตัว" value={selectedApp.about_me || '-'} />
                    </>
                   )}
                </div>
              </div>
            ) : <div className="text-center text-slate-400 mt-20">เลือกใบสมัครเพื่อดูรายละเอียด</div>}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {selectedFullImage && (
        <div 
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedFullImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white hover:text-slate-300 z-110 bg-white/20 p-2 rounded-full backdrop-blur-sm transition-colors"
            onClick={() => setSelectedFullImage(null)}
          >
            <X size={24} />
          </button>
          <div 
            className="relative w-full h-full flex items-center justify-center overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={selectedFullImage} 
              alt="Full view" 
              className="cursor-zoom-in transition-all duration-300 object-contain rounded-xl"
              style={{ 
                maxHeight: '100%', 
                maxWidth: '100%',
              }}
              onClick={(e) => {
                const target = e.currentTarget;
                if (target.style.maxHeight === '100%') {
                  target.style.maxHeight = '250%';
                  target.style.maxWidth = '250%';
                  target.style.cursor = 'zoom-out';
                } else {
                  target.style.maxHeight = '100%';
                  target.style.maxWidth = '100%';
                  target.style.cursor = 'zoom-in';
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-slate-50 p-4 rounded-xl border">
      <p className="text-[10px] text-slate-400 font-bold uppercase">{label}</p>
      <p className="text-sm font-bold mt-1">{value}</p>
    </div>
  );
}