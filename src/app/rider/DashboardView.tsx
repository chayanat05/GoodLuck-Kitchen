'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle, ArrowLeft, Banknote, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList,
  Clock, Coins, CreditCard, Fuel, ImageIcon, Landmark, Loader2, MapPinned, Package, PiggyBank, RefreshCw,
  Smartphone, Trophy, Wallet, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import Image from 'next/image';
import { Order } from '../../components/OrderCard';
import { mediaUrl } from '@/lib/media';
import { supabase } from '../../lib/supabase';
import { payKind } from '@/lib/dashboard/stats';
import { fmtMinutes, getAutoGasAllowance, GAS_TIERS, type AttendanceRecord, type RecordPay } from '@/lib/riderPay';
import {
  fetchPayHistory,
  useRiderDashboard,
  type MonthlyPaymentRecord,
  type RiderRange,
} from '@/hooks/useRiderDashboard';

// ยังมีที่อื่น import จากไฟล์นี้ได้
export { getAutoGasAllowance };

interface DashboardViewProps {
  riderName: string;
  onBack: () => void;
  activeOrdersCount: number;
  allCompletedOrders: Order[];
  businessDayStart: string;
}

const baht = (n: number) => `฿${Math.round(n).toLocaleString('th-TH')}`;
const timeOf = (s: string) => new Date(s).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
const shortDate = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

const RANGES: { id: RiderRange; label: string }[] = [
  { id: 'today', label: 'วันนี้' },
  { id: 'yesterday', label: 'เมื่อวาน' },
  { id: 'date', label: 'เลือกวัน' },
  { id: 'month', label: 'รายเดือน' },
  { id: 'all', label: 'ทั้งหมด' },
];

const PAY_CHIP: Record<string, { label: string; cls: string; icon: ReactNode }> = {
  transfer: { label: 'โอน', cls: 'bg-blue-50 text-blue-700', icon: <CreditCard size={11} /> },
  copay: { label: 'คนละครึ่ง', cls: 'bg-orange-50 text-orange-700', icon: <Smartphone size={11} /> },
  cash: { label: 'เงินสด', cls: 'bg-emerald-50 text-emerald-700', icon: <Wallet size={11} /> },
};

