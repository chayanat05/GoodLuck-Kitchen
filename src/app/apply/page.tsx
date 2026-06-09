// apply/page.tsx
"use client";
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { UploadCloud, CheckCircle2, Loader2, AlertCircle, X, Trash2, ZoomIn } from "lucide-react";
import Image from "next/image";

export default function ApplyRiderPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmittingSuccess] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 🌟 State สำหรับดูรูปเต็มจอ
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [formData, setFormData] = useState({
    faculty: "",
    full_name: "",
    age: "",
    fb_profile_image: "",
    phone_number: "",
    vehicle_model: "",
    driving_license_status: "",
    experience_and_area: "",
    start_date_and_commitment: "",
    availability: "",
    handle_pressure: "",
    current_address: "",
    family_approval: "",
    late_night_shift: "",
  });

  const processFile = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      alert("ไฟล์ขนาดใหญ่เกินไป (สูงสุด 100MB)");
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น");
      return;
    }

    setUploadingImage(true);
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `fb-profile-${Date.now()}.${fileExt}`;
    
    try {
      const { error } = await supabase.storage
        .from('rider-applications')
        .upload(fileName, file);
      
      if (error) throw error;

      const { data } = supabase.storage.from('rider-applications').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, fb_profile_image: data.publicUrl }));
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
      console.error(error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    await processFile(file);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          await processFile(file);
          break; // อัปโหลดทีละไฟล์
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fb_profile_image) {
      alert("กรุณาอัปโหลดรูปโปรไฟล์เฟสบุ๊ก");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('rider_applications')
        .insert([{ ...formData, age: parseInt(formData.age) }]);

      if (error) throw error;
      setIsSubmittingSuccess(true);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการส่งใบสมัคร กรุณาลองใหม่อีกครั้ง");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg max-w-md w-full text-center animate-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">ส่งใบสมัครสำเร็จ!</h2>
          <p className="text-slate-500 mb-6">ทางร้านได้รับข้อมูลของคุณแล้ว หากผ่านการพิจารณาจะติดต่อกลับไปทางช่องทางที่ระบุไว้ครับ</p>
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
            กลับไปหน้าแรก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 font-sans" onPaste={handlePaste}>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          
          <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            <h1 className="text-3xl font-black tracking-tight mb-2 relative z-10">แบบฟอร์ม สมัครไรเดอร์ 🛵</h1>
            <div className="bg-rose-500/20 border border-rose-500/50 p-4 rounded-xl mt-4 relative z-10">
              <p className="text-sm leading-relaxed font-medium">
                <AlertCircle size={16} className="inline mr-1 -mt-0.5 text-rose-300" />
                ขอคนที่ทักหาเเล้วตอบกลับนะครับ ถ้าทักไปหาเเล้วไม่สมัครรบกวนไม่กรอกไว้นะครับ <br/>
                ร้านอยู่ขามเรียงนะครับ มมส. หน้าที่ ส่งอาหาร ซื้อของให้กับร้าน มาสมัครเล่นไม่ต้องกรอกนะครับ <strong className="text-rose-200">ขอคนพร้อมทำงานเท่านั้น</strong>
              </p>
            </div>
            <p className="text-xs text-slate-400 mt-4">* ระบุว่าเป็นคําถามที่จําเป็น</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            
            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">ได้เรียนมั้ย อยู่คณะไหนครับ <span className="text-rose-500">*</span></label>
              <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.faculty} onChange={e => setFormData({...formData, faculty: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">ชื่อ นามสกุล <span className="text-rose-500">*</span></label>
              <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">อายุ <span className="text-rose-500">*</span></label>
              <input required type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            {/* 🌟 ปรับปรุงส่วนอัปโหลดและแสดงรูปภาพ */}
            <div className="space-y-2 p-4 border border-slate-200 rounded-2xl bg-slate-50/50">
              <label className="block text-sm font-black text-slate-800">
                รูปถ่าย หน้าโปรไฟล์เฟสบุ้ค <span className="text-rose-500">*</span>
                <span className="block text-xs font-normal text-slate-500 mt-1">(เเคปให้เห็นชื่อเฟสเเละโปรไฟล์ด้วยนะครับ) ร้านจะได้ติดต่อกลับถูกคนครับ</span>
              </label>
              <div 
                onClick={() => !formData.fb_profile_image && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-2 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all ${
                  formData.fb_profile_image 
                    ? 'border-emerald-400 bg-emerald-50' 
                    : isDragging 
                      ? 'border-blue-500 bg-blue-100 cursor-copy' 
                      : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                }`}
              >
                {uploadingImage ? (
                  <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
                ) : formData.fb_profile_image ? (
                  <div className="relative w-full max-w-xs aspect-3/4 rounded-xl overflow-hidden shadow-sm group border-4 border-white">
                    <Image 
                      src={formData.fb_profile_image} 
                      alt="FB Profile" 
                      fill 
                      className="object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-300" 
                      onClick={(e) => { e.stopPropagation(); setSelectedFullImage(formData.fb_profile_image); }} 
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <ZoomIn className="text-white" size={32} />
                    </div>
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); setFormData({...formData, fb_profile_image: ""}); }} 
                      className="absolute top-2 right-2 bg-rose-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 shadow-md cursor-pointer"
                      title="ลบรูปภาพ"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud className={`${isDragging ? 'text-blue-500' : 'text-slate-400'} mb-2`} size={32} />
                    <span className="text-sm font-bold text-slate-600 text-center">
                      {isDragging ? 'วางรูปภาพที่นี่' : 'คลิกอัปโหลด หรือลากวาง / คัดลอกแล้ววางรูปภาพ (สูงสุด 100MB)'}
                    </span>
                  </>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">หมายเลขโทรศัพท์ <span className="text-rose-500">*</span></label>
              <input required type="tel" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">มีรถยี่ห้ออะไรใช้วิ่งงาน <span className="text-rose-500">*</span></label>
              <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.vehicle_model} onChange={e => setFormData({...formData, vehicle_model: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-black text-slate-800">มีใบขับขี่เเละพรบ.ครบถ้วนมั้ย <span className="text-rose-500">*</span></label>
              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {["มีแค่ใบขับขี่", "มีแค่พรบ.", "มีทั้ง 2 อย่าง", "ไม่มีทั้ง 2 อย่าง"].map((option) => (
                  <label key={option} className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="license" value={option} required
                      checked={formData.driving_license_status === option}
                      onChange={e => setFormData({...formData, driving_license_status: e.target.value})}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">เคยเป็นไรเดอร์หรือไม่ พอรู้จักเส้นทางในพื้นที่มมส.มั้ยครับ <span className="text-rose-500">*</span></label>
              <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.experience_and_area} onChange={e => setFormData({...formData, experience_and_area: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">สามารถเริ่มงานได้เมื่อไหร่ คิดว่าทำครบสัญญามั้ยครับ 10 เดือน <span className="text-rose-500">*</span></label>
              <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.start_date_and_commitment} onChange={e => setFormData({...formData, start_date_and_commitment: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">มีเวลาว่างมั้ยครับ ต้องทำงาน 4-5 วันต่อสัปดาห์ <span className="text-rose-500">*</span></label>
              <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.availability} onChange={e => setFormData({...formData, availability: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">รับงานเร่งด่วนหรือเเรงกดดันจากลูกค้าได้หรือไม่ <span className="text-rose-500">*</span></label>
              <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.handle_pressure} onChange={e => setFormData({...formData, handle_pressure: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">ที่อยู่ปัจจุบัน พักอาศัย อยู่ที่ไหนครับ <span className="text-rose-500">*</span></label>
              <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.current_address} onChange={e => setFormData({...formData, current_address: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">ครอบครัวไม่มีปัญหาในการทำงานใช่มั้ยครับ <span className="text-rose-500">*</span></label>
              <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.family_approval} onChange={e => setFormData({...formData, family_approval: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-800">ทำงานดึกได้ใช่มั้ยครับ 19.00-04.00 <span className="text-rose-500">*</span></label>
              <input required type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={formData.late_night_shift} onChange={e => setFormData({...formData, late_night_shift: e.target.value})} placeholder="คำตอบของคุณ" />
            </div>

            <div className="pt-6 border-t border-slate-100">
              <button 
                type="submit" 
                disabled={isSubmitting || uploadingImage}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:bg-slate-400 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : "ส่งใบสมัคร"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 🌟 Modal โชว์รูปเต็มจอสำหรับผู้สมัคร */}
      {selectedFullImage && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedFullImage(null)}>
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