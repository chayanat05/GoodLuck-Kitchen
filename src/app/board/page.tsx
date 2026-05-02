'use client'
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import OrderCard, { Order } from '../../components/OrderCard';
import JobMap from '../../components/JobMap'; 
import SlipScanner from '../../components/SlipScanner';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../../lib/supabase';
import { 
  X, ClipboardCheck, ImagePlus, Trash2, MapPin as MapIcon, 
  LogOut, Users, Menu, LayoutDashboard, Search, Store, CheckCircle2,
  MoonStar, AlertTriangle, ChevronDown, ChevronUp, Sun, Volume2,
  Map as MapViewIcon, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Image as ImageIcon,
  PlayCircle, ChefHat, PackageCheck, 
  Settings, ArrowRightLeft
} from 'lucide-react'; 
import { useJsApiLoader, GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { User as SupabaseUser } from '@supabase/supabase-js';
import Image from 'next/image';

const NOTIFICATION_SOUND_URL = '/audio-shop.mp3';
const LIBRARIES: ("places")[] = ["places"];
const SHOP_LAT = 16.248130;
const SHOP_LNG = 103.242206;

export interface SavedLocation {
  id?: string; name: string; address?: string | null; lat: number; lng: number;
}

interface UnifiedSearchResult {
  type: 'store' | 'google'; place_id?: string; name: string; address: string; lat?: number; lng?: number; distanceText?: string;
}

interface RiderLocation {
  id: string; username: string; last_lat: number | null; last_lng: number | null; last_seen: string | null;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
};

export default function BoardPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  // 🌟 แก้ไขการประกาศ State โดยดึงจาก localStorage ตั้งแต่ต้น
  const [bgColor, setBgColor] = useState<string>(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('boardBgColor') || '#f8fafc';
  }
  return '#f8fafc';
});

  const [bgImage, setBgImage] = useState<string | null>(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('boardBgImage');
  }
  return null;
});

  const [bgOption, setBgOption] = useState<'cover' | 'contain' | 'repeat'>(() => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('boardBgOption') as 'cover' | 'contain' | 'repeat') || 'cover';
  }
  return 'cover';
  });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean; type: 'logout' | 'endDay' | null; title: string; message: string; confirmText: string; cancelText: string; icon: React.ReactNode | null;
  }>({ isOpen: false, type: null, title: '', message: '', confirmText: '', cancelText: '', icon: null });

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [scannerConfig, setScannerConfig] = useState<{ isOpen: boolean; orderId: string; amount: number } | null>(null);
  
  // 🌟 State ควบคุม Pop-up เปลี่ยนสถานะ
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; order: Order | null }>({ isOpen: false, order: null });

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQuery(searchQuery); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null); 
  
  const [selectedViewOrder, setSelectedViewOrder] = useState<Order | null>(null);
  const [imageGallery, setImageGallery] = useState<{urls: string[], startIndex: number} | null>(null);
  const [imgScale, setImgScale] = useState(1); 
  const galleryRef = useRef<HTMLDivElement>(null);
  
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]); 
  const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResult[]>([]); 
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [toast, setToast] = useState<{show: boolean, message: string}>({ show: false, message: '' });
  
  const dbTimeoutRef = useRef<NodeJS.Timeout | null>(null); 
  const googleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const notificationAudio = useRef<HTMLAudioElement | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [adminName, setAdminName] = useState<string>('กำลังโหลด...');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const [showRiderMap, setShowRiderMap] = useState<boolean>(false);
  const [ridersLoc, setRidersLoc] = useState<RiderLocation[]>([]);
  const [selectedRiderMapInfo, setSelectedRiderMapInfo] = useState<RiderLocation | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script', googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '', libraries: LIBRARIES, language: 'th', region: 'TH'
  });

  const [formData, setFormData] = useState({
    order_number: '', job_type: 'ร้าน', menu: '', details: '', location_name: '', new_pin_name: '', address: '', total_price: '', payment_method: 'โอน', lat: null as number | null, lng: null as number | null
  });

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg }); setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const fetchOrdersAndLocations = async () => {
    // 🌟 อัปเดตให้ดึงข้อมูลโดยเรียงตาม sort_index ด้วย
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .or('is_archived.is.null,is_archived.eq.false')
      .order('sort_index', { ascending: true }) // เรียงตามตำแหน่งที่ลากวาง
      .order('created_at', { ascending: false });
      
    if (orderError) console.error("Error fetching orders:", orderError);
    if (orderData) setOrders(orderData as Order[]);

    const { data: locData, error: locError } = await supabase.from('saved_locations').select('*');
    if (locError) console.error("Error fetching locations:", locError);
    if (locData) setSavedLocations(locData as SavedLocation[]);
  };

  const fetchRidersLocation = async () => {
    const { data, error } = await supabase.from('profiles').select('id, username, last_lat, last_lng, last_seen').eq('role', 'rider').not('last_lat', 'is', null);
    if (error) console.error(error);
    if (data) setRidersLoc(data as RiderLocation[]);
  };

  useEffect(() => {
    notificationAudio.current = new Audio(NOTIFICATION_SOUND_URL);

    const checkAuthAndInit = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      const { data: profile, error } = await supabase.from('profiles').select('role, username').eq('id', session.user.id).single();
      if (error || !profile || profile.role !== 'admin') { alert('สิทธิ์การเข้าถึงถูกปฏิเสธ!'); window.location.href = '/rider'; return; }
      setCurrentUser(session.user); setAdminName(profile.username || 'แอดมิน'); setIsMounted(true); fetchOrdersAndLocations(); 
    };

    checkAuthAndInit();

    const orderChannel = supabase.channel('public:orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        if (!payload.new.is_archived) { notificationAudio.current?.play().catch(() => {}); showToast(`🔔 มีออเดอร์ใหม่เข้า! ออเดอร์ที่ ${payload.new.order_number}`); }
        fetchOrdersAndLocations();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => { fetchOrdersAndLocations(); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => { fetchOrdersAndLocations(); })
      .subscribe();

    const profileChannel = supabase.channel('public:profiles').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => { if (showRiderMap) fetchRidersLocation(); }).subscribe();
    return () => { supabase.removeChannel(orderChannel); supabase.removeChannel(profileChannel); };
  }, [showRiderMap]);

  useEffect(() => {
    if (showRiderMap) { const getInitialLocation = async () => { await fetchRidersLocation(); }; getInitialLocation(); const interval = setInterval(fetchRidersLocation, 10000); return () => clearInterval(interval); }
  }, [showRiderMap]);

  useEffect(() => {
    if (imageGallery && galleryRef.current) { const target = galleryRef.current.children[imageGallery.startIndex] as HTMLElement; if (target) galleryRef.current.scrollLeft = target.offsetLeft; }
  }, [imageGallery]);

  const scrollGallery = (direction: 'left' | 'right') => {
    setImgScale(1); if (galleryRef.current) { const { clientWidth } = galleryRef.current; const scrollAmount = direction === 'left' ? -clientWidth : clientWidth; galleryRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' }); }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop(); const fileName = `${Math.random()}.${fileExt}`; const filePath = `order-photos/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('order-images').upload(filePath, file);
    if (uploadError) { console.error('Upload error:', uploadError); return null; }
    const { data } = supabase.storage.from('order-images').getPublicUrl(filePath); return data.publicUrl;
  };

  const handleLocationSearch = (text: string) => {
    setFormData({ ...formData, location_name: text });
    if (dbTimeoutRef.current) clearTimeout(dbTimeoutRef.current); if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);
    if (text.trim().length < 2) { setUnifiedResults([]); setShowSuggestions(false); return; }

    dbTimeoutRef.current = setTimeout(async () => {
      const { data: storeData } = await supabase.from('saved_locations').select('*').ilike('name', `%${text}%`).limit(5);
      let storeResults: UnifiedSearchResult[] = [];
      if (storeData && storeData.length > 0) {
        storeResults = (storeData as SavedLocation[]).map(loc => ({ type: 'store' as const, name: loc.name, address: loc.address || 'หมุดบันทึก', lat: loc.lat, lng: loc.lng, distanceText: `${calculateDistance(SHOP_LAT, SHOP_LNG, loc.lat, loc.lng).toFixed(1)} km` }));
      }
      setUnifiedResults(storeResults); setShowSuggestions(storeResults.length > 0);
    }, 150);

    googleTimeoutRef.current = setTimeout(async () => {
      if (isLoaded && window.google) {
        const service = new window.google.maps.places.AutocompleteService();
        service.getPlacePredictions({ input: text, componentRestrictions: { country: "th" }, locationBias: { radius: 20000, center: { lat: SHOP_LAT, lng: SHOP_LNG } } }, (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            const googleResults = predictions.slice(0, 3).map(p => ({ type: 'google' as const, place_id: p.place_id, name: p.structured_formatting.main_text, address: p.structured_formatting.secondary_text || 'Google Maps' }));
            setUnifiedResults(prev => { const combined = [...prev, ...googleResults]; setShowSuggestions(combined.length > 0); return combined; });
          }
        });
      }
    }, 1500); 
  };

  const selectUnifiedResult = (item: UnifiedSearchResult) => {
    if (item.type === 'store' && item.lat && item.lng) {
      setFormData({ ...formData, location_name: item.name, address: item.address, lat: item.lat, lng: item.lng }); setShowSuggestions(false);
    } else if (item.type === 'google' && item.place_id && isLoaded) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ placeId: item.place_id }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const loc = results[0].geometry.location; setFormData({ ...formData, location_name: item.name, address: results[0].formatted_address || item.address, lat: loc.lat(), lng: loc.lng() });
        }
        setShowSuggestions(false);
      });
    }
  };

  const openCreateModal = () => {
    setEditingId(null); setFormData({ order_number: '', job_type: 'ร้าน', menu: '', details: '', location_name: '', new_pin_name: '', address: '', total_price: '', payment_method: 'โอน', lat: null, lng: null });
    setImageFiles([]); setImagePreviews([]); setExistingImages([]); setShowSuggestions(false); setIsModalOpen(true);
  };

  const openEditModal = (order: Order) => {
    setEditingId(order.id); setFormData({ order_number: order.order_number, job_type: order.job_type, menu: (order as Order & { menu?: string }).menu || '', details: order.details || '', location_name: order.address || '', new_pin_name: '', address: '', total_price: order.total_price.toString(), payment_method: order.payment_method || 'โอน', lat: order.lat || null, lng: order.lng || null });
    if (order.image_url) { setExistingImages(order.image_url.split(',').filter(Boolean)); } else { setExistingImages([]); }
    setImageFiles([]); setImagePreviews([]); setShowSuggestions(false); setIsModalOpen(true);
  };

  const handleAddFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/')); if (validFiles.length === 0) return;
    setImageFiles(prev => [...prev, ...validFiles]);
    validFiles.forEach(file => { const reader = new FileReader(); reader.onloadend = () => setImagePreviews(prev => [...prev, reader.result as string]); reader.readAsDataURL(file); });
  };
  const handlePasteImage = (event: React.ClipboardEvent) => { const items = event.clipboardData.items; if (!items) return; const files: File[] = []; for (let i = 0; i < items.length; i++) { if (items[i].kind === 'file' && items[i].type.startsWith('image/')) { const file = items[i].getAsFile(); if (file) files.push(file); } } handleAddFiles(files); };
  const handleDropImage = (event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); if (event.dataTransfer.files) handleAddFiles(event.dataTransfer.files); };
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => { if (event.target.files) handleAddFiles(event.target.files); };
  const removeExistingImage = (index: number) => { setExistingImages(prev => prev.filter((_, i) => i !== index)); };
  const removeNewImage = (index: number) => { setImageFiles(prev => prev.filter((_, i) => i !== index)); setImagePreviews(prev => prev.filter((_, i) => i !== index)); };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault(); setIsUploading(true);
    const filesToUpload = [...imageFiles]; const currentExisting = [...existingImages];
    let finalOrderNumber = formData.order_number.trim(); if (formData.job_type === 'shopee' && !finalOrderNumber.startsWith('#')) finalOrderNumber = '#' + finalOrderNumber;
    const cleanPrice = formData.job_type === 'shopee' ? 0 : parseInt(formData.total_price.replace(/[^0-9]/g, ''), 10) || 0;
    
    const orderData = {
      order_number: finalOrderNumber, job_type: formData.job_type, menu: formData.menu.trim(), details: formData.details.trim() || '', address: formData.job_type === 'shopee' ? null : formData.location_name, image_url: currentExisting.join(','), total_price: cleanPrice, payment_method: formData.job_type === 'shopee' ? 'โอน' : formData.payment_method, lat: formData.job_type === 'shopee' ? null : formData.lat, lng: formData.job_type === 'shopee' ? null : formData.lng,
    };

    let targetId = editingId; const isEdit = !!editingId;

    if (isEdit) {
      const { data } = await supabase.from('orders').update(orderData).eq('id', editingId).select();
      if (data) setOrders(orders.map(o => o.id === editingId ? data[0] as Order : o));
    } else {
      const { data } = await supabase.from('orders').insert([{ ...orderData, status: 'New' }]).select(); 
      if (data && data.length > 0) { targetId = data[0].id; setOrders([data[0] as Order, ...orders]); }
    }

    setIsUploading(false); setIsModalOpen(false); setImageFiles([]); setImagePreviews([]); setExistingImages([]);
    if (isEdit) showToast('อัปเดตข้อมูลสำเร็จ! 📝'); else showToast('สร้างออเดอร์สำเร็จ! 🚀');

    if (!isEdit && formData.new_pin_name.trim() && formData.lat && formData.lng && formData.job_type !== 'shopee') {
      await supabase.from('saved_locations').upsert({ name: formData.new_pin_name.trim(), address: formData.location_name, lat: formData.lat, lng: formData.lng }, { onConflict: 'name' }); 
    }
    
    if (filesToUpload.length > 0 && targetId) {
      const uploadedUrls: string[] = [];
      for (const file of filesToUpload) { const url = await uploadImage(file); if (url) uploadedUrls.push(url); }
      if (uploadedUrls.length > 0) {
        const finalUrls = [...currentExisting, ...uploadedUrls].join(',');
        await supabase.from('orders').update({ image_url: finalUrls }).eq('id', targetId);
        showToast('อัปโหลดรูปภาพทั้งหมดเสร็จสิ้น! 📸'); fetchOrdersAndLocations(); 
      }
    }
  };

  // 🌟 ฟังก์ชันส่งคำสั่งเปลี่ยนสถานะไปที่ฐานข้อมูล
  const executeStatusChange = async (newStatus: string) => {
    if (!statusModal.order) return;
    const targetOrder = statusModal.order;
    
    const updateData: { status: string; end_time?: string } = { status: newStatus };
    if (newStatus === 'ส่งแล้ว/เสร็จ' && targetOrder.job_type === 'shopee') {
      updateData.end_time = new Date().toISOString();
    }

    // ปิด Modal ทันที
    setStatusModal({ isOpen: false, order: null });

    const { data, error } = await supabase.from('orders').update(updateData).eq('id', targetOrder.id).select();
    if (error) { 
      console.error(error); 
      showToast('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ ❌'); 
    } else if (data) { 
      setOrders(orders.map(o => o.id === targetOrder.id ? { ...o, ...data[0] } : o)); 
      showToast(`เปลี่ยนสถานะเป็น "${newStatus}" แล้ว! 🔄`); 
      setSelectedViewOrder(null); 
    }
  };

  const handleStartOrder = async (orderId: string) => {
    const { data, error } = await supabase.from('orders').update({ status: 'กำลังทำ' }).eq('id', orderId).select();
    if (error) console.error(error);
    if (data) { setOrders(orders.map(o => o.id === orderId ? data[0] as Order : o)); showToast('ครัวเริ่มทำอาหารแล้ว! 🍳'); setSelectedViewOrder(null); }
  };

  const handleFinishOrder = async (orderId: string) => {
    const targetOrder = orders.find(o => o.id === orderId); const isShopee = targetOrder?.job_type === 'shopee';
    const nextStatus = isShopee ? 'ส่งแล้ว/เสร็จ' : 'รับงาน'; const updateData: { status: string; end_time?: string } = { status: nextStatus };
    if (isShopee) updateData.end_time = new Date().toISOString();

    const { data, error } = await supabase.from('orders').update(updateData).eq('id', orderId).select();
    if (error) console.error(error);
    if (data) { setOrders(orders.map(o => o.id === orderId ? data[0] as Order : o)); showToast(isShopee ? 'ส่งมอบให้ขนส่ง Shopee สำเร็จ! 📦' : 'อาหารเสร็จแล้ว รอไรเดอร์มารับ! 🛵'); setSelectedViewOrder(null); }
  };

  const handleEndDayRequest = () => {
    if (orders.length === 0) { alert('กระดานว่างเปล่าอยู่แล้วครับ ไม่มีออเดอร์ให้ปิดยอด'); return; }
    setAlertModal({ isOpen: true, type: 'endDay', title: 'ยืนยันการปิดยอดจบวัน?', message: 'ออเดอร์ทั้งหมดในกระดานจะถูกซ่อนทันที\n(สามารถดูย้อนหลังได้ในหน้า Dashboard สถิติร้าน)', confirmText: 'ยืนยันปิดยอด', cancelText: 'ยกเลิก', icon: <MoonStar size={44} className="text-rose-500 mb-4 animate-bounce drop-shadow-sm" /> });
  };

  const executeEndDay = async () => {
    setAlertModal({ ...alertModal, isOpen: false });
    const { error } = await supabase.from('orders').update({ is_archived: true }).neq('is_archived', true); 
    if (error) { console.error(error); showToast('เกิดข้อผิดพลาดในการปิดยอด'); } 
    else { showToast('🌙 ปิดยอดจบวันเรียบร้อย กระดานพร้อมสำหรับวันใหม่!'); setIsMenuOpen(false); fetchOrdersAndLocations(); }
  };

  const handleLogoutRequest = () => {
    setAlertModal({ isOpen: true, type: 'logout', title: 'ต้องการออกจากระบบ?', message: 'คุณต้องเข้าสู่ระบบใหม่ในครั้งถัดไปที่ต้องการใช้งาน', confirmText: 'ออกจากระบบ', cancelText: 'ยกเลิก', icon: <LogOut size={44} className="text-slate-700 mb-4 ml-1 drop-shadow-sm" style={{ animation: 'wiggle 2s infinite' }} /> });
  };

  const executeLogout = async () => {
    setAlertModal({ ...alertModal, isOpen: false }); await supabase.auth.signOut(); window.location.href = '/login';
  };

  const requestDeleteOrder = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const executeDeleteOrder = async () => {
    if (!deleteConfirm.id) return;
    const { error } = await supabase.from('orders').delete().eq('id', deleteConfirm.id);
    if (error) { console.error(error); showToast('เกิดข้อผิดพลาดในการลบออเดอร์'); return; }
    setOrders(prev => prev.filter(order => order.id !== deleteConfirm.id)); 
    setDeleteConfirm({ isOpen: false, id: null });
    showToast('ลบออเดอร์เรียบร้อยแล้ว 🗑️');
  };

  // 🌟 ฟังก์ชันจัดการ Drag and Drop พร้อมอัปเดตลง Database ให้จำตำแหน่ง
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(orders);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // อัปเดตหน้าจอทันทีเพื่อความสมูท
    setOrders(items);

    // 🌟 วนลูปเซฟตำแหน่งใหม่ (sort_index) ลง Database
    items.forEach((item, index) => {
      supabase.from('orders')
        .update({ sort_index: index })
        .eq('id', item.id)
        .then(({error}) => {
          if (error) console.error("Error updating sort index:", error);
        });
    });
  };

  const filteredOrders = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return orders.filter(order => (order.order_number?.toLowerCase() || '').includes(q) || (order.address?.toLowerCase() || '').includes(q) || (order.rider_name?.toLowerCase() || '').includes(q));
  }, [orders, debouncedQuery]);

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false; const diffMins = (new Date().getTime() - new Date(lastSeen).getTime()) / 60000; return diffMins < 5; 
  };

  if (!currentUser || !isMounted) return (
    <div 
      className="min-h-screen w-full flex justify-center items-center relative transition-all duration-500 z-50"
      style={{ 
        backgroundColor: bgColor, 
        backgroundImage: bgImage ? `url(${bgImage})` : 'none', 
        backgroundSize: bgOption === 'repeat' ? 'auto' : bgOption, 
        backgroundRepeat: bgOption === 'repeat' ? 'repeat' : 'no-repeat',
        backgroundPosition: 'center', 
        backgroundAttachment: 'fixed' 
      }}
    >
      <div className="bg-slate-900/60 backdrop-blur-xl p-10 rounded-3xl shadow-2xl flex flex-col items-center justify-center border border-white/10">
        <div className="loader mb-4" style={{ '--loader-color': '#fff' } as React.CSSProperties}></div>
        <p className="text-white text-sm font-bold tracking-widest mt-2 animate-pulse">กำลังเตรียมกระดาน...</p>
      </div>

      <style jsx global>{`
        .loader,
        .loader:before,
        .loader:after {
          width: 35px;
          aspect-ratio: 1;
          box-shadow: 0 0 0 3px inset var(--loader-color, #fff);
          position: relative;
          animation: l6 1.5s infinite 0.5s;
        }
        .loader:before,
        .loader:after {
          content: "";
          position: absolute;
          left: calc(100% + 5px);
          animation-delay: 1s;
        }
        .loader:after {
          left: -40px;
          animation-delay: 0s;
        }
        @keyframes l6 {
          0%,55%,100%  { border-radius: 0; }
          20%,30%      { border-radius: 50%; }
        }
      `}</style>
    </div>
  );

  return (
    <div 
      className="h-screen w-full flex flex-col overflow-hidden font-sans relative transition-all duration-500"
      style={{ backgroundColor: bgColor, backgroundImage: bgImage ? `url(${bgImage})` : 'none', backgroundSize: bgOption === 'repeat' ? 'auto' : bgOption, backgroundRepeat: bgOption === 'repeat' ? 'repeat' : 'no-repeat', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`} style={{ zIndex: 150 }}>
        <CheckCircle2 size={18} className="text-green-400 mr-2" />
        <span className="font-bold text-sm tracking-wide">{toast.message}</span>
      </div>

      <div className="shrink-0 p-2 pb-0 z-20">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-2 mb-0 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button onClick={() => setIsMenuOpen(true)} className="p-2 bg-slate-100 hover:bg-blue-100 rounded-xl transition-all cursor-pointer text-slate-600 hover:text-blue-700 active:scale-95"><Menu size={18} /></button>
            <h1 className="text-base md:text-lg font-black text-slate-800 flex items-center whitespace-nowrap tracking-tight">
              KANBAN <span className="text-blue-600 ml-1 mr-2 md:mr-3">BOARD</span> 
              <span className="text-xs md:text-sm text-slate-500 font-bold border-l-2 border-slate-200 pl-2 md:pl-3 py-1">
                ออเดอร์ทั้งหมด : <span className="text-blue-600 font-black">{orders.length}</span>
              </span>
            </h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center w-full lg:w-auto gap-2">
            <div className="relative w-full sm:w-56">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={14} className="text-slate-400" /></div>
              <input type="text" placeholder="ค้นหาออเดอร์, สถานที่..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium shadow-inner"/>
            </div>
            <button onClick={() => setShowRiderMap(true)} className="w-full sm:w-auto px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95">
              <MapViewIcon size={14} className="animate-pulse" /> พิกัดไรเดอร์
            </button>
            <button onClick={openCreateModal} className="w-full sm:w-auto px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all duration-300 cursor-pointer active:scale-95 shadow-md">+ สร้างออเดอร์</button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 flex" style={{ zIndex: 110 }}>
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsMenuOpen(false)}></div>
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 z-10 rounded-r-3xl overflow-hidden">
            <div className="bg-linear-to-br from-blue-600 to-indigo-800 p-8 text-white relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full pointer-events-none"></div>
              <button onClick={() => setIsMenuOpen(false)} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all cursor-pointer backdrop-blur-md active:scale-90"><X size={18} /></button>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-5 text-2xl font-black uppercase shadow-inner border border-white/20">{adminName.charAt(0)}</div>
              <h2 className="font-black text-2xl mb-1 tracking-tight">{adminName}</h2>
              <p className="text-blue-200 text-xs font-bold tracking-wide flex items-center"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 shadow-md shadow-emerald-400"></span> ผู้ดูแลระบบ (ADMIN)</p>
            </div>
            <div className="flex-1 p-5 space-y-3 overflow-y-auto">
              <Link href="/board/dashboard" className="w-full flex items-center p-4 text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-2xl transition-all font-bold border border-transparent hover:border-blue-100 group"><div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform"><LayoutDashboard size={20} className="text-blue-600" /></div>Dashboard สถิติร้าน</Link>
              <Link href="/board/users" className="w-full flex items-center p-4 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-2xl transition-all font-bold border border-transparent hover:border-indigo-100 group"><div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform"><Users size={20} className="text-indigo-600" /></div>จัดการสมาชิก (พนักงาน)</Link>
              <Link href="/setting" className="w-full flex items-center p-4 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-2xl transition-all font-bold cursor-pointer border border-transparent hover:border-slate-200 group">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform group-hover:rotate-45">
                  <Settings size={20} className="text-slate-600" />
                </div>
                ตั้งค่าระบบ / ธีม
              </Link>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button onClick={handleLogoutRequest} className="w-full flex items-center justify-center p-4 text-slate-500 bg-white border border-slate-200 hover:bg-slate-800 hover:text-white hover:border-slate-800 rounded-2xl transition-all duration-300 font-black cursor-pointer shadow-sm active:scale-95 group/logout">
                <LogOut size={18} className="mr-2 group-hover/logout:-translate-x-1 transition-transform duration-300" /> ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {showRiderMap && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm" style={{ zIndex: 120 }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col" style={{ height: '85vh' }}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2"><MapViewIcon className="text-indigo-600" size={24} /> ติดตามพิกัดไรเดอร์ (Live)</h3>
              <button type="button" onClick={() => setShowRiderMap(false)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all cursor-pointer active:scale-90 duration-300"><X size={20} strokeWidth={2.5}/></button>
            </div>
            
            <div className="flex-1 bg-slate-100 relative">
              {isLoaded ? (
                <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={{ lat: SHOP_LAT, lng: SHOP_LNG }} zoom={13} options={{ disableDefaultUI: true, zoomControl: true }}>
                  <MarkerF position={{ lat: SHOP_LAT, lng: SHOP_LNG }} icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }} onClick={() => setSelectedRiderMapInfo({ id: 'shop', username: 'ร้านของเรา', last_lat: SHOP_LAT, last_lng: SHOP_LNG, last_seen: null })} />
                  {ridersLoc.map((rider) => (
                    rider.last_lat && rider.last_lng && (
                      <MarkerF key={rider.id} position={{ lat: rider.last_lat, lng: rider.last_lng }} icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' }} onClick={() => setSelectedRiderMapInfo(rider)} />
                    )
                  ))}
                  {selectedRiderMapInfo && selectedRiderMapInfo.last_lat && selectedRiderMapInfo.last_lng && (
                    <InfoWindowF position={{ lat: selectedRiderMapInfo.last_lat, lng: selectedRiderMapInfo.last_lng }} onCloseClick={() => setSelectedRiderMapInfo(null)}>
                      <div className="p-1 min-w-32 text-center">
                        <div className="font-bold text-sm text-slate-800 mb-1">{selectedRiderMapInfo.username}</div>
                        {selectedRiderMapInfo.id !== 'shop' && (
                          <div className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${isOnline(selectedRiderMapInfo.last_seen) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {isOnline(selectedRiderMapInfo.last_seen) ? '🟢 ออนไลน์' : '⚫️ ออฟไลน์'}
                          </div>
                        )}
                      </div>
                    </InfoWindowF>
                  )}
                </GoogleMap>
              ) : (
                <div className="w-full h-full flex items-center justify-center animate-pulse text-slate-400 font-bold">กำลังโหลดแผนที่...</div>
              )}
            </div>
            <div className="p-4 bg-white shrink-0 border-t border-slate-100 flex gap-2 overflow-x-auto thin-scrollbar">
              <div className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-100 shrink-0 flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-full shadow-inner"></div> ร้านของเรา</div>
              <div className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100 shrink-0 flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-full shadow-inner animate-pulse"></div> ไรเดอร์</div>
              <span className="text-xs text-slate-400 my-auto ml-auto pl-4 whitespace-nowrap">*พิกัดอัปเดตทุก 30 วินาที</span>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 บอร์ดหลัก */}
      <div className="flex-1 p-2 md:p-4 overflow-hidden z-10 flex flex-col">
        {orders.length === 0 && !searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full bg-white/30 backdrop-blur-md rounded-3xl border border-white/40 shadow-xl animate-in fade-in duration-500 m-2">
            <div className="w-28 h-28 bg-white/50 text-blue-600 rounded-full flex items-center justify-center mb-8 shadow-inner border border-white/60" style={{ animation: 'spin 10s linear infinite' }}>
              <Sun size={56} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight drop-shadow-sm">เริ่มต้นวันใหม่! 🌤️</h2>
            <p className="text-slate-700 font-bold mb-10 text-center max-w-md leading-relaxed drop-shadow-sm">กระดานว่างเปล่าพร้อมรับออเดอร์สำหรับวันนี้แล้ว<br/>กดปุ่มด้านล่างเพื่อเริ่มเปิดออเดอร์แรกของวันได้เลยครับ</p>
            <button onClick={openCreateModal} className="px-10 py-5 bg-blue-600 text-white font-black rounded-3xl hover:bg-blue-700 hover:-translate-y-1 transition-all duration-300 flex items-center cursor-pointer tracking-wider uppercase text-sm active:scale-95 shadow-[0_10px_20px_-10px_rgba(37,99,235,0.6)]">
              <ClipboardCheck size={22} className="mr-3" /> เปิดร้าน / สร้างออเดอร์แรก
            </button>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="all-orders" direction="horizontal">
              {(provided) => (
                <div 
                  ref={provided.innerRef} 
                  {...provided.droppableProps}
                  className="flex-1 overflow-x-auto overflow-y-hidden thin-scrollbar pb-6 pt-2 px-2 flex items-start gap-4 md:gap-5"
                >
                  {filteredOrders.map((order, index) => (
                    <Draggable key={order.id} draggableId={order.id} index={index}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`shrink-0 w-65 md:w-[320px] h-max transition-all duration-300 ${snapshot.isDragging ? 'scale-105 rotate-2 shadow-2xl z-50 ring-4 ring-blue-500/30 rounded-[1.5rem]' : ''}`}
                        >
                          <OrderCard 
                            order={order} 
                            onEdit={openEditModal} 
                            onStart={handleStartOrder} 
                            onFinish={handleFinishOrder} 
                            onViewDetails={() => setSelectedViewOrder(order)} 
                            onViewImages={(urls, startIndex) => setImageGallery({ urls, startIndex })} 
                            onVerifySlip={(orderInfo) => setScannerConfig({ isOpen: true, orderId: orderInfo.id, amount: orderInfo.total_price })}
                            onDelete={requestDeleteOrder} // ส่งฟังก์ชันขอลบลงไป
                            onChangeStatusRequest={(orderInfo) => setStatusModal({ isOpen: true, order: orderInfo })} // 🌟 ส่งปุ่มเปิด Pop-up เปลี่ยนสถานะ
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {/* 🌟 Pop-up เปลี่ยนสถานะออเดอร์ใหม่ */}
      {statusModal.isOpen && statusModal.order && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 999 }}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col relative">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <ArrowRightLeft className="text-blue-600" size={20} /> เปลี่ยนสถานะออเดอร์
              </h3>
              <button onClick={() => setStatusModal({ isOpen: false, order: null })} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-3">
              {['New', 'กำลังทำ', 'รับงาน', 'ส่งแล้ว/เสร็จ'].map(st => (
                <button
                  key={st}
                  disabled={statusModal.order?.status === st}
                  onClick={() => executeStatusChange(st)}
                  className={`w-full py-4 rounded-xl text-sm font-black transition-all shadow-sm border flex items-center justify-center ${
                    statusModal.order?.status === st 
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                      : st === 'New' ? 'bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border-blue-200 hover:shadow-lg'
                      : st === 'กำลังทำ' ? 'bg-yellow-50 hover:bg-yellow-500 hover:text-white text-yellow-700 border-yellow-200 hover:shadow-lg'
                      : st === 'รับงาน' ? 'bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 border-purple-200 hover:shadow-lg'
                      : 'bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border-emerald-200 hover:shadow-lg'
                  }`}
                >
                  {statusModal.order?.status === st ? `📌 สถานะปัจจุบัน: ${st}` : `เปลี่ยนเป็น: ${st}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm" style={{ zIndex: 120 }}>
          <div className="bg-white shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 thin-scrollbar rounded-3xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white/80 backdrop-blur-xl sticky top-0 z-10">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">{editingId ? 'แก้ไขออเดอร์ 📝' : 'สร้างออเดอร์ใหม่ ✨'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all cursor-pointer hover:rotate-90 duration-300 active:scale-90"><X size={20} strokeWidth={3}/></button>
            </div>
            
            <form onSubmit={handleSubmitOrder} className="p-6 space-y-6 bg-slate-50/50">
              <div className="grid grid-cols-2 gap-5">
                <div><label className="block text-xs font-black text-slate-500 mb-2 tracking-wide uppercase">ออเดอร์ *</label><input required className="w-full bg-white border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-800 shadow-sm" value={formData.order_number} onChange={e => setFormData({...formData, order_number: e.target.value})} placeholder="เช่น #1024" /></div>
                <div><label className="block text-xs font-black text-slate-500 mb-2 tracking-wide uppercase">ประเภทงาน</label><select className="w-full bg-white border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer font-bold text-slate-800 shadow-sm" value={formData.job_type} onChange={e => setFormData({...formData, job_type: e.target.value})}><option value="ร้าน">🍽️ งานร้าน</option><option value="รับหิ้ว">🛍️ รับหิ้ว</option><option value="รับส่ง">📦 รับส่ง</option><option value="shopee">🧡 Shopee</option></select></div>
              </div>

              <div><label className="block text-xs font-black text-slate-500 mb-2 tracking-wide uppercase">รายการอาหาร / เมนู</label><textarea rows={3} className="w-full bg-white border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none font-bold leading-relaxed text-slate-800 shadow-sm" value={formData.menu} onChange={e => setFormData({...formData, menu: e.target.value})} placeholder={"เช่น\n- กะเพราหมูกรอบ 2\n- ชาเขียว 1"} /></div>
              <div><label className="block text-xs font-black text-slate-500 mb-2 tracking-wide uppercase">รายละเอียดเพิ่มเติม (Note)</label><textarea rows={2} className="w-full bg-white border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none font-medium leading-relaxed text-slate-700 shadow-sm" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} placeholder="ระบุข้อความถึงไรเดอร์..." /></div>

              <div className="pt-2">
                <label className="block text-xs font-black text-slate-500 mb-3 tracking-wide uppercase">แนบรูปภาพ (หลายรูปได้)</label>
                {(existingImages.length > 0 || imagePreviews.length > 0) && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    {existingImages.map((url, i) => (
                      <div key={`exist-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden shadow-sm border border-slate-200 group">
                        <Image src={url} fill sizes="80px" className="object-cover" alt="Existing" />
                        <button type="button" onClick={() => removeExistingImage(i)} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} strokeWidth={3}/></button>
                      </div>
                    ))}
                    {imagePreviews.map((url, i) => (
                      <div key={`new-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden shadow-sm border-2 border-blue-400 border-dashed group">
                        <Image src={url} fill sizes="80px" className="object-cover opacity-80" alt="New" />
                        <button type="button" onClick={() => removeNewImage(i)} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} strokeWidth={3}/></button>
                      </div>
                    ))}
                  </div>
                )}
                <div onDrop={handleDropImage} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onPaste={handlePasteImage} className="border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all bg-white flex flex-col items-center justify-center cursor-pointer shadow-sm">
                  <div className="text-slate-400 text-sm">
                    <ImagePlus className="mx-auto mb-3 text-slate-300" size={36} strokeWidth={1.5}/>
                    <div className="font-bold text-slate-700 text-sm mb-1">ลากไฟล์มาวาง หรือ กด Ctrl+V</div>
                    <div className="my-2 text-xs font-black text-slate-400 uppercase tracking-widest">หรือ</div>
                    <label htmlFor="file-upload" className="inline-block bg-white border border-slate-200 text-slate-600 rounded-xl px-5 py-2 text-xs font-black tracking-wide cursor-pointer hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all mt-1">
                      เลือกไฟล์จากอุปกรณ์
                    </label>
                    <input id="file-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleFileInput} />
                  </div>
                </div>
              </div>

              {formData.job_type !== 'shopee' && (
                <div className="space-y-6 pt-3">
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-2 tracking-wide uppercase">ยอดเก็บเงินรวม (บาท)</label>
                      <input type="text" inputMode="numeric" className="w-full bg-white border border-slate-200 p-4 rounded-2xl text-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-black text-blue-600 shadow-sm" value={formData.total_price} onChange={e => setFormData({...formData, total_price: e.target.value.replace(/[^0-9]/g, '')})} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-2 tracking-wide uppercase">ช่องทางชำระเงิน</label>
                      <select className="w-full bg-white border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer font-bold text-slate-800 shadow-sm" value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})}>
                        <option value="โอน">📱 โอนผ่านบัญชีแล้ว</option><option value="เงินสด">💵 เงินสด (เก็บปลายทาง)</option>
                      </select>
                    </div>
                  </div>

                  <div className="relative p-5 bg-white border border-slate-200/60 rounded-3xl shadow-sm">
                    <label className="text-xs font-black text-blue-600 mb-3 tracking-wide flex items-center uppercase"><Search size={14} className="mr-1.5"/> ค้นหาสถานที่จัดส่ง</label>
                    <input 
                      type="text" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-800 transition-all placeholder-slate-400" 
                      value={formData.location_name} onChange={e => handleLocationSearch(e.target.value)} onFocus={() => { if (unifiedResults.length > 0) setShowSuggestions(true); }} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="พิมพ์ชื่อหอพัก... (ไม่ระบุก็ได้)" 
                    />
                    
                    {showSuggestions && unifiedResults.length > 0 && (
                      <ul className="absolute z-50 bg-white border border-slate-100 rounded-2xl shadow-2xl mt-2 max-h-60 overflow-y-auto divide-y divide-slate-50 thin-scrollbar" style={{ width: 'calc(100% - 2.5rem)' }}>
                        {unifiedResults.map((item, idx) => (
                          <li key={idx} className="p-4 hover:bg-blue-50 cursor-pointer text-sm flex justify-between items-center transition-colors group/item" onClick={() => selectUnifiedResult(item)}>
                            <div className="flex flex-col pr-4">
                              <div className="font-black text-slate-800 flex items-center group-hover/item:text-blue-700 transition-colors">
                                {item.type === 'store' ? <Store size={14} className="mr-2 text-blue-500"/> : <MapIcon size={14} className="mr-2 text-rose-500"/>}
                                {item.name}
                              </div>
                              <div className="text-xs text-slate-500 font-medium truncate mt-1">{item.address}</div>
                            </div>
                            <div className="shrink-0">
                              {item.type === 'store' ? (
                                <span className="text-xs font-black bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg">หมุดร้าน ({item.distanceText})</span>
                              ) : (
                                <span className="text-xs font-black bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200">Google Maps</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-5 pt-5 border-t border-slate-50">
                      <label className="block text-xs font-black text-slate-400 mb-3 tracking-wide uppercase">ตรวจสอบหรือปรับแก้จุดปักหมุด</label>
                      <JobMap lat={formData.lat} lng={formData.lng} savedLocations={savedLocations} onPinChange={(lat, lng) => setFormData({...formData, lat, lng})} />
                    </div>

                    <div className="mt-5 pt-5 border-t border-slate-50">
                      <label className="block text-xs font-black text-slate-600 mb-3 tracking-wide items-center">📍 บันทึกเป็นหมุดใหม่ของร้าน (ตั้งชื่อ)</label>
                      <input type="text" className="w-full bg-blue-50/50 border border-blue-200 p-4 rounded-2xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder-slate-400 font-bold" value={formData.new_pin_name} onChange={e => setFormData({...formData, new_pin_name: e.target.value})} placeholder="ตั้งชื่อสถานที่ให้หมุดนี้..." />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-5 flex gap-4 mt-2">
                <button type="submit" disabled={isUploading} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-blue-600 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 flex justify-center items-center cursor-pointer text-sm uppercase tracking-widest disabled:bg-slate-300 disabled:hover:translate-y-0 disabled:hover:shadow-none active:scale-95">
                  {isUploading ? 'กำลังจัดเก็บข้อมูล...' : (editingId ? 'บันทึกการแก้ไข' : 'สร้างออเดอร์')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center"><ImageIcon size={14} className="mr-1.5" /> รูปภาพแนบ</div>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedViewOrder.image_url.split(',').filter(Boolean).map((imgUrl, i) => (
                      <div key={i} onClick={() => setImageGallery({ urls: selectedViewOrder.image_url!.split(',').filter(Boolean), startIndex: i })} className="block relative h-28 md:h-32 rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-zoom-in group">
                        <Image src={imgUrl} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" alt={`img-${i}`} />
                      </div>
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
                <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">ประเภทงาน:</span><span className="font-black text-slate-700 uppercase px-2.5 py-1 bg-slate-50 rounded-md border border-slate-200">{selectedViewOrder.job_type}</span></div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100"><span className="text-slate-500 font-medium">ยอดเรียกเก็บ:</span><span className="font-black text-blue-600 text-lg">฿{selectedViewOrder.total_price || 0}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">การชำระเงิน:</span><span className={`font-black text-[10px] uppercase px-2.5 py-1 rounded-md ${selectedViewOrder.payment_method === 'โอน' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{selectedViewOrder.payment_method || 'เงินสด'}</span></div>
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
            
            <div className="p-4 md:p-5 shrink-0 bg-white border-t border-slate-100 mt-0 flex flex-col gap-2 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-20">
              {selectedViewOrder.status === 'New' && selectedViewOrder.job_type !== 'รับหิ้ว' && selectedViewOrder.job_type !== 'รับส่ง' && (
                <button onClick={() => handleStartOrder(selectedViewOrder.id)} className="w-full py-3.5 md:py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all cursor-pointer shadow-lg active:scale-95 text-xs md:text-sm uppercase tracking-wide flex items-center justify-center gap-2"><PlayCircle size={18} /> {selectedViewOrder.job_type === 'shopee' ? 'เริ่มเตรียมของ (Shopee)' : 'ยืนยัน: ครัวเริ่มทำอาหาร'}</button>
              )}
              {selectedViewOrder.status === 'กำลังทำ' && selectedViewOrder.job_type !== 'รับหิ้ว' && selectedViewOrder.job_type !== 'รับส่ง' && (
                <button onClick={() => handleFinishOrder(selectedViewOrder.id)} className={`w-full py-3.5 md:py-4 text-white font-black rounded-2xl transition-all cursor-pointer shadow-lg active:scale-95 text-xs md:text-sm uppercase tracking-wide flex items-center justify-center gap-2 ${selectedViewOrder.job_type === 'shopee' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>{selectedViewOrder.job_type === 'shopee' ? <PackageCheck size={18} /> : <ChefHat size={18} />} {selectedViewOrder.job_type === 'shopee' ? 'ยืนยัน: ส่งมอบให้ขนส่งแล้ว' : 'ยืนยัน: ครัวทำเสร็จแล้ว'}</button>
              )}
              <button onClick={() => setSelectedViewOrder(null)} className="w-full py-3 md:py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all cursor-pointer active:scale-95 text-xs uppercase tracking-widest">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 เรียกใช้ SlipScanner Modal */}
      {scannerConfig?.isOpen && (
        <SlipScanner
          orderId={scannerConfig.orderId}
          expectedAmount={scannerConfig.amount}
          onClose={() => setScannerConfig(null)}
          onSuccess={(newImageUrl) => {
            setScannerConfig(null);
            setOrders(orders.map(o => {
              if (o.id === scannerConfig.orderId) {
                const updatedImages = o.image_url ? `${o.image_url},${newImageUrl}` : newImageUrl;
                return { ...o, image_url: updatedImages, slip_status: 'ผ่าน' }; 
              }
              return o;
            }));
            showToast('✅ ตรวจสอบและแนบรูปสลิปเสร็จสมบูรณ์!');
          }}
        />
      )}

      {/* 🌟 Pop-up ยืนยันการลบออเดอร์แบบมีอนิเมชัน */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 999 }}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col p-8 text-center relative">
            <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Trash2 size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">ยืนยันการลบ?</h3>
            <p className="text-sm text-slate-500 font-medium mb-8 whitespace-pre-line leading-relaxed">
              คุณกำลังจะลบออเดอร์นี้ทิ้งแบบถาวร<br/>แน่ใจแล้วใช่ไหมครับ?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all cursor-pointer active:scale-95 text-xs uppercase tracking-widest">
                ยกเลิก
              </button>
              <button onClick={executeDeleteOrder} className="flex-1 py-3.5 text-white font-black rounded-2xl transition-all cursor-pointer shadow-lg active:scale-95 text-xs uppercase tracking-widest bg-rose-500 hover:bg-rose-600 shadow-rose-500/30">
                ลบทิ้งเลย
              </button>
            </div>
          </div>
        </div>
      )}

      {alertModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 999 }}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col p-8 text-center relative">
            <div className="flex justify-center">{alertModal.icon}</div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">{alertModal.title}</h3>
            <p className="text-sm text-slate-500 font-medium mb-8 whitespace-pre-line leading-relaxed">{alertModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setAlertModal({ ...alertModal, isOpen: false })} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all cursor-pointer active:scale-95 text-xs uppercase tracking-widest">{alertModal.cancelText}</button>
              <button onClick={alertModal.type === 'logout' ? executeLogout : executeEndDay} className={`flex-1 py-3.5 text-white font-black rounded-2xl transition-all cursor-pointer shadow-lg active:scale-95 text-xs uppercase tracking-widest ${alertModal.type === 'logout' ? 'bg-slate-800 hover:bg-slate-900' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'}`}>{alertModal.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {imageGallery && (
        <div className="fixed inset-0 bg-gray-900/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200" onClick={() => { setImageGallery(null); setImgScale(1); }} style={{ zIndex: 300 }}>
          <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-50 text-white pointer-events-none">
            <span className="font-bold text-xs bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm">คลิก 2 ครั้งเพื่อซูม / ใช้ปุ่มลูกศรเลื่อน</span>
            <button type="button" onClick={() => { setImageGallery(null); setImgScale(1); }} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-90 pointer-events-auto cursor-pointer"><X size={20} strokeWidth={2.5} /></button>
          </div>
          {imageGallery.urls.length > 1 && (
            <><button onClick={(e) => { e.stopPropagation(); scrollGallery('left'); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 transition-all cursor-pointer hidden md:block"><ChevronLeft size={24} /></button><button onClick={(e) => { e.stopPropagation(); scrollGallery('right'); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 transition-all cursor-pointer hidden md:block"><ChevronRight size={24} /></button></>
          )}
          <div ref={galleryRef} className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory thin-scrollbar">
            {imageGallery.urls.map((url, i) => (
              <div key={i} className={`w-full h-full shrink-0 snap-center p-2 flex overflow-auto ${imgScale > 1 ? 'items-start justify-start' : 'items-center justify-center'}`} onClick={(e) => e.stopPropagation()}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} className={`transition-all duration-300 origin-center cursor-zoom-in shadow-2xl rounded-lg ${imgScale > 1 ? 'm-auto' : ''}`} style={{ width: imgScale > 1 ? `${imgScale * 100}%` : '100%', height: imgScale > 1 ? 'auto' : '100%', objectFit: 'contain', maxWidth: imgScale > 1 ? 'none' : '100%' }} onDoubleClick={(e) => { e.stopPropagation(); setImgScale(prev => prev === 1 ? 2.5 : 1); }} alt={`Gallery ${i}`} />
              </div>
            ))}
          </div>
          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-6 bg-gray-800/80 px-6 py-3 rounded-full backdrop-blur-md shadow-2xl z-50" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setImgScale(prev => Math.max(1, prev - 0.5))} className={`p-2 rounded-full transition-all cursor-pointer ${imgScale <= 1 ? 'text-slate-500 cursor-not-allowed' : 'text-white hover:bg-white/20'}`} disabled={imgScale <= 1}><ZoomOut size={24} /></button>
            <span className="text-white font-black text-sm w-12 text-center">{Math.round(imgScale * 100)}%</span>
            <button onClick={() => setImgScale(prev => Math.min(4, prev + 0.25))} className={`p-2 rounded-full transition-all cursor-pointer ${imgScale >= 4 ? 'text-slate-500 cursor-not-allowed' : 'text-white hover:bg-white/20'}`} disabled={imgScale >= 4}><ZoomIn size={24} /></button>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 pointer-events-none" style={{ zIndex: 40 }}>
        <div className="bg-white/90 backdrop-blur-xl p-2.5 rounded-full shadow-xl border border-slate-100 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-500">
          <div className="bg-blue-600 p-2.5 rounded-full text-white shadow-lg shadow-blue-500/40" style={{ animation: 'pulse 2s ease-in-out infinite' }}><Volume2 size={18}/></div>
          <span className="text-[10px] font-black text-slate-500 pr-3 tracking-widest uppercase">เสียงแจ้งเตือนเปิดแล้ว</span>
        </div>
      </div>

      <style jsx global>{`
        .thin-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .thin-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.05); border-radius: 10px; }
        .thin-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.4); border-radius: 10px; }
        .thin-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.8); }

        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px) rotate(-1deg); } 50% { transform: translateX(2px) rotate(1deg); } 75% { transform: translateX(-2px) rotate(-1deg); } }
        @keyframes wiggle { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
      `}</style>
      
    </div>
  );
}