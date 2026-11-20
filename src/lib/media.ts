/**
 * ค่ารูปที่เก็บใน DB มี 3 แบบ:
 *  1. URL เต็มแบบเก่า (Supabase Storage)          → ใช้ตามเดิม
 *  2. "orders/2026/11/xxx.webp"                    → bucket สาธารณะบน R2
 *  3. "private/slips/2026/11/xxx.webp"             → bucket ส่วนตัว เปิดผ่าน /api/media (เช็คสิทธิ์ก่อน)
 * เก็บแค่ตำแหน่งไฟล์ → วันที่เปลี่ยนโดเมนรูป แก้แค่ NEXT_PUBLIC_R2_PUBLIC_URL
 *
 * หน้าเว็บต้องแสดงรูปผ่าน mediaUrl() เสมอ และต้องบันทึกค่า "ดิบ" กลับลง DB (ห้ามบันทึกผลของ mediaUrl)
 */
const PUBLIC_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/+$/, "");

export const PRIVATE_PREFIX = "private/";

export function mediaUrl(value: string | null | undefined): string {
  const v = (value || "").trim();
  if (!v) return "";
  if (/^(https?:|blob:|data:)/i.test(v) || v.startsWith("/")) return v;
  if (v.startsWith(PRIVATE_PREFIX)) return `/api/media/${v}`;
  return `${PUBLIC_BASE}/${v}`;
}

/** ค่าที่เก็บหลายรูปคั่นด้วย , → รายการค่าดิบ */
export function splitMedia(csv: string | null | undefined): string[] {
  return (csv || "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** ค่าที่เก็บหลายรูปคั่นด้วย , → รายการ URL พร้อมแสดง */
export function mediaUrls(csv: string | null | undefined): string[] {
  return splitMedia(csv).map(mediaUrl);
}
