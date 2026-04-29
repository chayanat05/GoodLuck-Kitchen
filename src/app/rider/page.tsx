//riderpage
'use client'
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  MapPin, CheckCircle2, Clock, Map as MapIcon, 
  X, History, ClipboardList, Zap, AlertTriangle, 
  Info, Menu, LayoutDashboard, LogOut, PackageCheck, ChefHat,
  MapPinned, Eye, Image as ImageIcon, ChevronLeft, ChevronRight, ZoomIn, ZoomOut
} from 'lucide-react';
import { Order } from '../../components/OrderCard';
import { User as SupabaseUser } from '@supabase/supabase-js';
import DashboardView from './DashboardView'; 
import Image from 'next/image';

type PopupConfig = { isOpen: boolean; type: 'alert' | 'confirm'; title: string; message: string; confirmText?: string; cancelText?: string; onConfirm?: () => void; icon?: 'success' | 'error' | 'warning' | 'info'; };

export default function RiderPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState<boolean | null>(null);
  
  const [activeTab, setActiveTab] = useState<'available' | 'jobs' | 'history'>('available');
  const [selectedViewOrder, setSelectedViewOrder] = useState<Order | null>(null);
  
  const [imageGallery, setImageGallery] = useState<{urls: string[], startIndex: number} | null>(null);
  const [imgScale, setImgScale] = useState(1);
  const galleryRef = useRef<HTMLDivElement>(null);

  const [popup, setPopup] = useState<PopupConfig>({ isOpen: false, type: 'alert', title: '', message: '' });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [riderName, setRiderName] = useState<string>('กำลังโหลด...');
  
  const lastGpsUpdateRef = useRef<number>(0);

  const showAlert = (title: string, message: string, icon: 'success' | 'error' | 'warning' | 'info' = 'info') => setPopup({ isOpen: true, type: 'alert', title, message, icon });
  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') => setPopup({ isOpen: true, type: 'confirm', title, message, onConfirm, confirmText, cancelText, icon: 'warning' });
  const closePopup = () => setPopup(prev => ({ ...prev, isOpen: false }));

  const fetchOrders = async (userId: string) => {
    if (!userId) return;
    const { data: myJobs, error: err1 } = await supabase.from('orders').select('*').eq('rider_id', userId).order('created_at', { ascending: false });
    if (err1) console.error("Error fetching my jobs:", err1);
    
    const { data: availableJobs, error: err2 } = await supabase.from('orders')
      .select('*')
      .is('rider_id', null)
      .or('job_type.is.null,job_type.neq.shopee')
      .in('status', ['New', 'กำลังทำ', 'รับงาน']) 
      .order('created_at', { ascending: false });
    if (err2) console.error("Error fetching available jobs:", err2);
    
    const jobs1 = availableJobs || [];
    const jobs2 = myJobs || [];
    
    const combined = [...jobs1, ...jobs2];
    const uniqueOrders = Array.from(new Map(combined.map(item => [item.id, item])).values());
    setOrders(uniqueOrders as Order[]);
  };

  useEffect(() => {
    let currentUserId = '';
    const checkAuthAndInit = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }

      const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).single();
      setCurrentUser(session.user);
      currentUserId = session.user.id;
      setRiderName(profile?.username || 'ไรเดอร์');

      fetchOrders(currentUserId);
    };

    checkAuthAndInit();
    const riderChannel = supabase.channel('public:orders:rider').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { if (currentUserId) fetchOrders(currentUserId); }).subscribe();
    
    return () => { supabase.removeChannel(riderChannel); };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    if (!navigator.geolocation) {
      setTimeout(() => {
        setGpsEnabled(false);
        setLocationError('เบราว์เซอร์ไม่รองรับ GPS');
      }, 0);
      return;
    }
    
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        setGpsEnabled(true);
        setLocationError(null);
        setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        
        const now = Date.now();
        if (now - lastGpsUpdateRef.current > 30000) { 
          lastGpsUpdateRef.current = now; 
          await supabase.from('profiles').update({
            last_lat: position.coords.latitude,
            last_lng: position.coords.longitude,
            last_seen: new Date().toISOString()
          }).eq('id', currentUser.id);
        }
      },
      (error) => {
        console.error("GPS Error:", error);
        setGpsEnabled(false); 
        setLocationError('กรุณาเปิด GPS');
      }, 
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 } 
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentUser]);

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

  const handleTakeJob = async (orderId: string) => {
    if (!currentUser) return;
    const { data } = await supabase.from('orders').update({ rider_id: currentUser.id, rider_name: riderName, start_time: new Date().toISOString() }).eq('id', orderId).is('rider_id', null).select();
    if (data && data.length > 0) {
      showAlert("จองงานสำเร็จ!", "งานอยู่ในความดูแลของคุณแล้วครับ 🎉", "success"); 
      fetchOrders(currentUser.id);
    } else {
      showAlert("อ๊ะ!", "งานนี้มีเพื่อนไรเดอร์ท่านอื่นกดรับไปก่อนแล้วครับ 😢", "error");
      fetchOrders(currentUser.id); 
    }
  };

  const handleRiderAction = async (order: Order) => {
    let nextStatus = '';
    let confirmMsg = '';
    const isCustomJob = order.job_type === 'รับหิ้ว' || order.job_type === 'รับส่ง';

    if (isCustomJob) {
      if (order.status === 'New') {
        nextStatus = 'กำลังทำ'; confirmMsg = 'เริ่มเดินทางไปทำธุระให้ลูกค้าใช่ไหม?';
      } else if (order.status === 'กำลังทำ') {
        nextStatus = 'รับงาน'; confirmMsg = 'คุณจัดการธุระเสร็จสิ้นแล้วและกำลังเดินทางไปส่งใช่ไหม?';
      } else if (order.status === 'รับงาน') {
        nextStatus = 'ส่งแล้ว/เสร็จ'; confirmMsg = 'คุณได้ส่งของให้ลูกค้าเรียบร้อยแล้วใช่ไหม? (ตรวจสอบยอดเงินด้วยนะ)';
      }
    } else { 
      if (order.status === 'รับงาน') {
        nextStatus = 'ส่งแล้ว/เสร็จ'; confirmMsg = 'ส่งอาหารให้ลูกค้าเรียบร้อยแล้วใช่ไหม? (ตรวจสอบยอดเงินด้วยนะ)';
      }
    }

    if (!nextStatus) return; 

    showConfirm('ยืนยันการดำเนินการ', confirmMsg, async () => {
      closePopup();
      const updateData: { status: string; end_time?: string } = { status: nextStatus };
      if (nextStatus === 'ส่งแล้ว/เสร็จ') updateData.end_time = new Date().toISOString();
      const { error } = await supabase.from('orders').update(updateData).eq('id', order.id);
      if (error) showAlert('เกิดข้อผิดพลาด', 'อัปเดตไม่สำเร็จ', 'error');
      else fetchOrders(currentUser!.id);
    }, 'ยืนยัน', 'ยกเลิก');
  };

  const handleDropJob = async (orderId: string) => {
    if (!currentUser) return;
    showConfirm('คืนงานใช่ไหม?', 'งานนี้จะถูกปลดล็อกให้ไรเดอร์ท่านอื่นสามารถแย่งรับได้นะครับ', async () => {
      closePopup();
      const { error } = await supabase.from('orders').update({ rider_id: null, rider_name: null, start_time: null }).eq('id', orderId);
      if (error) showAlert('เกิดข้อผิดพลาด', 'ไม่สามารถคืนงานได้', 'error');
      else { showAlert('เรียบร้อย!', 'คืนงานให้ระบบกลางแล้ว', 'success'); setActiveTab('available'); fetchOrders(currentUser.id); }
    }, 'คืนงาน', 'ยกเลิก');
  };

  const calculateRoute = (order: Order) => {
    if (!myLocation) { showAlert('รอก่อนนะ', 'กำลังหาตำแหน่งของคุณอยู่ครับ 📡', 'warning'); return; }
    if (!order.lat || !order.lng) { showAlert('ขออภัย', 'ออเดอร์นี้แอดมินไม่ได้ปักพิกัดไว้ครับ', 'error'); return; }
    // 🌟 แก้ไข URL ตรงบรรทัดนี้ครับ เปลี่ยนให้เป็นลิงก์ของ Google Maps โดยตรง
    const url = `https://www.google.com/maps/dir/?api=1&origin=${myLocation.lat},${myLocation.lng}&destination=${order.lat},${order.lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const handleLogout = () => {
    showConfirm('ออกจากระบบ?', 'คุณต้องการออกจากระบบใช่หรือไม่?', async () => {
      closePopup(); await supabase.auth.signOut(); window.location.href = '/login';
    }, 'ออกจากระบบ', 'ยกเลิก');
  };

  const availableOrders = orders.filter(o => !o.rider_id && ['New', 'กำลังทำ', 'รับงาน'].includes(o.status));
  const activeOrders = orders.filter(o => o.rider_id === currentUser?.id && o.status !== 'ส่งแล้ว/เสร็จ');
  const completedOrders = orders.filter(o => o.rider_id === currentUser?.id && o.status === 'ส่งแล้ว/เสร็จ');

  const getRiderStatusDisplay = (status: string) => {
    if (status === 'New') return { text: 'ออเดอร์เข้าใหม่ (ครัวยังไม่ทำ)', color: 'bg-blue-50 text-blue-600 border-blue-200' };
    if (status === 'กำลังทำ') return { text: 'ครัวกำลังทำอาหาร', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <ChefHat size={12} className="mr-1" /> };
    if (status === 'รับงาน') return { text: 'ของเสร็จแล้ว! ไปรับได้เลย', color: 'bg-green-50 text-green-600 border-green-200 shadow-sm animate-pulse', icon: <PackageCheck size={12} className="mr-1" /> };
    return { text: status, color: 'bg-gray-50 text-gray-600 border-gray-200' };
  };

  const renderPopupIcon = (type: string) => {
    switch (type) {
      case 'success': return <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4 animate-in zoom-in duration-300"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>;
      case 'error': return <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4 animate-in zoom-in duration-300"><X className="h-8 w-8 text-red-600" /></div>;
      case 'warning': return <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4 animate-in zoom-in duration-300"><AlertTriangle className="h-8 w-8 text-yellow-600" /></div>;
      default: return <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4 animate-in zoom-in duration-300"><Info className="h-8 w-8 text-blue-600" /></div>;
    }
  };

  const renderThumbnail = (order: Order) => {
    const images = order.image_url ? order.image_url.split(',').filter(Boolean) : [];
    if (images.length === 0) return null;

    return (
      <div 
        onClick={(e) => { e.stopPropagation(); setImageGallery({ urls: images, startIndex: 0 }); }}
        className="mb-4 relative h-28 rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer group/img"
      >
        <Image
          src={images[0]}
          alt="Job"
          fill
          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, 33vw"
          priority
        />
        {images.length > 1 ? (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-white font-black text-lg flex items-center drop-shadow-md">
              <ImageIcon size={20} className="mr-2 opacity-80" /> +{images.length - 1}
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 bg-transparent group-hover/img:bg-slate-900/20 transition-colors flex items-center justify-center">
            <Eye className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity" size={24} />
          </div>
        )}
      </div>
    );
  };

  if (!currentUser) return (
    <div className="min-h-screen bg-blue-600 flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
      <h2 className="font-bold tracking-wider animate-pulse">กำลังเตรียมระบบ...</h2>
    </div>
  );

  if (gpsEnabled === false) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden text-white" style={{ zIndex: 50 }}>
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <div className="absolute w-64 h-64 border border-blue-400 rounded-full" style={{ animation: 'ping 3s ease-in-out infinite' }}></div>
          <div className="absolute w-96 h-96 border border-blue-400 rounded-full delay-700" style={{ animation: 'ping 3s ease-in-out infinite' }}></div>
        </div>
        <div className="relative z-10 bg-slate-800/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl max-w-sm w-full">
          <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl" style={{ animation: 'bounce 3s ease-in-out infinite' }}>
            <MapPinned size={40} />
          </div>
          <h1 className="text-2xl font-black mb-3">ระบบต้องการตำแหน่ง</h1>
          <p className="text-slate-400 font-medium mb-8 text-sm">{locationError || 'กรุณาเปิด GPS เพื่อเข้าใช้งานแอปไรเดอร์'}</p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl active:scale-95 cursor-pointer">รีเฟรชหน้าจอ</button>
        </div>
      </div>
    );
  }

  if (showDashboard) {
    return <DashboardView riderName={riderName} onBack={() => setShowDashboard(false)} activeOrdersCount={activeOrders.length} allCompletedOrders={completedOrders} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 font-sans">
      
      {/* Header */}
      <div className="bg-blue-600/90 backdrop-blur-md text-white p-4 shadow-lg sticky top-0 z-30 flex justify-between items-center border-b border-blue-500/50">
        <div className="flex items-center">
          <button onClick={() => setIsMenuOpen(true)} className="mr-3 p-2 hover:bg-white/10 rounded-xl active:scale-90 transition-all cursor-pointer"><Menu size={22} /></button>
          <div>
            <h1 className="text-lg font-black tracking-tight flex items-center drop-shadow-sm"><Zap className="mr-1.5 text-yellow-300 fill-yellow-300" size={18} /> RIDER APP</h1>
            <div className="text-xs text-blue-100 mt-0.5 flex items-center font-medium">
              {myLocation ? <span className="flex items-center text-emerald-300"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></div> GPS On</span> : <span className="opacity-70 animate-pulse">หาสัญญาณ...</span>}
            </div>
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur border border-white/20 px-3 py-1.5 rounded-full text-xs font-bold truncate max-w-xs shadow-inner">{riderName}</div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 max-w-2xl mx-auto">
        
        {/* Available Tab */}
        {activeTab === 'available' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="font-black text-slate-800 mb-5 text-lg">งานว่างล่าสุด <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-md">{availableOrders.length}</span></h2>
            {availableOrders.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4" style={{ animation: 'bounce 3s ease-in-out infinite' }}>
                  <PackageCheck size={48} className="text-slate-300" />
                </div>
                <p className="text-slate-600 font-bold mb-1">ยังไม่มีงานเข้ามาในขณะนี้</p>
                <p className="text-xs text-slate-400 font-medium">รอแอดมินจ่ายงานสักครู่นะครับ ☕</p>
              </div>
            ) : (
              availableOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-4 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group">
                  <div className="p-5 relative border-b border-slate-50">
                    <div className={`absolute top-0 left-0 w-full h-1 ${isCustomJob(order) ? 'bg-purple-400' : 'bg-blue-400'}`}></div>
                    <div className="flex justify-between items-center mb-3 mt-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xl text-slate-800 tracking-tight">{order.order_number}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedViewOrder(order); }}
                          className="bg-slate-50 text-slate-500 border border-slate-200 px-2 py-1 rounded-lg text-xs font-black flex items-center hover:bg-blue-50 active:scale-95 cursor-pointer shadow-sm"
                        >
                          <Eye size={12} className="mr-1" /> รายละเอียด
                        </button>
                      </div>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-lg uppercase border shadow-sm ${isCustomJob(order) ? 'bg-purple-50 text-purple-600 border-purple-100' : getRiderStatusDisplay(order.status).color}`}>
                        {order.job_type}
                      </span>
                    </div>
                    {renderThumbnail(order)}
                    {order.menu && <div className="mb-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-sm text-slate-700 font-bold whitespace-pre-line leading-relaxed">{order.menu}</div>}
                    <div className="text-sm text-slate-600 font-medium mb-4 flex items-start gap-2">
                      <div className={`mt-0.5 w-1.5 h-4 rounded-full shrink-0 ${isCustomJob(order) ? 'bg-purple-400' : 'bg-blue-400'}`}></div>
                      <span className="line-clamp-2">{order.details || 'ไม่มีรายละเอียดเพิ่มเติม'}</span>
                    </div>
                    {order.address && <div className="flex items-start text-xs text-slate-600 bg-red-50/50 border border-red-100/50 p-3 rounded-xl mb-4"><MapPin size={14} className="mr-2 mt-0.5 text-red-500 shrink-0" /><span className="font-medium line-clamp-2">{order.address}</span></div>}
                    <div className="flex justify-between items-center text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-xl">
                      <div className="flex items-center font-bold"><Clock size={12} className="mr-1.5" /> {new Date(order.created_at).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} น.</div>
                      {order.total_price > 0 && <div className="font-black text-slate-800 text-base">฿{order.total_price} <span className={`ml-1 px-1.5 py-0.5 rounded-md text-xs uppercase shadow-sm ${order.payment_method === 'โอน' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{order.payment_method}</span></div>}
                    </div>
                  </div>
                  <button onClick={() => handleTakeJob(order.id)} className="w-full py-4 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-black uppercase tracking-widest text-sm active:scale-95 cursor-pointer flex items-center justify-center">
                    <Zap size={16} className="mr-2 fill-white animate-pulse" /> กดรับงานนี้
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="font-black text-slate-800 mb-5 text-lg">งานที่รับไว้ <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-md">{activeOrders.length}</span></h2>
            {activeOrders.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={48} className="text-green-400" />
                </div>
                <p className="text-slate-600 font-bold mb-1">คุณยังไม่ได้จองงานใดๆ ไว้ครับ</p>
                <p className="text-xs text-slate-400 font-medium">ไปดูที่แท็บ &quot;งานว่าง&quot; เพื่อรับงานต่อได้เลย 🛵</p>
              </div>
            ) : (
              activeOrders.map((order) => (
                <div key={order.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden mb-5 transition-all ${order.status === 'รับงาน' ? 'border-emerald-400 ring-4 ring-emerald-50' : 'border-slate-100'}`}>
                  <div className="p-5 border-b border-slate-50">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xl text-slate-800 tracking-tight">{order.order_number}</span>
                        <button onClick={() => setSelectedViewOrder(order)} className="bg-slate-50 text-slate-500 border border-slate-200 px-2 py-1 rounded-lg text-xs font-black flex items-center active:scale-95 cursor-pointer shadow-sm"><Eye size={12} className="mr-1" /> รายละเอียด</button>
                      </div>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-lg uppercase border shadow-sm ${isCustomJob(order) ? 'bg-purple-50 text-purple-600 border-purple-100' : getRiderStatusDisplay(order.status).color}`}>
                        {order.status === 'รับงาน' ? 'ไปส่งลูกค้าเลย!' : order.status}
                      </span>
                    </div>
                    {renderThumbnail(order)}
                    {order.menu && <div className="mb-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 text-sm text-slate-800 font-bold whitespace-pre-line leading-relaxed">{order.menu}</div>}
                    {order.address && <div className="flex items-start text-xs text-slate-700 bg-slate-50 p-3 rounded-xl mb-4 font-bold"><MapPin size={16} className="mr-2 mt-0.5 text-red-500 shrink-0" /><span className="line-clamp-2">{order.address}</span></div>}
                    <div className="flex justify-between items-center text-xs bg-slate-50 p-3 rounded-xl">
                      <div className="text-slate-400 font-bold"><Clock size={12} className="inline mr-1" /> รับเมื่อ: {order.start_time ? new Date(order.start_time).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'}) : '-'}</div>
                      <div className="font-black text-slate-800 text-base">ยอดเก็บ: ฿{order.total_price}</div>
                    </div>
                  </div>
                  <div className="p-3 bg-white flex flex-wrap sm:flex-nowrap gap-2">
                    <div className="flex flex-1 gap-2 w-full">
                      <button onClick={() => calculateRoute(order)} className="flex-1 py-3 bg-indigo-50 text-indigo-600 font-black text-xs rounded-xl active:scale-95 border border-indigo-100 cursor-pointer shadow-sm flex justify-center items-center"><MapIcon size={14} className="mr-1.5"/> นำทาง</button>
                      <button onClick={() => handleDropJob(order.id)} className="flex-1 py-3 bg-rose-50 text-rose-600 font-black text-xs rounded-xl active:scale-95 border border-rose-100 cursor-pointer shadow-sm flex justify-center items-center"><X size={14} className="mr-1.5"/> คืนงาน</button>
                    </div>
                    <button 
                      onClick={() => handleRiderAction(order)} 
                      disabled={!canAction(order)}
                      className={`flex-1 w-full py-3 font-black text-xs rounded-xl transition-all active:scale-95 cursor-pointer uppercase tracking-wide flex justify-center items-center ${canAction(order) ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                    >
                      {canAction(order) && <CheckCircle2 size={16} className="mr-1.5"/>}
                      {getActionBtnLabel(order)}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="font-black text-slate-800 mb-5 text-lg">ประวัติรอบวันนี้ <span className="ml-2 px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-md">{completedOrders.length}</span></h2>
            <div className="space-y-3">
              {completedOrders.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <History size={48} className="mx-auto mb-3 text-slate-200 opacity-50" />
                  <p className="text-slate-400 font-bold">ยังไม่มีงานที่สำเร็จในวันนี้</p>
                </div>
              ) : completedOrders.map((order, idx) => (
                <div key={order.id} onClick={() => setSelectedViewOrder(order)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer active:scale-95 transition-all hover:border-blue-200 group">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors text-slate-400 text-xs font-black flex items-center justify-center mr-4 border border-slate-100">{completedOrders.length - idx}</div>
                    <div>
                      <div className="font-black text-slate-800 group-hover:text-blue-600 transition-colors">{order.order_number}</div>
                      <div className="text-xs text-slate-400 font-medium mt-1 flex items-center">
                        <span className="font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded mr-2 uppercase tracking-wide">{order.job_type}</span>
                        ส่งเมื่อ {order.end_time ? new Date(order.end_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center border border-emerald-100 shadow-sm"><CheckCircle2 size={12} className="mr-1.5"/> สำเร็จ</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-11/12 max-w-md z-40">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-3xl p-1.5 flex items-center justify-between">
          <button onClick={() => setActiveTab('available')} className={`relative flex-1 flex flex-col items-center py-3 rounded-2xl transition-all cursor-pointer ${activeTab === 'available' ? 'bg-blue-50 text-blue-600 shadow-sm scale-100' : 'text-slate-400 scale-95 hover:bg-slate-50'}`}>
            <Zap size={22} className={`mb-1 transition-all ${activeTab === 'available' ? 'fill-blue-200' : ''}`} /><span className="text-xs font-black uppercase">งานว่าง</span>
            {availableOrders.length > 0 && <span className="absolute top-2 right-1/4 translate-x-2 bg-red-500 text-white text-xs font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center border-2 border-white animate-bounce shadow-sm">{availableOrders.length}</span>}
          </button>
          <button onClick={() => setActiveTab('jobs')} className={`relative flex-1 flex flex-col items-center py-3 rounded-2xl transition-all cursor-pointer ${activeTab === 'jobs' ? 'bg-blue-50 text-blue-600 shadow-sm scale-100' : 'text-slate-400 scale-95 hover:bg-slate-50'}`}>
            <ClipboardList size={22} className="mb-1" /><span className="text-xs font-black uppercase">งานของฉัน</span>
            {activeOrders.length > 0 && <span className="absolute top-2 right-1/4 translate-x-2 bg-blue-500 text-white text-xs font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center border-2 border-white shadow-sm">{activeOrders.length}</span>}
          </button>
          <button onClick={() => setActiveTab('history')} className={`relative flex-1 flex flex-col items-center py-3 rounded-2xl transition-all cursor-pointer ${activeTab === 'history' ? 'bg-blue-50 text-blue-600 shadow-sm scale-100' : 'text-slate-400 scale-95 hover:bg-slate-50'}`}>
            <History size={22} className="mb-1" /><span className="text-xs font-black uppercase">ประวัติ</span>
          </button>
        </div>
      </div>

      {/* Hamburger Drawer */}
      {isMenuOpen && (
        <div className="fixed inset-0 flex" style={{ zIndex: 110 }}>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsMenuOpen(false)}></div>
          <div className="relative w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 z-10 rounded-r-3xl overflow-hidden">
            <div className="bg-linear-to-br from-blue-600 to-indigo-800 p-8 text-white relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full pointer-events-none"></div>
              <button onClick={() => setIsMenuOpen(false)} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all cursor-pointer backdrop-blur-md active:scale-90"><X size={18} /></button>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-5 text-2xl font-black shadow-inner border border-white/20">{riderName.charAt(0)}</div>
              <h2 className="font-black text-2xl mb-1 tracking-tight">{riderName}</h2>
              <p className="text-blue-200 text-xs flex items-center font-bold tracking-wide"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 shadow-sm"></span> พร้อมรับงานเสมอ</p>
            </div>
            <div className="flex-1 p-5 space-y-2 overflow-y-auto">
              <button onClick={() => { setIsMenuOpen(false); setShowDashboard(true); }} className="w-full flex items-center p-4 text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-2xl transition-all font-bold cursor-pointer border border-transparent hover:border-blue-100 group">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform"><LayoutDashboard size={20} className="text-blue-600" /></div>
                Dashboard ของฉัน
              </button>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button onClick={() => { setIsMenuOpen(false); handleLogout(); }} className="w-full flex items-center justify-center p-4 text-red-500 bg-white border border-red-100 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all font-black cursor-pointer shadow-sm active:scale-95"><LogOut size={18} className="mr-2" />ออกจากระบบ</button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {selectedViewOrder && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm" style={{ zIndex: 200 }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0">
              <h3 className="font-black flex items-center text-lg tracking-tight"><ClipboardList size={20} className="mr-2"/> รายละเอียดออเดอร์</h3>
              <button onClick={() => setSelectedViewOrder(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer active:scale-90 hover:rotate-90 duration-300"><X size={18} strokeWidth={3}/></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto hide-scrollbar">
              <div className="flex justify-between items-end border-b border-slate-100 pb-5">
                <div>
                  <div className="text-xs font-black text-slate-400 mb-1 tracking-wider uppercase">เลขที่ออเดอร์</div>
                  <div className="text-3xl font-black text-slate-800 tracking-tighter">{selectedViewOrder.order_number}</div>
                </div>
                <div className="text-right mb-1">
                  <span className={`text-xs font-black px-3 py-1.5 rounded-lg border shadow-sm ${getRiderStatusDisplay(selectedViewOrder.status).color}`}>
                    {selectedViewOrder.status}
                  </span>
                </div>
              </div>

              {selectedViewOrder.image_url && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center">
                    <ImageIcon size={14} className="mr-1.5" /> รูปภาพแนบ
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedViewOrder.image_url.split(',').filter(Boolean).map((url, i) => (
                      <div
                        key={i}
                        onClick={() => setImageGallery({ urls: selectedViewOrder.image_url!.split(',').filter(Boolean), startIndex: i })}
                        className="relative h-32 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer hover:shadow-md transition-shadow group/img"
                      >
                        <Image
                          src={url}
                          fill
                          sizes="(max-width: 768px) 50vw, 33vw"
                          className="object-cover group-hover/img:scale-105 transition-transform duration-500"
                          alt={`Detail ${i}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedViewOrder.menu && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider">รายการที่สั่ง</div>
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-sm text-slate-700 font-bold whitespace-pre-line leading-relaxed">
                    {selectedViewOrder.menu}
                  </div>
                </div>
              )}

              {selectedViewOrder.details && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider">หมายเหตุ (Note)</div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-600 font-medium whitespace-pre-line leading-relaxed">
                    {selectedViewOrder.details}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3 text-sm">
                <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">ประเภทงาน:</span><span className="font-black text-slate-700 uppercase px-2.5 py-1 bg-white rounded-md shadow-sm border border-slate-100">{selectedViewOrder.job_type}</span></div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60"><span className="text-slate-500 font-medium">ยอดเรียกเก็บ:</span><span className="font-black text-blue-600 text-lg">฿{selectedViewOrder.total_price}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">การชำระเงิน:</span><span className={`font-black text-xs uppercase px-2.5 py-1 rounded-md ${selectedViewOrder.payment_method === 'โอน' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{selectedViewOrder.payment_method || 'เงินสด'}</span></div>
              </div>

              {selectedViewOrder.address && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider">สถานที่จัดส่ง</div>
                  <div className="flex items-start text-sm text-slate-700 bg-red-50/50 p-4 rounded-2xl border border-red-100 font-bold">
                    <MapIcon size={18} className="mr-2 mt-0.5 text-red-500 shrink-0" />
                    <span className="leading-relaxed">{selectedViewOrder.address}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-5 pt-0 shrink-0 bg-white border-t border-slate-100 mt-2">
              <button onClick={() => setSelectedViewOrder(null)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all cursor-pointer shadow-lg active:scale-95 text-sm uppercase tracking-widest">
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery Modal (Swipeable + Buttons) */}
      {imageGallery && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200" onClick={() => { setImageGallery(null); setImgScale(1); }} style={{ zIndex: 300 }}>
          <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-50 text-white pointer-events-none">
            <span className="font-bold text-xs bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm">ปัดซ้าย-ขวา / ซูมได้</span>
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
                className={`w-full h-full shrink-0 snap-center p-2 flex overflow-auto ${imgScale > 1 ? 'items-start justify-start' : 'items-center justify-center'}`} 
                onClick={(e) => e.stopPropagation()}
              >
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
            <button onClick={() => setImgScale(prev => Math.min(4, prev + 0.25))} className={`p-2 rounded-full transition-all cursor-pointer ${imgScale >= 4 ? 'text-slate-500 cursor-not-allowed' : 'text-white hover:bg-white/20'}`} disabled={imgScale >= 4}>
              <ZoomIn size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Popup Notifications */}
      {popup.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: 350 }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in-95 duration-300 border border-slate-100">
            {renderPopupIcon(popup.icon || 'info')}
            <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">{popup.title}</h3>
            <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed">{popup.message}</p>
            {popup.type === 'alert' ? (
              <button onClick={closePopup} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl active:scale-95 shadow-lg cursor-pointer">ตกลง</button>
            ) : (
              <div className="flex gap-3">
                <button onClick={closePopup} className="flex-[0.8] py-4 bg-slate-100 text-slate-600 font-black rounded-xl active:scale-95 cursor-pointer">ยกเลิก</button>
                <button onClick={popup.onConfirm} className="flex-[1.2] py-4 bg-blue-600 text-white font-black rounded-xl active:scale-95 shadow-lg shadow-blue-500/30 cursor-pointer">ยืนยัน</button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .touch-pinch-zoom { touch-action: pinch-zoom; }
      `}</style>
      
    </div>
  );
}

// 🌟 Helper Functions
function isCustomJob(order: Order) {
  return order.job_type === 'รับหิ้ว' || order.job_type === 'รับส่ง';
}

function canAction(order: Order) {
  if (isCustomJob(order)) return true;
  return order.status === 'รับงาน';
}

function getActionBtnLabel(order: Order) {
  if (isCustomJob(order)) {
    if (order.status === 'New') return 'เริ่มทำงาน';
    if (order.status === 'กำลังทำ') return 'ทำธุระเสร็จแล้ว';
    if (order.status === 'รับงาน') return 'ส่งลูกค้าสำเร็จ';
  }
  return order.status === 'รับงาน' ? 'ส่งลูกค้าสำเร็จ' : 'รอครัวทำอาหาร...';
}