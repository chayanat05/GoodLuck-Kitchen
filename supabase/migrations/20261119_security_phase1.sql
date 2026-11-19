-- =====================================================================
-- Security Phase 1 — ปิดช่องโหว่หลัก โดยไม่เปลี่ยนพฤติกรรมของพนักงานที่ล็อกอินแล้ว
-- "พนักงาน" = profile ที่ is_approved = true (หรือ superadmin)
-- คนที่สมัครผ่าน /register แต่ยังไม่อนุมัติ จะไม่เห็นข้อมูลร้านอีกต่อไป
-- =====================================================================

-- ---------- 0. Helper functions ----------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (is_approved is true or role = 'superadmin')
  )
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'superadmin')
      and (is_approved is true or role = 'superadmin')
  )
$$;

-- ---------- 1. profiles: กันผู้ใช้แก้ role / อนุมัติตัวเอง ----------
create or replace function public.protect_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service role / SQL editor / trigger ระบบ ไม่มี auth.uid()
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    -- เฉพาะ superadmin เท่านั้นที่แต่งตั้ง superadmin ได้
    if new.role is distinct from old.role and new.role = 'superadmin'
       and (select role from public.profiles where id = auth.uid()) <> 'superadmin' then
      raise exception 'only superadmin can grant superadmin';
    end if;
    return new;
  end if;

  if new.role               is distinct from old.role
  or new.is_approved        is distinct from old.is_approved
  or new.branch_id          is distinct from old.branch_id
  or new.hourly_rate        is distinct from old.hourly_rate
  or new.default_savings    is distinct from old.default_savings
  or new.custom_order_limit is distinct from old.custom_order_limit
  or new.email              is distinct from old.email then
    raise exception 'not allowed to change privileged profile fields';
  end if;

  return new;
end $$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------- 2. orders: เลิกเปิดให้คนนอกอ่าน ----------
drop policy if exists "Kitchen can view all orders" on public.orders;
create policy "Staff can view orders" on public.orders
  for select to authenticated using (public.is_staff());

-- policy ของไรเดอร์เดิม: ใครล็อกอินก็เห็น/แก้งานที่ยังไม่มีไรเดอร์ได้ → จำกัดเฉพาะพนักงาน
do $$ declare r record; begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'orders' and policyname like 'ไรเดอร์%'
  loop execute format('drop policy %I on public.orders', r.policyname); end loop;
end $$;

create policy "Rider view unassigned or own" on public.orders
  for select to authenticated
  using (public.is_staff() and (rider_id is null or rider_id = auth.uid()));
create policy "Rider update unassigned or own" on public.orders
  for update to authenticated
  using (public.is_staff() and (rider_id is null or rider_id = auth.uid()));

-- ---------- 3. branches: เลิกเปิดให้ทุกคนแก้/ลบ ----------
do $$ declare r record; begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'branches'
             and cmd = 'ALL' and roles = '{public}' and qual = 'true'
  loop execute format('drop policy %I on public.branches', r.policyname); end loop;
end $$;

create policy "Admins update branches" on public.branches
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 4. schedule_settings: เลิกเปิดให้คนนอกแก้ ----------
drop policy if exists "Enable read access for all users"   on public.schedule_settings;
drop policy if exists "Enable update access for all users" on public.schedule_settings;
create policy "Staff read schedule_settings"   on public.schedule_settings for select to authenticated using (public.is_staff());
create policy "Staff insert schedule_settings" on public.schedule_settings for insert to authenticated with check (public.is_staff());
create policy "Staff update schedule_settings" on public.schedule_settings for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- 5. bank_transactions: แก้บั๊ก 'admin' || 'superadmin' = 'adminsuperadmin' ----------
drop policy if exists "Allow admins full access to bank_transactions" on public.bank_transactions;
create policy "Admins full access bank_transactions" on public.bank_transactions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 6. applications: คนนอกส่งใบสมัครได้ แต่อ่านได้เฉพาะแอดมิน ----------
drop policy if exists "Allow all for authenticated" on public.rider_applications;
create policy "Admins manage rider_applications" on public.rider_applications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- (คง policy "Allow public insert" เดิมไว้)

alter table public.kitchen_applications enable row level security;
create policy "Public submit kitchen_applications" on public.kitchen_applications
  for insert to anon, authenticated with check (true);
create policy "Admins manage kitchen_applications" on public.kitchen_applications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.admin_applications enable row level security;
create policy "Public submit admin_applications" on public.admin_applications
  for insert to anon, authenticated with check (true);
create policy "Admins manage admin_applications" on public.admin_applications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 7. เปิด RLS ตารางที่เหลือ (เฉพาะพนักงาน) ----------
alter table public.store_settings enable row level security;
create policy "Staff read store_settings"    on public.store_settings for select to authenticated using (public.is_staff());
create policy "Admins update store_settings" on public.store_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- (คง "Superadmin Access Store Settings" เดิมไว้)

alter table public.branch_menus enable row level security;
create policy "Staff read branch_menus"    on public.branch_menus for select to authenticated using (public.is_staff());
create policy "Admins manage branch_menus" on public.branch_menus for all    to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.monthly_payments enable row level security;
create policy "Rider read own monthly_payments" on public.monthly_payments
  for select to authenticated using (rider_id = auth.uid() or public.is_admin());
create policy "Admins manage monthly_payments"  on public.monthly_payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.activity_logs enable row level security;
create policy "Staff read activity_logs"   on public.activity_logs for select to authenticated using (public.is_staff());
create policy "Staff insert activity_logs" on public.activity_logs for insert to authenticated with check (public.is_staff());

-- ตารางที่หลายตำแหน่งใช้งานร่วมกัน: ให้สิทธิ์พนักงานทุกคนเท่าเดิมไปก่อน (จะแยกตาม role ใน Phase 2)
alter table public.stock_items        enable row level security;
alter table public.stock_balances     enable row level security;
alter table public.stock_logs         enable row level security;
alter table public.rider_attendance   enable row level security;
alter table public.kitchen_attendance enable row level security;
alter table public.shared_gallery     enable row level security;
alter table public.gallery_categories enable row level security;

create policy "Staff all stock_items"        on public.stock_items        for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff all stock_balances"     on public.stock_balances     for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff all stock_logs"         on public.stock_logs         for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff all rider_attendance"   on public.rider_attendance   for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff all kitchen_attendance" on public.kitchen_attendance for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff all shared_gallery"     on public.shared_gallery     for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff all gallery_categories" on public.gallery_categories for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- 8. work_schedules: policy "all" เปิดให้ทุกคนที่ล็อกอิน → จำกัดเฉพาะพนักงาน ----------
drop policy if exists "all" on public.work_schedules;
create policy "Staff all work_schedules" on public.work_schedules
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- 9. get_email_by_username: ILIKE ทำให้ % / _ เป็น wildcard → ใช้เทียบตรงตัว (ไม่สนตัวพิมพ์/ช่องว่างหัวท้าย) ----------
create or replace function public.get_email_by_username(p_username text)
returns text
language sql stable security definer set search_path = public as $$
  select email from public.profiles
  where lower(trim(username)) = lower(trim(p_username))
  order by created_at
  limit 1
$$;

-- ---------- 10. กันชื่อเล่นซ้ำ (ไม่สนตัวพิมพ์/ช่องว่างหัวท้าย) — รวมบัญชี "โด่ง" ที่ซ้ำแล้วเมื่อ 2026-11-20 ----------
create unique index if not exists profiles_username_unique_ci
  on public.profiles (lower(trim(username)));
