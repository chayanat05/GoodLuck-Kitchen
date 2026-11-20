// คำนวณสถิติแดชบอร์ด (ใช้ร่วมกันทั้งแดชบอร์ดรวมและแดชบอร์ดสาขา)
//
// ข้อเท็จจริงจากข้อมูลจริง:
// - งาน shopee มี total_price = 0 และไม่มีไรเดอร์ → ไม่นับในยอดขาย/ยอดเฉลี่ยต่อบิล/เวลาส่ง
// - start_time = เวลาที่ไรเดอร์ "รับงาน" (ไม่ใช่เวลาเริ่มทำอาหาร)
// - total_price รวมค่าส่งแล้ว
// - ไม่มีสถานะ "ยกเลิก" (ออเดอร์ที่ลบใช้ is_deleted)

export const DONE = "ส่งแล้ว/เสร็จ";
export const SHOPEE = "shopee";
const DAY_MS = 86400000;

export interface DashOrder {
  id: string;
  total_price: number | string | null;
  payment_method: string | null;
  status: string;
  job_type: string | null;
  branch_id: string | null;
  rider_id: string | null;
  rider_name: string | null;
  created_at: string;
  start_time: string | null;
  end_time: string | null;
}

export const ORDER_COLS =
  "id,total_price,payment_method,status,job_type,branch_id,rider_id,rider_name,created_at,start_time,end_time";

export type RangeKey = "today" | "yesterday" | "7days" | "month" | "all" | "singleDay" | "custom";

export type BizTime = { h: number; m: number };

export function parseBizStart(s: string | null | undefined): BizTime {
  const [h, m] = (s || "06:00").split(":").map(Number);
  return { h: Number.isFinite(h) ? h : 6, m: Number.isFinite(m) ? m : 0 };
}

/** วันทำการ (เที่ยงคืนของวันนั้น) ที่เวลา d อยู่ */
export function bizDateOf(d: Date, biz: BizTime) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (d.getHours() < biz.h || (d.getHours() === biz.h && d.getMinutes() < biz.m)) {
    x.setDate(x.getDate() - 1);
  }
  return x;
}

const bizStartOf = (day: Date, biz: BizTime) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), biz.h, biz.m, 0, 0);

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fromDateInput = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export interface ResolvedRange {
  from: Date | null; // รวม
  to: Date | null; // ไม่รวม
  /** ช่วงก่อนหน้าที่ยาวเท่ากัน (ตัดที่เวลาเดียวกันถ้าช่วงปัจจุบันยังไม่จบ) */
  prev: { from: Date; to: Date } | null;
  prevLabel: string;
}

export function resolveRange(
  key: RangeKey,
  biz: BizTime,
  opts: { singleDate: string; customStart: string; customEnd: string; now: Date },
): ResolvedRange {
  const { now } = opts;
  const todayBiz = bizDateOf(now, biz);
  let from: Date | null = null;
  let to: Date | null = null;
  let prevFrom: Date | null = null;
  let prevLabel = "";

  switch (key) {
    case "today":
      from = bizStartOf(todayBiz, biz);
      to = addDays(from, 1);
      prevLabel = "เมื่อวานช่วงเวลาเดียวกัน";
      break;
    case "yesterday":
      from = bizStartOf(addDays(todayBiz, -1), biz);
      to = addDays(from, 1);
      prevLabel = "วันก่อนหน้า";
      break;
    case "singleDay":
      from = bizStartOf(fromDateInput(opts.singleDate), biz);
      to = addDays(from, 1);
      prevLabel = "วันก่อนหน้า";
      break;
    case "7days":
      from = bizStartOf(addDays(todayBiz, -6), biz);
      to = bizStartOf(addDays(todayBiz, 1), biz);
      prevLabel = "7 วันก่อนหน้า";
      break;
    case "month": {
      from = new Date(todayBiz.getFullYear(), todayBiz.getMonth(), 1, biz.h, biz.m);
      to = new Date(todayBiz.getFullYear(), todayBiz.getMonth() + 1, 1, biz.h, biz.m);
      prevFrom = new Date(todayBiz.getFullYear(), todayBiz.getMonth() - 1, 1, biz.h, biz.m);
      prevLabel = "เดือนก่อนช่วงเดียวกัน";
      break;
    }
    case "custom": {
      let a = fromDateInput(opts.customStart);
      let b = fromDateInput(opts.customEnd);
      if (a > b) [a, b] = [b, a];
      from = bizStartOf(a, biz);
      to = bizStartOf(addDays(b, 1), biz);
      prevLabel = "ช่วงก่อนหน้าที่ยาวเท่ากัน";
      break;
    }
    case "all":
      return { from: null, to: null, prev: null, prevLabel: "" };
  }

  // ช่วงที่ยังไม่จบ → เทียบแค่ส่วนที่ผ่านไปแล้ว ให้ยุติธรรม
  const effEnd = to! > now ? now : to!;
  const elapsed = Math.max(0, effEnd.getTime() - from!.getTime());
  const pFrom = prevFrom ?? new Date(from!.getTime() - (to!.getTime() - from!.getTime()));
  const pTo = new Date(Math.min(pFrom.getTime() + elapsed, from!.getTime()));
  return { from, to, prev: elapsed > 0 ? { from: pFrom, to: pTo } : null, prevLabel };
}

