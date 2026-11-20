import { createClient } from "@supabase/supabase-js";

type Level = "admin" | "staff";
type Result = { ok: true; userId: string } | { ok: false; status: number; error: string };

// แคชผลตรวจสิทธิ์สั้นๆ ต่อ token (หน้าแสดงรูปหลายสิบรูปพร้อมกัน ไม่ต้องถาม DB ทุกรูป)
const cache = new Map<string, { exp: number; userId: string; admin: boolean; staff: boolean }>();
const TTL_MS = 2 * 60 * 1000;

export function bearerToken(req: Request): string | null {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
}

/**
 * ตรวจผู้เรียก API ฝั่ง server จาก access token ของ Supabase (เช็คกับฐานข้อมูล ไม่เชื่อค่าจาก client)
 * - "admin" → is_admin()  (admin/superadmin ที่อนุมัติแล้ว)
 * - "staff" → is_staff()  (พนักงานที่อนุมัติแล้วทุก role)
 * ใช้ anon key + token ของผู้ใช้ ไม่ต้องใช้ secret key
 */
export async function checkToken(token: string | null, level: Level): Promise<Result> {
  if (!token) return { ok: false, status: 401, error: "กรุณาเข้าสู่ระบบ" };

  const now = Date.now();
  let entry = cache.get(token);
  if (!entry || entry.exp < now) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error } = await sb.auth.getUser(token);
    if (error || !userData.user) {
      cache.delete(token);
      return { ok: false, status: 401, error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
    }
    const [{ data: staff }, { data: admin }] = await Promise.all([sb.rpc("is_staff"), sb.rpc("is_admin")]);
    entry = { exp: now + TTL_MS, userId: userData.user.id, staff: staff === true, admin: admin === true };
    if (cache.size > 500) cache.clear();
    cache.set(token, entry);
  }

  const allowed = level === "admin" ? entry.admin : entry.staff;
  if (!allowed) return { ok: false, status: 403, error: "ไม่มีสิทธิ์ใช้งาน" };
  return { ok: true, userId: entry.userId };
}

export function requireRole(req: Request, level: Level) {
  return checkToken(bearerToken(req), level);
}
