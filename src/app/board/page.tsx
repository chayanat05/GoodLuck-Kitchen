'use client'
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import OrderCard, { Order } from '../../components/OrderCard';
import JobMap from '../../components/JobMap'; 
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../../lib/supabase';
import { 
  X, ClipboardCheck, ImagePlus, Trash2, MapPin as MapIcon, 
  LogOut, Users, Menu, LayoutDashboard, Search, Store, CheckCircle2,
  MoonStar, AlertTriangle, ChevronDown, ChevronUp, Sun, Volume2,
  Map as MapViewIcon, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,Image as ImageIcon
} from 'lucide-react'; 
import { useJsApiLoader, GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { User as SupabaseUser } from '@supabase/supabase-js';
import Image from 'next/image';

const NOTIFICATION_SOUND_URL = '/audio-shop.mp3';

const COLUMNS = ['New', 'กำลังทำ', 'รับงาน', 'ส่งแล้ว/เสร็จ'];
const LIBRARIES: ("places")[] = ["places"];
const SHOP_LAT = 16.248130;
const SHOP_LNG = 103.242206;

export interface SavedLocation {
  id?: string;
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
}

interface UnifiedSearchResult {
  type: 'store' | 'google';
  place_id?: string; 
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  distanceText?: string;
}

interface RiderLocation {
  id: string;
  username: string;
  last_lat: number | null;
  last_lng: number | null;
  last_seen: string | null;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
};

// 🌟 เปลี่ยน [...] เป็นคลาสมาตรฐาน
const getColumnColor = (colName: string) => {
  switch (colName) {
    case 'New': return 'bg-blue-50/40 border-blue-200 shadow-inner';
    case 'กำลังทำ': return 'bg-amber-50/40 border-amber-200 shadow-inner';
    case 'รับงาน': return 'bg-indigo-50/40 border-indigo-200 shadow-inner';
    case 'ส่งแล้ว/เสร็จ': return 'bg-emerald-50/40 border-emerald-200 shadow-inner';
    default: return 'bg-gray-50/40 border-gray-200';
  }
};

const getColumnHeaderColor = (colName: string) => {
  switch (colName) {
    case 'New': return 'text-blue-700 bg-blue-100/70 border-blue-200 shadow-sm';
    case 'กำลังทำ': return 'text-amber-700 bg-amber-100/70 border-amber-200 shadow-sm';
    case 'รับงาน': return 'text-indigo-700 bg-indigo-100/70 border-indigo-200 shadow-sm';
    case 'ส่งแล้ว/เสร็จ': return 'text-emerald-700 bg-emerald-100/70 border-emerald-200 shadow-sm';
    default: return 'text-gray-700 bg-gray-100/70 border-gray-200 shadow-sm';
  }
};

export default function BoardPage() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
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
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [showRiderMap, setShowRiderMap] = useState<boolean>(false);
  const [ridersLoc, setRidersLoc] = useState<RiderLocation[]>([]);
  const [selectedRiderMapInfo, setSelectedRiderMapInfo] = useState<RiderLocation | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
    language: 'th',
    region: 'TH'
  });

  const [formData, setFormData] = useState({
    order_number: '', job_type: 'ร้าน', menu: '', details: '', 
    location_name: '', new_pin_name: '', address: '', 
    total_price: '', payment_method: 'โอน', lat: null as number | null, lng: null as number | null
  });

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const fetchOrdersAndLocations = async () => {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .or('is_archived.is.null,is_archived.eq.false') 
      .order('created_at', { ascending: false });
      
    if (orderError) console.error("Error fetching orders:", orderError);
    if (orderData) setOrders(orderData as Order[]);

    const { data: locData, error: locError } = await supabase.from('saved_locations').select('*');
    if (locError) console.error("Error fetching locations:", locError);
    if (locData) setSavedLocations(locData as SavedLocation[]);
  };

  const fetchRidersLocation = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, last_lat, last_lng, last_seen')
      .eq('role', 'rider')
      .not('last_lat', 'is', null);
      
    if (error) console.error(error);
    if (data) setRidersLoc(data as RiderLocation[]);
  };

  useEffect(() => {
    notificationAudio.current = new Audio(NOTIFICATION_SOUND_URL);

    const checkAuthAndInit = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }

      const { data: profile, error } = await supabase.from('profiles').select('role, username').eq('id', session.user.id).single();
      if (error || !profile || profile.role !== 'admin') {
        alert('สิทธิ์การเข้าถึงถูกปฏิเสธ! หน้านี้สำหรับแอดมินร้านเท่านั้นครับ');
        window.location.href = '/rider';
        return;
      }

      setCurrentUser(session.user);
      setAdminName(profile.username || 'แอดมิน');
      setIsMounted(true); 
      fetchOrdersAndLocations(); 
    };

    checkAuthAndInit();

    const orderChannel = supabase.channel('public:orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        if (!payload.new.is_archived) {
          notificationAudio.current?.play().catch(() => console.log("รอคลิกหน้าจอถึงจะเล่นเสียงได้"));
          showToast(`🔔 มีออเดอร์ใหม่เข้า! ออเดอร์ที่ ${payload.new.order_number}`);
        }
        fetchOrdersAndLocations();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => { fetchOrdersAndLocations(); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => { fetchOrdersAndLocations(); })
      .subscribe();

    const profileChannel = supabase.channel('public:profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        if (showRiderMap) fetchRidersLocation();
      })
      .subscribe();
      
    return () => { 
      supabase.removeChannel(orderChannel); 
      supabase.removeChannel(profileChannel);
    };
  }, [showRiderMap]);

  useEffect(() => {
    if (showRiderMap) {
      const getInitialLocation = async () => {
        await fetchRidersLocation();
      };
      getInitialLocation();
      
      const interval = setInterval(fetchRidersLocation, 10000); 
      return () => clearInterval(interval);
    }
  }, [showRiderMap]);

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

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `order-photos/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('order-images').upload(filePath, file);
    if (uploadError) { console.error('Upload error:', uploadError); return null; }

    const { data } = supabase.storage.from('order-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleLocationSearch = (text: string) => {
    setFormData({ ...formData, location_name: text });
    
    if (dbTimeoutRef.current) clearTimeout(dbTimeoutRef.current);
    if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);

    if (text.trim().length < 2) {
      setUnifiedResults([]);
      setShowSuggestions(false);
      return;
    }

    dbTimeoutRef.current = setTimeout(async () => {
      const { data: storeData } = await supabase.from('saved_locations').select('*').ilike('name', `%${text}%`).limit(5);
      
      let storeResults: UnifiedSearchResult[] = [];
      if (storeData && storeData.length > 0) {
        storeResults = (storeData as SavedLocation[]).map(loc => ({
          type: 'store' as const, name: loc.name, address: loc.address || 'หมุดบันทึกของร้าน',
          lat: loc.lat, lng: loc.lng, distanceText: `${calculateDistance(SHOP_LAT, SHOP_LNG, loc.lat, loc.lng).toFixed(1)} km`
        }));
      }
      
      setUnifiedResults(storeResults); 
      setShowSuggestions(storeResults.length > 0);
    }, 150);

    googleTimeoutRef.current = setTimeout(async () => {
      if (isLoaded && window.google) {
        const service = new window.google.maps.places.AutocompleteService();
        service.getPlacePredictions({ 
          input: text, componentRestrictions: { country: "th" },
          locationBias: { radius: 20000, center: { lat: SHOP_LAT, lng: SHOP_LNG } }
        }, (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            const googleResults = predictions.slice(0, 3).map(p => ({
              type: 'google' as const, place_id: p.place_id, name: p.structured_formatting.main_text, address: p.structured_formatting.secondary_text || 'สถานที่จาก Google Maps'
            }));
            setUnifiedResults(prev => {
              const combined = [...prev, ...googleResults];
              setShowSuggestions(combined.length > 0);
              return combined;
            });
          }
        });
      }
    }, 1500); 
  };

  const selectUnifiedResult = (item: UnifiedSearchResult) => {
    if (item.type === 'store' && item.lat && item.lng) {
      setFormData({ ...formData, location_name: item.name, address: item.address, lat: item.lat, lng: item.lng });
      setShowSuggestions(false);
    } else if (item.type === 'google' && item.place_id && isLoaded) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ placeId: item.place_id }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const loc = results[0].geometry.location;
          setFormData({
            ...formData, location_name: item.name, address: results[0].formatted_address || item.address, lat: loc.lat(), lng: loc.lng()
          });
        }
        setShowSuggestions(false);
      });
    }
  };

  const openCreateModal = () => {
    setEditingId(null); 
    setFormData({ order_number: '', job_type: 'ร้าน', menu: '', details: '', location_name: '', new_pin_name: '', address: '', total_price: '', payment_method: 'โอน', lat: null, lng: null });
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
    setShowSuggestions(false);
    setIsModalOpen(true);
  };

  const openEditModal = (order: Order) => {
    setEditingId(order.id); 
    setFormData({
      order_number: order.order_number, job_type: order.job_type, menu: (order as Order & { menu?: string }).menu || '', details: order.details || '', location_name: order.address || '', new_pin_name: '', address: '', total_price: order.total_price.toString(), payment_method: order.payment_method || 'โอน', lat: order.lat || null, lng: order.lng || null
    });
    
    if (order.image_url) {
      setExistingImages(order.image_url.split(',').filter(Boolean));
    } else {
      setExistingImages([]);
    }
    
    setImageFiles([]);
    setImagePreviews([]);
    setShowSuggestions(false);
    setIsModalOpen(true);
  };

  const handleAddFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;
    
    setImageFiles(prev => [...prev, ...validFiles]);
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviews(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const handlePasteImage = (event: React.ClipboardEvent) => { 
    const items = event.clipboardData.items; 
    if (!items) return; 
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) { 
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) { 
        const file = items[i].getAsFile(); 
        if (file) files.push(file);
      } 
    } 
    handleAddFiles(files);
  };
  
  const handleDropImage = (event: React.DragEvent) => { 
    event.preventDefault(); 
    event.stopPropagation(); 
    if (event.dataTransfer.files) handleAddFiles(event.dataTransfer.files);
  };
  
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => { 
    if (event.target.files) handleAddFiles(event.target.files);
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setIsUploading(true);

    const filesToUpload = [...imageFiles];
    const currentExisting = [...existingImages];

    let finalOrderNumber = formData.order_number.trim();
    if (formData.job_type === 'shopee' && !finalOrderNumber.startsWith('#')) finalOrderNumber = '#' + finalOrderNumber;

    const cleanPrice = formData.job_type === 'shopee' ? 0 : parseInt(formData.total_price.replace(/[^0-9]/g, ''), 10) || 0;

    const orderData = {
      order_number: finalOrderNumber, 
      job_type: formData.job_type, 
      menu: formData.menu.trim(), 
      details: formData.details.trim() || '', 
      address: formData.job_type === 'shopee' ? null : formData.location_name, 
      image_url: currentExisting.join(','),
      total_price: cleanPrice, 
      payment_method: formData.job_type === 'shopee' ? 'โอน' : formData.payment_method, 
      lat: formData.job_type === 'shopee' ? null : formData.lat, 
      lng: formData.job_type === 'shopee' ? null : formData.lng,
    };

    let targetId = editingId;
    const isEdit = !!editingId;

    if (isEdit) {
      const { data } = await supabase.from('orders').update(orderData).eq('id', editingId).select();
      if (data) setOrders(orders.map(o => o.id === editingId ? data[0] as Order : o));
    } else {
      const { data } = await supabase.from('orders').insert([{ ...orderData, status: 'New' }]).select(); 
      if (data && data.length > 0) {
        targetId = data[0].id;
        setOrders([data[0] as Order, ...orders]);
      }
    }

    setIsUploading(false);
    setIsModalOpen(false);
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
    
    if (isEdit) showToast('อัปเดตข้อมูลสำเร็จ! 📝 (ระบบกำลังโหลดรูปอยู่เบื้องหลัง)');
    else showToast('สร้างออเดอร์สำเร็จ! 🚀 (ระบบกำลังโหลดรูปอยู่เบื้องหลัง)');

    if (!isEdit && formData.new_pin_name.trim() && formData.lat && formData.lng && formData.job_type !== 'shopee') {
      await supabase.from('saved_locations').upsert({
        name: formData.new_pin_name.trim(), address: formData.location_name, lat: formData.lat, lng: formData.lng
      }, { onConflict: 'name' }); 
    }
    
    if (filesToUpload.length > 0 && targetId) {
      const uploadedUrls: string[] = [];
      for (const file of filesToUpload) {
        const url = await uploadImage(file);
        if (url) uploadedUrls.push(url);
      }
      if (uploadedUrls.length > 0) {
        const finalUrls = [...currentExisting, ...uploadedUrls].join(',');
        await supabase.from('orders').update({ image_url: finalUrls }).eq('id', targetId);
        showToast('อัปโหลดรูปภาพทั้งหมดเสร็จสิ้น! 📸');
      }
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    const newOrders = [...orders];
    const draggedIndex = newOrders.findIndex(o => o.id === draggableId);
    const [draggedOrder] = newOrders.splice(draggedIndex, 1);
    
    draggedOrder.status = destination.droppableId as Order['status'];
    
    const itemsInDest = newOrders.filter(o => o.status === destination.droppableId);
    itemsInDest.splice(destination.index, 0, draggedOrder);
    const otherOrders = newOrders.filter(o => o.status !== destination.droppableId);
    
    setOrders([...otherOrders, ...itemsInDest]);

    const updatePayload: { status: string; end_time?: string } = { status: destination.droppableId };
    if (destination.droppableId === 'ส่งแล้ว/เสร็จ') {
      updatePayload.end_time = new Date().toISOString();
    }

    await supabase.from('orders').update(updatePayload).eq('id', draggableId);
    showToast(`ย้ายออเดอร์ไปยัง ${destination.droppableId} แล้ว`);
  };

  const handleStartOrder = async (orderId: string) => {
    const { data, error } = await supabase.from('orders').update({ status: 'กำลังทำ' }).eq('id', orderId).select();
    if (error) console.error(error);
    if (data) {
      setOrders(orders.map(o => o.id === orderId ? data[0] as Order : o));
      showToast('ครัวกำลังทำอาหาร! 🍳');
    }
  };

  const handleFinishOrder = async (orderId: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    const isShopee = targetOrder?.job_type === 'shopee';
    
    const nextStatus = isShopee ? 'ส่งแล้ว/เสร็จ' : 'รับงาน';
    const updateData: { status: string; end_time?: string } = { status: nextStatus };
    
    if (isShopee) {
      updateData.end_time = new Date().toISOString();
    }

    const { data, error } = await supabase.from('orders').update(updateData).eq('id', orderId).select();
    if (error) console.error(error);
    if (data) {
      setOrders(orders.map(o => o.id === orderId ? data[0] as Order : o));
      showToast(isShopee ? 'ส่งมอบให้ขนส่ง Shopee สำเร็จ! 📦' : 'อาหารเสร็จแล้ว รอไรเดอร์มารับ! 🛵');
    }
  };

  const handleEndDay = async () => {
    if (orders.length === 0) {
      alert('กระดานว่างเปล่าอยู่แล้วครับ ไม่มีออเดอร์ให้ปิดยอด');
      return;
    }
    const confirmFirst = window.confirm('⚠️ คุณต้องการ "ปิดยอดจบวัน" ใช่หรือไม่?\n\nออเดอร์ทั้งหมดในกระดานจะถูกซ่อน (แต่ยังดูย้อนหลังได้ในหน้าสถิติ)');
    if (!confirmFirst) return;
    const confirmSecond = window.confirm('🛑 ยืนยันการปิดยอดอีกครั้ง! เมื่อกดตกลง ออเดอร์ทั้งหมดจะหายไปจากกระดานทันที');
    if (!confirmSecond) return;

    const { error } = await supabase.from('orders').update({ is_archived: true }).neq('is_archived', true); 

    if (error) {
      console.error(error);
      showToast('เกิดข้อผิดพลาดในการปิดยอด');
    } else {
      showToast('🌙 ปิดยอดจบวันเรียบร้อย กระดานพร้อมสำหรับวันใหม่!');
      setIsMenuOpen(false);
      setShowAdvanced(false); 
      fetchOrdersAndLocations(); 
    }
  };

  const handleDeleteOrder = async () => {
    if (!editingId) return;
    if (window.confirm('ลบออเดอร์นี้ถาวร?')) {
      const { error } = await supabase.from('orders').delete().eq('id', editingId);
      if (!error) { setOrders(orders.filter(o => o.id !== editingId)); setIsModalOpen(false); showToast('ลบออเดอร์สำเร็จ 🗑️'); }
    }
  };

  const handleLogout = async () => {
    if (window.confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
  };

  const filteredOrders = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return orders.filter(order => 
      (order.order_number?.toLowerCase() || '').includes(q) ||
      (order.address?.toLowerCase() || '').includes(q) ||
      (order.rider_name?.toLowerCase() || '').includes(q)
    );
  }, [orders, debouncedQuery]);

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diffMins = (new Date().getTime() - new Date(lastSeen).getTime()) / 60000;
    return diffMins < 5; 
  };

  if (!currentUser || !isMounted) return <div className="min-h-screen bg-gray-50 flex justify-center items-center font-bold text-gray-400 animate-pulse">กำลังโหลดข้อมูลร้าน...</div>;

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden font-sans relative">
      
      <div 
        className={`fixed top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 flex items-center bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl ${toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-20 opacity-0 scale-95 pointer-events-none'}`} 
        style={{ zIndex: 150 }}
      >
        <CheckCircle2 size={18} className="text-green-400 mr-2" />
        <span className="font-bold text-sm tracking-wide">{toast.message}</span>
      </div>

      <div className="shrink-0 p-3 md:p-2 pb-0 z-20">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-3 mb-0 bg-white/80 backdrop-blur-xl p-2 rounded-2xl shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button onClick={() => setIsMenuOpen(true)} className="p-2 bg-slate-100 hover:bg-blue-100 rounded-xl transition-all cursor-pointer text-slate-600 hover:text-blue-700 active:scale-95"><Menu size={18} /></button>
            <h1 className="text-lg font-black text-slate-800 flex items-center whitespace-nowrap tracking-tight">KANBAN <span className="text-blue-600 ml-1.5">BOARD</span></h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center w-full lg:w-auto gap-3">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={14} className="text-slate-400" /></div>
              <input type="text" placeholder="ค้นหาเลขออเดอร์, สถานที่, ไรเดอร์..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium shadow-inner"/>
            </div>
            
            <button onClick={() => setShowRiderMap(true)} className="w-full sm:w-auto px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95">
              <MapViewIcon size={14} className="animate-pulse" /> ดูพิกัดไรเดอร์
            </button>

            <button onClick={openCreateModal} className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all duration-300 cursor-pointer active:scale-95 shadow-md">+ สร้างออเดอร์</button>
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
              
              <div className="pt-6 border-t border-slate-100 mt-4">
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex items-center justify-between p-4 text-slate-400 hover:bg-slate-50 rounded-2xl transition-all font-bold cursor-pointer border border-transparent hover:border-slate-200">
                  <span className="flex items-center text-sm"><AlertTriangle size={18} className="mr-3"/> ตั้งค่าขั้นสูง (อันตราย)</span>
                  {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                
                {showAdvanced && (
                  <div className="mt-3 p-3 bg-red-50/50 rounded-2xl border border-red-100 animate-in fade-in slide-in-from-top-2 duration-300">
                    <button onClick={handleEndDay} className="w-full flex items-center justify-center p-4 text-red-600 bg-white hover:bg-red-50 rounded-xl transition-all font-black border border-red-200 shadow-sm cursor-pointer active:scale-95">
                      <MoonStar size={20} className="mr-3" /> ปิดยอดจบวัน (ล้างกระดาน)
                    </button>
                    <p className="text-xs text-red-400 mt-3 text-center px-2 font-bold uppercase tracking-wider">*เมื่อกดปิดยอด ออเดอร์ทั้งหมดจะถูกซ่อนจากกระดานทันที</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button onClick={() => { setIsMenuOpen(false); handleLogout(); }} className="w-full flex items-center justify-center p-4 text-red-500 bg-white border border-red-100 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all font-black cursor-pointer shadow-sm active:scale-95"><LogOut size={18} className="mr-2" />ออกจากระบบ</button>
            </div>
          </div>
        </div>
      )}

      {showRiderMap && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm" style={{ zIndex: 120 }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col" style={{ height: '85vh' }}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <MapViewIcon className="text-indigo-600" size={24} /> ติดตามพิกัดไรเดอร์ (Live)
              </h3>
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

            <div className="p-4 bg-white shrink-0 border-t border-slate-100 flex gap-2 overflow-x-auto hide-scrollbar">
              <div className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-100 shrink-0 flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-full shadow-inner"></div> ร้านของเรา</div>
              <div className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100 shrink-0 flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-full shadow-inner animate-pulse"></div> ไรเดอร์</div>
              <span className="text-xs text-slate-400 my-auto ml-auto pl-4 whitespace-nowrap">*พิกัดอัปเดตทุก 30 วินาที</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 p-4 md:p-6 pt-0 overflow-hidden z-10 flex flex-col">
        {orders.length === 0 && !searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full bg-white/40 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200 shadow-sm animate-in fade-in duration-500">
            <div className="w-28 h-28 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-8 shadow-inner border border-blue-100" style={{ animation: 'spin 10s linear infinite' }}>
              <Sun size={56} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">เริ่มต้นวันใหม่! 🌤️</h2>
            <p className="text-slate-500 font-medium mb-10 text-center max-w-md leading-relaxed">กระดานว่างเปล่าพร้อมรับออเดอร์สำหรับวันนี้แล้ว<br/>กดปุ่มด้านล่างเพื่อเริ่มเปิดออเดอร์แรกของวันได้เลยครับ</p>
            <button 
              onClick={openCreateModal}
              className="px-10 py-5 bg-blue-600 text-white font-black rounded-3xl hover:bg-blue-700 hover:-translate-y-1 transition-all duration-300 flex items-center cursor-pointer tracking-wider uppercase text-sm active:scale-95 shadow-xl shadow-blue-600/30"
            >
              <ClipboardCheck size={22} className="mr-3" />
              เปิดร้าน / สร้างออเดอร์แรก
            </button>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 min-h-0">
              {COLUMNS.map(col => {
                const colOrders = filteredOrders.filter(o => o.status === col);
                return (
                  <Droppable key={col} droppableId={col}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className={`p-3 rounded-3xl border-2 flex flex-col h-full min-h-0 transition-colors ${getColumnColor(col)}`}>
                        
                        <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                          <h2 className={`font-black text-xs px-3 py-1.5 rounded-lg uppercase tracking-widest border ${getColumnHeaderColor(col)}`}>{col}</h2>
                          <span className="text-xs font-black text-slate-500 bg-white px-2.5 py-0.5 rounded-lg shadow-sm border border-slate-100">{colOrders.length}</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto min-h-0 pb-4 px-1 hide-scrollbar">
                          {colOrders.map((order, index) => (
                            <Draggable key={order.id} draggableId={order.id} index={index}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`transition-all duration-300 relative group ${snapshot.isDragging ? 'scale-105 rotate-3 shadow-2xl z-50 ring-4 ring-blue-500/20 rounded-2xl' : ''}`}>
                                  <OrderCard 
                                    order={order} 
                                    onEdit={openEditModal} 
                                    onStart={handleStartOrder} 
                                    onFinish={handleFinishOrder} 
                                    onViewDetails={() => setSelectedViewOrder(order)} 
                                    onViewImages={(urls, startIndex) => setImageGallery({ urls, startIndex })} 
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm" style={{ zIndex: 120 }}>
          <div className="bg-white shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 hide-scrollbar rounded-3xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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
                    <label className="text-xs font-black text-blue-600 mb-3 tracking-wide flex items-center uppercase">
                      <Search size={14} className="mr-1.5"/> ค้นหาสถานที่จัดส่ง
                    </label>
                    <input 
                      type="text" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-800 transition-all placeholder-slate-400" 
                      value={formData.location_name} onChange={e => handleLocationSearch(e.target.value)} 
                      onFocus={() => { if (unifiedResults.length > 0) setShowSuggestions(true); }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} 
                      placeholder="พิมพ์ชื่อหอพัก... (ไม่ระบุก็ได้)" 
                    />
                    
                    {showSuggestions && unifiedResults.length > 0 && (
                      <ul className="absolute z-50 bg-white border border-slate-100 rounded-2xl shadow-2xl mt-2 max-h-60 overflow-y-auto divide-y divide-slate-50 hide-scrollbar" style={{ width: 'calc(100% - 2.5rem)' }}>
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
                      <label className="block text-xs font-black text-slate-600 mb-3 tracking-wide items-center">
                        📍 บันทึกเป็นหมุดใหม่ของร้าน (ตั้งชื่อ)
                      </label>
                      <input 
                        type="text" 
                        className="w-full bg-blue-50/50 border border-blue-200 p-4 rounded-2xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder-slate-400 font-bold" 
                        value={formData.new_pin_name} 
                        onChange={e => setFormData({...formData, new_pin_name: e.target.value})} 
                        placeholder="ตั้งชื่อสถานที่ให้หมุดนี้..." 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-5 flex gap-4 mt-2">
                <button type="submit" disabled={isUploading} className="bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-blue-600 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 flex justify-center items-center cursor-pointer text-sm uppercase tracking-widest disabled:bg-slate-300 disabled:hover:translate-y-0 disabled:hover:shadow-none active:scale-95" style={{ flex: 1.5 }}>
                  {isUploading ? 'กำลังจัดเก็บข้อมูล...' : (editingId ? 'บันทึกการแก้ไข' : 'สร้างออเดอร์')}
                </button>
                {editingId && (
                  <button type="button" onClick={handleDeleteOrder} className="bg-rose-50 text-rose-600 px-6 rounded-2xl hover:bg-rose-500 hover:text-white transition-all duration-300 border border-rose-100 flex items-center justify-center cursor-pointer shadow-sm hover:shadow-lg active:scale-95" style={{ flex: 0.5 }}><Trash2 size={20} /></button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedViewOrder && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm" style={{ zIndex: 200 }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center"><ClipboardCheck size={20} className="mr-2 text-blue-600"/> รายละเอียดออเดอร์</h3>
              <button type="button" onClick={() => setSelectedViewOrder(null)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all cursor-pointer hover:rotate-90 duration-300 active:scale-90"><X size={20} strokeWidth={3}/></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto bg-slate-50/30 hide-scrollbar">
              <div className="flex justify-between items-end border-b border-slate-100 pb-5">
                <div>
                  <div className="text-[10px] font-black text-slate-400 mb-1 tracking-wider uppercase">เลขที่ออเดอร์</div>
                  <div className="text-3xl font-black text-slate-800 tracking-tighter">{selectedViewOrder.order_number}</div>
                </div>
                <div className="text-right mb-1">
                  <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg shadow-sm border ${getRiderStatusDisplay(selectedViewOrder.status).color}`}>
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
                    {selectedViewOrder.image_url.split(',').filter(Boolean).map((imgUrl, i) => (
                      <div key={i} onClick={() => setImageGallery({ urls: selectedViewOrder.image_url!.split(',').filter(Boolean), startIndex: i })} className="block relative h-32 rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-zoom-in group">
                        <Image src={imgUrl} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" alt={`img-${i}`} />
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
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60"><span className="text-slate-500 font-medium">ยอดเรียกเก็บ:</span><span className="font-black text-blue-600 text-lg">฿{selectedViewOrder.total_price || 0}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">การชำระเงิน:</span><span className={`font-black text-[10px] uppercase px-2.5 py-1 rounded-md ${selectedViewOrder.payment_method === 'โอน' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{selectedViewOrder.payment_method || 'เงินสด'}</span></div>
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

      {/* 🌟 3. แกลเลอรี่รูปภาพแบบปัดซ้ายขวา และซูมได้ */}
      {imageGallery && (
        <div className="fixed inset-0 bg-gray-900/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200" onClick={() => { setImageGallery(null); setImgScale(1); }} style={{ zIndex: 300 }}>
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

          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-6 bg-gray-800/80 px-6 py-3 rounded-full backdrop-blur-md shadow-2xl z-50" onClick={(e) => e.stopPropagation()}>
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

      <div className="fixed bottom-6 right-6 pointer-events-none" style={{ zIndex: 40 }}>
        <div className="bg-white/90 backdrop-blur-xl p-2.5 rounded-full shadow-xl border border-slate-100 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-500">
          <div className="bg-blue-600 p-2.5 rounded-full text-white shadow-lg shadow-blue-500/40" style={{ animation: 'pulse 2s ease-in-out infinite' }}><Volume2 size={18}/></div>
          <span className="text-[10px] font-black text-slate-500 pr-3 tracking-widest uppercase">เสียงแจ้งเตือนเปิดแล้ว</span>
        </div>
      </div>

      <style jsx global>{`
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
// 🌟 เติมฟังก์ชันนี้ไว้ล่างสุดของไฟล์ครับ
function getRiderStatusDisplay(status: string) {
  if (status === 'New') return { color: 'bg-blue-50 text-blue-600 border-blue-200' };
  if (status === 'กำลังทำ') return { color: 'bg-amber-50 text-amber-600 border-amber-200' };
  if (status === 'รับงาน') return { color: 'bg-indigo-50 text-indigo-600 border-indigo-200' };
  if (status === 'ส่งแล้ว/เสร็จ') return { color: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
  return { color: 'bg-gray-50 text-gray-600 border-gray-200' };
}