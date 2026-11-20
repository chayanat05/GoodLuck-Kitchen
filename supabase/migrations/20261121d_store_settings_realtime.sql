-- =====================================================================
-- เปิด Realtime ให้ store_settings
-- แอดมินเปลี่ยนเวลาตัดรอบ (business_day_start) หรือค่าอื่นในหน้าตั้งค่า
-- → ทุกหน้าที่เปิดอยู่ (บอร์ด, แอปไรเดอร์, แดชบอร์ด) ได้ค่าใหม่ทันที
-- เดิมตารางนี้ไม่อยู่ใน publication ทำให้หน้าบอร์ดที่ฟังการเปลี่ยนแปลงไม่เคยได้รับอะไร
-- (สิทธิ์อ่านยังเป็นไปตาม RLS เดิมของ store_settings)
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'store_settings'
  ) then
    alter publication supabase_realtime add table public.store_settings;
  end if;
end $$;
