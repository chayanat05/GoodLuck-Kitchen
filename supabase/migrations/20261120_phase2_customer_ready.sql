-- =====================================================================
-- Phase 2 — เตรียมฐานข้อมูลให้พร้อมรับ "ลูกค้า" จากแอป delivery
--   A. แยกบัญชีลูกค้าออกจากพนักงาน (ลูกค้าไม่กลายเป็นไรเดอร์รออนุมัติ)
--   B. ปิดตารางที่ลูกค้าไม่ควรเห็น + เปลี่ยน policy เก่าที่เช็คแค่ role ให้เช็ค is_approved ด้วย
--   C. ตารางสำหรับแอปลูกค้า: stores, store_menus, customers, customer_addresses, order_items
--   D. ฟังก์ชัน place_order — ลูกค้าสั่งอาหารได้ทางเดียว ราคา/ค่าส่งคำนวณที่ DB เท่านั้น
-- พนักงานที่อนุมัติแล้วใช้งานได้เหมือนเดิมทุกอย่าง
-- =====================================================================

-- ---------- 0. helper: role ของพนักงานที่อนุมัติแล้ว (คนอื่นได้ null) ----------
create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles
  where id = auth.uid() and (is_approved is true or role = 'superadmin')
$$;
revoke execute on function public.staff_role() from public, anon;
grant  execute on function public.staff_role() to authenticated;

-- helper: ลบ policy ทั้งหมดของตาราง (ใช้ก่อนสร้างชุดใหม่ เพราะชื่อ policy ภาษาไทยเดิมถูกตัดท้าย)
create or replace function pg_temp.drop_all_policies(p_table text) returns void
language plpgsql as $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
    execute format('drop policy %I on public.%I', r.policyname, p_table);
  end loop;
end $$;

-- =====================================================================
-- C. ตารางใหม่ (สร้างก่อน เพราะ policy ของ orders อ้างถึง)
-- =====================================================================

-- ร้าน/แบรนด์ที่แสดงในแอป (หลายแบรนด์ทำจากครัวเดียวกัน = branch_id)
create table if not exists public.stores (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches(id) on delete restrict,
  name              text not null,
  slug              text not null unique,
  description       text,
  logo_url          text,
  cover_url         text,
  is_open           boolean not null default false,
  sort_index        integer not null default 0,
  -- ค่าส่ง: base + per_km * (กม. ที่เกิน free_km) วัดระยะตรงจากพิกัดครัว (branches.lat/lng)
  delivery_base_fee integer not null default 20 check (delivery_base_fee >= 0),
  delivery_per_km   integer not null default 5  check (delivery_per_km >= 0),
  delivery_free_km  numeric not null default 2  check (delivery_free_km >= 0),
  max_delivery_km   numeric not null default 7  check (max_delivery_km > 0),
  min_order_amount  integer not null default 0  check (min_order_amount >= 0),
  created_at        timestamptz not null default now()
);
create index if not exists stores_branch_id_idx on public.stores (branch_id);

create table if not exists public.store_menus (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  name         text not null,
  description  text,
  category     text,
  price        integer not null check (price >= 0),
  image_url    text,
  is_available boolean not null default true,
  sort_index   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists store_menus_store_id_idx on public.store_menus (store_id);

-- บัญชีลูกค้า (แยกจาก profiles ของพนักงาน)
create table if not exists public.customers (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone        text,
  created_at   timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label       text,
  address     text not null,
  lat         double precision not null,
  lng         double precision not null,
  note        text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists customer_addresses_customer_id_idx on public.customer_addresses (customer_id);

-- ผูกออเดอร์กับลูกค้า/ร้าน
alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.orders add column if not exists store_id    uuid references public.stores(id)    on delete set null;
create index if not exists orders_customer_id_idx on public.orders (customer_id) where customer_id is not null;
create index if not exists orders_store_id_idx    on public.orders (store_id)    where store_id    is not null;

-- ประเภทงานใหม่ 'แอป'
alter table public.orders drop constraint if exists orders_job_type_check;
alter table public.orders add constraint orders_job_type_check
  check (job_type = any (array['ร้าน', 'รับหิ้ว', 'รับส่ง', 'shopee', 'แอป']));

-- รายการอาหารในออเดอร์ (เก็บชื่อ/ราคา ณ ตอนสั่ง เผื่อเมนูถูกแก้ทีหลัง)
create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  store_menu_id uuid references public.store_menus(id) on delete set null,
  name          text not null,
  unit_price    integer not null check (unit_price >= 0),
  quantity      integer not null check (quantity between 1 and 50),
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists order_items_order_id_idx      on public.order_items (order_id);
create index if not exists order_items_store_menu_id_idx on public.order_items (store_menu_id);

-- =====================================================================
-- A. สมัครสมาชิก: ลูกค้า → customers / พนักงาน → profiles (rider รออนุมัติ เหมือนเดิม)
--    แอปลูกค้าต้องส่ง options.data = { account_type: 'customer', display_name, phone }
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_user_meta_data->>'account_type', '') = 'customer' then
    insert into public.customers (id, display_name, phone)
    values (
      new.id,
      left(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', ''), 100),
      left(new.raw_user_meta_data->>'phone', 20)
    );
  else
    insert into public.profiles (id, email, username, role)
    values (new.id, new.email, new.raw_user_meta_data->>'username', 'rider');
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- =====================================================================
-- B. ปิดตารางเดิม + เปลี่ยน policy ที่เช็คแค่ role
-- =====================================================================

-- ---------- profiles ----------
select pg_temp.drop_all_policies('profiles');
create policy "Read own profile or staff" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_staff()));
create policy "Update own profile" on public.profiles          -- คอลัมน์สำคัญถูกกันด้วย trigger protect_profile_columns
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Admins update profiles" on public.profiles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Superadmin delete profiles" on public.profiles
  for delete to authenticated using ((select public.staff_role()) = 'superadmin');

