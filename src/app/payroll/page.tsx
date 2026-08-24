"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Banknote, Calendar, Loader2, CheckCircle2, AlertTriangle, 
  Search, Edit3, X, Save, Clock, Package, DollarSign, Fuel, Trophy, User, ImagePlus, Check,
  Trash2, Image as ImageIcon, PiggyBank, Plus, Minus, Camera, Download, Settings
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
  accumulated_savings: number; 
  total_pay: number;
  payment_status: "รอชำระ" | "จ่ายแล้ว"; 
  payment_slip_url: string | null; 
  // 🌟 เพิ่มฟิลด์รูปตอกบัตร
  check_in_image?: string | null;
  check_out_image?: string | null;
  profiles: {
    username: string;
    role?: string;
    hourly_rate?: number;
    default_savings?: number;
  } | null;
  real_time_order_count?: number;
}

interface EditForm {
  hourlyRate: number;
  total_minutes: number;
  order_count: number;
  gas_allowance: number;
  diligence_bonus: number;
  accumulated_savings: number; 
  manual_total: number | null;
  payment_status: "รอชำระ" | "จ่ายแล้ว";
  payment_slip_url: string | null;
  check_in: string;
  check_out: string | null;
  // 🌟 เพิ่ม 2 บรรทัดนี้
  check_in_time: string;
  check_out_time: string;
}

interface ProfileForWageEdit {
  id: string;
  username: string;
  hourly_rate: number;
  default_savings: number;
}

