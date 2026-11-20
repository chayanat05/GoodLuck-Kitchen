"use client";

// เวลาตัดรอบวันทำการ (store_settings.business_day_start) — แหล่งเดียวของทั้งแอป
// - ทุกหน้าใช้ค่านี้ค่าเดียว (รวมนาที เช่น "06:30")
// - แอดมินเปลี่ยนในหน้าตั้งค่า → ทุกหน้าที่เปิดอยู่อัปเดตเอง (Realtime) และเช็คซ้ำเมื่อกลับมาที่แอป
import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

let current: string | null = null;
const listeners = new Set<() => void>();
let started = false;

function set(v: unknown) {
  if (typeof v !== "string" || !/^\d{1,2}:\d{2}/.test(v) || v === current) return;
  current = v;
  listeners.forEach((l) => l());
}

function load() {
  void supabase
    .from("store_settings")
    .select("business_day_start")
    .eq("id", 1)
    .single()
    .then(({ data }) => set(data?.business_day_start));
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  load();
  supabase
    .channel("store-settings-business-day")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "store_settings", filter: "id=eq.1" },
      (p) => set((p.new as { business_day_start?: string }).business_day_start),
    )
    .subscribe();
  // สำรองกรณี Realtime หลุด: กลับมาที่แอปเมื่อไหร่ เช็คค่าใหม่
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  start();
  return () => listeners.delete(cb);
}

/** เวลาตัดรอบแบบ "HH:MM" — ระหว่างโหลดครั้งแรกคืน fallback */
export function useBusinessDayStart(fallback = "06:00") {
  return useSyncExternalStore(
    subscribe,
    () => current ?? fallback,
    () => fallback,
  );
}

/** แยก "HH:MM" เป็นชั่วโมง/นาที */
export function splitBizTime(s: string) {
  const [h, m] = s.split(":").map(Number);
  return { h: Number.isFinite(h) ? h : 6, m: Number.isFinite(m) ? m : 0 };
}
