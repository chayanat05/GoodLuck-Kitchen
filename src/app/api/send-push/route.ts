// src/app/api/send-push/route.ts
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// ฟังก์ชันพิเศษสำหรับเคลียร์ปัญหาเรื่อง Private Key พัง
const formatPrivateKey = (key: string | undefined) => {
  if (!key) return undefined;
  // บล๊อกถอนรากถอนโคน: ล้างเครื่องหมายอัญประกาศส่วนเกิน และแปลง \n ให้กลายเป็นการขึ้นบรรทัดใหม่ของจริง
  const cleanKey = key.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
  return cleanKey;
};

if (!admin.apps.length) {
  try {
    const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    
    if (!privateKey) {
      throw new Error('❌ Missing FIREBASE_PRIVATE_KEY in environment variables');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log('🔥 Firebase Admin initialized successfully!');
  } catch (error) {
    console.error('Firebase Admin Init Error:', error);
  }
}

export async function POST(request: Request) {
  try {
    // รับค่าที่ส่งมาจากหน้าเว็บ
    const body = await request.json();
    const { tokens, title, message, link } = body;

    // เช็คว่ามี Token ให้ส่งไปหาไหม
    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ success: false, error: 'No tokens provided' }, { status: 400 });
    }

    // 2. จัดเตรียมรูปแบบกล่องข้อความแจ้งเตือน
    const payload = {
      notification: {
        title: title,
        body: message,
        // ถ้าระบุลิงก์ พอกดแจ้งเตือนมันจะพาไปหน้านั้น
        image: '/logo.png', // ใส่ path รูปโลโก้ร้าน (ถ้ามี)
      },
      webpush: {
        fcmOptions: {
          link: link || '/', // กดแล้วไปหน้าไหน
        }
      }
    };

    // 3. สั่งยิงแจ้งเตือนไปยัง Tokens ทั้งหมด (ส่งทีเดียวหลายคนได้)
    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens,
      ...payload
    });

    return NextResponse.json({ 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount 
    });

  } catch (error: unknown) {
    console.error('Error sending push notification:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}