-- ---------- orders ----------
select pg_temp.drop_all_policies('orders');
create policy "Staff read orders" on public.orders
  for select to authenticated using ((select public.is_staff()));
create policy "Customer read own orders" on public.orders
  for select to authenticated using (customer_id = (select auth.uid()));
create policy "Admins manage orders" on public.orders
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Kitchen update orders" on public.orders
  for update to authenticated using ((select public.staff_role()) = 'kitchen');
create policy "Rider update unassigned or own" on public.orders
  for update to authenticated
  using ((select public.staff_role()) = 'rider' and (rider_id is null or rider_id = (select auth.uid())));

-- ---------- saved_locations (ที่อยู่ลูกค้าเก่า 400+ รายการ) ----------
select pg_temp.drop_all_policies('saved_locations');
create policy "Staff read saved_locations" on public.saved_locations
  for select to authenticated using ((select public.is_staff()));
create policy "Admins manage saved_locations" on public.saved_locations
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- contact_sources ----------
select pg_temp.drop_all_policies('contact_sources');
create policy "Staff read contact_sources" on public.contact_sources
  for select to authenticated using ((select public.is_staff()));
create policy "Admins manage contact_sources" on public.contact_sources
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- shop_menus ----------
select pg_temp.drop_all_policies('shop_menus');
create policy "Staff read shop_menus" on public.shop_menus
  for select to authenticated using ((select public.is_staff()));
create policy "Admins manage shop_menus" on public.shop_menus
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- =====================================================================
-- RLS ตารางใหม่
-- =====================================================================
alter table public.stores             enable row level security;
alter table public.store_menus        enable row level security;
alter table public.customers          enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.order_items        enable row level security;

-- ร้านและเมนู: ใครก็ดูได้ (หน้าร้านในแอป) / แอดมินจัดการ
create policy "Public read stores"      on public.stores      for select to anon, authenticated using (true);
create policy "Admins manage stores"    on public.stores      for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Public read store_menus" on public.store_menus for select to anon, authenticated using (true);
create policy "Admins manage store_menus" on public.store_menus for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ลูกค้า: ดู/แก้ของตัวเอง (สร้างแถวผ่าน trigger สมัครสมาชิกเท่านั้น) / พนักงานดูได้
create policy "Customer read own"   on public.customers for select to authenticated using (id = (select auth.uid()) or (select public.is_staff()));
create policy "Customer update own" on public.customers for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Customer manage own addresses" on public.customer_addresses
  for all to authenticated using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));

-- รายการอาหาร: ลูกค้าดูของออเดอร์ตัวเอง / พนักงานดู / แอดมินจัดการ (ลูกค้าเขียนผ่าน place_order เท่านั้น)
create policy "Read order_items" on public.order_items
  for select to authenticated using (
    (select public.is_staff())
    or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()))
  );
