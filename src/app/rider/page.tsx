"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import {
  MapPin,
  CheckCircle2,
  Clock,
  Map as MapIcon,
  X,
  History,
  ClipboardList,
  Zap,
  AlertTriangle,
  Info,
  Menu,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  ChefHat,
  MapPinned,
  Eye,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Store,
  Lock 
} from "lucide-react";
import { Order } from "../../components/OrderCard";
import { User as SupabaseUser } from "@supabase/supabase-js";
import DashboardView from "./DashboardView";
import Image from "next/image";
import { useJsApiLoader, GoogleMap, MarkerF, InfoWindowF } from "@react-google-maps/api"; 

const LIBRARIES: "places"[] = ["places"];
const SHOP_LAT = 16.24813;
const SHOP_LNG = 103.242206;

type PopupConfig = {
  isOpen: boolean;
  type: "alert" | "confirm";
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  icon?: "success" | "error" | "warning" | "info";
};

interface RiderLocation {
  id: string;
  username: string;
  last_lat: number | null;
  last_lng: number | null;
  last_seen: string | null;
}

interface Branch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cut_off_hour: number;
}

// 🌟 สร้าง Type ใหม่เพื่อต่อยอดจาก Order เดิมโดยไม่ใช้ any
type RiderOrder = Order & { branch_id?: string | null };

