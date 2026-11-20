-- =====================================================================
-- หลังบ้านแอป delivery ระยะ 1
--   1. แม่ครัว (kitchen) เปิด/ปิดร้าน และกด "เมนูหมด" ได้ — ผ่านฟังก์ชันเท่านั้น
--      (policy ของ stores / store_menus ยังให้แอดมินแก้ได้คนเดียวเหมือนเดิม
--       แม่ครัวจึงแก้ราคา/ชื่อ/ค่าส่งไม่ได้)
--   2. เปิด Realtime ให้ stores / store_menus → แอปลูกค้าเห็นร้านปิด/เมนูหมดทันที
-- =====================================================================

-- ---------- 1. เปิด/ปิดร้าน ----------
create or replace function public.set_store_open(p_store_id uuid, p_open boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.staff_role(), '') not in ('kitchen', 'admin', 'superadmin') then
    raise exception 'FORBIDDEN';
  end if;
  update public.stores set is_open = p_open where id = p_store_id;
  if not found then raise exception 'STORE_NOT_FOUND'; end if;
end $$;
revoke execute on function public.set_store_open(uuid, boolean) from public, anon;
grant  execute on function public.set_store_open(uuid, boolean) to authenticated;

-- ---------- 2. เมนูหมด / มีขาย ----------
create or replace function public.set_menu_available(p_menu_id uuid, p_available boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.staff_role(), '') not in ('kitchen', 'admin', 'superadmin') then
    raise exception 'FORBIDDEN';
  end if;
  update public.store_menus set is_available = p_available where id = p_menu_id;
  if not found then raise exception 'MENU_NOT_FOUND'; end if;
end $$;
revoke execute on function public.set_menu_available(uuid, boolean) from public, anon;
grant  execute on function public.set_menu_available(uuid, boolean) to authenticated;

-- ---------- 3. Realtime ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'stores') then
    alter publication supabase_realtime add table public.stores;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'store_menus') then
    alter publication supabase_realtime add table public.store_menus;
  end if;
end $$;
