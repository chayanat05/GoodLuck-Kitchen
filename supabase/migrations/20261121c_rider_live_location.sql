-- =====================================================================
-- พิกัดไรเดอร์แบบเรียลไทม์ผ่าน Realtime Broadcast (private channel)
-- ห้อง rider-locations : ไรเดอร์ส่งพิกัด / คนเปิดแผนที่รับ
-- ห้อง rider-watch     : คนเปิดแผนที่ ping บอกไรเดอร์ว่ามีคนดูอยู่
-- อนุญาตเฉพาะพนักงานที่อนุมัติแล้ว (is_staff) ทั้งรับและส่ง
-- ข้อความ broadcast ไม่ถูกบันทึกลงตารางใด ๆ policy นี้ใช้ตรวจสิทธิ์อย่างเดียว
-- =====================================================================

drop policy if exists "Staff receive rider live" on realtime.messages;
create policy "Staff receive rider live" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) in ('rider-locations', 'rider-watch')
    and (select public.is_staff())
  );

drop policy if exists "Staff send rider live" on realtime.messages;
create policy "Staff send rider live" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) in ('rider-locations', 'rider-watch')
    and (select public.is_staff())
  );
