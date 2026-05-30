// /rider/layout.tsx
import { Viewport } from 'next';

// 🌟 เพิ่มก้อนนี้เข้าไป เพื่อให้แถบด้านบนของไรเดอร์เป็นสีเขียว
export const viewport: Viewport = {
  themeColor: '#4ade80',
};

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}