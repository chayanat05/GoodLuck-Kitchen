import { NextResponse } from "next/server";
import { putR2Object, r2Configured } from "@/lib/r2";
import { requireRole } from "@/lib/serverAuth";
import { MEDIA_KINDS, type MediaKind } from "@/lib/mediaKinds";
import { PRIVATE_PREFIX } from "@/lib/media";

// อัปโหลดรูปทุกประเภทขึ้น R2 — คืน "ตำแหน่งไฟล์" (key) ไว้เก็บใน DB ไม่ใช่ URL เต็ม
const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 4 * 1024 * 1024; // หน้าเว็บย่อรูปก่อนส่งแล้ว ปกติไม่ถึง 500KB
const MAX_BYTES_ANON = 2 * 1024 * 1024;

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const kind = form?.get("kind") as MediaKind | null;
  const file = form?.get("file");
  const cfg = kind ? MEDIA_KINDS[kind] : undefined;
  if (!cfg) return fail("ประเภทรูปไม่ถูกต้อง", 400);

  if (cfg.upload !== "anyone") {
    const auth = await requireRole(req, cfg.upload);
    if (!auth.ok) return fail(auth.error, auth.status);
  }

  if (!(file instanceof File)) return fail("ไม่พบไฟล์", 400);
  const ext = TYPES[file.type];
  if (!ext) return fail("รองรับเฉพาะรูป JPG / PNG / WebP", 400);
  if (file.size > (cfg.upload === "anyone" ? MAX_BYTES_ANON : MAX_BYTES)) return fail("ไฟล์ใหญ่เกินไป", 400);

  const bucket = cfg.private ? "private" : "public";
  if (!r2Configured(bucket)) return fail("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า R2" + (cfg.private ? " (R2_PRIVATE_BUCKET_NAME)" : ""), 500);

  const now = new Date();
  const ym = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const objectKey = `${cfg.folder}/${ym}/${crypto.randomUUID()}.${ext}`;

  try {
    await putR2Object(bucket, objectKey, new Uint8Array(await file.arrayBuffer()), file.type);
  } catch (e) {
    console.error("R2 upload failed", e);
    return fail("อัปโหลดรูปไม่สำเร็จ", 500);
  }

  // ไฟล์ส่วนตัวขึ้นต้นด้วย private/ เพื่อให้ mediaUrl() รู้ว่าต้องเปิดผ่าน /api/media
  return NextResponse.json({ success: true, key: cfg.private ? PRIVATE_PREFIX + objectKey : objectKey });
}
