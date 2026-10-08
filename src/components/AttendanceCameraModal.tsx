"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, Loader2, RefreshCw, RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Swal from "sweetalert2";

interface ActiveAttendance {
  id: string;
  check_in: string;
  check_out: string | null;
}

interface AttendanceCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: "in" | "out";
  userId: string;
  userRole: string;
  activeAttendance: ActiveAttendance | null;
  onSuccess: (newAttendance: ActiveAttendance | null) => void;
}

export default function AttendanceCameraModal({
  isOpen,
  onClose,
  action,
  userId,
  userRole,
  activeAttendance,
  onSuccess,
}: AttendanceCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  // 🌟 ปิดกล้องและคืนทรัพยากร
  const stopLiveCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  // 🌟 เปิดกล้องสด
  const startLiveCamera = useCallback(async () => {
    setIsStartingCamera(true);
    stopLiveCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        Swal.fire({
          title: "ไม่รองรับการเปิดกล้อง",
          text: "เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องโดยตรง แนะนำให้ใช้ Chrome หรือ Safari แท้ของเครื่องครับ",
          icon: "error",
          confirmButtonColor: "#3b82f6",
        });
        setIsStartingCamera(false);
        return;
      }

      toast.info("กรุณากด 'อนุญาต (Allow)' เพื่อเปิดกล้องครับ 📷", { id: "camera-toast", duration: 4000 });

      let stream: MediaStream | null = null;
      try {
        // 1. ลองขอเปิดกล้องหน้า
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err1: unknown) {
        // ดึงชื่อ Error ออกมาเช็คอย่างปลอดภัย
        const errorName = err1 instanceof Error ? err1.name : (err1 as { name?: string })?.name;
        
        if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
          throw err1; 
        }
        
        console.warn("ไม่พบกล้องหน้า พยายามเปิดกล้องหลักแทน...", err1);
        // 2. ถ้าไม่เจอกล้องหน้าให้เปิดกล้องรวม
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setCameraStream(stream);
      toast.dismiss("camera-toast");
      
    } catch (err: unknown) {
      console.error("Camera access error:", err);
      toast.dismiss("camera-toast");
      
      Swal.fire({
        title: "กล้องถูกบล็อก! 📷",
        html: `
          <div class="text-left text-sm mt-3 text-slate-600 font-medium leading-relaxed">
            ระบบไม่สามารถเปิดกล้องได้เนื่องจากไม่ได้รับอนุญาต<br><br>
            <strong class="text-slate-800 text-base">🛠️ วิธีแก้ไขด่วน:</strong><br>
            1. สังเกตที่ช่องพิมพ์ชื่อเว็บ (URL) ด้านบนสุด<br>
            2. แตะที่รูป <b>แม่กุญแจ 🔒</b> หรือ <b>กA / aA</b><br>
            3. เลือกเมนู <b>การตั้งค่าเว็บไซต์ (Site Settings)</b><br>
            4. ตรงคำว่า กล้อง (Camera) ให้เปลี่ยนเป็น <b class="text-blue-600">อนุญาต (Allow)</b><br>
            5. รีเฟรชหน้าเว็บอีกครั้ง
          </div>
        `,
        icon: "warning",
        confirmButtonColor: "#3b82f6",
        confirmButtonText: "รับทราบ",
      });
    } finally {
      setIsStartingCamera(false);
    }
  }, [stopLiveCamera]);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch((err) => console.warn("Video play error:", err));
      };
    }
  }, [cameraStream]);

  useEffect(() => {
    if (isOpen) {
      startLiveCamera();
    } else {
      stopLiveCamera();
      setPhotoPreview(null);
      setPhotoFile(null);
    }
    return () => stopLiveCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 🌟 กดถ่ายรูป (ปรับให้เซฟแบบกระจกเงา เหมือนตอนส่องวิดีโอ)
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const targetWidth = 720;
      const targetHeight = (video.videoHeight / video.videoWidth) * targetWidth;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // 🌟 เพิ่มคำสั่ง 2 บรรทัดนี้ เพื่อให้ Canvas กลับด้านภาพซ้าย-ขวา ก่อนวาด
        ctx.translate(targetWidth, 0);
        ctx.scale(-1, 1);
        
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setPhotoPreview(dataUrl);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
              setPhotoFile(file);
            }
          },
          "image/jpeg",
          0.85
        );

        stopLiveCamera();
      }
    }
  };

  const submitAttendance = async () => {
    if (!photoFile || !userId) return;

    setIsProcessing(true);
    try {
      const folderPrefix = userRole === "rider" ? "attendance-rider" : "attendance-kitchen";
      const fileExt = photoFile.name.split(".").pop() || "jpg";
      const fileName = `${folderPrefix}/${userId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("rider-applications")
        .upload(fileName, photoFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("rider-applications")
        .getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      if (action === "in") {
        const { data, error } = await supabase
          .from("rider_attendance")
          .insert([{ rider_id: userId, check_in_image: imageUrl }])
          .select()
          .single();

        if (error) throw error;
        toast.success("เข้างานสำเร็จ!", { description: "ถ่ายรูปเข้างานเรียบร้อย ลุยเลย! 🚀" });
        onSuccess(data as ActiveAttendance);
      } else {
        if (!activeAttendance) throw new Error("ไม่พบข้อมูลการเข้างาน");
        const now = new Date();
        const checkInDate = new Date(activeAttendance.check_in);
        const minutes = Math.floor((now.getTime() - checkInDate.getTime()) / 60000);

        const { error } = await supabase
          .from("rider_attendance")
          .update({
            check_out: now.toISOString(),
            total_minutes: minutes,
            check_out_image: imageUrl,
          })
          .eq("id", activeAttendance.id);

        if (error) throw error;
        toast.success("เลิกงานสำเร็จ!", { description: "ถ่ายรูปออกงานเรียบร้อย พักผ่อนได้! 🌙" });
        onSuccess(null);
      }

      onClose();
    } catch (err: unknown) {
      console.error(err);
      Swal.fire({
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถบันทึกข้อมูลการถ่ายรูปได้",
        icon: "error",
        confirmButtonColor: "#3b82f6",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative border border-white/20 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 ${
                action === "in" ? "bg-emerald-100 text-emerald-600 shadow-emerald-500/20" : "bg-rose-100 text-rose-600 shadow-rose-500/20"
              } rounded-2xl flex items-center justify-center shadow-inner`}
            >
              <Camera size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">
                {action === "in" ? "ถ่ายรูปเข้างาน" : "ถ่ายรูปออกงาน"}
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-0.5">กรุณาถ่ายภาพให้เห็นใบหน้าชัดเจน</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-slate-200 bg-slate-100 rounded-full transition-colors text-slate-500 active:scale-95 cursor-pointer">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 flex flex-col items-center gap-6 bg-white">
          
          <div className="relative w-full aspect-[3/4] bg-slate-900 rounded-[1.5rem] overflow-hidden shadow-inner border-[4px] border-slate-100 flex items-center justify-center">
            <canvas ref={canvasRef} className="hidden" />

            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Selfie preview" className="object-cover w-full h-full" />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`object-cover w-full h-full scale-x-[-1] ${cameraStream ? "block" : "hidden"}`}
                />
                {!cameraStream && (
                  <div className="text-slate-400 text-center flex flex-col items-center p-6">
                    {isStartingCamera ? (
                      <>
                        <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
                        <p className="text-sm font-bold tracking-wide">กำลังเชื่อมต่อกล้อง...</p>
                      </>
                    ) : (
                      <>
                        <Camera size={56} className="mb-4 opacity-30" />
                        <button
                          onClick={startLiveCamera}
                          className="px-6 py-3 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 rounded-xl font-bold transition-colors cursor-pointer text-sm flex items-center gap-2 shadow-sm"
                        >
                          <RefreshCw size={18} /> ลองเปิดกล้องอีกครั้ง
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="w-full space-y-3 mt-1">
            {!photoPreview && cameraStream && (
              <button
                onClick={capturePhoto}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-xl shadow-blue-500/30 active:scale-95 text-lg flex justify-center items-center gap-2 cursor-pointer transition-all tracking-wide"
              >
                <Camera size={24} /> กดแชะภาพ!
              </button>
            )}

            {photoPreview && (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPhotoPreview(null);
                    setPhotoFile(null);
                    startLiveCamera();
                  }}
                  disabled={isProcessing}
                  className="py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCcw size={20} /> ถ่ายใหม่
                </button>
                <button
                  onClick={submitAttendance}
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black disabled:bg-slate-300 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl shadow-emerald-500/30 active:scale-95 tracking-wide text-lg"
                >
                  {isProcessing ? <Loader2 size={24} className="animate-spin" /> : "✅ ยืนยันบันทึกภาพ"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}