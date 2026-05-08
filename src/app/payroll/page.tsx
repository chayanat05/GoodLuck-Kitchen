"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { 
  ArrowLeft, Banknote, Calendar, Loader2, CheckCircle2, AlertTriangle, 
  Search, Edit3, X, Save, Clock, Package, DollarSign, Fuel, Trophy, User, ImagePlus, Check,
  Trash2, Image as ImageIcon, PiggyBank, Plus, Minus
} from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import Image from "next/image";

interface AttendanceRecord {
  id: string;
  rider_id: string;
  check_in: string;
  check_out: string | null;
  total_minutes: number;
  order_count: number;
  base_pay: number;
  gas_allowance: number;
  diligence_bonus: number;
  accumulated_savings: number; // 🌟 เพิ่มคอลัมน์เงินสะสม
  total_pay: number;
  payment_status: "รอชำระ" | "จ่ายแล้ว"; 
  payment_slip_url: string | null; 
  profiles: {
    username: string;
  } | null;
}

interface EditForm {
  hourlyRate: number;
  total_minutes: number;
  order_count: number;
  gas_allowance: number;
  diligence_bonus: number;
  accumulated_savings: number; // 🌟 เพิ่มคอลัมน์เงินสะสม
  manual_total: number | null;
  payment_status: "รอชำระ" | "จ่ายแล้ว";
  payment_slip_url: string | null;
}

