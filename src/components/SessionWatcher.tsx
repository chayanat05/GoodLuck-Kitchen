"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Swal from "sweetalert2";

export default function SessionWatcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 🌟 สร้าง Listener คอยดักจับการเปลี่ยนแปลงสถานะ Login ของ Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      
      // ถ้าไม่มี session แล้ว (ถูกเตะออก, หมดอายุ, หรือล็อกเอาท์จากแท็บอื่น)
      if (event === "SIGNED_OUT" || (!session && event === "INITIAL_SESSION")) {
        
        // ข้อยกเว้น: ถ้าอยู่หน้าล็อกอินหรือกู้รหัสผ่านอยู่แล้ว ไม่ต้องเด้งเตือนซ้ำ
        const isPublicPage = pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password";
        
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