export default function DashboardView({ riderName, onBack, activeOrdersCount, allCompletedOrders, businessDayStart }: DashboardViewProps) {
  // ส่งงานสำเร็จเพิ่ม → โหลดใหม่
  const dash = useRiderDashboard({ businessDayStart, refreshKey: allCompletedOrders.length });
  const s = dash.summary;

  const [showCount, setShowCount] = useState(50);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [imageGallery, setImageGallery] = useState<{ urls: string[]; startIndex: number } | null>(null);

  const openOrder = async (id: string) => {
    setLoadingOrderId(id);
    const { data } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
    setLoadingOrderId(null);
    if (data) setSelectedOrder(data as Order);
  };

  const rangeLabel =
    dash.range === 'today' ? 'วันนี้'
    : dash.range === 'yesterday' ? 'เมื่อวาน'
    : dash.range === 'date' && dash.bounds.from ? `วันที่ ${shortDate(dash.bounds.from)}`
    : dash.range === 'month' && dash.bounds.from ? dash.bounds.from.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
    : 'ทั้งหมด';

  return (
    <div className="min-h-screen bg-linear-to-b from-indigo-50 via-slate-50 to-slate-100 pb-safe font-sans animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* ===== หัว ===== */}
      <header className="relative overflow-hidden bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white rounded-b-4xl shadow-xl shadow-indigo-500/30">
        <span className="absolute -right-16 -top-20 w-64 h-64 rounded-full bg-white/10" aria-hidden />
        <span className="absolute -left-10 bottom-0 w-40 h-40 rounded-full bg-white/5" aria-hidden />
        <div className="relative max-w-2xl mx-auto px-4 pt-4 pb-5 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={onBack} aria-label="ย้อนกลับ" className="p-2 rounded-xl hover:bg-white/15 active:scale-90 transition cursor-pointer">
              <ArrowLeft size={22} />
            </button>
            <h1 className="flex-1 text-lg font-black">สรุปผลงาน</h1>
            <button
              onClick={() => dash.reload()}
              aria-label="รีเฟรช"
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-90 transition cursor-pointer"
            >
              <RefreshCw size={18} className={dash.refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/20 ring-2 ring-white/40 flex items-center justify-center text-2xl font-black uppercase">
              {riderName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xl font-black truncate">{riderName}</div>
              {s?.working ? (
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-emerald-300/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> กำลังทำงาน · เข้างาน {timeOf(s.working.checkIn)} น.
                </span>
              ) : (
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60" /> ไม่ได้อยู่ในกะ
                </span>
              )}
            </div>
            <div className="text-center rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/20">
              <div className="text-[10px] font-bold text-white/75">งานค้าง</div>
              <div className="text-xl font-black leading-tight">{activeOrdersCount}</div>
            </div>
          </div>

          <div className="flex gap-1 rounded-2xl bg-black/15 p-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => { dash.setRange(r.id); setShowCount(50); }}
                className={`flex-1 rounded-xl py-2 text-[11px] sm:text-xs font-black transition cursor-pointer ${
                  dash.range === r.id ? 'bg-white text-indigo-700 shadow' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {dash.range === 'date' && (
            <input type="date" value={dash.date} onChange={(e) => e.target.value && dash.setDate(e.target.value)}
              className="w-full rounded-xl bg-white/95 px-3 py-2.5 text-sm font-black text-indigo-700 outline-none" />
          )}
          {dash.range === 'month' && (
            <input type="month" value={dash.month} onChange={(e) => e.target.value && dash.setMonth(e.target.value)}
              className="w-full rounded-xl bg-white/95 px-3 py-2.5 text-sm font-black text-indigo-700 outline-none" />
          )}
        </div>
      </header>

      <main className={`max-w-2xl mx-auto px-4 py-5 space-y-4 transition-opacity ${dash.refreshing ? 'opacity-60' : ''}`}>
        {dash.error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{dash.error}</div>
        )}

        {!s ? (
          <div className="flex flex-col items-center gap-3 py-24">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
            <p className="text-sm font-bold text-indigo-400">กำลังโหลด...</p>
          </div>
        ) : (
          <>
            <EarningsHero s={s} rangeLabel={rangeLabel} />

            {dash.range === 'today' && s.working && <GasProgress count={s.orders.length} />}

            {/* ===== ตัวเลขหลัก ===== */}
            <div className="grid grid-cols-3 gap-3">
              <Tile icon={<Package size={16} />} tint="from-sky-500 to-blue-600" label="ส่งสำเร็จ" value={s.orders.length.toLocaleString('th-TH')} unit="ออเดอร์" />
              <Tile icon={<Clock size={16} />} tint="from-violet-500 to-purple-600" label="เวลาทำงาน" value={fmtMinutes(s.pay.minutes)} small />
              <Tile icon={<Fuel size={16} />} tint="from-amber-400 to-orange-500" label="ค่าน้ำมัน" value={baht(s.pay.gas)} />
            </div>

            <CashCard cash={s.cash} rangeLabel={rangeLabel} />

            {s.unpaid.total > 0 && (
              <button
                onClick={() => setShowHistory(true)}
                className="w-full text-left relative overflow-hidden rounded-3xl p-4 text-white bg-linear-to-r from-amber-500 to-orange-500 shadow-lg shadow-orange-500/25 active:scale-[0.99] transition cursor-pointer"
              >
                <span className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-white/15" aria-hidden />
                <div className="relative flex items-center gap-3">
                  <div className="w-11 h-11 shrink-0 rounded-2xl bg-white/25 flex items-center justify-center"><Coins size={22} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black">รายได้ที่ยังไม่ได้รับ</div>
                    <div className="text-[11px] font-semibold text-white/85">{s.unpaid.count} กะที่ร้านยังไม่ได้จ่าย · แตะดูประวัติสลิป</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black tabular-nums">{baht(s.unpaid.total)}</div>
                    <ChevronRight size={16} className="ml-auto" />
                  </div>
                </div>
              </button>
            )}

            {/* ===== รอบบิลเดือน + ประวัติรายวัน ===== */}
            <CycleCard dash={dash} onHistory={() => setShowHistory(true)} />

            {/* ===== รายการออเดอร์ ===== */}
            <section>
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-sm font-black text-slate-800">ออเดอร์ที่ส่งสำเร็จ · {rangeLabel}</h2>
                <span className="text-[11px] font-bold text-slate-400">{s.orders.length.toLocaleString('th-TH')} รายการ</span>
              </div>
              {s.orders.length === 0 ? (
                <div className="flex flex-col items-center rounded-3xl bg-white py-12 text-slate-400">
                  <CalendarDays size={32} className="mb-2 opacity-40" />
                  <p className="text-sm font-bold">ยังไม่มีออเดอร์ในช่วงนี้</p>
                </div>
              ) : (
                <div className="rounded-3xl bg-white shadow-[0_4px_24px_-8px_rgba(79,70,229,0.12)] divide-y divide-slate-100 overflow-hidden">
                  {s.orders.slice(0, showCount).map((o, i) => {
                    const chip = PAY_CHIP[payKind(o.payment_method)];
                    const when = o.end_time || o.created_at;
                    return (
                      <button
                        key={o.id}
                        onClick={() => openOrder(o.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-50/50 active:bg-indigo-50 transition cursor-pointer"
                      >
                        <span className="w-8 h-8 shrink-0 rounded-full bg-slate-100 text-slate-500 text-[11px] font-black flex items-center justify-center">
                          {loadingOrderId === o.id ? <Loader2 size={14} className="animate-spin" /> : s.orders.length - i}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-slate-800 text-sm truncate">{o.order_number}</div>
                          <div className="text-[11px] font-semibold text-slate-400">
                            {dash.range !== 'today' && dash.range !== 'yesterday' && dash.range !== 'date' && `${shortDate(new Date(when))} · `}
                            ส่งเสร็จ {timeOf(when)} น.
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${chip.cls}`}>
                          {chip.icon} {chip.label}
                        </span>
                        <span className="w-14 text-right text-sm font-black text-slate-900 tabular-nums">{baht(Number(o.total_price) || 0)}</span>
                      </button>
                    );
                  })}
                  {s.orders.length > showCount && (
                    <button onClick={() => setShowCount((c) => c + 50)} className="w-full py-3 text-xs font-black text-indigo-600 hover:bg-indigo-50 cursor-pointer">
                      ดูเพิ่มอีก {Math.min(50, s.orders.length - showCount)} รายการ
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {selectedOrder && (
        <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onImages={(urls, i) => setImageGallery({ urls, startIndex: i })} />
      )}
      {showHistory && dash.riderId && dash.profile && (
        <HistoryModal
          riderId={dash.riderId}
          profile={dash.profile}
          biz={dash.biz}
          onClose={() => setShowHistory(false)}
          onImage={(url) => setImageGallery({ urls: [url], startIndex: 0 })}
        />
      )}
      {imageGallery && <Gallery gallery={imageGallery} onClose={() => setImageGallery(null)} />}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
type Summary = NonNullable<ReturnType<typeof useRiderDashboard>['summary']>;

function EarningsHero({ s, rangeLabel }: { s: Summary; rangeLabel: string }) {
  const p = s.pay;
  const hasShift = s.shifts.length > 0;
  const status = s.working ? { t: 'กำลังทำงาน', c: 'bg-white/25' }
    : p.allPaid ? { t: 'จ่ายแล้ว', c: 'bg-white text-emerald-700' }
    : p.anyPaid ? { t: 'จ่ายบางส่วน', c: 'bg-amber-300 text-amber-900' }
    : { t: 'รอร้านโอน', c: 'bg-amber-300 text-amber-900' };
  const calc = p.basePay + p.gas + p.bonus - p.savings;
  const adjusted = hasShift && Math.abs(calc - p.total) > 1;

  return (
    <section className="relative overflow-hidden rounded-3xl p-5 text-white bg-linear-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-xl shadow-teal-500/30">
      <span className="absolute -right-12 -top-14 w-44 h-44 rounded-full bg-white/10" aria-hidden />
      <span className="absolute right-10 -bottom-16 w-32 h-32 rounded-full bg-white/10" aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-white/85"><Wallet size={16} /> รายได้ {rangeLabel}</p>
          {hasShift && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${status.c}`}>{status.t}</span>}
        </div>
        <div className="mt-2 text-5xl font-black tracking-tight tabular-nums drop-shadow-sm">{baht(p.total)}</div>
        {!hasShift ? (
          <p className="mt-2 text-xs font-semibold text-white/80">ไม่มีการเข้างานในช่วงนี้</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Piece label={`ค่าแรง ${fmtMinutes(p.minutes)}`} sub={`ชม.ละ ${baht(p.rate)}`} value={baht(p.basePay)} />
              <Piece label="ค่าน้ำมัน" value={`+${baht(p.gas)}`} />
              <Piece label="โบนัสขยัน" value={`+${baht(p.bonus)}`} />
              <Piece label="หักเงินเก็บ" value={`−${baht(p.savings)}`} />
            </div>
            {adjusted && (
              <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-white/85">
                <AlertCircle size={12} /> ร้านปรับยอดจ่ายจริงเอง ยอดรวมจึงไม่เท่ากับผลบวกข้างบน
              </p>
            )}
            {s.working && (
              <p className="mt-2 text-[11px] font-semibold text-white/80">* ยอดระหว่างกะ อัปเดตทุก 30 วินาที ยอดจริงขึ้นกับร้านกดจ่าย</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Piece({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/20 min-w-0">
      <div className="text-[11px] font-semibold text-white/80 truncate">{label}</div>
      <div className="text-base font-black tabular-nums">{value}</div>
      {sub && <div className="text-[10px] font-semibold text-white/70">{sub}</div>}
    </div>
  );
}

/** แถบความคืบหน้าค่าน้ำมันขั้นถัดไป (เฉพาะวันนี้ระหว่างกะ) */
function GasProgress({ count }: { count: number }) {
  const current = getAutoGasAllowance(count);
  const tiers = [...GAS_TIERS].reverse(); // น้อย → มาก
  const idx = tiers.findIndex((t) => t.amount === current);
  const next = tiers[idx + 1];
  const from = tiers[idx].min;
  const pct = next ? Math.min(100, ((count - from) / (next.min - from)) * 100) : 100;
  return (
    <section className="rounded-3xl bg-white p-4 shadow-[0_4px_24px_-8px_rgba(245,158,11,0.3)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-2xl bg-linear-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center"><Fuel size={18} /></div>
        <div className="flex-1 min-w-0">
          {next ? (
            <p className="text-sm font-black text-slate-800">
              ส่งอีก <span className="text-orange-600">{next.min - count}</span> ออเดอร์ ค่าน้ำมันขึ้นเป็น <span className="text-orange-600">{baht(next.amount)}</span>
            </p>
          ) : (
            <p className="text-sm font-black text-slate-800">ได้ค่าน้ำมันขั้นสูงสุดแล้ว 🎉</p>
          )}
          <p className="text-[11px] font-semibold text-slate-400">ตอนนี้ {count} ออเดอร์ · ได้ {baht(current)}</p>
        </div>
      </div>
      <div className="mt-3 h-2.5 rounded-full bg-amber-100 overflow-hidden">
        <div className="h-full rounded-full bg-linear-to-r from-amber-400 to-orange-500 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}

function Tile({ icon, tint, label, value, unit, small }: { icon: ReactNode; tint: string; label: string; value: string; unit?: string; small?: boolean }) {
  return (
    <div className="rounded-3xl bg-white p-3 shadow-[0_4px_24px_-8px_rgba(79,70,229,0.15)] min-w-0">
      <div className={`w-8 h-8 rounded-xl bg-linear-to-br ${tint} text-white flex items-center justify-center mb-2`}>{icon}</div>
      <div className="text-[11px] font-bold text-slate-500">{label}</div>
      <div className={`${small ? 'text-sm' : 'text-xl'} font-black text-slate-900 tabular-nums leading-tight`}>{value}</div>
      {unit && <div className="text-[10px] font-semibold text-slate-400">{unit}</div>}
    </div>
  );
}

function CashCard({ cash, rangeLabel }: { cash: Summary['cash']; rangeLabel: string }) {
  const pct = cash.total ? (cash.handed / cash.total) * 100 : 0;
  return (
    <section className="rounded-3xl bg-white p-4 shadow-[0_4px_24px_-8px_rgba(244,63,94,0.25)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-2xl bg-linear-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center"><Banknote size={18} /></div>
        <div className="flex-1">
          <h2 className="text-sm font-black text-slate-800">เงินสดที่ต้องส่งร้าน</h2>
          <p className="text-[11px] font-semibold text-slate-400">เก็บจากลูกค้า {rangeLabel} {baht(cash.total)}</p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black tabular-nums ${cash.pending > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{baht(cash.pending)}</div>
          <div className="text-[10px] font-bold text-slate-400">{cash.pending > 0 ? 'ยังค้างส่ง' : cash.total > 0 ? 'ส่งครบแล้ว ✓' : ''}</div>
        </div>
      </div>
      {cash.total > 0 && (
        <>
          <div className="mt-3 h-2 rounded-full bg-rose-100 overflow-hidden">
            <div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-500">ร้านรับแล้ว {baht(cash.handed)}</p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
type Dash = ReturnType<typeof useRiderDashboard>;

/** รอบบิลเดือน: สรุป + รายการทุกวันที่เข้างาน (ให้ไรเดอร์ตรวจสอบ/โต้แย้งได้) */
function CycleCard({ dash, onHistory }: { dash: Dash; onHistory: () => void }) {
  const c = dash.cycle;
  const [open, setOpen] = useState(false);
  const lastDay = c ? new Date(c.end.getTime() - 86400000) : null;
  const statusChip = (pay: RecordPay, rec: AttendanceRecord) =>
    pay.isPaid ? { t: 'จ่ายแล้ว', c: 'bg-emerald-100 text-emerald-700' }
    : pay.isWorking ? { t: 'กำลังทำงาน', c: 'bg-sky-100 text-sky-700' }
    : { t: rec.payment_status || 'ค้างจ่าย', c: 'bg-amber-100 text-amber-800' };

  return (
    <section className="rounded-3xl bg-white shadow-[0_4px_24px_-8px_rgba(79,70,229,0.15)] overflow-hidden">
      {/* หัว + เลื่อนรอบ */}
      <div className="flex items-center gap-2 bg-linear-to-r from-indigo-50 to-violet-50 px-4 py-3">
        <button
          onClick={() => { dash.setCycleOffset((o) => o - 1); setOpen(true); }}
          aria-label="รอบก่อนหน้า"
          className="p-1.5 rounded-lg bg-white text-indigo-600 shadow-sm hover:bg-indigo-100 cursor-pointer active:scale-90"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <h2 className="text-sm font-black text-slate-800">{c?.isCurrent ? 'รอบบิลเดือนนี้' : 'รอบบิลย้อนหลัง'}</h2>
          {c && lastDay && (
            <p className="text-[11px] font-bold text-indigo-500">
              {shortDate(c.start)} – {lastDay.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={() => dash.setCycleOffset((o) => Math.min(0, o + 1))}
          disabled={dash.cycleOffset >= 0}
          aria-label="รอบถัดไป"
          className="p-1.5 rounded-lg bg-white text-indigo-600 shadow-sm hover:bg-indigo-100 cursor-pointer active:scale-90 disabled:opacity-30 disabled:cursor-default"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {!c || c.loading ? (
        <div className="py-8 flex justify-center"><Loader2 size={22} className="animate-spin text-indigo-400" /></div>
      ) : (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-50 p-2.5 text-center">
              <div className="text-[10px] font-bold text-slate-500">เข้างาน</div>
              <div className="text-lg font-black text-slate-900 tabular-nums">{c.workDays} <span className="text-xs">วัน</span></div>
              {c.shifts > c.workDays && <div className="text-[10px] font-semibold text-violet-600">{c.shifts} กะ (มีควบกะ)</div>}
            </div>
            <div className="rounded-2xl bg-amber-50 p-2.5 text-center">
              <div className="text-[10px] font-bold text-amber-700 flex items-center justify-center gap-1"><Trophy size={11} /> โบนัสสะสม</div>
              <div className="text-lg font-black text-slate-900 tabular-nums">{baht(c.bonus)}</div>
            </div>
            <div className="rounded-2xl bg-indigo-50 p-2.5 text-center">
              <div className="text-[10px] font-bold text-indigo-700 flex items-center justify-center gap-1"><PiggyBank size={11} /> เงินเก็บสะสม</div>
              <div className="text-lg font-black text-slate-900 tabular-nums">{baht(c.savings)}</div>
            </div>
          </div>

          {c.monthly && (
            <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-700"><Landmark size={13} /> สลิปรายเดือน: {c.monthly.status}</span>
              <span className="text-slate-900 tabular-nums">{baht(c.monthly.total_amount || 0)}</span>
            </div>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 rounded-2xl border border-indigo-100 py-2.5 text-xs font-black text-indigo-600 hover:bg-indigo-50 cursor-pointer"
          >
            <CalendarDays size={14} /> {open ? 'ซ่อนรายวัน' : `ดูรายวัน (${c.shifts} กะ)`}
            <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>

          {open && (
            <div className="space-y-2">
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 leading-relaxed">
                ร้านหักเงินเก็บวันละ {baht(c.defaultSavings)} (วันที่ควบกะหักครั้งเดียว) · วันที่ร้านจ่ายแล้วแสดงตามยอดที่ร้านบันทึก
                · ถ้าตัวเลขไม่ตรงกับที่ทำงานจริง แจ้งแอดมินพร้อมวันที่ได้เลย
              </p>
              {c.days.length === 0 ? (
                <p className="py-6 text-center text-sm font-bold text-slate-400">ยังไม่มีวันเข้างานในรอบนี้</p>
              ) : (
                c.days.map(({ record, pay }) => {
                  const st = statusChip(pay, record);
                  return (
                    <div key={record.id} className="rounded-2xl border border-slate-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-black text-slate-800">
                            {new Date(record.check_in).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          {pay.extraShift && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-black text-violet-700">กะควบ</span>}
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${st.c}`}>{st.t}</span>
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-slate-500">
                        เข้า {timeOf(record.check_in)} – ออก {record.check_out ? timeOf(record.check_out) : '…'} น. · {fmtMinutes(pay.minutes)} · {pay.orders} ออเดอร์
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                        <div className="rounded-lg bg-slate-50 py-1">
                          <div className="text-[9px] font-bold text-slate-400">ค่าแรง+น้ำมัน</div>
                          <div className="text-[11px] font-black text-slate-700 tabular-nums">{baht(pay.basePay + pay.gas)}</div>
                        </div>
                        <div className="rounded-lg bg-amber-50 py-1">
                          <div className="text-[9px] font-bold text-amber-700">โบนัส</div>
                          <div className="text-[11px] font-black text-slate-700 tabular-nums">+{baht(pay.bonus)}</div>
                        </div>
                        <div className="rounded-lg bg-indigo-50 py-1">
                          <div className="text-[9px] font-bold text-indigo-700">หักเก็บ</div>
                          <div className="text-[11px] font-black text-slate-700 tabular-nums">−{baht(pay.savings)}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 py-1">
                          <div className="text-[9px] font-bold text-emerald-700">ได้รับ</div>
                          <div className="text-[11px] font-black text-slate-900 tabular-nums">{baht(pay.total)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {c.days.length > 0 && (
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-900 p-3 text-center text-white">
                  <div><div className="text-[10px] font-bold text-white/60">รวมโบนัส</div><div className="text-sm font-black tabular-nums">{baht(c.bonus)}</div></div>
                  <div><div className="text-[10px] font-bold text-white/60">รวมหักเก็บ</div><div className="text-sm font-black tabular-nums">{baht(c.savings)}</div></div>
                  <div><div className="text-[10px] font-bold text-white/60">รวมรายวัน</div><div className="text-sm font-black tabular-nums">{baht(c.total)}</div></div>
                </div>
              )}
            </div>
          )}

          <button onClick={onHistory} className="w-full flex items-center justify-center gap-1 rounded-2xl bg-indigo-50 py-2.5 text-xs font-black text-indigo-600 hover:bg-indigo-100 cursor-pointer">
            <Clock size={13} /> ประวัติสลิปทั้งหมด
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
function ModalShell({ title, icon, onClose, children, wide }: { title: string; icon: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-100 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className={`bg-slate-50 rounded-4xl shadow-2xl w-full ${wide ? 'max-w-md' : 'max-w-sm'} overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden bg-linear-to-r from-indigo-600 to-violet-600 px-5 py-4 flex items-center justify-between text-white shrink-0">
          <span className="absolute -right-8 -top-10 w-28 h-28 rounded-full bg-white/10" aria-hidden />
          <h3 className="relative flex items-center gap-2 text-base font-black">{icon} {title}</h3>
          <button onClick={onClose} aria-label="ปิด" className="relative p-2 rounded-full bg-white/15 hover:bg-white/25 cursor-pointer active:scale-90 transition"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function OrderModal({ order, onClose, onImages }: { order: Order; onClose: () => void; onImages: (urls: string[], i: number) => void }) {
  const chip = PAY_CHIP[payKind(order.payment_method ?? null)];
  const imgs = (order.image_url || '').split(',').filter(Boolean);
  const slips = (order.slip_image || '').split(',').filter(Boolean);
  return (
    <ModalShell title="รายละเอียดบิล" icon={<ClipboardList size={18} />} onClose={onClose}>
      <div className="p-5 space-y-4 overflow-y-auto hide-scrollbar">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400">
              {new Date(order.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{order.order_number}</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
            <CheckCircle2 size={12} /> {order.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white p-3">
            <div className="text-[11px] font-bold text-slate-400">ยอดเรียกเก็บ</div>
            <div className="text-xl font-black text-indigo-600 tabular-nums">{baht(Number(order.total_price) || 0)}</div>
            {!!order.delivery_fee && <div className="text-[10px] font-semibold text-slate-400">รวมค่าส่ง {baht(order.delivery_fee)}</div>}
          </div>
          <div className="rounded-2xl bg-white p-3">
            <div className="text-[11px] font-bold text-slate-400">ชำระเงิน</div>
            <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${chip.cls}`}>{chip.icon} {chip.label}</span>
          </div>
        </div>

        {order.menu && (
          <div>
            <div className="text-[11px] font-black text-slate-400 mb-1">รายการเมนู</div>
            <div className="rounded-2xl bg-white p-3 text-sm font-bold text-slate-800 whitespace-pre-line leading-relaxed">{order.menu}</div>
          </div>
        )}
        {order.details && (
          <div>
            <div className="text-[11px] font-black text-slate-400 mb-1">รายละเอียดเพิ่มเติม</div>
            <div className="rounded-2xl bg-white p-3 text-sm text-slate-600 whitespace-pre-line leading-relaxed">{order.details}</div>
          </div>
        )}
        {order.address && (
          <div>
            <div className="text-[11px] font-black text-slate-400 mb-1">สถานที่จัดส่ง</div>
            <div className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-slate-800 flex gap-2">
              <MapPinned size={16} className="text-rose-500 shrink-0 mt-0.5" /> {order.address}
            </div>
          </div>
        )}
        {[{ label: 'รูปภาพแนบ', urls: imgs }, { label: 'สลิปโอนเงิน', urls: slips }].map(({ label, urls }) =>
          urls.length ? (
            <div key={label}>
              <div className="text-[11px] font-black text-slate-400 mb-1 flex items-center gap-1"><ImageIcon size={12} /> {label}</div>
              <div className="grid grid-cols-2 gap-2">
                {urls.map((u, i) => (
                  <button key={i} onClick={() => onImages(urls, i)} className="relative h-28 rounded-2xl overflow-hidden ring-1 ring-slate-200 cursor-pointer active:scale-95 transition">
                    <Image src={mediaUrl(u)} fill className="object-cover" alt={`${label} ${i + 1}`} sizes="200px" />
                  </button>
                ))}
              </div>
            </div>
          ) : null,
        )}
      </div>
      <div className="p-4 pt-0 shrink-0">
        <button onClick={onClose} className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-slate-800 active:scale-95 transition cursor-pointer">ปิด</button>
      </div>
    </ModalShell>
  );
}

function HistoryModal({
  riderId, profile, biz, onClose, onImage,
}: {
  riderId: string;
  profile: Parameters<typeof fetchPayHistory>[1];
  biz: Parameters<typeof fetchPayHistory>[2];
  onClose: () => void;
  onImage: (url: string) => void;
}) {
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily');
  const [data, setData] = useState<{ daily: { record: AttendanceRecord; pay: RecordPay }[]; monthly: MonthlyPaymentRecord[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchPayHistory(riderId, profile, biz)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [riderId, profile, biz]);

  const unpaid = data?.daily.filter((x) => !x.pay.isPaid) ?? [];
  const paid = data?.daily.filter((x) => x.pay.isPaid) ?? [];

  return (
    <ModalShell title="ประวัติสลิปเงินเดือน" icon={<Clock size={18} />} onClose={onClose} wide>
      <div className="p-4 flex flex-col gap-3 overflow-hidden flex-1">
        <div className="flex gap-1 rounded-2xl bg-slate-200/70 p-1 shrink-0">
          {(['daily', 'monthly'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-xl py-2 text-xs font-black transition cursor-pointer ${tab === t ? 'bg-white text-indigo-700 shadow' : 'text-slate-500'}`}>
              {t === 'daily' ? 'สลิปรายวัน' : 'สลิปรายเดือน'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2.5">
          {failed ? (
            <p className="py-10 text-center text-sm font-bold text-rose-500">โหลดไม่สำเร็จ</p>
          ) : !data ? (
            <div className="py-10 flex justify-center"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
          ) : tab === 'daily' ? (
            data.daily.length === 0 ? (
              <p className="py-10 text-center text-sm font-bold text-slate-400">ยังไม่มีประวัติ</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-linear-to-br from-amber-400 to-orange-500 p-3 text-white">
                    <div className="text-[11px] font-bold text-white/85">ยังไม่ได้รับ</div>
                    <div className="text-lg font-black tabular-nums">{baht(unpaid.reduce((a, x) => a + x.pay.total, 0))}</div>
                    <div className="text-[10px] font-semibold text-white/80">{unpaid.length} กะ</div>
                  </div>
                  <div className="rounded-2xl bg-linear-to-br from-emerald-500 to-teal-500 p-3 text-white">
                    <div className="text-[11px] font-bold text-white/85">ได้รับแล้ว (60 กะล่าสุด)</div>
                    <div className="text-lg font-black tabular-nums">{baht(paid.reduce((a, x) => a + x.pay.total, 0))}</div>
                    <div className="text-[10px] font-semibold text-white/80">{paid.length} กะ</div>
                  </div>
                </div>
                {data.daily.map(({ record, pay }) => (
                  <div key={record.id} className="rounded-2xl bg-white p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                        {new Date(record.check_in).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })}
                        <span className="font-semibold text-slate-400">{timeOf(record.check_in)} น.</span>
                        {pay.extraShift && (
                          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-black text-violet-700">กะควบ</span>
                        )}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        pay.isPaid ? 'bg-emerald-100 text-emerald-700' : pay.isWorking ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {pay.isPaid ? 'จ่ายแล้ว' : pay.isWorking ? 'กำลังทำงาน' : record.payment_status || 'ค้างจ่าย'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-end justify-between">
                      <div className="text-[11px] font-semibold text-slate-400 leading-relaxed">
                        {fmtMinutes(pay.minutes)} · {pay.orders} ออเดอร์
                        <br />ค่าน้ำมัน +{baht(pay.gas)}{pay.bonus > 0 && ` · โบนัส +${baht(pay.bonus)}`} · หักเก็บ −{baht(pay.savings)}
                      </div>
                      <div className={`text-lg font-black tabular-nums ${pay.isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>{baht(pay.total)}</div>
                    </div>
                    {record.payment_slip_url && (
                      <button onClick={() => onImage(record.payment_slip_url!)} className="mt-2 w-full rounded-xl bg-indigo-50 py-2 text-[11px] font-black text-indigo-600 flex items-center justify-center gap-1.5 hover:bg-indigo-100 cursor-pointer">
                        <ImageIcon size={13} /> ดูสลิปโอนเงิน
                      </button>
                    )}
                  </div>
                ))}
              </>
            )
          ) : data.monthly.length === 0 ? (
            <p className="py-10 text-center text-sm font-bold text-slate-400">ยังไม่มีสลิปรายเดือน</p>
          ) : (
            data.monthly.map((m) => (
              <div key={m.id} className="rounded-2xl bg-white p-3.5 border-l-4 border-indigo-500">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-indigo-700 flex items-center gap-1.5"><Landmark size={14} /> รอบเดือน {m.month_key}</div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${m.status === 'จ่ายแล้ว' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{m.status}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-amber-50 py-1.5"><div className="text-[10px] font-bold text-amber-700">โบนัส</div><div className="text-xs font-black">{baht(m.total_bonus || 0)}</div></div>
                  <div className="rounded-xl bg-indigo-50 py-1.5"><div className="text-[10px] font-bold text-indigo-700">เงินเก็บ</div><div className="text-xs font-black">{baht(m.total_savings || 0)}</div></div>
                  <div className="rounded-xl bg-emerald-50 py-1.5"><div className="text-[10px] font-bold text-emerald-700">สุทธิ</div><div className="text-xs font-black">{baht(m.total_amount || 0)}</div></div>
                </div>
                {m.slip_url && (
                  <button onClick={() => onImage(m.slip_url!)} className="mt-2 w-full rounded-xl bg-indigo-50 py-2 text-[11px] font-black text-indigo-600 flex items-center justify-center gap-1.5 hover:bg-indigo-100 cursor-pointer">
                    <ImageIcon size={13} /> ดูสลิปเงินเดือน
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function Gallery({ gallery, onClose }: { gallery: { urls: string[]; startIndex: number }; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current?.children[gallery.startIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [gallery]);
  const scroll = (dir: -1 | 1) => {
    setScale(1);
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth, behavior: 'smooth' });
  };
  return (
    <div className="fixed inset-0 z-400 bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200" onClick={onClose}>
      <div className="absolute top-0 inset-x-0 p-5 flex justify-between items-center z-50 text-white pointer-events-none">
        <span className="text-xs font-bold bg-white/20 px-3 py-1.5 rounded-full">แตะ 2 ครั้งเพื่อซูม</span>
        <button onClick={onClose} aria-label="ปิด" className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full pointer-events-auto cursor-pointer"><X size={20} /></button>
      </div>
      {gallery.urls.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); scroll(-1); }} className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 cursor-pointer"><ChevronLeft size={24} /></button>
          <button onClick={(e) => { e.stopPropagation(); scroll(1); }} className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 cursor-pointer"><ChevronRight size={24} /></button>
        </>
      )}
      <div ref={ref} className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
        {gallery.urls.map((url, i) => (
          <div key={i} className={`w-full h-full shrink-0 snap-center p-2 flex overflow-auto ${scale > 1 ? 'items-start justify-start' : 'items-center justify-center'}`} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(url)}
              alt={`รูป ${i + 1}`}
              className={`rounded-lg shadow-2xl transition-all duration-300 cursor-zoom-in ${scale > 1 ? 'm-auto' : ''}`}
              style={{ width: scale > 1 ? `${scale * 100}%` : '100%', height: scale > 1 ? 'auto' : '100%', objectFit: 'contain', maxWidth: scale > 1 ? 'none' : '100%' }}
              onDoubleClick={() => setScale((p) => (p === 1 ? 2.5 : 1))}
            />
          </div>
        ))}
      </div>
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-slate-800/80 px-6 py-3 rounded-full z-50" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setScale((p) => Math.max(1, p - 0.5))} disabled={scale <= 1} className="p-2 rounded-full text-white disabled:text-slate-500 cursor-pointer"><ZoomOut size={24} /></button>
        <span className="text-white font-black text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((p) => Math.min(4, p + 0.5))} disabled={scale >= 4} className="p-2 rounded-full text-white disabled:text-slate-500 cursor-pointer"><ZoomIn size={24} /></button>
      </div>
    </div>
  );
}
