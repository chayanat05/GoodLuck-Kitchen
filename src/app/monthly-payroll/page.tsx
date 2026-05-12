"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { 
  ArrowLeft, Calendar, Loader2, CheckCircle2, AlertTriangle, 
  Search, Edit3, X, Save, DollarSign, Trophy, User, ImagePlus, Check,
  Trash2, Image as ImageIcon, PiggyBank, Landmark
} from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import Image from "next/image";

interface MonthlySummary {
  rider_id: string;
  username: string;
  total_bonus: number;
  total_savings: number;
  net_pay: number;
  payment_status: "รอชำระ" | "จ่ายแล้ว";
  payment_id?: string;
  slip_url?: string | null;
  paid_at?: string | null;
}

interface PaymentForm {
  total_bonus: number;
  total_savings: number;
  manual_total: number | null;
  slip_url: string | null;
}

// 🌟 สร้าง Interface มารองรับข้อมูลจากฐานข้อมูลแทนการใช้ any
interface RawAttendance {
  rider_id: string;
  diligence_bonus: number | null;
  accumulated_savings: number | null;
  profiles: { username: string } | { username: string }[] | null;
}

interface RawPayment {
  id: string;
  rider_id: string;
  status: "รอชำระ" | "จ่ายแล้ว";
  slip_url: string | null;
  paid_at: string | null;
  total_amount: number;
}

