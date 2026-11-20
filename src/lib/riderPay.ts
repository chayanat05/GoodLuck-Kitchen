// สูตรค่าแรงพนักงาน — ใช้ร่วมกันระหว่างหน้า /payroll (แอดมินจ่ายเงินจริง) และแดชบอร์ดไรเดอร์
import { bizDateOf, toDateInput, type BizTime } from "@/lib/dashboard/stats";

export const PAID = "จ่ายแล้ว";
export const DONE = "ส่งแล้ว/เสร็จ";

/** ขั้นค่าน้ำมันตามจำนวนออเดอร์ต่อวัน (เรียงจากมากไปน้อย) */
export const GAS_TIERS = [
  { min: 71, amount: 350 },
  { min: 65, amount: 300 },
  { min: 55, amount: 250 },
  { min: 41, amount: 200 },
  { min: 31, amount: 150 },
  { min: 21, amount: 100 },
  { min: 0, amount: 50 },
] as const;

export function getAutoGasAllowance(orders: number): number {
  return GAS_TIERS.find((t) => orders >= t.min)!.amount;
}

/** ขั้นถัดไป: ต้องส่งอีกกี่ออเดอร์ ถึงได้ค่าน้ำมันเท่าไร (null = ขั้นสูงสุดแล้ว) */
export function nextGasTier(orders: number): { need: number; amount: number; atMin: number } | null {
  const higher = [...GAS_TIERS].reverse().find((t) => t.min > orders);
  return higher ? { need: higher.min - orders, amount: higher.amount, atMin: higher.min } : null;
}

export interface AttendanceRecord {
  id: string;
  rider_id: string;
  check_in: string;
  check_out: string | null;
  payment_status?: string | null;
  total_pay?: number | null;
  payment_slip_url?: string | null;
  diligence_bonus?: number | null;
  accumulated_savings?: number | null;
  gas_allowance?: number | null;
  total_minutes?: number | null;
  order_count?: number | null;
  base_pay?: number | null;
}

export interface PayProfile {
  hourly_rate: number | null;
  default_savings: number | null;
  role: string | null;
}

export interface RecordPay {
  isWorking: boolean;
  isPaid: boolean;
  minutes: number;
  rate: number;
  orders: number;
  basePay: number;
  gas: number;
  bonus: number;
  savings: number;
  total: number;
  /** กะควบ (ไม่ใช่กะแรกของวัน) */
  extraShift: boolean;
}

// ---------------------------------------------------------------------------
// ควบกะ: วันทำการเดียวกันมีหลายกะ → นับเป็นกะเดียว
// กะแรกของวัน (เข้างานเร็วสุด) ได้ค่าน้ำมันและหักเงินเก็บตามปกติ
// กะที่เหลือ ("กะควบ") ได้แค่ค่าแรงตามเวลา + โบนัสที่ร้านใส่ให้ ค่าน้ำมัน 0 / ไม่หักเงินเก็บซ้ำ
// ---------------------------------------------------------------------------

/** id ของกะควบ — ต้องส่งกะ "ทั้งหมด" ของวันนั้นมา (ของพนักงานคนเดียวกัน) ถึงจะรู้ว่ากะไหนมาก่อน */
export function findExtraShifts(
  records: { id: string; rider_id: string; check_in: string }[],
  biz: BizTime,
): Set<string> {
  const first = new Map<string, { id: string; t: number }>();
  for (const r of records) {
    const key = `${r.rider_id}|${toDateInput(bizDateOf(new Date(r.check_in), biz))}`;
    const t = new Date(r.check_in).getTime();
    const cur = first.get(key);
    if (!cur || t < cur.t || (t === cur.t && r.id < cur.id)) first.set(key, { id: r.id, t });
  }
  const primary = new Set([...first.values()].map((x) => x.id));
  return new Set(records.filter((r) => !primary.has(r.id)).map((r) => r.id));
}

/** ค่าน้ำมันอัตโนมัติของกะ (กะควบ = 0) */
export const autoGasFor = (orders: number, extraShift: boolean) => (extraShift ? 0 : getAutoGasAllowance(orders));

/** เงินเก็บที่หักอัตโนมัติของกะ (กะควบ = 0) — ใช้เมื่อยังไม่ได้กำหนดเอง (0 หรือว่าง) */
export const defaultSavingsFor = (profileDefault: number | null | undefined, extraShift: boolean) =>
  extraShift ? 0 : (profileDefault ?? 50);

/**
 * ยอดเงินของกะหนึ่ง (ตรงกับ totalPayroll / การ์ดในหน้า /payroll)
 * dayOrders = ออเดอร์ที่ส่งสำเร็จของไรเดอร์ในวันทำการของกะนั้น
 */
export function recordPay(
  r: AttendanceRecord,
  profile: PayProfile,
  dayOrders: number,
  now: number,
  extraShift = false,
): RecordPay {
  const isWorking = !r.check_out;
  const isPaid = r.payment_status === PAID;
  const settled = isPaid || (r.total_pay ?? 0) > 0; // แอดมินบันทึกยอดแล้ว → ใช้ค่าที่บันทึก

  const minutes = isWorking
    ? Math.max(0, Math.floor((now - new Date(r.check_in).getTime()) / 60000))
    : r.total_minutes || 0;
  const rate = profile.hourly_rate || 40;
  const computedBase = (minutes / 60) * rate;

  const orders = isPaid && (r.order_count || 0) > 0 ? r.order_count! : dayOrders;
  const showGas = profile.role !== "kitchen";
  const gas = showGas ? (settled ? r.gas_allowance || 0 : autoGasFor(orders, extraShift)) : 0;

  const savings = settled
    ? r.accumulated_savings || 0
    : r.accumulated_savings === 0 || r.accumulated_savings == null
      ? defaultSavingsFor(profile.default_savings, extraShift)
      : r.accumulated_savings;
  const bonus = r.diligence_bonus || 0;

  const calc = Math.max(0, computedBase + gas + bonus - savings);
  const total = isWorking ? calc : (r.total_pay ?? 0) > 0 ? r.total_pay! : calc;

  // ค่าแรงที่โชว์ในรายละเอียด: ถ้าแอดมินบันทึกไว้แล้วใช้ค่าที่บันทึก
  const basePay = !isWorking && settled && (r.base_pay ?? 0) > 0 ? r.base_pay! : computedBase;

  return { isWorking, isPaid, minutes, rate, orders, basePay, gas, bonus, savings, total, extraShift };
}

/**
 * นับออเดอร์ของวันทำการ [start,end) ตาม "เวลาที่ออเดอร์เข้า" (created_at)
 * ออเดอร์ที่เข้าก่อนเวลาตัดรอบแต่ส่งเสร็จหลังตัดรอบ นับเป็นของวันที่ออเดอร์เข้า
 */
export function countDayOrders(orders: { created_at: string }[], start: Date, end: Date) {
  const s = start.getTime();
  const e = end.getTime();
  let n = 0;
  for (const o of orders) {
    const c = new Date(o.created_at).getTime();
    if (c >= s && c < e) n++;
  }
  return n;
}

export const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที`);