const getAutoGasAllowance = (orders: number): number => {
  if (orders >= 71) return 350;
  if (orders >= 65) return 300;
  if (orders >= 55) return 250;
  if (orders >= 41) return 200;
  if (orders >= 31) return 150;
  if (orders >= 21) return 100;
  return 50; 
};

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
    accumulated_savings: 50,
    manual_total: null,
    payment_status: "รอชำระ",
    payment_slip_url: null,
    // 🌟 เพิ่ม 2 บรรทัดนี้
    check_in: new Date().toISOString(),
    check_out: null,
    // 🌟 เพิ่ม 2 บรรทัดนี้
    check_in_time: "",
    check_out_time: ""
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewSlip, setViewSlip] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  const [isWageModalOpen, setIsWageModalOpen] = useState(false);
  const [profilesForWageEdit, setProfilesForWageEdit] = useState<ProfileForWageEdit[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); 
    return () => clearInterval(timer);
  }, []);

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  }, []);

  const fetchRecords = useCallback(async (dateStr: string) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') { router.push('/rider'); return; }
    
    setCurrentUser(session.user);

    const { data: settings } = await supabase.from('store_settings').select('business_day_start').eq('id', 1).single();
    const bizTime = settings?.business_day_start || '07:00';
    const [bizHour, bizMin] = bizTime.split(':').map(Number);

    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Create UTC dates to avoid server's local timezone interference, then adjust for Thailand's timezone (UTC+7).
    // This makes the query robust regardless of the server's location.
    const thailandOffset = 7 * 60 * 60 * 1000; // 7 hours in milliseconds
    
    const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, bizHour, bizMin, 0, 0));
    const endOfDayUTC = new Date(Date.UTC(year, month - 1, day + 1, bizHour, bizMin, 0, 0));
    
    const startOfDayThailand = new Date(startOfDayUTC.getTime() - thailandOffset);
    const endOfDayThailand = new Date(endOfDayUTC.getTime() - thailandOffset);

    const { data, error } = await supabase
      .from('rider_attendance')
      .select('*, profiles(username, role, hourly_rate, default_savings)') // 🌟 ดึงฟิลด์ภาพตอกบัตรและค่าแรงมาด้วย
      .gte('check_in', startOfDayThailand.toISOString())
      .lt('check_in', endOfDayThailand.toISOString()) // Use .lt for a clean, exclusive end date
      .order('check_in', { ascending: false });

    if (error) {
      console.error(error);
      showToast("ดึงข้อมูลไม่สำเร็จ", "error");
    } else if (data) {
      const formattedData = data.map((item) => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      })) as AttendanceRecord[];
      
      const recordsWithOrders = await Promise.all(formattedData.map(async (record) => {
        // 🌟 ดึงออเดอร์จริงเสมอ สำหรับทุกคนที่ไม่ใช่แม่ครัว (แม้ว่าจะเลิกงานไปแล้วก็ตาม)
        if (record.profiles?.role !== 'kitchen') {
          const { data: riderOrders } = await supabase
            .from('orders')
            .select('created_at, end_time')
            .eq('rider_id', record.rider_id)
            .eq('status', 'ส่งแล้ว/เสร็จ');
            
          let count = 0;
          if (riderOrders) {
            count = riderOrders.filter(o => {
              const d = new Date(o.end_time || o.created_at);
              return d.getTime() >= startOfDayThailand.getTime() && d.getTime() < endOfDayThailand.getTime();
            }).length;
          }

          return { 
            ...record, 
            // ✨ ถ้าระบบเคยบันทึกยอดตอนกด 'จ่ายแล้ว' ไว้แล้ว ให้ใช้ยอดนั้น 
            // แต่ถ้ายังไม่จ่าย ให้ดึงยอดสด (Real-time) มาโชว์เสมอ
            real_time_order_count: (record.payment_status === 'จ่ายแล้ว' && record.order_count > 0) ? record.order_count : count 
          };
        }
        
        // ถ้าเป็นแม่ครัว คืนค่า 0 ไปเลย
        return { ...record, real_time_order_count: 0 };
      }));

      setRecords(recordsWithOrders);
    }
    
    setLoading(false);
  }, [router, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords(selectedDate);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedDate, fetchRecords]);

  const calculatedTotal = useMemo(() => {
    if (!editingRecord) return 0;
    if (editForm.manual_total !== null) {
      return editForm.manual_total;
    }
    const basePay = ((editForm.total_minutes || 0) / 60) * editForm.hourlyRate;

    const isKitchen = editingRecord.profiles?.role === 'kitchen';
    const gas = isKitchen ? 0 : (editForm.gas_allowance || 0);

    // 🌟 เอาเงินสะสมมาหักลบออกจากยอดรวมที่นี่
    const total = basePay + gas + (editForm.diligence_bonus || 0) - (editForm.accumulated_savings || 0);
    return Math.max(0, total);
  }, [editForm, editingRecord]);

  const openEditModal = (record: AttendanceRecord) => {
    // Use hourly_rate from profile, fallback to reverse-calculation, then to 40
    let rate = record.profiles?.hourly_rate || 40;
    
    let liveMinutes = record.total_minutes || 0;
    const isWorking = !record.check_out;

    if (isWorking) {
      const checkInTime = new Date(record.check_in).getTime();
      liveMinutes = Math.floor((new Date().getTime() - checkInTime) / 60000);
    }

    // Only use reverse-calculation if rate from profile is missing
    if (!record.profiles?.hourly_rate && (record.base_pay || 0) > 0 && liveMinutes > 0) {
      rate = (record.base_pay / liveMinutes) * 60;
    }
    
    const isKitchen = record.profiles?.role === 'kitchen';
    const currentOrders = record.real_time_order_count ?? (record.order_count || 0);
    const autoGas = getAutoGasAllowance(currentOrders);
    const proposedGas = (record.payment_status === 'จ่ายแล้ว' || (record.gas_allowance && record.gas_allowance > 0)) 
      ? record.gas_allowance 
      : autoGas;

    setEditForm({
      hourlyRate: Math.round(rate),
      total_minutes: liveMinutes,
      order_count: isKitchen ? 0 : currentOrders,
      gas_allowance: isKitchen ? 0 : proposedGas, 
      diligence_bonus: record.diligence_bonus || 0,
      // 🌟 เปลี่ยนการดึงค่า accumulated_savings เป็นแบบนี้
      accumulated_savings: (record.payment_status === 'จ่ายแล้ว' || record.total_pay > 0) 
        ? (record.accumulated_savings || 0) 
        : ((record.accumulated_savings === 0 || record.accumulated_savings == null) ? (record.profiles?.default_savings ?? 50) : record.accumulated_savings),
      manual_total: record.total_pay || null,
      payment_status: record.payment_status || "รอชำระ",
      payment_slip_url: record.payment_slip_url || null,
      // 🌟 ดึงค่าเวลาเข้าออกมาใส่ (แปลงฟอร์แมตให้ใช้กับ input type="datetime-local" ได้)
      check_in: record.check_in,
      check_out: record.check_out,
      // 🌟 ดึงชั่วโมงและนาทีมาโชว์ในช่องพิมพ์
      check_in_time: `${String(new Date(record.check_in).getHours()).padStart(2, '0')}:${String(new Date(record.check_in).getMinutes()).padStart(2, '0')}`,
      check_out_time: record.check_out ? `${String(new Date(record.check_out).getHours()).padStart(2, '0')}:${String(new Date(record.check_out).getMinutes()).padStart(2, '0')}` : '',
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
    
    const isKitchen = editingRecord.profiles?.role === 'kitchen';
    const basePay = ((editForm.total_minutes || 0) / 60) * editForm.hourlyRate;
    const finalTotal = editForm.manual_total !== null ? editForm.manual_total : calculatedTotal;

    const updateData = {
        check_in: new Date(editForm.check_in).toISOString(),
        check_out: editForm.check_out ? new Date(editForm.check_out).toISOString() : null,
        total_minutes: editForm.total_minutes,
        order_count: isKitchen ? 0 : editForm.order_count,
        base_pay: basePay,
        gas_allowance: isKitchen ? 0 : editForm.gas_allowance,
        diligence_bonus: editForm.diligence_bonus,
        accumulated_savings: editForm.accumulated_savings, 
        total_pay: finalTotal,
        payment_status: editForm.payment_status,
        payment_slip_url: editForm.payment_slip_url
    };

    const { data, error } = await supabase
      .from('rider_attendance')
      .update(updateData)
      .eq('id', editingRecord.id)
      .select('*, profiles(username, role)')
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

      setRecords(prev => prev.map(r => {
        if (r.id === editingRecord.id) {
          const updatedRecord = { ...r, ...formattedData };
          // After saving, if status is paid, the definitive order count is the one saved.
          if (updatedRecord.payment_status === 'จ่ายแล้ว') {
            updatedRecord.real_time_order_count = updatedRecord.order_count;
          }
          return updatedRecord;
        }
        return r;
      }));
      setEditingRecord(null);
      showToast('บันทึกยอดเงินและสถานะสำเร็จ! 💰');
    }
  };

  // 🌟 ฟังก์ชันกดจ่ายเงินด่วน (Quick Action)
  
  const openWageModal = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, hourly_rate, default_savings') // 🌟 ดึงค่าสะสมมาด้วย
      .in('role', ['rider', 'kitchen'])
      .order('username', { ascending: true });

    if (error) {
      console.error(error);
      showToast("ไม่สามารถดึงรายชื่อพนักงานได้", "error");
      return;
    }

    setProfilesForWageEdit(data.map(p => ({ 
      ...p, 
      hourly_rate: p.hourly_rate || 40,
      default_savings: p.default_savings ?? 50 // 🌟 ค่าเริ่มต้นเป็น 50
    })));
    setIsWageModalOpen(true);
  };

  const handleSaveWages = async () => {
    setIsSaving(true);
    const updatePromises = profilesForWageEdit.map(profile =>
      supabase
        .from('profiles')
        .update({ 
          hourly_rate: profile.hourly_rate, 
          default_savings: profile.default_savings // 🌟 บันทึก 2 ค่าพร้อมกัน
        })
        .eq('id', profile.id)
    );

    try {
      const results = await Promise.all(updatePromises);
      const hasError = results.some(res => res.error);
      if (hasError) showToast("เกิดข้อผิดพลาดในการบันทึกบางรายการ", "error");
      else {
        showToast("บันทึกการตั้งค่าทั้งหมดสำเร็จ!", "success");
        setIsWageModalOpen(false);
        fetchRecords(selectedDate);
      }
    } catch (error) {
      showToast("เกิดข้อผิดพลาดรุนแรงในการบันทึก", "error");
    }
    setIsSaving(false);
  };

  const handleQuickMarkPaid = async (record: AttendanceRecord) => {
    // 🌟 1. คำนวณยอดทั้งหมด ณ วินาทีที่กดจ่ายเงิน
    const isWorking = !record.check_out;
    let finalMinutes = record.total_minutes || 0;
    if (isWorking) {
      const checkInTime = new Date(record.check_in).getTime();
      finalMinutes = Math.floor((currentTime.getTime() - checkInTime) / 60000);
    }

    const showOrderAndGas = record.profiles?.role !== 'kitchen';
    const currentRate = record.profiles?.hourly_rate || 40;
    const finalBasePay = (finalMinutes / 60) * currentRate;

    const finalOrders = record.real_time_order_count ?? (record.order_count || 0);
    const autoGas = getAutoGasAllowance(finalOrders);
    
    // ถ้ายอดเดิมมีอยู่แล้วให้ใช้ยอดเดิม ถ้าไม่มีให้ใช้ autoGas
    const finalGas = (record.gas_allowance && record.gas_allowance > 0) ? record.gas_allowance : autoGas;
    const finalSavings = (record.accumulated_savings === 0 || record.accumulated_savings == null) ? (record.profiles?.default_savings ?? 50) : record.accumulated_savings;
    const finalBonus = record.diligence_bonus || 0;

    const calculatedTotal = Math.max(0, finalBasePay + (showOrderAndGas ? finalGas : 0) + finalBonus - finalSavings);
    const finalTotalPay = record.total_pay > 0 ? record.total_pay : calculatedTotal;

    // 🌟 2. แพ็กข้อมูลทั้งหมดเตรียมส่งไปบันทึก
    const updateData = {
      payment_status: "จ่ายแล้ว" as const,
      total_minutes: finalMinutes,
      order_count: showOrderAndGas ? finalOrders : 0,
      base_pay: finalBasePay,
      gas_allowance: showOrderAndGas ? finalGas : 0,
      diligence_bonus: finalBonus,
      accumulated_savings: finalSavings,
      total_pay: finalTotalPay
    };

    // อัปเดต UI ทันทีให้ดูลื่นไหล (Optimistic Update)
    setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updateData } : r));
    
    // อัปเดตเข้าฐานข้อมูลแบบครบทุกฟิลด์
    const { error } = await supabase
      .from('rider_attendance')
      .update(updateData)
      .eq('id', record.id);

    if (error) {
      console.error(error);
      showToast('อัปเดตสถานะไม่สำเร็จ ❌', 'error');
      fetchRecords(selectedDate); // ดึงข้อมูลใหม่เพื่อคืนค่าเดิมถ้าพัง
    } else {
      showToast('เปลี่ยนเป็น "จ่ายแล้ว" และบันทึกยอดสำเร็จ! 💸');
    }
  };

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const query = searchQuery.toLowerCase();
    return records.filter(r => r.profiles?.username?.toLowerCase().includes(query));
  }, [records, searchQuery]);

  const totalPayroll = useMemo(() => {
    return filteredRecords.reduce((total, record) => {
      const isWorking = !record.check_out;
      
      let displayMinutes = record.total_minutes || 0;
      if (isWorking) {
        const checkInTime = new Date(record.check_in).getTime();
        displayMinutes = Math.floor((currentTime.getTime() - checkInTime) / 60000);
      }

      const showOrderAndGas = record.profiles?.role !== 'kitchen';
      const currentRate = record.profiles?.hourly_rate || 40;
      const displayBasePay = (displayMinutes / 60) * currentRate;

      const currentOrders = record.real_time_order_count ?? (record.order_count || 0);
      const autoGas = getAutoGasAllowance(currentOrders);
      const isPaid = record.payment_status === 'จ่ายแล้ว';
      const displayGas = (isPaid || (record.gas_allowance && record.gas_allowance > 0)) ? record.gas_allowance : autoGas;

      // 1. ตั้งค่า Default หักเงินสะสม 50 บาทถ้ายังไม่จ่าย
      const displaySavings = (isPaid || record.total_pay > 0) 
        ? (record.accumulated_savings || 0) 
        : ((record.accumulated_savings === 0 || record.accumulated_savings == null) ? (record.profiles?.default_savings ?? 50) : record.accumulated_savings);

      // 2. 🌟 แก้ไขสมการตรงนี้: ต้องบวกโบนัสขยัน ก่อนลบเงินสะสม
      const calculatedDisplayTotal = Math.max(0, displayBasePay + (showOrderAndGas ? displayGas : 0) + (record.diligence_bonus || 0) - displaySavings);

      const displayTotal = isWorking
        ? calculatedDisplayTotal
        : (record.total_pay > 0 ? record.total_pay : calculatedDisplayTotal);

      return total + displayTotal;
    }, 0);
  }, [filteredRecords, currentTime]);

  const handleExportMonthly = async (riderId: string, username: string) => {
    showToast("กำลังเตรียมข้อมูล Export...", "success");

    // 1. Determine the month from selectedDate
    const year = new Date(selectedDate).getFullYear();
    const month = new Date(selectedDate).getMonth();

    // 2. Get business day start time
    const { data: settings } = await supabase.from('store_settings').select('business_day_start').eq('id', 1).single();
    const bizTime = settings?.business_day_start || '07:00';
    const [bizHour, bizMin] = bizTime.split(':').map(Number);
    const thailandOffset = 7 * 60 * 60 * 1000;

    // 3. Calculate date range for the entire month
    const startOfMonthUTC = new Date(Date.UTC(year, month, 1, bizHour, bizMin, 0, 0));
    const endOfMonthUTC = new Date(Date.UTC(year, month + 1, 1, bizHour, bizMin, 0, 0));
    
    const startOfMonth = new Date(startOfMonthUTC.getTime() - thailandOffset);
    const endOfMonth = new Date(endOfMonthUTC.getTime() - thailandOffset);

    // 4. Fetch all attendance records for the month for this rider
    const { data: monthlyRecords, error } = await supabase
        .from('rider_attendance')
        .select('*')
        .eq('rider_id', riderId)
        .gte('check_in', startOfMonth.toISOString())
        .lt('check_in', endOfMonth.toISOString())
        .order('check_in', { ascending: true });

    if (error || !monthlyRecords || monthlyRecords.length === 0) {
        console.error(error);
        showToast("ไม่พบข้อมูลสำหรับ Export ในเดือนที่เลือก", "error");
        return;
    }

    // 5. Process data and create CSV
    // Summary calculations
    const totalPay = monthlyRecords.reduce((acc, r) => acc + (r.total_pay || 0), 0);
    const totalOrders = monthlyRecords.reduce((acc, r) => acc + (r.order_count || 0), 0);
    const totalMinutes = monthlyRecords.reduce((acc, r) => acc + (r.total_minutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(2);
    const totalGas = monthlyRecords.reduce((acc, r) => acc + (r.gas_allowance || 0), 0);
    const totalBonus = monthlyRecords.reduce((acc, r) => acc + (r.diligence_bonus || 0), 0);
    const totalSavings = monthlyRecords.reduce((acc, r) => acc + (r.accumulated_savings || 0), 0);
    
    const monthName = new Date(year, month).toLocaleString('th-TH', { month: 'long', year: 'numeric' });

    // CSV Headers and content
    const dailyHeaders = [
        "วันที่",
        "เวลาเข้างาน",
        "เวลาออกงาน",
        "เวลารวม (นาที)",
        "จำนวนออเดอร์",
        "ค่าแรง",
        "ค่าน้ำมัน",
        "โบนัส",
        "เงินสะสม",
        "ยอดจ่ายสุทธิ",
        "สถานะ"
    ];

    const dailyData = monthlyRecords.map(r => [
        new Date(r.check_in).toLocaleDateString('th-TH'),
        new Date(r.check_in).toLocaleTimeString('th-TH'),
        r.check_out ? new Date(r.check_out).toLocaleTimeString('th-TH') : '-',
        r.total_minutes || 0,
        r.order_count || 0,
        r.base_pay || 0,
        r.gas_allowance || 0,
        r.diligence_bonus || 0,
        r.accumulated_savings || 0,
        r.total_pay || 0,
        r.payment_status
    ]);

    const csvRows = [];
    csvRows.push(`"รายงานสำหรับ:", "${username}"`);
    csvRows.push(`"เดือน:", "${monthName}"`);
    csvRows.push(''); // Empty line

    csvRows.push(`"สรุปยอดรวม"`);
    csvRows.push(`"ยอดจ่ายรวม:", "${totalPay.toFixed(2)}"`);
    csvRows.push(`"ออเดอร์รวม:", "${totalOrders}"`);
    csvRows.push(`"ชั่วโมงทำงานรวม:", "${totalHours}"`);
    csvRows.push(`"ค่าน้ำมันรวม:", "${totalGas.toFixed(2)}"`);
    csvRows.push(`"โบนัสรวม:", "${totalBonus.toFixed(2)}"`);
    csvRows.push(`"เงินสะสมรวม:", "${totalSavings.toFixed(2)}"`);
    csvRows.push(''); // Empty line

    csvRows.push(dailyHeaders.join(','));
    dailyData.forEach(row => {
        csvRows.push(row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
    });

    const csvContent = csvRows.join('\n');

    // 6. Trigger download
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `monthly_report_${username}_${year + 543}_${month + 1}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    showToast("Export รายงานเดือนสำเร็จ!", "success");
  };

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      showToast("ไม่มีข้อมูลให้ Export", "error");
      return;
    }

    const headers = [
      "ชื่อผู้ใช้",
      "เวลาเข้างาน",
      "เวลาออกงาน",
      "เวลารวม (นาที)",
      "จำนวนออเดอร์",
      "ค่าแรงพื้นฐาน",
      "ค่าน้ำมัน",
      "โบนัสขยัน",
      "เงินเก็บสะสม",
      "ยอดจ่ายสุทธิ",
      "สถานะการจ่ายเงิน",
      "ลิงค์สลิป",
      "รูปรอยืนยันเข้างาน",
      "รูปรอยืนยันออกงาน"
    ];

    const data = filteredRecords.map(record => {
      const isWorking = !record.check_out;
      
      let displayMinutes = record.total_minutes || 0;
      if (isWorking) {
        const checkInTime = new Date(record.check_in).getTime();
        displayMinutes = Math.floor((new Date().getTime() - checkInTime) / 60000);
      }

      let currentRate = 40;
      if ((record.base_pay || 0) > 0 && (record.total_minutes || 0) > 0) {
        currentRate = (record.base_pay / record.total_minutes) * 60;
      }
      const displayBasePay = (displayMinutes / 60) * currentRate;

      const showOrderAndGas = record.profiles?.role !== 'kitchen';
      const currentOrders = record.real_time_order_count ?? (record.order_count || 0);
      const autoGas = getAutoGasAllowance(currentOrders);
      const displayGas = (record.payment_status === 'จ่ายแล้ว' || (record.gas_allowance && record.gas_allowance > 0)) ? record.gas_allowance : autoGas;

      const isPaid = record.payment_status === 'จ่ายแล้ว';
      const displaySavings = isPaid ? (record.accumulated_savings || 0) : (record.accumulated_savings ?? (record.profiles?.default_savings ?? 50));
      const calculatedDisplayTotal = Math.max(0, displayBasePay + (showOrderAndGas ? displayGas : 0) + (record.diligence_bonus || 0) - displaySavings);

      const displayTotal = isWorking
        ? calculatedDisplayTotal
        : (record.total_pay > 0 ? record.total_pay : calculatedDisplayTotal);

      return [
        record.profiles?.username || 'N/A',
        record.check_in ? new Date(record.check_in).toLocaleString('th-TH') : 'N/A',
        record.check_out ? new Date(record.check_out).toLocaleString('th-TH') : 'N/A',
        displayMinutes,
        currentOrders,
        displayBasePay.toFixed(2),
        showOrderAndGas ? displayGas : 0,
        record.diligence_bonus || 0,
        displaySavings,
        displayTotal.toFixed(2),
        record.payment_status || 'รอชำระ',
        record.payment_slip_url || 'N/A',
        record.check_in_image || 'N/A',
        record.check_out_image || 'N/A'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for BOM to support Excel
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `payroll_${selectedDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    showToast("Export ข้อมูลสำเร็จ!", "success");
  };

  return (
    <div className="min-h-screen pb-12 transition-all duration-500 bg-slate-50 font-sans">
      
      {/* Toast */}
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl z-150 ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`}>
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
          <button
              onClick={openWageModal}
              className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-600 outline-none hover:bg-slate-50 active:scale-95 shadow-sm transition-all flex items-center gap-2"
          >
              <Settings size={16} />
          </button>

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
            <button
                onClick={handleExportCSV}
                className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-600 outline-none hover:bg-slate-50 active:scale-95 shadow-sm transition-all flex items-center gap-2"
            >
                <Download size={16} /> Export
            </button>
          </div>
        </div>

        {!loading && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 flex items-center justify-between shadow-sm animate-in fade-in duration-300">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                      <PiggyBank size={24} className="text-emerald-600"/>
                  </div>
                  <div>
                      <h2 className="text-sm font-black text-emerald-800 uppercase tracking-wide">ยอดรวมที่ต้องจ่ายวันนี้</h2>
                      <p className="text-slate-500 text-xs font-bold">จากพนักงาน {filteredRecords.length} คน (ที่แสดงผล)</p>
                  </div>
              </div>
              <div className="text-right">
                  <div className="text-4xl font-black text-emerald-600 tracking-tighter">
                      ฿{Math.round(totalPayroll).toLocaleString()}
                  </div>
              </div>
          </div>
        )}

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
              
              let displayMinutes = record.total_minutes || 0;
              if (isWorking) {
                const checkInTime = new Date(record.check_in).getTime();
                displayMinutes = Math.floor((currentTime.getTime() - checkInTime) / 60000);
              }

              const showOrderAndGas = record.profiles?.role !== 'kitchen';
              // Use the profile's hourly rate, otherwise fallback
              const currentRate = record.profiles?.hourly_rate || 40;
              const displayBasePay = (displayMinutes / 60) * currentRate;

              const currentOrders = record.real_time_order_count ?? (record.order_count || 0);
              const autoGas = getAutoGasAllowance(currentOrders);
              const displayGas = (isPaid || (record.gas_allowance && record.gas_allowance > 0)) ? record.gas_allowance : autoGas;

              // 🌟 เปลี่ยนบรรทัด displaySavings ตรงนี้
              const displaySavings = (isPaid || record.total_pay > 0) 
                ? (record.accumulated_savings || 0) 
                : ((record.accumulated_savings === 0 || record.accumulated_savings == null) ? 50 : record.accumulated_savings);

              const calculatedDisplayTotal = Math.max(0, displayBasePay + (showOrderAndGas ? displayGas : 0) + (record.diligence_bonus || 0) - displaySavings);

              const displayTotal = isWorking
                ? calculatedDisplayTotal
                : (record.total_pay > 0 ? record.total_pay : calculatedDisplayTotal);
              
              return (
                <div key={record.id} className={`bg-white rounded-3xl px-5 pb-5 pt-8 border ${isWorking ? 'border-amber-200 shadow-sm shadow-amber-500/10' : isPaid ? 'border-emerald-200 shadow-sm shadow-emerald-500/10' : 'border-slate-200 shadow-sm'} transition-all hover:shadow-md relative overflow-hidden`}>
                  
                  {/* 🌟 ปุ่ม "กดจ่ายแล้ว" ห้อยลงมาจากตรงกลางด้านบน */}
                  {!isPaid ? (
                    <button 
                      onClick={() => handleQuickMarkPaid(record)}
                      className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider px-5 py-1.5 rounded-b-xl shadow-md transition-all active:scale-95 z-20 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 size={14} /> กดจ่ายแล้ว
                    </button>
                  ) : (
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider px-4 py-1 rounded-b-xl shadow-sm z-20 flex items-center gap-1">
                      <Check size={12} /> จ่ายเงินเรียบร้อย
                    </div>
                  )}

                  {isPaid && (
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full flex items-end justify-start p-4 pointer-events-none">
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
                              onClick={() => { setViewSlip(record.payment_slip_url); setIsZoomed(false); }}
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
                        ฿{Math.round(displayTotal).toLocaleString()}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">ยอดจ่ายรายวัน</div>
                    </div>
                  </div>

                  {/* 🌟 แสดงเวลาและรูปตอกบัตร */}
                  <div className={`grid ${showOrderAndGas ? 'grid-cols-2' : 'grid-cols-1'} gap-y-3 gap-x-2 text-xs font-bold text-slate-600 mb-4 relative z-10`}>
                    
                    <div className="col-span-full flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 
                          <span className="text-[10px] text-slate-500">เข้า:</span> {new Date(record.check_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute:'2-digit' })} น.
                        </div>
                        {record.check_in_image && (
                          <button onClick={() => { setViewSlip(record.check_in_image!); setIsZoomed(false); }} className="p-1 hover:bg-emerald-100 text-emerald-600 rounded-md transition-colors">
                            <Camera size={14} />
                          </button>
                        )}
                      </div>
                      <div className="flex-1 flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${record.check_out ? 'bg-rose-500' : 'bg-slate-300'}`}></span> 
                          <span className="text-[10px] text-slate-500">ออก:</span> {record.check_out ? `${new Date(record.check_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute:'2-digit' })} น.` : '-'}
                        </div>
                        {record.check_out_image && (
                          <button onClick={() => { setViewSlip(record.check_out_image!); setIsZoomed(false); }} className="p-1 hover:bg-rose-100 text-rose-600 rounded-md transition-colors">
                            <Camera size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                      <Clock size={14} className="text-blue-500 shrink-0"/> 
                      <span>{displayMinutes >= 60 ? `${Math.floor(displayMinutes / 60)} ชม. ${displayMinutes % 60} นาที` : `${displayMinutes} นาที`}</span> 
                      <span className="text-slate-400 text-[10px]">(@{currentRate}/ชม.)</span>
                    </div>
                    
                    {showOrderAndGas && (
                      <>
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                          <Package size={14} className="text-orange-500 shrink-0"/> 
                          <span>{currentOrders} งาน</span>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg col-span-2">
                          <Fuel size={14} className="text-slate-400 shrink-0"/> 
                          <span>น้ำมัน: ฿{displayGas.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mb-5 flex justify-between text-xs font-bold text-slate-600 relative z-10">
                    <div className="flex items-center gap-1.5"><Trophy size={14} className="text-amber-500"/> โบนัสวันนี้: <span className="text-amber-600">฿{(record.diligence_bonus || 0).toLocaleString()}</span></div>
                    <div className="flex items-center gap-1.5"><PiggyBank size={14} className="text-indigo-500"/> สะสมวันนี้: <span className="text-indigo-600">฿{displaySavings.toLocaleString()}</span></div>
                  </div>

                  <div className="flex items-stretch gap-2 relative z-10">
                    <button 
                      onClick={() => openEditModal(record)}
                      className={`grow py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer
                        ${isWorking ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 
                          isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 
                          'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/30'}`}
                    >
                      <Edit3 size={16} /> 
                      {isWorking ? 'บังคับจ่าย / ปรับเงิน' : isPaid ? 'แนบสลิป / แก้ไข' : 'จัดการยอดเงิน'}
                    </button>
                    <button
                      onClick={() => handleExportMonthly(record.rider_id, record.profiles?.username || 'unknown')}
                      title="Export รายงานรายเดือน"
                      className="shrink-0 px-3 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center"
                    >
                        <Download size={18} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: จัดการเงิน */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-60 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-800 text-white shrink-0">
              <h3 className="text-lg font-black flex items-center gap-2">
                <Edit3 size={20} className="text-emerald-400" /> จัดการค่าตอบแทน
              </h3>
              <button onClick={() => setEditingRecord(null)} className="hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer active:scale-95">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-4 overflow-y-auto thin-scrollbar">
              
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

              {/* 🌟 แสดงรูปถ่ายยืนยันใน Modal */}
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-2 relative overflow-hidden flex flex-col">
                  <span className="text-[9px] font-bold text-slate-500 mb-1 absolute top-2 left-2 z-10 bg-white/80 px-1.5 py-0.5 rounded shadow-sm">เข้างาน</span>
                  {editingRecord.check_in_image ? (
                    <div className="relative w-full h-24 rounded-lg overflow-hidden mt-1 cursor-zoom-in" onClick={() => { setViewSlip(editingRecord.check_in_image!); setIsZoomed(false); }}>
                      <Image src={editingRecord.check_in_image} alt="Check In" fill className="object-cover hover:scale-105 transition-transform"/>
                    </div>
                  ) : (
                    <div className="w-full h-24 rounded-lg bg-slate-100 flex items-center justify-center mt-1 border border-dashed border-slate-300">
                      <span className="text-xs text-slate-400 font-bold">ไม่มีรูป</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-2 relative overflow-hidden flex flex-col">
                  <span className="text-[9px] font-bold text-slate-500 mb-1 absolute top-2 left-2 z-10 bg-white/80 px-1.5 py-0.5 rounded shadow-sm">เลิกงาน</span>
                  {editingRecord.check_out_image ? (
                    <div className="relative w-full h-24 rounded-lg overflow-hidden mt-1 cursor-zoom-in" onClick={() => { setViewSlip(editingRecord.check_out_image!); setIsZoomed(false); }}>
                      <Image src={editingRecord.check_out_image} alt="Check Out" fill className="object-cover hover:scale-105 transition-transform"/>
                    </div>
                  ) : (
                    <div className="w-full h-24 rounded-lg bg-slate-100 flex items-center justify-center mt-1 border border-dashed border-slate-300">
                      <span className="text-xs text-slate-400 font-bold">ไม่มีรูป</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 🌟 1. กล่องแก้ไขเวลาเข้าออก (แบบพิมพ์ตัวเลข 24 ชม.) */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide">เวลาเข้างาน (ชม:นาที)</label>
                  <input 
                    type="text" 
                    placeholder="เช่น 08:30"
                    maxLength={5}
                    required
                    value={editForm.check_in_time}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9:]/g, ''); // พิมพ์ได้แค่เลขกับ :
                      // เติม : อัตโนมัติถ้าพิมพ์ถึง 2 ตัว
                      if (val.length === 2 && !val.includes(':') && editForm.check_in_time.length < val.length) {
                        val += ':';
                      }
                      const newForm = { ...editForm, check_in_time: val };

                      // ถ้ารูปแบบครบ 5 ตัว (เช่น 08:30) ให้คำนวณเวลาใหม่
                      if (val.length === 5 && val.includes(':')) {
                        const [h, m] = val.split(':');
                        if (Number(h) < 24 && Number(m) < 60) {
                          const newDate = new Date(editForm.check_in);
                          newDate.setHours(Number(h), Number(m), 0, 0);
                          newForm.check_in = newDate.toISOString();

                          let newMins = editForm.total_minutes;
                          if (editForm.check_out) {
                            newMins = Math.max(0, Math.floor((new Date(editForm.check_out).getTime() - newDate.getTime()) / 60000));
                          } else {
                            newMins = Math.max(0, Math.floor((new Date().getTime() - newDate.getTime()) / 60000));
                          }
                          newForm.total_minutes = newMins;
                          newForm.manual_total = null;
                        }
                      }
                      setEditForm(newForm);
                    }}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-center tracking-widest"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide">เวลาออกงาน (ชม:นาที)</label>
                  <input 
                    type="text"
                    placeholder="เช่น 17:00"
                    maxLength={5}
                    value={editForm.check_out_time}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9:]/g, '');
                      if (val.length === 2 && !val.includes(':') && editForm.check_out_time.length < val.length) {
                        val += ':';
                      }
                      const newForm = { ...editForm, check_out_time: val };

                      if (val.length === 5 && val.includes(':')) {
                        const [h, m] = val.split(':');
                        if (Number(h) < 24 && Number(m) < 60) {
                          const newDate = new Date(editForm.check_in);
                          newDate.setHours(Number(h), Number(m), 0, 0);
                          
                          // ถ้าเวลาออกน้อยกว่าเวลาเข้า (ทำข้ามวัน) ให้บวกไป 1 วัน
                          if (newDate < new Date(editForm.check_in)) {
                            newDate.setDate(newDate.getDate() + 1);
                          }
                          newForm.check_out = newDate.toISOString();

                          const newMins = Math.max(0, Math.floor((newDate.getTime() - new Date(editForm.check_in).getTime()) / 60000));
                          newForm.total_minutes = newMins;
                          newForm.manual_total = null;
                        }
                      } else if (val.length === 0) {
                        newForm.check_out = null;
                        newForm.total_minutes = Math.max(0, Math.floor((new Date().getTime() - new Date(editForm.check_in).getTime()) / 60000));
                      }
                      setEditForm(newForm);
                    }}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-center tracking-widest"
                  />
                </div>
              </div>

              {/* 🌟 2. กล่องเรทจ่าย และ เวลาสุทธิ */}
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
                  <label className="flex justify-between text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide">
                    <span>แก้ไขเวลาสุทธิ (นาที)</span>
                    {/* 🌟 แสดงเวลาเป็น ชม. นาที ให้ดูง่ายๆ ข้างๆ */}
                    <span className="text-blue-500 text-[10px] bg-blue-50 px-1 rounded">{Math.floor(editForm.total_minutes / 60)} ชม. {editForm.total_minutes % 60} นาที</span>
                  </label>
                  <input 
                    type="number" min="0" required
                    value={editForm.total_minutes}
                    onChange={e => setEditForm({...editForm, total_minutes: Number(e.target.value), manual_total: null})}
                    className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
              </div>

                  {editingRecord.profiles?.role !== 'kitchen' && ( 
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide items-center gap-1"><Package size={12}/> ออเดอร์สำเร็จ</label>
                        <input 
                          type="number" min="0" required
                          value={editForm.order_count}
                          onChange={e => {
                            const newCount = Number(e.target.value);
                            setEditForm({
                              ...editForm, 
                              order_count: newCount,
                              gas_allowance: getAutoGasAllowance(newCount),
                              manual_total: null
                            });
                          }}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-slate-500 shadow-sm"
                        />
                      </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide items-center gap-1"><Fuel size={12}/> ค่าน้ำมันรายวัน (บาท)</label>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" min="0" 
                        value={editForm.gas_allowance}
                        onChange={e => setEditForm({...editForm, gas_allowance: Number(e.target.value), manual_total: null})}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-slate-500 shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                <div className="text-xs font-black text-indigo-800 uppercase tracking-widest text-center border-b border-indigo-100 pb-2">ระบบเก็บสะสม (จ่ายรายเดือน)</div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide items-center gap-1"><Trophy size={12}/> โบนัสขยัน</label>
                    <div className="flex items-center gap-1 mb-1">
                      <button type="button" onClick={() => setEditForm(p => ({...p, diligence_bonus: Math.max(0, p.diligence_bonus - 50), manual_total: null}))} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 text-rose-500 active:scale-95"><Minus size={14}/></button>
                      <input 
                        type="number" min="0" 
                        value={editForm.diligence_bonus}
                        onChange={e => setEditForm({...editForm, diligence_bonus: Number(e.target.value), manual_total: null})}
                        className="w-full p-2 bg-white border border-amber-200 rounded-lg text-sm text-center font-black text-amber-600 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                      />
                      <button type="button" onClick={() => setEditForm(p => ({...p, diligence_bonus: p.diligence_bonus + 50, manual_total: null}))} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 text-emerald-500 active:scale-95"><Plus size={14}/></button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide items-center gap-1"><PiggyBank size={12}/> เงินเก็บ (หักจากรายวัน)</label>
                    <div className="flex items-center gap-1 mb-1">
                      <button type="button" onClick={() => setEditForm(p => ({...p, accumulated_savings: Math.max(0, p.accumulated_savings - 50), manual_total: null}))} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 text-rose-500 active:scale-95"><Minus size={14}/></button>
                      <input 
                        type="number" min="0" 
                        value={editForm.accumulated_savings}
                        onChange={e => setEditForm({...editForm, accumulated_savings: Number(e.target.value), manual_total: null})}
                        className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-sm text-center font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      />
                      <button type="button" onClick={() => setEditForm(p => ({...p, accumulated_savings: p.accumulated_savings + 50, manual_total: null}))} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 text-emerald-500 active:scale-95"><Plus size={14}/></button>
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
                <label className="block text-xs font-black text-slate-800 mb-2 uppercase tracking-wide items-center gap-1.5">
                  <DollarSign size={16} className="text-emerald-500"/> ยอดจ่ายรายวันสุทธิ (บาท)
                </label>
                <input 
                  type="number" step="0.25"
                  value={calculatedTotal.toFixed(2)}
                  onChange={e => setEditForm({...editForm, manual_total: Number(e.target.value)})}
                  className="w-full p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-3xl font-black text-emerald-700 outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/20 text-center shadow-inner"
                />
                <p className="text-[10px] text-center text-slate-400 font-bold mt-2">
                  *ระบบคำนวณอัตโนมัติ: (ค่าแรง + ค่าน้ำมัน) - เงินเก็บสะสม (พิมพ์เพื่อแก้ไขได้)
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
                  type="submit" disabled={isSaving}
                  className="flex-[1.5] py-3.5 bg-slate-900 text-emerald-400 font-black rounded-xl hover:bg-slate-800 transition-all cursor-pointer shadow-lg active:scale-95 disabled:bg-slate-300 disabled:text-slate-500 text-sm flex justify-center items-center gap-2"
                >
                  {isSaving ? "กำลังบันทึก..." : <><Save size={18}/> บันทึกการจ่ายเงิน</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


            {/* 🌟 Modal: แสดงรูปภาพแบบเต็มจอพร้อมระบบซูมเลื่อนได้ (ใช้ดูได้ทั้งสลิปและรูปถ่ายบัตร) */}
            {viewSlip && (
              <div 
                className="fixed inset-0 z-200 flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
                onClick={() => { setViewSlip(null); setIsZoomed(false); }}
              >
                <button 
                  className="absolute top-6 right-6 text-white hover:text-slate-300 z-210 bg-white/10 p-2 rounded-full backdrop-blur-sm transition-colors cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setViewSlip(null); setIsZoomed(false); }}
                >
                  <X size={24} />
                </button>

                <div className="absolute top-6 left-6 text-white/50 text-xs font-bold bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm z-210 pointer-events-none">
                  คลิกที่รูปภาพเพื่อ {isZoomed ? 'ย่อรูป' : 'ซูมรูป'}
                </div>

                <div 
                  className="relative w-full h-full flex overflow-auto p-4 md:p-10 thin-scrollbar"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={viewSlip} 
                    alt="Full View" 
                    className={`transition-all duration-300 rounded-2xl m-auto shadow-2xl ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                    style={{ 
                      maxHeight: isZoomed ? 'none' : '100%', 
                      maxWidth: isZoomed ? 'none' : '100%',
                      width: isZoomed ? '250%' : 'auto',
                      objectFit: 'contain'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsZoomed(!isZoomed);
                    }}
                  />
                </div>
              </div>
            )}

            {/* Modal: ตั้งค่าค่าแรง */}
            {isWageModalOpen && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-60 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-800 text-white shrink-0">
                    <h3 className="text-lg font-black flex items-center gap-2">
                      <Settings size={20} className="text-blue-400" /> ตั้งค่าค่าแรงพนักงาน
                    </h3>
                    <button onClick={() => setIsWageModalOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer active:scale-95">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="p-6 space-y-3 overflow-y-auto thin-scrollbar">
                    {profilesForWageEdit.map((profile, index) => (
                      <div key={profile.id} className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-700 text-sm">{profile.username}</span>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ค่าแรง (บาท/ชม.)</span>
                            <input
                              type="number"
                              value={profile.hourly_rate}
                              onChange={(e) => {
                                const newProfiles = [...profilesForWageEdit];
                                newProfiles[index].hourly_rate = Number(e.target.value);
                                setProfilesForWageEdit(newProfiles);
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-center"
                            />
                          </div>
                          <div className="flex-1 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">หักสะสม (บาท/วัน)</span>
                            <input
                              type="number"
                              value={profile.default_savings}
                              onChange={(e) => {
                                const newProfiles = [...profilesForWageEdit];
                                newProfiles[index].default_savings = Number(e.target.value);
                                setProfilesForWageEdit(newProfiles);
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-black text-rose-600 outline-none focus:ring-2 focus:ring-rose-500 shadow-sm text-center"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-6 border-t border-slate-200 bg-white/50 backdrop-blur-sm flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsWageModalOpen(false)}
                      className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-sm"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveWages}
                      disabled={isSaving}
                      className="flex-[1.5] py-3 bg-slate-900 text-emerald-400 font-black rounded-xl hover:bg-slate-800 transition-all cursor-pointer shadow-lg active:scale-95 disabled:bg-slate-300 disabled:text-slate-500 text-sm flex justify-center items-center gap-2"
                    >
                      {isSaving ? "กำลังบันทึก..." : <><Save size={18}/> บันทึกค่าแรง</>}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }