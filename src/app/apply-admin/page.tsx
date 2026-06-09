"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { 
  ShieldCheck, AlertCircle, CheckCircle2, 
  Loader2, Trash2 
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

interface AdminFormData {
  full_name: string;
  age: string;
  phone_number: string;
  fb_profile_image: string;
  address_commute: string;
  faculty_year: string;
  prev_admin_exp: string;
  typing_speed_focus: string;
  availability: string;
  about_me: string;
}

interface FieldProps {
  label: string;
  name: keyof AdminFormData;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  textarea?: boolean;
  required?: boolean;
}

export default function ApplyAdminPage() {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);

  const [formData, setFormData] = useState<AdminFormData>({
    full_name: "",
    age: "",
    phone_number: "",
    fb_profile_image: "",
    address_commute: "",
    faculty_year: "",
    prev_admin_exp: "",
    typing_speed_focus: "",
    availability: "4-6 วัน",
    about_me: "",
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const processFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("ไฟล์ขนาดใหญ่เกินไป (สูงสุด 10MB)"); return; }
    if (!file.type.startsWith('image/')) { toast.error("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น"); return; }
    
    setUploadingImage(true);
    const fileName = `admin-profile-${Date.now()}.${file.name.split('.').pop()}`;
    
    try {
      const { error: uploadError } = await supabase.storage.from('rider-applications').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('rider-applications').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, fb_profile_image: data.publicUrl }));
      toast.success("อัปโหลดรูปภาพสำเร็จ");
    } catch (error) {
      console.error(error);
      toast.error("อัปโหลดไฟล์ล้มเหลว");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.fb_profile_image) { toast.error("กรุณาอัปโหลดรูปโปรไฟล์"); return; }

    setIsSubmitting(true);
    const { error } = await supabase
      .from('admin_applications')
      .insert([{ ...formData, age: parseInt(formData.age) || 0 }]);

    if (!error) setIsSuccess(true);
    else toast.error("เกิดข้อผิดพลาดในการส่งข้อมูล");
    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-4xl shadow-2xl max-w-md w-full text-center">
          <CheckCircle2 size={60} className="text-emerald-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black mb-4 text-slate-800">ส่งใบสมัครแอดมินสำเร็จ!</h2>
          <p className="text-slate-600 mb-8">หลังจากกรอกครบเดี๋ยวร้านทักหาตามชื่อเฟสบุ๊คที่กรอกนะคะ ขอบคุณค่า</p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black transition-all hover:bg-slate-800 active:scale-95">กลับหน้าแรก</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 px-4 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-t-4xl p-10 text-white shadow-lg">
          <ShieldCheck size={48} className="mb-4" />
          <h1 className="text-4xl font-black mb-3">แบบฟอร์มสมัครแอดมิน</h1>
          <p className="text-indigo-100 font-medium">ร่วมงานกับร้าน GoodLuck Kitchen ในฐานะทีมแอดมินดูแลลูกค้า</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-b-4xl shadow-xl p-8 space-y-8 border-x border-b border-slate-200">
          <div className="text-xs font-black text-rose-500 text-right uppercase tracking-widest">* ระบุว่าเป็นคำถามที่จำเป็น</div>
          
          {/* 🌟 Warning Banner */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-2xl">
            <div className="flex items-start gap-4">
              <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={24} />
              <div className="text-sm font-bold text-amber-800 leading-relaxed space-y-2">
                <p>ขอความกรุณา <span className="text-rose-600 font-black">ไม่พร้อมทำงานไม่ต้องกรอกสมัครนะคะ</span> จะเสียโอกาสคนอื่น ขอบคุณค่า</p>
                <p>รบกวนมาตามนัดด้วยนะคะ หากคิดว่าไม่ไหวตั้งเเต่เเรกไม่ต้องสมัครเลยนะคะ งานไม่สบายนะคะ</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <Field label="ชื่อ-นามสกุล" name="full_name" value={formData.full_name} onChange={handleChange} />
            <Field label="อายุ" name="age" value={formData.age} onChange={handleChange} type="number" />
            <Field label="เบอร์โทรศัพท์" name="phone_number" value={formData.phone_number} onChange={handleChange} />
            
            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-700">รูปถ่ายโปรไฟล์เฟสบุ๊ค <span className="text-rose-500">*</span>
              <span className="block text-xs font-normal text-slate-500 mt-1">(แคปให้เห็นชื่อเฟสเเละโปรไฟล์ด้วยนะครับ ร้านจะได้ติดต่อกลับถูกคนนะคะ)</span></label>
              
              <input 
                type="file" 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer text-slate-600" 
              />
              
              {uploadingImage && (
                <div className="flex items-center gap-2 text-sm font-bold text-indigo-500 mt-2">
                  <Loader2 className="animate-spin" size={16} /> กำลังอัปโหลด...
                </div>
              )}
              
              {formData.fb_profile_image && !uploadingImage && (
                <div className="relative w-40 h-40 mt-4 rounded-xl overflow-hidden border-4 border-white shadow-lg">
                  <Image src={formData.fb_profile_image} alt="Profile" fill className="object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, fb_profile_image: ""})} 
                    className="absolute top-2 right-2 bg-rose-500 text-white p-2 rounded-full opacity-100 transition-opacity hover:bg-rose-600 shadow-md cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            <Field label="ที่อยู่ปัจจุบัน หอไหน เดินทางสะดวกมั้ย" name="address_commute" value={formData.address_commute} onChange={handleChange} />
            <Field label="เรียนอยู่คณะไหน ปีไหน" name="faculty_year" value={formData.faculty_year} onChange={handleChange} />
            <Field label="เคยทำงานแอดมินมาก่อนหรือไม่" name="prev_admin_exp" value={formData.prev_admin_exp} onChange={handleChange} />
            <Field label="พิมพ์ตอบแชทเร็วไหม มีสมาธิมั้ย" name="typing_speed_focus" value={formData.typing_speed_focus} onChange={handleChange} />
            
            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-700">ทำงานได้กี่วันต่อสัปดาห์</label>
              <select name="availability" value={formData.availability} onChange={(e) => setFormData({...formData, availability: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="4 วัน">4 วัน</option>
                <option value="5 วัน">5 วัน</option>
                <option value="6 วัน">6 วัน</option>
              </select>
            </div>

            <Field label="แนะนำตัว / ทักษะเพิ่มเติม" name="about_me" value={formData.about_me} onChange={handleChange} textarea />
          </div>

          {/* 🌟 รายละเอียดเงื่อนไขร้านที่ต้องการ */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 space-y-4">
            <p>ขอบคุณทุกคนที่ให้ข้อมูลนะคะ เจ้าของร้านเเละเพื่อนๆใจดีมากกก ไว้มาทำงานร่วมกันนะคะ หลังจากกรอกครบเดี๋ยวร้านทักหาตามชื่อเฟสบุ๊คที่กรอกด้านบนนะคะ</p>
            <p>ร้านจะให้ทุกคนมาลองงานนะคะ อยู่เเล้วว่าใครทำได้ไม่ได้อีกทีนะคะ หากคิดว่าไม่ไหวตั้งเเต่เเรกไม่ต้องสมัครเลยนะคะ งานไม่สบายนะคะ เเต่มีเพื่อนๆพี่ๆน้องๆ คอยช่วยเหลือตลอดเเน่นอนค่ะ ร้านจ่ายเงินรายวันตรงเวลาตามชั่วโมงงานครบถ้วนยุติธรรมมากๆค่า</p>
            <p className="text-rose-600 border-t border-slate-200 pt-4">ทดลองงาน 1 สัปดาห์ จ่ายเงินหลังทดลองครบนะคะ ชั่วโมงละ 35.-ค้า</p>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 disabled:bg-slate-400">
            {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : "ส่งใบสมัครแอดมิน"}
          </button>
        </form>
      </div>

      {selectedFullImage && (
        <div className="fixed inset-0 bg-slate-900/90 z-[300] flex items-center justify-center p-4" onClick={() => setSelectedFullImage(null)}>
          <Image src={selectedFullImage} alt="Full" width={600} height={800} className="object-contain" />
        </div>
      )}
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text", textarea = false, required = true }: FieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-black text-slate-700">{label} {required && <span className="text-rose-500">*</span>}</label>
      {textarea ? (
        <textarea name={name} value={value} onChange={onChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" />
      ) : (
        <input type={type} name={name} value={value} onChange={onChange} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" required={required} />
      )}
    </div>
  );
}