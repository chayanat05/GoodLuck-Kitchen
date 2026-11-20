"use client";
import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ImageField from "./ImageField";
import type { AppStore } from "@/types/appStore";

type Branch = { id: string; name: string };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function StoreFormModal({
  store,
  branches,
  nextSort,
  onClose,
  onSaved,
}: {
  store: AppStore | null; // null = เพิ่มร้านใหม่
  branches: Branch[];
  nextSort: number;
  onClose: () => void;
  onSaved: (s: AppStore) => void;
}) {
  const [f, setF] = useState({
    name: store?.name ?? "",
    slug: store?.slug ?? "",
    description: store?.description ?? "",
    branch_id: store?.branch_id ?? branches[0]?.id ?? "",
    logo_url: store?.logo_url ?? null,
    cover_url: store?.cover_url ?? null,
    sort_index: String(store?.sort_index ?? nextSort),
    delivery_base_fee: String(store?.delivery_base_fee ?? 20),
    delivery_per_km: String(store?.delivery_per_km ?? 5),
    delivery_free_km: String(store?.delivery_free_km ?? 2),
    max_delivery_km: String(store?.max_delivery_km ?? 7),
    min_order_amount: String(store?.min_order_amount ?? 0),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = f.slug.trim().toLowerCase();
    if (!f.name.trim()) return setError("กรุณากรอกชื่อร้าน");
    if (!SLUG_RE.test(slug)) return setError("ลิงก์ร้านใช้ได้เฉพาะ a-z, 0-9 และ - เช่น khaomankai-jaetim");
    if (!f.branch_id) return setError("กรุณาเลือกครัว/สาขา");
    if (Number(f.max_delivery_km) <= 0) return setError("ระยะส่งไกลสุดต้องมากกว่า 0");

    const payload = {
      name: f.name.trim(),
      slug,
      description: f.description.trim() || null,
      branch_id: f.branch_id,
      logo_url: f.logo_url,
      cover_url: f.cover_url,
      sort_index: Math.trunc(Number(f.sort_index) || 0),
      delivery_base_fee: Math.max(0, Math.trunc(Number(f.delivery_base_fee) || 0)),
      delivery_per_km: Math.max(0, Math.trunc(Number(f.delivery_per_km) || 0)),
      delivery_free_km: Math.max(0, Number(f.delivery_free_km) || 0),
      max_delivery_km: Number(f.max_delivery_km),
      min_order_amount: Math.max(0, Math.trunc(Number(f.min_order_amount) || 0)),
    };

    setSaving(true);
    setError("");
    const q = store
      ? supabase.from("stores").update(payload).eq("id", store.id).select().single()
      : supabase.from("stores").insert({ ...payload, is_open: false }).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return setError(error.code === "23505" ? "ลิงก์ร้านนี้มีร้านอื่นใช้แล้ว" : error.message);
    onSaved(data as AppStore);
  };

  const input = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
  const lbl = "mb-1 block text-xs font-bold text-slate-500";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-black text-slate-800">{store ? "แก้ไขร้าน" : "เพิ่มร้านใหม่"}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-[100px_1fr] gap-4">
            <ImageField label="โลโก้" value={f.logo_url} onChange={(url) => setF({ ...f, logo_url: url })} />
            <ImageField label="รูปปกร้าน (แนวนอน)" value={f.cover_url} onChange={(url) => setF({ ...f, cover_url: url })} aspect="aspect-[16/7]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={lbl}>ชื่อร้าน *</span>
              <input className={input} value={f.name} onChange={set("name")} maxLength={80} placeholder="ร้านข้าวมันไก่เจ๊ติ๋ม" />
            </label>
            <label>
              <span className={lbl}>ลิงก์ร้าน (ภาษาอังกฤษ) *</span>
              <input className={input} value={f.slug} onChange={set("slug")} maxLength={60} placeholder="khaomankai" />
              <span className="mt-1 block text-[11px] text-slate-400">แอปลูกค้า: /store/{f.slug || "..."}</span>
            </label>
            <label>
              <span className={lbl}>ทำจากครัว *</span>
              <select className={input} value={f.branch_id} onChange={set("branch_id")}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={lbl}>คำอธิบายสั้น</span>
              <textarea className={`${input} resize-none`} rows={2} value={f.description} onChange={set("description")} maxLength={200} />
            </label>
          </div>

          <fieldset className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <legend className="px-1 text-sm font-black text-slate-700">ค่าส่ง</legend>
            <p className="mb-3 text-xs text-slate-500">
              ค่าส่ง = {f.delivery_base_fee || 0}฿ + {f.delivery_per_km || 0}฿ × กม. ที่เกิน {f.delivery_free_km || 0} กม. (ระยะตรงจากครัว)
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label><span className={lbl}>ค่าส่งเริ่มต้น (฿)</span><input type="number" min={0} className={input} value={f.delivery_base_fee} onChange={set("delivery_base_fee")} /></label>
              <label><span className={lbl}>ต่อ กม. (฿)</span><input type="number" min={0} className={input} value={f.delivery_per_km} onChange={set("delivery_per_km")} /></label>
              <label><span className={lbl}>รวมในค่าเริ่มต้น (กม.)</span><input type="number" min={0} step="0.5" className={input} value={f.delivery_free_km} onChange={set("delivery_free_km")} /></label>
              <label><span className={lbl}>ส่งไกลสุด (กม.)</span><input type="number" min={0.5} step="0.5" className={input} value={f.max_delivery_km} onChange={set("max_delivery_km")} /></label>
              <label><span className={lbl}>ยอดขั้นต่ำ (฿)</span><input type="number" min={0} className={input} value={f.min_order_amount} onChange={set("min_order_amount")} /></label>
              <label><span className={lbl}>ลำดับการแสดง</span><input type="number" className={input} value={f.sort_index} onChange={set("sort_index")} /></label>
            </div>
          </fieldset>
          {!store && <p className="text-xs text-slate-500">ร้านใหม่จะเริ่มแบบ “ปิดอยู่” — เพิ่มเมนูให้เรียบร้อยแล้วค่อยเปิดร้าน</p>}
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
