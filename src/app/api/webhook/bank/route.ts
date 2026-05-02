import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ref_number, amount, sender_name, transferred_at } = body;

    if (!ref_number || !amount) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('bank_transactions')
      .insert([{
        ref_number: ref_number, // ใช้เลขอ้างอิงเป็นตัวชน
        amount: parseFloat(amount),
        sender_name: sender_name || 'ไม่ระบุ',
        transferred_at: transferred_at || new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
    
  } catch (error: unknown) { // ✅ เปลี่ยนจาก any เป็น unknown
    // ตรวจสอบชนิดของ error ก่อนดึง message
    const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}