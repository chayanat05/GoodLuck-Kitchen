-- =====================================================================
-- ให้ DB เป็นคนออกเลขออเดอร์ (ใช้ร่วมกันทั้งบอร์ดและแอปลูกค้า)
-- กติกาเหมือนเดิมทุกอย่าง:
--   * เลขถัดไป = เลขสูงสุดของออเดอร์ "ที่ยังอยู่บนบอร์ด" ของสาขานั้น + 1
--     (ไม่นับที่ล้างบอร์ดแล้ว is_archived และที่อยู่ในถังขยะ is_deleted)
--     → ล้างบอร์ดแล้วเริ่มนับ 1 ใหม่เหมือนเดิม
--   * ส่งเลขว่างมา → DB รันเลขให้อัตโนมัติ
--   * แอดมินพิมพ์เลขเอง → ใช้เลขนั้น ถ้าซ้ำกับออเดอร์บนบอร์ดจะเลื่อน +1 ให้ (เหมือนโค้ดเดิม)
--   * แก้เลขภายหลัง (UPDATE) ทำได้อิสระ trigger นี้ไม่ยุ่ง
-- สิ่งที่ได้เพิ่ม: ล็อกต่อสาขา → สร้างพร้อมกันหลายเครื่อง/จากแอปลูกค้า เลขไม่ชนกัน
-- =====================================================================

-- index สำหรับหาออเดอร์ที่ยังอยู่บนบอร์ด (บอร์ดใช้ query นี้ทุกครั้งที่โหลดด้วย)
create index if not exists orders_branch_active_idx
  on public.orders (branch_id)
  where is_archived is not true and is_deleted is not true;

-- คำนวณเลขถัดไป (ภายใน — ไม่เปิดให้เรียกจากภายนอก)
create or replace function public._calc_next_order_number(p_branch_id uuid)
returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(max((substring(order_number from '\d{1,9}'))::bigint), 0) + 1
  from public.orders
  where branch_id is not distinct from p_branch_id
    and is_archived is not true
    and is_deleted  is not true
    and order_number ~ '\d'
$$;

-- ให้บอร์ดดึงไปแสดงเป็นค่าเริ่มต้นในฟอร์ม (เฉพาะพนักงาน)
create or replace function public.next_order_number(p_branch_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    return null;
  end if;
  return public._calc_next_order_number(p_branch_id)::text;
end $$;

-- trigger ออกเลขตอนสร้างออเดอร์
create or replace function public.assign_order_number()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_num    text;
  v_digits text;
  i        int := 0;
begin
  -- ล็อกต่อสาขาจนจบ transaction กันเลขชนเมื่อสร้างพร้อมกัน
  perform pg_advisory_xact_lock(hashtext('order_number:' || coalesce(new.branch_id::text, 'none')));

  v_num := nullif(btrim(coalesce(new.order_number, '')), '');

  if v_num is null then
    new.order_number := public._calc_next_order_number(new.branch_id)::text;
    return new;
  end if;

  -- เลขที่พิมพ์เอง: ถ้าซ้ำกับออเดอร์บนบอร์ด เลื่อนตัวเลขตัวแรก +1 (เหมือนโค้ดเดิมฝั่งบอร์ด)
  while i < 50 and exists (
    select 1 from public.orders
    where branch_id is not distinct from new.branch_id
      and order_number = v_num
      and is_archived is not true
      and is_deleted  is not true
  ) loop
    v_digits := substring(v_num from '\d{1,9}');
    if v_digits is null then
      v_num := v_num || '-copy';
    else
      v_num := regexp_replace(v_num, '\d{1,9}', (v_digits::bigint + 1)::text);
    end if;
    i := i + 1;
  end loop;

  new.order_number := v_num;
  return new;
end $$;

drop trigger if exists assign_order_number on public.orders;
create trigger assign_order_number
  before insert on public.orders
  for each row execute function public.assign_order_number();

-- สิทธิ์
revoke execute on function public._calc_next_order_number(uuid) from public, anon, authenticated;
revoke execute on function public.assign_order_number()          from public, anon, authenticated;
revoke execute on function public.next_order_number(uuid)        from public, anon;
grant  execute on function public.next_order_number(uuid)        to authenticated;