export default function RiderPage() {
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  // 🌟 กู้คืนตัวแปร shopLocation
  const [shopLocation, setShopLocation] = useState<{ lat: number; lng: number }>({ lat: SHOP_LAT, lng: SHOP_LNG });
  
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState<boolean | null>(null);
  
  const [orderLimit, setOrderLimit] = useState<number>(3); 

  const [activeTab, setActiveTab] = useState<"available" | "jobs" | "history">("available");
  
  const [selectedViewOrder, setSelectedViewOrder] = useState<RiderOrder | null>(null);
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [imageGallery, setImageGallery] = useState<{ urls: string[]; startIndex: number } | null>(null);
  const [imgScale, setImgScale] = useState(1);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<PopupConfig>({ isOpen: false, type: "alert", title: "", message: "" });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const [showContactInfo, setShowContactInfo] = useState(false);

  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [riderName, setRiderName] = useState<string>("กำลังโหลด...");

  const [myBranchId, setMyBranchId] = useState<string | null>(null);
  const [cutOffHour, setCutOffHour] = useState<number>(4);
  const lastGpsUpdateRef = useRef<number>(0);

  const [isCheckingAuth, setIsCheckingAuth] = useState(true); 
  const [showRiderMap, setShowRiderMap] = useState<boolean>(false);
  const [ridersLoc, setRidersLoc] = useState<RiderLocation[]>([]);
  const [selectedRiderMapInfo, setSelectedRiderMapInfo] = useState<RiderLocation | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
    language: "th",
    region: "TH",
  });

  const showAlert = (title: string, message: string, icon: "success" | "error" | "warning" | "info" = "info") => setPopup({ isOpen: true, type: "alert", title, message, icon });
  
  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = "ยืนยัน", cancelText = "ยกเลิก") =>
    setPopup({ isOpen: true, type: "confirm", title, message, onConfirm, confirmText, cancelText, icon: "warning" });
  
  const closePopup = () => setPopup((prev) => ({ ...prev, isOpen: false }));

  const fetchOrdersAndBranches = useCallback(async (userId: string) => {
    if (!userId) return;

    const { data: limitData } = await supabase.from("store_settings").select("rider_order_limit").eq("id", 1).single();
    if (limitData && limitData.rider_order_limit) setOrderLimit(limitData.rider_order_limit);

    const { data: bData } = await supabase.from("branches").select("*").order("created_at", { ascending: true });
    if (bData) setBranches(bData as Branch[]);

    const { data: myJobs } = await supabase
      .from("orders")
      .select("*")
      .eq("rider_id", userId)
      .order("created_at", { ascending: false });

    const { data: availableJobs } = await supabase
      .from("orders")
      .select("*")
      .is("rider_id", null)
      .or("job_type.is.null,job_type.neq.shopee")
      .in("status", ["New", "กำลังทำ", "รับงาน"])
      .order("created_at", { ascending: false });

    const jobs1 = availableJobs || [];
    const jobs2 = myJobs || [];

    const combined = [...jobs1, ...jobs2];
    const uniqueOrders = Array.from(new Map(combined.map((item) => [item.id, item])).values());
    setOrders(uniqueOrders as RiderOrder[]);
  }, []);

  const fetchRidersLocation = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, last_lat, last_lng, last_seen")
      .not("last_lat", "is", null);

    if (data) setRidersLoc(data as RiderLocation[]);
  }, []);

  useEffect(() => {
    let currentUserId = "";

    const checkAuthAndInit = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, branch_id")
        .eq("id", session.user.id)
        .single();

      setCurrentUser(session.user);
      currentUserId = session.user.id;
      setRiderName(profile?.username || "ไรเดอร์");

      if (profile?.branch_id) {
        setMyBranchId(profile.branch_id);
        const { data: branchData } = await supabase.from("branches").select("lat, lng, cut_off_hour").eq("id", profile.branch_id).single();
        if (branchData) {
          setCutOffHour(branchData.cut_off_hour || 4);
          setShopLocation({ lat: branchData.lat, lng: branchData.lng });
        }
        
        await fetchOrdersAndBranches(currentUserId);
        setIsCheckingAuth(false);
      } else {
        setMyBranchId(null);
        setIsCheckingAuth(false);
      }
    };

    checkAuthAndInit();

    const riderChannel = supabase
      .channel("public:orders:rider")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (currentUserId) fetchOrdersAndBranches(currentUserId);
      })
      .subscribe();

    return () => { supabase.removeChannel(riderChannel); };
  }, [fetchOrdersAndBranches]);

  useEffect(() => {
    if (!currentUser) return;
    if (!navigator.geolocation) {
      setGpsEnabled(false);
      setLocationError("เบราว์เซอร์ไม่รองรับ GPS");
      return;
    }

    // 🌟 ฟังก์ชันแยกสำหรับขอพิกัดปัจจุบันก่อน แล้วค่อยไป watch
    const initLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsEnabled(true);
          setLocationError(null);
          setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          // บันทึกลงฐานข้อมูลรอบแรกทันที
          supabase.from("profiles").update({
            last_lat: position.coords.latitude,
            last_lng: position.coords.longitude,
            last_seen: new Date().toISOString(),
          }).eq("id", currentUser.id);
        },
        (error) => {
          console.error("GPS Init Error:", error);
          setGpsEnabled(false);
          handleLocationError(error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    };

    // 🌟 ฟังก์ชันจัดการ Error ให้ชัดเจนขึ้น
    const handleLocationError = (error: GeolocationPositionError) => {
      let msg = "กรุณาเปิด GPS";
      switch(error.code) {
        case error.PERMISSION_DENIED: msg = "คุณไม่อนุญาตให้ใช้ GPS กรุณาเปิดการตั้งค่า Safari/เบราว์เซอร์"; break;
        case error.POSITION_UNAVAILABLE: msg = "ข้อมูลพิกัดไม่พร้อมใช้งานในขณะนี้"; break;
        case error.TIMEOUT: msg = "หมดเวลาค้นหาพิกัด (ลองเปิดแอปใหม่)"; break;
      }
      setLocationError(msg);
      // ถ้าระบบหาไม่เจอ ให้เคลียร์ State หมุนๆ ออกด้วย
      if(error.code !== error.PERMISSION_DENIED) {
        setMyLocation(null); 
      }
    };

    initLocation(); // ดึงรอบแรกก่อนเลย

    // 🌟 เริ่ม Watch แบบปรับ Option ใหม่
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        setGpsEnabled(true);
        setLocationError(null);
        setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });

        const now = Date.now();
        if (now - lastGpsUpdateRef.current > 30000) {
          lastGpsUpdateRef.current = now;
          await supabase.from("profiles").update({
            last_lat: position.coords.latitude,
            last_lng: position.coords.longitude,
            last_seen: new Date().toISOString(),
          }).eq("id", currentUser.id);
        }
      },
      (error) => {
        console.error("GPS Watch Error:", error);
        // ถ้ายกเลิกสิทธิ์ระหว่างทาง
        if(error.code === error.PERMISSION_DENIED) {
          setGpsEnabled(false);
        }
        handleLocationError(error);
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 10000, // บน iOS การให้มีอายุข้อมูลเก่าได้นิดหน่อยจะช่วยลดอาการค้าง
        timeout: 20000 
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentUser]);

  useEffect(() => {
    if (showRiderMap) {
      // ✅ แก้ไข ESLint Warning react-hooks/set-state-in-effect โดยการครอบฟังก์ชัน
      const initMap = async () => {
        await fetchRidersLocation();
      };
      initMap();
      const interval = setInterval(fetchRidersLocation, 10000);
      const profileChannel = supabase.channel("public:profiles")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => fetchRidersLocation())
        .subscribe();
      return () => { clearInterval(interval); supabase.removeChannel(profileChannel); };
    }
  }, [showRiderMap, fetchRidersLocation]);

  useEffect(() => {
    if (imageGallery && galleryRef.current) {
      const target = galleryRef.current.children[imageGallery.startIndex] as HTMLElement;
      if (target) {
        galleryRef.current.scrollLeft = target.offsetLeft;
      }
    }
  }, [imageGallery]);

  const scrollGallery = (direction: "left" | "right") => {
    setImgScale(1);
    if (galleryRef.current) {
      const { clientWidth } = galleryRef.current;
      const scrollAmount = direction === "left" ? -clientWidth : clientWidth;
      galleryRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleTakeJob = async (order: RiderOrder) => {
    if (!currentUser) return;
    
    if (activeOrders.length >= orderLimit) {
      showAlert("รับงานไม่ได้ ❌", `แอดมินจำกัดให้ถือบิลพร้อมกันได้ไม่เกิน ${orderLimit} งานครับ ส่งของในมือให้เสร็จก่อนนะ`, "warning");
      return;
    }

    if (!myLocation) {
      showAlert("แจ้งเตือน", "กำลังค้นหาตำแหน่งของคุณ กรุณารอสักครู่", "warning");
      return;
    }

    const orderBranch = branches.find(b => b.id === order.branch_id);
    if (orderBranch && orderBranch.lat !== 0) {
      const distance = getDistanceFromLatLonInKm(myLocation.lat, myLocation.lng, orderBranch.lat, orderBranch.lng) * 1000;
      if (distance > 100) {
        showAlert("คุณอยู่ไกลจากร้านเกินไป", `ต้องอยู่ในรัศมี 100 เมตรจากร้าน (${orderBranch.name}) เพื่อรับงาน (ห่าง ${Math.round(distance)} เมตร)`, "error");
        return;
      }
    }

    const { data } = await supabase
      .from("orders")
      .update({ rider_id: currentUser.id, rider_name: riderName, start_time: new Date().toISOString() })
      .eq("id", order.id)
      .is("rider_id", null)
      .select();
      
    if (data && data.length > 0) {
      showAlert("จองงานสำเร็จ!", "งานอยู่ในความดูแลของคุณแล้วครับ 🎉", "success");
      fetchOrdersAndBranches(currentUser.id);
    } else {
      showAlert("อ๊ะ!", "งานนี้มีเพื่อนไรเดอร์ท่านอื่นกดรับไปก่อนแล้วครับ 😢", "error");
      fetchOrdersAndBranches(currentUser.id);
    }
  };

  const handleRiderAction = async (order: RiderOrder) => {
    let nextStatus = "";
    let confirmMsg = "";
    
    if (order.status === "รับงาน") { nextStatus = "ส่งแล้ว/เสร็จ"; confirmMsg = "ส่งอาหารให้ลูกค้าเรียบร้อยแล้วใช่ไหม?"; }

    if (!nextStatus) return;

    showConfirm(
      "ยืนยันการดำเนินการ", confirmMsg,
      async () => {
        closePopup();
        const updateData: { status: string; end_time?: string } = { status: nextStatus };
        if (nextStatus === "ส่งแล้ว/เสร็จ") updateData.end_time = new Date().toISOString();
        const { error } = await supabase.from("orders").update(updateData).eq("id", order.id);
        if (error) showAlert("เกิดข้อผิดพลาด", "อัปเดตไม่สำเร็จ", "error");
        else fetchOrdersAndBranches(currentUser!.id);
      }, "ยืนยัน", "ยกเลิก"
    );
  };

  const handleDropJob = async (orderId: string) => {
    if (!currentUser) return;
    showConfirm(
      "คืนงานใช่ไหม?", "งานนี้จะถูกปลดล็อกให้ไรเดอร์ท่านอื่นแย่งรับได้นะครับ",
      async () => {
        closePopup();
        const { error } = await supabase.from("orders").update({ rider_id: null, rider_name: null, start_time: null }).eq("id", orderId);
        if (error) showAlert("เกิดข้อผิดพลาด", "ไม่สามารถคืนงานได้", "error");
        else {
          showAlert("เรียบร้อย!", "คืนงานให้ระบบกลางแล้ว", "success");
          setActiveTab("available");
          fetchOrdersAndBranches(currentUser.id);
        }
      }, "คืนงาน", "ยกเลิก"
    );
  };

  const calculateRoute = (order: RiderOrder) => {
    if (!myLocation) { showAlert("รอก่อนนะ", "กำลังหาตำแหน่งของคุณอยู่ครับ 📡", "warning"); return; }
    if (!order.lat || !order.lng) { showAlert("ขออภัย", "ออเดอร์นี้แอดมินไม่ได้ปักพิกัดไว้ครับ", "error"); return; }
    const url = `https://www.google.com/maps/dir/?api=1&origin=${myLocation.lat},${myLocation.lng}&destination=${order.lat},${order.lng}&travelmode=driving`;
    window.open(url, "_blank");
  };

  const handleLogout = () => {
    showConfirm(
      "ออกจากระบบ?", "คุณต้องการออกจากระบบใช่หรือไม่?",
      async () => { closePopup(); await supabase.auth.signOut(); window.location.href = "/login"; }, "ออกจากระบบ", "ยกเลิก"
    );
  };

  const availableOrders = orders.filter((o) => !o.rider_id && ["New", "กำลังทำ", "รับงาน"].includes(o.status));
  const activeOrders = orders.filter((o) => o.rider_id === currentUser?.id && o.status !== "ส่งแล้ว/เสร็จ");
  const completedOrders = orders.filter((o) => o.rider_id === currentUser?.id && o.status === "ส่งแล้ว/เสร็จ");

  const shiftCompletedOrders = useMemo(() => {
    const now = new Date();
    const shiftStart = new Date(now);
    if (now.getHours() < cutOffHour) { shiftStart.setDate(shiftStart.getDate() - 1); }
    shiftStart.setHours(cutOffHour, 0, 0, 0);

    return completedOrders.filter((order) => {
      const orderDate = new Date(order.end_time || order.created_at);
      return orderDate >= shiftStart;
    });
  }, [completedOrders, cutOffHour]);

  // 🌟 กู้คืนฟังก์ชันสีสถานะ
  const getRiderStatusDisplay = (status: string) => {
    if (status === "New") return { text: "ออเดอร์เข้าใหม่", color: "bg-blue-500/20 text-blue-300 border-blue-400/30" };
    if (status === "กำลังทำ") return { text: "ครัวกำลังทำอาหาร", color: "bg-amber-500/20 text-amber-300 border-amber-400/30", icon: <ChefHat size={12} className="mr-1" /> };
    if (status === "รับงาน") return { text: "ของเสร็จแล้ว! ไปรับได้เลย", color: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30 shadow-sm animate-pulse", icon: <PackageCheck size={12} className="mr-1" /> };
    return { text: status, color: "bg-slate-700/50 text-slate-300 border-slate-500/50" };
  };

  const renderPopupIcon = (type: string) => {
    switch (type) {
      case "success": return <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 mb-4 animate-bounce"><CheckCircle2 className="h-10 w-10 text-emerald-600" /></div>;
      case "error": return <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-rose-100 mb-4 animate-bounce"><X className="h-10 w-10 text-rose-600" /></div>;
      case "warning": return <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-amber-100 mb-4 animate-bounce"><AlertTriangle className="h-10 w-10 text-amber-600" /></div>;
      default: return <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-blue-100 mb-4 animate-bounce"><Info className="h-10 w-10 text-blue-600" /></div>;
    }
  };

  const renderCard = (order: RiderOrder, idx: number, branch?: Branch) => {
    const isMainBranch = branch?.id === branches[0]?.id; 
    const cardBgClass = isMainBranch 
      ? "bg-gradient-to-br from-red-500 to-red-600 border-red-700 shadow-red-500/30" 
      : "bg-gradient-to-br from-blue-900 to-slate-900 border-blue-950 shadow-blue-900/30";
    
    return (
      <div key={order.id} className={`${isCompact ? "w-[42vw] sm:w-42.5" : "w-[82vw] sm:w-[320px]"} h-full shrink-0 snap-center rounded-2xl shadow-md border overflow-hidden flex flex-col transition-all duration-300 ${cardBgClass}`} style={{ animation: `fadeIn 0.5s ease-out ${idx * 0.05}s both` }}>
        <div className="flex-1 overflow-y-auto hide-scrollbar p-2.5 sm:p-3 relative border-b border-white/10 flex flex-col">
          
          <div className="flex justify-between items-start mb-2 shrink-0 gap-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className={`${isCompact ? "text-[14px]" : "text-lg"} font-black text-white tracking-tight leading-none drop-shadow-sm mr-1`}>
                {order.order_number}
              </span>
              <span className="text-[8px] sm:text-[9px] px-1.5 py-0.5 font-black rounded uppercase shadow-sm bg-black/30 text-white truncate max-w-20">
                {branch?.name || "ไม่ระบุ"}
              </span>
              <span className="text-[8px] sm:text-[9px] px-1.5 py-0.5 font-black rounded uppercase shadow-sm bg-white/20 text-white">
                {order.job_type}
              </span>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              {!isCompact && (
                <button onClick={(e) => { e.stopPropagation(); setSelectedViewOrder(order); setShowContactInfo(false); }} className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[8px] uppercase font-black flex items-center hover:bg-white/30 active:scale-95 transition-colors">
                  <Eye size={10} className="mr-0.5" /> ข้อมูล
                </button>
              )}
              <span className="text-[8px] sm:text-[9px] px-1.5 py-0.5 font-black rounded uppercase shadow-sm bg-white/20 text-white">
                {order.status === "รับงาน" ? "ไปส่งเลย!" : order.status}
              </span>
            </div>
          </div>

          {order.address && (
            <div className={`mb-2 shrink-0 flex items-start text-[10px] sm:text-xs p-2 text-white bg-black/20 border border-white/10 rounded-lg font-bold shadow-inner`}>
              <MapPin size={isCompact ? 12 : 14} className="mr-1.5 mt-0.5 shrink-0 text-white/80" />
              <span className={`leading-relaxed ${isCompact ? "line-clamp-2" : "line-clamp-3"}`}>{order.address}</span>
            </div>
          )}

          {order.menu && (
            <div className={`mb-2 p-2 text-[10px] sm:text-xs bg-black/10 rounded-lg text-white font-bold whitespace-pre-line leading-snug shrink-0 shadow-sm`}>
              {order.menu}
            </div>
          )}

          {order.image_url && (
             <div className="flex flex-col gap-1.5 shrink-0 mb-2 items-center">
              {order.image_url.split(",").filter(Boolean).map((url, i) => (
                <div key={i} onClick={(e) => { e.stopPropagation(); setImageGallery({ urls: order.image_url!.split(",").filter(Boolean), startIndex: i }); }} className="relative w-[65%] rounded-lg overflow-hidden border border-white/20 shadow-sm cursor-pointer group/img bg-black/10" style={{ aspectRatio: "9/16" }}>
                  <Image src={url} fill sizes="(max-width: 768px) 100vw, 33vw" alt="Order Evidence" className="object-cover block group-hover/img:scale-105 transition-transform duration-500" />
                </div>
              ))}
            </div>
          )}

          {order.details && (
            <div className={`${isCompact ? "text-[9px]" : "text-[10px]"} text-white/90 font-medium mb-2 flex items-start gap-1.5 shrink-0 bg-white/5 p-1.5 rounded-lg`}>
              <div className={`mt-1 w-1 h-2.5 rounded-full shrink-0 bg-white`}></div>
              <span className="leading-relaxed line-clamp-2">{order.details}</span>
            </div>
          )}

          <div className="mt-auto shrink-0 space-y-2.5">
            <div className={`flex justify-between items-center ${isCompact ? "text-[9px] px-2.5 py-2" : "text-[10px] px-3 py-2.5"} bg-black/20 border border-white/10 rounded-xl shadow-inner`}>
              <div className="flex items-center font-bold text-white/90">
                <Clock size={10} className="mr-1 opacity-70" /> 
                {order.start_time ? new Date(order.start_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-"}
              </div>
              {order.total_price > 0 && (
                <div className={`${isCompact ? "text-[11px]" : "text-xs"} font-black text-white flex items-center`}>
                  ฿{order.total_price}{" "}
                  {!isCompact && order.payment_method && (
                    <span className={`ml-1.5 px-1 py-0.5 rounded text-[7px] uppercase font-black bg-white/20 text-white`}>
                      {order.payment_method}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`p-2 bg-black/20 flex shrink-0 ${isCompact ? "flex-col gap-1.5" : "flex-col sm:flex-row gap-1.5"}`}>
          {activeTab === 'available' ? (
            <button onClick={() => handleTakeJob(order)} className={`w-full py-2.5 text-[10px] sm:text-xs bg-white hover:bg-slate-100 text-slate-800 font-black uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center shrink-0 rounded-lg shadow-md active:scale-95`}>
              <Zap size={14} className="mr-1.5 fill-blue-500 text-blue-500 animate-pulse" /> {isCompact ? "รับงาน" : "กดรับงานนี้"}
            </button>
          ) : (
            <>
              <div className="flex flex-1 gap-1.5 w-full">
                <button onClick={() => calculateRoute(order)} className={`flex-1 py-2 bg-black/30 text-white hover:bg-black/50 font-black text-[9px] sm:text-[10px] rounded-lg active:scale-95 border border-white/20 transition-colors flex justify-center items-center`}>
                  <MapIcon size={12} className="mr-1" /> นำทาง
                </button>
                <button onClick={() => handleDropJob(order.id)} className={`flex-1 py-2 bg-white/10 text-white hover:bg-rose-500 hover:border-rose-500 font-black text-[9px] sm:text-[10px] rounded-lg active:scale-95 border border-white/20 transition-colors flex justify-center items-center`}>
                  <X size={12} className="mr-1" /> คืนงาน
                </button>
              </div>
              <button onClick={() => handleRiderAction(order)} disabled={!canAction(order)} className={`w-full py-2 text-[9px] sm:text-[10px] font-black rounded-lg transition-all cursor-pointer uppercase tracking-wider flex justify-center items-center ${canAction(order) ? "bg-white hover:bg-slate-100 text-slate-800 shadow-md active:scale-95" : "bg-black/20 text-white/50 border border-white/10 cursor-not-allowed"}`}>
                {canAction(order) && <CheckCircle2 size={12} className="mr-1 text-emerald-500" />}
                {getActionBtnLabel(order)}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diffMins = (new Date().getTime() - new Date(lastSeen).getTime()) / 60000;
    return diffMins < 5;
  };

  if (isCheckingAuth)
    return (
      <div className="h-dvh bg-slate-50 flex flex-col items-center justify-center text-slate-800 overflow-hidden">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <h2 className="font-bold text-sm tracking-wider text-slate-500 animate-pulse">กำลังเตรียมระบบ...</h2>
      </div>
    );

  if (!isCheckingAuth && !myBranchId) {
    return (
      <div className="h-dvh bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-800">
        <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mb-6 shadow-lg border border-amber-200 animate-pulse">
          <Store size={40} className="text-amber-500" />
        </div>
        <h1 className="text-2xl font-black mb-3 tracking-tight">รอการจัดสรรสาขา</h1>
        <p className="text-slate-500 text-sm mb-8 max-w-xs leading-relaxed font-medium">
          บัญชีของคุณยังไม่ได้ระบุสาขาประจำ กรุณาแจ้งแอดมินเพื่อเลือกสาขาให้คุณก่อนเริ่มรับงานครับ 🛵
        </p>
        <div className="flex gap-4">
          <button onClick={() => window.location.reload()} className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg active:scale-95 transition-all text-sm uppercase tracking-wide">
            รีเฟรชหน้าจอ
          </button>
          <button onClick={() => handleLogout()} className="px-6 py-3.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-black rounded-xl active:scale-95 transition-all text-sm uppercase tracking-wide">
            ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  if (gpsEnabled === false) {
    return (
      <div className="h-dvh bg-slate-50 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden text-slate-800" style={{ zIndex: 50 }}>
        <div className="relative z-10 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full animate-in zoom-in duration-500">
          <div className="w-20 h-20 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ animation: "bounce 3s ease-in-out infinite" }}>
            <MapPinned size={32} className="text-rose-500" />
          </div>
          <h1 className="text-xl font-black mb-2">ระบบต้องการตำแหน่ง</h1>
          <p className="text-slate-500 font-medium mb-6 text-xs">{locationError || "กรุณาเปิด GPS เพื่อเข้าใช้งานแอปไรเดอร์"}</p>
          <button onClick={() => window.location.reload()} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl active:scale-95 transition-all shadow-md">
            รีเฟรชหน้าจอ
          </button>
        </div>
      </div>
    );
  }

  if (showDashboard) {
    return (
      <DashboardView
        riderName={riderName}
        onBack={() => setShowDashboard(false)}
        activeOrdersCount={activeOrders.length}
        allCompletedOrders={completedOrders}
        cutOffHour={cutOffHour} 
      />
    );
  }

  return (
    <div className="h-dvh bg-slate-100 text-slate-800 font-sans flex flex-col overflow-hidden transition-colors duration-500">
      
      <div className="shrink-0 bg-white/90 backdrop-blur-xl text-slate-800 p-3.5 shadow-sm flex justify-between items-center border-b border-slate-200 z-30">
        <div className="flex items-center">
          <button onClick={() => setIsMenuOpen(true)} className="mr-2 p-1.5 hover:bg-slate-100 rounded-lg active:scale-90 transition-all cursor-pointer">
            <Menu size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center drop-shadow-sm">
              <Zap className="mr-1 text-blue-600 fill-blue-600" size={16} /> RIDER APP
            </h1>
            <div className="text-[9px] text-slate-500 mt-0.5 flex items-center font-bold uppercase tracking-wider">
              {myLocation ? (
                <span className="flex items-center text-emerald-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div> GPS Active
                </span>
              ) : (
                <span className="opacity-70 animate-pulse text-amber-500">หาสัญญาณ...</span>
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-[10px] font-black tracking-wide text-slate-600 shadow-inner truncate max-w-25">
          {riderName}
        </div>
      </div>

      <div className="flex-1 w-full max-w-5xl mx-auto overflow-hidden flex flex-col relative">
        
        {activeTab === "available" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden w-full p-2 sm:p-4 pb-20 sm:pb-24 gap-2">
            
            <div className="flex justify-between items-center shrink-0 px-1 mb-1">
              <h2 className="font-black text-slate-800 text-lg flex items-center">
                งานว่าง <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-md shadow-sm">{availableOrders.length}</span>
              </h2>
              <button onClick={() => setIsCompact(!isCompact)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:text-blue-600 transition-all active:scale-95 shadow-sm">
                {isCompact ? <ZoomIn size={12} className="text-blue-600" /> : <ZoomOut size={12} className="text-blue-600" />} {isCompact ? "ซูมเข้า" : "ซูมออก"}
              </button>
            </div>

            {availableOrders.length === 0 ? (
              <div className="text-center bg-white rounded-4xl border border-slate-200 shadow-sm flex flex-col items-center justify-center mx-auto max-w-xs w-full flex-1 p-6">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <PackageCheck size={36} className="text-blue-500" />
                </div>
                <p className="text-slate-800 font-bold mb-1 text-base">ยังไม่มีงานเข้ามา</p>
                <p className="text-xs text-slate-500 font-medium">รอแอดมินจ่ายงานสักครู่นะครับ ☕</p>
              </div>
            ) : (
              <>
                <div className="flex-1 flex flex-col overflow-hidden relative mb-1">
                  <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex gap-2 items-stretch hide-scrollbar pb-1">
                    {availableOrders.filter(o => branches.length > 0 && o.branch_id === branches[0].id).length === 0 ? (
                      <div className="w-full h-full bg-white/50 border border-slate-200 rounded-2xl flex items-center justify-center text-xs font-bold text-slate-400 border-dashed">
                        ไม่มีงานจากสาขา {branches[0]?.name || 'หลัก'}
                      </div>
                    ) : (
                      availableOrders.filter(o => branches.length > 0 && o.branch_id === branches[0].id).map((order, index) => renderCard(order, index, branches[0]))
                    )}
                  </div>
                </div>

                {branches.length > 1 && (
                  <div className="flex-1 flex flex-col overflow-hidden relative">
                    <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex gap-2 items-stretch hide-scrollbar pt-1">
                      {availableOrders.filter(o => o.branch_id === branches[1].id).length === 0 ? (
                        <div className="w-full h-full bg-white/50 border border-slate-200 rounded-2xl flex items-center justify-center text-xs font-bold text-slate-400 border-dashed">
                          ไม่มีงานจากสาขา {branches[1].name}
                        </div>
                      ) : (
                        availableOrders.filter(o => o.branch_id === branches[1].id).map((order, index) => renderCard(order, index, branches[1]))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "jobs" && (
          <div className="flex-1 flex flex-col overflow-hidden w-full pt-4 px-3 sm:px-5 pb-24 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h2 className="font-black text-slate-800 text-lg flex items-center">
                กำลังทำ
                <span className="ml-2 px-2 py-0.5 bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] rounded-md shadow-sm">
                  {activeOrders.length} / {orderLimit}
                </span>
              </h2>
              <button onClick={() => setIsCompact(!isCompact)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:text-blue-600 transition-all active:scale-95 shadow-sm">
                {isCompact ? <ZoomIn size={12} className="text-blue-600" /> : <ZoomOut size={12} className="text-blue-600" />} {isCompact ? "ซูมเข้า" : "ซูมออก"}
              </button>
            </div>

            {activeOrders.length === 0 ? (
              <div className="text-center bg-white rounded-4xl border border-slate-200 shadow-sm flex flex-col items-center justify-center mx-auto max-w-xs w-full flex-1 p-6">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={36} className="text-emerald-500" />
                </div>
                <p className="text-slate-800 font-bold mb-1 text-base">ไม่มีงานค้างในมือ</p>
                <p className="text-xs text-slate-500 font-medium">ไปดูที่ &quot;งานว่าง&quot; เพื่อรับงานต่อ 🛵</p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex gap-2.5 items-stretch hide-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
                {activeOrders.map((order, index) => {
                  const branch = branches.find(b => b.id === order.branch_id);
                  return renderCard(order, index, branch);
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="flex-1 overflow-y-auto hide-scrollbar pb-36 pt-4 px-3 sm:px-5 w-full animate-in fade-in duration-500 mx-auto max-w-2xl">
            <h2 className="font-black text-slate-800 mb-4 text-lg flex items-center">
              ประวัติรอบวันนี้
              <span className="ml-2 px-2 py-0.5 bg-slate-200 border border-slate-300 text-slate-600 text-[10px] rounded-md shadow-sm">
                {shiftCompletedOrders.length}
              </span>
            </h2>
            <div className="space-y-3">
              {shiftCompletedOrders.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm">
                  <History size={40} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-500 font-bold text-base">ยังไม่มีงานที่สำเร็จ</p>
                </div>
              ) : (
                shiftCompletedOrders.map((order, idx) => {
                  const branch = branches.find(b => b.id === order.branch_id);
                  const isMainBranch = branch?.id === branches[0]?.id;
                  return (
                    <div
                      key={order.id}
                      onClick={() => { setSelectedViewOrder(order); setShowContactInfo(false); }}
                      className={`bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center cursor-pointer active:scale-95 transition-all hover:shadow-md group animate-in slide-in-from-bottom-2 ${isMainBranch ? 'border-red-200' : 'border-blue-200'}`}
                      style={{ animationDelay: `${idx * 30}ms`, animationFillMode: "both" }}
                    >
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full transition-colors text-xs font-black flex items-center justify-center mr-3 border ${isMainBranch ? 'bg-red-50 text-red-600 border-red-100 group-hover:bg-red-600 group-hover:text-white' : 'bg-blue-50 text-blue-900 border-blue-100 group-hover:bg-blue-900 group-hover:text-white'}`}>
                          {shiftCompletedOrders.length - idx}
                        </div>
                        <div>
                          <div className="font-black text-slate-800 text-base group-hover:text-blue-600 transition-colors">
                            {order.order_number}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium mt-1 flex items-center">
                            <span className="font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mr-2 uppercase border border-blue-100">
                              {order.job_type}
                            </span>
                            ส่งเมื่อ {order.end_time ? new Date(order.end_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-"} น.
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg flex items-center border border-emerald-100">
                        <CheckCircle2 size={12} className="mr-1" /> สำเร็จ
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-2 left-1/2 transform -translate-x-1/2 w-[92%] max-w-sm z-40">
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-1 flex items-center justify-between">
          <button
            onClick={() => setActiveTab("available")}
            className={`relative flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "available" ? "bg-blue-50 text-blue-600 shadow-inner border border-blue-100" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
          >
            <Zap size={20} className={`mb-1 transition-all ${activeTab === "available" ? "fill-blue-600" : ""}`} />
            <span className="text-[9px] font-black uppercase tracking-widest">งานว่าง</span>
            {availableOrders.length > 0 && (
              <span className="absolute top-1.5 right-1/4 translate-x-2 bg-red-500 text-white text-[9px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center animate-bounce shadow-md">
                {availableOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("jobs")}
            className={`relative flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "jobs" ? "bg-blue-50 text-blue-600 shadow-inner border border-blue-100" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
          >
            <ClipboardList size={20} className="mb-1" />
            <span className="text-[9px] font-black uppercase tracking-widest">งานของฉัน</span>
            {activeOrders.length > 0 && (
              <span className="absolute top-1.5 right-1/4 translate-x-2 bg-blue-600 text-white text-[9px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center shadow-md">
                {activeOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`relative flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "history" ? "bg-blue-50 text-blue-600 shadow-inner border border-blue-100" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
          >
            <History size={20} className="mb-1" />
            <span className="text-[9px] font-black uppercase tracking-widest">ประวัติ</span>
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 flex" style={{ zIndex: 110 }}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsMenuOpen(false)}></div>
          <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 z-10 rounded-r-4xl overflow-hidden">
            <div className="bg-linear-to-br from-blue-600 to-indigo-800 p-6 text-white relative">
              <button onClick={() => setIsMenuOpen(false)} className="absolute top-5 right-5 p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition-all cursor-pointer active:scale-90 border border-white/20">
                <X size={16} />
              </button>
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4 text-xl font-black shadow-inner border border-white/30 text-white">
                {riderName.charAt(0)}
              </div>
              <h2 className="font-black text-xl mb-1 tracking-tight text-white">{riderName}</h2>
              <p className="text-blue-200 text-[10px] flex items-center font-bold tracking-wide">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> พร้อมรับงานเสมอ
              </p>
            </div>
            <div className="flex-1 p-4 space-y-2 overflow-y-auto bg-slate-50">
              <button onClick={() => { setIsMenuOpen(false); setShowDashboard(true); }} className="w-full flex items-center p-3 text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all text-sm font-bold cursor-pointer border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mr-3">
                  <LayoutDashboard size={16} className="text-blue-600" />
                </div>
                Dashboard ของฉัน
              </button>
              
              <button onClick={() => { setIsMenuOpen(false); setShowRiderMap(true); }} className="w-full flex items-center p-3 text-slate-700 bg-white hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all text-sm font-bold cursor-pointer border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mr-3">
                  <MapPinned size={16} className="text-emerald-600" />
                </div>
                พิกัดเพื่อนไรเดอร์ (รวมสาขา)
              </button>
            </div>
            <div className="p-4 border-t border-slate-200 bg-white">
              <button onClick={() => { setIsMenuOpen(false); handleLogout(); }} className="w-full flex items-center justify-center p-3 text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-600 hover:text-white rounded-xl transition-all text-sm font-black cursor-pointer shadow-sm active:scale-95">
                <LogOut size={16} className="mr-2" /> ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedViewOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm" style={{ zIndex: 200 }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 border border-slate-100 flex flex-col" style={{ maxHeight: "85vh" }}>
            <div className="bg-blue-600 p-5 flex justify-between items-center text-white shrink-0">
              <h3 className="font-black flex items-center text-base tracking-tight">
                <ClipboardList size={18} className="mr-2" /> รายละเอียดออเดอร์
              </h3>
              <button onClick={() => setSelectedViewOrder(null)} className="p-1.5 bg-black/10 hover:bg-black/20 rounded-full transition-all cursor-pointer active:scale-90 hover:rotate-90 duration-300">
                <X size={16} strokeWidth={3} className="text-white" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto hide-scrollbar bg-slate-50/50">
              <div className="flex justify-between items-end border-b border-slate-200 pb-4">
                <div>
                  <div className="text-[10px] font-black text-slate-400 mb-1 tracking-wider uppercase">เลขที่ออเดอร์</div>
                  <div className="text-2xl font-black text-slate-800 tracking-tighter">{selectedViewOrder.order_number}</div>
                </div>
                <div className="text-right mb-1">
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-md border shadow-sm ${getRiderStatusDisplay(selectedViewOrder.status).color}`}>
                    {selectedViewOrder.status}
                  </span>
                </div>
              </div>

              {(selectedViewOrder as RiderOrder & { contact_link?: string }).contact_link && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center">
                    <Lock size={12} className="mr-1.5" /> ช่องทางติดต่อลูกค้า (ลับ)
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-blue-100 flex justify-between items-center shadow-sm">
                    {showContactInfo ? (
                      <a href={(selectedViewOrder as RiderOrder & { contact_link?: string }).contact_link!.startsWith('http') ? (selectedViewOrder as RiderOrder & { contact_link?: string }).contact_link : `https://${(selectedViewOrder as RiderOrder & { contact_link?: string }).contact_link}`} target="_blank" rel="noreferrer" className="text-blue-600 font-bold text-xs underline break-all">
                        {(selectedViewOrder as RiderOrder & { contact_link?: string }).contact_link}
                      </a>
                    ) : (
                      <div className="text-xs text-slate-300 blur-sm select-none font-black tracking-widest">
                        https://facebook.com/hidden-data...
                      </div>
                    )}
                    {!showContactInfo && (
                      <button onClick={() => { const pin = window.prompt("กรุณาใส่รหัส PIN เพื่อดูข้อมูลลูกค้า (ค่าเริ่มต้น: 9999):"); if (pin === "9999") setShowContactInfo(true); else if (pin) alert("รหัสผ่านไม่ถูกต้อง ❌"); }} className="ml-3 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-500 hover:text-white rounded-lg text-[10px] font-black transition-colors shrink-0 shadow-sm">
                        ปลดล็อก
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selectedViewOrder.address && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">สถานที่จัดส่ง</div>
                  <div className="flex items-start text-xs text-red-700 bg-red-50 p-4 rounded-xl border border-red-100 font-bold shadow-inner">
                    <MapIcon size={16} className="mr-2 mt-0.5 text-red-500 shrink-0" />
                    <span className="leading-relaxed">{selectedViewOrder.address}</span>
                  </div>
                </div>
              )}

              {selectedViewOrder.menu && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">รายการที่สั่ง</div>
                  <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 font-bold whitespace-pre-line leading-relaxed shadow-sm">
                    {selectedViewOrder.menu}
                  </div>
                </div>
              )}

              {selectedViewOrder.details && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">หมายเหตุ (Note)</div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800 font-medium whitespace-pre-line leading-relaxed shadow-inner">
                    {selectedViewOrder.details}
                  </div>
                </div>
              )}

              {selectedViewOrder.image_url && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center">
                    <ImageIcon size={12} className="mr-1.5" /> รูปภาพแนบ
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedViewOrder.image_url.split(",").filter(Boolean).map((url, i) => (
                      <div key={i} onClick={() => setImageGallery({ urls: selectedViewOrder.image_url!.split(",").filter(Boolean), startIndex: i })} className="relative w-full h-48 rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:shadow-lg transition-all bg-slate-100">
                        <Image src={url} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-contain" alt={`Detail ${i}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 text-xs shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">ประเภทงาน:</span>
                  <span className="font-black text-slate-700 uppercase px-2.5 py-1 bg-slate-100 rounded-md shadow-sm border border-slate-200">{selectedViewOrder.job_type}</span>
                </div>
                <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">ยอดเรียกเก็บ:</span>
                  <span className="font-black text-blue-600 text-lg">฿{selectedViewOrder.total_price}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">การชำระเงิน:</span>
                  <span className={`font-black text-[9px] uppercase px-2 py-1 rounded border ${selectedViewOrder.payment_method === "โอน" ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-emerald-50 border-emerald-200 text-emerald-600"}`}>
                    {selectedViewOrder.payment_method || "เงินสด"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 pt-0 shrink-0 bg-slate-50 mt-2">
              <button onClick={() => setSelectedViewOrder(null)} className="w-full py-3.5 bg-slate-800 text-white hover:bg-slate-700 font-black rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 text-xs uppercase tracking-widest">
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 แสดง Rider Map (กู้คืนครบ) */}
      {showRiderMap && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 flex flex-col h-5/6">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <MapPinned className="text-emerald-500" size={24} /> ติดตามพิกัดไรเดอร์ (Live)
              </h3>
              <button
                type="button"
                onClick={() => setShowRiderMap(false)}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all cursor-pointer active:scale-90 duration-300"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 bg-slate-100 relative">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  center={{ lat: shopLocation.lat, lng: shopLocation.lng }} 
                  zoom={14}
                  options={{ disableDefaultUI: true, zoomControl: true }}
                >
                  <MarkerF
                    position={{ lat: shopLocation.lat, lng: shopLocation.lng }}
                    icon={{ url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" }}
                    label={{
                      text: "ร้านที่ประจำอยู่",
                      color: "#b91c1c",
                      className: "bg-white/90 px-2 py-0.5 rounded-full shadow-sm text-xs font-black mt-8 border border-red-200",
                    }}
                    onClick={() =>
                      setSelectedRiderMapInfo({
                        id: "shop",
                        username: "ร้านที่ประจำอยู่",
                        last_lat: shopLocation.lat,
                        last_lng: shopLocation.lng,
                        last_seen: null,
                      })
                    }
                  />

                  {ridersLoc.map(
                    (rider) =>
                      rider.last_lat &&
                      rider.last_lng && (
                        <MarkerF
                          key={rider.id}
                          position={{ lat: rider.last_lat, lng: rider.last_lng }}
                          icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
                          label={{
                            text: rider.username,
                            color: "#1e293b",
                            className: "bg-white/80 px-2 py-0.5 rounded-full shadow-sm text-xs font-bold mt-8 border border-slate-200 backdrop-blur-sm",
                          }}
                          onClick={() => setSelectedRiderMapInfo(rider)}
                        />
                      ),
                  )}

                  {selectedRiderMapInfo &&
                    selectedRiderMapInfo.last_lat &&
                    selectedRiderMapInfo.last_lng && (
                      <InfoWindowF
                        position={{ lat: selectedRiderMapInfo.last_lat, lng: selectedRiderMapInfo.last_lng }}
                        onCloseClick={() => setSelectedRiderMapInfo(null)}
                      >
                        <div className="p-1 min-w-32 text-center text-slate-800">
                          <div className="font-bold text-sm mb-1">{selectedRiderMapInfo.username}</div>
                          {selectedRiderMapInfo.id !== "shop" && (
                            <div className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${isOnline(selectedRiderMapInfo.last_seen) ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                              {isOnline(selectedRiderMapInfo.last_seen) ? "🟢 ออนไลน์" : "⚫️ ออฟไลน์"}
                            </div>
                          )}
                        </div>
                      </InfoWindowF>
                    )}
                </GoogleMap>
              ) : (
                <div className="w-full h-full flex items-center justify-center animate-pulse text-slate-400 font-bold">
                  กำลังโหลดแผนที่...
                </div>
              )}
            </div>
            <div className="p-4 bg-white shrink-0 border-t border-slate-100 flex gap-2 overflow-x-auto thin-scrollbar">
              <div className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-100 shrink-0 flex items-center gap-1.5">
                <div className="w-3 h-3 bg-red-500 rounded-full shadow-inner"></div> ร้านสาขาของคุณ
              </div>
              <div className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100 shrink-0 flex items-center gap-1.5">
                <div className="w-3 h-3 bg-blue-500 rounded-full shadow-inner animate-pulse"></div> ไรเดอร์ (ทุกสาขา)
              </div>
            </div>
          </div>
        </div>
      )}

      {imageGallery && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200" onClick={() => { setImageGallery(null); setImgScale(1); }} style={{ zIndex: 300 }}>
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 text-white pointer-events-none">
            <span className="font-bold text-[10px] bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm border border-white/10">ปัดซ้าย-ขวา / ซูมได้</span>
            <button type="button" onClick={() => { setImageGallery(null); setImgScale(1); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-90 pointer-events-auto cursor-pointer">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          {imageGallery.urls.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); scrollGallery("left"); }} className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 transition-all cursor-pointer hidden md:block">
                <ChevronLeft size={20} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); scrollGallery("right"); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 transition-all cursor-pointer hidden md:block">
                <ChevronRight size={20} />
              </button>
            </>
          )}

          <div ref={galleryRef} className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
            {imageGallery.urls.map((url, i) => (
              <div key={i} className={`w-full h-full shrink-0 snap-center p-2 flex overflow-auto ${imgScale > 1 ? "items-start justify-start" : "items-center justify-center"}`} onClick={(e) => e.stopPropagation()}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  className={`transition-all duration-300 origin-center cursor-zoom-in shadow-2xl rounded-lg ${imgScale > 1 ? "m-auto" : ""}`}
                  style={{ width: imgScale > 1 ? `${imgScale * 100}%` : "100%", height: imgScale > 1 ? "auto" : "100%", objectFit: "contain", maxWidth: imgScale > 1 ? "none" : "100%" }}
                  onDoubleClick={(e) => { e.stopPropagation(); setImgScale((prev) => (prev === 1 ? 2.5 : 1)); }}
                  alt={`Gallery ${i}`}
                />
              </div>
            ))}
          </div>

          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-5 bg-slate-800/80 px-5 py-2.5 rounded-full backdrop-blur-md border border-slate-700 shadow-2xl z-50" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setImgScale((prev) => Math.max(1, prev - 0.5))} className={`p-1.5 rounded-full transition-all cursor-pointer ${imgScale <= 1 ? "text-slate-600 cursor-not-allowed" : "text-slate-300 hover:text-white hover:bg-slate-700"}`} disabled={imgScale <= 1}>
              <ZoomOut size={20} />
            </button>
            <span className="text-white font-black text-xs w-10 text-center">{Math.round(imgScale * 100)}%</span>
            <button onClick={() => setImgScale((prev) => Math.min(4, prev + 0.25))} className={`p-1.5 rounded-full transition-all cursor-pointer ${imgScale >= 4 ? "text-slate-600 cursor-not-allowed" : "text-slate-300 hover:text-white hover:bg-slate-700"}`} disabled={imgScale >= 4}>
              <ZoomIn size={20} />
            </button>
          </div>
        </div>
      )}

      {popup.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: 350 }}>
          <div className="bg-white rounded-4xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 border border-slate-100">
            {renderPopupIcon(popup.icon || "info")}
            <h3 className="text-lg font-black text-slate-800 mb-2 tracking-tight">{popup.title}</h3>
            <p className="text-slate-500 text-xs mb-6 font-medium leading-relaxed">{popup.message}</p>
            {popup.type === "alert" ? (
              <button onClick={closePopup} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl active:scale-95 transition-all shadow-lg shadow-blue-600/30 cursor-pointer text-sm">
                ตกลง
              </button>
            ) : (
              <div className="flex gap-3">
                <button onClick={closePopup} className="flex-[0.8] py-3.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 font-black rounded-xl active:scale-95 transition-all cursor-pointer text-sm">
                  ยกเลิก
                </button>
                <button onClick={popup.onConfirm} className="flex-[1.2] py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl active:scale-95 transition-all shadow-lg shadow-blue-600/30 cursor-pointer text-sm">
                  ยืนยัน
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .touch-pinch-zoom { touch-action: pinch-zoom; }
      `}</style>
    </div>
  );
}

// 🌟 Helper Functions (เรียกใช้ปกติ ไม่ใช้ any)
function canAction(order: RiderOrder) {
  return order.status === "รับงาน";
}

function getActionBtnLabel(order: RiderOrder) {
  return order.status === "รับงาน" ? "ส่งลูกค้าสำเร็จ" : "รอครัวทำอาหาร...";
}