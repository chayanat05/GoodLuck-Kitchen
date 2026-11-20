"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Swal from "sweetalert2";
import { setMediaTokenCookie } from "@/lib/mediaCookie";

export default function SessionWatcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 🌟 สร้าง Listener คอยดักจับการเปลี่ยนแปลงสถานะ Login ของ Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // ให้แท็ก <img> เปิดรูปส่วนตัว (สลิป/รูปเข้างาน) ผ่าน /api/media ได้
      setMediaTokenCookie(session?.access_token ?? null, session?.expires_at);

      // ถ้าไม่มี session แล้ว (ถูกเตะออก, หมดอายุ, หรือล็อกเอาท์จากแท็บอื่น)
      if (event === "SIGNED_OUT" || (!session && event === "INITIAL_SESSION")) {
        
        // 🌟 เพิ่มหน้า "/" (หน้าแรก) เข้ามาในกลุ่มหน้าสาธารณะ
        const isPublicPage = 
          pathname === "/" || 
          pathname === "/login" || 
          pathname === "/register" || 
          pathname === "/forgot-password" ||
          pathname === "/reset-password" ||
          // หน้ารออนุมัติ: กดออกจากระบบเองได้ ไม่ต้องเด้งแจ้งเตือนเซสชันหมดอายุ
          pathname === "/pending" ||
          // หน้าใบสมัครงาน เปิดให้คนนอกกรอกได้โดยไม่ต้องล็อกอิน
          pathname.startsWith("/apply");
        
        if (!isPublicPage) {
          Swal.fire({
            title: "เซสชั่นหมดอายุ ⏱️",
            text: "ระบบได้ออกจากระบบอัตโนมัติเพื่อความปลอดภัย กรุณาล็อกอินใหม่อีกครั้งครับ",
            icon: "warning",
            confirmButtonColor: "#2563eb",
            confirmButtonText: "ไปหน้าล็อกอิน",
            allowOutsideClick: false, // บังคับให้ต้องกดปุ่มเท่านั้น
          }).then(() => {
            router.push("/login");
          });
        }
      }
    });

    // 🌟 เคลียร์ Listener คืนระบบเมื่อปิดแอป
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null; // Component นี้ทำหน้าที่เป็น Background Process ไม่ต้องแสดง UI อะไรบนหน้าจอ
}