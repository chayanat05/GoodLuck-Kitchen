"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/lib/supabase";
import {
  BROADCAST_HEARTBEAT_MS,
  BROADCAST_MIN_MOVE_M,
  BROADCAST_MIN_MS,
  DB_WRITE_MIN_MS,
  RIDER_LOC_EVENT,
  RIDER_LOC_TOPIC,
  RIDER_WATCH_EVENT,
  RIDER_WATCH_TOPIC,
  WATCH_PING_MS,
  WATCH_TTL_MS,
  distanceM,
  isRiderLocPayload,
  liveChannel,
  sendLive,
  type RiderLocPayload,
} from "@/lib/riderLive";

type LatLng = { lat: number; lng: number };

/**
 * ฝั่งไรเดอร์: เรียก report(lat, lng) ทุกครั้งที่ได้พิกัดใหม่
 * - ส่งพิกัดสด (ทุก ~3 วิ เมื่อขยับ) เฉพาะตอนมีคนเปิดแผนที่อยู่
 * - บันทึกลงฐานข้อมูลไม่เกิน 1 ครั้ง/นาที
 */
export function useRiderLiveSender(userId: string | undefined) {
  const watchedUntil = useRef(0);
  const lastPos = useRef<LatLng | null>(null);
  const lastSent = useRef<{ t: number; lat: number; lng: number } | null>(null);
  const lastDb = useRef(0);

  const sendNow = useCallback(
    (fromPing: boolean) => {
      const p = lastPos.current;
      if (!userId || !p) return;
      const now = Date.now();
      if (now > watchedUntil.current) return;
      const s = lastSent.current;
      if (s) {
        if (now - s.t < BROADCAST_MIN_MS) return;
        const stale = now - s.t >= BROADCAST_HEARTBEAT_MS;
        if (!fromPing && !stale && distanceM(s, p) < BROADCAST_MIN_MOVE_M) return;
      }
      lastSent.current = { t: now, ...p };
      void sendLive(RIDER_LOC_TOPIC, RIDER_LOC_EVENT, {
        id: userId,
        lat: p.lat,
        lng: p.lng,
        ts: new Date(now).toISOString(),
      });
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    const ch = liveChannel(RIDER_WATCH_TOPIC)
      .on("broadcast", { event: RIDER_WATCH_EVENT }, () => {
        watchedUntil.current = Date.now() + WATCH_TTL_MS;
        sendNow(true);
      })
      .subscribe();
    // GPS อาจไม่ส่งพิกัดใหม่ตอนอยู่กับที่ → ส่ง heartbeat เองให้ยังขึ้นออนไลน์
    const hb = setInterval(() => sendNow(false), 10000);
    return () => {
      clearInterval(hb);
      supabase.removeChannel(ch);
    };
  }, [userId, sendNow]);

  return useCallback(
    (lat: number, lng: number) => {
      if (!userId) return;
      lastPos.current = { lat, lng };
      const now = Date.now();
      if (now - lastDb.current >= DB_WRITE_MIN_MS) {
        lastDb.current = now;
        void supabase
          .from("profiles")
          .update({ last_lat: lat, last_lng: lng, last_seen: new Date(now).toISOString() })
          .eq("id", userId)
          .then(({ error }) => {
            if (error) {
              console.error("[GPS] save location failed:", error.message);
              lastDb.current = 0; // ลองใหม่รอบหน้า
            }
          });
      }
      sendNow(false);
    },
    [userId, sendNow],
  );
}

type RiderLocShape = {
  id: string;
  last_lat: number | null;
  last_lng: number | null;
  last_seen: string | null;
};

/**
 * ฝั่งคนดูแผนที่: ขณะ active ฟังพิกัดสด และ ping ให้ไรเดอร์เริ่มส่ง
 * refetch = ดึงพิกัดจากฐานข้อมูล (เรียกตอนเริ่ม/ต่อเน็ตใหม่/เจอไรเดอร์ที่ยังไม่มีในรายการ)
 */
export function useRiderLiveMap<T extends RiderLocShape>({
  active,
  riders,
  refetch,
  setRiders,
  setSelected,
}: {
  active: boolean;
  riders: T[];
  refetch: () => unknown;
  setRiders: Dispatch<SetStateAction<T[]>>;
  setSelected: Dispatch<SetStateAction<T | null>>;
}) {
  const knownIds = useRef<Set<string>>(new Set());
  const unknownTried = useRef<Map<string, number>>(new Map());
  const refetchRef = useRef(refetch);

  useEffect(() => {
    knownIds.current = new Set(riders.map((r) => r.id));
  }, [riders]);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    if (!active) return;

    const apply = (p: RiderLocPayload) => {
      if (!knownIds.current.has(p.id)) {
        // ไรเดอร์ใหม่ที่ยังไม่มีในรายการ (หรือถูกกรองออก) → ดึงใหม่ ไม่เกินนาทีละครั้งต่อคน
        const last = unknownTried.current.get(p.id) ?? 0;
        if (Date.now() - last > 60000) {
          unknownTried.current.set(p.id, Date.now());
          void refetchRef.current();
        }
        return;
      }
      const patch = { last_lat: p.lat, last_lng: p.lng, last_seen: p.ts };
      setRiders((prev) => prev.map((r) => (r.id === p.id ? { ...r, ...patch } : r)));
      setSelected((prev) => (prev && prev.id === p.id ? { ...prev, ...patch } : prev));
    };

    const ping = () => {
      if (document.visibilityState === "visible") {
        void sendLive(RIDER_WATCH_TOPIC, RIDER_WATCH_EVENT, {});
      }
    };

    const ch = liveChannel(RIDER_LOC_TOPIC)
      .on("broadcast", { event: RIDER_LOC_EVENT }, ({ payload }) => {
        if (isRiderLocPayload(payload)) apply(payload);
      })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          void refetchRef.current(); // เริ่มต้น/ต่อเน็ตใหม่ → ซิงก์จากฐานข้อมูลครั้งเดียว
          ping();
        } else if (status === "CHANNEL_ERROR") {
          console.error("[rider-live] subscribe failed:", err?.message);
        }
      });

    const timer = setInterval(ping, WATCH_PING_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refetchRef.current();
        ping();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
    };
  }, [active, setRiders, setSelected]);
}
