import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from 'sonner';

// 🌟 สีเริ่มต้นของแอปจะเป็นสีน้ำเงิน (สำหรับหน้าล็อกอินและแอดมิน)
export const viewport: Viewport = {
  themeColor: '#2563eb',
};

// 🌟 ข้อมูล PWA และ SEO
export const metadata: Metadata = {
  title: 'GoodLuck Kitchen',
  description: 'ระบบจัดการร้านและไรเดอร์',
  manifest: '/manifest.json', // ชี้ไปที่ไฟล์ PWA ตัวเดียวที่เรารวมไว้
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GoodLuck',
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