"use client";
import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ImageField from "./ImageField";
import type { AppStoreMenu } from "@/types/appStore";

export default function MenuFormModal({
  storeId,
  menu,
  categories,
  nextSort,
  onClose,
  onSaved,
}: {
  storeId: string;
  menu: AppStoreMenu | null; // null = เพิ่มเมนูใหม่
  categories: string[];
  nextSort: number;
  onClose: () => void;
  onSaved: (m: AppStoreMenu) => void;
}) {
  const [f, setF] = useState({
    name: menu?.name ?? "",
    description: menu?.description ?? "",
    category: menu?.category ?? categories[0] ?? "",
    price: menu ? String(menu.price) : "",
    image_url: menu?.image_url ?? null,
    sort_index: String(menu?.sort_index ?? nextSort),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(f.price);
    if (!f.name.trim()) return setError("กรุณากรอกชื่อเมนู");
    if (!Number.isInteger(price) || price < 0) return setError("ราคาต้องเป็นจำนวนเต็มบาท");

    const payload = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      category: f.category.trim() || null,
      price,
      image_url: f.image_url,
      sort_index: Math.trunc(Number(f.sort_index) || 0),
    };
    setSaving(true);
    setError("");
    const q = menu
      ? supabase.from("store_menus").update(payload).eq("id", menu.id).select().single()
      : supabase.from("store_menus").insert({ ...payload, store_id: storeId, is_available: true }).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return setError(error.message);
    onSaved(data as AppStoreMenu);
  };

  const input = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
  const lbl = "mb-1 block text-xs font-bold text-slate-500";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-black text-slate-800">{menu ? "แก้ไขเมนู" : "เพิ่มเมนู"}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <ImageField label="รูปเมนู" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} />
            <div className="space-y-3">
              <label className="block">
                <span className={lbl}>ชื่อเมนู *</span>
                <input className={input} value={f.name} onChange={set("name")} maxLength={80} placeholder="ข้าวมันไก่ต้ม (พิเศษ)" />
              </label>
              <label className="block">
                <span className={lbl}>ราคา (บาท) *</span>
                <input type="number" min={0} step={1} inputMode="numeric" className={input} value={f.price} onChange={set("price")} />
              </label>
            </div>
          </div>
          <label className="block">
            <span className={lbl}>หมวดหมู่ (ใช้เป็นปุ่มหมวดในแอปลูกค้า)</span>
            <input className={input} list="app-menu-categories" value={f.category} onChange={set("category")} maxLength={30} placeholder="ข้าวแกง / ก๋วยเตี๋ยว / ของทานเล่น / น้ำ/ขนม" />
            <datalist id="app-menu-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
          <label className="block">
            <span className={lbl}>คำอธิบาย</span>
            <textarea className={`${input} resize-none`} rows={2} value={f.description} onChange={set("description")} maxLength={200} />
          </label>
          <label className="block w-32">
            <span className={lbl}>ลำดับ</span>
            <input type="number" className={input} value={f.sort_index} onChange={set("sort_index")} />
          </label>
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</p>}
          <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-300 disabled:shadow-none">
            {saving && <Loader2 size={18} className="animate-spin" />} บันทึก
          </button>
        </div>
      </form>
    </div>
  );
}
