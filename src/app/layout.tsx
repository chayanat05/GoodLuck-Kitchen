import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from 'sonner';
import SessionWatcher from "@/components/SessionWatcher";

// 🌟 1. ตั้งค่า Viewport (เพิ่มคำสั่งล็อคการซูมหน้าจอ เพื่อให้ความรู้สึกเหมือน Native App)
export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // บังคับไม่ให้ซูมหน้าจอ
};

// 🌟 2. ข้อมูล PWA และ SEO
export const metadata: Metadata = {
  title: 'GoodLuck Kitchen | ระบบจัดการออเดอร์ร้านอาหาร',
  description: 'ระบบจัดการร้านและไรเดอร์ GoodLuck Kitchen - ติดตามออเดอร์แบบเรียลไทม์, จัดการเมนู, และดูประวัติการสั่งซื้อได้ง่ายๆ',
  keywords: 'GoodLuck Kitchen, ระบบจัดการร้านอาหาร, ระบบจัดการออเดอร์',
  manifest: '/manifest.json', // ชี้ไปที่ไฟล์ PWA
  authors: [{ name: 'GoodLuck Kitchen' }],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GoodLuck', // ชื่อแอปที่จะโชว์ใต้ไอคอนบนหน้าจอ iPhone
  },
  icons: {
    icon: '/favicon.ico', 
    apple: '/riderlogo_192x192.png', // 🍎 ไอคอนเวลาติดตั้งลงหน้าจอเครื่อง (ดึงจากไฟล์ที่คุณปลั๊กเตรียมไว้)
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="bg-slate-50 font-sans">

      {/* 🌟 2. วางยามเฝ้าระวังเซสชั่นไว้ใน Body */}
        <SessionWatcher />
        
        {children}
        {/* 🌟 ตัวแสดง Popup แจ้งเตือนมุมขวาบน */}
        <Toaster position="top-right" richColors expand={true} />
      </body>
    </html>
  );
}