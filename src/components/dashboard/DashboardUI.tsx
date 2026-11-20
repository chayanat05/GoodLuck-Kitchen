"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bike,
  CalendarDays,
  Clock,
  CreditCard,
  Flame,
  Hourglass,
  LayoutDashboard,
  Loader2,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Star,
  Store,
  Timer,
  Truck,
  Wallet,
} from "lucide-react";
import type { DashboardStats, RangeKey, Summary, TimeStat } from "@/lib/dashboard/stats";
import type { useDashboard } from "@/hooks/useDashboard";
import { fetchAllTimeRiders } from "@/hooks/useDashboard";

type Dash = ReturnType<typeof useDashboard>;

// สีของข้อมูล (ชุดที่ตรวจแล้วว่าคนตาบอดสีแยกได้) — ใช้กับแท่ง/เส้น/ส่วนของกราฟ
const C = { blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a", violet: "#6250d6" };
const PAY = [
  { key: "transfer", label: "โอน", color: C.blue, icon: <CreditCard size={13} />, bg: "bg-blue-50", text: "text-blue-700" },
  { key: "copay", label: "คนละครึ่ง", color: C.orange, icon: <Smartphone size={13} />, bg: "bg-orange-50", text: "text-orange-700" },
  { key: "cash", label: "เงินสด", color: C.aqua, icon: <Wallet size={13} />, bg: "bg-emerald-50", text: "text-emerald-700" },
] as const;

const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const bahtShort = (n: number) =>
  n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `฿${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `฿${n}`;
const num = (n: number) => Math.round(n).toLocaleString("th-TH");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** พื้นหลังทั้งหน้า (ใช้ในหน้า page) */
export const DASH_BG = "min-h-screen pb-16 bg-linear-to-br from-indigo-50 via-slate-50 to-sky-50";

// ---------------------------------------------------------------------------
// Header + ตัวกรองช่วงเวลา
// ---------------------------------------------------------------------------
export function DashboardHeader({
  title,
  subtitle,
  onBack,
  dash,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  dash: Dash;
  children?: ReactNode;
}) {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-indigo-100 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="ย้อนกลับ"
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="hidden sm:flex w-10 h-10 shrink-0 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-500 text-white items-center justify-center shadow-lg shadow-indigo-500/30">
            <LayoutDashboard size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 truncate">{title}</h1>
            <p className="text-xs font-semibold text-indigo-500 truncate">{subtitle}</p>
          </div>
          {children}
          <button
            type="button"
            onClick={() => dash.refresh()}
            disabled={dash.refreshing}
            aria-label="รีเฟรช"
            className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:scale-95 transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={18} className={dash.refreshing ? "animate-spin" : ""} />
          </button>
        </div>
        <RangeBar dash={dash} />
      </div>
    </header>
  );
}

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "yesterday", label: "เมื่อวาน" },
  { key: "7days", label: "7 วัน" },
  { key: "month", label: "เดือนนี้" },
  { key: "singleDay", label: "เลือกวัน" },
  { key: "custom", label: "กำหนดเอง" },
  { key: "all", label: "ทั้งหมด" },
];

function rangeText(dash: Dash) {
  const { from, to } = dash.resolved;
  if (!from || !to) return "ข้อมูลทั้งหมดตั้งแต่เริ่มใช้งาน";
  const end = new Date(to.getTime() - 60000);
  const f = (d: Date) =>
    `${d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  return `${f(from)} – ${f(end)}`;
}

function RangeBar({ dash }: { dash: Dash }) {
  const input =
    "rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-xs font-bold text-indigo-700 outline-none focus:border-indigo-400";
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-2">
      <div className="flex gap-1 overflow-x-auto thin-scrollbar -mx-1 px-1 pb-0.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => dash.setRange(r.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              dash.range === r.key
                ? "bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/30"
                : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        {dash.range === "singleDay" && (
          <input type="date" className={input} value={dash.singleDate} onChange={(e) => e.target.value && dash.setSingleDate(e.target.value)} />
        )}
        {dash.range === "custom" && (
          <>
            <input type="date" className={input} value={dash.customStart} onChange={(e) => e.target.value && dash.setCustomStart(e.target.value)} />
            <span className="text-slate-400 text-xs font-bold">ถึง</span>
            <input type="date" className={input} value={dash.customEnd} onChange={(e) => e.target.value && dash.setCustomEnd(e.target.value)} />
          </>
        )}
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <CalendarDays size={13} className="text-indigo-400" /> {rangeText(dash)}
          <span className="text-slate-400">· ตัดรอบ {dash.bizStartText} น.</span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ชิ้นส่วนย่อย
// ---------------------------------------------------------------------------
function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`bg-white rounded-3xl border border-white shadow-[0_4px_24px_-8px_rgba(79,70,229,0.15)] ${className}`}>
      {children}
    </section>
  );
}

function CardTitle({ icon, title, hint, tint }: { icon: ReactNode; title: string; hint?: string; tint: string }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-4">
      <h2 className="flex items-center gap-2 text-sm font-black text-slate-800">
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${tint}`}>{icon}</span>
        {title}
      </h2>
      {hint && <span className="text-[11px] font-semibold text-slate-400 text-right">{hint}</span>}
    </div>
  );
}

/** ป้ายเปลี่ยนแปลง % — onDark ใช้บนการ์ดพื้นเข้ม */
function Delta({ cur, prev, label, onDark }: { cur: number; prev: number | undefined; label?: string; onDark?: boolean }) {
  if (prev === undefined) return null;
  if (prev === 0) {
    return cur > 0 ? (
      <span className={`text-[11px] font-semibold ${onDark ? "text-white/70" : "text-slate-400"}`}>ไม่มีข้อมูลช่วงก่อนให้เทียบ</span>
    ) : null;
  }
  const p = ((cur - prev) / prev) * 100;
  const up = p >= 0;
  const chip = onDark
    ? "bg-white/20 text-white"
    : up
      ? "bg-emerald-100 text-emerald-700"
      : "bg-rose-100 text-rose-700";
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 text-[11px] font-semibold ${onDark ? "text-white/80" : "text-slate-500"}`}>
      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-black ${chip}`}>
        {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {up ? "+" : ""}
        {p.toFixed(Math.abs(p) < 10 ? 1 : 0)}%
      </span>
      {label && <span>เทียบ{label}</span>}
    </span>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  perDay,
}: {
  active?: boolean;
  payload?: { value: number; payload: Record<string, number> }[];
  label?: string;
  unit: "baht" | "orders";
  perDay?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const value = payload.reduce((a, x) => a + (Number(x.value) || 0), 0);
  return (
    <div className="rounded-xl bg-slate-900 px-3 py-2 text-white shadow-xl">
      <div className="text-[11px] font-semibold text-slate-300">{label}</div>
      <div className="text-sm font-black tabular-nums">
        {unit === "baht" ? baht(value) : perDay ? `${value.toFixed(1)} ออเดอร์/วัน` : `${num(value)} ออเดอร์`}
      </div>
      {unit === "baht" && p.payload.bills !== undefined && (
        <div className="text-[11px] font-semibold text-slate-300">{num(p.payload.bills)} บิล</div>
      )}
    </div>
  );
}

const axisTick = { fill: "#64748b", fontSize: 11 };

function Empty({ text }: { text: string }) {
  return <div className="h-full flex items-center justify-center text-sm font-bold text-slate-400">{text}</div>;
}

// ---------------------------------------------------------------------------
// เนื้อหาแดชบอร์ด
// ---------------------------------------------------------------------------
export function DashboardBody({ dash, extra }: { dash: Dash; extra?: ReactNode }) {
  const s = dash.stats;
  const prev: Summary | undefined = dash.prev ?? undefined;
  const prevLabel = dash.resolved.prevLabel;

  if (dash.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 size={36} className="animate-spin text-indigo-600" />
        <p className="text-sm font-bold text-indigo-400">กำลังคำนวณสถิติ...</p>
      </div>
    );
  }

  return (
    <main
      className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 transition-opacity ${
        dash.refreshing ? "opacity-60" : ""
      }`}
    >
      {dash.error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{dash.error}</div>
      )}

      {/* ===== แถว 1: ยอดขาย + ออเดอร์ทั้งหมด ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <RevenueHero s={s} prev={prev} prevLabel={prevLabel} />
        <OrdersHero s={s} prev={prev} prevLabel={prevLabel} />
      </div>

      {/* ===== แถว 2: ช่องทางชำระเงิน ===== */}
      <PaymentCard s={s} />

      {/* ===== แถว 3: กราฟ ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-2">
          <CardTitle
            icon={<Flame size={16} />}
            tint="bg-blue-100 text-blue-600"
            title={s.trendByHour ? "ยอดขายรายชั่วโมง" : s.trendMonthly ? "ยอดขายรายเดือน" : "ยอดขายรายวัน"}
            hint="นับเฉพาะบิลที่ส่งสำเร็จ"
          />
          <div className="h-64">
            {s.trend.some((t) => t.revenue > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                {s.trendByHour || s.trend.length <= 14 ? (
                  <BarChart data={s.trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.violet} />
                        <stop offset="100%" stopColor={C.blue} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#eef2f6" />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} tickFormatter={bahtShort} />
                    <Tooltip cursor={{ fill: "#eef2ff" }} content={<ChartTooltip unit="baht" />} />
                    <Bar dataKey="revenue" fill="url(#revBar)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                ) : (
                  <AreaChart data={s.trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.violet} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={C.blue} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="revLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={C.blue} />
                        <stop offset="100%" stopColor={C.violet} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#eef2f6" />
                    <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} tickFormatter={bahtShort} />
                    <Tooltip cursor={{ stroke: "#a5b4fc", strokeDasharray: "3 3" }} content={<ChartTooltip unit="baht" />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="url(#revLine)"
                      strokeWidth={2.5}
                      fill="url(#revFill)"
                      activeDot={{ r: 5, fill: C.violet, stroke: "#fff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            ) : (
              <Empty text="ยังไม่มียอดขายในช่วงนี้" />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <CardTitle
            icon={<Clock size={16} />}
            tint="bg-orange-100 text-orange-600"
            title="ช่วงเวลาที่ออเดอร์เข้า"
            hint={s.days > 1 ? `เฉลี่ยต่อวัน (${num(s.days)} วัน)` : "ทุกประเภทงาน"}
          />
          {s.peakHour && (
            <p className="-mt-1 mb-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              <Flame size={13} /> พีค {s.peakHour.hour} · {s.peakHour.avg.toFixed(s.days > 1 ? 1 : 0)} ออเดอร์
              {s.days > 1 ? "/วัน" : ""}
            </p>
          )}
          <div className="h-52">
            {s.hourly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={s.hourly.map((h) => {
                    const peak = h.hour === s.peakHour?.hour;
                    return { hour: h.hour, normal: peak ? 0 : h.avg, peak: peak ? h.avg : 0 };
                  })}
                  margin={{ top: 4, right: 0, left: -18, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#eef2f6" />
                  <XAxis dataKey="hour" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(h: string) => h.slice(0, 2)} interval="preserveStartEnd" minTickGap={4} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                  <Tooltip cursor={{ fill: "#fff7ed" }} content={<ChartTooltip unit="orders" perDay={s.days > 1} />} />
                  <Bar dataKey="normal" stackId="h" fill="#fdba74" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="peak" stackId="h" fill={C.orange} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="ยังไม่มีออเดอร์" />
            )}
          </div>
        </Card>
      </div>

      {/* ===== แถว 4: เวลา ===== */}
      <div>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h2 className="text-sm font-black text-slate-800">⚡ ความเร็วในการส่ง</h2>
          <span className="text-[11px] font-semibold text-slate-400">งานร้านที่ส่งสำเร็จ · หน่วยเป็นนาที</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
          <TimeCard
            icon={<Timer size={16} />}
            title="รอไรเดอร์รับงาน"
            desc="ตั้งแต่ออเดอร์เข้า ถึงไรเดอร์กดรับ"
            t={s.wait}
            className="bg-linear-to-br from-amber-400 to-orange-500"
          />
          <TimeCard
            icon={<Truck size={16} />}
            title="รับงานจนส่งถึง"
            desc="ตั้งแต่ไรเดอร์กดรับ ถึงกดส่งสำเร็จ"
            t={s.ride}
            className="bg-linear-to-br from-sky-500 to-blue-600"
          />
          <TimeCard
            icon={<Clock size={16} />}
            title="รวมทั้งหมด"
            desc="ตั้งแต่ออเดอร์เข้า ถึงลูกค้าได้รับ"
            t={s.total}
            className="bg-linear-to-br from-violet-600 to-indigo-700"
          />
        </div>
      </div>

      {/* ===== แถว 5: ไรเดอร์ ===== */}
      {extra ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <RiderBoard s={s} className="lg:col-span-3" />
          <div className="lg:col-span-2">{extra}</div>
        </div>
      ) : (
        <RiderBoard s={s} />
      )}

      <p className="text-center text-[11px] font-semibold text-slate-400">
        อัปเดตล่าสุด{" "}
        {new Date(dash.loadedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false })} น. ·
        อัปเดตอัตโนมัติเมื่อมีออเดอร์เปลี่ยน
      </p>
    </main>
  );
}

/** ลายวงกลมตกแต่งบนการ์ดพื้นเข้ม */
function Blobs() {
  return (
    <>
      <span className="absolute -right-12 -top-16 w-48 h-48 rounded-full bg-white/10" aria-hidden />
      <span className="absolute right-16 -bottom-20 w-40 h-40 rounded-full bg-white/10" aria-hidden />
    </>
  );
}

function RevenueHero({ s, prev, prevLabel }: { s: DashboardStats; prev: Summary | undefined; prevLabel: string }) {
  return (
    <section className="relative overflow-hidden rounded-3xl p-5 sm:p-6 lg:col-span-2 text-white bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 shadow-xl shadow-indigo-500/30">
      <Blobs />
      <div className="relative">
        <p className="flex items-center gap-2 text-sm font-bold text-white/80">
          <Wallet size={16} /> ยอดขายสุทธิ (รวมค่าส่ง)
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="text-4xl sm:text-5xl font-black tracking-tight tabular-nums drop-shadow-sm">{baht(s.revenue)}</span>
          <span className="pb-1.5">
            <Delta cur={s.revenue} prev={prev?.revenue} label={prevLabel} onDark />
          </span>
        </div>
        {prev && prev.revenue > 0 && (
          <p className="mt-1 text-xs font-semibold text-white/60">
            {prevLabel}: {baht(prev.revenue)}
          </p>
        )}

        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          <HeroStat
            icon={<Receipt size={13} />}
            label="บิลที่ขายได้"
            value={num(s.paidBills)}
            delta={<Delta cur={s.paidBills} prev={prev?.paidBills} onDark />}
          />
          <HeroStat
            icon={<ShoppingBag size={13} />}
            label="เฉลี่ยต่อบิล"
            value={baht(s.aov)}
            delta={prev && prev.paidBills > 0 ? <Delta cur={s.aov} prev={prev.revenue / prev.paidBills} onDark /> : null}
          />
          <HeroStat icon={<Bike size={13} />} label="ไรเดอร์ที่วิ่ง" value={`${num(s.riders.length)} คน`} />
        </div>
      </div>
    </section>
  );
}