export type PayKind = "transfer" | "copay" | "cash";
export function payKind(pm: string | null): PayKind {
  const p = (pm || "").trim();
  if (p.includes("โอน")) return "transfer";
  if (p.includes("ครึ่ง")) return "copay";
  return "cash";
}

const price = (o: DashOrder) => Number(o.total_price) || 0;
const mins = (a: string | null, b: string | null) =>
  a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 60000 : null;

export interface TimeStat {
  n: number;
  median: number;
  avg: number;
  p90: number;
}

/** เวลาที่ติดลบหรือเกิน 4 ชม. ถือว่าข้อมูลผิดปกติ (ลืมกดปิดงาน ฯลฯ) ไม่นำมาคิด */
const MAX_VALID_MIN = 240;

function timeStat(values: (number | null)[]): TimeStat {
  const v = values
    .filter((x): x is number => x !== null && x >= 0 && x <= MAX_VALID_MIN)
    .sort((a, b) => a - b);
  if (!v.length) return { n: 0, median: 0, avg: 0, p90: 0 };
  const q = (p: number) => {
    const i = (v.length - 1) * p;
    const lo = Math.floor(i);
    return v[lo] + (v[Math.ceil(i)] - v[lo]) * (i - lo);
  };
  return { n: v.length, median: q(0.5), avg: v.reduce((a, b) => a + b, 0) / v.length, p90: q(0.9) };
}

export interface Summary {
  revenue: number;
  paidBills: number;
  orders: number;
}

/** ตัวเลขหลักแบบย่อ (ใช้กับช่วงเปรียบเทียบ) */
export function summarize(orders: DashOrder[]): Summary {
  let revenue = 0;
  let paidBills = 0;
  for (const o of orders) {
    if (o.status !== DONE) continue;
    const p = price(o);
    revenue += p;
    if (p > 0) paidBills += 1;
  }
  return { revenue, paidBills, orders: orders.length };
}

export interface TrendPoint {
  label: string;
  revenue: number;
  bills: number;
}

export interface RiderStat {
  key: string;
  name: string;
  trips: number;
  revenue: number;
  cash: number;
  rideMedian: number | null;
}

