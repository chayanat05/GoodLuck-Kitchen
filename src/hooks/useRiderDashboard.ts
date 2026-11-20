"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBusinessDayStart } from "@/hooks/useBusinessDayStart";
import { bizDateOf, parseBizStart, toDateInput, payKind, type BizTime } from "@/lib/dashboard/stats";
import {
  DONE,
  PAID,
  countDayOrders,
  findExtraShifts,
  nextGasTier,
  recordPay,
  type AttendanceRecord,
  type PayProfile,
  type RecordPay,
} from "@/lib/riderPay";

export type RiderRange = "today" | "yesterday" | "date" | "month" | "all";

export interface RiderOrderRow {
  id: string;
  order_number: string;
  job_type: string | null;
  total_price: number | null;
  payment_method: string | null;
  created_at: string;
  end_time: string | null;
  cash_received: number | null;
}

const ORDER_COLS = "id,order_number,job_type,total_price,payment_method,created_at,end_time,cash_received";
const PAGE = 1000;

const dayStart = (d: Date, biz: BizTime) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), biz.h, biz.m);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
/** ช่วงวันทำการ [start,end) ของกะที่เข้างานเวลา checkIn */
const recordDay = (checkIn: string, biz: BizTime) => {
  const s = dayStart(bizDateOf(new Date(checkIn), biz), biz);
  return { s, e: addDays(s, 1) };
};

/** ออเดอร์ที่ส่งสำเร็จของไรเดอร์ ช่วง created_at [from,to) — ทยอยดึงทีละ 1000 */
async function fetchDoneOrders(riderId: string, from: Date | null, to: Date | null) {
  const out: RiderOrderRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase.from("orders").select(ORDER_COLS).eq("rider_id", riderId).eq("status", DONE);
    if (from) q = q.gte("created_at", from.toISOString());
    if (to) q = q.lt("created_at", to.toISOString());
    const { data, error } = await q
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as RiderOrderRow[]));
    if (!data || data.length < PAGE) return out;
  }
}

const spanOf = (records: AttendanceRecord[], biz: BizTime) => {
  const days = records.map((r) => recordDay(r.check_in, biz));
  return {
    from: new Date(Math.min(...days.map((d) => d.s.getTime()))),
    to: new Date(Math.max(...days.map((d) => d.e.getTime()))),
  };
};

/**
 * ข้อมูลประกอบการคิดเงินของกะที่ส่งมา (ดึงครั้งเดียว):
 * ออเดอร์ของวันเหล่านั้น + กะควบ (ต้องดูกะทั้งหมดของวันนั้น ไม่ใช่แค่กะที่ส่งมา)
 */
async function fetchPayContext(
  riderId: string,
  records: AttendanceRecord[],
  biz: BizTime,
  ordersFor: AttendanceRecord[] = records, // กะที่ต้องนับออเดอร์ (กะที่จ่ายแล้วใช้ยอดที่บันทึก ไม่ต้องนับ)
) {
  if (!records.length) return { orders: [] as RiderOrderRow[], extra: new Set<string>() };
  const { from, to } = spanOf(records, biz);
  const oSpan = ordersFor.length ? spanOf(ordersFor, biz) : null;
  const [orders, dayRecs] = await Promise.all([
    oSpan ? fetchDoneOrders(riderId, oSpan.from, oSpan.to) : Promise.resolve([] as RiderOrderRow[]),
    supabase
      .from("rider_attendance")
      .select("id, rider_id, check_in")
      .eq("rider_id", riderId)
      .gte("check_in", from.toISOString())
      .lt("check_in", to.toISOString()),
  ]);
  if (dayRecs.error) throw dayRecs.error;
  return { orders, extra: findExtraShifts(dayRecs.data ?? [], biz) };
}

function payFor(
  records: AttendanceRecord[],
  orders: RiderOrderRow[],
  extra: Set<string>,
  profile: PayProfile,
  biz: BizTime,
  now: number,
) {
  return records.map((r) => {
    const { s, e } = recordDay(r.check_in, biz);
    return { record: r, pay: recordPay(r, profile, countDayOrders(orders, s, e), now, extra.has(r.id)) };
  });
}