function HeroStat({ icon, label, value, delta }: { icon: ReactNode; label: string; value: string; delta?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/15 backdrop-blur-sm px-3 py-2.5 ring-1 ring-white/20 min-w-0">
      <p className="flex items-center gap-1 text-[11px] font-semibold text-white/75 truncate">
        {icon}
        {label}
      </p>
      <p className="text-base sm:text-xl font-black tabular-nums truncate">{value}</p>
      {delta && <div className="mt-0.5 hidden sm:block">{delta}</div>}
    </div>
  );
}

function OrdersHero({ s, prev, prevLabel }: { s: DashboardStats; prev: Summary | undefined; prevLabel: string }) {
  const done = s.orders - s.pending;
  return (
    <section className="relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white bg-linear-to-br from-orange-500 via-rose-500 to-pink-600 shadow-xl shadow-rose-500/30">
      <Blobs />
      <div className="relative">
        <p className="flex items-center gap-2 text-sm font-bold text-white/80">
          <Receipt size={16} /> ออเดอร์ทั้งหมด
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="text-4xl sm:text-5xl font-black tracking-tight tabular-nums drop-shadow-sm">{num(s.orders)}</span>
          <span className="pb-2 text-sm font-bold text-white/80">งาน</span>
        </div>
        <div className="mt-1">
          <Delta cur={s.orders} prev={prev?.orders} label={prevLabel} onDark />
        </div>

        {/* แถบสัดส่วน ร้าน / Shopee */}
        <div className="mt-5 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/20">
          {s.storeOrders > 0 && <div className="bg-white" style={{ width: `${pct(s.storeOrders, s.orders)}%` }} />}
          {s.shopeeOrders > 0 && <div className="bg-white/45" style={{ width: `${pct(s.shopeeOrders, s.orders)}%` }} />}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/75">
              <span className="w-2.5 h-2.5 rounded-sm bg-white" /> งานร้าน
            </p>
            <p className="text-lg font-black tabular-nums">
              {num(s.storeOrders)} <span className="text-xs font-bold text-white/70">({pct(s.storeOrders, s.orders)}%)</span>
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/75">
              <span className="w-2.5 h-2.5 rounded-sm bg-white/45" /> Shopee
            </p>
            <p className="text-lg font-black tabular-nums">
              {num(s.shopeeOrders)} <span className="text-xs font-bold text-white/70">({pct(s.shopeeOrders, s.orders)}%)</span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/20 text-xs font-bold">
          <span className="flex items-center gap-1.5">
            <Store size={14} /> เสร็จแล้ว {num(done)}
          </span>
          <span className="flex items-center gap-1.5">
            <Hourglass size={14} /> ยังไม่เสร็จ {num(s.pending)}
          </span>
        </div>
      </div>
    </section>
  );
}

