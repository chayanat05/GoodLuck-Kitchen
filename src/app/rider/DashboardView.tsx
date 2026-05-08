'use client'
import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, LayoutDashboard, CheckCircle2, 
  MapPinned, Navigation, X, ClipboardList,
  ImageIcon, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Calendar, CalendarDays,
  Banknote, Coins, Clock, Package, Fuel, Trophy, PiggyBank 
} from 'lucide-react';
import { Order } from '../../components/OrderCard';
import Image from 'next/image';
import { supabase } from '../../lib/supabase'; 

const SHOP_LAT = 16.248130;
const SHOP_LNG = 103.242206;

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
};

const getAutoGasAllowance = (orders: number): number => {
  if (orders >= 71) return 350;
  if (orders >= 61) return 300;
  if (orders >= 51) return 250;
  if (orders >= 41) return 200;
  if (orders >= 31) return 150;
  if (orders >= 21) return 100;
  if (orders >= 10) return 50;
  return 0;
};

const getCycleDetails = () => {
  const now = new Date();
  const startDate = new Date(now);
  if (now.getDate() >= 26) {
    startDate.setDate(26);
  } else {
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(26);
  }
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(25);
  endDate.setHours(23, 59, 59, 999);
  return { startDateStr: startDate.toISOString(), endDateStr: endDate.toISOString() };
};

interface DashboardViewProps {
  riderName: string;
  onBack: () => void;
  activeOrdersCount: number;
  allCompletedOrders: Order[]; 
  cutOffHour: number; 
}

type FilterMode = 'today' | 'date' | 'month' | 'all';

