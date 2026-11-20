"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  ORDER_COLS,
  bizDateOf,
  computeStats,
  parseBizStart,
  resolveRange,
  summarize,
  toDateInput,
  type DashOrder,
  type DashboardStats,
  type RangeKey,
  type Summary,
} from "@/lib/dashboard/stats";

const PAGE = 1000; // Supabase คืนได้สูงสุด 1000 แถวต่อครั้ง ต้องดึงเป็นหน้า ๆ

/** ดึงออเดอร์เฉพาะช่วงเวลาที่ต้องการ (ทยอยดึงทีละ 1000 แถวจนครบ) */
async function fetchOrders(from: Date | null, to: Date | null, branchId: string | null, cols = ORDER_COLS) {
  const out: DashOrder[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase.from("orders").select(cols).not("is_deleted", "is", true);
    if (branchId) q = q.eq("branch_id", branchId);
    if (from) q = q.gte("created_at", from.toISOString());
    if (to) q = q.lt("created_at", to.toISOString());
    const { data, error } = await q
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as DashOrder[]));
    if (!data || data.length < PAGE) return out;
  }
}

export function useDashboard({ branchId, enabled }: { branchId: string | null; enabled: boolean }) {
  const [bizStartText, setBizStartText] = useState("06:00");
  const biz = useMemo(() => parseBizStart(bizStartText), [bizStartText]);

  const [range, setRange] = useState<RangeKey>("today");
  const [singleDate, setSingleDate] = useState(() => toDateInput(bizDateOf(new Date(), biz)));
  const [customStart, setCustomStart] = useState(singleDate);
  const [customEnd, setCustomEnd] = useState(singleDate);

  const [orders, setOrders] = useState<DashOrder[]>([]);
  const [prev, setPrev] = useState<Summary | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // โหลดเวลาตัดรอบวันทำการ
  useEffect(() => {
    if (!enabled) return;
    void supabase
      .from("store_settings")
      .select("business_day_start")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        const s = data?.business_day_start as string | undefined;
        if (!s) return;
        setBizStartText(s);
        const d = toDateInput(bizDateOf(new Date(), parseBizStart(s)));
        setSingleDate(d);
        setCustomStart(d);
        setCustomEnd(d);
      });
  }, [enabled]);

  const resolved = useMemo(
    () => resolveRange(range, biz, { singleDate, customStart, customEnd, now: new Date(loadedAt) }),
    [range, biz, singleDate, customStart, customEnd, loadedAt],
  );

  const reqId = useRef(0);
  const load = useCallback(
    async (mode: "initial" | "refresh" | "silent") => {
      const id = ++reqId.current;
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const now = new Date();
        const r = resolveRange(range, biz, { singleDate, customStart, customEnd, now });
        const [cur, before] = await Promise.all([
          fetchOrders(r.from, r.to, branchId),
          r.prev ? fetchOrders(r.prev.from, r.prev.to, branchId, "id,total_price,status") : Promise.resolve(null),
        ]);
        if (id !== reqId.current) return; // มีคำขอใหม่กว่าแล้ว ทิ้งผลเก่า
        setOrders(cur);
        setPrev(before ? summarize(before) : null);
        setLoadedAt(now.getTime());
        setError(null);
      } catch (e) {
        if (id !== reqId.current) return;
        console.error("[dashboard] load failed:", e);
        setError("โหลดข้อมูลไม่สำเร็จ ลองกดรีเฟรชอีกครั้ง");
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [range, biz, singleDate, customStart, customEnd, branchId],
  );

  // โหลดใหม่เมื่อเปลี่ยนช่วงเวลา/สาขา
  const firstLoad = useRef(true);
  useEffect(() => {
    if (!enabled) return;
    void load(firstLoad.current ? "initial" : "refresh");
    firstLoad.current = false;
  }, [enabled, load]);

  // ออเดอร์เปลี่ยน → รอให้นิ่ง 4 วิ แล้วค่อยดึงเฉพาะช่วงที่ดูอยู่ (ไม่ดึงทั้งฐานข้อมูล)
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase
      .channel(`dashboard-orders-${branchId ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", ...(branchId ? { filter: `branch_id=eq.${branchId}` } : {}) },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (document.visibilityState === "visible") void loadRef.current("silent");
          }, 4000);
        },
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [enabled, branchId]);

  const stats: DashboardStats = useMemo(
    () => computeStats(orders, biz, resolved, new Date(loadedAt)),
    [orders, biz, resolved, loadedAt],
  );

  return {
    bizStartText,
    range,
    setRange,
    singleDate,
    setSingleDate,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    resolved,
    stats,
    prev,
    loading,
    refreshing,
    error,
    loadedAt,
    refresh: () => load("refresh"),
  };
}

/** สถิติไรเดอร์ตลอดกาล (นับเฉพาะงานที่ส่งสำเร็จ) */
export async function fetchAllTimeRiders(branchId: string | null) {
  const counts = new Map<string, { name: string; trips: number }>();
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase
      .from("orders")
      .select("rider_id,rider_name")
      .eq("status", "ส่งแล้ว/เสร็จ")
      .not("is_deleted", "is", true)
      .not("rider_name", "is", null);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) {
      const key = r.rider_id || `name:${r.rider_name}`;
      const c = counts.get(key) ?? { name: r.rider_name as string, trips: 0 };
      c.name = r.rider_name as string;
      c.trips += 1;
      counts.set(key, c);
    }
    if (!data || data.length < PAGE) break;
  }
  return [...counts.values()].sort((a, b) => b.trips - a.trips);
}
