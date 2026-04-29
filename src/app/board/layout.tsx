import { Metadata , Viewport} from 'next';

export const metadata: Metadata = {
  title: 'ระบบจัดการร้าน',
  manifest: '/manifest-board.json', // 🌟 ชี้ไปที่ไฟล์ของร้าน
};

// 🌟 เพิ่มก้อนนี้เข้าไป เพื่อให้แถบด้านบนของร้านเป็นสีน้ำเงิน
export const viewport: Viewport = {
  themeColor: '#2563eb',
};

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}