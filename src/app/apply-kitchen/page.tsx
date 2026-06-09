"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  ChefHat,
  Upload,
  Send,
  AlertCircle,
  Info,
  CheckCircle2,
  MapPin,
  Phone,
  User,
  Clock,
  GraduationCap,
  Loader2,
  X,
  ZoomIn,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export default function ApplyKitchenPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State สำหรับดูรูปเต็มจอ
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    fb_profile_image: "",
    phone_number: "",
    current_address: "",
    can_commute: "",
    education: "",
    experience: "",
    can_work_late: "",
    family_approval: "",
    handle_pressure: "",
    start_date: "",
    days_per_week: "4 วัน",
    about_me: "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const processFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("ไฟล์ขนาดใหญ่เกินไป (สูงสุด 10MB)");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น");
      return;
    }

    setUploadingImage(true);
    const fileExt = file.name.split(".").pop() || "png";
    const fileName = `kitchen-profile-${Date.now()}.${fileExt}`;

    try {
      // 🌟 ใช้ Bucket เดิมของไรเดอร์ได้เลย จะได้ไม่ต้องสร้างใหม่
      const { error } = await supabase.storage
        .from("rider-applications")
        .upload(fileName, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from("rider-applications")
        .getPublicUrl(fileName);
      setFormData((prev) => ({ ...prev, fb_profile_image: data.publicUrl }));
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
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          await processFile(file);
          break;
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fb_profile_image) {
      alert(
        "กรุณาอัปโหลดรูปโปรไฟล์เฟสบุ๊ก เพื่อให้ร้านติดต่อกลับได้ถูกต้องนะคะ",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("kitchen_applications")
        .insert([formData]);

      if (error) throw error;
      setIsSuccess(true);
      toast.success("ส่งใบสมัครเรียบร้อยแล้ว!");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการส่งใบสมัคร กรุณาลองใหม่อีกครั้ง");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-10 rounded-4xl shadow-2xl max-w-md w-full text-center animate-in zoom-in duration-500">
          <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">
            ส่งใบสมัครสำเร็จ!
          </h2>
          <p className="text-slate-600 font-medium mb-8 leading-relaxed">
            ขอบคุณที่ให้ความสนใจร่วมงานกับเรา <br />
            ทางร้านจะพิจารณาและติดต่อกลับไปทาง Facebook ที่แนบมานะคะ
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black hover:bg-rose-600 transition-colors shadow-lg active:scale-95"
          >
            กลับไปหน้าแรก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#f8fafc] py-10 px-4 sm:px-6 lg:px-8 font-sans"
      onPaste={handlePaste}
    >
      <div className="max-w-3xl mx-auto">
        {/* 🌟 Header Section */}
        <div className="bg-linear-to-br from-rose-500 to-orange-500 rounded-t-4xl p-8 sm:p-12 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
            <ChefHat size={250} />
          </div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-white/30">
              <ChefHat size={32} className="text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">
              แบบฟอร์มสมัครผู้ช่วยแม่ครัว
            </h1>
            <p className="text-rose-100 font-medium text-sm sm:text-base leading-relaxed max-w-xl">
              ร้านเราจ่ายเงินรายวันตรงเวลาตามชั่วโมงงานครบถ้วนยุติธรรมมากๆ{" "}
              <br />
              เพื่อนๆ พี่ๆ น้องๆ และเจ้าของร้านใจดี คอยช่วยเหลือตลอดแน่นอนค่า
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-b-4xl shadow-xl border-x border-b border-slate-200 overflow-hidden"
        >
          {/* 🌟 Warning Banner */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-6 m-6 rounded-2xl">
            <div className="flex items-start gap-4">
              <AlertCircle
                className="text-amber-500 shrink-0 mt-0.5"
                size={24}
              />
              <div className="text-sm font-bold text-amber-800 leading-relaxed space-y-2">
                <p>
                  ขอความกรุณา{" "}
                  <span className="text-rose-600 font-black">
                    ไม่พร้อมทำงานไม่ต้องกรอกสมัครนะคะ
                  </span>{" "}
                  จะเสียโอกาสคนอื่น ขอบคุณค่า
                </p>
                <p>
                  รบกวนมาตามนัดด้วยนะคะ ร้านอยู่{" "}
                  <span className="font-black underline decoration-amber-300 decoration-2">
                    ม.ใหม่ ขามเรียง
                  </span>{" "}
                  ค่า
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            <div className="text-xs font-black text-rose-500 text-right tracking-widest uppercase">
              * ระบุว่าเป็นคำถามที่จำเป็น
            </div>

            {/* 1. ชื่อ นามสกุล */}
            <div className="space-y-3">
              <label className="flex items-center text-sm font-black text-slate-700">
                <User size={16} className="mr-2 text-slate-400" /> ชื่อ นามสกุล{" "}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <input
                required
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all shadow-sm"
                placeholder="กรอกชื่อและนามสกุลจริง"
              />
            </div>

            {/* 2. รูปถ่ายโปรไฟล์ */}
            <div className="space-y-3">
              <label className="block text-sm font-black text-slate-700">
                รูปถ่าย หน้าโปรไฟล์เฟสบุ๊ค{" "}
                <span className="text-rose-500 ml-1">*</span>
                <p className="text-xs text-slate-500 mt-1 font-sans font-normal">
                  (แคปให้เห็นชื่อเฟสและโปรไฟล์ด้วยนะคะ ร้านจะได้ติดต่อกลับถูกคน)
                </p>
              </label>
              <div
                onClick={() =>
                  !formData.fb_profile_image && fileInputRef.current?.click()
                }
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-2 border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center transition-all ${
                  formData.fb_profile_image
                    ? "border-emerald-400 bg-emerald-50"
                    : isDragging
                      ? "border-rose-500 bg-rose-100 cursor-copy"
                      : "border-slate-300 hover:border-rose-400 hover:bg-rose-50 cursor-pointer bg-slate-50"
                }`}
              >
                {uploadingImage ? (
                  <Loader2
                    className="animate-spin text-rose-500 mb-2"
                    size={32}
                  />
                ) : formData.fb_profile_image ? (
                  <div className="relative w-full max-w-xs aspect-3/4 rounded-2xl overflow-hidden shadow-sm group border-4 border-white">
                    <Image
                      src={formData.fb_profile_image}
                      alt="FB Profile"
                      fill
                      sizes="100vw"
                      className="object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFullImage(formData.fb_profile_image);
                      }}
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <ZoomIn className="text-white" size={32} />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData({ ...formData, fb_profile_image: "" });
                      }}
                      className="absolute top-2 right-2 bg-rose-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 shadow-md cursor-pointer"
                      title="ลบรูปภาพ"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload
                      className={`${isDragging ? "text-rose-500" : "text-slate-400"} mb-3`}
                      size={36}
                    />
                    <span className="text-sm font-bold text-slate-600 text-center">
                      {isDragging
                        ? "วางรูปภาพที่นี่เลย!"
                        : "คลิกอัปโหลด หรือลากวาง / คัดลอกแล้ววางรูปภาพ (สูงสุด 10MB)"}
                    </span>
                  </>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* 3. เบอร์โทร */}
            <div className="space-y-3">
              <label className="flex items-center text-sm font-black text-slate-700">
                <Phone size={16} className="mr-2 text-slate-400" />{" "}
                หมายเลขโทรศัพท์ <span className="text-rose-500 ml-1">*</span>
              </label>
              <input
                required
                type="tel"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all shadow-sm"
                placeholder="08X-XXX-XXXX"
              />
            </div>

            {/* 4. ที่อยู่ */}
            <div className="space-y-3">
              <label className="flex items-center text-sm font-black text-slate-700">
                <MapPin size={16} className="mr-2 text-slate-400" /> ที่อยู่
                พักปัจจุบัน หอไหนคะ{" "}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <input
                required
                type="text"
                name="current_address"
                value={formData.current_address}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all shadow-sm"
                placeholder="ระบุชื่อหอพัก หรือหมู่บ้าน"
              />
            </div>

            {/* 5. การเดินทาง */}
            <div className="space-y-3">
              <label className="block text-sm font-black text-slate-700">
                สะดวกเดินทางมาทำงานใช่มั้ยคะ{" "}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex-1 relative">
                  <input
                    type="radio"
                    name="can_commute"
                    value="สะดวก"
                    required
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-all peer-checked:bg-rose-50 peer-checked:border-rose-500 peer-checked:ring-2 peer-checked:ring-rose-500/20 text-center font-bold text-slate-600 peer-checked:text-rose-700 text-sm">
                    🚗 สะดวก
                  </div>
                </label>
                <label className="flex-1 relative">
                  <input
                    type="radio"
                    name="can_commute"
                    value="ไม่สะดวก"
                    required
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-all peer-checked:bg-slate-800 peer-checked:border-slate-900 peer-checked:ring-2 peer-checked:ring-slate-900/20 text-center font-bold text-slate-600 peer-checked:text-white text-sm">
                    ❌ ไม่สะดวก
                  </div>
                </label>
              </div>
            </div>

            {/* 6. การศึกษา */}
            <div className="space-y-3">
              <label className="flex items-center text-sm font-black text-slate-700">
                <GraduationCap size={16} className="mr-2 text-slate-400" />{" "}
                เรียนอยู่คณะไหน ปีไหนคะ{" "}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <input
                required
                type="text"
                name="education"
                value={formData.education}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all shadow-sm"
                placeholder="เช่น วิศวะ ปี 3, ไม่ได้เรียนแล้ว ฯลฯ"
              />
            </div>

            {/* 7. ประสบการณ์ */}
            <div className="space-y-3">
              <label className="block text-sm font-black text-slate-700">
                มีประสบการณ์ เคยทำอาหารมาก่อนมั้ยคะ
                หรือทำงานอย่างอื่นมาก่อนมั้ยคะ{" "}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <textarea
                required
                rows={3}
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all resize-none shadow-sm"
                placeholder="เล่าประสบการณ์สั้นๆ ให้เราฟังหน่อย..."
              />
            </div>

            {/* 8. ทำงานดึก */}
            <div className="space-y-3">
              <label className="block text-sm font-black text-slate-700">
                ทำงานดึกได้มั้ย มีความอดทนทำงานหนักได้ใช่มั้ยคะ{" "}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex-1 relative">
                  <input
                    type="radio"
                    name="can_work_late"
                    value="ทำได้ สบายมาก"
                    required
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-all peer-checked:bg-rose-50 peer-checked:border-rose-500 peer-checked:ring-2 peer-checked:ring-rose-500/20 text-center font-bold text-slate-600 peer-checked:text-rose-700 text-sm flex flex-col items-center gap-1">
                    <span className="text-lg">💪</span> ทำได้ ทนไหว!
                  </div>
                </label>
                <label className="flex-1 relative">
                  <input
                    type="radio"
                    name="can_work_late"
                    value="ทำไม่ได้"
                    required
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-all peer-checked:bg-slate-800 peer-checked:border-slate-900 peer-checked:ring-2 peer-checked:ring-slate-900/20 text-center font-bold text-slate-600 peer-checked:text-white text-sm flex flex-col items-center gap-1">
                    <span className="text-lg">😴</span> ไม่ไหว
                  </div>
                </label>
              </div>
            </div>

            {/* 9. ครอบครัวอนุญาต */}
            <div className="space-y-3">
              <label className="block text-sm font-black text-slate-700">
                ครอบครัวให้ทำมั้ยคะ ไม่มีปัญหาอะไรใช่มั้ยคะ{" "}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex-1 relative">
                  <input
                    type="radio"
                    name="family_approval"
                    value="ให้ทำ ไม่มีปัญหา"
                    required
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-all peer-checked:bg-rose-50 peer-checked:border-rose-500 peer-checked:ring-2 peer-checked:ring-rose-500/20 text-center font-bold text-slate-600 peer-checked:text-rose-700 text-sm">
                    ✅ ไม่มีปัญหา
                  </div>
                </label>
                <label className="flex-1 relative">
                  <input
                    type="radio"
                    name="family_approval"
                    value="มีปัญหา"
                    required
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-all peer-checked:bg-slate-800 peer-checked:border-slate-900 peer-checked:ring-2 peer-checked:ring-slate-900/20 text-center font-bold text-slate-600 peer-checked:text-white text-sm">
                    ❌ อาจมีปัญหา
                  </div>
                </label>
              </div>
            </div>

            {/* 10. เวลางาน */}
            <div className="space-y-3">
              <label className="block text-sm font-black text-slate-700 leading-relaxed">
                งานเป็นงานดึกและทำงานต่อเนื่องตลอดเวลาคิดว่าไหวมั้ย? <br />
                <span className="text-rose-500 text-xs">
                  (เวลาเข้างาน กะเช้า 07:00 - 17.00 น. โดยประมาณ)
                  <br />(กะกลางคืน 15.30 - 23.30 น. โดยประมาณ)
                </span>{" "}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex-1 relative">
                  <input
                    type="radio"
                    name="handle_pressure"
                    value="ไหวแน่นอน"
                    required
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-all peer-checked:bg-rose-50 peer-checked:border-rose-500 peer-checked:ring-2 peer-checked:ring-rose-500/20 text-center font-bold text-slate-600 peer-checked:text-rose-700 text-sm">
                    🔥 ไหวแน่นอน
                  </div>
                </label>
                <label className="flex-1 relative">
                  <input
                    type="radio"
                    name="handle_pressure"
                    value="ไม่น่าไหว"
                    required
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer transition-all peer-checked:bg-slate-800 peer-checked:border-slate-900 peer-checked:ring-2 peer-checked:ring-slate-900/20 text-center font-bold text-slate-600 peer-checked:text-white text-sm">
                    🏃 ไม่น่าไหว
                  </div>
                </label>
              </div>
            </div>

            {/* 11. เริ่มงานวันไหน */}
            <div className="space-y-3">
              <label className="flex items-center text-sm font-black text-slate-700">
                <Clock size={16} className="mr-2 text-slate-400" />{" "}
                พร้อมเริ่มงานวันไหนคะ พร้อมเรียนรู้งานมั้ยคะ{" "}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <input
                required
                type="text"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all shadow-sm"
                placeholder="เช่น เริ่มได้ทันที พร้อมเรียนรู้มากค่ะ"
              />
            </div>

            {/* 12. วันทำงานต่อสัปดาห์ */}
            <div className="space-y-3">
              <label className="block text-sm font-black text-slate-700">
                สะดวกทำงานกี่วันต่อสัปดาห์คะ{" "}
                <span className="text-rose-500 ml-1">*</span>
                <p className="text-xs font-medium text-slate-500 mt-1 font-sans">
                  (ร้านเราจะได้ทำงานประมาณ 4-5 วันนะคะ)
                </p>
              </label>
              <select
                required
                name="days_per_week"
                value={formData.days_per_week}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all cursor-pointer shadow-sm appearance-none"
              >
                <option value="1-3 วัน">1-3 วัน (อาจจะไม่พอนะคะ)</option>
                <option value="4 วัน">4 วัน</option>
                <option value="5 วัน">5 วัน</option>
                <option value="6-7 วัน">6-7 วัน (พร้อมลุย!)</option>
              </select>
            </div>

            {/* 13. อธิบายตัวเอง */}
            <div className="space-y-3">
              <label className="block text-sm font-black text-slate-700">
                อธิบายตัวเอง คร่าวๆได้เลยค้า (หรือไม่อธิบายก็ได้ค่ะ)
              </label>
              <textarea
                rows={3}
                name="about_me"
                value={formData.about_me}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all resize-none shadow-sm"
                placeholder="พิมพ์ข้อความแนะนำตัว..."
              />
            </div>
          </div>

          {/* 🌟 Footer Info & Submit */}
          <div className="bg-slate-50 p-6 sm:p-10 border-t border-slate-200 space-y-8">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3 text-rose-500 font-black text-lg">
                <Info size={24} /> ข้อมูลการทำงาน
              </div>
              <ul className="space-y-3 text-sm font-bold text-slate-600 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-emerald-500">✔</span> จะได้ช่วยทำอาหาร
                  เตรียมของ ล้างของ ช่วยชงน้ำ
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-500">✔</span> ชั่วโมงละ 40.-
                  (นับตามชม.ที่ทำจริง วันละ 400+)
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-500">✔</span> จะได้มาฝึกงาน 4
                  วัน (ทุกคนที่สมัคร) ช่วงฝึกงานจ่ายชม.ละ 35.-
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-500">✔</span>{" "}
                  ขอคนที่อยู่กับคนอื่นได้ อยู่กับแม่ครัว ไรเดอร์ได้
                  ทนแรงกดดันได้
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-500">✔</span>{" "}
                  งานทำได้ต่อเนื่องเลยค่ะร้านไม่ปิดไปไหน (ทำงานไม่บ่น
                  ไม่เกี่ยงงาน)
                </li>
              </ul>
              <p className="text-xs text-slate-400 font-medium pt-4 border-t border-slate-100">
                หลังจากกรอกครบเดี๋ยวร้านทักหาตามชื่อเฟสบุ๊คที่กรอกด้านบนนะคะ
                ร้านจะให้ทุกคนมาลองงานนะคะ ค่อยดูว่าใครทำได้ไม่ได้อีกที
                หากคิดว่าไม่ไหวตั้งแต่แรกไม่ต้องสมัครเลยนะคะ งานไม่สบายนะคะ
                ขอบคุณค่าาา 🙏
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || uploadingImage}
              className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-lg transition-all shadow-lg shadow-rose-500/30 flex items-center justify-center gap-3 active:scale-95 disabled:bg-slate-400 disabled:shadow-none cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  ส่งใบสมัครงาน <Send size={20} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 🌟 Modal โชว์รูปเต็มจอสำหรับผู้สมัคร */}
      {selectedFullImage && (
        <div
          className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedFullImage(null)}
        >
          <button className="absolute top-6 right-6 text-white p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer">
            <X size={32} />
          </button>
          <div className="relative w-full max-w-5xl h-full max-h-[80vh]">
            <Image
              src={selectedFullImage}
              alt="Preview"
              fill
              sizes="100vw"
              className="object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
