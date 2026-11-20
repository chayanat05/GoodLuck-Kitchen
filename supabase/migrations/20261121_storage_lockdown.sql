-- =====================================================================
-- ปิดช่องโหว่ Supabase Storage (ระหว่างย้ายรูปไป R2)
-- =====================================================================

-- ---------------------------------------------------------------------
-- ส่วน A — รันได้ทันที (ไม่กระทบหน้าเว็บเวอร์ชันปัจจุบัน)
-- policy ชุดนี้ให้ "ทุกคน รวมถึงคนที่ไม่ได้ล็อกอิน" อัปโหลด/แก้/ลบ ไฟล์ใน order-images ได้
-- → ใครมี anon key (ซึ่งอยู่ในหน้าเว็บ) ลบรูปออเดอร์ทั้ง 13,000 รูปได้
-- หลังลบ: พนักงานที่ล็อกอินยังอัปโหลด/ดูได้ตาม policy เดิม ("ล็อกอินแล้วอัปโหลดรูป", "ล็อกอินแล้วดูรูปได้")
--         ลบไฟล์ได้เฉพาะแอดมิน ("แอดมินลบรูประบบได้") / ลิงก์รูปสาธารณะยังเปิดได้ตามเดิม
-- ---------------------------------------------------------------------
drop policy if exists "For full access to all users 1nu3jyv_0" on storage.objects;  -- INSERT  (public)
drop policy if exists "For full access to all users 1nu3jyv_1" on storage.objects;  -- SELECT  (public)
drop policy if exists "For full access to all users 1nu3jyv_2" on storage.objects;  -- DELETE  (public)
drop policy if exists "For full access to all users 1nu3jyv_3" on storage.objects;  -- UPDATE  (public)

-- buildings: ให้คนนอกแก้/ลบได้ทุกอย่าง (มีไฟล์เดียว ไม่มีโค้ดไหนใช้แล้ว)
drop policy if exists "Full Access Buildings" on storage.objects;
drop policy if exists "Allow Public Insert on buildings bucket"" 1bvdkjj_1" on storage.objects;
drop policy if exists "Allow Public Upload" on storage.objects;

-- ---------------------------------------------------------------------
-- ส่วน B — รัน "หลัง deploy เวอร์ชันที่อัปโหลดรูปไป R2" แล้วเท่านั้น
-- (เวอร์ชันเก่าของหน้าใบสมัครยังอัปโหลดเข้า rider-applications แบบไม่ล็อกอิน)
-- ---------------------------------------------------------------------
-- drop policy if exists "Allow public upload 1slrogm_0" on storage.objects;
-- drop policy if exists "Allow public uploads to rider-applications" on storage.objects;
-- drop policy if exists "ล็อกอินแล้วอัปโหลดรูป" on storage.objects;
