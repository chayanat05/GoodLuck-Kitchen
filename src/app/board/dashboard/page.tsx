'use client'
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  TrendingUp, ShoppingBag, CheckCircle, Clock, 
  Download, Calendar, LayoutDashboard, Loader2, Users, X,
  MapPin as MapIcon, Image as ImageIcon, ClipboardCheck, ChevronLeft
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import Image from 'next/image';
import { useRouter } from "next/navigation";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e'];

// 🌟 ประกาศ Type ให้ชัดเจน (กำจัด any)
type DateFilterType = 'today' | '7days' | 'month' | 'all' | 'custom';

interface Order {
  id: string;
  order_number: string;
  job_type: string;
  status: string;
  total_price: number;
  created_at: string;
  is_archived: boolean;
  rider_name: string | null;
  menu?: string;
  details?: string;
  address?: string | null;
  payment_method?: string;
  image_url?: string | null;
}

interface RiderOption {
  username: string;
}

// 🌟 Custom Tooltip สำหรับกราฟให้ดูพรีเมียมขึ้น
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-xl shadow-xl border border-white/10 text-white">
        <p className="font-bold text-sm mb-1 text-slate-300">{label}</p>
        <p className="font-black text-lg text-blue-400">฿{payload[0].value?.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 🌟 State สำหรับฟิลเตอร์
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedRider, setSelectedRider] = useState<string>('all');

  // 🌟 State สำหรับ Modal ดูรายละเอียด
  const [selectedViewOrder, setSelectedViewOrder] = useState<Order | null>(null);
  const router = useRouter();

  // ดึงรายชื่อพนักงานทั้งหมดมาไว้ทำฟิลเตอร์
  useEffect(() => {
    const fetchRiders = async () => {
      const { data } = await supabase.from('profiles').select('username').in('role', ['rider', 'admin']);
      if (data) setRiders(data as RiderOption[]);
    };
    fetchRiders();
  }, []);

  // ดึงข้อมูลออเดอร์ตามฟิลเตอร์
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const fetchStats = async () => {
      setIsLoading(true);

      // 🌟 ดึงค่าเวลาตัดยอดจาก Database (ถ้ายังไม่ได้ตั้งค่า จะใช้เลข 4 (ตี 4) เป็นค่าเริ่มต้น)
      const { data: settings } = await supabase.from('store_settings').select('cut_off_hour').eq('id', 1).single();
      const CUT_OFF_HOUR = settings?.cut_off_hour ?? 4;

      let query = supabase.from('orders').select('id, order_number, job_type, status, total_price, created_at, is_archived, rider_name, menu, details, address, payment_method, image_url');

      const now = new Date();
      const startDate = new Date();

      if (dateFilter === 'today') {
        // ถ้าเวลาปัจจุบันยังไม่ถึงเวลาตัดยอด ให้ถือว่าเป็นกะของเมื่อวาน
        if (now.getHours() < CUT_OFF_HOUR) {
          startDate.setDate(now.getDate() - 1);
        }
        startDate.setHours(CUT_OFF_HOUR, 0, 0, 0);
        query = query.gte('created_at', startDate.toISOString());

      } else if (dateFilter === '7days') {
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(CUT_OFF_HOUR, 0, 0, 0);
        query = query.gte('created_at', startDate.toISOString());

      } else if (dateFilter === 'month') {
        startDate.setDate(1); 
        startDate.setHours(CUT_OFF_HOUR, 0, 0, 0);
        query = query.gte('created_at', startDate.toISOString());

      } else if (dateFilter === 'custom' && customStart && customEnd) {
        // คลุมตั้งแต่เวลาตัดยอดของวันเริ่ม ไปจนถึงก่อนเวลาตัดยอดของอีกวัน
        const start = new Date(customStart);
        start.setHours(CUT_OFF_HOUR, 0, 0, 0);
        
        const end = new Date(customEnd);
        end.setDate(end.getDate() + 1); 
        end.setHours(CUT_OFF_HOUR - 1, 59, 59, 999);

        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      if (selectedRider !== 'all') {
        query = query.eq('rider_name', selectedRider);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) console.error("Error fetching dashboard data:", error);
      if (data) setOrders(data as Order[]);
      setIsLoading(false);
    };

    // จะดึงข้อมูลก็ต่อเมื่อถ้าเลือก custom ต้องมีวันที่ครบ หรือเป็นฟิลเตอร์อื่น
    if (dateFilter !== 'custom' || (dateFilter === 'custom' && customStart && customEnd)) {
      fetchStats();
    } else {
      timeoutId = setTimeout(() => setIsLoading(false), 0); // รอให้ผู้ใช้ใส่วันที่
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [dateFilter, customStart, customEnd, selectedRider]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const successOrders = orders.filter(o => o.status === 'ส่งแล้ว/เสร็จ');
    const pendingOrders = orders.filter(o => o.status !== 'ส่งแล้ว/เสร็จ');
    const totalRevenue = successOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    
    const revenueByDate: Record<string, number> = {};
    successOrders.forEach(o => {
      const dateStr = new Date(o.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      revenueByDate[dateStr] = (revenueByDate[dateStr] || 0) + (o.total_price || 0);
    });
    const barChartData = Object.keys(revenueByDate).map(date => ({ date, revenue: revenueByDate[date] })).reverse();

    const typeCount: Record<string, number> = {};
    orders.forEach(o => {
      typeCount[o.job_type] = (typeCount[o.job_type] || 0) + 1;
    });
    const pieChartData = Object.keys(typeCount).map(type => ({ name: type, value: typeCount[type] }));

    return { totalOrders, successCount: successOrders.length, pendingCount: pendingOrders.length, totalRevenue, barChartData, pieChartData };
  }, [orders]);

  const exportToCSV = () => {
    if (orders.length === 0) return alert('ไม่มีข้อมูลให้ Export');
    const headers = ['เลขที่ออเดอร์', 'ประเภทงาน', 'สถานะ', 'ยอดเรียกเก็บ', 'พนักงานรับงาน', 'วันที่สร้าง'];
    const csvContent = [
      headers.join(','),
      ...orders.map(o => `"${o.order_number}","${o.job_type}","${o.status}","${o.total_price}","${o.rider_name || 'ไม่มี'}","${new Date(o.created_at).toLocaleString('th-TH')}"`)
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `report_${dateFilter}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl space-y-6">
        
        {/* Header & Filter */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-5 rounded-3xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <button 
        onClick={() => router.back()} 
        className="flex items-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer active:scale-95"
      >
        <ChevronLeft size={20} className="mr-1" /> ย้อนกลับ
      </button>
            <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <LayoutDashboard className="text-blue-600" /> สถิติร้าน (Dashboard)
              </h1>
              <p className="text-sm text-slate-500 font-medium">ภาพรวมยอดขายและการทำงานของระบบ</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* กรองตามพนักงาน */}
            <div className="relative flex-1 md:flex-none min-w-37.5">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select 
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 cursor-pointer appearance-none"
                value={selectedRider}
                onChange={(e) => setSelectedRider(e.target.value)}
              >
                <option value="all">พนักงานทั้งหมด</option>
                {riders.map((r, idx) => (
                  <option key={idx} value={r.username}>{r.username}</option>
                ))}
              </select>
            </div>

            {/* กรองวันที่ */}
            <div className="relative flex-1 md:flex-none min-w-37.5">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select 
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 cursor-pointer appearance-none"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
              >
                <option value="today">วันนี้</option>
                <option value="7days">ย้อนหลัง 7 วัน</option>
                <option value="month">เดือนนี้</option>
                <option value="all">ทั้งหมด (All Time)</option>
                <option value="custom">กำหนดเอง...</option>
              </select>
            </div>

            {/* ถ้าเลือก Custom ให้โชว์ Input วันที่ */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 flex-1 md:flex-none animate-in fade-in slide-in-from-left-5">
                <span className="text-sm font-bold text-slate-500">จากวันที่</span>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10" />
                <span className="text-sm font-bold text-slate-500 ml-1">ถึงวันที่</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10" />
              </div>
            )}

            <button onClick={exportToCSV} className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-blue-600 transition-all flex items-center justify-center shadow-lg active:scale-95 cursor-pointer">
              <Download size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <Loader2 size={40} className="animate-spin text-blue-500" />
            <p className="font-bold tracking-widest animate-pulse">กำลังประมวลผลข้อมูล...</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">ยอดขายสำเร็จ</h3>
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
                  </div>
                  <div className="text-3xl font-black text-slate-800">฿{stats.totalRevenue.toLocaleString()}</div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">ออเดอร์ทั้งหมด</h3>
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><ShoppingBag size={20} /></div>
                  </div>
                  <div className="text-3xl font-black text-slate-800">{stats.totalOrders} <span className="text-sm text-slate-400 font-medium">รายการ</span></div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">จัดส่งสำเร็จ</h3>
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><CheckCircle size={20} /></div>
                  </div>
                  <div className="text-3xl font-black text-slate-800">{stats.successCount} <span className="text-sm text-slate-400 font-medium">รายการ</span></div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">กำลังดำเนินการ</h3>
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Clock size={20} /></div>
                  </div>
                  <div className="text-3xl font-black text-slate-800">{stats.pendingCount} <span className="text-sm text-slate-400 font-medium">รายการ</span></div>
                </div>
              </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Bar Chart: ยอดขาย (มีลูกเล่น Gradient) */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
                <h3 className="text-lg font-black text-slate-800 mb-6">📈 แนวโน้มยอดขาย (สำเร็จ)</h3>
                <div className="h-75 w-full">
                  {stats.barChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                        <Bar dataKey="revenue" fill="url(#colorRevenue)" radius={[8, 8, 0, 0]} animationDuration={1500} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">ไม่มีข้อมูลยอดขายในฟิลเตอร์นี้</div>
                  )}
                </div>
              </div>

              {/* Pie Chart */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-black text-slate-800 mb-6">📊 สัดส่วนออเดอร์</h3>
                <div className="h-75 w-full">
                  {stats.pieChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.pieChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" animationDuration={1500}>
                          {stats.pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity outline-none" />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">ไม่มีข้อมูลออเดอร์ในฟิลเตอร์นี้</div>
                  )}
                </div>
              </div>

            </div>

            {/* 🌟 Recent Orders Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-800">📋 ออเดอร์ล่าสุด</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="p-4 font-black">เลขที่ออเดอร์</th>
                      <th className="p-4 font-black">พนักงาน</th>
                      <th className="p-4 font-black">ประเภท</th>
                      <th className="p-4 font-black">ยอดเงิน</th>
                      <th className="p-4 font-black">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {orders.slice(0, 15).map((order) => (
                      <tr 
                        key={order.id} 
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedViewOrder(order)}
                      >
                        <td className="p-4 font-black text-slate-800">{order.order_number}</td>
                        <td className="p-4 font-bold text-slate-600">{order.rider_name || '-'}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                            {order.job_type}
                          </span>
                        </td>
                        <td className="p-4 font-black text-blue-600">฿{order.total_price.toLocaleString()}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                            order.status === 'ส่งแล้ว/เสร็จ' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            order.status === 'New' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            'bg-amber-100 text-amber-700 border-amber-200'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">ไม่มีข้อมูลในระบบ</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 🌟 Modal ดูรายละเอียดออเดอร์ (แบบเดียวกับหน้า Board แต่ดึงมาเฉพาะส่วนที่ให้ดูอย่างเดียว) */}
            {selectedViewOrder && (
              <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm" style={{ zIndex: 200 }}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col" style={{ maxHeight: '85vh' }}>
                  <div className="flex justify-between items-center p-5 md:p-6 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
                    <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight flex items-center"><ClipboardCheck size={20} className="mr-2 text-blue-600"/> รายละเอียดออเดอร์</h3>
                    <button type="button" onClick={() => setSelectedViewOrder(null)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all cursor-pointer hover:rotate-90 duration-300 active:scale-90"><X size={20} strokeWidth={3}/></button>
                  </div>
                  
                  <div className="p-5 md:p-6 space-y-5 overflow-y-auto bg-slate-50/30 thin-scrollbar">
                    <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                      <div>
                        <div className="text-[10px] font-black text-slate-400 mb-1 tracking-wider uppercase">เลขที่ออเดอร์</div>
                        <div className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter">{selectedViewOrder.order_number}</div>
                      </div>
                      <div className="text-right mb-1">
                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg shadow-sm border ${selectedViewOrder.status === 'New' ? 'bg-blue-100 text-blue-800 border-blue-300' : selectedViewOrder.status === 'กำลังทำ' ? 'bg-amber-100 text-amber-800 border-amber-300' : selectedViewOrder.status === 'รับงาน' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
                          {selectedViewOrder.status}
                        </span>
                      </div>
                    </div>

                    {selectedViewOrder.image_url && (
                      <div className="space-y-2">
                        <div className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center"><ImageIcon size={14} className="mr-1.5" /> รูปภาพแนบ (สลิป/หลักฐาน)</div>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedViewOrder.image_url.split(',').filter(Boolean).map((imgUrl, i) => (
                            <a key={i} href={imgUrl} target="_blank" rel="noopener noreferrer" className="block relative h-28 md:h-32 rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:opacity-80 transition-opacity cursor-pointer">
                              <Image src={imgUrl} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" alt={`img-${i}`} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedViewOrder.menu && (
                      <div className="space-y-2">
                        <div className="text-xs font-black text-slate-400 uppercase tracking-wider">รายการที่สั่ง</div>
                        <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-sm text-slate-700 font-bold whitespace-pre-line leading-relaxed shadow-inner">
                          {selectedViewOrder.menu}
                        </div>
                      </div>
                    )}

                    {selectedViewOrder.details && (
                      <div className="space-y-2">
                        <div className="text-xs font-black text-slate-400 uppercase tracking-wider">หมายเหตุ (Note)</div>
                        <div className="p-4 bg-yellow-50/50 rounded-2xl border border-yellow-100/50 text-xs md:text-sm text-slate-600 font-medium whitespace-pre-line leading-relaxed">
                          {selectedViewOrder.details}
                        </div>
                      </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 text-sm shadow-sm">
                      <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">ผู้รับงาน:</span><span className="font-black text-indigo-600 px-2.5 py-1 bg-indigo-50 rounded-md border border-indigo-200">{selectedViewOrder.rider_name || 'ยังไม่มี'}</span></div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100"><span className="text-slate-500 font-medium">ประเภทงาน:</span><span className="font-black text-slate-700 uppercase px-2.5 py-1 bg-slate-50 rounded-md border border-slate-200">{selectedViewOrder.job_type}</span></div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100"><span className="text-slate-500 font-medium">ยอดเรียกเก็บ:</span><span className="font-black text-blue-600 text-lg">฿{selectedViewOrder.total_price || 0}</span></div>
                    </div>

                    {selectedViewOrder.address && (
                      <div className="space-y-2">
                        <div className="text-xs font-black text-slate-400 uppercase tracking-wider">สถานที่จัดส่ง</div>
                        <div className="flex items-start text-xs md:text-sm text-slate-700 bg-red-50/50 p-4 rounded-2xl border border-red-100 font-bold">
                          <MapIcon size={16} className="mr-2 mt-0.5 text-red-500 shrink-0" />
                          <span className="leading-relaxed">{selectedViewOrder.address}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}