export interface DashboardStats extends Summary {
  aov: number;
  pay: Record<PayKind, number>;
  storeOrders: number;
  shopeeOrders: number;
  pending: number;
  trend: TrendPoint[];
  trendByHour: boolean;
  trendMonthly: boolean;
  hourly: { hour: string; avg: number }[];
  peakHour: { hour: string; avg: number } | null;
  days: number;
  wait: TimeStat;
  ride: TimeStat;
  total: TimeStat;
  riders: RiderStat[];
}

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function computeStats(
  orders: DashOrder[],
  biz: BizTime,
  range: { from: Date | null; to: Date | null },
  now: Date,
): DashboardStats {
  const base = summarize(orders);
  const pay: Record<PayKind, number> = { transfer: 0, copay: 0, cash: 0 };
  let storeOrders = 0;
  let shopeeOrders = 0;
  let pending = 0;

  // ---- จำนวนวันในช่วง (ใช้หาค่าเฉลี่ยต่อวัน) ----
  const bizDays = new Set<string>();
  for (const o of orders) bizDays.add(toDateInput(bizDateOf(new Date(o.created_at), biz)));
  let days: number;
  if (range.from && range.to) {
    const end = range.to > now ? now : range.to;
    days = Math.max(1, Math.ceil((end.getTime() - range.from.getTime()) / DAY_MS));
  } else {
    days = Math.max(1, bizDays.size);
  }

  // ---- กราฟแนวโน้ม: ช่วง 1 วันแสดงรายชั่วโมง, หลายวันแสดงรายวัน ----
  const trendByHour = !!(range.from && range.to && range.to.getTime() - range.from.getTime() <= DAY_MS);
  // ช่วงยาวมาก (ทั้งหมด / > 120 วัน) รวมเป็นรายเดือน
  const trendMonthly = !trendByHour && (!range.from || days > 120);
  const trendMap = new Map<string, TrendPoint>();
  if (trendByHour) {
    for (let i = 0; i < 24; i++) {
      const h = (biz.h + i) % 24;
      trendMap.set(String(h), { label: hourLabel(h), revenue: 0, bills: 0 });
    }
  } else if (range.from && range.to && !trendMonthly) {
    const end = range.to > now ? now : range.to;
    for (let d = bizDateOf(range.from, biz); bizStartOf(d, biz) < end; d = addDays(d, 1)) {
      trendMap.set(toDateInput(d), {
        label: d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
        revenue: 0,
        bills: 0,
      });
    }
  }

  const hourCounts = new Array<number>(24).fill(0);
  const riders = new Map<string, RiderStat & { rides: (number | null)[] }>();
  const waits: (number | null)[] = [];
  const ridesAll: (number | null)[] = [];
  const totals: (number | null)[] = [];

  for (const o of orders) {
    const created = new Date(o.created_at);
    hourCounts[created.getHours()] += 1;
    const isShopee = o.job_type === SHOPEE;
    if (isShopee) shopeeOrders += 1;
    else storeOrders += 1;
    if (o.status !== DONE) {
      pending += 1;
      continue;
    }

    const p = price(o);
    pay[payKind(o.payment_method)] += p;

    if (p > 0) {
      const d = bizDateOf(created, biz);
      const key = trendByHour
        ? String(created.getHours())
        : trendMonthly
          ? toDateInput(d).slice(0, 7)
          : toDateInput(d);
      let pt = trendMap.get(key);
      if (!pt) {
        const label = trendMonthly
          ? d.toLocaleDateString("th-TH", { month: "short", year: "2-digit" })
          : d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
        pt = { label, revenue: 0, bills: 0 };
        trendMap.set(key, pt);
      }
      pt.revenue += p;
      pt.bills += 1;
    }

    if (!isShopee) {
      const ride = mins(o.start_time, o.end_time);
      waits.push(mins(o.created_at, o.start_time));
      ridesAll.push(ride);
      totals.push(mins(o.created_at, o.end_time));

      if (o.rider_name) {
        const key = o.rider_id || `name:${o.rider_name}`;
        let r = riders.get(key);
        if (!r) {
          r = { key, name: o.rider_name, trips: 0, revenue: 0, cash: 0, rideMedian: null, rides: [] };
          riders.set(key, r);
        }
        r.name = o.rider_name; // ใช้ชื่อล่าสุด (ข้อมูลเรียงจากเก่าไปใหม่)
        r.trips += 1;
        r.revenue += p;
        if (payKind(o.payment_method) === "cash") r.cash += p;
        r.rides.push(ride);
      }
    }
  }

  // เรียงกราฟรายวันตามวันที่ (กรณีไม่ได้เติมวันว่างไว้ล่วงหน้า)
  const trend = trendByHour
    ? [...trendMap.values()]
    : [...trendMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

  // ---- ออเดอร์เฉลี่ยต่อวันในแต่ละชั่วโมง (เริ่มนับจากเวลาตัดรอบ, ตัดชั่วโมงที่ว่างหัว/ท้ายออก) ----
  const hourlyFull = Array.from({ length: 24 }, (_, i) => {
    const h = (biz.h + i) % 24;
    return { hour: hourLabel(h), avg: hourCounts[h] / days };
  });
  let a = 0;
  let b = hourlyFull.length - 1;
  while (a <= b && hourlyFull[a].avg === 0) a++;
  while (b >= a && hourlyFull[b].avg === 0) b--;
  const hourly = a <= b ? hourlyFull.slice(a, b + 1) : [];
  const peakHour = hourly.length ? hourly.reduce((m, x) => (x.avg > m.avg ? x : m)) : null;

  return {
    ...base,
    aov: base.paidBills ? base.revenue / base.paidBills : 0,
    pay,
    storeOrders,
    shopeeOrders,
    pending,
    trend,
    trendByHour,
    trendMonthly,
    hourly,
    peakHour,
    days,
    wait: timeStat(waits),
    ride: timeStat(ridesAll),
    total: timeStat(totals),
    riders: [...riders.values()]
      .map(({ rides, ...r }) => {
        const t = timeStat(rides);
        return { ...r, rideMedian: t.n ? t.median : null };
      })
      .sort((x, y) => y.trips - x.trips || y.revenue - x.revenue),
  };
}