export default function PayrollPage() {
  const router = useRouter();
  const [, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    hourlyRate: 40,
    total_minutes: 0,
    order_count: 0,
    gas_allowance: 0,
    diligence_bonus: 0,
    accumulated_savings: 0,
    manual_total: null,
    payment_status: "รอชำระ",
    payment_slip_url: null
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewSlip, setViewSlip] = useState<string | null>(null);

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  }, []);

  const fetchRecords = useCallback(async (dateStr: string) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin') { router.push('/rider'); return; }
    
    setCurrentUser(session.user);

    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('rider_attendance')
      .select('*, profiles(username)')
      .gte('check_in', startOfDay.toISOString())
      .lte('check_in', endOfDay.toISOString())
      .order('check_in', { ascending: false });

    if (error) {
      console.error(error);
      showToast("ดึงข้อมูลไม่สำเร็จ", "error");
    } else if (data) {
      const formattedData = data.map((item) => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      })) as AttendanceRecord[];
      
      setRecords(formattedData);
    }
    
    setLoading(false);
  }, [router, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords(selectedDate);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedDate, fetchRecords]);

  // 🌟 สูตรคำนวณเฉพาะรายวัน (ชั่วโมง + ค่าน้ำมัน) ไม่รวมโบนัสและเงินสะสม
  const calculatedTotal = useMemo(() => {
    if (editForm.manual_total !== null) return editForm.manual_total;
    const basePay = ((editForm.total_minutes || 0) / 60) * editForm.hourlyRate;
    return basePay + (editForm.gas_allowance || 0);
  }, [editForm]);

  const openEditModal = (record: AttendanceRecord) => {
    let rate = 40;
    if ((record.base_pay || 0) > 0 && (record.total_minutes || 0) > 0) {
      rate = (record.base_pay / record.total_minutes) * 60;
    }

    setEditForm({
      hourlyRate: Math.round(rate),
      total_minutes: record.total_minutes || 0,
      order_count: record.order_count || 0,
      gas_allowance: record.gas_allowance || 0,
      diligence_bonus: record.diligence_bonus || 0,
      accumulated_savings: record.accumulated_savings || 0, // 🌟
      manual_total: record.total_pay || null,
      payment_status: record.payment_status || "รอชำระ",
      payment_slip_url: record.payment_slip_url || null
    });
    setEditingRecord(record);
  };

  const handleUploadSlip = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น');
      return;
    }
    setIsUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `slip-payroll-${Math.random()}.${fileExt}`;
    const filePath = `payroll-slips/${fileName}`;
    
    const { error: uploadError } = await supabase.storage.from("order-images").upload(filePath, file);
    
    if (uploadError) {
      console.error("Upload error:", uploadError);
      showToast("อัปโหลดรูปล้มเหลว", "error");
      setIsUploading(false);
      return;
    }

    const { data } = supabase.storage.from("order-images").getPublicUrl(filePath);
    setEditForm(prev => ({ ...prev, payment_slip_url: data.publicUrl, payment_status: "จ่ายแล้ว" })); 
    showToast('อัปโหลดสลิปสำเร็จ! 📸');
    setIsUploading(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadSlip(file);
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) { handleUploadSlip(file); break; }
      }
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setIsSaving(true);

    const basePay = ((editForm.total_minutes || 0) / 60) * editForm.hourlyRate;
    const finalTotal = editForm.manual_total !== null ? editForm.manual_total : calculatedTotal;

    const { data, error } = await supabase
      .from('rider_attendance')
      .update({
        total_minutes: editForm.total_minutes,
        order_count: editForm.order_count,
        base_pay: basePay,
        gas_allowance: editForm.gas_allowance,
        diligence_bonus: editForm.diligence_bonus,
        accumulated_savings: editForm.accumulated_savings, // 🌟
        total_pay: finalTotal,
        payment_status: editForm.payment_status,
        payment_slip_url: editForm.payment_slip_url
      })
      .eq('id', editingRecord.id)
      .select('*, profiles(username)')
      .single();

    setIsSaving(false);

    if (error) {
      console.error(error);
      showToast('บันทึกข้อมูลไม่สำเร็จ', 'error');
    } else if (data) {
      const formattedData = {
        ...data,
        profiles: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
      } as AttendanceRecord;

      setRecords(prev => prev.map(r => r.id === editingRecord.id ? formattedData : r));
      setEditingRecord(null);
      showToast('บันทึกยอดเงินและสถานะสำเร็จ! 💰');
    }
  };

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const query = searchQuery.toLowerCase();
    return records.filter(r => r.profiles?.username?.toLowerCase().includes(query));
  }, [records, searchQuery]);

  return (
    <div className="min-h-screen pb-12 transition-all duration-500 bg-slate-50 font-sans">
      
      {/* Toast */}
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl z-[150] ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>
        {toast.type === 'error' ? <AlertTriangle size={18} className="text-red-400 mr-2" /> : <CheckCircle2 size={18} className="text-green-400 mr-2" />}
        <span className="font-bold text-sm tracking-wide">{toast.message}</span>
      </div>

      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/home')} 
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 bg-white shadow-sm border border-slate-200 cursor-pointer active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center">
              <Banknote className="mr-2 text-emerald-500" size={24} /> จ่ายเงินพนักงาน (Payroll)
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Controls */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center w-full md:w-auto bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
            <div className="pl-4 text-slate-400"><Search size={18} /></div>
            <input 
              type="text"
              placeholder="ค้นหาชื่อพนักงาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 p-3 bg-transparent border-none outline-none text-sm font-bold text-slate-700"
            />
          </div>

          <div className="flex items-center w-full md:w-auto gap-3">
            <label className="text-xs font-black text-slate-500 uppercase tracking-wide flex items-center gap-1.5 shrink-0">
              <Calendar size={16} className="text-indigo-500"/> ประจำวันที่
            </label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full md:w-auto p-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
            />
          </div>
        </div>

        {/* Data List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
            <Loader2 size={48} className="animate-spin text-emerald-500" />
            <p className="font-bold tracking-widest animate-pulse uppercase">กำลังดึงข้อมูล...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white rounded-4xl p-16 text-center border border-slate-200 shadow-sm flex flex-col items-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
              <Banknote size={48} />
            </div>
            <h3 className="text-xl font-black text-slate-700 mb-2">ไม่พบประวัติการเข้างาน</h3>
            <p className="text-slate-500 font-medium">ไม่มีพนักงานตอกบัตรในวันที่คุณเลือก</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRecords.map((record) => {
              const isWorking = !record.check_out;
              const isPaid = record.payment_status === 'จ่ายแล้ว';
              
              return (
                <div key={record.id} className={`bg-white rounded-3xl p-5 border ${isWorking ? 'border-amber-200 shadow-sm shadow-amber-500/10' : isPaid ? 'border-emerald-200 shadow-sm shadow-emerald-500/10' : 'border-slate-200 shadow-sm'} transition-all hover:shadow-md relative overflow-hidden`}>
                  
                  {isPaid && (
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full flex items-end justify-start p-4">
                       <CheckCircle2 size={32} className="text-emerald-500 opacity-20 rotate-12" />
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                        <User size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-base">{record.profiles?.username || 'ไม่ระบุชื่อ'}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {isWorking ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> ทำงานอยู่
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              เลิกงานแล้ว
                            </span>
                          )}
                          
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                            {isPaid ? <Check size={10}/> : null} {record.payment_status || 'รอชำระ'}
                          </span>

                          {record.payment_slip_url && (
                            <button 
                              onClick={() => setViewSlip(record.payment_slip_url)}
                              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                            >
                              <ImageIcon size={10} /> ดูสลิป
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-black text-emerald-600 tracking-tighter">
                        ฿{(record.total_pay || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">ยอดจ่ายรายวัน</div>
                    </div>
                  </div>

                  {/* แสดงสถิติการทำงาน */}
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-bold text-slate-600 mb-4 relative z-10">
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                      <Clock size={14} className="text-blue-500 shrink-0"/> 
                      <span>{record.total_minutes || 0} นาที</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                      <Fuel size={14} className="text-slate-400 shrink-0"/> 
                      <span>น้ำมัน: ฿{(record.gas_allowance || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* 🌟 แสดงยอดสะสมรายเดือน */}
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mb-5 flex justify-between text-xs font-bold text-slate-600 relative z-10">
                    <div className="flex items-center gap-1.5"><Trophy size={14} className="text-amber-500"/> โบนัสวันนี้: <span className="text-amber-600">฿{(record.diligence_bonus || 0).toLocaleString()}</span></div>
                    <div className="flex items-center gap-1.5"><PiggyBank size={14} className="text-indigo-500"/> สะสมวันนี้: <span className="text-indigo-600">฿{(record.accumulated_savings || 0).toLocaleString()}</span></div>
                  </div>

                  <button 
                    onClick={() => openEditModal(record)}
                    className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer relative z-10 
                      ${isWorking ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 
                        isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 
                        'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/30'}`}
                  >
                    <Edit3 size={16} /> 
                    {isWorking ? 'บังคับจ่าย / ปรับเงิน' : isPaid ? 'แนบสลิป / แก้ไข' : 'จัดการยอดเงิน'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 🌟 Modal: จัดการเงิน */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-800 text-white">
              <h3 className="text-lg font-black flex items-center gap-2">
                <Edit3 size={20} className="text-emerald-400" /> จัดการค่าตอบแทน
              </h3>
              <button onClick={() => setEditingRecord(null)} className="hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer active:scale-95">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto thin-scrollbar">
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-2 flex justify-between items-center">
                <div>
                  <div className="text-sm font-black text-slate-800 mb-1">{editingRecord.profiles?.username}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {new Date(editingRecord.check_in).toLocaleDateString('th-TH')}
                  </div>
                </div>
                <div className="text-right">
                  <select 
                    value={editForm.payment_status}
                    onChange={e => setEditForm({...editForm, payment_status: e.target.value as "รอชำระ" | "จ่ายแล้ว"})}
                    className={`text-xs font-black p-2 rounded-xl outline-none cursor-pointer border ${editForm.payment_status === 'จ่ายแล้ว' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}
                  >
                    <option value="รอชำระ">🔴 รอชำระ</option>
                    <option value="จ่ายแล้ว">🟢 จ่ายแล้ว</option>
                  </select>
                </div>
              </div>

              {/* ข้อมูลรายวัน */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide">เรทจ่าย (บาท/ชม.)</label>
                  <input 
                    type="number" min="0" required
                    value={editForm.hourlyRate}
                    onChange={e => setEditForm({...editForm, hourlyRate: Number(e.target.value), manual_total: null})}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide text-blue-600">แก้ไขเวลา (นาที)</label>
                  <input 
                    type="number" min="0" required
                    value={editForm.total_minutes}
                    onChange={e => setEditForm({...editForm, total_minutes: Number(e.target.value), manual_total: null})}
                    className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide flex items-center gap-1"><Fuel size={12}/> ค่าน้ำมันรายวัน (บาท)</label>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" min="0" 
                      value={editForm.gas_allowance}
                      onChange={e => setEditForm({...editForm, gas_allowance: Number(e.target.value), manual_total: null})}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-slate-500 shadow-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide flex items-center gap-1"><Package size={12}/> ออเดอร์สำเร็จ</label>
                  <input 
                    type="number" min="0" required
                    value={editForm.order_count}
                    onChange={e => setEditForm({...editForm, order_count: Number(e.target.value)})}
                    className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-black text-slate-400 outline-none cursor-not-allowed shadow-sm"
                    disabled
                  />
                </div>
              </div>

              {/* 🌟 ยอดสะสมรายเดือน พร้อมปุ่ม +/- */}
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                <div className="text-xs font-black text-indigo-800 uppercase tracking-widest text-center border-b border-indigo-100 pb-2">ระบบเก็บสะสม (จ่ายรายเดือน)</div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* โบนัส */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide flex items-center gap-1"><Trophy size={12}/> โบนัสขยัน</label>
                    <div className="flex items-center gap-1 mb-1">
                      <button type="button" onClick={() => setEditForm(p => ({...p, diligence_bonus: Math.max(0, p.diligence_bonus - 50)}))} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 text-rose-500 active:scale-95"><Minus size={14}/></button>
                      <input 
                        type="number" min="0" 
                        value={editForm.diligence_bonus}
                        onChange={e => setEditForm({...editForm, diligence_bonus: Number(e.target.value)})}
                        className="w-full p-2 bg-white border border-amber-200 rounded-lg text-sm text-center font-black text-amber-600 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                      />
                      <button type="button" onClick={() => setEditForm(p => ({...p, diligence_bonus: p.diligence_bonus + 50}))} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 text-emerald-500 active:scale-95"><Plus size={14}/></button>
                    </div>
                  </div>

                  {/* เงินสะสม */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide flex items-center gap-1"><PiggyBank size={12}/> เงินเก็บ</label>
                    <div className="flex items-center gap-1 mb-1">
                      <button type="button" onClick={() => setEditForm(p => ({...p, accumulated_savings: Math.max(0, p.accumulated_savings - 50)}))} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 text-rose-500 active:scale-95"><Minus size={14}/></button>
                      <input 
                        type="number" min="0" 
                        value={editForm.accumulated_savings}
                        onChange={e => setEditForm({...editForm, accumulated_savings: Number(e.target.value)})}
                        className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-sm text-center font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      />
                      <button type="button" onClick={() => setEditForm(p => ({...p, accumulated_savings: p.accumulated_savings + 50}))} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 text-emerald-500 active:scale-95"><Plus size={14}/></button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wide">หลักฐานการโอนเงินรายวัน (สลิป)</label>
                {editForm.payment_slip_url ? (
                  <div className="relative w-full h-32 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden group">
                    <Image src={editForm.payment_slip_url} alt="Slip" fill className="object-contain" />
                    <button 
                      type="button" 
                      onClick={() => setEditForm(prev => ({...prev, payment_slip_url: null, payment_status: "รอชำระ"}))}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onPaste={handlePasteImage}
                    className="w-full h-24 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition-colors"
                  >
                    {isUploading ? <Loader2 className="animate-spin text-indigo-500" /> : <><ImagePlus size={24} className="text-slate-400 mb-1" /><span className="text-[10px] font-bold text-slate-500">คลิกเลือกรูป / กด Ctrl+V วางสลิป</span></>}
                  </div>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileInput} className="hidden" />
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="block text-xs font-black text-slate-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <DollarSign size={16} className="text-emerald-500"/> ยอดจ่ายรายวันสุทธิ (บาท)
                </label>
                <input 
                  type="number" step="0.25"
                  value={calculatedTotal.toFixed(2)}
                  onChange={e => setEditForm({...editForm, manual_total: Number(e.target.value)})}
                  className="w-full p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-3xl font-black text-emerald-700 outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/20 text-center shadow-inner"
                />
                <p className="text-[10px] text-center text-slate-400 font-bold mt-2">
                  *ระบบคำนวณ (ค่าแรง + ค่าน้ำมัน) อัตโนมัติ แต่แอดมินสามารถพิมพ์ปัดเศษยอดเงินได้
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" onClick={() => setEditingRecord(null)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-sm"
                >
                  ปิด
                </button>
                <button 
                  type="submit" disabled={isSaving}
                  className="flex-[1.5] py-3.5 bg-slate-900 text-emerald-400 font-black rounded-xl hover:bg-slate-800 transition-all cursor-pointer shadow-lg active:scale-95 disabled:bg-slate-300 text-sm flex justify-center items-center gap-2"
                >
                  {isSaving ? "กำลังบันทึก..." : <><Save size={18}/> บันทึกการจ่ายเงิน</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 Modal: แสดงรูปสลิปแบบเต็มจอ */}
      {viewSlip && (
        <div 
          className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in duration-200"
          onClick={() => setViewSlip(null)}
        >
          <div className="relative max-w-2xl w-full h-[80vh] flex flex-col items-center justify-center">
            <button 
              onClick={(e) => { e.stopPropagation(); setViewSlip(null); }} 
              className="absolute -top-12 right-0 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>
            <div className="relative w-full h-full bg-black/50 rounded-2xl overflow-hidden border border-white/20 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <Image src={viewSlip} alt="Slip Full View" fill className="object-contain" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}