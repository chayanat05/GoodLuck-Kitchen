'use client'
import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { supabase } from '../lib/supabase';
import { ScanSearch, UploadCloud, CheckCircle2, AlertCircle, Loader2, X, AlertTriangle, Image as ImageIcon } from 'lucide-react';

interface SlipScannerProps {
  orderId: string;
  expectedAmount: number;
  onSuccess: (imageUrl: string) => void;
  onClose: () => void;
}

interface BankTransaction {
  id: string;
  ref_number: string;
  amount: number;
  sender_name: string;
  transferred_at: string;
  is_used: boolean;
  order_id: string | null;
}

type ScanStatus = 'idle' | 'scanning' | 'checking_db' | 'pending_email' | 'mismatch' | 'duplicate' | 'success' | 'error';

export default function SlipScanner({ orderId, expectedAmount, onSuccess, onClose }: SlipScannerProps) {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [message, setMessage] = useState('');
  const [scannedAmount, setScannedAmount] = useState<number | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingCount = useRef(0);
  // เก็บก้อนเลขอ้างอิงทั้งหมดที่ OCR กวาดมาได้ เผื่อเอาไว้ใช้ตอนวนรออีเมล
  const potentialRefsRef = useRef<string[]>([]);

  // 1. ฟังก์ชัน OCR อ่านข้อความจากรูป
  const processImage = (file: File) => {
    setSlipFile(file);
    setStatus('scanning');
    setMessage('กำลังใช้ AI อ่านข้อมูลจากสลิป...');

    // ใช้ภาษา eng ล้วนๆ เพื่อให้จับเฉพาะตัวเลขและภาษาอังกฤษ (เร็วกว่าและแม่นกว่ามาก)
    Tesseract.recognize(file, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setMessage(`กำลังวิเคราะห์รูปภาพ... ${Math.round(m.progress * 100)}%`);
        }
      }
    }).then(({ data: { text } }) => {
      // 🌟 ใช้ Regex กวาดหา "ข้อความที่มีแต่ A-Z และ 0-9 ติดกันยาว 12 ถึง 25 หลัก" 
      // (ครอบคลุมเลขอ้างอิงของทุกธนาคารไทย)
      const matches = text.replace(/\s/g, '').match(/[A-Za-z0-9]{12,25}/g);

      if (matches && matches.length > 0) {
        // ลบตัวซ้ำออกให้เหลือแค่ Unique Array
        const uniqueRefs = Array.from(new Set(matches));
        potentialRefsRef.current = uniqueRefs;
        verifyWithDatabase(uniqueRefs);
      } else {
        setStatus('error');
        setMessage('❌ สแกนไม่พบเลขอ้างอิง กรุณาใช้รูปสลิปที่ตัวเลขชัดเจนกว่านี้ครับ');
      }
    }).catch((err) => {
      setStatus('error');
      setMessage('❌ เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    });
  };

  // 2. เอาชุดเลขอ้างอิงที่ OCR กวาดได้ ไปค้นหาใน Database
  const verifyWithDatabase = async (refNumbers: string[]) => {
    setStatus('checking_db');
    setMessage('กำลังตรวจสอบยอดโอนกับธนาคาร...');

    // ใช้คำสั่ง .in() ของ Supabase เพื่อค้นหาว่ามีเลขไหนตรงใน DB บ้าง
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('*')
      .in('ref_number', refNumbers);

    if (error || !data || data.length === 0) {
      // ไม่เจอเลยสักกะเลขเดียว -> แปลว่าอีเมลอาจจะยังไม่เข้า
      startPolling(refNumbers);
      return;
    }

    // 🌟 ถ้าเจอข้อมูล! (เอาตัวแรกที่เจอ เพราะเลขอ้างอิงมัน Unique อยู่แล้ว)
    validateTransaction(data[0] as BankTransaction);
  };

  // 3. ฟังก์ชันรออีเมลเข้า (เช็คทุกๆ 5 วินาที)
  const startPolling = (refNumbers: string[]) => {
    setStatus('pending_email');
    pollingCount.current = 0;
    
    const poll = setInterval(async () => {
      pollingCount.current += 1;
      setMessage(`⏳ อ่านสลิปสำเร็จ! กำลังรออีเมลจากธนาคาร... (${pollingCount.current}/12)`);

      const { data } = await supabase
        .from('bank_transactions')
        .select('*')
        .in('ref_number', refNumbers);
      
      if (data && data.length > 0) {
        clearInterval(poll);
        validateTransaction(data[0] as BankTransaction);
      } else if (pollingCount.current >= 12) {
        clearInterval(poll);
        setStatus('error');
        setMessage('❌ หมดเวลารอ! ไม่พบยอดเงินนี้ในระบบ กรุณาลองใหม่อีกครั้ง');
      }
    }, 5000);
  };

  // 4. ตรวจสอบสลิปซ้ำ และ ยอดเงินตรงไหม
  const validateTransaction = (dbData: BankTransaction) => {
    setScannedAmount(dbData.amount);

    if (dbData.is_used) {
      setStatus('duplicate');
      const timeStr = new Date(dbData.transferred_at).toLocaleString('th-TH');
      setMessage(`🚨 สลิปนี้ถูกใช้งานไปแล้วกับออเดอร์อื่น!\n(โอนเมื่อ: ${timeStr} / โดย: ${dbData.sender_name})`);
      return;
    }

    if (Number(dbData.amount) !== expectedAmount) {
      setStatus('mismatch');
      setMessage(`⚠️ ยอดโอนไม่ตรง! (ยอดบิล: ฿${expectedAmount} / ยอดที่โอนจริง: ฿${dbData.amount})`);
      return;
    }

    // ทุกอย่างถูกต้อง! ไปอัปโหลดกัน
    confirmAndUpload(dbData.id);
  };

  // 5. บันทึกว่าสลิปใช้แล้ว และอัปโหลดรูปลง Storage
  const confirmAndUpload = async (transactionId: string) => {
    setStatus('success');
    setMessage('✅ ยอดเงินถูกต้อง กำลังจัดเก็บสลิปลงระบบ...');

    if (!slipFile) return;

    // 5.1 อัปเดตตาราง
    await supabase.from('bank_transactions').update({ 
    is_used: true, 
    order_id: orderId 
    }).eq('id', transactionId);

    await supabase.from('orders').update({ 
    slip_status: 'ผ่าน' }).eq('id', orderId); // 🌟 เพิ่มบรรทัดนี้
    
    // 5.2 อัปโหลดสลิป
    const fileExt = slipFile.name.split('.').pop();
    const fileName = `slip_${orderId}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('slips')
      .upload(fileName, slipFile);

    if (uploadError) {
      setMessage('✅ ยืนยันยอดสำเร็จ แต่มีปัญหาตอนบันทึกรูปสลิป');
      setTimeout(() => onSuccess(''), 2000);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('slips').getPublicUrl(fileName);
    
    setMessage('🎉 ดำเนินการเสร็จสมบูรณ์!');
    setTimeout(() => {
      onSuccess(publicUrlData.publicUrl);
    }, 1500);
  };

  // UI สีตามสถานะ
  const getStatusColor = () => {
    switch (status) {
      case 'idle': return 'bg-slate-50 border-slate-200';
      case 'scanning': case 'checking_db': return 'bg-blue-50 border-blue-300';
      case 'pending_email': return 'bg-amber-50 border-amber-300';
      case 'mismatch': case 'duplicate': return 'bg-rose-50 border-rose-300';
      case 'success': return 'bg-emerald-50 border-emerald-300';
      case 'error': return 'bg-red-50 border-red-300';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-in fade-in duration-200">
      <div className={`bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border-2 transition-colors duration-300 ${getStatusColor()}`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-black/5 bg-white/50">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <ScanSearch className="text-blue-600" /> ตรวจสอบสลิป (AI Scanner)
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center space-y-6">
          
          {/* ส่วนแสดงสถานะ Icon */}
          <div className="h-24 flex items-center justify-center">
            {status === 'idle' && <UploadCloud size={64} className="text-slate-300" />}
            {(status === 'scanning' || status === 'checking_db' || status === 'pending_email') && (
              <div className="relative">
                <Loader2 size={64} className="text-blue-500 animate-spin" />
                <ScanSearch size={24} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-500" />
              </div>
            )}
            {status === 'success' && <CheckCircle2 size={64} className="text-emerald-500 animate-bounce" />}
            {(status === 'error' || status === 'duplicate') && <AlertCircle size={64} className="text-rose-500 animate-pulse" />}
            {status === 'mismatch' && <AlertTriangle size={64} className="text-amber-500 animate-pulse" />}
          </div>

          {/* ส่วนแสดงข้อความ */}
          <div className="space-y-2">
            <h4 className="font-black text-slate-800 text-xl">
              ยอดที่เรียกเก็บ: <span className="text-blue-600">฿{expectedAmount}</span>
            </h4>
            <p className={`text-sm font-bold min-h-10 px-4 whitespace-pre-line ${
              status === 'error' || status === 'duplicate' ? 'text-rose-600' :
              status === 'mismatch' ? 'text-amber-600' :
              status === 'success' ? 'text-emerald-600' : 'text-slate-500'
            }`}>
              {message || 'อัปโหลดรูปสลิปเพื่อให้ AI ตรวจสอบเลขอ้างอิงและยอดเงินอัตโนมัติ'}
            </p>
          </div>

          {/* ปุ่ม Action ต่างๆ */}
          {status === 'idle' || status === 'error' ? (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 bg-slate-900 hover:bg-blue-600 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              <ImageIcon size={20} /> เลือกรูปสลิปจากเครื่อง
            </button>
          ) : status === 'mismatch' ? (
            <div className="flex gap-3 w-full">
              <button onClick={() => setStatus('idle')} className="flex-1 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300">
                ยกเลิก
              </button>
              {/* อนุญาตให้ยืนยันถ้ายอดไม่ตรง แต่แอดมินเห็นด้วยตาแล้วว่ายอมรับได้ */}
              <button onClick={() => confirmAndUpload('MANUAL_OVERRIDE_ID')} className="flex-1 py-3 bg-amber-500 text-white font-black rounded-xl shadow-lg hover:bg-amber-600">
                ยืนยันรับยอดนี้
              </button>
            </div>
          ) : status === 'duplicate' ? (
            <button onClick={() => setStatus('idle')} className="w-full py-4 bg-rose-100 text-rose-700 font-black rounded-2xl hover:bg-rose-200 transition-all border border-rose-200">
              ลองอัปโหลดรูปอื่น
            </button>
          ) : null}

          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processImage(file);
            }} 
            className="hidden" 
          />
        </div>

      </div>
    </div>
  );
}