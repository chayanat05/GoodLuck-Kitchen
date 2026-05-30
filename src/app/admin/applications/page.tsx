"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Check, X, Search, UserSquare2, Loader2, ArrowLeft, ZoomIn, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface Application {
  id: string;
  created_at: string;
  full_name: string;
  faculty: string;
  age: number;
  fb_profile_image: string;
  phone_number: string;
  vehicle_model: string;
  driving_license_status: string;
  experience_and_area: string;
  start_date_and_commitment: string;
  availability: string;
  handle_pressure: string;
  current_address: string;
  family_approval: string;
  late_night_shift: string;
  status: string;
}

export default function ApplicationsDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  // 🌟 State สำหรับดูรูปเต็มจอ
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      const { data, error } = await supabase
        .from('rider_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) console.error(error);
      if (data) setApplications(data as Application[]);
      setIsLoading(false);
    };

    fetchApplications();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('rider_applications')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
      return;
    }
    
    setApplications(apps => apps.map(app => 
      app.id === id ? { ...app, status: newStatus } : app
    ));
    if (selectedApp?.id === id) {
      setSelectedApp({ ...selectedApp, status: newStatus });
    }
  };

  const filteredApps = applications.filter(app => 
    app.full_name.toLowerCase().includes(search.toLowerCase()) ||
    app.phone_number.includes(search) ||
    app.status.includes(search)
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link href="/home" className="p-2 bg-white rounded-full shadow-sm border border-slate-200 hover:bg-slate-100 transition-colors">
              <ArrowLeft size={20} className="text-slate-500" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                <UserSquare2 className="text-indigo-500" size={28} /> จัดการใบสมัครไรเดอร์
              </h1>
              <p className="text-xs font-bold text-slate-500 mt-1">คัดกรองและพิจารณาผู้สมัครทั้งหมด</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row h-[75vh]">
          
          <div className="w-full md:w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/50">
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" placeholder="ค้นหาชื่อ, เบอร์โทร..." 
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all shadow-sm"
                  value={search} onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto thin-scrollbar">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" /></div>
              ) : filteredApps.length === 0 ? (
                <div className="text-center py-10 text-xs font-bold text-slate-400 uppercase tracking-widest">ไม่พบใบสมัคร</div>
              ) : (
                filteredApps.map(app => (
                  <div 
                    key={app.id} 
                    onClick={() => setSelectedApp(app)}
                    className={`p-4 border-b border-slate-100 cursor-pointer transition-colors flex items-center gap-3 ${selectedApp?.id === app.id ? 'bg-indigo-50/50 border-l-4 border-l-indigo-500' : 'hover:bg-white bg-transparent border-l-4 border-l-transparent'}`}
                  >
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0 bg-slate-200">
                      <Image src={app.fb_profile_image} alt="profile" fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-slate-800 truncate">{app.full_name}</h4>
                      <p className="text-[10px] text-slate-500 font-bold mb-1 truncate">{app.phone_number}</p>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                        app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        app.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-white overflow-y-auto thin-scrollbar">
            {selectedApp ? (
              <div className="p-6 md:p-10 animate-in fade-in">
                <div className="flex flex-col sm:flex-row gap-6 mb-8 items-start sm:items-center justify-between border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-4">
                    {/* 🌟 ปรับรูปโปรไฟล์ให้คลิกซูมได้ */}
                    <div 
                      className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-md border-4 border-white cursor-zoom-in group"
                      onClick={() => setSelectedFullImage(selectedApp.fb_profile_image)}
                    >
                      <Image src={selectedApp.fb_profile_image} alt="profile" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="text-white" size={24} />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 mb-1">{selectedApp.full_name}</h2>
                      <p className="text-sm text-slate-500 font-bold flex items-center gap-2">
                        อายุ {selectedApp.age} ปี • {selectedApp.phone_number}
                      </p>
                      <div className="mt-2 text-xs text-slate-400">
                        สมัครเมื่อ: {new Date(selectedApp.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'})} น.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => updateStatus(selectedApp.id, 'approved')}
                      disabled={selectedApp.status === 'approved'}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-200 text-white text-xs font-black rounded-lg transition-colors shadow-sm cursor-pointer"
                    >
                      <Check size={16} /> รับเข้าทำงาน
                    </button>
                    <button 
                      onClick={() => updateStatus(selectedApp.id, 'rejected')}
                      disabled={selectedApp.status === 'rejected'}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-200 text-white text-xs font-black rounded-lg transition-colors shadow-sm cursor-pointer"
                    >
                      <X size={16} /> ปฏิเสธ
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4 border-b border-indigo-100 pb-2">ข้อมูลเบื้องต้น & ยานพาหนะ</h3>
                    <div className="space-y-4">
                      <DetailItem label="คณะ / การศึกษา" value={selectedApp.faculty} />
                      <DetailItem label="ที่อยู่ปัจจุบัน" value={selectedApp.current_address} />
                      <DetailItem label="รถที่ใช้วิ่งงาน" value={selectedApp.vehicle_model} />
                      <DetailItem label="ใบขับขี่ / พรบ." value={selectedApp.driving_license_status} />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-4 border-b border-amber-100 pb-2">ประสบการณ์ & ความพร้อม</h3>
                    <div className="space-y-4">
                      <DetailItem label="ประสบการณ์พื้นที่ มมส." value={selectedApp.experience_and_area} />
                      <DetailItem label="เริ่มงาน / สัญญา 10 เดือน" value={selectedApp.start_date_and_commitment} />
                      <DetailItem label="เวลาว่างทำงาน (4-5 วัน/สัปดาห์)" value={selectedApp.availability} />
                      <DetailItem label="การทำงานดึก (19.00-04.00)" value={selectedApp.late_night_shift} />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-4 border-b border-rose-100 pb-2">ทัศนคติ & การรับแรงกดดัน</h3>
                    <div className="space-y-4">
                      <DetailItem label="การรับแรงกดดัน / งานด่วน" value={selectedApp.handle_pressure} />
                      <DetailItem label="ความเห็นชอบจากครอบครัว" value={selectedApp.family_approval} />
                    </div>
                  </div>

                  {/* 🌟 เปลี่ยนปุ่มเปิดเว็บแยก เป็นปุ่มดูรูปเต็มจอ */}
                  <div className="md:col-span-2 mt-4">
                    <button 
                      onClick={() => setSelectedFullImage(selectedApp.fb_profile_image)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs rounded-lg transition-colors cursor-pointer active:scale-95"
                    >
                      <ImageIcon size={16} /> ดูรูปแคปหน้าจอ Facebook แบบเต็ม
                    </button>
                  </div>

                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                <UserSquare2 size={64} className="mb-4 text-slate-200" strokeWidth={1} />
                <p className="text-sm font-bold">เลือกผู้สมัครด้านซ้ายเพื่อดูรายละเอียด</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🌟 Modal โชว์รูปเต็มจอสำหรับแอดมิน */}
      {selectedFullImage && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-300 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedFullImage(null)}>
          <button className="absolute top-6 right-6 text-white p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer">
            <X size={32} />
          </button>
          <div className="relative w-full max-w-5xl h-full max-h-[80vh]">
            <Image src={selectedFullImage} alt="Preview" fill sizes="100vw" className="object-contain rounded-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-100">{value}</p>
    </div>
  );
}