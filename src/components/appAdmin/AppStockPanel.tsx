"use client";
import { useEffect, useState } from "react";
import { Loader2, Smartphone, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { setMenuAvailable, setStoreOpen } from "@/lib/appToggles";
import Switch from "./Switch";
import type { AppStore, AppStoreMenu } from "@/types/appStore";

/**
 * แผงสำหรับแม่ครัวบนบอร์ด: เปิด/ปิดรับออเดอร์จากแอป และกด "เมนูหมด"
 * (แก้ราคา/ชื่อไม่ได้ — ทำได้เฉพาะแอดมินที่หน้า /app-admin)
 */
export default function AppStockPanel({ onClose }: { onClose: () => void }) {
  const [stores, setStores] = useState<AppStore[] | null>(null);
  const [menus, setMenus] = useState<AppStoreMenu[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("stores").select("*").order("sort_index").order("name"),
      supabase.from("store_menus").select("*").order("sort_index").order("name"),
    ]).then(([s, m]) => {
      setStores(s.data ?? []);
      setMenus(m.data ?? []);
    });
    const ch = supabase
      .channel("board-app-stock")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "stores" }, ({ new: n }) =>
        setStores((p) => p?.map((s) => (s.id === (n as AppStore).id ? { ...s, ...(n as AppStore) } : s)) ?? p))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "store_menus" }, ({ new: n }) =>
        setMenus((p) => p.map((m) => (m.id === (n as AppStoreMenu).id ? { ...m, ...(n as AppStoreMenu) } : m))))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleStore = async (s: AppStore, open: boolean) => {
    setStores((p) => p?.map((x) => (x.id === s.id ? { ...x, is_open: open } : x)) ?? p);
    const err = await setStoreOpen(s.id, open);
    if (err) {
      setStores((p) => p?.map((x) => (x.id === s.id ? { ...x, is_open: !open } : x)) ?? p);
      setError(err);
    }
  };

  const toggleMenu = async (m: AppStoreMenu, available: boolean) => {
    setMenus((p) => p.map((x) => (x.id === m.id ? { ...x, is_available: available } : x)));
    const err = await setMenuAvailable(m.id, available);
    if (err) {
      setMenus((p) => p.map((x) => (x.id === m.id ? { ...x, is_available: !available } : x)));
      setError(err);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100"><Smartphone size={20} className="text-emerald-600" /></div>
          <div className="flex-1">
            <h2 className="font-black text-slate-800">แอป Delivery</h2>
            <p className="text-xs font-bold text-slate-400">ปิดร้านชั่วคราว / กดเมนูที่หมด</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={22} /></button>
        </div>

        {error && (
          <p className="mx-5 mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600" onClick={() => setError("")}>{error}</p>
        )}

        <div className="space-y-4 overflow-y-auto p-5">
          {stores === null ? (
            <Loader2 className="mx-auto my-10 animate-spin text-blue-500" />
          ) : stores.length === 0 ? (
            <p className="py-10 text-center font-bold text-slate-400">ยังไม่มีร้านในแอป</p>
          ) : (
            stores.map((s) => {
              const items = menus.filter((m) => m.store_id === s.id);
              return (
                <section key={s.id} className={`overflow-hidden rounded-2xl border-2 ${s.is_open ? "border-emerald-200" : "border-slate-200"}`}>
                  <div className={`flex items-center gap-3 px-4 py-3 ${s.is_open ? "bg-emerald-50" : "bg-slate-100"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-slate-800">{s.name}</p>
                      <p className={`text-xs font-black ${s.is_open ? "text-emerald-600" : "text-slate-500"}`}>
                        {s.is_open ? "● เปิดรับออเดอร์" : "ปิดรับออเดอร์"}
                      </p>
                    </div>
                    <Switch size="lg" checked={s.is_open} onChange={(v) => toggleStore(s, v)} label={`เปิดร้าน ${s.name}`} />
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {items.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className={`min-w-0 flex-1 truncate text-sm font-bold ${m.is_available ? "text-slate-700" : "text-slate-400 line-through"}`}>{m.name}</span>
                        {!m.is_available && <span className="rounded bg-red-100 px-1.5 text-xs font-black text-red-600">หมด</span>}
                        <Switch checked={m.is_available} onChange={(v) => toggleMenu(m, v)} label={`มีขาย ${m.name}`} />
                      </li>
                    ))}
                    {items.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">ไม่มีเมนู</li>}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
