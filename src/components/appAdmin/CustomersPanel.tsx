"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Loader2, Mail, Phone, Search, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Customer {
  id: string;
  display_name: string | null;
  phone: string | null;
  created_at: string;
  is_blocked?: boolean;
  blocked_reason?: string | null;
  blocked_at?: string | null;
}
interface CustomerOrder {
  id: string;
  customer_id: string;
  order_number: string | null;
  created_at: string;
  status: string;
  total_price: number | null;
  is_deleted: boolean | null;
  store_id: string | null;
  menu: string | null;
}
type AuthInfo = Record<string, { email: string | null; last_sign_in_at: string | null; email_confirmed: boolean }>;
type SortKey = "recent_order" | "spend" | "newest";

const DONE = "ส่งแล้ว/เสร็จ";
const fmtDate = (s: string | null | undefined, withTime = false) =>
  s ? new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }) : "—";

export default function CustomersPanel({ storeNames }: { storeNames: Record<string, string> }) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [authInfo, setAuthInfo] = useState<AuthInfo>({});
  const [needsMigration, setNeedsMigration] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notesReady, setNotesReady] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent_order");
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const full = await supabase
      .from("customers")
      .select("id, display_name, phone, created_at, is_blocked, blocked_reason, blocked_at")
      .order("created_at", { ascending: false });
    let rows: Customer[] | null = full.data;
    let err = full.error;
    if (err?.message?.includes("is_blocked")) {
      // ยังไม่ได้รัน migration 20261121_customer_admin → ดูได้อย่างเดียว
      setNeedsMigration(true);
      const basic = await supabase.from("customers").select("id, display_name, phone, created_at").order("created_at", { ascending: false });
      rows = basic.data;
      err = basic.error;
    }
    if (err) return setError(err.message);
    setCustomers(rows ?? []);

    const { data: o } = await supabase
      .from("orders")
      .select("id, customer_id, order_number, created_at, status, total_price, is_deleted, store_id, menu")
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000);
    setOrders((o as CustomerOrder[]) ?? []);

    const { data: s } = await supabase.auth.getSession();
    const res = await fetch("/api/app-admin/customers", { headers: { Authorization: `Bearer ${s.session?.access_token ?? ""}` } });
    if (res.ok) setAuthInfo((await res.json()).users ?? {});

    // โน้ตภายในเก็บในตารางแยกที่แอดมินเท่านั้นอ่านได้ (migration 20261121b)
    const { data: n, error: noteErr } = await supabase.from("customer_notes").select("customer_id, note");
    if (noteErr) setNotesReady(false);
    else {
      setNotesReady(true);
      setNotes(Object.fromEntries((n ?? []).map((r) => [r.customer_id as string, r.note as string])));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const map: Record<string, { count: number; done: number; spend: number; last: string | null }> = {};
    for (const o of orders) {
      const m = (map[o.customer_id] ??= { count: 0, done: 0, spend: 0, last: null });
      m.count++;
      if (o.status === DONE && !o.is_deleted) {
        m.done++;
        m.spend += o.total_price ?? 0;
      }
      if (!m.last || o.created_at > m.last) m.last = o.created_at;
    }
    return map;
  }, [orders]);

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = (customers ?? []).filter((c) => {
      if (onlyBlocked && !c.is_blocked) return false;
      if (!term) return true;
      return [c.display_name, c.phone, authInfo[c.id]?.email].some((v) => v?.toLowerCase().includes(term));
    });
    const key = (c: Customer) =>
      sort === "spend" ? stats[c.id]?.spend ?? 0 : sort === "newest" ? new Date(c.created_at).getTime() : new Date(stats[c.id]?.last ?? 0).getTime();
    return rows.sort((a, b) => key(b) - key(a));
  }, [customers, search, sort, onlyBlocked, stats, authInfo]);

  const weekAgo = Date.now() - 7 * 86400000;
  const summary = {
    total: customers?.length ?? 0,
    newWeek: customers?.filter((c) => new Date(c.created_at).getTime() > weekAgo).length ?? 0,
    ordered: customers?.filter((c) => stats[c.id]?.count).length ?? 0,
    blocked: customers?.filter((c) => c.is_blocked).length ?? 0,
  };

  const selected = customers?.find((c) => c.id === selectedId) ?? null;

  if (error) return <p className="rounded-2xl bg-red-50 p-4 font-bold text-red-600">{error}</p>;
  if (!customers) return <Loader2 className="mx-auto my-16 animate-spin text-blue-500" size={36} />;

  return (
    <div className="space-y-5">
      {needsMigration && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
          ยังไม่ได้รัน migration <code>20261121_customer_admin.sql</code> — ดูข้อมูลได้ แต่ยังระงับบัญชี/แก้ข้อมูลลูกค้าไม่ได้
        </p>
      )}

      {/* ---------- สรุป ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["ลูกค้าทั้งหมด", summary.total, "text-slate-800"],
          ["สมัครใหม่ 7 วัน", summary.newWeek, "text-blue-600"],
          ["เคยสั่งอาหาร", summary.ordered, "text-emerald-600"],
          ["ถูกระงับ", summary.blocked, "text-red-500"],
        ].map(([label, value, color]) => (
          <div key={label as string} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400">{label}</p>
            <p className={`mt-1 text-2xl font-black ${color}`}>{(value as number).toLocaleString("th-TH")}</p>
          </div>
        ))}
      </div>

      {/* ---------- ค้นหา / เรียง ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / เบอร์โทร / อีเมล..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-bold outline-none focus:border-blue-500"
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600">
          <option value="recent_order">สั่งล่าสุด</option>
          <option value="spend">ยอดซื้อสูงสุด</option>
          <option value="newest">สมัครล่าสุด</option>
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600">
          <input type="checkbox" checked={onlyBlocked} onChange={(e) => setOnlyBlocked(e.target.checked)} /> เฉพาะที่ถูกระงับ
        </label>
      </div>

      {/* ---------- รายชื่อ ---------- */}
      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        {list.length === 0 ? (
          <div className="py-14 text-center text-slate-400">
            <Users size={40} className="mx-auto mb-2" />
            <p className="font-bold">{customers.length ? "ไม่พบลูกค้าที่ค้นหา" : "ยังไม่มีลูกค้าสมัครในแอป"}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {list.map((c) => {
              const st = stats[c.id];
              const email = authInfo[c.id]?.email;
              return (
                <button key={c.id} onClick={() => setSelectedId(c.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-black text-white ${c.is_blocked ? "bg-red-400" : "bg-emerald-500"}`}>
                    {(c.display_name || "?").slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-black text-slate-800">
                      {c.display_name || "ไม่ระบุชื่อ"}
                      {c.is_blocked && <span className="rounded bg-red-100 px-1.5 text-[11px] text-red-600">ระงับ</span>}
                    </p>
                    <p className="truncate text-xs font-bold text-slate-400">
                      {c.phone || "ไม่มีเบอร์"}{email && ` · ${email}`}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-black text-slate-700">{(st?.spend ?? 0).toLocaleString("th-TH")}฿</p>
                    <p className="text-xs font-bold text-slate-400">{st?.done ?? 0} ออเดอร์สำเร็จ</p>
                  </div>
                  <div className="w-24 shrink-0 text-right text-xs font-bold text-slate-400">
                    {st?.last ? <>สั่งล่าสุด<br />{fmtDate(st.last)}</> : <>สมัคร<br />{fmtDate(c.created_at)}</>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <CustomerDrawer
          key={selected.id}
          customer={selected}
          auth={authInfo[selected.id]}
          orders={orders.filter((o) => o.customer_id === selected.id)}
          storeNames={storeNames}
          canEdit={!needsMigration}
          note={notes[selected.id] ?? ""}
          notesReady={notesReady}
          onNoteSaved={(text) => setNotes((p) => ({ ...p, [selected.id]: text }))}
          onClose={() => setSelectedId(null)}
          onSaved={(c) => setCustomers((p) => p?.map((x) => (x.id === c.id ? { ...x, ...c } : x)) ?? p)}
        />
      )}
    </div>
  );
}

function CustomerDrawer({
  customer,
  auth,
  orders,
  storeNames,
  canEdit,
  note,
  notesReady,
  onNoteSaved,
  onClose,
  onSaved,
}: {
  customer: Customer;
  auth?: AuthInfo[string];
  orders: CustomerOrder[];
  storeNames: Record<string, string>;
  canEdit: boolean;
  note: string;
  notesReady: boolean;
  onNoteSaved: (text: string) => void;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const [form, setForm] = useState({
    display_name: customer.display_name ?? "",
    phone: customer.phone ?? "",
    admin_note: note,
    blocked_reason: customer.blocked_reason ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async (patch: Partial<Customer>) => {
    setSaving(true);
    setMsg("");
    const { data, error } = await supabase.from("customers").update(patch).eq("id", customer.id).select().single();
    setSaving(false);
    if (error) return setMsg(error.message);
    onSaved(data as Customer);
    setMsg("บันทึกแล้ว");
  };

  const toggleBlock = () => {
    if (!customer.is_blocked && !form.blocked_reason.trim()) return setMsg("กรุณาระบุเหตุผลที่ระงับ");
    const block = !customer.is_blocked;
    if (!confirm(block ? `ระงับบัญชี "${customer.display_name}"? ลูกค้าจะสั่งอาหารไม่ได้จนกว่าจะปลด` : `ปลดระงับ "${customer.display_name}"?`)) return;
    save({ is_blocked: block, blocked_reason: block ? form.blocked_reason.trim() : null });
  };

  const done = orders.filter((o) => o.status === DONE && !o.is_deleted);
  const input = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-black text-white ${customer.is_blocked ? "bg-red-400" : "bg-emerald-500"}`}>
            {(customer.display_name || "?").slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black text-slate-800">{customer.display_name || "ไม่ระบุชื่อ"}</h2>
            <p className="text-xs font-bold text-slate-400">สมัคร {fmtDate(customer.created_at)} · เข้าระบบล่าสุด {fmtDate(auth?.last_sign_in_at, true)}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={22} /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {customer.is_blocked && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-600">
              <Ban size={15} className="mr-1 inline" /> ถูกระงับเมื่อ {fmtDate(customer.blocked_at, true)} — {customer.blocked_reason || "ไม่ระบุเหตุผล"}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"><Phone size={15} /> {customer.phone}</a>
            )}
            {auth?.email && (
              <span className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
                <Mail size={15} /> {auth.email} {!auth.email_confirmed && <span className="text-amber-600">(ยังไม่ยืนยัน)</span>}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">ออเดอร์ทั้งหมด</p><p className="text-xl font-black">{orders.length}</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">สำเร็จ</p><p className="text-xl font-black text-emerald-600">{done.length}</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">ยอดซื้อ</p><p className="text-xl font-black">{done.reduce((s, o) => s + (o.total_price ?? 0), 0).toLocaleString("th-TH")}฿</p></div>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-black text-slate-700">ข้อมูลลูกค้า</h3>
            <input className={input} disabled={!canEdit} value={form.display_name} maxLength={100} placeholder="ชื่อ" onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            <input className={input} disabled={!canEdit} value={form.phone} maxLength={20} placeholder="เบอร์โทร" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <textarea className={`${input} resize-none`} disabled={!canEdit || !notesReady} rows={2} value={form.admin_note} maxLength={500} placeholder={notesReady ? "โน้ตภายใน (ลูกค้ามองไม่เห็น) เช่น ชอบเผ็ดน้อย / ตึก B" : "โน้ตภายใน: ต้องรัน migration 20261121b ก่อน"} onChange={(e) => setForm({ ...form, admin_note: e.target.value })} />
            <button
              disabled={!canEdit || saving}
              onClick={async () => {
                await save({ display_name: form.display_name.trim() || null, phone: form.phone.trim() || null });
                if (!notesReady || form.admin_note.trim() === note.trim()) return;
                const { data: s } = await supabase.auth.getSession();
                const { error } = await supabase.from("customer_notes").upsert({
                  customer_id: customer.id,
                  note: form.admin_note.trim(),
                  updated_at: new Date().toISOString(),
                  updated_by: s.session?.user.id ?? null,
                });
                if (error) setMsg("บันทึกโน้ตไม่สำเร็จ: " + error.message);
                else onNoteSaved(form.admin_note.trim());
              }}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          </section>

          <section className="space-y-2 rounded-2xl border border-slate-100 p-4">
            <h3 className="text-sm font-black text-slate-700">{customer.is_blocked ? "ปลดระงับบัญชี" : "ระงับบัญชี"}</h3>
            {!customer.is_blocked && (
              <input className={input} disabled={!canEdit} value={form.blocked_reason} maxLength={200} placeholder="เหตุผล เช่น สั่งแล้วไม่รับของ 2 ครั้ง" onChange={(e) => setForm({ ...form, blocked_reason: e.target.value })} />
            )}
            <button
              disabled={!canEdit || saving}
              onClick={toggleBlock}
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-black disabled:opacity-50 ${customer.is_blocked ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
            >
              {customer.is_blocked ? <><ShieldCheck size={16} /> ปลดระงับ</> : <><Ban size={16} /> ระงับบัญชี (สั่งอาหารไม่ได้)</>}
            </button>
          </section>
          {msg && <p className={`text-center text-sm font-bold ${msg === "บันทึกแล้ว" ? "text-emerald-600" : "text-red-500"}`}>{msg}</p>}

          <section>
            <h3 className="mb-2 text-sm font-black text-slate-700">ประวัติการสั่ง</h3>
            {orders.length === 0 ? (
              <p className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400"><UserRound size={16} /> ยังไม่เคยสั่ง</p>
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
                {orders.map((o) => (
                  <div key={o.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-700">#{o.order_number ?? "—"} · {o.store_id ? storeNames[o.store_id] ?? "ร้าน" : "—"}</p>
                      <p className="text-sm font-black">{o.total_price ?? 0}฿</p>
                    </div>
                    <p className="truncate text-xs text-slate-500">{o.menu?.split("\n").join(", ")}</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-400">
                      {fmtDate(o.created_at, true)} ·{" "}
                      <span className={o.is_deleted && o.status !== DONE ? "text-red-500" : o.status === DONE ? "text-emerald-600" : "text-amber-600"}>
                        {o.is_deleted && o.status !== DONE ? "ยกเลิก" : o.status}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
