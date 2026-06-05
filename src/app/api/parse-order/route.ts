import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, menus } = body;

    if (!text) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let menuContext = "";
    if (menus && menus.length > 0) {
      menuContext = `
เมนูที่มีในร้านและราคา:
${menus.map((m: any) => `- ${m.menu_name} (${m.price} บาท)`).join('\n')}

**สำคัญมาก**: 
1. พยายามจับคู่ชื่ออาหารที่ลูกค้าสั่ง ให้ตรงกับ "ชื่อเมนูที่มีในร้าน" มากที่สุด (เช่น ถ้าลูกค้าสั่ง "กระเพราหมูกรอบ" ให้จับคู่กับ "ข้าวกะเพราหมูกรอบ")
2. หากไม่มีเมนูที่ตรงกันเลย ให้ใช้ชื่อที่ลูกค้าพิมพ์มาและราคาเป็น 0
3. คำนวณราคา (price) จากเมนูที่ตรงกัน * จำนวน (quantity)
`;
    }

    const prompt = `
คุณคือผู้ช่วยรับออเดอร์ร้านอาหารอัจฉริยะ หน้าที่ของคุณคือสกัดข้อมูลรายการสั่งอาหารจากข้อความของลูกค้า
ให้ออกมาเป็นรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "orders": [
    {
      "matched_menu_name": "ชื่อเมนูที่มีในร้านที่ตรงที่สุด",
      "original_text": "ข้อความเดิมที่ลูกค้าพิมพ์",
      "modifiers": "ตัวเลือกพิเศษ (เช่น เผ็ดๆ, ไม่ใส่ผัก)",
      "quantity": จำนวน (ตัวเลข),
      "unit_price": ราคาต่อหน่วย (ตัวเลข),
      "total_price": ราคารวมของรายการนี้ (ตัวเลข)
    }
  ],
  "grand_total": ราคารวมทั้งหมด (ตัวเลข)
}

${menuContext}

ข้อความของลูกค้า: "${text}"
`;

    // Configure the model to return JSON
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    return NextResponse.json(parsedData, { status: 200 });

  } catch (error) {
    console.error('Error parsing order with Gemini:', error);
    return NextResponse.json({ error: 'Failed to parse order' }, { status: 500 });
  }
}