export default function DashboardView({ 
  riderName, 
  onBack, 
  activeOrdersCount, 
  allCompletedOrders,
  cutOffHour
}: DashboardViewProps) {
  
  const [filterMode, setFilterMode] = useState<FilterMode>('today');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]); 
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7)); 
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('all'); 
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [imageGallery, setImageGallery] = useState<{urls: string[], startIndex: number} | null>(null);
  const [imgScale, setImgScale] = useState(1);
  const galleryRef = useRef<HTMLDivElement>(null);

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [payrollStats, setPayrollStats] = useState({
    isWorking: false,
    checkInTime: null as string | null,
    hourlyRate: 40,
    monthlyBonus: 0,
    monthlySavings: 0,
    dailyFixedPay: 0, 
    dailyFixedGas: 0,
    dailyFixedMinutes: 0
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchPayroll = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const riderId = session.user.id;

      const now = new Date();
      const shiftStart = new Date(now);
      if (now.getHours() < cutOffHour) shiftStart.setDate(shiftStart.getDate() - 1);
      shiftStart.setHours(cutOffHour, 0, 0, 0);

      const { data: dailyData } = await supabase
        .from('rider_attendance')
        .select('*')
        .eq('rider_id', riderId)
        .gte('check_in', shiftStart.toISOString())
        .order('check_in', { ascending: false })
        .limit(1)
        .single();

      const cycle = getCycleDetails();
      const { data: monthlyData } = await supabase
        .from('rider_attendance')
        .select('diligence_bonus, accumulated_savings')
        .eq('rider_id', riderId)
        .gte('check_in', cycle.startDateStr)
        .lte('check_in', cycle.endDateStr);

      let mBonus = 0;
      let mSavings = 0;
      if (monthlyData) {
        monthlyData.forEach(r => {
          mBonus += Number(r.diligence_bonus) || 0;
          mSavings += Number(r.accumulated_savings) || 0;
        });
      }

      if (dailyData) {
        let rate = 40;
        if ((dailyData.base_pay || 0) > 0 && (dailyData.total_minutes || 0) > 0) {
          rate = (dailyData.base_pay / dailyData.total_minutes) * 60;
        }
        setPayrollStats({
          isWorking: !dailyData.check_out,
          checkInTime: dailyData.check_in,
          hourlyRate: Math.round(rate),
          monthlyBonus: mBonus,
          monthlySavings: mSavings,
          dailyFixedPay: dailyData.total_pay || 0,
          dailyFixedGas: dailyData.gas_allowance || 0,
          dailyFixedMinutes: dailyData.total_minutes || 0
        });
      } else {
        setPayrollStats(prev => ({ ...prev, monthlyBonus: mBonus, monthlySavings: mSavings }));
      }
    };
    fetchPayroll();
  }, [cutOffHour]);

  const todaysCompletedOrdersCount = useMemo(() => {
    const now = new Date();
    const shiftStart = new Date(now);
    if (now.getHours() < cutOffHour) shiftStart.setDate(shiftStart.getDate() - 1);
    shiftStart.setHours(cutOffHour, 0, 0, 0);
    const shiftEnd = new Date(shiftStart);
    shiftEnd.setDate(shiftEnd.getDate() + 1);

    return (Array.isArray(allCompletedOrders) ? allCompletedOrders : []).filter(o => {
      if (o.status !== 'ส่งแล้ว/เสร็จ' || !o.end_time) return false;
      const d = new Date(o.end_time);
      return d >= shiftStart && d < shiftEnd;
    }).length;
  }, [allCompletedOrders, cutOffHour]); 

  const liveMinutes = payrollStats.isWorking 
    ? Math.max(0, Math.floor((currentTime.getTime() - new Date(payrollStats.checkInTime!).getTime()) / 60000))
    : payrollStats.dailyFixedMinutes;

  const liveGas = payrollStats.isWorking 
    ? getAutoGasAllowance(todaysCompletedOrdersCount) 
    : payrollStats.dailyFixedGas;

  const liveTotalPay = payrollStats.isWorking
    ? ((liveMinutes / 60) * payrollStats.hourlyRate) + liveGas
    : payrollStats.dailyFixedPay;

  useEffect(() => {
    if (
      imageGallery &&
      galleryRef.current &&
      imageGallery.startIndex >= 0 &&
      galleryRef.current.children.length > imageGallery.startIndex
    ) {
      const target = galleryRef.current.children[imageGallery.startIndex] as HTMLElement;
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [imageGallery]);

  const scrollGallery = (direction: 'left' | 'right') => {
    setImgScale(1);
    if (galleryRef.current) {
      const { clientWidth } = galleryRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth : clientWidth;
      if (typeof galleryRef.current.scrollBy === 'function') {
        galleryRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  const getFilteredOrders = () => {
    return (Array.isArray(allCompletedOrders) ? allCompletedOrders : []).filter(order => {
      if (!order.end_time) return false;
      const orderDate = new Date(order.end_time);

      let timeMatch = true;
      if (filterMode === 'today') {
        const now = new Date();
        const shiftStart = new Date(now);
        if (now.getHours() < cutOffHour) {
          shiftStart.setDate(shiftStart.getDate() - 1);
        }
        shiftStart.setHours(cutOffHour, 0, 0, 0);

        const shiftEnd = new Date(shiftStart);
        shiftEnd.setDate(shiftEnd.getDate() + 1);

        timeMatch = orderDate >= shiftStart && orderDate < shiftEnd;

      } else if (filterMode === 'date' && filterDate) {
        const target = new Date(filterDate);
        target.setHours(cutOffHour, 0, 0, 0);
        
        const targetEnd = new Date(target);
        targetEnd.setDate(targetEnd.getDate() + 1);

        timeMatch = orderDate >= target && orderDate < targetEnd;

      } else if (filterMode === 'month' && filterMonth) {
        const [year, month] = filterMonth.split('-');
        timeMatch = orderDate.getFullYear() === parseInt(year) &&
          orderDate.getMonth() === parseInt(month) - 1;
      }

      const jobMatch = jobTypeFilter === 'all' ? true : order.job_type === jobTypeFilter;

      return timeMatch && jobMatch;
    }).sort((a, b) => {
      const aTime = a.end_time ? new Date(a.end_time).getTime() : 0;
      const bTime = b.end_time ? new Date(b.end_time).getTime() : 0;
      return bTime - aTime;
    });
  };

  const displayOrders = Array.isArray(getFilteredOrders()) ? getFilteredOrders() : [];

  const calculateTotalDistance = (): string => {
    if (!Array.isArray(displayOrders) || displayOrders.length === 0) return "0.0";
    let totalDist = 0, currentLat = SHOP_LAT, currentLng = SHOP_LNG;

    [...displayOrders].reverse().forEach(order => {
      const lat = typeof order.lat === 'number' ? order.lat : currentLat;
      const lng = typeof order.lng === 'number' ? order.lng : currentLng;
      if (!isNaN(lat) && !isNaN(lng)) {
        totalDist += calculateDistance(currentLat, currentLng, lat, lng);
        currentLat = lat;
        currentLng = lng;
      }
    });
    return Number.isFinite(totalDist) ? totalDist.toFixed(1) : "0.0";
  };

  // 🌟 ลบตัวแปร totalTransfer และ totalValue ที่ทำให้เกิดขีดเหลืองทิ้งไป
  const totalCash = displayOrders.filter(o => o.payment_method === 'เงินสด' || !o.payment_method).reduce((sum, o) => sum + (o.total_price || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-safe animate-in fade-in slide-in-from-bottom-4 duration-300 relative font-sans">
      
      <div className="bg-blue-600/95 backdrop-blur-md text-white p-4 shadow-lg sticky top-0 z-30 flex items-center justify-between border-b border-blue-500/50">
        <div className="flex items-center">
          <button onClick={onBack} className="mr-3 p-2 hover:bg-white/10 rounded-xl transition-all duration-200 focus:outline-none cursor-pointer active:scale-90">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl font-black flex items-center tracking-tight drop-shadow-sm">
            <LayoutDashboard className="mr-2" size={20} /> สรุปผลงาน
          </h1>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto">
        
        {/* Profile Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 flex items-center">
          <div className="w-14 h-14 bg-linear-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner mr-4 uppercase">
            {riderName.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{riderName}</h2>
            <div className="text-xs text-slate-500 flex items-center mt-1 font-bold">
              <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
              ไรเดอร์ประจำร้าน
            </div>
          </div>
          <div className="text-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            <div className="text-[10px] text-slate-400 font-black mb-0.5 uppercase tracking-wide">งานค้างอยู่</div>
            <div className="text-lg font-black text-blue-600">{activeOrdersCount}</div>
          </div>
        </div>

        {/* 🌟 1. การ์ดรายได้ Realtime ของไรเดอร์ */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="font-black text-slate-700 text-sm flex items-center">
              <Coins size={18} className="mr-2 text-emerald-500" /> กระเป๋าเงินของฉัน (วันนี้)
            </h3>
            {payrollStats.isWorking ? (
              <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ทำงานอยู่
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shadow-sm">
                ไม่ได้เข้างาน
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 text-center flex flex-col justify-center">
              <div className="text-[10px] font-black text-emerald-600/70 uppercase tracking-wider mb-1">รายได้วันนี้ (ประมาณ)</div>
              <div className="text-3xl font-black text-emerald-600 tracking-tighter">฿{Math.round(liveTotalPay).toLocaleString()}</div>
            </div>
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col justify-center">
              <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-2">
                <span className="flex items-center"><Clock size={12} className="mr-1 text-blue-500"/> เวลาทำ</span>
                <span className="text-blue-700 font-black">{liveMinutes} นาที</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-2">
                <span className="flex items-center"><Package size={12} className="mr-1 text-orange-500"/> สำเร็จแล้ว</span>
                <span className="text-orange-700 font-black">{todaysCompletedOrdersCount} งาน</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                <span className="flex items-center"><Fuel size={12} className="mr-1 text-slate-500"/> ค่าน้ำมัน</span>
                <span className="text-slate-700 font-black">฿{liveGas.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-xl border border-amber-100 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 shrink-0"><Trophy size={14}/></div>
              <div>
                <div className="text-[9px] font-black text-amber-600/70 uppercase tracking-wider">โบนัสรอบบิลนี้</div>
                <div className="text-sm font-black text-amber-700">฿{payrollStats.monthlyBonus.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-indigo-50 p-3 rounded-xl border border-indigo-100 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 shrink-0"><PiggyBank size={14}/></div>
              <div>
                <div className="text-[9px] font-black text-indigo-600/70 uppercase tracking-wider">เงินเก็บรอบบิลนี้</div>
                <div className="text-sm font-black text-indigo-700">฿{payrollStats.monthlySavings.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ฟิลเตอร์ ข้อมูลเดิม */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-black text-slate-700 text-sm flex items-center">
              <CalendarDays size={16} className="mr-2 text-indigo-500" /> ตัวกรองข้อมูลงานวิ่ง
            </h3>
          </div>

          <div className="flex bg-slate-200/60 p-1.5 rounded-xl border border-slate-200 shadow-inner">
            {[
              { id: 'today', label: 'วันนี้' },
              { id: 'date', label: 'ระบุวัน' },
              { id: 'all', label: 'ทั้งหมด' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterMode(tab.id as FilterMode)}
                className={`flex-1 py-2 text-[11px] sm:text-xs font-black rounded-lg transition-all duration-300 cursor-pointer ${
                  filterMode === tab.id 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filterMode === 'date' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <input 
                type="date" 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)} 
                className="w-full bg-white p-3 rounded-xl border border-slate-200 text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer" 
              />
            </div>
          )}
          {filterMode === 'month' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <input 
                type="month" 
                value={filterMonth} 
                onChange={e => setFilterMonth(e.target.value)} 
                className="w-full bg-white p-3 rounded-xl border border-slate-200 text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer" 
              />
            </div>
          )}

          <div className="flex overflow-x-auto gap-2 pb-2 pt-1 hide-scrollbar">
            {['all', 'ร้าน', 'รับหิ้ว', 'รับส่ง'].map(type => (
              <button
                key={type}
                onClick={() => setJobTypeFilter(type)}
                className={`px-4 py-2 text-[11px] font-black rounded-full whitespace-nowrap transition-all duration-200 cursor-pointer border ${
                  jobTypeFilter === type 
                  ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' 
                  : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50 shadow-sm'
                }`}
              >
                {type === 'all' ? 'ทุกประเภทงาน' : type}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col gap-3">
          <div className="flex items-center text-slate-700 font-black text-sm mb-1"><Banknote size={18} className="mr-2 text-rose-500" /> สรุปยอดเงินที่ต้องคืนร้าน</div>
          <div className="flex gap-3">
            <div className="flex-1 bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-center justify-between shadow-sm">
              <div className="text-[11px] font-black text-rose-600 uppercase tracking-wider">เงินสด (ต้องส่งร้าน)</div>
              <div className="text-2xl font-black text-rose-700">฿{totalCash.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-linear-to-br from-emerald-500 to-teal-600 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden transform transition-all duration-300 hover:-translate-y-1">
            <CheckCircle2 size={64} className="absolute -right-4 -bottom-4 text-white opacity-20" />
            <div className="text-emerald-100 text-xs font-bold mb-1 flex items-center tracking-wide"><CheckCircle2 size={14} className="mr-1.5"/> ส่งสำเร็จ</div>
            <div className="text-4xl font-black tracking-tight">{displayOrders.length} <span className="text-sm font-bold text-emerald-200">งาน</span></div>
          </div>

          <div className="bg-linear-to-br from-indigo-500 to-purple-600 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden transform transition-all duration-300 hover:-translate-y-1">
            <MapPinned size={64} className="absolute -right-4 -bottom-4 text-white opacity-20" />
            <div className="text-indigo-100 text-xs font-bold mb-1 flex items-center tracking-wide"><Navigation size={14} className="mr-1.5"/> ระยะทางสะสม</div>
            <div className="text-4xl font-black tracking-tight">{calculateTotalDistance()} <span className="text-sm font-bold text-indigo-200">กม.</span></div>
          </div>
        </div>

        <div>
          <h3 className="font-black text-slate-700 mb-3 px-1 text-sm flex items-center justify-between">
            รายการออเดอร์ที่ตรงเงื่อนไข
            <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full uppercase">แตะดูข้อมูล</span>
          </h3>
          <div className="space-y-3">
            {displayOrders.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
                <Calendar size={32} className="mb-3 opacity-30" />
                <p className="text-sm font-bold">ไม่มีรายการในหมวดหมู่นี้</p>
              </div>
            ) : (
              displayOrders.map((order, idx) => (
                <div 
                  key={order.id} 
                  onClick={() => setSelectedOrder(order)}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:border-blue-200 hover:shadow-md active:scale-95 transition-all duration-300 group"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors text-slate-400 text-xs font-black flex items-center justify-center mr-3 border border-slate-100 shrink-0">
                      {displayOrders.length - idx}
                    </div>
                    <div>
                      <div className="font-black text-slate-800 text-sm flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                        {order.order_number}
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase border border-slate-200">
                          {order.job_type}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center font-medium">
                        <span className="font-black text-slate-500 mr-1.5 border-r border-slate-200 pr-1.5">
                          {new Date(order.created_at).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}
                        </span> 
                        {order.end_time ? new Date(order.end_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm flex items-center">
                      สำเร็จ
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col max-h-[90vh]">
            
            <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0">
              <h3 className="font-black flex items-center text-lg tracking-tight">
                <ClipboardList size={20} className="mr-2"/> รายละเอียดบิล
              </h3>
              <button onClick={() => setSelectedOrder(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer active:scale-90 duration-300"><X size={18} strokeWidth={2} /></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto hide-scrollbar">
              <div className="flex justify-between items-end border-b border-slate-100 pb-5">
                <div>
                  <div className="text-[10px] font-black text-slate-400 mb-1 tracking-widest uppercase">
                    เลขที่ออเดอร์ • {new Date(selectedOrder.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-3xl font-black text-slate-800 tracking-tighter">{selectedOrder.order_number}</div>
                </div>
                <div className="text-right mb-1">
                  <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-3 py-1.5 rounded-lg shadow-sm border border-emerald-100">{selectedOrder.status}</span>
                </div>
              </div>
              
              {selectedOrder.image_url && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center">
                    <ImageIcon size={14} className="mr-1.5" /> รูปภาพแนบ
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedOrder.image_url.split(',').filter(Boolean).map((imgUrl, i) => (
                      <div key={i} onClick={() => setImageGallery({ urls: selectedOrder.image_url!.split(',').filter(Boolean), startIndex: i })} className="relative h-32 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer hover:shadow-md transition-all active:scale-95 group/img">
                        <Image src={imgUrl} fill className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" alt={`Slip ${i}`} sizes="256px"  />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedOrder.menu && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider">รายการเมนู</div>
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-sm text-slate-800 font-bold whitespace-pre-line leading-relaxed shadow-inner">
                    {selectedOrder.menu}
                  </div>
                </div>
              )}

              {selectedOrder.details && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider">รายละเอียดเพิ่มเติม</div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-600 font-medium whitespace-pre-line leading-relaxed">
                    {selectedOrder.details}
                  </div>
                </div>
              )}
              
              <div className="space-y-3 text-sm bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">ประเภทงาน:</span><span className="font-black text-slate-700 uppercase px-2.5 py-1 bg-white border border-slate-200 shadow-sm rounded-md">{selectedOrder.job_type}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">ผู้รับผิดชอบ:</span><span className="font-black text-slate-700 bg-white border border-slate-200 shadow-sm px-2.5 py-1 rounded-md">{selectedOrder.rider_name || '-'}</span></div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60"><span className="text-slate-500 font-medium">ยอดเรียกเก็บ:</span><span className="font-black text-blue-600 text-lg">฿{selectedOrder.total_price}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">การชำระเงิน:</span><span className={`font-black text-[10px] uppercase px-2.5 py-1 rounded-md ${selectedOrder.payment_method === 'โอน' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-600'}`}>{selectedOrder.payment_method || 'เงินสด'}</span></div>
              </div>

              {selectedOrder.address && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider">สถานที่จัดส่ง</div>
                  <div className="text-sm font-bold text-slate-800 leading-relaxed bg-red-50/50 border border-red-100 p-4 rounded-2xl flex items-start">
                    <MapPinned size={18} className="mr-2 mt-0.5 text-red-500 shrink-0" />
                    {selectedOrder.address}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-5 pt-0 shrink-0 bg-white border-t border-slate-100 mt-2">
              <button onClick={() => setSelectedOrder(null)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all cursor-pointer shadow-lg active:scale-95 uppercase tracking-widest text-sm">
                ปิดหน้าต่าง
              </button>
            </div>
            
          </div>
        </div>
      )}

      {imageGallery && (
        <div className="fixed inset-0 z-300 bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200" onClick={() => { setImageGallery(null); setImgScale(1); }}>
          <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-50 text-white pointer-events-none">
            <span className="font-bold text-xs bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm">แตะ 2 ครั้งเพื่อซูม / ใช้ปุ่มลูกศรเลื่อน</span>
            <button type="button" onClick={() => { setImageGallery(null); setImgScale(1); }} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-90 pointer-events-auto cursor-pointer">
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
          
          {imageGallery.urls.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); scrollGallery('left'); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 transition-all cursor-pointer hidden md:block">
                <ChevronLeft size={24} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); scrollGallery('right'); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 transition-all cursor-pointer hidden md:block">
                <ChevronRight size={24} />
              </button>
            </>
          )}
          
          <div ref={galleryRef} className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
            {imageGallery.urls.map((url, i) => (
              <div key={i} className={`w-full h-full shrink-0 snap-center p-2 flex overflow-auto ${imgScale > 1 ? 'items-start justify-start' : 'items-center justify-center'}`} onClick={(e) => e.stopPropagation()}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={url} 
                  className={`transition-all duration-300 origin-center cursor-zoom-in shadow-2xl rounded-lg ${imgScale > 1 ? 'm-auto' : ''}`}
                  style={{ 
                    width: imgScale > 1 ? `${imgScale * 100}%` : '100%', 
                    height: imgScale > 1 ? 'auto' : '100%',
                    objectFit: 'contain',
                    maxWidth: imgScale > 1 ? 'none' : '100%' 
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setImgScale(prev => prev === 1 ? 2.5 : 1);
                  }}
                  alt={`Gallery ${i}`} 
                />
              </div>
            ))}
          </div>

          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-6 bg-slate-800/80 px-6 py-3 rounded-full backdrop-blur-md shadow-2xl z-50" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setImgScale(prev => Math.max(1, prev - 0.5))} className={`p-2 rounded-full transition-all cursor-pointer ${imgScale <= 1 ? 'text-slate-500 cursor-not-allowed' : 'text-white hover:bg-white/20'}`} disabled={imgScale <= 1}>
              <ZoomOut size={24} />
            </button>
            <span className="text-white font-black text-sm w-12 text-center">{Math.round(imgScale * 100)}%</span>
            <button onClick={() => setImgScale(prev => Math.min(4, prev + 0.5))} className={`p-2 rounded-full transition-all cursor-pointer ${imgScale >= 4 ? 'text-slate-500 cursor-not-allowed' : 'text-white hover:bg-white/20'}`} disabled={imgScale >= 4}>
              <ZoomIn size={24} />
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}