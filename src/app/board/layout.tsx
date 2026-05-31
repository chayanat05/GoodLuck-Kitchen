import { Viewport} from 'next';


// 🌟 เพิ่มก้อนนี้เข้าไป เพื่อให้แถบด้านบนของร้านเป็นสีน้ำเงิน
export const viewport: Viewport = {
  themeColor: '#2563eb',
};

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}