create policy "Admins manage order_items" on public.order_items
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- =====================================================================
-- D. place_order — ทางเดียวที่ลูกค้าสร้างออเดอร์ได้
--   p_items = [{"menu_id": "<uuid>", "qty": 2, "note": "ไม่เผ็ด"}, ...]
--   คืนค่า: { order_id, order_number, subtotal, delivery_fee, total, distance_km }
-- =====================================================================
create or replace function public.place_order(
  p_store_id       uuid,
  p_items          jsonb,
  p_address        text,
  p_lat            double precision,
  p_lng            double precision,
  p_payment_method text default 'เงินสด',
  p_note           text default null,
  p_phone          text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_customer  public.customers%rowtype;
  v_store     public.stores%rowtype;
  v_branch    public.branches%rowtype;
  v_item      jsonb;
  v_menu      public.store_menus%rowtype;
  v_qty       int;
  v_subtotal  int := 0;
  v_fee       int;
  v_dist      numeric;
  v_menu_text text := '';
  v_details   text;
  v_order     public.orders%rowtype;
  v_active    int;
begin
  -- ผู้เรียกต้องเป็นลูกค้า
  select * into v_customer from public.customers where id = v_uid;
  if not found then raise exception 'NOT_CUSTOMER'; end if;

  -- กันสแปม: ออเดอร์ที่ยังไม่เสร็จได้ไม่เกิน 3 ใบ
  select count(*) into v_active from public.orders
  where customer_id = v_uid and is_deleted is not true and is_archived is not true
    and status in ('ออเดอร์ใหม่', 'กำลังทำ', 'รับงาน');
  if v_active >= 3 then raise exception 'TOO_MANY_ACTIVE_ORDERS'; end if;

  select * into v_store from public.stores where id = p_store_id;
  if not found then raise exception 'STORE_NOT_FOUND'; end if;
  if not v_store.is_open then raise exception 'STORE_CLOSED'; end if;

  select * into v_branch from public.branches where id = v_store.branch_id;
  if v_branch.lat is null or v_branch.lng is null then raise exception 'KITCHEN_LOCATION_NOT_SET'; end if;

  if p_payment_method not in ('เงินสด', 'โอน') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if coalesce(btrim(p_address), '') = '' or p_lat is null or p_lng is null then raise exception 'ADDRESS_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'INVALID_ITEMS';
  end if;

  -- ระยะทาง (haversine) จากครัวถึงลูกค้า
  v_dist := round((6371 * 2 * asin(sqrt(
              power(sin(radians(p_lat - v_branch.lat::float8) / 2), 2) +
              cos(radians(v_branch.lat::float8)) * cos(radians(p_lat)) *
              power(sin(radians(p_lng - v_branch.lng::float8) / 2), 2)
            )))::numeric, 2);
  if v_dist > v_store.max_delivery_km then raise exception 'OUT_OF_DELIVERY_AREA'; end if;
  v_fee := v_store.delivery_base_fee
         + v_store.delivery_per_km * ceil(greatest(0, v_dist - v_store.delivery_free_km))::int;

  -- ตรวจเมนู + คำนวณราคาจาก DB
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'INVALID_QTY'; end if;
    select * into v_menu from public.store_menus
    where id = (v_item->>'menu_id')::uuid and store_id = p_store_id and is_available;
    if not found then raise exception 'MENU_UNAVAILABLE:%', v_item->>'menu_id'; end if;
    v_subtotal  := v_subtotal + v_menu.price * v_qty;
    v_menu_text := v_menu_text || case when v_menu_text = '' then '' else E'\n' end
                   || v_menu.name || ' x' || v_qty
                   || coalesce(' (' || nullif(btrim(left(v_item->>'note', 100)), '') || ')', '');
  end loop;

  if v_subtotal < v_store.min_order_amount then raise exception 'BELOW_MIN_ORDER'; end if;

  v_details := concat_ws(E'\n',
    'ลูกค้า: ' || coalesce(nullif(v_customer.display_name, ''), '-'),
    'โทร: '   || coalesce(nullif(btrim(left(p_phone, 20)), ''), v_customer.phone, '-'),
    nullif(btrim(left(p_note, 500)), ''));

  -- order_number ว่าง → trigger assign_order_number ออกเลขให้
  insert into public.orders (
    branch_id, store_id, customer_id, job_type, status, order_number,
    menu, details, address, lat, lng,
    total_price, delivery_fee, payment_method, contact_source
  ) values (
    v_store.branch_id, v_store.id, v_uid, 'แอป', 'ออเดอร์ใหม่', null,
    v_menu_text, v_details, left(btrim(p_address), 500), p_lat, p_lng,
    v_subtotal + v_fee, v_fee, p_payment_method, v_store.name
  ) returning * into v_order;

  insert into public.order_items (order_id, store_menu_id, name, unit_price, quantity, note)
  select v_order.id, m.id, m.name, m.price, (i->>'qty')::int, nullif(btrim(left(i->>'note', 100)), '')
  from jsonb_array_elements(p_items) i
  join public.store_menus m on m.id = (i->>'menu_id')::uuid;

  return jsonb_build_object(
    'order_id', v_order.id, 'order_number', v_order.order_number,
    'subtotal', v_subtotal, 'delivery_fee', v_fee,
    'total', v_subtotal + v_fee, 'distance_km', v_dist);
end $$;
revoke execute on function public.place_order(uuid, jsonb, text, double precision, double precision, text, text, text) from public, anon;
grant  execute on function public.place_order(uuid, jsonb, text, double precision, double precision, text, text, text) to authenticated;
