import { supabase } from '@/lib/supabase';

export type RouteResult = { path: string } | { error: string };

// เลือกหน้าปลายทางตาม role — ใช้ร่วมกันใน login / register / pending
// คนที่ยังไม่อนุมัติ (หรือถูกปิดใช้งาน) จะถูกส่งไปหน้า /pending ซึ่งจะพาเข้าเองเมื่ออนุมัติ
export async function resolveHomePath(userId: string): Promise<RouteResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id, is_approved')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return { error: 'ไม่พบข้อมูลพนักงานของบัญชีนี้ กรุณาติดต่อแอดมิน' };

  if (profile.role !== 'superadmin' && profile.is_approved !== true) return { path: '/pending' };

  if (profile.role === 'admin' || profile.role === 'superadmin') return { path: '/home' };

  if (profile.role === 'kitchen') {
    // ทุกสาขาอยู่ที่เดียวกัน: ถ้าไม่ได้ระบุสาขา ให้เข้าบอร์ดสาขาแรก
    const branchQuery = supabase.from('branches').select('id, slug');
    const { data: branch } = profile.branch_id
      ? await branchQuery.eq('id', profile.branch_id).maybeSingle()
      : await branchQuery.order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (!branch) return { error: 'ยังไม่มีสาขาในระบบ กรุณาติดต่อแอดมิน' };
    return { path: `/board/${branch.slug || branch.id}` };
  }

  return { path: '/rider' };
}
