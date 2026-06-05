import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from 'sonner';

// 🌟 สีเริ่มต้นของแอปจะเป็นสีน้ำเงิน (สำหรับหน้าล็อกอินและแอดมิน)
export const viewport: Viewport = {
  themeColor: '#2563eb',
};

// 🌟 ข้อมูล PWA และ SEO
export const metadata: Metadata = {
  title: 'GoodLuck Kitchen | ระบบจัดการออเดอร์ร้านอาหาร',
  description: 'ระบบจัดการร้านและไรเดอร์ GoodLuck Kitchen - ติดตามออเดอร์แบบเรียลไทม์, จัดการเมนู, และดูประวัติการสั่งซื้อได้ง่ายๆ',
  keywords: 'GoodLuck Kitchen, ระบบจัดการร้านอาหาร, ระบบจัดการออเดอร์',
  manifest: '/manifest.json', // ชี้ไปที่ไฟล์ PWA ตัวเดียวที่เรารวมไว้
  authors: [{ name: 'GoodLuck Kitchen' }],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GoodLuck',
  },
  icons: {
    icon: '/favicon.ico', // ถ้ามีโลโก้ร้าน เอาไปใส่ในโฟลเดอร์ public แล้วอ้างอิงชื่อไฟล์ตรงนี้ได้เลย
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
        {children}
        {/* 🌟 ตัวแสดง Popup แจ้งเตือนมุมขวาบน */}
        <Toaster position="top-right" richColors expand={true} />
      </body>
    </html>
  );
}