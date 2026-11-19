-- =====================================================================
-- ทดสอบ Phase 2 หลังรัน 20261120_phase2_customer_ready.sql
-- รันใน SQL Editor ได้เลย: ทุกอย่างถูก ROLLBACK ตอนจบ (ไม่มีข้อมูลค้าง)
-- ผลลัพธ์จะแสดงเป็น "ERROR: TEST RESULT ..." — นั่นคือปกติ ให้อ่านข้อความข้างใน
-- =====================================================================
do $test$
declare
  b uuid; bl float8; bg float8; s uuid; m1 uuid; m2 uuid;
  cu uuid := gen_random_uuid(); st uuid := gen_random_uuid();
  res jsonb; r text; cnt int;
begin
  select id, lat::float8, lng::float8 into b, bl, bg from branches where name = 'สาขา 1';
  insert into stores(branch_id, name, slug, is_open) values (b, 'ร้านเดโม', 'verify-demo', true) returning id into s;
  insert into store_menus(store_id, name, price) values (s, 'ข้าวกะเพรา', 50) returning id into m1;
  insert into store_menus(store_id, name, price, is_available) values (s, 'ปิดขาย', 40, false) returning id into m2;

  -- สมัครแบบลูกค้า vs แบบพนักงาน
  insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (cu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-customer@example.invalid',
          '{"account_type":"customer","display_name":"ทดสอบ","phone":"0800000000"}', now(), now());
  insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (st, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-staff@example.invalid',
          '{"username":"verify-staff"}', now(), now());
  r := 'สมัครลูกค้า -> customers=' || (select count(*) from customers where id = cu) || ' profiles=' || (select count(*) from profiles where id = cu)
    || '  (ควรเป็น 1 / 0)'
    || E'\nสมัครพนักงาน -> profiles(rider)=' || (select count(*) from profiles where id = st and role = 'rider') || ' customers=' || (select count(*) from customers where id = st)
    || '  (ควรเป็น 1 / 0)';

  -- สวมบทเป็นลูกค้า
  perform set_config('request.jwt.claims', json_build_object('sub', cu, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  res := public.place_order(s, jsonb_build_array(jsonb_build_object('menu_id', m1, 'qty', 2, 'note', 'ไม่เผ็ด')),
                            'หอทดสอบ', bl + 0.03, bg, 'เงินสด', 'วางหน้าห้อง', null);
  r := r || E'\nplace_order -> ' || res::text || '  (ควรได้ subtotal 100 + ค่าส่ง)';

  select count(*) into cnt from profiles;        r := r || E'\nลูกค้ามองเห็น: profiles=' || cnt;
  select count(*) into cnt from saved_locations; r := r || ' saved_locations=' || cnt;
  select count(*) into cnt from contact_sources; r := r || ' contact_sources=' || cnt;
  select count(*) into cnt from orders;          r := r || ' orders=' || cnt;
  select count(*) into cnt from order_items;     r := r || ' order_items=' || cnt;
  r := r || '  (ควรเป็น 0 / 0 / 0 / 1 / 1)';

  begin perform public.place_order(s, jsonb_build_array(jsonb_build_object('menu_id', m2, 'qty', 1)), 'x', bl, bg);
        r := r || E'\n❌ สั่งเมนูปิดขายได้';
  exception when others then r := r || E'\n✅ เมนูปิดขาย -> ' || sqlerrm; end;
  begin perform public.place_order(s, jsonb_build_array(jsonb_build_object('menu_id', m1, 'qty', 1)), 'x', bl + 0.5, bg);
        r := r || E'\n❌ ส่งไกลเกินได้';
  exception when others then r := r || E'\n✅ ไกลเกิน -> ' || sqlerrm; end;
  begin insert into orders(branch_id, job_type, status) values (b, 'แอป', 'ออเดอร์ใหม่');
        r := r || E'\n❌ ลูกค้า insert orders ตรงได้';
  exception when others then r := r || E'\n✅ insert ตรง -> ' || sqlerrm; end;
  update orders set total_price = 1 where customer_id = cu;
  get diagnostics cnt = row_count;
  r := r || E'\n' || case when cnt = 0 then '✅' else '❌' end || ' ลูกค้าแก้ราคาออเดอร์ตัวเอง: แก้ได้ ' || cnt || ' แถว (ควรเป็น 0)';

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);

  r := r || E'\nบนบอร์ดจะเห็น: ' || (
    select '#' || order_number || ' / ' || job_type || ' / ' || status || ' / ร้าน=' || contact_source
        || ' / รวม=' || total_price || ' (ค่าส่ง ' || delivery_fee || ') / ' || replace(menu, E'\n', ', ')
        || ' / ' || replace(details, E'\n', ' | ')
    from orders where customer_id = cu limit 1);

  raise exception 'TEST RESULT (rolled back)%', E'\n' || r;
end $test$;
