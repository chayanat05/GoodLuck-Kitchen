import { NextResponse } from "next/server";
import { uploadImageToR2 } from "@/lib/r2";
import { requireRole } from "@/lib/serverAuth";

// เดิมเปิดให้ใครก็อัปโหลดขึ้น R2 ได้โดยไม่ล็อกอิน — ตอนนี้ต้องเป็นพนักงานที่อนุมัติแล้ว
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const auth = await requireRole(req, "staff");
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: "ไฟล์รูปไม่ถูกต้อง (สูงสุด 5MB)" }, { status: 400 });
  }

  const url = await uploadImageToR2(file, "profiles");
  return NextResponse.json({ success: true, url });
}
