'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { 
  ShoppingBag, ArrowLeft, Clock, CreditCard, Wallet, Award, 
  Filter, User as UserIcon, Tags, MapPinned, Route, Map as MapIcon,
  X, ClipboardList, ImageIcon, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut
} from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Order } from '../../../components/OrderCard';
import Image from 'next/image';

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'custom'; 

const SHOP_LAT = 16.2468;
const SHOP_LNG = 103.2520;

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
};

interface RiderPerformance {
  name: string;
  count: number;
  total: number;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  
  const [activeRange, setActiveRange] = useState<TimeRange>('daily'); 
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]); 
  
  const [selectedRider, setSelectedRider] = useState<string>('all'); 
  const [selectedJobType, setSelectedJobType] = useState<string>('all'); 
  
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [availableRiders, setAvailableRiders] = useState<string[]>([]);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [imageGallery, setImageGallery] = useState<{urls: string[], startIndex: number} | null>(null);
  const [imgScale, setImgScale] = useState(1);
  const galleryRef = useRef<HTMLDivElement>(null);

  const fetchOrdersData = useCallback(async (range: TimeRange, dateParam: string) => {
    setLoading(true);
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (range === 'daily') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (range === 'custom') {
      startDate = new Date(dateParam);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(dateParam);
      endDate.setHours(23, 59, 59, 999);
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString()) 
      .order('created_at', { ascending: false });

    if (orders) {
      const orderList = orders as Order[];
      setAllOrders(orderList);
      const riders = Array.from(new Set(orderList.map(o => o.rider_name).filter(Boolean))) as string[];
      setAvailableRiders(riders);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role !== 'admin') { window.location.href = '/rider'; return; }

      setCurrentUser(session.user);
      fetchOrdersData(activeRange, customDate);
    };

    checkAdmin();
    const channel = supabase.channel('dashboard-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { fetchOrdersData(activeRange, customDate); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRange, customDate, fetchOrdersData]);

  useEffect(() => {
    if (imageGallery && galleryRef.current) {
      const target = galleryRef.current.children[imageGallery.startIndex] as HTMLElement;
      if (target) {
        galleryRef.current.scrollLeft = target.offsetLeft;
      }
    }
  }, [imageGallery]);

  const scrollGallery = (direction: 'left' | 'right') => {
    setImgScale(1);
    if (galleryRef.current) {
      const { clientWidth } = galleryRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth : clientWidth;
      galleryRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const calculateTotalDistanceByRounds = (ordersToCalc: Order[]): string => {
    const riderGroups = ordersToCalc.reduce((acc, order) => {
      if (!order.rider_id) return acc;
      if (!acc[order.rider_id]) acc[order.rider_id] = [];
      acc[order.rider_id].push(order);
      return acc;
    }, {} as Record<string, Order[]>);

    let totalDist = 0;

    Object.values(riderGroups).forEach(riderOrders => {
      const validOrders = riderOrders.filter(o => o.status === 'ส่งแล้ว/เสร็จ' && o.lat && o.lng && o.start_time && o.end_time);
      validOrders.sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());

      const rounds: Order[][] = [];
      let currentRound: Order[] = [];
      let currentRoundEndTime = 0;

      for (const order of validOrders) {
        const startTime = new Date(order.start_time!).getTime();
        const endTime = new Date(order.end_time!).getTime();

        if (currentRound.length === 0) {
          currentRound.push(order);
          currentRoundEndTime = endTime;
        } else {
          if (startTime > currentRoundEndTime) {
            rounds.push([...currentRound]);
            currentRound = [order];
            currentRoundEndTime = endTime;
          } else {
            currentRound.push(order);
            currentRoundEndTime = Math.max(currentRoundEndTime, endTime);
          }
        }
      }
      if (currentRound.length > 0) rounds.push(currentRound);

      rounds.forEach(round => {
        round.sort((a, b) => new Date(a.end_time!).getTime() - new Date(b.end_time!).getTime());
        let currentLat = SHOP_LAT; 
        let currentLng = SHOP_LNG;

        round.forEach(order => {
          totalDist += calculateDistance(currentLat, currentLng, order.lat!, order.lng!);
          currentLat = order.lat!;
          currentLng = order.lng!;
        });
        totalDist += calculateDistance(currentLat, currentLng, SHOP_LAT, SHOP_LNG);
      });
    });

    return totalDist.toFixed(1);
  };

  const { stats, riderLeaderboard, filteredCompletedOrders } = useMemo(() => {
    if (allOrders.length === 0) {
      return { stats: { totalRevenue: 0, cashTotal: 0, transferTotal: 0, totalOrders: 0, completedOrders: 0, activeRiders: 0, totalDistance: '0.0' }, riderLeaderboard: [], filteredCompletedOrders: [] };
    }

    const filteredOrders = allOrders.filter(o => {
      const matchRider = selectedRider === 'all' || o.rider_name === selectedRider;
      const matchJobType = selectedJobType === 'all' || o.job_type === selectedJobType;
      return matchRider && matchJobType;
    });

    const completed = filteredOrders.filter(o => o.status === 'ส่งแล้ว/เสร็จ');
    
    const revenue = completed.reduce((sum, o) => sum + (o.total_price || 0), 0);
    const cash = completed.filter(o => o.payment_method !== 'โอน').reduce((sum, o) => sum + (o.total_price || 0), 0);
    const transfer = completed.filter(o => o.payment_method === 'โอน').reduce((sum, o) => sum + (o.total_price || 0), 0);

    const calculatedDistance = calculateTotalDistanceByRounds(filteredOrders);

    const newStats = {
      totalRevenue: revenue,
      cashTotal: cash,
      transferTotal: transfer,
      totalOrders: filteredOrders.length,
      completedOrders: completed.length,
      activeRiders: selectedRider === 'all' ? new Set(filteredOrders.filter(o => o.rider_id).map(o => o.rider_id)).size : 1,
      totalDistance: calculatedDistance
    };

    const riderMap = new Map<string, RiderPerformance>();
    completed.forEach(o => {
      if (o.rider_name) {
        const current = riderMap.get(o.rider_name) || { name: o.rider_name, count: 0, total: 0 };
        current.count += 1;
        current.total += o.total_price || 0;
        riderMap.set(o.rider_name, current);
      }
    });
    
    const newLeaderboard = Array.from(riderMap.values()).sort((a, b) => b.count - a.count);
    const newFilteredCompletedOrders = completed.sort((a, b) => new Date(b.end_time!).getTime() - new Date(a.end_time!).getTime());

    return { stats: newStats, riderLeaderboard: newLeaderboard, filteredCompletedOrders: newFilteredCompletedOrders };
  }, [allOrders, selectedRider, selectedJobType]);

  const handleExportCSV = () => {
    if (filteredCompletedOrders.length === 0) {
      alert('ไม่มีข้อมูลให้ดาวน์โหลดครับ');
      return;
    }

    const headers = ['รหัสบิล', 'วันที่', 'เวลาเริ่มงาน', 'เวลาส่งเสร็จ', 'ประเภทงาน', 'ไรเดอร์', 'รายการอาหาร/เมนู', 'รายละเอียด(Note)', 'สถานที่จัดส่ง', 'ยอดเรียกเก็บ(บาท)', 'ช่องทางชำระ', 'สถานะ'];
    
    const escapeCSV = (str: string | undefined | null) => {
      if (!str) return '""';
      return `"${str.toString().replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    };

    const rows = filteredCompletedOrders.map(order => {
      const date = order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH') : '-';
      const startTime = order.start_time ? new Date(order.start_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';
      const endTime = order.end_time ? new Date(order.end_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';

      return [
        escapeCSV(order.order_number),
        escapeCSV(date),
        escapeCSV(startTime),
        escapeCSV(endTime),
        escapeCSV(order.job_type),
        escapeCSV(order.rider_name || '-'),
        escapeCSV(order.menu),
        escapeCSV(order.details),
        escapeCSV(order.address),
        order.total_price || 0,
        escapeCSV(order.payment_method || 'เงินสด'),
        escapeCSV(order.status)
      ].join(',');
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const todayStr = new Date().toLocaleDateString('th-TH').replace(/\//g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `รายงานยอดขาย_และ_ประวัติการวิ่ง_${todayStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !currentUser && allOrders.length === 0) return (
    <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div></div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link href="/board" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">สรุปภาพรวมระบบ</h1>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-3 w-full md:w-auto">
            
            <div className="flex flex-col sm:flex-row bg-gray-100 p-1 rounded-xl w-full lg:w-auto border border-gray-200 gap-1">
              <div className="flex flex-1">
                {[
                  { key: 'daily', label: 'รายวัน' },
                  { key: 'weekly', label: 'รายสัปดาห์' },
                  { key: 'monthly', label: 'รายเดือน' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveRange(tab.key as TimeRange)}
                    className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${
                      activeRange === tab.key ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200/50">
                <input 
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setActiveRange('custom'); 
                  }}
                  className={`px-3 py-1.5 text-sm font-bold rounded-lg outline-none transition-all duration-300 cursor-pointer ${
                    activeRange === 'custom' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'bg-transparent text-gray-500 hover:bg-gray-200'
                  }`}
                />
              </div>
            </div>

            <div className="flex w-full lg:w-auto gap-3">
              <div className="relative group flex-1 lg:flex-none">
                <div className="flex items-center bg-white text-gray-700 px-3 py-2 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors shadow-sm">
                  <Tags size={16} className="mr-2 text-gray-400" />
                  <select 
                    value={selectedJobType}
                    onChange={(e) => setSelectedJobType(e.target.value)}
                    className="bg-transparent text-sm font-bold outline-none cursor-pointer appearance-none w-full"
                  >
                    <option value="all">ทุกประเภทงาน</option>
                    <option value="ร้าน">งานร้าน</option>
                    <option value="รับหิ้ว">รับหิ้ว</option>
                    <option value="รับส่ง">รับส่ง</option>
                    <option value="shopee">Shopee</option>
                  </select>
                </div>
              </div>

              <div className="relative group flex-1 lg:flex-none">
                <div className="flex items-center bg-blue-50 text-blue-700 px-3 py-2 rounded-xl border border-blue-200 hover:border-blue-300 transition-colors shadow-sm">
                  <UserIcon size={16} className="mr-2 text-blue-500" />
                  <select 
                    value={selectedRider}
                    onChange={(e) => setSelectedRider(e.target.value)}
                    className="bg-transparent text-sm font-bold outline-none cursor-pointer appearance-none w-full"
                  >
                    <option value="all">ไรเดอร์ทุกคน</option>
                    {availableRiders.map((name, idx) => (
                      <option key={idx} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-gray-500 text-sm bg-indigo-50 w-fit px-4 py-2 rounded-full border border-indigo-100 font-medium">
            <Filter size={14} className="text-indigo-500" />
            กรองข้อมูล: 
            <span className="text-indigo-700 font-bold bg-white rounded-md px-2 py-0.5 shadow-sm">
              {activeRange === 'daily' ? 'วันนี้' : activeRange === 'weekly' ? 'สัปดาห์นี้' : activeRange === 'monthly' ? 'เดือนนี้' : `วันที่ ${new Date(customDate).toLocaleDateString('th-TH')}`}
            </span>
            <span className="text-gray-400">•</span>
            <span className="text-indigo-700 font-bold bg-white rounded-md px-2 py-0.5 shadow-sm uppercase">{selectedJobType === 'all' ? 'ทุกประเภท' : selectedJobType}</span>
            <span className="text-gray-400">•</span>
            <span className="text-indigo-700 font-bold bg-white rounded-md px-2 py-0.5 shadow-sm uppercase">{selectedRider === 'all' ? 'ไรเดอร์ทุกคน' : selectedRider}</span>
          </div>

          <button 
            onClick={handleExportCSV}
            disabled={filteredCompletedOrders.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-green-600/30 hover:-translate-y-0.5 cursor-pointer"
          >
            <Download size={18} />
            ดาวน์โหลดรายงาน (CSV)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-linear-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 bg-white/10 w-24 h-24 rounded-full blur-2xl"></div>
            <div className="relative z-10">
              <p className="text-blue-100 font-medium mb-1 text-sm">ยอดขายรวมที่กรองได้</p>
              <h2 className="text-3xl font-black mb-1">฿{stats.totalRevenue.toLocaleString()}</h2>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 text-green-600 p-2 rounded-xl"><Wallet size={20} /></div>
              <p className="text-gray-500 text-sm font-medium">เงินสด (รับจริง)</p>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">฿{stats.cashTotal.toLocaleString()}</h2>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-purple-100 text-purple-600 p-2 rounded-xl"><CreditCard size={20} /></div>
              <p className="text-gray-500 text-sm font-medium">ยอดโอน (ในบัญชี)</p>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">฿{stats.transferTotal.toLocaleString()}</h2>
          </div>

          <div className="bg-linear-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full"></div>
            <div className="relative z-10 flex flex-col justify-center h-full">
              <div className="flex items-center gap-2 text-emerald-100 text-sm font-medium mb-1">
                <Route size={16} /> ระยะทางวิ่งรอบ (ไป-กลับ)
              </div>
              <h2 className="text-3xl font-black">{stats.totalDistance} <span className="text-lg font-bold text-emerald-200">กม.</span></h2>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 px-1">
              <Award className="text-yellow-500" size={20} /> สถิติผลงานไรเดอร์
            </h3>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              {riderLeaderboard.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm italic">ไม่มีข้อมูลตรงกับตัวกรอง</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {riderLeaderboard.map((rider, index) => (
                    <div key={index} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 && selectedRider === 'all' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 uppercase text-sm">{rider.name}</p>
                          <p className="text-xs text-gray-400">{rider.count} งานสำเร็จ</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600">฿{rider.total.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
              <ShoppingBag className="mx-auto mb-2 text-blue-500" size={24} />
              <p className="text-2xl font-black text-gray-800">{stats.completedOrders} <span className="text-sm font-medium text-gray-400">/ {stats.totalOrders}</span></p>
              <p className="text-xs font-bold text-gray-400 uppercase mt-1">งานสำเร็จ / งานทั้งหมด</p>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <MapPinned className="text-red-500" size={20} /> ประวัติสถานที่จัดส่ง
              </h3>
            </div>
            
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              {filteredCompletedOrders.length === 0 ? (
                <div className="p-12 text-center text-gray-400 italic">
                  ไม่มีประวัติการส่งงานตามที่กรองไว้
                </div>
              ) : (
                <div className="divide-y divide-gray-100 overflow-y-auto" style={{ maxHeight: '400px' }}>
                  {filteredCompletedOrders.map((order, idx) => (
                    <div 
                      key={order.id} 
                      onClick={() => setSelectedOrder(order)}
                      className="p-5 hover:bg-blue-50/50 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-1 w-8 h-8 rounded-full bg-gray-100 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                          {filteredCompletedOrders.length - idx}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{order.order_number}</span>
                            <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                              📅 {new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded uppercase">{order.job_type}</span>
                            {selectedRider === 'all' && (
                              <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded uppercase">👤 {order.rider_name}</span>
                            )}
                          </div>
                          
                          <p className="text-sm font-medium text-gray-700 flex items-start gap-1">
                            <MapIcon size={14} className="mt-0.5 text-red-400 shrink-0" /> 
                            {order.address || 'ไม่ได้ระบุสถานที่'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 flex items-center">
                            <Clock size={12} className="mr-1" />
                            รับงาน: {order.start_time ? new Date(order.start_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                            <span className="mx-2">➔</span>
                            ปิดจบ: <span className="font-medium text-green-600 ml-1">{order.end_time ? new Date(order.end_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right pl-12 sm:pl-0">
                        <p className="text-base font-black text-gray-900">฿{order.total_price}</p>
                        <p className={`text-xs font-black uppercase tracking-widest ${
                          order.payment_method === 'โอน' ? 'text-blue-500' : 'text-green-600'
                        }`}>
                          {order.payment_method || 'เงินสด'}
                        </p>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 100 }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col" style={{ maxHeight: '90vh' }}>
            
            <div className="bg-blue-600 p-5 flex justify-between items-center text-white shrink-0">
              <h3 className="font-bold flex items-center text-lg"><ClipboardList size={20} className="mr-2"/> รายละเอียดบิล</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 bg-blue-700/50 hover:bg-blue-700 rounded-full transition-all cursor-pointer hover:rotate-90 duration-300"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="flex justify-between items-end border-b border-gray-100 pb-4">
                <div>
                  <div className="text-xs font-bold text-gray-400 mb-1 tracking-wide uppercase">
                    เลขที่ออเดอร์ • {new Date(selectedOrder.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-2xl font-black text-gray-900">{selectedOrder.order_number}</div>
                </div>
                <div className="text-right">
                  <span className="bg-green-100 text-green-700 text-xs font-black px-3 py-1.5 rounded-lg shadow-sm border border-green-200">{selectedOrder.status}</span>
                </div>
              </div>
              
              {/* รูปสลิป */}
              {selectedOrder.image_url && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-500 flex items-center">
                    <ImageIcon size={14} className="mr-1.5" /> รูปภาพแนบ / สลิป
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedOrder.image_url.split(',').filter(Boolean).map((imgUrl, i) => (
                      <div key={i} onClick={() => setImageGallery({ urls: selectedOrder.image_url!.split(',').filter(Boolean), startIndex: i })} className="h-32 rounded-2xl overflow-hidden border border-gray-200 cursor-pointer hover:shadow-md transition-shadow relative">
                        <Image
                          src={imgUrl}
                          alt="Detail"
                          className="w-full h-full object-cover"
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* เมนู */}
              {selectedOrder.menu && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-500">รายการเมนู</div>
                  <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 text-sm text-gray-800 font-bold whitespace-pre-line leading-relaxed shadow-inner">
                    {selectedOrder.menu}
                  </div>
                </div>
              )}

              {/* Details */}
              {selectedOrder.details && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-500">รายละเอียดเพิ่มเติม (Note)</div>
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                    {selectedOrder.details}
                  </div>
                </div>
              )}
              
              <div className="space-y-3 text-sm bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div className="flex justify-between items-center"><span className="text-gray-500 font-medium">ประเภทงาน:</span><span className="font-black text-gray-800 uppercase px-2 py-1 bg-white border border-gray-200 shadow-sm rounded-md">{selectedOrder.job_type}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-500 font-medium">ผู้รับผิดชอบ:</span><span className="font-black text-gray-800 bg-white border border-gray-200 shadow-sm px-2 py-1 rounded-md">{selectedOrder.rider_name || '-'}</span></div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200/60"><span className="text-gray-500 font-medium">ยอดเรียกเก็บ:</span><span className="font-black text-blue-600 text-lg">฿{selectedOrder.total_price}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-500 font-medium">การชำระเงิน:</span><span className={`font-black text-xs uppercase px-2 py-1 rounded-md ${selectedOrder.payment_method === 'โอน' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-600'}`}>{selectedOrder.payment_method || 'เงินสด'}</span></div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-500">สถานที่จัดส่ง</div>
                <div className="text-sm font-bold text-gray-800 leading-relaxed bg-white border border-gray-200 p-3 rounded-xl shadow-sm">
                  {selectedOrder.address || '-'}
                </div>
              </div>

            </div>
            
            <div className="p-5 pt-0 shrink-0 bg-white">
              <button onClick={() => setSelectedOrder(null)} className="w-full py-3.5 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-800 transition-all cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-300">
                ปิดหน้าต่าง
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Image Gallery Modal */}
      {imageGallery && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200" onClick={() => { setImageGallery(null); setImgScale(1); }} style={{ zIndex: 300 }}>
          <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-50 text-white pointer-events-none">
            <span className="font-bold text-xs bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm">คลิก 2 ครั้งเพื่อซูม / ใช้ปุ่มลูกศรเลื่อน</span>
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
          
          <div 
            ref={galleryRef}
            className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
          >
            {imageGallery.urls.map((url, i) => (
              <div 
                key={i} 
                className={`w-full h-full shrink-0 snap-center p-2 overflow-auto flex ${imgScale > 1 ? 'items-start justify-start' : 'items-center justify-center'}`} 
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={url} 
                  className={`transition-all duration-300 origin-center cursor-zoom-in ${imgScale > 1 ? 'm-auto' : ''}`}
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
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

    </div>
  );
}