-- =====================================================================
-- Security Phase 1b — เก็บตกคำเตือนจาก Supabase Security Advisor หลังรัน phase1
-- ไม่กระทบการใช้งานของพนักงาน
-- =====================================================================

-- 1. ฟังก์ชัน trigger ไม่ควรถูกเรียกตรงผ่าน /rest/v1/rpc
--    (trigger ยังทำงานตามปกติ เพราะ Postgres เช็คสิทธิ์ EXECUTE ตอนสร้าง trigger เท่านั้น)
revoke execute on function public.handle_new_user()         from public, anon, authenticated;
revoke execute on function public.protect_profile_columns() from public, anon, authenticated;

-- 2. is_staff / is_admin ใช้ใน policy ของคนที่ล็อกอินเท่านั้น → คนนอกไม่ต้องเรียก
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_staff() to authenticated;
grant  execute on function public.is_admin() to authenticated;

-- 3. handle_new_user ไม่ได้ล็อก search_path (ในฟังก์ชันอ้างชื่อตารางเต็มแล้ว จึงตั้งเป็นค่าว่างได้)
alter function public.handle_new_user() set search_path = '';

-- หมายเหตุ: get_email_by_username ต้องให้ anon เรียกได้ เพราะหน้า login / ลืมรหัสผ่าน
-- ใช้หาอีเมลจากชื่อเล่นก่อนล็อกอิน (ตอนนี้เทียบชื่อแบบตรงตัวแล้ว ใช้ % สุ่มหาไม่ได้)
