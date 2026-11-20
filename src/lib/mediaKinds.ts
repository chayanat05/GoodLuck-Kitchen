// ประเภทรูปที่อัปโหลดได้ — กำหนด bucket, โฟลเดอร์, สิทธิ์ และการย่อรูป ไว้ที่เดียว
// (ใช้ทั้งฝั่งหน้าเว็บและ API)
export type MediaKind =
  | "order" // รูปแนบออเดอร์บนบอร์ด
  | "gallery" // แกลเลอรีรวม
  | "dorm" // รูปหอพัก/สถานที่
  | "store" // รูปร้าน/เมนูในแอปลูกค้า
  | "slip" // สลิปโอนของออเดอร์
  | "payroll-slip" // สลิปจ่ายเงินพนักงาน
  | "attendance" // เซลฟี่เข้า-ออกงาน
  | "application"; // รูปจากใบสมัครงาน (คนนอกอัปได้ ไม่ต้องล็อกอิน)

export type UploadAuth = "anyone" | "staff" | "admin";

export const MEDIA_KINDS: Record<MediaKind, { private: boolean; folder: string; upload: UploadAuth; maxSide: number }> = {
  order: { private: false, folder: "orders", upload: "staff", maxSide: 1600 },
  gallery: { private: false, folder: "gallery", upload: "staff", maxSide: 1600 },
  dorm: { private: false, folder: "dorms", upload: "staff", maxSide: 1600 },
  store: { private: false, folder: "stores", upload: "admin", maxSide: 1280 },
  slip: { private: true, folder: "slips", upload: "staff", maxSide: 1800 }, // ต้องอ่านตัวเลขในสลิปออก
  "payroll-slip": { private: true, folder: "payroll-slips", upload: "admin", maxSide: 1800 },
  attendance: { private: true, folder: "attendance", upload: "staff", maxSide: 1024 },
  application: { private: true, folder: "applications", upload: "anyone", maxSide: 1280 },
};

/**
 * ใครเปิดดูไฟล์ส่วนตัวในโฟลเดอร์นี้ได้
 * ชื่อไฟล์เป็น UUID สุ่ม (เดาไม่ได้) และ key อยู่ในตารางที่มี RLS อยู่แล้ว
 * → พนักงานทั่วไปเปิดได้ (ไรเดอร์ต้องดูสลิปเงินเดือน/รูปเข้างานของตัวเอง)
 * ยกเว้นใบสมัครงาน = แอดมินเท่านั้น
 */
export function viewLevelForPrivateKey(key: string): "staff" | "admin" {
  // key = "private/<folder>/..."
  return key.split("/")[1] === "applications" ? "admin" : "staff";
}
