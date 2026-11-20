"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bike, ChevronLeft, ExternalLink, Loader2, Pencil, Plus, Search, Smartphone, Store, Trash2, Utensils,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { mediaUrl } from "@/lib/media";
import { setMenuAvailable, setStoreOpen } from "@/lib/appToggles";
import Switch from "@/components/appAdmin/Switch";
import StoreFormModal from "@/components/appAdmin/StoreFormModal";
import MenuFormModal from "@/components/appAdmin/MenuFormModal";
import type { AppStore, AppStoreMenu } from "@/types/appStore";

type Branch = { id: string; name: string };
const CUSTOMER_APP_URL = process.env.NEXT_PUBLIC_DELIVERY_APP_URL || "";

export default function AppAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stores, setStores] = useState<AppStore[]>([]);
  const [menus, setMenus] = useState<AppStoreMenu[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [storeModal, setStoreModal] = useState<{ store: AppStore | null } | null>(null);
  const [menuModal, setMenuModal] = useState<{ menu: AppStoreMenu | null } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ---------- โหลด + ตรวจสิทธิ์ (แอดมินเท่านั้น) ----------
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (isAdmin !== true) return router.push("/rider");

      const [b, s, m] = await Promise.all([
        supabase.from("branches").select("id, name").order("created_at"),
        supabase.from("stores").select("*").order("sort_index").order("name"),
        supabase.from("store_menus").select("*").order("sort_index").order("name"),
      ]);
      setBranches(b.data ?? []);
      setStores(s.data ?? []);
      setMenus(m.data ?? []);
      setSelectedId(s.data?.[0]?.id ?? null);
      setReady(true);
    })();
  }, [router]);

  // ---------- Realtime: แม่ครัวกดปิดร้าน/เมนูหมดจากบอร์ด → หน้านี้อัปเดตตาม ----------
  useEffect(() => {
    const ch = supabase
      .channel("app-admin")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "stores" }, ({ new: n }) =>
        setStores((p) => p.map((s) => (s.id === (n as AppStore).id ? { ...s, ...(n as AppStore) } : s))))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "store_menus" }, ({ new: n }) =>
        setMenus((p) => p.map((m) => (m.id === (n as AppStoreMenu).id ? { ...m, ...(n as AppStoreMenu) } : m))))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const store = stores.find((s) => s.id === selectedId) ?? null;
  const storeMenus = useMemo(() => menus.filter((m) => m.store_id === selectedId), [menus, selectedId]);
  const categories = useMemo(() => [...new Set(menus.map((m) => m.category).filter(Boolean) as string[])], [menus]);
  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map<string, AppStoreMenu[]>();
    storeMenus
      .filter((m) => !term || m.name.toLowerCase().includes(term))
      .forEach((m) => {
        const k = m.category || "ไม่มีหมวด";
        map.set(k, [...(map.get(k) ?? []), m]);
      });
    return [...map.entries()];
  }, [storeMenus, search]);

  // ---------- actions ----------
  const toggleStore = async (s: AppStore, open: boolean) => {
    setStores((p) => p.map((x) => (x.id === s.id ? { ...x, is_open: open } : x)));
    const err = await setStoreOpen(s.id, open);
    if (err) {
      setStores((p) => p.map((x) => (x.id === s.id ? { ...x, is_open: !open } : x)));
      notify(err, false);
    } else notify(open ? `เปิดร้าน ${s.name} แล้ว` : `ปิดร้าน ${s.name} แล้ว`);
  };

  const toggleMenu = async (m: AppStoreMenu, available: boolean) => {
    setMenus((p) => p.map((x) => (x.id === m.id ? { ...x, is_available: available } : x)));
    const err = await setMenuAvailable(m.id, available);
    if (err) {
      setMenus((p) => p.map((x) => (x.id === m.id ? { ...x, is_available: !available } : x)));
      notify(err, false);
    }
  };

  const deleteStore = async (s: AppStore) => {
    if (!confirm(`ลบร้าน "${s.name}" และเมนูทั้งหมดของร้านนี้?\n(ออเดอร์เก่ายังอยู่ครบ)`)) return;
    const { error } = await supabase.from("stores").delete().eq("id", s.id);
    if (error) return notify(error.message, false);
    setStores((p) => p.filter((x) => x.id !== s.id));
    setMenus((p) => p.filter((m) => m.store_id !== s.id));
    setSelectedId(stores.find((x) => x.id !== s.id)?.id ?? null);
    notify("ลบร้านแล้ว");
  };

  const deleteMenu = async (m: AppStoreMenu) => {
    if (!confirm(`ลบเมนู "${m.name}"?\nถ้าแค่ของหมดวันนี้ ให้ปิดสวิตช์แทน`)) return;
    const { error } = await supabase.from("store_menus").delete().eq("id", m.id);
    if (error) return notify(error.message, false);
    setMenus((p) => p.filter((x) => x.id !== m.id));
    notify("ลบเมนูแล้ว");
  };

  if (!ready)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 size={40} className="animate-spin text-blue-500" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* ---------- header ---------- */}
      <div className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <button onClick={() => router.push("/home")} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><ChevronLeft /></button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100"><Smartphone size={20} className="text-emerald-600" /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-800">จัดการแอป Delivery</h1>
            <p className="text-xs font-bold text-slate-400">ร้าน · เมนู · ค่าส่ง · เปิด/ปิดร้าน</p>
          </div>
          <button onClick={() => setStoreModal({ store: null })} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700">
            <Plus size={18} /> <span className="hidden sm:inline">เพิ่มร้าน</span>
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* ---------- รายการร้าน ---------- */}
        {stores.length === 0 ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm">
            <Store size={48} className="mx-auto mb-3 text-slate-300" />
            <p className="font-black text-slate-700">ยังไม่มีร้านในแอป</p>
            <p className="mb-4 text-sm text-slate-500">เพิ่มร้านแรก แล้วใส่เมนูได้เลย</p>
            <button onClick={() => setStoreModal({ store: null })} className="rounded-xl bg-blue-600 px-5 py-2.5 font-black text-white">เพิ่มร้าน</button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => {
              const active = s.id === selectedId;
              const count = menus.filter((m) => m.store_id === s.id).length;
              const soldOut = menus.filter((m) => m.store_id === s.id && !m.is_available).length;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`cursor-pointer overflow-hidden rounded-3xl border-2 bg-white shadow-sm transition ${active ? "border-blue-500 shadow-blue-100" : "border-transparent hover:border-slate-200"}`}
                >
                  <div className="relative h-24 bg-gradient-to-br from-emerald-500 to-emerald-700">
                    {s.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(s.cover_url)} alt="" className="h-full w-full object-cover" />
                    )}
                    <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-black ${s.is_open ? "bg-emerald-500 text-white" : "bg-slate-800/70 text-white"}`}>
                      {s.is_open ? "● เปิดอยู่" : "ปิดอยู่"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-slate-800">{s.name}</p>
                      <p className="text-xs font-bold text-slate-400">
                        {count} เมนู{soldOut > 0 && <span className="text-red-500"> · หมด {soldOut}</span>} · {branches.find((b) => b.id === s.branch_id)?.name}
                      </p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Switch size="lg" checked={s.is_open} onChange={(v) => toggleStore(s, v)} label={`เปิดร้าน ${s.name}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------- รายละเอียดร้านที่เลือก + เมนู ---------- */}
        {store && (
          <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-5">
              {store.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(store.logo_url)} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"><Store className="text-slate-400" /></div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-black text-slate-800">{store.name}</h2>
                <p className="flex flex-wrap items-center gap-x-3 text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1"><Bike size={13} /> {store.delivery_base_fee}฿ (รวม {Number(store.delivery_free_km)} กม.) + {store.delivery_per_km}฿/กม. · ไกลสุด {Number(store.max_delivery_km)} กม.</span>
                  {store.min_order_amount > 0 && <span>ขั้นต่ำ {store.min_order_amount}฿</span>}
                </p>
              </div>
              <div className="flex gap-2">
                {CUSTOMER_APP_URL && (
                  <a href={`${CUSTOMER_APP_URL}/store/${store.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200">
                    <ExternalLink size={15} /> ดูในแอป
                  </a>
                )}
                <button onClick={() => setStoreModal({ store })} className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200">
                  <Pencil size={15} /> แก้ไขร้าน
                </button>
                <button onClick={() => deleteStore(store)} aria-label="ลบร้าน" className="rounded-xl bg-red-50 px-3 py-2 text-red-500 hover:bg-red-100">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-5 sm:flex-row">
              <div className="relative flex-1">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาเมนู..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-bold outline-none focus:border-blue-500"
                />
              </div>
              <button onClick={() => setMenuModal({ menu: null })} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700">
                <Plus size={18} /> เพิ่มเมนู
              </button>
            </div>

            <div className="space-y-6 px-5 pb-6">
              {grouped.length === 0 && (
                <div className="py-10 text-center text-slate-400">
                  <Utensils size={36} className="mx-auto mb-2" />
                  <p className="font-bold">{storeMenus.length ? "ไม่พบเมนูที่ค้นหา" : "ยังไม่มีเมนู"}</p>
                </div>
              )}
              {grouped.map(([cat, items]) => (
                <section key={cat}>
                  <h3 className="mb-2 text-sm font-black text-slate-500">{cat} <span className="font-bold text-slate-300">({items.length})</span></h3>
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
                    {items.map((m) => (
                      <div key={m.id} className={`flex items-center gap-3 p-3 ${m.is_available ? "bg-white" : "bg-slate-50"}`}>
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          {m.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaUrl(m.image_url)} alt="" className={`h-full w-full object-cover ${m.is_available ? "" : "grayscale"}`} />
                          ) : (
                            <Utensils size={20} className="m-auto mt-4 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate font-black ${m.is_available ? "text-slate-800" : "text-slate-400 line-through"}`}>{m.name}</p>
                          <p className="text-sm font-bold text-slate-500">
                            {m.price}฿ {!m.is_available && <span className="ml-1 rounded bg-red-100 px-1.5 text-xs text-red-600">หมด</span>}
                          </p>
                        </div>
                        <Switch checked={m.is_available} onChange={(v) => toggleMenu(m, v)} label={`มีขาย ${m.name}`} />
                        <button onClick={() => setMenuModal({ menu: m })} aria-label="แก้ไข" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Pencil size={16} /></button>
                        <button onClick={() => deleteMenu(m)} aria-label="ลบ" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>

      {storeModal && (
        <StoreFormModal
          store={storeModal.store}
          branches={branches}
          nextSort={stores.length + 1}
          onClose={() => setStoreModal(null)}
          onSaved={(s) => {
            setStores((p) => (p.some((x) => x.id === s.id) ? p.map((x) => (x.id === s.id ? s : x)) : [...p, s]));
            setSelectedId(s.id);
            setStoreModal(null);
            notify("บันทึกร้านแล้ว");
          }}
        />
      )}
      {menuModal && store && (
        <MenuFormModal
          storeId={store.id}
          menu={menuModal.menu}
          categories={categories}
          nextSort={storeMenus.length + 1}
          onClose={() => setMenuModal(null)}
          onSaved={(m) => {
            setMenus((p) => (p.some((x) => x.id === m.id) ? p.map((x) => (x.id === m.id ? m : x)) : [...p, m]));
            setMenuModal(null);
            notify("บันทึกเมนูแล้ว");
          }}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-xl ${toast.ok ? "bg-slate-800" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
