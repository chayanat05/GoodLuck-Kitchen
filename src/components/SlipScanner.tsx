'use client'
import React, { useState, useRef } from 'react';
import { 
  X, UploadCloud, ScanSearch, CheckCircle2, 
  AlertCircle, Loader2, ImagePlus, ShieldCheck, Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Image from 'next/image';

interface SlipScannerProps {
  orderId: string;
  expectedAmount: number; // 🌟 ยอดเงินที่ดึงมาจากออเดอร์จริงๆ (total_price)
  onClose: () => void;
  onSuccess: (imageUrl: string) => void;
}

type ScanStatus = 'idle' | 'uploading' | 'scanning' | 'success' | 'error';

export default function SlipScanner({ orderId, expectedAmount, onClose, onSuccess }: SlipScannerProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ========================================================================
   🏦 จุดใส่ข้อมูลบัญชีร้าน (Whitelist)
   ========================================================================
   ใส่ "ชื่อบัญชี" หรือ "เลขบัญชี" ของร้านทุกบัญชีที่มีลงใน Array นี้ครับ
   ======================================================================== */
  const STORE_BANK_ACCOUNTS = [
    "ชยณัฐ มาตยะขันธ์",
    "CHAYANAT M",
    "123-4-56789-0", // ตัวอย่างเลขกสิกร
    "0987654321",    // ตัวอย่างเลขไทยพาณิชย์
    "บริษัท คันบัง จำกัด",
  ];

  const processFiles = (selectedFiles: FileList | File[]) => {
    const validFiles = Array.from(selectedFiles).filter(f => f.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
      setErrorMessage('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้นครับ');
      return;
    }
    
    setFiles(prev => [...prev, ...validFiles]);
    setErrorMessage('');
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls(prev => [...prev, reader.result as string]);
        setStatus('idle');
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    setPreviewUrls(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) processFiles(pastedFiles);
  };

  const handleVerify = async () => {
    if (files.length === 0 || previewUrls.length === 0) return;

    try {
      setStatus('uploading');
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `slip-${orderId}-${Date.now()}-${i}.${fileExt}`;
        const filePath = `slips/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('order-images').upload(filePath, file);
        if (uploadError) throw new Error('ไม่สามารถอัปโหลดรูปภาพได้');

        const { data: publicUrlData } = supabase.storage.from('order-images').getPublicUrl(filePath);
        uploadedUrls.push(publicUrlData.publicUrl);
      }

      setStatus('scanning');

      /* ========================================================================
        🚀 จุดเชื่อมต่อ API ของ OCR ฟรี (เขียนโค้ดต่อตรงนี้ได้เลย)
        ======================================================================== */
      
      // 1. ส่งรูปไป API ของคุณปลั๊ก (Uncomment แล้วปรับ URL ได้เลย)
      /*
      const formData = new FormData();
      formData.append('file', files[0]); // ส่งทีละรูป หรือส่งทั้งหมดขึ้นอยู่กับ API
      
      const response = await fetch('YOUR_FREE_OCR_API_URL', {
        method: 'POST',
        body: formData
      });
      const ocrData = await response.json();
      */

      // 🛑 โค้ดจำลอง (Mock Data) สมมติว่านี่คือค่าที่ได้มาจาก OCR
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const extractedAmount = 100; // สมมติ OCR อ่านยอดเงินได้ 100 บาท (แก้เป็น ocrData.amount)
      const extractedName = "นาย มิจฉาชีพ ชอบโกง"; // สมมติ OCR อ่านชื่อ (แก้เป็น ocrData.receiver_name)
      const extractedAccount = "999-9-99999-9"; // สมมติ OCR อ่านเลขบัญชี (แก้เป็น ocrData.receiver_account)

      // 2️⃣ เงื่อนไขเช็ค: บัญชีผู้รับตรงกับร้านเราไหม? (เช็คจาก Whitelist)
      const isAccountValid = STORE_BANK_ACCOUNTS.some(acc => 
        (extractedName && extractedName.includes(acc)) || 
        (extractedAccount && extractedAccount.includes(acc))
      );

      if (!isAccountValid) {
        throw new Error(`บัญชีผู้รับไม่ถูกต้อง! (${extractedName || extractedAccount})`);
      }

      // 3️⃣ เงื่อนไขเช็ค: ยอดเงินครบไหม?
      if (extractedAmount < expectedAmount) {
        throw new Error(`ยอดเงินไม่ครบ! (สลิปโอนมา ฿${extractedAmount} แต่ยอดเรียกเก็บคือ ฿${expectedAmount})`);
      }

      // ถ้าผ่านมาได้ถึงตรงนี้ = ผ่าน 100%
      setStatus('success');
      setTimeout(() => {
        onSuccess(uploadedUrls.join(',')); 
      }, 1500);

    } catch (error: unknown) {
      setStatus('error');
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('เกิดข้อผิดพลาดในการตรวจสอบสลิป');
      }
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm z-50 animate-in fade-in duration-200" onPaste={handlePaste} tabIndex={0}>
      
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col relative">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white shrink-0">
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ScanSearch className="text-emerald-500" size={24} /> 
            AI ตรวจสอบสลิป
          </h3>
          <button 
            onClick={onClose} 
            disabled={status === 'uploading' || status === 'scanning'}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between shadow-inner">
            <div>
              <p className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-1">ยอดเรียกเก็บ (จากบิล)</p>
              <p className="text-sm font-bold text-slate-600">ออเดอร์: <span className="text-slate-800">{orderId.slice(0, 8)}...</span></p>
            </div>
            <div className="text-3xl font-black text-emerald-600">
              ฿{expectedAmount.toLocaleString()}
            </div>
          </div>

          {previewUrls.length === 0 ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm
                ${isDragOver ? 'border-emerald-500 bg-emerald-50 text-emerald-600 scale-105' : 'border-slate-300 bg-slate-50 text-slate-400 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-500'}
              `}
            >
              <ImagePlus size={48} className={`mb-4 ${isDragOver ? 'animate-bounce' : ''}`} strokeWidth={1.5} />
              <p className="text-base font-bold mb-1 px-4 text-center">
                {isDragOver ? 'ปล่อยรูปสลิปตรงนี้เลย!' : 'คลิก เลือกสลิป (เลือกทีละหลายใบได้) หรือ Ctrl+V'}
              </p>
              <p className="text-xs font-medium opacity-70">ระบบ OCR จะเช็คยอดเงินและบัญชีอัตโนมัติ</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`grid gap-3 ${previewUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {previewUrls.map((url, idx) => (
                  <div key={idx} className="relative h-48 w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner flex items-center justify-center group">
                    <Image 
                      src={url} 
                      alt={`Slip Preview ${idx + 1}`} 
                      fill 
                      className={`object-contain transition-all duration-500 ${status === 'success' ? 'scale-105 brightness-110' : ''}`}
                      sizes="(max-width: 768px) 100vw, 400px"
                    />
                    
                    {status === 'idle' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 hover:scale-105"
                      >
                        <X size={14} strokeWidth={3} />
                      </button>
                    )}

                    {status === 'scanning' && (
                      <>
                        <div className="absolute inset-0 bg-emerald-900/20 mix-blend-overlay"></div>
                        <div className="scanner-laser absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)]"></div>
                        <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-2xl z-10 animate-pulse"></div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {status === 'idle' && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 border-2 border-dashed border-emerald-300 text-emerald-600 rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-emerald-50 hover:border-emerald-400 transition-colors cursor-pointer"
                >
                  <Plus size={18} /> เพิ่มสลิปอีกใบเพื่อรวมยอด
                </button>
              )}

              {status === 'scanning' && (
                <div className="flex items-center justify-center gap-3 text-emerald-600 font-black text-sm p-4 bg-emerald-50 rounded-xl animate-pulse border border-emerald-200">
                  <Loader2 size={18} className="animate-spin" /> OCR กำลังวิเคราะห์ยอดและชื่อบัญชี...
                </div>
              )}

              {status === 'success' && (
                <div className="flex items-center justify-center gap-3 text-emerald-600 font-black text-lg p-4 bg-emerald-50 rounded-xl border border-emerald-200 shadow-sm animate-in zoom-in duration-300">
                  <ShieldCheck size={28} className="animate-bounce" /> ยอดเงินตรง / บัญชีถูกต้อง!
                </div>
              )}

              {status === 'error' && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex flex-col items-center justify-center text-center animate-in fade-in">
                  <AlertCircle size={28} className="text-rose-500 mb-2" />
                  <p className="text-rose-700 font-black text-sm mb-3">{errorMessage}</p>
                  <button 
                    onClick={() => setStatus('idle')}
                    className="px-5 py-2 bg-white border border-rose-200 text-rose-600 font-bold rounded-full shadow-sm text-xs hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    ตรวจสอบใหม่อีกครั้ง
                  </button>
                </div>
              )}
            </div>
          )}

          <input 
            type="file" 
            accept="image/*" 
            multiple 
            ref={fileInputRef} 
            onChange={(e) => {
              if(e.target.files && e.target.files.length > 0) processFiles(e.target.files);
            }} 
            className="hidden" 
          />
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
          <button 
            onClick={onClose}
            disabled={status === 'uploading' || status === 'scanning'}
            className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all cursor-pointer active:scale-95 disabled:opacity-50 uppercase tracking-widest text-sm"
          >
            ยกเลิก
          </button>
          <button 
            onClick={handleVerify}
            disabled={previewUrls.length === 0 || status !== 'idle'}
            className="flex-[1.5] py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all cursor-pointer shadow-lg shadow-emerald-500/30 active:scale-95 disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
          >
            {status === 'uploading' ? (
              <><UploadCloud size={18} className="animate-bounce" /> อัปโหลด {files.length} ใบ...</>
            ) : status === 'scanning' ? (
              <><Loader2 size={18} className="animate-spin" /> ตรวจสอบ...</>
            ) : status === 'success' ? (
              <><CheckCircle2 size={18} /> เรียบร้อย</>
            ) : (
              <><ScanSearch size={18} /> ตรวจรวม {files.length} สลิป</>
            )}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .scanner-laser {
          animation: scan 2s linear infinite;
        }
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}