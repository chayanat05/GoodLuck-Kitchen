-- =====================================================================
-- หลังบ้าน: จัดการลูกค้าแอป delivery
--   1. ระงับบัญชีลูกค้าได้ (เช่น สั่งแล้วไม่รับของ / ก่อกวน) → สั่งอาหารไม่ได้จนกว่าจะปลด
--   2. แอดมินแก้ข้อมูลลูกค้าได้ / ลูกค้าแก้สถานะระงับของตัวเองไม่ได้
-- =====================================================================

alter table public.customers add column if not exists is_blocked     boolean not null default false;
alter table public.customers add column if not exists blocked_reason text;
alter table public.customers add column if not exists blocked_at     timestamptz;
alter table public.customers add column if not exists admin_note     text;   -- โน้ตภายในสำหรับแอดมิน

-- ---------- แอดมินแก้ข้อมูลลูกค้าได้ ----------
drop policy if exists "Admins update customers" on public.customers;
create policy "Admins update customers" on public.customers
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- กันลูกค้าปลดระงับตัวเอง / แก้โน้ตแอดมิน ----------
create or replace function public.protect_customer_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.is_blocked     := old.is_blocked;
    new.blocked_reason := old.blocked_reason;
    new.blocked_at     := old.blocked_at;
    new.admin_note     := old.admin_note;
  elsif new.is_blocked is distinct from old.is_blocked then
    new.blocked_at := case when new.is_blocked then now() end;
  end if;
  return new;
end $$;
revoke execute on function public.protect_customer_columns() from public, anon, authenticated;

drop trigger if exists protect_customer_columns on public.customers;
create trigger protect_customer_columns
  before update on public.customers
  for each row execute function public.protect_customer_columns();

-- ---------- ลูกค้าที่ถูกระงับสร้างออเดอร์ไม่ได้ ----------
-- ตรวจที่ตาราง orders (ไม่ต้องแก้ place_order) → place_order จะ error 'CUSTOMER_BLOCKED'
create or replace function public.block_orders_from_blocked_customers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null
     and exists (select 1 from public.customers where id = new.customer_id and is_blocked) then
    raise exception 'CUSTOMER_BLOCKED';
  end if;
  return new;
end $$;
revoke execute on function public.block_orders_from_blocked_customers() from public, anon, authenticated;

drop trigger if exists block_orders_from_blocked_customers on public.orders;
create trigger block_orders_from_blocked_customers
  before insert on public.orders
  for each row execute function public.block_orders_from_blocked_customers();
