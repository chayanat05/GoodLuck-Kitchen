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
  Lock, 
  Link as LinkIcon,
  Calendar,
  RefreshCw,
  Camera,
  Loader2
} from "lucide-react";
import { Order } from "../../components/OrderCard";
import { User as SupabaseUser } from "@supabase/supabase-js";
import DashboardView from "./DashboardView";
import Image from "next/image";
import Link from "next/link";
import { useJsApiLoader, GoogleMap, MarkerF, InfoWindowF } from "@react-google-maps/api"; 
import Swal from "sweetalert2";
import { toast } from "sonner";
import { useFCM } from "@/hooks/useFCM";

const SHOP_LAT = 16.24813;
const SHOP_LNG = 103.242206;

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

interface ActiveAttendance {
  id: string;
  check_in: string;
  check_out: string | null;
}

type RiderOrder = Order & { branch_id?: string | null };

export default function RiderPage() {
  useFCM();
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  
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

  const [currentUserRole, setCurrentUserRole] = useState<string>("rider");
  const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(false);

  // 🌟 State สำหรับระบบตอกบัตร
  const [activeAttendance, setActiveAttendance] = useState<ActiveAttendance | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraAction, setCameraAction] = useState<'in' | 'out'>('in');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isProcessingAttendance, setIsProcessingAttendance] = useState(false);
  
  const [mapLibraries] = useState<"places"[]>(["places"]);
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: mapLibraries, 
    language: "th",
    region: "TH",
  });

  const showAlert = (title: string, message: string, icon: "success" | "error" | "warning" | "info" = "info") => {
    if (icon === "success") {
      toast.success(title, { description: message });
    } else if (icon === "error") {
      toast.error(title, { description: message });
    } else {
      Swal.fire({ title, text: message, icon, confirmButtonColor: "#3b82f6", confirmButtonText: "รับทราบ" });
    }
  };
  
  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = "ยืนยัน", cancelText = "ยกเลิก") => {
    Swal.fire({
      title, text: message, icon: "warning",
      showCancelButton: true, confirmButtonColor: "#3b82f6", cancelButtonColor: "#f43f5e",
      confirmButtonText: confirmText, cancelButtonText: cancelText, reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        onConfirm();
      }
    });
  };

  const notifyRoles = async (roles: string[], title: string, body: string, link: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('fcm_token')
        .in('role', roles)
        .not('fcm_token', 'is', null);

      if (data && data.length > 0) {
        const tokens = data.map(u => u.fcm_token);
        await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens, title, message: body, link })
        });
      }
    } catch (e) {
      console.error('Push Error:', e);
    }
  };

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
      .or("is_archived.is.null,is_archived.eq.false") 
      .order("created_at", { ascending: false });

    const { data: availableJobs } = await supabase
      .from("orders")
      .select("*")
      .is("rider_id", null)
      .or("job_type.is.null,job_type.neq.shopee")
      .or("is_archived.is.null,is_archived.eq.false") 
      .in("status", ["New", "กำลังทำ", "รับงาน"])
      .order("created_at", { ascending: false });

    const jobs1 = availableJobs || [];
    const jobs2 = myJobs || [];

    const combined = [...jobs1, ...jobs2];
    const uniqueOrders = Array.from(new Map(combined.map((item) => [item.id, item])).values());
    const activeOrders = uniqueOrders.filter((order) => order.is_deleted !== true);
    setOrders(activeOrders as RiderOrder[]);
  }, []);

  const fetchRidersLocation = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, last_lat, last_lng, last_seen")
      .not("last_lat", "is", null);

    if (data) setRidersLoc(data as RiderLocation[]);
  }, []);

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
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
        .select("username, branch_id, role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role === 'kitchen') {
        if (profile.branch_id) {
          const { data: branchData } = await supabase.from("branches").select("slug").eq("id", profile.branch_id).single();
          const slugToUse = branchData?.slug || profile.branch_id;
          window.location.href = `/board/${slugToUse}`;
        } else {
          window.location.href = "/login";
        }
        return;
      }

      setCurrentUser(session.user);
      currentUserId = session.user.id;
      setRiderName(profile?.username || "ไรเดอร์");
      setCurrentUserRole(profile?.role || "rider");
      
      const { data: settings } = await supabase.from("store_settings").select("emergency_reveal_contacts").eq("id", 1).single();
      if (settings) setIsEmergencyMode(settings.emergency_reveal_contacts);

      const isSuper = profile?.role === 'superadmin' || profile?.role === 'admin';
      
      if (!isSuper) {
        const { data: attData } = await supabase
          .from("rider_attendance")
          .select("id, check_in, check_out")
          .eq("rider_id", session.user.id)
          .is("check_out", null)
          .order("check_in", { ascending: false })
          .limit(1)
          .single();
        setActiveAttendance(attData || null);
      }

      if (profile?.branch_id || isSuper) {
        if (profile?.branch_id) {
          setMyBranchId(profile.branch_id);
          const { data: branchData } = await supabase.from("branches").select("lat, lng, cut_off_hour").eq("id", profile.branch_id).single();
          if (branchData) {
            setCutOffHour(branchData.cut_off_hour || 4);
            setShopLocation({ lat: branchData.lat, lng: branchData.lng });
          }
        } else {
          setMyBranchId("all");
        }
        
        await fetchOrdersAndBranches(currentUserId);
        setIsCheckingAuth(false);
      } else {
        setMyBranchId(null);
        setIsCheckingAuth(false);
      }
    };

    checkAuthAndInit();

    const settingsChannel = supabase.channel("public:store_settings_rider")
      .on(
        "postgres_changes", 
        { event: "UPDATE", schema: "public", table: "store_settings" }, 
        (payload: { new: { emergency_reveal_contacts?: boolean } }) => {
          if (payload.new && typeof payload.new.emergency_reveal_contacts !== 'undefined') {
            setIsEmergencyMode(payload.new.emergency_reveal_contacts);
          }
        }
      ).subscribe();

    return () => { 
      supabase.removeChannel(settingsChannel);
    };
  }, [fetchOrdersAndBranches]);

  useEffect(() => {
    if (!currentUser) return;
    const riderChannel = supabase
      .channel("public:orders:rider_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOrdersAndBranches(currentUser.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(riderChannel); };
  }, [currentUser, fetchOrdersAndBranches]);

  useEffect(() => {
    if (!currentUser) return;
    if (!navigator.geolocation) {
      setGpsEnabled(false);
      setLocationError("เบราว์เซอร์ไม่รองรับ GPS");
      return;
    }

    const initLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsEnabled(true);
          setLocationError(null);
          setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
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

    const handleLocationError = (error: GeolocationPositionError) => {
      let msg = "กรุณาเปิด GPS";
      switch(error.code) {
        case error.PERMISSION_DENIED: msg = "คุณไม่อนุญาตให้ใช้ GPS กรุณาเปิดการตั้งค่า Safari/เบราว์เซอร์"; break;
        case error.POSITION_UNAVAILABLE: msg = "ข้อมูลพิกัดไม่พร้อมใช้งานในขณะนี้"; break;
        case error.TIMEOUT: msg = "หมดเวลาค้นหาพิกัด (ลองเปิดแอปใหม่)"; break;
      }
      setLocationError(msg);
      if(error.code !== error.PERMISSION_DENIED) {
        setMyLocation(null); 
      }
    };

    initLocation(); 

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        if (position.coords.accuracy > 150) {
          console.warn(`[GPS] Ignore low accuracy: ${position.coords.accuracy}m`);
          return;
        }

        setGpsEnabled(true);
        setLocationError(null);
        setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });

        const now = Date.now();
        if (now - lastGpsUpdateRef.current > 15000) {
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
        if(error.code === error.PERMISSION_DENIED) {
          setGpsEnabled(false);
        }
        handleLocationError(error);
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 0,
        timeout: 15000 
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentUser]);

  useEffect(() => {
    if (showRiderMap) {
      const initMap = async () => {
        await fetchRidersLocation();
      };
      initMap();
      const interval = setInterval(fetchRidersLocation, 30000);
      const profileChannel = supabase.channel("public:profiles:rider-map")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
          setRidersLoc((prev) => {
            const exists = prev.some(r => r.id === payload.new.id);
            if (!exists && payload.new.last_lat) {
              return [...prev, payload.new as RiderLocation];
            }
            return prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new as RiderLocation } : r);
          });
          setSelectedRiderMapInfo((prev) => {
            if (prev && prev.id === payload.new.id) {
              return { ...prev, ...payload.new as RiderLocation };
            }
            return prev;
          });
        })
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

  const submitAttendance = async () => {
    if (!photoFile || !currentUser) return;
    setIsProcessingAttendance(true);
    try {
      // 1. Upload Photo
      const fileExt = photoFile.name.split('.').pop() || 'jpg';
      const fileName = `attendance-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('rider-applications').upload(fileName, photoFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('rider-applications').getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      // 2. Insert or Update DB
      if (cameraAction === 'in') {
        const { data, error } = await supabase.from('rider_attendance').insert([{
          rider_id: currentUser.id,
          check_in_image: imageUrl
        }]).select().single();
        if (error) throw error;
        setActiveAttendance(data as ActiveAttendance);
        showAlert("เข้างานสำเร็จ!", "ตอกบัตรเข้างานเรียบร้อย ลุยเลย! 🚀", "success");
      } else {
        if (!activeAttendance) return;
        const now = new Date();
        const checkInDate = new Date(activeAttendance.check_in);
        const minutes = Math.floor((now.getTime() - checkInDate.getTime()) / 60000);
        
        const { error } = await supabase.from('rider_attendance').update({
          check_out: now.toISOString(),
          total_minutes: minutes,
          check_out_image: imageUrl
        }).eq('id', activeAttendance.id);
        if (error) throw error;
        setActiveAttendance(null);
        showAlert("เลิกงานสำเร็จ!", "ตอกบัตรออกงานเรียบร้อย พักผ่อนได้! 🌙", "success");
      }
      
      setShowCameraModal(false);
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err) {
      console.error(err);
      showAlert("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกข้อมูลตอกบัตรได้", "error");
    } finally {
      setIsProcessingAttendance(false);
    }
  };

  const handleTakeJob = async (order: RiderOrder) => {
    if (!currentUser) return;
    
    const isSuper = currentUserRole === "superadmin" || currentUserRole === "admin";

    if (activeOrders.length >= orderLimit && !isSuper) {
      showAlert("รับงานไม่ได้ ❌", `แอดมินจำกัดให้ถือบิลพร้อมกันได้ไม่เกิน ${orderLimit} งานครับ ส่งของในมือให้เสร็จก่อนนะ`, "warning");
      return;
    }

    if (!myLocation && !isSuper) {
      showAlert("แจ้งเตือน", "กำลังค้นหาตำแหน่งของคุณ กรุณารอสักครู่", "warning");
      return;
    }

    const orderBranch = branches.find(b => b.id === order.branch_id);
    if (orderBranch && orderBranch.lat !== 0 && !isSuper) {
      if (myLocation) {
        const distance = getDistanceFromLatLonInKm(myLocation.lat, myLocation.lng, orderBranch.lat, orderBranch.lng) * 1000;
        if (distance > 100) {
          showAlert("คุณอยู่ไกลจากร้านเกินไป", `ต้องอยู่ในรัศมี 100 เมตรจากร้าน (${orderBranch.name}) เพื่อรับงาน (ห่าง ${Math.round(distance)} เมตร)`, "error");
          return;
        }
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

      notifyRoles(
        ['admin', 'superadmin', 'kitchen'], 
        "🛵 ไรเดอร์รับงานแล้ว", 
        `${riderName} รับออเดอร์ #${order.order_number}`, 
        `/board/${order.branch_id}`
      );
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
        const updateData: { status: string; end_time?: string } = { status: nextStatus };
        if (nextStatus === "ส่งแล้ว/เสร็จ") updateData.end_time = new Date().toISOString();
        const { error } = await supabase.from("orders").update(updateData).eq("id", order.id);
        
        if (error) {
          showAlert("เกิดข้อผิดพลาด", "อัปเดตไม่สำเร็จ", "error");
        } else {
          fetchOrdersAndBranches(currentUser!.id);
          
          if (nextStatus === "ส่งแล้ว/เสร็จ") {
            notifyRoles(
              ['admin', 'superadmin'], 
              "✅ ส่งลูกค้าสำเร็จ", 
              `${riderName} ส่งออเดอร์ #${order.order_number} เรียบร้อยแล้ว`, 
              `/board/${order.branch_id}`
            );
          }
        }
      }, "ยืนยัน", "ยกเลิก"
    );
  };

  const handleDropJob = async (orderId: string) => {
    if (!currentUser) return;
    showConfirm(
      "คืนงานใช่ไหม?", "งานนี้จะถูกปลดล็อกให้ไรเดอร์ท่านอื่นแย่งรับได้นะครับ",
      async () => {
        const { error } = await supabase.from("orders").update({ rider_id: null, rider_name: null, start_time: null }).eq("id", orderId);
        if (error) {
          showAlert("เกิดข้อผิดพลาด", "ไม่สามารถคืนงานได้", "error");
        } else {
          showAlert("เรียบร้อย!", "คืนงานให้ระบบกลางแล้ว", "success");
          setActiveTab("available");
          fetchOrdersAndBranches(currentUser.id);

          const orderNum = orders.find(o => o.id === orderId)?.order_number || "ล่าสุด";
          notifyRoles(
            ['admin', 'superadmin'], 
            "⚠️ ไรเดอร์คืนงาน", 
            `${riderName} คืนออเดอร์ #${orderNum}`, 
            `/board/${myBranchId}`
          );
        }
      }, "คืนงาน", "ยกเลิก"
    );
  };

  const calculateRoute = (order: RiderOrder) => {
    if (order.address && (order.address.startsWith("http") || order.address.includes("maps."))) {
      window.open(order.address, "_blank");
      return;
    }

    const isSuper = currentUserRole === "superadmin" || currentUserRole === "admin";
    if (!myLocation && !isSuper) { 
      showAlert("รอก่อนนะ", "กำลังหาตำแหน่งของคุณอยู่ครับ 📡", "warning"); 
      return; 
    }

    if (order.lat && order.lng) { 
      const lat = myLocation?.lat || SHOP_LAT;
      const lng = myLocation?.lng || SHOP_LNG;
      const url = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${order.lat},${order.lng}&travelmode=driving`;
      window.open(url, "_blank");
      return;
    }

    if (order.address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
      window.open(url, "_blank");
      return;
    }

    showAlert("ขออภัย", "ออเดอร์นี้ไม่มีทั้งลิงก์แผนที่และไม่มีการระบุสถานที่ครับ", "error"); 
  };

  const handleLogout = () => {
    showConfirm(
      "ออกจากระบบ?", "คุณต้องการออกจากระบบใช่หรือไม่?",
      async () => { await supabase.auth.signOut(); window.location.href = "/login"; }, "ออกจากระบบ", "ยกเลิก"
    );
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diffMins = (new Date().getTime() - new Date(lastSeen).getTime()) / 60000;
    return diffMins < 5;
  };

  const availableOrders = orders.filter((o) => {
    if (o.rider_id || !["New", "กำลังทำ", "รับงาน"].includes(o.status)) return false;
    if (myBranchId === "all") return true;
    return o.branch_id === myBranchId;
  });
  const activeOrders = orders.filter((o) => o.rider_id === currentUser?.id && o.status !== "ส่งแล้ว/เสร็จ");
  const completedOrders = orders.filter((o) => o.rider_id === currentUser?.id && o.status === "ส่งแล้ว/เสร็จ");
  
  const lateRiderOrders = activeOrders.filter(o => 
    o.status === "รับงาน" && Math.floor((currentTime - new Date(o.created_at).getTime()) / 60000) >= 35
  );
  const hasLateRiderOrder = lateRiderOrders.length > 0;

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

  const getRiderStatusDisplay = (status: string) => {
    if (status === "New") return { text: "ออเดอร์เข้าใหม่", color: "bg-blue-500/20 text-blue-300 border-blue-400/30" };
    if (status === "กำลังทำ") return { text: "ครัวกำลังทำอาหาร", color: "bg-amber-500/20 text-amber-300 border-amber-400/30", icon: <ChefHat size={12} className="mr-1" /> };
    if (status === "รับงาน") return { text: "ของเสร็จแล้ว! ไปรับได้เลย", color: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30 shadow-sm animate-pulse", icon: <PackageCheck size={12} className="mr-1" /> };
    return { text: status, color: "bg-slate-700/50 text-slate-300 border-slate-500/50" };
  };

  const renderCard = (order: RiderOrder, idx: number, branch?: Branch) => {
    const isMainBranch = branch?.id === branches[0]?.id; 
    const cardBgClass = isMainBranch 
      ? "bg-linear-to-br from-red-500 to-red-600 border-red-700 shadow-red-500/30" 
      : "bg-linear-to-br from-blue-900 to-slate-900 border-blue-950 shadow-blue-900/30";
    
    const isAddressUrl = order.address && (order.address.startsWith("http") || order.address.includes("maps."));

    const elapsedMinutes = Math.floor((currentTime - new Date(order.created_at).getTime()) / 60000);
    const isRiderLate = order.status === "รับงาน" && elapsedMinutes >= 35;
    const isLate = isRiderLate;
    const isNearLate = order.status === "รับงาน" && elapsedMinutes >= 30;

    return (
      <div 
        key={order.id} 
        className={`${isCompact ? "w-[42vw] sm:w-42.5" : "w-[82vw] sm:w-[320px]"} h-full shrink-0 snap-center rounded-2xl shadow-md border overflow-hidden flex flex-col transition-colors duration-300 transform-gpu ${cardBgClass} ${isLate ? 'animate-border-blink' : ''}`} 
        style={{ animation: isLate ? undefined : `fadeIn 0.5s ease-out ${idx * 0.05}s both`, willChange: 'transform, opacity' }}
      >
        <div className="flex-1 overflow-y-auto hide-scrollbar p-2.5 sm:p-3 relative border-b border-white/10 flex flex-col">
          <div className="flex justify-between items-start mb-2 shrink-0 gap-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className={`${isCompact ? "text-base" : "text-xl"} font-black text-white tracking-tight leading-none drop-shadow-sm mr-1`}>
                {order.order_number}
              </span>
              <span className="text-[10px] sm:text-[11px] px-1.5 py-0.5 font-black rounded uppercase shadow-sm bg-black/30 text-white truncate max-w-20">
                {branch?.name || "ไม่ระบุ"}
              </span>
              <span className="text-[10px] sm:text-[11px] px-1.5 py-0.5 font-black rounded uppercase shadow-sm bg-white/20 text-white">
                {order.job_type}
              </span>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              {order.status !== "ส่งแล้ว/เสร็จ" && (
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-black uppercase shadow-sm transition-all ${
                  isLate 
                    ? "bg-white text-rose-600 animate-pulse border border-rose-100 scale-105 shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
                    : isNearLate 
                      ? "bg-amber-400 text-amber-900 border border-amber-300" 
                      : "bg-black/40 text-white"
                }`}>
                  {isLate ? <AlertTriangle size={12} className="animate-wiggle" /> : <Clock size={12} />}
                  {elapsedMinutes} นาที {isLate ? "ด่วน!" : ""}
                </div>
              )}
              {!isCompact && (
                <button onClick={(e) => { e.stopPropagation(); setSelectedViewOrder(order); setShowContactInfo(false); }} className="bg-white/20 text-white px-3 py-1 rounded-md text-xs sm:text-sm uppercase font-black flex items-center hover:bg-white/30 active:scale-95 transition-colors">
                  <Eye size={14} className="mr-1" /> ดูข้อมูล
                </button>
              )}
              <span className="text-[10px] sm:text-[11px] px-1.5 py-0.5 font-black rounded uppercase shadow-sm bg-white/20 text-white">
                {order.status === "รับงาน" ? "ไปส่งเลย!" : order.status}
              </span>
            </div>
          </div>

          {order.address && (
            <div className={`mb-2 shrink-0 flex items-center justify-between text-lg sm:text-xl p-3 text-white bg-black/30 border border-white/20 rounded-xl font-black shadow-inner`}>
              <div className="flex items-start flex-1 overflow-hidden">
                <MapPin size={22} className="mr-2 mt-0.5 shrink-0 text-white" />
                <span className={`leading-relaxed ${isCompact ? "line-clamp-2" : "line-clamp-3"}`}>
                  {isAddressUrl ? (
                    <span className="text-blue-300 underline italic flex items-center">
                      <LinkIcon size={18} className="mr-1 inline" /> ลิงก์แผนที่ลูกค้า
                    </span>
                  ) : (
                    order.address
                  )}
                </span>
              </div>
            </div>
          )}

          {order.menu && (
            <div className={`mb-2 p-2.5 text-lg sm:text-xl bg-black/10 rounded-lg text-white font-bold whitespace-pre-line leading-snug shrink-0 shadow-sm`}>
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
            <div className={`mb-2 p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-50 shrink-0 shadow-sm flex flex-col`}>
              <div className="flex items-center text-[10px] text-amber-300 font-black uppercase tracking-wider mb-1">
                <AlertTriangle size={12} className="mr-1" /> หมายเหตุ / โน๊ตจากลูกค้า
              </div>
              <div className={`${isCompact ? "text-base" : "text-lg"} font-medium leading-relaxed line-clamp-2`}>
                {order.details}
              </div>
            </div>
          )}

          <div className="mt-auto shrink-0 space-y-2.5">
            <div className={`flex justify-between items-center ${isCompact ? "px-3 py-2.5" : "px-4 py-3"} bg-black/30 border border-white/20 rounded-xl shadow-inner`}>
              <div className="flex items-center font-black text-white/90 text-sm">
                <Clock size={16} className="mr-1.5 opacity-80" /> 
                {order.start_time ? new Date(order.start_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-"}
              </div>
              <div className={`text-xl sm:text-2xl font-black text-white flex items-center`}>
                {order.payment_method && order.payment_method.includes("โอน") ? (
                  <span className={`px-3 py-1.5 rounded-lg text-lg sm:text-xl uppercase font-black bg-blue-500/80 text-white shadow-md`}>โอนแล้ว</span>
                ) : (
                  order.total_price > 0 && (
                    <>
                      ฿{order.total_price}{" "}
                      {order.payment_method && (
                        <span className={`ml-2 px-2 py-1 rounded-lg text-sm sm:text-base uppercase font-black bg-white/30 text-white shadow-sm`}>
                          {order.payment_method}
                        </span>
                      )}
                    </>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`p-2 bg-black/20 flex shrink-0 ${isCompact ? "flex-col gap-1.5" : "flex-col sm:flex-row gap-1.5"}`}>
          {activeTab === 'available' ? (
            <button onClick={() => handleTakeJob(order)} className={`w-full py-2.5 text-xs sm:text-sm bg-white hover:bg-slate-100 text-slate-800 font-black uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center shrink-0 rounded-lg shadow-md active:scale-95`}>
              <Zap size={16} className="mr-1.5 fill-blue-500 text-blue-500 animate-pulse" /> {isCompact ? "รับงาน" : "กดรับงานนี้"}
            </button>
          ) : (
            <>
              <div className="flex flex-1 gap-1.5 w-full">
                <button onClick={() => calculateRoute(order)} className={`flex-1 py-4 bg-black/30 text-white hover:bg-black/50 font-black text-lg sm:text-xl rounded-lg active:scale-95 border border-white/20 transition-colors flex justify-center items-center`}>
                  <MapIcon size={24} className="mr-2" /> นำทาง
                </button>
                <button onClick={() => handleDropJob(order.id)} className={`flex-1 py-4 bg-white/10 text-white hover:bg-rose-500 hover:border-rose-500 font-black text-lg sm:text-xl rounded-lg active:scale-95 border border-white/20 transition-colors flex justify-center items-center`}>
                  <X size={24} className="mr-2" /> คืนงาน
                </button>
              </div>
              <button onClick={() => handleRiderAction(order)} disabled={!canAction(order)} className={`w-full py-5 mt-2 text-xl sm:text-2xl font-black rounded-lg transition-all cursor-pointer uppercase tracking-wider flex justify-center items-center ${canAction(order) ? "bg-white hover:bg-slate-100 text-slate-800 shadow-md active:scale-95" : "bg-black/20 text-white/50 border border-white/10 cursor-not-allowed"}`}>
                {canAction(order) && <CheckCircle2 size={28} className="mr-2 text-emerald-500" />}
                {getActionBtnLabel(order)}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (isCheckingAuth)
    return (
      <div className="h-dvh bg-slate-50 flex flex-col items-center justify-center text-slate-800 overflow-hidden">
        <div className="relative flex flex-col items-center w-64 h-64 justify-center">
          <div className="text-[5rem] z-10 animate-bike-bounce drop-shadow-xl relative mb-2">
            🛵
            <div className="absolute -left-2 bottom-4 w-4 h-4 bg-slate-300 rounded-full animate-ping opacity-60" style={{ animationDuration: '0.8s' }}></div>
          </div>
          <div className="absolute bottom-18 w-48 h-1.5 overflow-hidden rounded-full opacity-60">
            <div className="w-[200%] h-full animate-dash-lines"></div>
          </div>
          <h2 className="mt-4 font-black text-sm tracking-wider text-slate-600 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
            กำลังเตรียมระบบ...
          </h2>
        </div>
      </div>
    );

  if (!isCheckingAuth && !myBranchId && currentUserRole !== 'superadmin' && currentUserRole !== 'admin') {
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

  if (gpsEnabled === false && currentUserRole !== 'superadmin' && currentUserRole !== 'admin') {
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
        businessDayStart={`${String(cutOffHour).padStart(2, '0')}:00`} 
      />
    );
  }

  return (
    <div className="h-dvh bg-slate-100 text-slate-800 font-sans flex flex-col overflow-hidden transition-colors duration-500">
      
      {/* 🌟 Header & ตอกบัตร */}
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
        
        {/* 🌟 ส่วนแสดงชื่อ */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-[10px] font-black tracking-wide text-slate-600 shadow-inner truncate max-w-25">
            {riderName}
          </div>
        </div>
      </div>

      {hasLateRiderOrder && (
        <div className="absolute top-16 left-0 right-0 z-40 px-4 pointer-events-none animate-in slide-in-from-top-5 duration-300">
          <div className="bg-linear-to-r from-rose-600 to-red-600 text-white p-3.5 rounded-2xl shadow-xl shadow-rose-500/50 flex items-center gap-3 border border-rose-400">
            <div className="bg-white/20 p-2 rounded-full animate-pulse shrink-0">
              <AlertTriangle size={24} className="text-white animate-wiggle" />
            </div>
            <div>
              <div className="font-black text-sm drop-shadow-md">ด่วน! คุณมีออเดอร์เกินกำหนดเวลา</div>
              <div className="text-[10px] font-bold opacity-90 mt-0.5">กรุณารีบนำส่งลูกค้า ({lateRiderOrders.length} รายการ)</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 w-full max-w-5xl mx-auto overflow-hidden flex flex-col relative">
        
        {activeTab === "available" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden w-full p-2 sm:p-4 pb-20 sm:pb-24 gap-2">
            
            <div className="flex justify-between items-center shrink-0 px-1 mb-1">
              <h2 className="font-black text-slate-800 text-lg flex items-center">
                งานว่าง <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-md shadow-sm">{availableOrders.length}</span>
              </h2>
              <button onClick={() => setIsCompact(!isCompact)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:text-blue-600 transition-all active:scale-95 shadow-sm cursor-pointer">
                {isCompact ? <ZoomIn size={12} className="text-blue-600" /> : <ZoomOut size={12} className="text-blue-600" />} {isCompact ? "ซูมเข้า" : "ซูมออก"}
              </button>
            </div>

            {/* 🌟 บังคับตอกบัตรก่อนเห็นงานว่าง (แอดมินดูได้เลย) - ปิดใช้งานชั่วคราวตามคำขอ */}
            {!activeAttendance && currentUserRole !== 'admin' && currentUserRole !== 'superadmin' ? (
              <div className="text-center bg-white rounded-4xl border border-slate-200 shadow-sm flex flex-col items-center justify-center mx-auto max-w-sm w-full flex-1 p-8">
                <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-rose-100">
                  <Camera size={40} className="text-rose-500" />
                </div>
                <h3 className="text-slate-800 font-black mb-2 text-xl tracking-tight">ยังไม่ได้ตอกบัตรเข้างาน</h3>
                <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
                  ต้องถ่ายรูปเซลฟี่เพื่อตอกบัตรเข้างานก่อน<br/>จึงจะมองเห็นและรับงานว่างได้ครับ 📸
                </p>
                <button onClick={() => { setCameraAction('in'); setShowCameraModal(true); }} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/30 active:scale-95 transition-all text-base cursor-pointer">
                  📸 ตอกบัตรเข้างาน
                </button>
              </div>
            ) : availableOrders.length === 0 ? (
              <div className="text-center bg-white rounded-4xl border border-slate-200 shadow-sm flex flex-col items-center justify-center mx-auto max-w-xs w-full flex-1 p-6">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <PackageCheck size={36} className="text-blue-500" />
                </div>
                <p className="text-slate-800 font-bold mb-1 text-base">ยังไม่มีงานเข้ามา</p>
                <p className="text-xs text-slate-500 font-medium">รอแอดมินจ่ายงานสักครู่นะครับ ☕</p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex gap-2.5 items-stretch hide-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 pb-2">
                {availableOrders.map((order, index) => {
                  const branch = branches.find(b => b.id === order.branch_id);
                  return renderCard(order, index, branch);
                })}
              </div>
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
              <button onClick={() => setIsCompact(!isCompact)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:text-blue-600 transition-all active:scale-95 shadow-sm cursor-pointer">
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
            onClick={() => { 
              setActiveTab("available"); 
              if (currentUser?.id) fetchOrdersAndBranches(currentUser.id); 
            }}
            className={`relative flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "available" ? "bg-blue-50 text-blue-600 shadow-inner border border-blue-100" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
          >
            <Zap size={20} className={`mb-1 transition-all ${activeTab === "available" ? "fill-blue-600" : ""}`} />
            <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1">งานว่าง <RefreshCw size={10} /></span>
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

      {/* 🌟 เมนูด้านข้าง (Hamburger Menu) */}
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
              {/* 🌟 ปุ่มตอกบัตรเข้า-ออก (ย้ายจาก Header) */}
              {activeAttendance ? (
                <button onClick={() => { setIsMenuOpen(false); setCameraAction('out'); setShowCameraModal(true); }} className="w-full py-3 mb-2 bg-rose-100 text-rose-600 rounded-xl text-sm font-black shadow-sm border border-rose-200 active:scale-95 transition-all cursor-pointer flex justify-center items-center">
                  <LogOut size={16} className="mr-2" /> ออกงาน
                </button>
              ) : (
                <button onClick={() => { setIsMenuOpen(false); setCameraAction('in'); setShowCameraModal(true); }} className="w-full py-3 mb-2 bg-emerald-100 text-emerald-600 rounded-xl text-sm font-black shadow-sm border border-emerald-200 active:scale-95 transition-all cursor-pointer flex justify-center items-center">
                  <Clock size={16} className="mr-2" /> เข้างาน
                </button>
              )}

              {(currentUserRole === "admin" || currentUserRole === "superadmin") && (
                <Link
                  href="/home"
                  prefetch={false}
                  className="w-full flex items-center p-4 text-slate-600 hover:bg-rose-50 hover:text-rose-700 rounded-2xl transition-all font-bold border border-transparent hover:border-rose-100 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                    <Store size={20} className="text-rose-600" />
                  </div>
                  กลับหน้าเลือกสาขา
                </Link>
              )}
              <button onClick={() => { setIsMenuOpen(false); setShowDashboard(true); }} className="w-full flex items-center p-3 text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all text-sm font-bold cursor-pointer border border-slate-200 shadow-sm group">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mr-3 group-hover:bg-blue-100 transition-colors">
                  <LayoutDashboard size={16} className="text-blue-600" />
                </div>
                Dashboard ของฉัน
              </button>
              
              <Link
                href="/schedule"
                prefetch={false}
                className="w-full flex items-center p-3 text-slate-700 bg-white hover:bg-teal-50 hover:text-teal-700 rounded-xl transition-all text-sm font-bold cursor-pointer border border-slate-200 shadow-sm group"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center mr-3 group-hover:bg-teal-100 transition-colors">
                  <Calendar size={16} className="text-teal-600" />
                </div>
                ตารางงาน (Schedule)
              </Link>

              <button onClick={() => { setIsMenuOpen(false); setShowRiderMap(true); }} 
                className="w-full flex items-center p-3 text-slate-700 bg-white hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all text-sm font-bold cursor-pointer border border-slate-200 shadow-sm group">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mr-3 group-hover:bg-emerald-100 transition-colors">
                  <MapPinned size={16} className="text-emerald-600" />
                </div>
                พิกัดเพื่อนไรเดอร์ (รวมสาขา)
              </button>

              <div className="h-px bg-slate-200 my-2"></div>
              
              <Link 
                href="/dorms"
                className="w-full flex items-center p-3 text-slate-700 bg-white hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-all text-sm font-bold cursor-pointer border border-slate-200 shadow-sm group"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mr-3 group-hover:bg-indigo-100 transition-colors">
                  <Store size={16} className="text-indigo-600" />
                </div>
                <div className="text-left">
                  <div className="leading-tight">เพิ่มหมุดที่อยู่</div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">ปักหมุดที่ยังไม่มีหรือยังไม่เคยไปหรืออัพเดทที่มีอยู่</div>
                </div>
              </Link>
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-white">
              <button onClick={() => { setIsMenuOpen(false); handleLogout(); }} className="w-full flex items-center justify-center p-3 text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-600 hover:text-white rounded-xl transition-all text-sm font-black cursor-pointer shadow-sm active:scale-95">
                <LogOut size={16} className="mr-2" /> ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Modal สำหรับถ่ายรูปตอกบัตร */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-slate-900/90 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm flex flex-col items-center shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black mb-2 text-slate-800">
              {cameraAction === 'in' ? '📸 ถ่ายรูปเข้างาน' : '📸 ถ่ายรูปเลิกงาน'}
            </h3>
            <p className="text-xs text-slate-500 mb-6 text-center">ต้องถ่ายรูปเซลฟี่กับหน้าร้านเพื่อยืนยันตัวตนเข้าระบบ</p>
            
            {photoPreview ? (
              <div className="relative w-full aspect-square rounded-3xl overflow-hidden mb-6 shadow-md border-4 border-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} className="object-cover w-full h-full" alt="Preview" />
                <button onClick={() => {setPhotoPreview(null); setPhotoFile(null);}} className="absolute top-3 right-3 bg-rose-500/90 backdrop-blur-md text-white p-2.5 rounded-full shadow-lg hover:bg-rose-600 transition-colors cursor-pointer">
                  <X size={18} strokeWidth={3}/>
                </button>
              </div>
            ) : (
              <label className="w-full aspect-square bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center mb-6 cursor-pointer hover:bg-slate-100 hover:border-blue-400 transition-all group">
                <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Camera size={36} className="text-blue-500" />
                </div>
                <span className="font-black text-slate-600 text-lg">แตะเพื่อถ่ายรูป</span>
                <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">เปิดกล้องมือถือ</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setPhotoFile(e.target.files[0]);
                      setPhotoPreview(URL.createObjectURL(e.target.files[0]));
                    }
                  }} 
                />
              </label>
            )}

            <div className="flex gap-3 w-full">
              <button 
                onClick={() => {setShowCameraModal(false); setPhotoPreview(null); setPhotoFile(null);}} 
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors active:scale-95 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                disabled={!photoFile || isProcessingAttendance} 
                onClick={submitAttendance}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black disabled:bg-slate-300 transition-colors shadow-lg shadow-blue-500/30 flex justify-center items-center active:scale-95 cursor-pointer"
              >
                {isProcessingAttendance ? <Loader2 className="animate-spin" size={20}/> : 'ยืนยัน'}
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

              {(currentUserRole === 'admin' || currentUserRole === 'superadmin') && (selectedViewOrder as RiderOrder & { contact_link?: string }).contact_link && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center">
                    <Lock size={12} className="mr-1.5" /> ช่องทางติดต่อลูกค้า (ลับ)
                  </div>
                  
                  {(() => {
                    const isRevealed = currentUserRole === 'superadmin' || isEmergencyMode || showContactInfo;
                    return (
                      <div className={`p-3 rounded-xl border flex justify-between items-center shadow-sm ${isEmergencyMode ? "bg-rose-50 border-rose-200" : "bg-white border-blue-100"}`}>
                        {isRevealed ? (
                          <a href={(selectedViewOrder as RiderOrder & { contact_link?: string }).contact_link!.startsWith('http') ? (selectedViewOrder as RiderOrder & { contact_link?: string }).contact_link : `https://${(selectedViewOrder as RiderOrder & { contact_link?: string }).contact_link}`} target="_blank" rel="noreferrer" className="text-blue-600 font-bold text-xs underline break-all">
                            {(selectedViewOrder as RiderOrder & { contact_link?: string }).contact_link}
                          </a>
                        ) : (
                          <div className="text-xs text-slate-300 blur-sm select-none font-black tracking-widest">
                            https://facebook.com/hidden-data...
                          </div>
                        )}
                        {!isRevealed && (
                          <button onClick={() => { const pin = window.prompt("กรุณาใส่รหัส PIN (ค่าเริ่มต้น: 9999):"); if (pin === "9999") setShowContactInfo(true); else if (pin) alert("รหัสผ่านไม่ถูกต้อง ❌"); }} className="ml-3 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-500 hover:text-white rounded-lg text-[10px] font-black transition-colors shrink-0 shadow-sm cursor-pointer">
                            ปลดล็อก
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {selectedViewOrder.address && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">สถานที่จัดส่ง</div>
                  <div className="flex items-start text-xs text-red-700 bg-red-50 p-4 rounded-xl border border-red-100 font-bold shadow-inner">
                    <MapIcon size={16} className="mr-2 mt-0.5 text-red-500 shrink-0" />
                    <span className="leading-relaxed break-all">
                      {selectedViewOrder.address.startsWith("http") || selectedViewOrder.address.includes("maps.") ? (
                        <a href={selectedViewOrder.address} target="_blank" rel="noreferrer" className="text-blue-600 underline">เปิดลิงก์แผนที่</a>
                      ) : (
                        selectedViewOrder.address
                      )}
                    </span>
                  </div>
                </div>
              )}

              {selectedViewOrder.menu && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">รายการที่สั่ง</div>
                  <div className="p-4 bg-white rounded-xl border border-slate-200 text-base sm:text-lg text-slate-700 font-bold whitespace-pre-line leading-relaxed shadow-sm">
                    {selectedViewOrder.menu}
                  </div>
                </div>
              )}

              {selectedViewOrder.details && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">หมายเหตุ (Note)</div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-base sm:text-lg text-amber-800 font-medium whitespace-pre-line leading-relaxed shadow-inner">
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
                {selectedViewOrder.payment_method !== "โอน" && (
                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                    <span className="text-slate-500 font-medium">ยอดเรียกเก็บ:</span>
                    <span className="font-black text-blue-600 text-lg">฿{selectedViewOrder.total_price}</span>
                  </div>
                )}
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

      {/* 🌟 ปรับปรุง: Modal ดูรูปเต็มจอและ Gallery แผนที่กลับมาสมบูรณ์ 100% */}
      {imageGallery && (
        <div 
          className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200" 
          onClick={() => { setImageGallery(null); setImgScale(1); }}
        >
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 text-white pointer-events-none">
            <span className="font-bold text-[10px] bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm border border-white/10">แตะเพื่อซูม / ปัดซ้ายขวา</span>
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

          <div ref={galleryRef} className="flex-1 w-full h-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
            {imageGallery.urls.map((url, i) => (
              <div 
                key={i} 
                className="w-full h-full shrink-0 snap-center flex overflow-auto relative p-2" 
                onClick={(e) => e.stopPropagation()}
              >
                {/* 🌟 ให้อิสระในการเลื่อน (Scroll) เมื่อซูมภาพแล้ว */}
                <div className={`m-auto flex ${imgScale > 1 ? "items-start justify-start" : "items-center justify-center w-full h-full"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    className={`transition-all duration-300 origin-center rounded-lg shadow-2xl ${imgScale > 1 ? "cursor-zoom-out" : "cursor-zoom-in"}`}
                    style={{ 
                      width: imgScale > 1 ? `${imgScale * 100}%` : "100%", 
                      height: imgScale > 1 ? "auto" : "100%", 
                      objectFit: "contain", 
                      maxWidth: imgScale > 1 ? "none" : "100%",
                      maxHeight: imgScale > 1 ? "none" : "100%"
                    }}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setImgScale((prev) => (prev === 1 ? 2.5 : 1)); 
                    }}
                    alt={`Gallery ${i}`}
                  />
                </div>
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
                  center={shopLocation} 
                  zoom={14}
                  mapTypeId="satellite"
                  options={{ disableDefaultUI: true, zoomControl: true }}
                >
                  <MarkerF
                    position={{ lat: shopLocation.lat, lng: shopLocation.lng }}
                    icon={{ url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png" }}
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

                  {/* 🌟 โค้ดที่โดนตัด: นำกลับมาครบถ้วนพร้อมเช็ค isMe และ isOnline */}
                  {ridersLoc.map((rider) => {
                    if (!rider.last_lat || !rider.last_lng) return null;
                    const isMe = rider.id === currentUser?.id;
                    const isRiderOnline = isOnline(rider.last_seen);
                    
                    return (
                      <MarkerF
                        key={rider.id}
                        position={{ lat: rider.last_lat, lng: rider.last_lng }}
                        icon={{
                          url: isMe 
                            ? "https://maps.google.com/mapfiles/ms/icons/blue-dot.png" 
                            : isRiderOnline ? "https://maps.google.com/mapfiles/ms/icons/green-dot.png" : "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                        }}
                        onClick={() => setSelectedRiderMapInfo(rider)}
                        zIndex={isMe ? 100 : 1}
                      />
                    );
                  })}

                  {selectedRiderMapInfo && selectedRiderMapInfo.last_lat && selectedRiderMapInfo.last_lng && (
                    <InfoWindowF
                      position={{ lat: selectedRiderMapInfo.last_lat, lng: selectedRiderMapInfo.last_lng }}
                      onCloseClick={() => setSelectedRiderMapInfo(null)}
                    >
                      <div className="p-2 text-slate-800 text-xs min-w-35">
                        <div className="font-black mb-1 text-sm border-b border-slate-100 pb-1">{selectedRiderMapInfo.username}</div>
                        {selectedRiderMapInfo.id !== "shop" && (
                          <div className="flex items-center gap-1.5 mt-1.5 font-medium">
                            <Clock size={12} className={isOnline(selectedRiderMapInfo.last_seen) ? "text-emerald-500" : "text-slate-400"} /> 
                            <span className={isOnline(selectedRiderMapInfo.last_seen) ? "text-emerald-600 font-bold" : "text-slate-500"}>
                              {isOnline(selectedRiderMapInfo.last_seen) ? "กำลังออนไลน์" : selectedRiderMapInfo.last_seen ? `ออฟไลน์ (${new Date(selectedRiderMapInfo.last_seen).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.)` : "ไม่ทราบ"}
                            </span>
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
              <div className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-100 shrink-0 flex items-center gap-1.5">
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-inner animate-pulse"></div> ไรเดอร์ออนไลน์
              </div>
              <div className="px-3 py-1.5 bg-slate-50 text-slate-500 text-xs font-bold rounded-lg border border-slate-200 shrink-0 flex items-center gap-1.5">
                <div className="w-3 h-3 bg-slate-400 rounded-full shadow-inner"></div> ออฟไลน์
              </div>
              <span className="text-xs text-slate-400 my-auto ml-auto pl-4 whitespace-nowrap">
                *พิกัดอัปเดตทุก 30 วินาที*
              </span>
            </div>
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

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px) rotate(-1deg); }
          50% { transform: translateX(2px) rotate(1deg); }
          75% { transform: translateX(-2px) rotate(-1deg); }
        }

        @keyframes wiggle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out infinite; }
        .animate-wiggle { animation: wiggle 1s ease-in-out infinite; }

        @keyframes border-blink {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(244, 63, 94, 0.1), 0 0 20px rgba(244, 63, 94, 0.1);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(244, 63, 94, 1), 0 0 20px rgba(244, 63, 94, 0.8);
          }
        }
        .animate-border-blink {
          animation: border-blink 0.5s ease-in-out infinite;
        }

        @keyframes bike-bounce {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-8px) rotate(2deg); }
        }
        .animate-bike-bounce { animation: bike-bounce 0.5s ease-in-out infinite; }

        @keyframes dash-lines {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-dash-lines {
          background-image: linear-gradient(90deg, #94a3b8 0%, #94a3b8 40%, transparent 40%, transparent 100%);
          background-size: 40px 100%;
          animation: dash-lines 0.4s linear infinite;
        }
      `}</style>
    </div>
  );
}

// 🌟 Helper Functions
function canAction(order: RiderOrder) {
  return order.status === "รับงาน";
}

function getActionBtnLabel(order: RiderOrder) {
  return order.status === "รับงาน" ? "ส่งลูกค้าสำเร็จ" : "รอครัวทำอาหาร...";
}