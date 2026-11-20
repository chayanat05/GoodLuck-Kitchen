import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ใช้ฝั่ง server เท่านั้น (มี secret ของ R2)
// bucket สาธารณะ  = R2_BUCKET_NAME          (เปิดผ่าน NEXT_PUBLIC_R2_PUBLIC_URL)
// bucket ส่วนตัว   = R2_PRIVATE_BUCKET_NAME  (เปิดได้ผ่านลิงก์ชั่วคราวจาก /api/media/... เท่านั้น)
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

export type R2Bucket = "public" | "private";

const bucketName = (b: R2Bucket) => (b === "public" ? process.env.R2_BUCKET_NAME : process.env.R2_PRIVATE_BUCKET_NAME);

export function r2Configured(b: R2Bucket) {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && bucketName(b));
}

export async function putR2Object(bucket: R2Bucket, key: string, body: Uint8Array, contentType: string) {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucketName(bucket),
      Key: key,
      Body: body,
      ContentType: contentType,
      // ชื่อไฟล์สุ่มไม่ซ้ำ → cache ได้ยาว
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

/** ลิงก์ชั่วคราวสำหรับไฟล์ใน bucket ส่วนตัว */
export function presignPrivate(key: string, expiresIn = 600) {
  return getSignedUrl(r2Client, new GetObjectCommand({ Bucket: bucketName("private"), Key: key }), { expiresIn });
}

// ---------------------------------------------------------------------
// ของเดิม (ใช้โดย /api/upload) — คืน URL เต็มของ bucket สาธารณะ
// ---------------------------------------------------------------------
export async function uploadImageToR2(file: File, folder: "slips" | "deliveries" | "profiles" | "stores"): Promise<string> {
  const ext = ({ "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" } as Record<string, string>)[file.type] || "jpg";
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
  await putR2Object("public", key, new Uint8Array(await file.arrayBuffer()), file.type);
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}
