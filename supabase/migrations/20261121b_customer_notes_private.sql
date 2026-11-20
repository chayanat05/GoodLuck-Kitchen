-- =====================================================================
-- แก้ 20261121_customer_admin: โน้ตภายในของแอดมินต้องเป็นความลับจริง
-- เดิมเก็บใน customers.admin_note → ลูกค้าอ่านแถวตัวเองได้ (policy "Customer read own")
-- ย้ายไปตารางแยกที่แอดมินเท่านั้นอ่าน/เขียนได้
-- =====================================================================

create table if not exists public.customer_notes (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
alter table public.customer_notes enable row level security;

drop policy if exists "Admins manage customer_notes" on public.customer_notes;
create policy "Admins manage customer_notes" on public.customer_notes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ย้ายโน้ตที่มีอยู่ (ถ้ามี) แล้วลบคอลัมน์เดิม
insert into public.customer_notes (customer_id, note)
select id, admin_note from public.customers where admin_note is not null and btrim(admin_note) <> ''
on conflict (customer_id) do nothing;

-- trigger เดิมอ้าง admin_note → เขียนใหม่ก่อนลบคอลัมน์
create or replace function public.protect_customer_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.is_blocked     := old.is_blocked;
    new.blocked_reason := old.blocked_reason;
    new.blocked_at     := old.blocked_at;
  elsif new.is_blocked is distinct from old.is_blocked then
    new.blocked_at := case when new.is_blocked then now() end;
  end if;
  return new;
end $$;

alter table public.customers drop column if exists admin_note;
