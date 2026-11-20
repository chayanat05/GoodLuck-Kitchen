import { supabase } from "@/lib/supabase";
import { MEDIA_KINDS, type MediaKind } from "@/lib/mediaKinds";

/** ย่อรูปในเบราว์เซอร์ → WebP ด้านยาวไม่เกิน maxSide (รูปจากมือถือ 3–5MB เหลือ ~100–300KB) */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (!blob) throw new Error("ย่อรูปไม่สำเร็จ");
  return new File([blob], "image.webp", { type: "image/webp" });
}

/**
 * อัปโหลดรูปขึ้น R2 ผ่าน /api/media/upload
 * คืน "ตำแหน่งไฟล์" สำหรับเก็บใน DB — เวลาแสดงผลให้ใช้ mediaUrl(key)
 */
export async function uploadMedia(file: File, kind: MediaKind): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("กรุณาเลือกไฟล์รูปภาพ");

  let toSend: File = file;
  try {
    toSend = await compressImage(file, MEDIA_KINDS[kind].maxSide);
    // ย่อแล้วใหญ่กว่าเดิม (รูปเล็กอยู่แล้ว) → ส่งไฟล์เดิม
    if (toSend.size > file.size && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) toSend = file;
  } catch {
    // เบราว์เซอร์อ่านไฟล์นี้ไม่ได้ (เช่น HEIC บางเครื่อง) → ลองส่งไฟล์เดิม เซิร์ฟเวอร์จะตรวจชนิดไฟล์อีกที
  }

  const { data } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", toSend);
  const res = await fetch("/api/media/upload", {
    method: "POST",
    headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : undefined,
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.key) throw new Error(json.error || "อัปโหลดรูปไม่สำเร็จ");
  return json.key as string;
}