function PaymentCard({ s }: { s: DashboardStats }) {
  const total = s.pay.transfer + s.pay.copay + s.pay.cash;
  return (
    <Card className="p-4 sm:p-5">
      <CardTitle icon={<CreditCard size={16} />} tint="bg-blue-100 text-blue-600" title="ช่องทางชำระเงิน" hint={`รวม ${baht(total)}`} />
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100">
        {total > 0 &&
          PAY.map((p) =>
            s.pay[p.key] > 0 ? (
              <div key={p.key} style={{ width: `${(s.pay[p.key] / total) * 100}%`, background: p.color }} title={`${p.label} ${baht(s.pay[p.key])}`} />
            ) : null,
          )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {PAY.map((p) => (
          <div key={p.key} className={`rounded-2xl px-3 py-2.5 ${p.bg}`}>
            <p className={`flex items-center gap-1.5 text-[11px] font-bold ${p.text}`}>
              <span className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-white" style={{ background: p.color }}>
                {p.icon}
              </span>
              {p.label}
            </p>
            <p className="mt-0.5 text-sm sm:text-lg font-black text-slate-900 tabular-nums truncate">{baht(s.pay[p.key])}</p>
            <p className="text-[11px] font-bold text-slate-500 tabular-nums">{pct(s.pay[p.key], total)}%</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TimeCard({
  icon,
  title,
  desc,
  t,
  className,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  t: TimeStat;
  className: string;
}) {
  return (
    <section className={`relative overflow-hidden rounded-3xl p-4 sm:p-5 text-white shadow-lg ${className}`}>
      <span className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-2 text-sm font-black">
          <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">{icon}</span>
          {title}
        </div>
        <p className="text-[11px] font-medium mt-1 text-white/75">{desc}</p>
        {t.n ? (
          <>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-black tabular-nums drop-shadow-sm">{Math.round(t.median)}</span>
              <span className="text-xs font-bold text-white/80">นาที (ปกติ)</span>
            </div>
            <div className="mt-3 flex gap-2 text-[11px] font-bold">
              <span className="rounded-full bg-white/20 px-2 py-0.5">
                เฉลี่ย <span className="tabular-nums">{Math.round(t.avg)}</span>
              </span>
              <span className="rounded-full bg-white/20 px-2 py-0.5">
                ช้าสุด 10% เกิน <span className="tabular-nums">{Math.round(t.p90)}</span>
              </span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm font-bold text-white/70">ยังไม่มีข้อมูล</p>
        )}
      </div>
    </section>
  );
}

const MEDALS = [
  "bg-linear-to-br from-amber-300 to-yellow-500 text-white shadow-amber-400/50",
  "bg-linear-to-br from-slate-300 to-slate-400 text-white shadow-slate-400/50",
  "bg-linear-to-br from-orange-300 to-amber-700 text-white shadow-orange-400/50",
];

function RiderBoard({ s, className = "" }: { s: DashboardStats; className?: string }) {
  const max = Math.max(1, ...s.riders.map((r) => r.trips));
  const totalTrips = s.riders.reduce((a, r) => a + r.trips, 0);
  const totalCash = s.riders.reduce((a, r) => a + r.cash, 0);
  return (
    <Card className={`p-5 flex flex-col ${className}`}>
      <CardTitle icon={<Bike size={16} />} tint="bg-emerald-100 text-emerald-600" title="ผลงานไรเดอร์" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-2xl bg-emerald-50 px-3 py-2">
          <p className="text-[11px] font-bold text-emerald-700">รวมทุกคน</p>
          <p className="text-lg font-black text-slate-900 tabular-nums">{num(totalTrips)} รอบ</p>
        </div>
        <div className="rounded-2xl bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-bold text-amber-700">เงินสดที่ต้องเก็บ</p>
          <p className="text-lg font-black text-slate-900 tabular-nums">{baht(totalCash)}</p>
        </div>
      </div>
      {s.riders.length === 0 ? (
        <p className="py-8 text-center text-sm font-bold text-slate-400">ยังไม่มีงานที่ส่งสำเร็จ</p>
      ) : (
        <div className="-mx-2 max-h-105 overflow-y-auto thin-scrollbar">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-[11px] font-bold text-slate-400">
              <tr>
                <th className="text-left font-bold px-2 pb-2">ไรเดอร์</th>
                <th className="text-right font-bold px-2 pb-2">รอบ</th>
                <th className="text-right font-bold px-2 pb-2 hidden sm:table-cell">ยอดรวม</th>
                <th className="text-right font-bold px-2 pb-2">เงินสด</th>
                <th className="text-right font-bold px-2 pb-2 hidden sm:table-cell">ส่งปกติ</th>
              </tr>
            </thead>
            <tbody>
              {s.riders.map((r, i) => (
                <tr key={r.key} className={`border-t border-slate-100 ${i === 0 ? "bg-amber-50/60" : ""}`}>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black shadow ${
                          MEDALS[i] ?? "bg-slate-100 text-slate-500 shadow-transparent"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 truncate">{r.name}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-500"
                            style={{ width: `${(r.trips / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right font-black text-slate-900 tabular-nums">{num(r.trips)}</td>
                  <td className="px-2 py-2.5 text-right font-semibold text-slate-600 tabular-nums hidden sm:table-cell">{baht(r.revenue)}</td>
                  <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${r.cash > 0 ? "text-amber-700" : "text-slate-300"}`}>
                    {baht(r.cash)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold text-slate-600 tabular-nums hidden sm:table-cell">
                    {r.rideMedian !== null ? `${Math.round(r.rideMedian)} น.` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** ไรเดอร์ตลอดกาล (แสดงเฉพาะแดชบอร์ดรวม) */
export function AllTimeRiders({ branchId }: { branchId: string | null }) {
  const [rows, setRows] = useState<{ name: string; trips: number }[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchAllTimeRiders(branchId)
      .then((r) => alive && (setRows(r), setFailed(false)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [branchId]);

  const max = Math.max(1, ...(rows ?? []).map((r) => r.trips));
  return (
    <Card className="p-5">
      <CardTitle icon={<Star size={16} />} tint="bg-indigo-100 text-indigo-600" title="ไรเดอร์ตลอดกาล" hint="งานที่ส่งสำเร็จทั้งหมด" />
      {failed ? (
        <p className="py-6 text-center text-sm font-bold text-rose-500">โหลดไม่สำเร็จ</p>
      ) : !rows ? (
        <div className="py-8 flex justify-center">
          <Loader2 size={22} className="animate-spin text-indigo-400" />
        </div>
      ) : (
        <ol className="space-y-2.5 max-h-72 overflow-y-auto thin-scrollbar pr-1">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black ${
                      MEDALS[i] ?? "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="font-bold text-slate-700 truncate">{r.name}</span>
                </span>
                <span className="text-xs font-black text-indigo-600 tabular-nums shrink-0">{num(r.trips)} รอบ</span>
              </div>
              <div className="ml-8 mt-1 h-1.5 rounded-full bg-indigo-50 overflow-hidden">
                <div className="h-full rounded-full bg-linear-to-r from-indigo-400 to-violet-500" style={{ width: `${(r.trips / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
