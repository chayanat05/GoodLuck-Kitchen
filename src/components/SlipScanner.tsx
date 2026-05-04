'use client'
import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { supabase } from '../lib/supabase';
import { ScanSearch, UploadCloud, CheckCircle2, AlertCircle, Loader2, X, Image as ImageIcon } from 'lucide-react';

interface SlipScannerProps {
  orderId: string;
  expectedAmount: number;
  onSuccess: (imageUrl: string) => void;
  onClose: () => void;
}


type ScanStatus = 'idle' | 'scanning' | 'checking_db' | 'duplicate' | 'success' | 'error';

export default function SlipScanner({ orderId, expectedAmount, onSuccess, onClose }: SlipScannerProps) {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [message, setMessage] = useState('');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. ฟังก์ชัน OCR อ่านข้อความจากรูป (เน้นหาเลข Ref.)
  const processImage = (file: File) => {
    setSlipFile(file);
    setStatus('scanning');
    setMessage('กำลังใช้ AI ตรวจสอบเลขที่อ้างอิงในสลิป...');

    Tesseract.recognize(file, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setMessage(`กำลังวิเคราะห์รูปภาพ... ${Math.round(m.progress * 100)}%`);
        }
      }
    }).then(({ data: { text } }) => {
      // Regex หาเลข Ref. (A-Z หรือ 0-9 ติดกัน 12-20 หลัก)
      const matches = text.replace(/\s/g, '').match(/[A-Za-z0-9]{12,25}/g);

      if (matches && matches.length > 0) {
        const uniqueRefs = Array.from(new Set(matches));
        checkDuplicate(uniqueRefs);
      } else {
        setStatus('error');
        setMessage('❌ สแกนไม่พบเลขที่อ้างอิง กรุณาใช้รูปสลิปที่ชัดเจนหรือสแกนใหม่');
      }
    }).catch(() => {
      setStatus('error');
      setMessage('❌ เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    });
  };

  // 2. เช็คในฐานข้อมูลว่าเลข Ref. นี้เคยถูกอัปโหลดมาหรือยัง
  const checkDuplicate = async (refNumbers: string[]) => {
    setStatus('checking_db');
    setMessage('กำลังตรวจสอบประวัติสลิปซ้ำ...');

    const { data, error } = await supabase
      .from('bank_transactions')
      .select('ref_number, order_id')
      .in('ref_number', refNumbers);

    if (error) {
      setStatus('error');
      setMessage('❌ เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
      return;
    }

    if (data && data.length > 0) {
      // พบเลขซ้ำในระบบ
      setStatus('duplicate');
      setMessage(`🚨 ตรวจพบสลิปซ้ำ! เลขอ้างอิงนี้ถูกใช้ไปแล้วในออเดอร์อื่น`);
    } else {
      // ไม่ซ้ำ! ดำเนินการอัปโหลดและบันทึกเลข Ref. ใหม่
      // ใช้เลขตัวแรกที่ OCR มั่นใจที่สุดเป็นหลัก
      confirmAndUpload(refNumbers[0]);
    }
  };

  // 3. บันทึกเลข Ref. ใหม่ และอัปโหลดรูปลง Storage
  const confirmAndUpload = async (validRef: string) => {
    setStatus('success');
    setMessage('✅ สลิปใหม่ถูกต้อง กำลังบันทึกข้อมูล...');

    if (!slipFile) return;

    // อัปโหลดรูปลง Storage
    const fileExt = slipFile.name.split('.').pop();
    const fileName = `slip_${orderId}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('slips')
      .upload(fileName, slipFile);

    if (uploadError) {
      setStatus('error');
      setMessage('❌ เกิดปัญหาตอนบันทึกรูปสลิป');
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('slips').getPublicUrl(fileName);
    const imageUrl = publicUrlData.publicUrl;

    // บันทึกเลข Ref. ลงตารางเช็คซ้ำ (bank_transactions)
    await supabase.from('bank_transactions').insert([{
      ref_number: validRef,
      order_id: orderId,
      amount: expectedAmount // บันทึกยอดตามออเดอร์ไปเลยเพราะเช็คอีเมลไม่ได้แล้ว
    }]);

    // อัปเดตสถานะออเดอร์เป็น ผ่าน
    await supabase.from('orders').update({ 
      slip_status: 'ผ่าน',
      image_url: imageUrl // ถ้าอยากให้แนบรูปไปในออเดอร์ทันที
    }).eq('id', orderId);

    setMessage('🎉 ตรวจสอบและบันทึกสลิปเรียบร้อย!');
    setTimeout(() => {
      onSuccess(imageUrl);
    }, 1500);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'idle': return 'bg-slate-50 border-slate-200';
      case 'scanning': case 'checking_db': return 'bg-blue-50 border-blue-300';
      case 'duplicate': return 'bg-rose-50 border-rose-300';
      case 'success': return 'bg-emerald-50 border-emerald-300';
      case 'error': return 'bg-red-50 border-red-300';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-999 animate-in fade-in duration-200">
      <div className={`bg-white w-full max-w-md rounded-4xl shadow-2xl overflow-hidden border-2 transition-colors duration-300 ${getStatusColor()}`}>
        
        <div className="flex justify-between items-center p-5 border-b border-black/5 bg-white/50">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <ScanSearch className="text-blue-600" /> ตรวจสลิปซ้ำ (AI Scan)
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center space-y-6">
          <div className="h-24 flex items-center justify-center">
            {status === 'idle' && <UploadCloud size={64} className="text-slate-300" />}
            {(status === 'scanning' || status === 'checking_db') && (
              <div className="relative">
                <Loader2 size={64} className="text-blue-500 animate-spin" />
                <ScanSearch size={24} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-500" />
              </div>
            )}
            {status === 'success' && <CheckCircle2 size={64} className="text-emerald-500 animate-bounce" />}
            {(status === 'error' || status === 'duplicate') && <AlertCircle size={64} className="text-rose-500 animate-pulse" />}
          </div>

          <div className="space-y-2">
            <h4 className="font-black text-slate-800 text-xl">ยอดที่เรียกเก็บ: <span className="text-blue-600">฿{expectedAmount}</span></h4>
            <p className={`text-sm font-bold min-h-10 px-4 whitespace-pre-line ${status === 'error' || status === 'duplicate' ? 'text-rose-600' : status === 'success' ? 'text-emerald-600' : 'text-slate-500'}`}>
              {message || 'อัปโหลดรูปสลิปเพื่อให้ AI ตรวจสอบการใช้งานซ้ำอัตโนมัติ'}
            </p>
          </div>

          {status === 'idle' || status === 'error' || status === 'duplicate' ? (
            <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-slate-900 hover:bg-blue-600 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
              <ImageIcon size={20} /> {status === 'duplicate' ? 'ลองอัปโหลดรูปอื่น' : 'เลือกรูปสลิปจากเครื่อง'}
            </button>
          ) : null}

          <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if (file) processImage(file); }} className="hidden" />
        </div>
      </div>
    </div>
  );
}