export default function MonthlyPayrollPage() {
  const router = useRouter();
  const [, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // 🌟 แก้ไขชื่อ State เป็น editingRecord ให้ตรงกันทั้งไฟล์!
  const [editingRecord, setEditingRecord] = useState<MonthlySummary | null>(null);
  const [editForm, setEditForm] = useState<PaymentForm>({
    total_bonus: 0,
    total_savings: 0,
    manual_total: null,
    slip_url: null
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewSlip, setViewSlip] = useState<string | null>(null);

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  }, []);

  const getCycleDetails = (monthKey: string) => {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    
    const startOfCycle = new Date(year, month - 2, 26);
    const endOfCycle = new Date(year, month - 1, 25);
    const payDate = new Date(year, month, 5);

    return {
      startText: startOfCycle.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      endText: endOfCycle.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
      payText: payDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
      startDateStr: new Date(year, month - 2, 26, 0, 0, 0, 0).toISOString(),
      endDateStr: new Date(year, month - 1, 25, 23, 59, 59, 999).toISOString()
    };
  };

  const fetchMonthlyData = useCallback(async (monthKey: string) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') { router.push('/rider'); return; }
    
    setCurrentUser(session.user);

    const cycle = getCycleDetails(monthKey);

    const { data: attendanceData, error: attError } = await supabase
      .from('rider_attendance')
      .select('rider_id, diligence_bonus, accumulated_savings, profiles(username)')
      .gte('check_in', cycle.startDateStr)
      .lte('check_in', cycle.endDateStr);

    const { data: paymentData, error: payError } = await supabase
      .from('monthly_payments')
      .select('*')
      .eq('month_key', monthKey);

    if (attError || payError) {
      console.error(attError, payError);
      showToast("ดึงข้อมูลไม่สำเร็จ", "error");
    } else if (attendanceData) {
      const summaryMap: Record<string, MonthlySummary> = {};

      const typedAttendanceData = attendanceData as unknown as RawAttendance[];
      
      typedAttendanceData.forEach((record) => {
        const rId = record.rider_id;
        if (!summaryMap[rId]) {
          const profiles = record.profiles;
          const profileData = Array.isArray(profiles) ? profiles[0] : profiles;
          summaryMap[rId] = {
            rider_id: rId,
            username: profileData?.username || 'ไม่ระบุชื่อ',
            total_bonus: 0,
            total_savings: 0,
            net_pay: 0,
            payment_status: "รอชำระ"
          };
        }
        summaryMap[rId].total_bonus += (Number(record.diligence_bonus) || 0);
        summaryMap[rId].total_savings += (Number(record.accumulated_savings) || 0);
      });

      if (paymentData) {
        const typedPaymentData = paymentData as unknown as RawPayment[];
        typedPaymentData.forEach((pay) => {
          if (summaryMap[pay.rider_id]) {
            summaryMap[pay.rider_id].payment_status = pay.status;
            summaryMap[pay.rider_id].payment_id = pay.id;
            summaryMap[pay.rider_id].slip_url = pay.slip_url;
            summaryMap[pay.rider_id].paid_at = pay.paid_at;
            summaryMap[pay.rider_id].net_pay = pay.total_amount;
          }
        });
      }

      Object.values(summaryMap).forEach(summary => {
        if (summary.payment_status === "รอชำระ") {
          summary.net_pay = summary.total_bonus + summary.total_savings;
        }
      });

      const finalArray = Object.values(summaryMap).sort((a, b) => {
        if (a.payment_status === "รอชำระ" && b.payment_status === "จ่ายแล้ว") return -1;
        if (a.payment_status === "จ่ายแล้ว" && b.payment_status === "รอชำระ") return 1;
        return a.username.localeCompare(b.username);
      });

      setSummaries(finalArray);
    }
    
    setLoading(false);
  }, [router, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMonthlyData(selectedMonth);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedMonth, fetchMonthlyData]);

  const calculatedTotal = useMemo(() => {
    if (editForm.manual_total !== null) return editForm.manual_total;
    return (editForm.total_bonus || 0) + (editForm.total_savings || 0);
  }, [editForm]);

  const openEditModal = (summary: MonthlySummary) => {
    setEditForm({
      total_bonus: summary.total_bonus || 0,
      total_savings: summary.total_savings || 0,
      manual_total: summary.payment_status === 'จ่ายแล้ว' ? (summary.net_pay || 0) : null,
      slip_url: summary.slip_url || null
    });
    setEditingRecord(summary);
  };

  const handleUploadSlip = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น');
      return;
    }
    setIsUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `slip-monthly-${Math.random()}.${fileExt}`;
    const filePath = `monthly-slips/${fileName}`;
    
    const { error: uploadError } = await supabase.storage.from("order-images").upload(filePath, file);
    
    if (uploadError) {
      console.error("Upload error:", uploadError);
      showToast("อัปโหลดรูปล้มเหลว", "error");
      setIsUploading(false);
      return;
    }

    const { data } = supabase.storage.from("order-images").getPublicUrl(filePath);
    setEditForm(prev => ({ ...prev, slip_url: data.publicUrl })); 
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

    const finalTotal = editForm.manual_total !== null ? editForm.manual_total : calculatedTotal;

    const payload = {
      rider_id: editingRecord.rider_id, 
      month_key: selectedMonth,
      total_bonus: editForm.total_bonus,
      total_savings: editForm.total_savings,
      total_amount: finalTotal,
      status: "จ่ายแล้ว",
      slip_url: editForm.slip_url,
      paid_at: new Date().toISOString()
    };

    let errorObj;
    if (editingRecord.payment_id) {
      const { error } = await supabase.from('monthly_payments').update(payload).eq('id', editingRecord.payment_id);
      errorObj = error;
    } else {
      const { error } = await supabase.from('monthly_payments').insert([payload]);
      errorObj = error;
    }

    setIsSaving(false);

    if (errorObj) {
      console.error(errorObj);
      showToast('บันทึกข้อมูลไม่สำเร็จ', 'error');
    } else {
      setEditingRecord(null);
      showToast('บันทึกการจ่ายเงินเดือนสำเร็จ! 🎉');
      fetchMonthlyData(selectedMonth); 
    }
  };

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return summaries;
    const query = searchQuery.toLowerCase();
    return summaries.filter(s => s.username.toLowerCase().includes(query));
  }, [summaries, searchQuery]);

  const cycleInfo = getCycleDetails(selectedMonth);

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
              <Landmark className="mr-2 text-indigo-500" size={24} /> สรุปยอดเงินเดือน (รายเดือน)
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Controls */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center w-full md:w-auto bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
            <div className="pl-4 text-slate-400"><Search size={18} /></div>
            <input 
              type="text"
              placeholder="ค้นหาชื่อพนักงาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 p-3 bg-transparent border-none outline-none text-sm font-bold text-slate-700"
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center w-full md:w-auto gap-3">
            <div className="text-right flex flex-col md:mr-4">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 w-fit md:ml-auto mb-1">
                รอบบิล: {cycleInfo.startText} - {cycleInfo.endText}
              </span>
              <span className="text-xs font-bold text-slate-500">กำหนดจ่าย: {cycleInfo.payText}</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wide flex items-center shrink-0">
                <Calendar size={16} className="text-indigo-500 mr-1.5"/> ประจำเดือน
              </label>
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full md:w-auto p-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Data List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
            <Loader2 size={48} className="animate-spin text-indigo-500" />
            <p className="font-bold tracking-widest animate-pulse uppercase">กำลังดึงข้อมูล...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white rounded-4xl p-16 text-center border border-slate-200 shadow-sm flex flex-col items-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
              <Landmark size={48} />
            </div>
            <h3 className="text-xl font-black text-slate-700 mb-2">ไม่พบประวัติในรอบบิลนี้</h3>
            <p className="text-slate-500 font-medium">ยังไม่มีข้อมูลเงินเก็บหรือโบนัสในรอบบิลที่คุณเลือก</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRecords.map((summary) => {
              const isPaid = summary.payment_status === 'จ่ายแล้ว';
              
              return (
                <div key={summary.rider_id} className={`bg-white rounded-3xl p-5 border ${isPaid ? 'border-emerald-200 shadow-sm shadow-emerald-500/10' : 'border-indigo-200 shadow-md shadow-indigo-500/10'} transition-all hover:shadow-lg relative overflow-hidden`}>
                  
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
                        <h4 className="font-black text-slate-800 text-base">{summary.username}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'}`}>
                            {isPaid ? <Check size={10}/> : null} {summary.payment_status}
                          </span>

                          {summary.slip_url && (
                            <button 
                              onClick={() => setViewSlip(summary.slip_url || null)}
                              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                            >
                              <ImageIcon size={10} /> ดูสลิป
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-black text-indigo-600 tracking-tighter">
                        ฿{(summary.net_pay || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">ยอดรวมรายเดือน</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-bold text-slate-600 mb-5 relative z-10">
                    <div className="flex items-center gap-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
                      <Trophy size={16} className="text-amber-500 shrink-0"/> 
                      <span className="flex-1">รวมโบนัส: <br/><span className="text-amber-600 text-base">฿{(summary.total_bonus || 0).toLocaleString()}</span></span>
                    </div>
                    <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-xl border border-blue-100">
                      <PiggyBank size={16} className="text-blue-500 shrink-0"/> 
                      <span className="flex-1">รวมเงินเก็บ: <br/><span className="text-blue-600 text-base">฿{(summary.total_savings || 0).toLocaleString()}</span></span>
                    </div>
                  </div>

                  <button 
                    onClick={() => openEditModal(summary)}
                    className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer relative z-10 
                      ${isPaid ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/30'}`}
                  >
                    <Edit3 size={16} /> 
                    {isPaid ? 'แก้ไขข้อมูล / สลิป' : 'จ่ายเงินเดือน'}
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-800 text-white shrink-0">
              <h3 className="text-lg font-black flex items-center gap-2">
                <Edit3 size={20} className="text-indigo-400" /> จัดการเงินรายเดือน
              </h3>
              <button onClick={() => setEditingRecord(null)} className="hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer active:scale-95">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-4 overflow-y-auto thin-scrollbar">
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-2 flex justify-between items-center">
                <div>
                  <div className="text-sm font-black text-slate-800 mb-1">{editingRecord.username}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    รอบเดือน: {selectedMonth}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide flex items-center gap-1"><Trophy size={12}/> รวมโบนัสสะสม</label>
                  <input 
                    type="number" min="0" required
                    value={editForm.total_bonus}
                    onChange={e => setEditForm({...editForm, total_bonus: Number(e.target.value), manual_total: null})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-amber-600 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide flex items-center gap-1"><PiggyBank size={12}/> รวมเงินเก็บสะสม</label>
                  <input 
                    type="number" min="0" required
                    value={editForm.total_savings}
                    onChange={e => setEditForm({...editForm, total_savings: Number(e.target.value), manual_total: null})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wide">หลักฐานการโอนเงิน (สลิปเงินเดือน)</label>
                {editForm.slip_url ? (
                  <div className="relative w-full h-32 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden group">
                    <Image src={editForm.slip_url} alt="Slip" fill className="object-contain" />
                    <button 
                      type="button" 
                      onClick={() => setEditForm(prev => ({...prev, slip_url: null}))}
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
                  <DollarSign size={16} className="text-indigo-500"/> ยอดเงินเดือนสุทธิ (บาท)
                </label>
                <input 
                  type="number" step="0.25"
                  value={calculatedTotal.toFixed(2)}
                  onChange={e => setEditForm({...editForm, manual_total: Number(e.target.value)})}
                  className="w-full p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-3xl font-black text-indigo-700 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/20 text-center shadow-inner"
                />
                <p className="text-[10px] text-center text-slate-400 font-bold mt-2">
                  *ระบบคำนวณ (โบนัส + เงินเก็บ) อัตโนมัติ แต่แอดมินสามารถพิมพ์แก้ไขยอดนี้ได้
                </p>
              </div>

              <div className="pt-4 flex gap-3 pb-2">
                <button 
                  type="button" onClick={() => setEditingRecord(null)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-sm"
                >
                  ปิด
                </button>
                <button 
                  type="submit" disabled={isSaving || !editForm.slip_url}
                  className="flex-[1.5] py-3.5 bg-slate-900 text-indigo-400 font-black rounded-xl hover:bg-slate-800 transition-all cursor-pointer shadow-lg active:scale-95 disabled:bg-slate-300 disabled:text-slate-500 text-sm flex justify-center items-center gap-2"
                >
                  {isSaving ? "กำลังบันทึก..." : <><CheckCircle2 size={18}/> ยืนยันจ่ายเงิน</>}
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