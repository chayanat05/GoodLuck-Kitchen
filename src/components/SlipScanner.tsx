'use client'
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, UploadCloud, ScanSearch, CheckCircle2, 
  AlertCircle, Loader2, ImagePlus, ShieldCheck, Plus, Calculator, Equal, Delete
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Image from 'next/image';
import Tesseract from 'tesseract.js';

interface SlipScannerProps {
  orderId: string;
  expectedAmount: number; // 🌟 ยอดเงินที่ดึงมาจากออเดอร์จริงๆ (total_price)
  initialImageUrls?: string[]; // รูปเดิมที่มีอยู่แล้ว
  onClose: () => void;
  onSuccess: (imageUrl: string, statusText: string) => void;
}

type ScanStatus = 'idle' | 'uploading' | 'scanning' | 'success' | 'error';

export default function SlipScanner({ orderId, expectedAmount, initialImageUrls, onClose, onSuccess }: SlipScannerProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>(initialImageUrls || []);
  
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>(initialImageUrls || []);

  const [showCalc, setShowCalc] = useState(false);
  const [calcInput, setCalcInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialImageUrls && initialImageUrls.length > 0) {
      setPreviewUrls(initialImageUrls);
      setUploadedImageUrls(initialImageUrls);
    }
  }, [initialImageUrls]);

  const handleManualApprove = () => {
    setStatus('success');
    setTimeout(() => {
      onSuccess(uploadedImageUrls.join(','), "ไม่ผ่าน");
    }, 500);
  };

  /* ========================================================================
  🏦 จุดใส่ข้อมูลบัญชีร้าน (Whitelist)
  ========================================================================
  ใส่ "ชื่อบัญชี" หรือ "เลขบัญชี" ของร้านทุกบัญชีที่มีลงใน Array นี้ครับ
   ======================================================================== */
  const STORE_BANK_ACCOUNTS = [
    "นาย ชยณัฐ มาตยะขันธ์", // ตัวอย่างชื่อบัญชี
    "CHAYANAT M",
    "1391682697",// ตัวอย่างเลขกสิกร
    "0987654321",    // ตัวอย่างเลขไทยพาณิชย์
    "บริษัท คันบัง จำกัด",
    //"7740925861",    // ตัวอย่างเลขกรุงไทย
    
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
      setUploadedImageUrls(uploadedUrls); 

      setStatus('scanning');

      let totalExtractedAmount = 0;
      let isAccountValid = false;
      let ocrDebugText = ""; // 🌟 ตัวเก็บข้อความดิบไว้โชว์ตอน Error

      // 🌟 ฟังก์ชันเช็คว่ารหัสอ้างอิงนี้มีคนใช้ไปหรือยัง
      const checkSlipDuplicate = async (text: string): Promise<boolean> => {
        const refMatch = text.match(/[A-Z0-9]{20,}/i);
        if (!refMatch) return false;
        const { data } = await supabase.from('orders').select('id').ilike('details', `%${refMatch[0]}%`).neq('id', orderId);
        return !!(data && data.length > 0);
      };

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        const { data: { text } } = await Tesseract.recognize(
          file,
          'tha+eng'
        );

        ocrDebugText += text + "\n"; // เก็บข้อความไว้เผื่อ Error
        console.log("OCR Result Text:", text);

        const isDuplicate = await checkSlipDuplicate(text);
        if (isDuplicate) {
          throw new Error(`สลิปนี้ถูกใช้ไปแล้วในออเดอร์อื่น! 🛑`);
        }

        const cleanText = text.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ');
        const textNoSpaces = cleanText.replace(/\s+/g, '').toLowerCase();

        // 🌟 1. หาเลข 4 ตัวท้ายของบัญชีร้าน (แม่นที่สุดสำหรับออมสิน)
        const foundMatch = STORE_BANK_ACCOUNTS.some(acc => {
          const cleanAcc = acc.toLowerCase().replace(/\s+/g, '');
          
          if (/^\d+$/.test(cleanAcc) && cleanAcc.length >= 4) {
            const last4 = cleanAcc.slice(-4);
            // ถ้าเจอเลข 4 ตัวท้ายในสลิป (เช่น 2697) ให้ผ่านเลย!
            if (textNoSpaces.includes(last4)) return true;
          }

          // เผื่อไว้กรณีเช็คชื่อ 4 ตัวอักษรแรก
          const nameChunks = acc.split(/\s+/).filter(chunk => chunk.length >= 3);
          for (const chunk of nameChunks) {
            const prefix = chunk.toLowerCase().slice(0, 4);
            if (textNoSpaces.includes(prefix)) return true; 
          }
          return false;
        });

        if (foundMatch) isAccountValid = true;

        // 🌟 2. ดึงยอดเงิน (ควานหาตัวเลขทั้งหมด)
        let amount = 0;
        const fixedTextNoSpaces = textNoSpaces.replace(/[O]/gi, '0').replace(/[Il]/gi, '1').replace(/,/g, '');

        const allNumbers: number[] = [];
        const decMatches = [...fixedTextNoSpaces.matchAll(/(\d+)[.,](\d{2})/g)];
        decMatches.forEach(m => {
          const num = parseFloat(`${m[1]}.${m[2]}`);
          if (num > 0) allNumbers.push(num);
        });

        const intMatches = [...fixedTextNoSpaces.matchAll(/(\d+)/g)];
        intMatches.forEach(m => {
          const num = parseFloat(m[1]);
          if (num > 0) allNumbers.push(num);
        });

        const missingAmount = expectedAmount - totalExtractedAmount;

        if (allNumbers.length > 0) {
          if (allNumbers.includes(missingAmount) || allNumbers.includes(missingAmount * 100)) {
            amount = missingAmount;
          } else if (allNumbers.includes(expectedAmount) || allNumbers.includes(expectedAmount * 100)) {
            amount = expectedAmount;
          } else {
            const onlyDecimals = decMatches.map(m => parseFloat(`${m[1]}.${m[2]}`)).filter(n => n > 0);
            if (onlyDecimals.length > 0) amount = Math.max(...onlyDecimals);
          }
        }
        
        // ก๊อกสุดท้าย ถ้าหาไม่เจอจริงๆ ลองเช็คแบบโง่ๆ ว่ามียอดเงินอยู่ใน Text ไหม
        if (amount === 0 && fixedTextNoSpaces.includes(expectedAmount.toString())) {
            amount = expectedAmount;
        }

        totalExtractedAmount += amount;
      }

      // 🌟 3. โยน Error พร้อมข้อความที่ AI อ่านได้
      if (!isAccountValid) {
        throw new Error(`หาเลขบัญชีไม่เจอ!\n[ข้อความที่ AI อ่านได้]:\n${ocrDebugText.substring(0, 150)}...`);
      }

      const diff = totalExtractedAmount - expectedAmount;
      if (totalExtractedAmount === 0) {
        throw new Error(`AI มองไม่เห็นก้อนตัวเลขยอดเงิน!\n[ข้อความที่ AI อ่านได้]:\n${ocrDebugText.substring(0, 150)}...`);
      } else if (diff < 0) {
        throw new Error(`ยอดไม่ครบ! โอนมา ฿${totalExtractedAmount} (ขาด ฿${Math.abs(diff)})\n[ข้อความที่ AI อ่านได้]:\n${ocrDebugText.substring(0, 100)}...`);
      } else if (diff > 0) {
        throw new Error(`ยอดเกิน! โอนมา ฿${totalExtractedAmount} (เกิน ฿${diff})\n[ข้อความที่ AI อ่านได้]:\n${ocrDebugText.substring(0, 100)}...`);
      }
  
      setStatus('success');
      setTimeout(() => {
        onSuccess(uploadedUrls.join(','), "ผ่าน"); 
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

  const handleClearAndReset = () => {
    setFiles([]);
    setPreviewUrls([]);
    setUploadedImageUrls([]);
    setStatus('idle');
    setErrorMessage('');
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
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col gap-3 shadow-inner relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-1">ยอดเรียกเก็บ (จากบิล)</p>
                <p className="text-sm font-bold text-slate-600">ออเดอร์: <span className="text-slate-800">{orderId.slice(0, 8)}...</span></p>
              </div>
              <div className="text-3xl font-black text-emerald-600">
                ฿{expectedAmount.toLocaleString()}
              </div>
            </div>
            
            <button 
              onClick={() => setShowCalc(!showCalc)}
              className="absolute top-2 right-2 p-1.5 text-emerald-500 hover:bg-emerald-100 rounded-lg transition-colors"
              title="เปิด/ปิดเครื่องคิดเลข"
            >
              <Calculator size={18} />
            </button>

            {showCalc && (
              <div className="mt-2 pt-3 border-t border-emerald-200/50 flex flex-col gap-2 animate-in slide-in-from-top-2">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={calcInput}
                    readOnly
                    className="flex-1 bg-white border border-emerald-200 rounded-xl px-3 py-2 text-right font-mono font-bold text-slate-700 outline-none"
                    placeholder="0"
                  />
                  <button 
                    onClick={() => {
                      try {
                        if (!/^[0-9+\-*/.]+$/.test(calcInput)) {
                          setCalcInput("Error");
                          return;
                        }
                        const result = new Function('return ' + calcInput)();
                        setCalcInput(String(result));
                      } catch {
                        setCalcInput("Error");
                      }
                    }}
                    className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 active:scale-95 transition-all shadow-sm flex items-center justify-center w-12"
                  >
                    <Equal size={16} />
                  </button>
                  <button 
                    onClick={() => setCalcInput("")}
                    className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 active:scale-95 transition-all shadow-sm flex items-center justify-center w-12"
                  >
                    <Delete size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','+'].map(btn => (
                    <button
                      key={btn}
                      onClick={() => setCalcInput(prev => prev === "Error" ? btn : prev + btn)}
                      className={`py-1.5 rounded-lg font-mono font-bold text-sm transition-colors active:scale-95 ${
                        ['/','*','-','+'].includes(btn) 
                          ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                          : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50'
                      } ${btn === '0' ? 'col-span-2' : ''}`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex flex-col items-center justify-center text-center animate-in fade-in w-full">
                  <AlertCircle size={28} className="text-rose-500 mb-2 shrink-0" />
                  {/* 🌟 เปลี่ยน text-center เป็น text-left และเพิ่ม whitespace-pre-line ให้โชว์ Debug ได้สวยๆ */}
                  <div className="w-full text-left bg-white p-3 rounded-lg border border-rose-100 mb-3 shadow-inner">
                    <p className="text-rose-700 font-bold text-xs whitespace-pre-line break-all leading-relaxed">
                      {errorMessage}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2 w-full mt-1">
                    <button 
                      onClick={() => setStatus('idle')}
                      className="w-full py-2.5 bg-white border border-rose-200 text-rose-600 font-bold rounded-xl shadow-sm text-sm hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      ตรวจสอบใหม่อีกครั้ง
                    </button>
                    
                    <button 
                      onClick={handleManualApprove}
                      className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-sm text-sm hover:bg-emerald-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ShieldCheck size={16} /> บันทึกสลิปโดยละเว้นการตรวจยอด
                    </button>

                    <button 
                      onClick={handleClearAndReset}
                      className="w-full py-2.5 bg-rose-100 text-rose-600 font-bold rounded-xl shadow-sm text-sm hover:bg-rose-200 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <X size={16} /> ลบรูปทั้งหมดและเริ่มใหม่
                    </button>
                  </div>
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
