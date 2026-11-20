-- =====================================================================
-- ล้างลิงก์รูปที่เสีย (ไฟล์ไม่มีอยู่ใน Supabase Storage แล้ว) หลังย้ายรูปไป R2
-- - ลบเฉพาะลิงก์ Supabase ที่ "ไม่มีไฟล์จริง" — ลิงก์ R2 และลิงก์ที่ยังมีไฟล์ไม่ถูกแตะ
-- - ช่องที่เก็บหลายรูป (คั่นด้วย ,) ลบเฉพาะรูปที่เสีย ถ้าไม่เหลือเลยจะเป็นค่าว่าง
--   (null / หรือ '' สำหรับคอลัมน์ที่ห้ามเป็น null เช่นรูปในใบสมัคร)
-- - สำรองค่าเดิมทุกแถวไว้ในตาราง public._broken_media_backup ก่อนแก้
--   คืนค่าได้ด้วยคำสั่งท้ายไฟล์ / ตรวจครบแล้วค่อย drop table ทิ้ง
-- รันทั้งไฟล์ได้เลย (ทำในธุรกรรมเดียว ถ้าพังกลางทางจะไม่มีอะไรเปลี่ยน)
-- =====================================================================
begin;

create table if not exists public._broken_media_backup (
  id          bigserial primary key,
  table_name  text not null,
  row_id      uuid not null,
  column_name text not null,
  old_value   text,
  new_value   text,
  cleaned_at  timestamptz not null default now()
);
-- เปิด RLS แบบไม่มี policy = เข้าถึงได้เฉพาะจาก SQL Editor / service key
alter table public._broken_media_backup enable row level security;

-- ลิงก์นี้เป็นลิงก์ Supabase Storage ที่ไฟล์หายไปแล้วหรือไม่
create or replace function pg_temp.is_broken(u text) returns boolean
language sql stable as $$
  select u like '%/storage/v1/object/%'
     and not exists (
       select 1 from storage.objects o
       where o.bucket_id = split_part(split_part(u, '/object/public/', 2), '/', 1)
         and o.name = substr(split_part(u, '/object/public/', 2),
                             length(split_part(split_part(u, '/object/public/', 2), '/', 1)) + 2)
     )
$$;

-- ตัดรูปที่เสียออกจากค่า (รองรับค่าเดียวและหลายรูปคั่นด้วย ,)
create or replace function pg_temp.clean(v text) returns text
language sql stable as $$
  select nullif(string_agg(trim(p), ',' order by ord), '')
  from unnest(string_to_array(v, ',')) with ordinality as t(p, ord)
  where trim(p) <> '' and not pg_temp.is_broken(trim(p))
$$;

create or replace function pg_temp.clean_column(p_table text, p_column text) returns int
language plpgsql as $$
declare
  n int;
  empty_value text;
begin
  -- คอลัมน์ที่ห้ามเป็น null (รูปในใบสมัคร) ใช้ค่าว่าง '' แทน — หน้าเว็บถือว่า "ไม่มีรูป" เหมือนกัน
  select case when is_nullable = 'NO' then '' end into empty_value
  from information_schema.columns
  where table_schema = 'public' and table_name = p_table and column_name = p_column;

  execute format($q$
    insert into public._broken_media_backup (table_name, row_id, column_name, old_value, new_value)
    select %1$L, id, %2$L, %2$I, coalesce(pg_temp.clean(%2$I), %4$L)
    from public.%3$I
    where %2$I like '%%/storage/v1/object/%%' and coalesce(pg_temp.clean(%2$I), %4$L) is distinct from %2$I
  $q$, p_table, p_column, p_table, empty_value);

  execute format($q$
    update public.%1$I t set %2$I = b.new_value
    from public._broken_media_backup b
    where b.table_name = %3$L and b.column_name = %2$L and b.row_id = t.id
      and b.cleaned_at = now() and t.%2$I is not distinct from b.old_value
  $q$, p_table, p_column, p_table);
  get diagnostics n = row_count;
  return n;
end $$;

select 'orders.image_url'                     as col, pg_temp.clean_column('orders', 'image_url')                       as cleaned
union all select 'orders.slip_image',                 pg_temp.clean_column('orders', 'slip_image')
union all select 'rider_attendance.check_in_image',   pg_temp.clean_column('rider_attendance', 'check_in_image')
union all select 'rider_attendance.check_out_image',  pg_temp.clean_column('rider_attendance', 'check_out_image')
union all select 'kitchen_attendance.check_in_image', pg_temp.clean_column('kitchen_attendance', 'check_in_image')
union all select 'kitchen_attendance.check_out_image',pg_temp.clean_column('kitchen_attendance', 'check_out_image')
union all select 'rider_applications.fb_profile_image',  pg_temp.clean_column('rider_applications', 'fb_profile_image')
union all select 'kitchen_applications.fb_profile_image',pg_temp.clean_column('kitchen_applications', 'fb_profile_image')
union all select 'admin_applications.fb_profile_image',  pg_temp.clean_column('admin_applications', 'fb_profile_image');

commit;

-- ---------------------------------------------------------------------
-- คืนค่าเดิม (ถ้าต้องการ) — รันทีละตาราง เช่น:
-- update public.orders t set image_url = b.old_value
--   from public._broken_media_backup b
--   where b.table_name = 'orders' and b.column_name = 'image_url' and b.row_id = t.id;
--
-- ตรวจครบแล้ว ลบตารางสำรอง:
-- drop table public._broken_media_backup;
-- ---------------------------------------------------------------------
