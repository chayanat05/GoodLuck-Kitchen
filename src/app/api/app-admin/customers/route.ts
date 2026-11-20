import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/serverAuth";

// อีเมล + เวลาเข้าระบบล่าสุดของลูกค้าแอป (เก็บในระบบล็อกอิน auth.users ซึ่งหน้าเว็บอ่านตรงไม่ได้)
// เฉพาะแอดมิน — ต้องมี SUPABASE_SECRET_KEY ฝั่ง server
export async function GET(req: Request) {
  const auth = await requireRole(req, "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, { status: 500 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: customers, error } = await admin.from("customers").select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = new Set((customers ?? []).map((c) => c.id as string));

  // ส่งกลับเฉพาะบัญชีที่เป็นลูกค้า (ไม่ส่งอีเมลพนักงาน)
  const out: Record<string, { email: string | null; last_sign_in_at: string | null; email_confirmed: boolean }> = {};
  for (let page = 1; page <= 50 && Object.keys(out).length < ids.size; page++) {
    const { data, error: e } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    for (const u of data.users) {
      if (ids.has(u.id)) out[u.id] = { email: u.email ?? null, last_sign_in_at: u.last_sign_in_at ?? null, email_confirmed: !!u.email_confirmed_at };
    }
    if (data.users.length < 1000) break;
  }
  return NextResponse.json({ users: out });
}
