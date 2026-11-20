// พิกัดไรเดอร์แบบเรียลไทม์ผ่าน Supabase Realtime Broadcast (ไม่ผ่านฐานข้อมูล)
//
// มี 2 ห้อง (private channel, สิทธิ์อยู่ใน migration 20261121c_rider_live_location.sql)
//   rider-watch     : คนที่เปิดแผนที่อยู่ ส่ง "ping" ทุก ~25 วิ → ไรเดอร์รู้ว่ามีคนดูอยู่
//   rider-locations : ไรเดอร์ส่งพิกัด (เฉพาะตอนมีคนดู) → คนเปิดแผนที่รับ
// ไม่มีใครเปิดแผนที่ = ไม่มีข้อความพิกัดวิ่งเลย (ประหยัดโควตา Realtime)
// ฐานข้อมูล: บันทึก profiles.last_lat/last_lng แค่ทุก 60 วิ ไว้ใช้ตอนเปิดแผนที่ครั้งแรก
import { supabase } from "./supabase";

export const RIDER_LOC_TOPIC = "rider-locations";
export const RIDER_WATCH_TOPIC = "rider-watch";
export const RIDER_LOC_EVENT = "loc";
export const RIDER_WATCH_EVENT = "ping";

/** ส่งพิกัดไม่ถี่กว่านี้ */
export const BROADCAST_MIN_MS = 3000;
/** ขยับไม่ถึงนี้ (เมตร) ถือว่าอยู่กับที่ */
export const BROADCAST_MIN_MOVE_M = 10;
/** อยู่กับที่ก็ยังส่งทุก ๆ เท่านี้ ให้สถานะออนไลน์ไม่หลุด */
export const BROADCAST_HEARTBEAT_MS = 30000;
/** คนเปิดแผนที่ ping ทุก ๆ เท่านี้ */
export const WATCH_PING_MS = 25000;
/** ไม่ได้ยิน ping นานเท่านี้ = ไม่มีคนดูแล้ว หยุดส่ง */
export const WATCH_TTL_MS = 70000;
/** บันทึกลงฐานข้อมูลไม่ถี่กว่านี้ */
export const DB_WRITE_MIN_MS = 60000;

export type RiderLocPayload = { id: string; lat: number; lng: number; ts: string };

export function isRiderLocPayload(p: unknown): p is RiderLocPayload {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.lat === "number" && Number.isFinite(o.lat) &&
    typeof o.lng === "number" && Number.isFinite(o.lng) &&
    typeof o.ts === "string"
  );
}

/** ระยะทางระหว่าง 2 พิกัด (เมตร) */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** private channel สำหรับ "รับ" ข้อความ */
export function liveChannel(topic: string) {
  return supabase.channel(topic, { config: { private: true, broadcast: { self: false } } });
}

/**
 * ส่ง broadcast ผ่าน REST โดยไม่ต้อง join ห้อง
 * (ผู้ส่งจะได้ไม่ต้องรับข้อความของคนอื่นที่ไม่ได้ใช้ → ประหยัดโควตา)
 */
export async function sendLive(topic: string, event: string, payload: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: true }] }),
      keepalive: true,
    });
  } catch {
    // เน็ตหลุดชั่วคราว รอบถัดไปค่อยส่งใหม่
  }
}
