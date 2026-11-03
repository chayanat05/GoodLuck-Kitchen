import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// 1. ตั้งค่าการเชื่อมต่อ R2
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

// 2. ฟังก์ชันหลักสำหรับอัปโหลดรูป
// รับค่าเป็นไฟล์ (File object) และชื่อโฟลเดอร์ที่ต้องการเก็บ (เช่น 'slips' หรือ 'deliveries')
export async function uploadImageToR2(file: File, folder: 'slips' | 'deliveries' | 'profiles'): Promise<string> {
  try {
    // แปลงไฟล์เป็น Buffer เพื่อเตรียมส่งขึ้น R2
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // สร้างชื่อไฟล์ใหม่ไม่ให้ซ้ำกัน (ใช้ เวลาปัจจุบัน + สุ่มตัวอักษร)
    const extension = file.name.split('.').pop() || 'jpg';
    const uniqueFileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;

    // คำสั่งอัปโหลด
    const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: uniqueFileName,
    Body: buffer,
    ContentType: file.type,
    });

    // ส่งไฟล์ขึ้น R2
    await r2Client.send(command);

    // คืนค่ากลับมาเป็น URL เต็มที่เปิดดูได้
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${uniqueFileName}`;
    
  } catch (error) {
    console.error("Error uploading to R2:", error);
    throw new Error("อัปโหลดรูปภาพไม่สำเร็จ");
  }
}