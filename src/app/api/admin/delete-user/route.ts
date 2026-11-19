import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ลบบัญชีพนักงานออกจากระบบถาวร (ทั้งบัญชีล็อกอินใน auth.users และข้อมูลที่ผูกอยู่)
// - เรียกได้เฉพาะ superadmin
// - ต้องใช้ SUPABASE_SECRET_KEY (sb_secret_...) ฝั่ง server เท่านั้น ห้ามใส่ NEXT_PUBLIC_
//
// สิ่งที่เกิดขึ้นเมื่อลบ:
// - auth.users ถูกลบ → profiles, rider_attendance, monthly_payments, work_schedules ถูกลบตาม (FK CASCADE)
// - kitchen_attendance ไม่มี FK จึงลบเองที่นี่
// - stock_logs เก็บไว้เป็นประวัติสต็อก แต่ตัดการอ้างอิงผู้ใช้ (user_id = null) ไม่งั้นจะลบไม่ได้
// - orders เก็บไว้ทั้งหมด (เป็นยอดขายของร้าน มี rider_name อยู่แล้ว)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Secret key แบบใหม่ (sb_secret_...) หรือ service_role key แบบเก่า (legacy)
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return fail("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY", 500);
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("กรุณาเข้าสู่ระบบ", 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ตรวจว่าผู้เรียกเป็น superadmin จริง (เช็คจากฐานข้อมูล ไม่เชื่อค่าจาก client)
  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  const caller = callerData?.user;
  if (callerError || !caller) return fail("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single();
  if (callerProfile?.role !== "superadmin") {
    return fail("เฉพาะซุปเปอร์แอดมินเท่านั้นที่ลบบัญชีได้", 403);
  }

  const body = await req.json().catch(() => null);
  const userId: unknown = body?.userId;
  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    return fail("ข้อมูลผู้ใช้ไม่ถูกต้อง", 400);
  }
  if (userId === caller.id) return fail("ไม่สามารถลบบัญชีตัวเองได้", 400);

  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (target?.role === "superadmin") {
    return fail("ไม่สามารถลบบัญชีซุปเปอร์แอดมินได้", 400);
  }

  // เคลียร์ข้อมูลที่ไม่มี FK CASCADE ก่อน
  const { error: stockError } = await admin
    .from("stock_logs")
    .update({ user_id: null })
    .eq("user_id", userId);
  if (stockError) return fail("ตัดการอ้างอิงประวัติสต็อกไม่สำเร็จ: " + stockError.message, 500);

  const { error: kitchenAttError } = await admin
    .from("kitchen_attendance")
    .delete()
    .eq("user_id", userId);
  if (kitchenAttError) return fail("ลบประวัติเข้างานครัวไม่สำเร็จ: " + kitchenAttError.message, 500);

  // ลบบัญชีล็อกอิน → profile และข้อมูลที่ผูก CASCADE ถูกลบตาม
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return fail("ลบบัญชีไม่สำเร็จ: " + deleteError.message, 500);

  return NextResponse.json({ success: true });
}
