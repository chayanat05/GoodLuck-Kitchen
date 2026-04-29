import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'ระบบไรเดอร์',
  manifest: '/manifest-rider.json', // 🌟 ชี้ไปที่ไฟล์ของไรเดอร์
};

// 🌟 เพิ่มก้อนนี้เข้าไป เพื่อให้แถบด้านบนของไรเดอร์เป็นสีเขียว
export const viewport: Viewport = {
  themeColor: '#4ade80',
};

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}