/**
 * รอบบิลรายเดือน 26 → 26 เวลาตัดรอบ (ตรงกับหน้า /monthly-payroll)
 * offset 0 = รอบปัจจุบัน, -1 = รอบก่อนหน้า ...
 * monthKey = เดือนที่จ่าย (ตรงกับ monthly_payments.month_key เช่นรอบ 26 ต.ค.–25 พ.ย. = "2026-11")
 */
function cycleAt(now: Date, biz: BizTime, offset = 0) {
  let start = new Date(now.getFullYear(), now.getMonth(), 26, biz.h, biz.m);
  if (now < start) start = new Date(now.getFullYear(), now.getMonth() - 1, 26, biz.h, biz.m);
  start = new Date(start.getFullYear(), start.getMonth() + offset, 26, biz.h, biz.m);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 26, biz.h, biz.m);
  const monthKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`;
  return { start, end, monthKey };
}

export function useRiderDashboard({ businessDayStart, refreshKey }: { businessDayStart: string; refreshKey: number }) {
  // เวลาตัดรอบจากหน้าตั้งค่าแอดมิน (ค่าเดียวกับ /payroll) อัปเดตเองเมื่อแอดมินเปลี่ยน
  const bizText = useBusinessDayStart(businessDayStart);
  const biz = useMemo(() => parseBizStart(bizText), [bizText]);

  const [range, setRange] = useState<RiderRange>("today");
  const [date, setDate] = useState(() => toDateInput(bizDateOf(new Date(), biz)));
  const [month, setMonth] = useState(() => toDateInput(bizDateOf(new Date(), biz)).slice(0, 7));

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const [riderId, setRiderId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PayProfile | null>(null);
  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("hourly_rate, default_savings, role")
        .eq("id", session.user.id)
        .maybeSingle();
      setProfile({
        hourly_rate: data?.hourly_rate ?? null,
        default_savings: data?.default_savings ?? null,
        role: data?.role ?? null,
      });
      setRiderId(session.user.id);
    })();
  }, []);

  // วันทำการปัจจุบัน (เปลี่ยนเองเมื่อข้ามเวลาตัดรอบ เพราะ now อัปเดตทุก 30 วิ)
  const todayKey = toDateInput(bizDateOf(new Date(now), biz));

  // ขอบเขตช่วงที่เลือก [from,to)
  const bounds = useMemo(() => {
    const [ty, tm, td] = todayKey.split("-").map(Number);
    const todayBiz = new Date(ty, tm - 1, td);
    switch (range) {
      case "today": {
        const s = dayStart(todayBiz, biz);
        return { from: s, to: addDays(s, 1) };
      }
      case "yesterday": {
        const s = dayStart(addDays(todayBiz, -1), biz);
        return { from: s, to: addDays(s, 1) };
      }
      case "date": {
        const [y, m, d] = date.split("-").map(Number);
        const s = new Date(y, m - 1, d, biz.h, biz.m);
        return { from: s, to: addDays(s, 1) };
      }
      case "month": {
        const [y, m] = month.split("-").map(Number);
        return { from: new Date(y, m - 1, 1, biz.h, biz.m), to: new Date(y, m, 1, biz.h, biz.m) };
      }
      case "all":
        return { from: null, to: null };
    }
  }, [range, date, month, biz, todayKey]);

  const [raw, setRaw] = useState<{
    records: AttendanceRecord[];
    orders: RiderOrderRow[];
    unpaid: AttendanceRecord[];
    unpaidOrders: RiderOrderRow[];
    extra: Set<string>;
    unpaidExtra: Set<string>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reqId = useRef(0);
  const load = useCallback(async () => {
    if (!riderId) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      let recQ = supabase.from("rider_attendance").select("*").eq("rider_id", riderId);
      if (bounds.from) recQ = recQ.gte("check_in", bounds.from.toISOString());
      if (bounds.to) recQ = recQ.lt("check_in", bounds.to.toISOString());

      const [recRes, orders, unpaidRes] = await Promise.all([
        recQ.order("check_in", { ascending: false }),
        fetchDoneOrders(riderId, bounds.from, bounds.to),
        supabase
          .from("rider_attendance")
          .select("*")
          .eq("rider_id", riderId)
          .or(`payment_status.is.null,payment_status.neq.${PAID}`)
          .order("check_in", { ascending: false }),
      ]);
      if (recRes.error) throw recRes.error;
      if (unpaidRes.error) throw unpaidRes.error;
      const unpaid = (unpaidRes.data ?? []) as AttendanceRecord[];
      const records = (recRes.data ?? []) as AttendanceRecord[];
      const unpaidCtx = await fetchPayContext(riderId, unpaid, biz);
      if (id !== reqId.current) return;
      setRaw({
        records,
        orders,
        // ช่วงที่เลือก/รอบบิลตัดตรงเวลาตัดรอบพอดี จึงมีกะครบทุกวัน หากะควบได้เลย
        extra: findExtraShifts(records, biz),
        unpaid,
        unpaidOrders: unpaidCtx.orders,
        unpaidExtra: unpaidCtx.extra,
      });
      setError(null);
    } catch (e) {
      if (id !== reqId.current) return;
      console.error("[rider-dashboard] load failed:", e);
      setError("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [riderId, bounds, biz]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // ---------------- รอบบิลรายเดือน (เลื่อนดูรอบก่อนหน้าได้) ----------------
  const [cycleOffset, setCycleOffset] = useState(0);
  const cycleBounds = useMemo(() => {
    const [ty, tm, td] = todayKey.split("-").map(Number);
    // ใช้เวลาหลังตัดรอบของวันทำการปัจจุบัน เพื่อให้รอบเปลี่ยนตรงเวลาตัดรอบ
    return cycleAt(new Date(ty, tm - 1, td, biz.h, biz.m), biz, cycleOffset);
  }, [todayKey, biz, cycleOffset]);

  const [cycleRaw, setCycleRaw] = useState<{
    key: string;
    records: AttendanceRecord[];
    orders: RiderOrderRow[];
    extra: Set<string>;
    monthly: MonthlyPaymentRecord | null;
  } | null>(null);
  const cycleReq = useRef(0);
  const loadCycle = useCallback(async () => {
    if (!riderId) return;
    const id = ++cycleReq.current;
    try {
      const [{ data, error: e1 }, { data: mp }] = await Promise.all([
        supabase
          .from("rider_attendance")
          .select("*")
          .eq("rider_id", riderId)
          .gte("check_in", cycleBounds.start.toISOString())
          .lt("check_in", cycleBounds.end.toISOString())
          .order("check_in", { ascending: true }),
        supabase
          .from("monthly_payments")
          .select("*")
          .eq("rider_id", riderId)
          .eq("month_key", cycleBounds.monthKey)
          .maybeSingle(),
      ]);
      if (e1) throw e1;
      const records = (data ?? []) as AttendanceRecord[];
      // นับออเดอร์เฉพาะวันที่ยังไม่จ่าย (วันที่จ่ายแล้วใช้ยอดที่ร้านบันทึก)
      const ctx = await fetchPayContext(riderId, records, biz, records.filter((r) => r.payment_status !== PAID));
      if (id !== cycleReq.current) return;
      setCycleRaw({
        key: cycleBounds.monthKey,
        records,
        orders: ctx.orders,
        extra: ctx.extra,
        monthly: (mp as MonthlyPaymentRecord | null) ?? null,
      });
    } catch (e) {
      console.error("[rider-dashboard] cycle load failed:", e);
    }
  }, [riderId, cycleBounds, biz]);

  useEffect(() => {
    void loadCycle();
  }, [loadCycle, refreshKey]);

  const cycle = useMemo(() => {
    if (!cycleRaw || !profile) return null;
    const days = payFor(cycleRaw.records, cycleRaw.orders, cycleRaw.extra, profile, biz, now);
    const workDays = new Set(cycleRaw.records.map((r) => toDateInput(bizDateOf(new Date(r.check_in), biz)))).size;
    return {
      ...cycleBounds,
      loading: cycleRaw.key !== cycleBounds.monthKey,
      isCurrent: cycleOffset === 0,
      days,
      workDays,
      shifts: days.length,
      bonus: days.reduce((a, x) => a + x.pay.bonus, 0),
      savings: days.reduce((a, x) => a + x.pay.savings, 0),
      total: days.reduce((a, x) => a + x.pay.total, 0),
      minutes: days.reduce((a, x) => a + x.pay.minutes, 0),
      monthly: cycleRaw.monthly,
      defaultSavings: profile.default_savings ?? 50,
    };
  }, [cycleRaw, profile, biz, now, cycleBounds, cycleOffset]);

  const summary = useMemo(() => {
    if (!raw || !profile) return null;
    // ออเดอร์ในช่วง = ออเดอร์ที่ "เข้า" ในช่วงนี้ (กติกาเดียวกับ /payroll)
    const orders = raw.orders;

    const shifts = payFor(raw.records, raw.orders, raw.extra, profile, biz, now);
    const sum = (k: keyof RecordPay) => shifts.reduce((a, x) => a + (x.pay[k] as number), 0);
    const working = shifts.find((x) => x.pay.isWorking) ?? null;

    let cashTotal = 0;
    let cashPending = 0;
    for (const o of orders) {
      if (payKind(o.payment_method) !== "cash") continue;
      const p = Number(o.total_price) || 0;
      cashTotal += p;
      cashPending += Math.max(0, p - (o.cash_received || 0));
    }

    const unpaid = payFor(raw.unpaid, raw.unpaidOrders, raw.unpaidExtra, profile, biz, now);

    const todayCount = range === "today" ? orders.length : null;

    return {
      orders,
      shifts,
      pay: {
        total: sum("total"),
        basePay: sum("basePay"),
        gas: sum("gas"),
        bonus: sum("bonus"),
        savings: sum("savings"),
        minutes: sum("minutes"),
        rate: profile.hourly_rate || 40,
        allPaid: shifts.length > 0 && shifts.every((x) => x.pay.isPaid),
        anyPaid: shifts.some((x) => x.pay.isPaid),
      },
      working: working ? { checkIn: working.record.check_in } : null,
      cash: { total: cashTotal, pending: cashPending, handed: cashTotal - cashPending },
      gasNext: todayCount !== null ? nextGasTier(todayCount) : null,
      unpaid: { total: unpaid.reduce((a, x) => a + x.pay.total, 0), count: unpaid.length },
    };
  }, [raw, profile, biz, now, range]);

  return {
    biz,
    range,
    setRange,
    date,
    setDate,
    month,
    setMonth,
    bounds,
    summary,
    loading: loading && !raw,
    refreshing: loading && !!raw,
    error,
    riderId,
    profile,
    now,
    cycle,
    cycleOffset,
    setCycleOffset,
    reload: () => {
      void load();
      void loadCycle();
    },
  };
}

/** ประวัติสลิป: 60 กะล่าสุด + สลิปรายเดือน */
export async function fetchPayHistory(riderId: string, profile: PayProfile, biz: BizTime) {
  const [{ data: daily }, { data: monthly }] = await Promise.all([
    supabase.from("rider_attendance").select("*").eq("rider_id", riderId).order("check_in", { ascending: false }).limit(60),
    supabase.from("monthly_payments").select("*").eq("rider_id", riderId).order("month_key", { ascending: false }),
  ]);
  const records = (daily ?? []) as AttendanceRecord[];
  // นับออเดอร์เฉพาะกะที่ยังไม่จ่าย (กะที่จ่ายแล้วใช้ยอดที่แอดมินบันทึก)
  const unpaid = records.filter((r) => r.payment_status !== PAID);
  const ctx = await fetchPayContext(riderId, records, biz, unpaid);
  return {
    daily: payFor(records, ctx.orders, ctx.extra, profile, biz, Date.now()),
    monthly: (monthly ?? []) as MonthlyPaymentRecord[],
  };
}

export interface MonthlyPaymentRecord {
  id: string;
  month_key: string;
  total_amount: number;
  total_bonus: number;
  total_savings: number;
  status: string;
  slip_url: string | null;
  paid_at: string | null;
}
