// board_home
"use client";
import { useState, useEffect, useRef, useMemo, useCallback, use } from "react";
import Link from "next/link";
import OrderCard, { Order } from "@/components/OrderCard";
import SharedGallery from "@/components/SharedGallery";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  X,
  ClipboardCheck,
  ImagePlus,
  MapPin as MapIcon,
  LogOut,
  Menu,
  LayoutDashboard,
  Search,
  Store,
  Sun,
  Volume2,
  Shrink,
  Expand,
  Map as MapViewIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  PlayCircle,
  ChefHat,
  Settings,
  ArrowRightLeft,
  Lock,
  ClipboardList,
  MapPin,
  Plus,
  Utensils,
  Calendar,
  Calculator,
  History,
  Trash2,
  Camera,
  Users,
  UserX,
  UserPlus,
  Loader2,
  Clock,
} from "lucide-react";

import { useJsApiLoader, GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { toast } from 'sonner';
import Image from 'next/image';
import Swal from 'sweetalert2';

export default function BranchBoardPage({ params }: { params: Promise<{ board_home: string }> }) {
  const resolvedParams = use(params);
  const branchSlug = resolvedParams.board_home;

  const SHOP_LAT = 16.24813;
  const SHOP_LNG = 103.242206;
  const NEW_ORDER_SOUND_URL = "/audio-shop.mp3"; // เสียงแจ้งเตือนออเดอร์ใหม่
  const EDIT_ORDER_SOUND_URL = "/editorder.mp3"; // เสียงแจ้งเตือนออเดอร์แก้ไข
  // Removed: const NOTIFICATION_SOUND_URL = "/audio-shop.mp3";

  // --- Type Interfaces ---

  // --- Type Interfaces ---
  interface RiderLocation {
    id: string;
    username: string;
    last_lat: number | null;
    last_lng: number | null;
    last_seen: string | null;
  }
  interface SavedLocation { id: string; name: string; lat: number; lng: number; address?: string; }
  interface BranchMenu { id: string; menu_name: string; price: number; branch_id: string; }
  interface ContactSource { id: string; name: string; branch_id: string; }
  interface UnifiedSearchResult { type: string; name: string; address?: string; lat?: number; lng?: number; distanceText?: string; menu_name?: string; price?: number; place_id?: string; }
  
  interface ActiveAttendance {
    id: string;
    check_in: string;
    check_out: string | null;
  }

  interface WakeLockSentinel extends EventTarget {
    released: boolean;
    type: 'screen';
    release(): Promise<void>;
  }
  interface NavigatorWithWakeLock {
    wakeLock: {
      request(type: 'screen'): Promise<WakeLockSentinel>;
    };
  }

  interface Branch {
    id: string;
    name: string;
    lat: number;
    lng: number;
  }

  interface RiderProfile {
    id: string;
    username: string;
  }

  const [orders, setOrders] = useState<Order[]>([]);
  const [halfPriceOrdersTotal, setHalfPriceOrdersTotal] = useState<number>(0);
  const [halfPriceOrdersPending, setHalfPriceOrdersPending] = useState<number>(0);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [adminName, setAdminName] = useState<string>("กำลังโหลด...");
  const [currentUserRole, setCurrentUserRole] = useState<string>("kitchen");
  const [allBranchMenus, setAllBranchMenus] = useState<BranchMenu[]>([]);
  const [contactSources, setContactSources] = useState<ContactSource[]>([]);
  
  // Rider Assignment Modal State
  const [riderModalOrder, setRiderModalOrder] = useState<Order | null>(null);
  const [availableRiders, setAvailableRiders] = useState<RiderProfile[]>([]);
  const [isRiderModalLoading, setIsRiderModalLoading] = useState(false);
  const [riderModalSearch, setRiderModalSearch] = useState("");

  const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(false);
  const [bgColor, setBgColor] = useState<string>("#1e293b");
  const [bgImage, setBgImage] = useState<string>("");
  const [bgOption, setBgOption] = useState<"cover" | "contain" | "repeat">("cover");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedViewOrder, setSelectedViewOrder] = useState<Order | null>(null);
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; order: Order | null }>({ isOpen: false, order: null });
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [showContactInfo, setShowContactInfo] = useState<boolean>(false);
  const [imageGallery, setImageGallery] = useState<{ urls: string[]; startIndex: number } | null>(null);
  const [imgScale, setImgScale] = useState<number>(1);
  const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResult[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const newOrderAudioRef = useRef<HTMLAudioElement | null>(null);
  const editOrderAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [ridersLoc, setRidersLoc] = useState<RiderLocation[]>([]);

  // State for Attendance System & Location
  const [activeAttendance, setActiveAttendance] = useState<ActiveAttendance | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraAction, setCameraAction] = useState<'in' | 'out'>('in');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isProcessingAttendance, setIsProcessingAttendance] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [locationError, setLocationError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [gpsEnabled, setGpsEnabled] = useState<boolean | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [branches, setBranches] = useState<Branch[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const lastGpsUpdateRef = useRef<number>(0);


  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [showRiderMap, setShowRiderMap] = useState<boolean>(false);
  const [selectedRiderMapInfo, setSelectedRiderMapInfo] = useState<RiderLocation | null>(null);
  const [menuModalSearchQuery, setMenuModalSearchQuery] = useState("");
  const [calcInput, setCalcInput] = useState("");
  const [branchName, setBranchName] = useState<string>("KANBAN BOARD");
  
  const calcResult = useMemo(() => {
    try {
      const s = (calcInput || "").toString().replace(/[^0-9+\-*/().]/g, '');
      if (!s) return "-";
      const r = Function('"use strict";return (' + s + ')')();
      return isNaN(r) ? "ERR" : String(r);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return "ERR";
    }
  }, [calcInput]);
  
  const [formData, setFormData] = useState({
    order_number: "",
    job_type: "ร้าน",
    menu: "",
    details: "",
    location_name: "",
    address: "",
    total_price: "",
    payment_method: "",
    lat: null as number | null,
    lng: null as number | null,
    contact_link: "",
    contact_source: "", 
  });

  const orderLineItems = useMemo(
    () => formData.menu.split("\n").filter((line) => line.trim() !== ""),
    [formData.menu]
  );

  const galleryRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [startDragX, setStartDragX] = useState(0);
  const [scrollDragLeft, setScrollDragLeft] = useState(0);

  const dbTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const googleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updatingOrdersRef = useRef(new Set<string>());
  const defaultMapCenter = useMemo(() => ({ lat: SHOP_LAT, lng: SHOP_LNG }), []);
  const [mapLibraries] = useState<"places"[]>(["places"]);
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: mapLibraries,
    language: "th",
    region: "TH",
  });
  // 🌟 เพิ่ม State นี้เพื่อให้ระบบนับเวลาแบบ Real-time สำหรับกระพริบบิลแดง
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set());
  const lockOrder = (orderId: string) => {
  setUpdatingOrders(prev => {
    const next = new Set(prev);
    next.add(orderId);
    return next;
  });
};

const unlockOrder = (orderId: string) => {
  setUpdatingOrders(prev => {
    const next = new Set(prev);
    next.delete(orderId);
    return next;
  });
};

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000); // อัปเดตทุก 30 วินาที
    return () => clearInterval(timer);
  }, []);
  
  // ---------------------------------------------------------------------------
  // 2. CORE FUNCTIONS
  // ---------------------------------------------------------------------------
  
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  
  const showAlert = (title: string, message: string, icon: "success" | "error" | "warning" | "info" = "info") => {
    if (icon === "success") {
      toast.success(title, { description: message });
    } else if (icon === "error") {
      toast.error(title, { description: message });
    } else {
      Swal.fire({ title, text: message, icon, confirmButtonColor: "#3b82f6", confirmButtonText: "รับทราบ" });
    }
  };

  const showToast = useCallback((msg: string) => {
    const isEdit = msg.includes('แก้ไข') || msg.includes('✏️');
    const options = isEdit
      ? {
          duration: 8000, // เพิ่มเวลาแสดงผลเป็น 8 วินาที
          style: { fontSize: "1.25rem" },
        }
      : {};
    if (msg.includes('❌') || msg.includes('เกิดข้อผิดพลาด')) {
      toast.error(msg, options);
    } else if (msg.includes('🔔')) {
      toast.info(msg, options);
    } else {
      toast.success(msg, options);
    }
  }, []);

  const playSound = useCallback(async (type: 'new' | 'edit') => {
    const audioRef = type === 'new' ? newOrderAudioRef : editOrderAudioRef;
    if (audioRef.current) {
      // The user must interact with the document first for this to work.
      try {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      } catch (error) {
        console.warn(`Could not play ${type} order sound automatically:`, error);
        // If playback fails, it's likely due to browser policy.
        // A gentle nudge to the user can help them enable audio.
        toast.info("คลิกที่หน้าจอเพื่อเปิดใช้งานเสียงแจ้งเตือน", { duration: 5000 });
      }
    }
  }, []);

  const notifyRoles = async (roles: string[], title: string, body: string, link: string) => {
    try {
      const { data } = await supabase.from('profiles').select('fcm_token').in('role', roles).not('fcm_token', 'is', null);
      if (data && data.length > 0) {
        const tokens = data.map(u => u.fcm_token);
        await fetch('/api/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokens, title, message: body, link }) });
      }
    } catch (e) {
      console.error('Push Error:', e);
    }
  };

  const fetchOrdersAndLocations = useCallback(async () => {
    if (!currentBranchId) return;

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("branch_id", currentBranchId)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("sort_index", { ascending: true })
      .order("created_at", { ascending: false });

    if (orderError) console.error("Error fetching orders:", orderError);
    if (orderData) {
      const activeOrders = orderData.filter((order) => order.is_deleted !== true);
      console.log(
    "SET ORDERS FROM FETCH",
    activeOrders.map(o => ({
      order: o.order_number,
      status: o.status
    }))
  );
      setOrders(activeOrders as Order[]);

      const halfPriceOrders = activeOrders.filter(
        (order) => order.payment_method === "คนละครึ่ง"
      );
      setHalfPriceOrdersTotal(halfPriceOrders.length);
      setHalfPriceOrdersPending(
        halfPriceOrders.filter((o) =>
          ["ออเดอร์ใหม่", "กำลังทำ", "รับงาน"].includes(o.status)
        ).length
      );
    }

    const { data: menuData } = await supabase
      .from("branch_menus")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    const { data: sourceData } = await supabase
      .from("contact_sources")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: true }); 

    if (menuData) setAllBranchMenus(menuData as BranchMenu[]);
    if (sourceData) setContactSources(sourceData as ContactSource[]);

  }, [currentBranchId]);

  const fetchRidersLocation = useCallback(async () => {
    if (!currentBranchId) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, last_lat, last_lng, last_seen")
      .not("last_lat", "is", null)
      .neq('role', 'kitchen');

    if (error) console.error(error);
    if (data) setRidersLoc(data as RiderLocation[]);
  }, [currentBranchId]);

  // ---------------------------------------------------------------------------
  // 3. EFFECTS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const requestWakeLock = async () => {
      // 🌟 1. ดักไว้ก่อนเลยว่า ถ้าไม่ได้เปิดหน้านี้อยู่ (อยู่แท็บอื่น/พับจอ) ไม่ต้องทำงาน
      if (document.visibilityState !== 'visible') return;

      try {
        if ('wakeLock' in navigator) {
          const nav = navigator as NavigatorWithWakeLock;
          if (nav.wakeLock) {
              const lock = await nav.wakeLock.request('screen');
              wakeLockRef.current = lock;
              lock.addEventListener('release', () => {
                console.log('Screen Wake Lock was released');
              });
          }
        }
      } catch (err) {
        // แอบเช็คเพิ่มนิดนึง เผื่อเผลอสลับหน้าจอกะทันหัน จะได้ไม่ต้อง log ให้รก
        if ((err as Error).name !== 'NotAllowedError') {
          console.error(`Wake Lock error: ${err}`);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    // 🌟 2. เช็คก่อนเรียกใช้งานครั้งแรก
    if (document.visibilityState === 'visible') {
      requestWakeLock();
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
        }).catch(() => {}); // ดัก error เงียบๆ ตอน release
      }
    };
  }, []);

  useEffect(() => {
    // Initialize audio elements on the client side
    newOrderAudioRef.current = new Audio(NEW_ORDER_SOUND_URL);
    newOrderAudioRef.current.volume = 1;
    editOrderAudioRef.current = new Audio(EDIT_ORDER_SOUND_URL);
    editOrderAudioRef.current.volume = 1;

    // This function attempts to "unlock" the audio context by playing and pausing
    // the audio on the first user interaction. This is a common workaround for
    // browser autoplay policies that block sound until a user gesture.
    const unlockAudio = () => {
        const playAndPause = (audioElement: HTMLAudioElement | null) => {
            if (audioElement && audioElement.paused) {
                const playPromise = audioElement.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        audioElement.pause();
                        audioElement.currentTime = 0;
                    }).catch(() => {
                        // Autoplay was prevented, no need to log an error.
                    });
                }
            }
        };
        playAndPause(newOrderAudioRef.current);
        playAndPause(editOrderAudioRef.current);
      
        // Remove the listeners after the first interaction
        document.body.removeEventListener('click', unlockAudio);
        document.body.removeEventListener('touchstart', unlockAudio);
        document.body.removeEventListener('keydown', unlockAudio);
    };

    document.body.addEventListener('click', unlockAudio);
    document.body.addEventListener('touchstart', unlockAudio);
    document.body.addEventListener('keydown', unlockAudio);

    return () => {
      document.body.removeEventListener('click', unlockAudio);
      document.body.removeEventListener('touchstart', unlockAudio);
      document.body.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("store_settings").select("emergency_reveal_contacts").eq("id", 1).single();
      if (data) setIsEmergencyMode(data.emergency_reveal_contacts);
    };
    fetchSettings();

    const settingsChannel = supabase
      .channel("public:store_settings")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "store_settings", filter: "id=eq.1" }, (payload) => {
        setIsEmergencyMode(payload.new.emergency_reveal_contacts);
      }).subscribe();

    const fetchBranchAndTheme = async () => {
      const { data } = await supabase.from("branches").select("id, name, theme_bg_color, theme_bg_image, theme_bg_option").eq("slug", branchSlug).single();
      if (data) {
        setCurrentBranchId(data.id);
        if (data.name) setBranchName(data.name);
        if (data.theme_bg_color) setBgColor(data.theme_bg_color);
        if (data.theme_bg_image) setBgImage(data.theme_bg_image);
        if (data.theme_bg_option) setBgOption(data.theme_bg_option as "cover" | "contain" | "repeat");
      } else {
        setCurrentBranchId(branchSlug);
      }
    };
    fetchBranchAndTheme();

    const themeChannel = supabase
      .channel("public:branches:theme")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "branches", filter: `slug=eq.${branchSlug}` }, (payload) => {
          if (payload.new.theme_bg_color) setBgColor(payload.new.theme_bg_color);
          if (payload.new.theme_bg_image) setBgImage(payload.new.theme_bg_image);
          if (payload.new.theme_bg_option) setBgOption(payload.new.theme_bg_option as "cover" | "contain" | "repeat");
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(themeChannel);
    };
  }, [branchSlug]);

  useEffect(() => {
    if (!currentBranchId) return;

    const checkAuthAndInit = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }
      const { data: profile, error } = await supabase.from("profiles").select("role, username").eq("id", session.user.id).single();

      if (error || !profile || !["admin", "kitchen", "superadmin"].includes(profile.role)) {
        alert("สิทธิ์การเข้าถึงถูกปฏิเสธ! คุณถูกพาไปยังหน้าของไรเดอร์");
        window.location.href = "/rider";
        return;
      }
      
      // Fetch attendance status for kitchen staff
      if (profile.role === 'kitchen') {
        const { data: attData, error: attError } = await supabase
          .from("rider_attendance")
          .select("id, check_in, check_out")
          .eq("rider_id", session.user.id)
          .is("check_out", null)
          .order("check_in", { ascending: false });

        if (attError) {
          console.error("Error fetching kitchen attendance:", attError);
          setActiveAttendance(null);
        } else {
          setActiveAttendance(attData && attData.length > 0 ? attData[0] : null);
        }
      }

      setCurrentUser(session.user);
      setAdminName(profile.username || (profile.role === "admin" ? "แอดมิน" : "แม่ครัว" ));
      setCurrentUserRole(profile.role);
      setIsMounted(true);
      fetchOrdersAndLocations();
    };

    checkAuthAndInit();

    const orderChannel = supabase
      .channel(`orders-${currentBranchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `branch_id=eq.${currentBranchId}`,
        },
        (payload) => {
          console.log("[REALTIME] Change received!", payload);

          if (payload.eventType === "INSERT") {
            playSound("new");
            showToast(`🔔 มีออเดอร์ใหม่เข้า! ออเดอร์ที่ ${payload.new.order_number}`);
          } else if (payload.eventType === "UPDATE") {
            // Simple notification for any update.
            // A more complex check could be done here if needed, but requires careful state management.
            // showToast(`🔄 ออเดอร์ #${payload.new.order_number} มีการอัปเดต`);
          }

          // Refetch all orders to ensure the UI is in sync.
          // This is simpler and more robust than manually updating the state.
          fetchOrdersAndLocations();
        }
      )
      .subscribe();

    const syncChannel = supabase
      .channel("public:sync_menus_sources")
      .on("broadcast", { event: "sync" }, (payload) => {
        if (payload.payload?.branch_id === currentBranchId) {
          fetchOrdersAndLocations();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "branch_menus", filter: `branch_id=eq.${currentBranchId}` }, () => fetchOrdersAndLocations())
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_sources", filter: `branch_id=eq.${currentBranchId}` }, () => fetchOrdersAndLocations())
      .subscribe();
      
    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(syncChannel);
    };
  }, [fetchOrdersAndLocations, showToast, currentBranchId, playSound]);

  useEffect(() => {
    if (showRiderMap && currentBranchId) {
      const timer = setTimeout(() => fetchRidersLocation(), 0);
      const interval = setInterval(fetchRidersLocation, 15000);
      const profileChannel = supabase
        .channel(`profiles-map-${currentBranchId}`)
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
      return () => {
        clearInterval(interval);
        clearTimeout(timer);
        supabase.removeChannel(profileChannel);
      };
    }
  }, [showRiderMap, fetchRidersLocation, currentBranchId]);

  useEffect(() => {
    if (imageGallery && galleryRef.current) {
      const target = galleryRef.current.children[imageGallery.startIndex] as HTMLElement;
      if (target) galleryRef.current.scrollLeft = target.offsetLeft;
    }
  }, [imageGallery]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

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


  // ---------------------------------------------------------------------------
  // 4. EVENT HANDLERS
  // ---------------------------------------------------------------------------

  const scrollGallery = (direction: "left" | "right") => {
    setImgScale(1);
    if (galleryRef.current) {
      const { clientWidth } = galleryRef.current;
      const scrollAmount = direction === "left" ? -clientWidth : clientWidth;
      galleryRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const submitAttendance = async () => {
    if (!photoFile || !currentUser || !currentBranchId) return;

    setIsProcessingAttendance(true);
    const showAlert = (title: string, message: string, icon: "success" | "error" | "warning" | "info" = "info") => {
      if (icon === "success") {
        toast.success(title, { description: message });
      } else if (icon === "error") {
        toast.error(title, { description: message });
      } else {
        Swal.fire({ title, text: message, icon, confirmButtonColor: "#3b82f6", confirmButtonText: "รับทราบ" });
      }
    };
    
    try {
      // 1. Upload Photo
      const fileExt = photoFile.name.split('.').pop() || 'jpg';
      const fileName = `attendance-kitchen-${Date.now()}.${fileExt}`;
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
        showAlert("เข้างานสำเร็จ!", "ถ่ายรูปเข้างานเรียบร้อย ลุยเลย! 🚀", "success");
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
        showAlert("เลิกงานสำเร็จ!", "ถ่ายรูปออกงานเรียบร้อย พักผ่อนได้! 🌙", "success");
      }
      
      setShowCameraModal(false);
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err: unknown) {
      console.error(err);
      showAlert("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกข้อมูลการถ่ายรูปได้", "error");
    } finally {
      setIsProcessingAttendance(false);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `order-photos/${fileName}`;
    const { error: uploadError } = await supabase.storage.from("order-images").upload(filePath, file);
    if (uploadError) return null;
    const { data } = supabase.storage.from("order-images").getPublicUrl(filePath);
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
      const { data: storeData } = await supabase.from("saved_locations").select("*").ilike("name", `%${text}%`).limit(5);
      let storeResults: UnifiedSearchResult[] = [];
      if (storeData && storeData.length > 0) {
        storeResults = (storeData as SavedLocation[]).map((loc) => ({
          type: "store" as const,
          name: loc.name,
          address: loc.address || "หมุดบันทึก",
          lat: loc.lat,
          lng: loc.lng,
          distanceText: `${calculateDistance(SHOP_LAT, SHOP_LNG, loc.lat, loc.lng).toFixed(1)} km`,
        }));
      }
      setUnifiedResults(storeResults);
      setShowSuggestions(storeResults.length > 0);
    }, 150);

    googleTimeoutRef.current = setTimeout(async () => {
      if (isLoaded && window.google) {
        const service = new window.google.maps.places.AutocompleteService();
        service.getPlacePredictions(
          {
            input: text,
            componentRestrictions: { country: "th" },
            locationBias: { radius: 20000, center: { lat: SHOP_LAT, lng: SHOP_LNG } },
          },
          (predictions, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              const googleResults = predictions.slice(0, 3).map((p) => ({
                type: "google" as const,
                place_id: p.place_id,
                name: p.structured_formatting.main_text,
                address: p.structured_formatting.secondary_text || "Google Maps",
              }));
              setUnifiedResults((prev) => {
                const combined = [...prev, ...googleResults];
                setShowSuggestions(combined.length > 0);
                return combined;
              });
            }
          },
        );
      }
    }, 1500);
  };

  const selectUnifiedResult = (item: UnifiedSearchResult) => {
    if (item.type === "store" && item.lat && item.lng) {
      setFormData({
        ...formData,
        location_name: item.name,
        address: item.address || "",
        lat: item.lat,
        lng: item.lng,
      });
      setShowSuggestions(false);
    } else if (item.type === "google" && item.place_id && isLoaded) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ placeId: item.place_id }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const loc = results[0].geometry.location;
          setFormData({
            ...formData,
            location_name: item.name,
            address: results[0].formatted_address || item.address || "",
            lat: loc.lat(),
            lng: loc.lng(),
          });
        }
        setShowSuggestions(false);
      });
    }
  };

  const openCreateModal = () => {
    const numberedOrders = orders.map(o => {
        const match = String(o.order_number).match(/\d+/);
        return match ? parseInt(match[0], 10) : NaN;
    }).filter(n => !isNaN(n));
    const maxNum = numberedOrders.length > 0 ? Math.max(...numberedOrders) : 0;
    const nextNum = (maxNum + 1).toString();

    setEditingId(null);
    setFormData({
      order_number: nextNum,
      job_type: "ร้าน",
      menu: "",
      details: "",
      location_name: "",
      address: "",
      total_price: "",
      payment_method: "",
      lat: null,
      lng: null,
      contact_link: "",
      contact_source: "",
    });
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
    setShowSuggestions(false);
    setIsModalOpen(true);
  };

  const openEditModal = (order: Order & { contact_link?: string; contact_source?: string }) => {
    setEditingId(order.id);
    setFormData({
      order_number: order.order_number,
      job_type: order.job_type,
      menu: order.menu || "",
      details: order.details || "",
      location_name: order.address || "",
      address: "",
      total_price: order.total_price ? order.total_price.toString() : "",
      payment_method: order.payment_method || "โอน",
      lat: order.lat || null,
      lng: order.lng || null,
      contact_link: order.contact_link || "",
      contact_source: order.contact_source || "",
    });
    if (order.image_url) setExistingImages(order.image_url.split(",").filter(Boolean));
    else setExistingImages([]);
    
    setImageFiles([]);
    setImagePreviews([]);
    setShowSuggestions(false);
    setIsModalOpen(true);
  };

  const handleAddFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (validFiles.length === 0) return;
    setImageFiles((prev) => [...prev, ...validFiles]);
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const handlePasteImage = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const items = event.clipboardData.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file" && items[i].type.startsWith("image/")) {
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
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    const filesToUpload = [...imageFiles];
    const currentExisting = [...existingImages];

    let finalOrderNumber = formData.order_number.trim();
    if (!finalOrderNumber) {
      const numberedOrders = orders.map(o => {
          const match = String(o.order_number).match(/\d+/);
          return match ? parseInt(match[0], 10) : NaN;
      }).filter(n => !isNaN(n));
      const maxNum = numberedOrders.length > 0 ? Math.max(...numberedOrders) : 0;
      finalOrderNumber = (maxNum + 1).toString();
    }

    const cleanPrice = formData.job_type === "shopee" ? 0 : parseInt(formData.total_price.replace(/[^0-9]/g, ""), 10) || 0;

    const orderData = {
      order_number: finalOrderNumber,
      job_type: formData.job_type,
      menu: formData.menu.trim(),
      details: formData.details.trim() || "",
      address: formData.job_type === "shopee" ? null : formData.location_name,
      image_url: currentExisting.join(","),
      total_price: cleanPrice,
      payment_method: formData.job_type === "shopee" ? "โอน" : formData.payment_method,
      lat: formData.job_type === "shopee" ? null : formData.lat,
      lng: formData.job_type === "shopee" ? null : formData.lng,
      contact_link: formData.contact_link.trim(),
      contact_source: formData.contact_source.trim(),
    };

    let targetId = editingId;
    const isEdit = !!editingId;

    if (isEdit) {
      // Logic for editing an existing order
      const oldOrder = orders.find(o => o.id === editingId);
      const isMenuChanged = oldOrder && oldOrder.menu !== orderData.menu;
      setOrders(prev => prev.map((o) => (o.id === editingId ? { ...o, ...orderData } as Order : o)));
      
      const { error } = await supabase.from("orders").update(orderData).eq("id", editingId);
      if (error) {
        console.warn("Error updating order, might be false positive:", error);
      } else {
        if (isMenuChanged) {
            playSound('edit');
            showToast(`✏️ แก้ไขเมนูออเดอร์ #${finalOrderNumber} แล้ว 📝`);
        }
        const { error: logError } = await supabase.from("activity_logs").insert([{
          branch_id: currentBranchId,
          user_name: adminName,
          action: "EDIT_ORDER",
          details: `แก้ไขข้อมูลออเดอร์ #${finalOrderNumber}`
        }]);
        if (logError) console.error("Failed to log order edit:", logError);
      }
    } else {
      // Logic for creating a new order
      let finalNumToUse = orderData.order_number;
      let isDuplicate = true;
      let attempts = 0;

      while (isDuplicate && attempts < 10) {
        const { data: existing } = await supabase
          .from("orders")
          .select("id, is_deleted, is_archived")
          .eq("order_number", finalNumToUse)
          .eq("branch_id", currentBranchId);

        const isExistingActive = existing && existing.some((o: Partial<Order>) => o.is_deleted !== true && o.is_archived !== true);

        if (isExistingActive) {
          const currentNumMatch = String(finalNumToUse).match(/\d+/);
          if (currentNumMatch) {
            const num = parseInt(currentNumMatch[0], 10);
            finalNumToUse = String(finalNumToUse).replace(/\d+/, (num + 1).toString());
          } else {
            finalNumToUse = finalNumToUse + "-copy";
          }
          attempts++;
        } else {
          isDuplicate = false;
        }
      }

      finalOrderNumber = finalNumToUse;
      orderData.order_number = finalOrderNumber;

      const { data, error } = await supabase.from("orders").insert([{ ...orderData, branch_id: currentBranchId, status: "ออเดอร์ใหม่" }]).select();
      
      if (error) {
        console.error("Error inserting order:", error);
        showAlert("เกิดข้อผิดพลาด", "ไม่สามารถสร้างออเดอร์ได้", "error");
        setIsUploading(false);
        return;
      }
      
      if (data && data.length > 0) {
        targetId = data[0].id;
        setOrders(prev => [data[0] as Order, ...prev]);
        showToast("สร้างออเดอร์สำเร็จ! 🚀");
        
        const { error: logError } = await supabase.from("activity_logs").insert([{
          branch_id: currentBranchId,
          user_name: adminName,
          action: "CREATE_ORDER",
          details: `สร้างออเดอร์ใหม่ #${finalOrderNumber}`
        }]);
        if (logError) console.error("Failed to log order creation:", logError);

        notifyRoles(
          ['kitchen', 'rider', 'admin', 'superadmin'], 
          "✨ มีออเดอร์ใหม่เข้า!", 
          `ออเดอร์ #${finalOrderNumber} รอการยืนยัน`, 
          `/board/${branchSlug}`
        );
      }
    }

    // This part now runs for both new and edited orders if there are images.
    if (filesToUpload.length > 0 && targetId) {
      const uploadedUrls: string[] = [];
      for (const file of filesToUpload) {
        const url = await uploadImage(file);
        if (url) uploadedUrls.push(url);
      }
      if (uploadedUrls.length > 0) {
        const finalUrls = [...currentExisting, ...uploadedUrls].join(",");
        await supabase.from("orders").update({ image_url: finalUrls }).eq("id", targetId);
        showToast("อัปโหลดรูปภาพทั้งหมดเสร็จสิ้น! 📸");
        // We only fetch all orders again if it's a new order with images,
        // edits are handled optimistically.
        if (!isEdit) {
          fetchOrdersAndLocations();
        } else {
          // Optimistically update the single edited order's image_url
          setOrders(prev => prev.map(o => o.id === targetId ? { ...o, image_url: finalUrls } as Order : o));
        }
      }
    }
    
    setIsUploading(false);
    setIsModalOpen(false);
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
  };

  // 🌟 1. เปลี่ยนสถานะผ่าน Modal
  const executeStatusChange = async (newStatus: string) => {
    if (!statusModal.order) return;

    const targetOrder = statusModal.order;
    if (updatingOrdersRef.current.has(targetOrder.id)) return;

    try {
      updatingOrdersRef.current.add(targetOrder.id);
      lockOrder(targetOrder.id);

      setStatusModal({ isOpen: false, order: null });

      const updateData: { status: string; end_time?: string } = {
        status: newStatus,
      };

      if (
        newStatus === "ส่งแล้ว/เสร็จ" &&
        targetOrder.job_type === "shopee"
      ) {
        updateData.end_time = new Date().toISOString();
      }

      // 🌟 1. อัปเดตหน้าจอทันที
      setOrders(prev => prev.map(o => 
        o.id === targetOrder.id ? { ...o, ...updateData } as Order : o
      ));

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", targetOrder.id);

      // 🌟 2. แจ้งเตือนเฉพาะตอนที่ Database บันทึกสำเร็จ
      if (!error) {
        showToast(`เปลี่ยนสถานะเป็น "${newStatus}" แล้ว! 🔄`);
        
        await supabase.from("activity_logs").insert([{
          branch_id: currentBranchId,
          user_name: adminName,
          action: "CHANGE_STATUS",
          details: `ปรับสถานะออเดอร์ #${targetOrder.order_number} เป็น "${newStatus}"`
        }]);

        notifyRoles(
          ['rider','admin','superadmin','kitchen'],
          "🔄 อัปเดตสถานะออเดอร์",
          `ออเดอร์ #${targetOrder.order_number} ถูกเปลี่ยนเป็น: ${newStatus}`,
          `/board/${branchSlug}`
        );
      } else {
        console.error("Update failed:", error);
        toast.error("❌ เปลี่ยนสถานะไม่สำเร็จ (อาจติดสิทธิ์การเข้าถึง)");
        fetchOrdersAndLocations(); // ดึงข้อมูลเก่ากลับมาถ้า error
      }

    } finally {
      updatingOrdersRef.current.delete(targetOrder.id);
      unlockOrder(targetOrder.id);
    }
  };

  // 🌟 2. เริ่มทำอาหาร
  const handleStartOrder = async (orderId: string) => {
    if (updatingOrdersRef.current.has(orderId)) return;

    try {
      updatingOrdersRef.current.add(orderId);
      lockOrder(orderId);

      const targetOrder = orders.find(o => o.id === orderId);
      if (!targetOrder) return;

      // 🌟 1. อัปเดตหน้าจอทันที
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: "กำลังทำ" } as Order : o
      ));

      const { error } = await supabase
        .from("orders")
        .update({
          status: "กำลังทำ"
        })
        .eq("id", orderId);

      // 🌟 2. แจ้งเตือนเฉพาะตอนที่ Database บันทึกสำเร็จ
      if (!error) {
        showToast("ครัวเริ่มทำอาหารแล้ว! 🍳");
        const orderNum = targetOrder.order_number || "ล่าสุด";

        await supabase.from("activity_logs").insert([{
          branch_id: currentBranchId,
          user_name: adminName,
          action: "CHANGE_STATUS",
          details: `เริ่มทำอาหารออเดอร์ #${orderNum} (สถานะ: กำลังทำ)`
        }]);

        await notifyRoles(
          ['rider', 'admin', 'superadmin'],
          "🍳 ครัวกำลังทำอาหาร",
          `ออเดอร์ #${orderNum} เริ่มปรุงแล้ว`,
          `/board/${branchSlug}`
        );
      } else {
        console.error("Update failed:", error);
        toast.error("❌ เปลี่ยนสถานะไม่สำเร็จ (อาจติดสิทธิ์การเข้าถึง)");
        fetchOrdersAndLocations(); // ดึงข้อมูลเก่ากลับมาถ้า error
      }
    } finally {
      updatingOrdersRef.current.delete(orderId);
      unlockOrder(orderId);
    }
  };

  // 🌟 3. ทำอาหารเสร็จ
  const handleFinishOrder = async (orderId: string) => {
    if (updatingOrdersRef.current.has(orderId)) return;

    try {
      updatingOrdersRef.current.add(orderId);
      lockOrder(orderId);

      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) return;

      const isShopee = targetOrder.job_type === "shopee";
      const nextStatus = isShopee ? "ส่งแล้ว/เสร็จ" : "รับงาน";

      const updateData: { status: string; end_time?: string } = {
        status: nextStatus,
      };

      if (isShopee) {
        updateData.end_time = new Date().toISOString();
      }

      // 🌟 1. อัปเดตหน้าจอทันที
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, ...updateData } as Order : o
      ));

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId);

      // 🌟 2. แจ้งเตือนเฉพาะตอนที่ Database บันทึกสำเร็จ
      if (!error) {
        showToast(
          isShopee
            ? "ส่งมอบให้ขนส่ง Shopee สำเร็จ! 📦"
            : "อาหารเสร็จแล้ว รอไรเดอร์มารับ! 🛵"
        );
        const orderNum = targetOrder.order_number || "ล่าสุด";

        await supabase.from("activity_logs").insert([{
          branch_id: currentBranchId,
          user_name: adminName,
          action: "CHANGE_STATUS",
          details: `ทำอาหารออเดอร์ #${orderNum} เสร็จแล้ว (สถานะ: ${nextStatus})`
        }]);

        await notifyRoles(
          ['rider', 'admin', 'superadmin'],
          "📦 อาหารพร้อมส่ง!",
          `ออเดอร์ #${orderNum} เสร็จแล้ว ไรเดอร์มารับได้เลย`,
          `/board/${branchSlug}`
        );
      } else {
        console.error("Update failed:", error);
        toast.error("❌ เปลี่ยนสถานะไม่สำเร็จ (อาจติดสิทธิ์การเข้าถึง)");
        fetchOrdersAndLocations(); // ดึงข้อมูลเก่ากลับมาถ้า error
      }
    } finally {
      updatingOrdersRef.current.delete(orderId);
      unlockOrder(orderId);
    }
  };

    const handleUnassignRider = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    Swal.fire({
      title: 'ดึงงานออกจากไรเดอร์?',
      text: `คุณต้องการดึงออเดอร์ #${order.order_number} ออกจาก ${order.rider_name} ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#eab308',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ใช่, ดึงงาน',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, rider_id: null, rider_name: null, status: 'รับงาน' } as Order : o));

        const { error } = await supabase.from('orders').update({
          rider_id: null,
          rider_name: null,
          status: 'รับงาน' // Reset status to 'รับงาน'
        }).eq('id', orderId);

        if (error) {
          toast.error('เกิดข้อผิดพลาดในการดึงงาน');
          fetchOrdersAndLocations(); // Revert
        } else {
          toast.success(`ดึงงาน #${order.order_number} สำเร็จแล้ว`);
          await supabase.from("activity_logs").insert([{
            branch_id: currentBranchId,
            user_name: adminName,
            action: "UNASSIGN_RIDER",
            details: `ดึงงานออเดอร์ #${order.order_number} จาก ${order.rider_name}`
          }]);
        }
      }
    });
  };

  const handleOpenRiderModal = async (order: Order) => {
    setRiderModalOrder(order);
    setIsRiderModalLoading(true);

    const { data: riders, error } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('role', 'rider')
      .order('username', { ascending: true });

    if (error || !riders) {
      toast.error("ไม่สามารถโหลดรายชื่อไรเดอร์ได้");
      setRiderModalOrder(null);
    } else {
      setAvailableRiders(riders as RiderProfile[]);
    }
    setIsRiderModalLoading(false);
  };

  const handleSelectRider = async (selectedRider: RiderProfile) => {
    if (!riderModalOrder || !selectedRider) return;

    const orderToUpdate = riderModalOrder;
    const oldRiderName = orderToUpdate.rider_name;
    const isAssigningNew = !oldRiderName; // Check if it's a new assignment or a change

    // Close modal and reset state
    setRiderModalOrder(null);
    setAvailableRiders([]);
    setRiderModalSearch("");

    // Optimistic Update
    setOrders(prev => prev.map(o =>
      o.id === orderToUpdate.id
        ? { ...o, rider_id: selectedRider.id, rider_name: selectedRider.username, status: 'รับงาน' } as Order // Keep status as 'รับงาน'
        : o
    ));

    const { error: updateError } = await supabase.from('orders').update({
      rider_id: selectedRider.id,
      rider_name: selectedRider.username,
      status: 'รับงาน' // Ensure status is 'รับงาน'
    }).eq('id', orderToUpdate.id);

    if (updateError) {
      toast.error(`เกิดข้อผิดพลาดในการ${isAssigningNew ? 'มอบหมาย' : 'เปลี่ยน'}คนขับ`);
      fetchOrdersAndLocations(); // Revert on error
    } else {
      toast.success(`${isAssigningNew ? 'มอบหมาย' : 'เปลี่ยน'}คนขับเป็น ${selectedRider.username} สำเร็จ!`);
      
      // Log activity
      await supabase.from("activity_logs").insert([{
        branch_id: currentBranchId,
        user_name: adminName,
        action: isAssigningNew ? "ASSIGN_RIDER" : "CHANGE_RIDER",
        details: isAssigningNew
          ? `มอบหมายออเดอร์ #${orderToUpdate.order_number} ให้ ${selectedRider.username}`
          : `เปลี่ยนคนขับออเดอร์ #${orderToUpdate.order_number} จาก ${oldRiderName || 'ไม่มี'} เป็น ${selectedRider.username}`
      }]);

      // Notify new rider
      await notifyRoles(
        [selectedRider.username], 
        "✨ คุณได้รับมอบหมายงานใหม่!",
        `แอดมินได้โอนงานออเดอร์ #${orderToUpdate.order_number} ให้คุณ`,
        `/rider`
      );
    }
  };

  const handleLogoutRequest = () => {
    Swal.fire({
      title: "ต้องการออกจากระบบ?",
      text: "คุณต้องเข้าสู่ระบบใหม่ในครั้งถัดไปที่ต้องการใช้งาน",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#1e293b",
      cancelButtonColor: "#f43f5e",
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
    }).then(async (result) => {
      if (result.isConfirmed) {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }
    });
  };

  const requestDeleteOrder = async (id: string, orderNumber: string) => {
    Swal.fire({
      title: "ย้ายลงถังขยะ?",
      text: "ออเดอร์นี้จะถูกซ่อนจากหน้าบอร์ด คุณสามารถกู้คืนได้ที่หน้าถังขยะ",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f59e0b",
      cancelButtonColor: "#cbd5e1",
      confirmButtonText: "ย้ายลงถังขยะ",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        // ✨ Optimistic Update: ซ่อนทันที
        setOrders((prev) => prev.filter((order) => order.id !== id));
        
        supabase
          .from("orders")
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq("id", id).then(({error}) => {
            if (error) console.warn("Supabase return error but update likely succeeded:", error);
          });

        const { error: logError } = await supabase.from("activity_logs").insert([{
          branch_id: currentBranchId,
          user_name: adminName,
          action: "DELETE_ORDER",
          details: `ย้ายออเดอร์ #${orderNumber} ลงถังขยะ`
        }]);
        if (logError) {
          console.error("Failed to log order deletion:", logError);
        }

        showToast("ย้ายออเดอร์ลงถังขยะแล้ว 🗑️");
      }
    });
  };

  const pendingOrders = useMemo(() => orders.filter((o) => ["ออเดอร์ใหม่", "กำลังทำ", "รับงาน"].includes(o.status)), [orders]);

  const filteredOrders = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return orders.filter(
      (order) =>
        // 🌟 ใส่ String(...) ครอบไว้เพื่อป้องกันแอปพังเวลาเลขบิลเป็น Number
        (String(order.order_number || "").toLowerCase()).includes(q) ||
        (String(order.address || "").toLowerCase()).includes(q) ||
        (String(order.rider_name || "").toLowerCase()).includes(q),
    );
  }, [orders, debouncedQuery]);

  // ---------------------------------------------------------------------------
  // 5. RENDER UI
  // ---------------------------------------------------------------------------

  if (!currentUser || !isMounted || !currentBranchId)
    return (
      <div
        className="min-h-screen w-full flex justify-center items-center relative transition-all duration-500 z-50"
        style={{
          backgroundColor: bgColor,
          backgroundImage: bgImage ? `url(${bgImage})` : "none",
          backgroundSize: bgOption === "repeat" ? "auto" : bgOption,
          backgroundRepeat: bgOption === "repeat" ? "repeat" : "no-repeat",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="bg-slate-900/60 backdrop-blur-xl p-10 rounded-4xl shadow-2xl flex flex-col items-center justify-center border border-white/10 animate-in zoom-in-95 duration-500">
          <div
            className="loader mb-4"
            style={{ "--loader-color": "#fff" } as React.CSSProperties}
          ></div>
          <p className="text-white text-sm font-bold tracking-widest mt-2 animate-pulse">
            กำลังเตรียมบอร์ด...
          </p>
        </div>
      </div>
    );

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden font-sans relative transition-all duration-500"
      style={{
        backgroundColor: bgColor,
        backgroundImage: bgImage ? `url(${bgImage})` : "none",
        backgroundSize: bgOption === "repeat" ? "auto" : bgOption,
        backgroundRepeat: bgOption === "repeat" ? "repeat" : "no-repeat",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 🌟 Header */}
      <div className="shrink-0 p-2 pb-0 z-40">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-2 mb-0 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 bg-slate-100 hover:bg-blue-100 rounded-xl transition-all cursor-pointer text-slate-600 hover:text-indigo-700 active:scale-95"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center whitespace-nowrap tracking-tight">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center hover:opacity-70 transition-opacity cursor-pointer text-left mr-2 md:mr-3"
                title="โหลดหน้าเว็บใหม่เพื่อแก้หน้าจอค้าง"
              >
                <span className="text-blue-600">{branchName}</span>
              </button>
              <span className="text-sm md:text-base text-slate-500 font-bold border-l-2 border-slate-200 pl-2 md:pl-3 py-1 flex items-center gap-2">
                <span>
                  ทั้งหมด:{" "}
                  <span className="text-blue-600 font-black">
                    {orders.length}
                  </span>
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  ค้าง:{" "}
                  <span className="text-amber-500 font-black animate-pulse">
                    {pendingOrders.length}
                  </span>
                </span>
              </span>
            </h1>

            {/* NEW: คนละครึ่ง summary */}
            {(halfPriceOrdersTotal > 0 || halfPriceOrdersPending > 0) && (
              <div className="flex items-center gap-2 text-sm md:text-base text-cyan-700 font-bold bg-cyan-50 border border-cyan-200 rounded-xl px-3 py-1.5 shadow-sm ml-0 lg:ml-4">
                คนละครึ่ง:{" "}
                <span className="text-cyan-600 font-black">
                  {halfPriceOrdersTotal}
                </span>{" "}
                {halfPriceOrdersPending > 0 && (
                  <span className="text-slate-500 font-normal ml-1">
                    (ค้าง:{" "}
                    <span className="text-cyan-600 font-black animate-pulse">
                      {halfPriceOrdersPending}
                    </span>
                    )
                  </span>
                )}
              </div>
            )}

          </div>

          <div className="flex flex-col sm:flex-row items-center w-full lg:w-auto gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาบิล, ที่อยู่, ไรเดอร์..."
                className="w-full sm:w-48 md:w-64 bg-slate-50 border-slate-200 border rounded-xl py-1.5 pl-9 pr-3 text-sm font-medium text-slate-700 transition-all duration-300 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            
            {(currentUserRole === "admin" || currentUserRole === 'superadmin' || currentUserRole === 'kitchen') && (
              <button
                onClick={() => setShowRiderMap(true)}
                className="w-full sm:w-auto px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm font-bold rounded-xl hover:bg-indigo-100 transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
              >
                <MapViewIcon size={14} className="animate-pulse" /> พิกัดไรเดอร์
              </button>
            )}

            {(currentUserRole === "admin" || currentUserRole === 'superadmin') && (
              <button
                onClick={openCreateModal}
                className="w-full sm:w-auto px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all duration-300 cursor-pointer active:scale-95 shadow-md"
              >
                + สร้างออเดอร์
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 🌟 Sidebar Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 flex z-50">
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsMenuOpen(false)}
          ></div>
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 z-10 rounded-r-4xl overflow-hidden">
            <div className="bg-linear-to-br from-blue-600 to-indigo-800 p-8 text-white relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full pointer-events-none"></div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="absolute top-6 right-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all cursor-pointer backdrop-blur-md active:scale-90"
              >
                <X size={18} />
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-5 text-2xl font-black uppercase shadow-inner border border-white/30">
                {adminName.charAt(0)}
              </div>
              <h2 className="font-black text-2xl mb-1 tracking-tight">
                {adminName}
              </h2>
              <p className="text-blue-200 text-sm font-bold tracking-wide flex items-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 shadow-md shadow-emerald-400"></span>{" "}
                {currentUserRole === "admin"
                  ? "ผู้ดูแลระบบ (ADMIN)"
                  : currentUserRole === "superadmin"
                  ? "ผู้ดูแลระบบระดับสูง (SUPERADMIN)"
                  : "แม่ครัว (KITCHEN)"}
              </p>
            </div>
            <div className="flex-1 p-5 space-y-3 overflow-y-auto thin-scrollbar">
              
              {/* ATTENDANCE BUTTONS */}
              {currentUserRole === 'kitchen' && (
                <>
                  {activeAttendance ? (
                    <button onClick={() => { setIsMenuOpen(false); setCameraAction('out'); setShowCameraModal(true); }} className="w-full py-3 mb-2 bg-rose-100 text-rose-600 rounded-xl text-sm font-black shadow-sm border border-rose-200 active:scale-95 transition-all cursor-pointer flex justify-center items-center">
                      <LogOut size={16} className="mr-2" /> ออกงาน
                    </button>
                  ) : (
                    <button onClick={() => { setIsMenuOpen(false); setCameraAction('in'); setShowCameraModal(true); }} className="w-full py-3 mb-2 bg-emerald-100 text-emerald-600 rounded-xl text-sm font-black shadow-sm border border-emerald-200 active:scale-95 transition-all cursor-pointer flex justify-center items-center">
                      <Clock size={16} className="mr-2" /> เข้างาน
                    </button>
                  )}
                  <div className="h-px bg-slate-100 my-2"></div>
                </>
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

              <Link
                href="/schedule"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-teal-50 hover:text-teal-700 rounded-2xl transition-all font-bold border border-transparent hover:border-teal-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <Calendar size={20} className="text-teal-600" />
                </div>
                ตารางงาน (Schedule)
              </Link>

              <div className="h-px bg-slate-100 my-2"></div>
              {(currentUserRole === "admin" || currentUserRole === "superadmin") && (
                <>
              <Link
                href="/history"
                prefetch={false}
                className="w-full flex items-center p-4 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-2xl transition-all font-bold border border-transparent hover:border-indigo-100 group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                  <History size={20} className="text-indigo-600" />
                </div>
                ประวัติงาน (History)
              </Link>

              <div className="h-px bg-slate-100 my-2"></div>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsGalleryOpen(true);
                }}
                className="flex items-center gap-6 p-4 w-full text-left rounded-xl hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-colors font-bold group cursor-pointer"
              >
                <div className="w-8 h-8 bg-slate-100 group-hover:bg-indigo-100 rounded-lg flex items-center justify-center transition-colors">
                  <ImagePlus
                    size={20}
                    className="text-slate-500 group-hover:text-indigo-600"
                  />
                </div>
                <div>
                  <div className="text-l font-black">คลังรูปภาพสาขา</div>
                  <div className="text-[15px] text-slate-400 font-bold uppercase tracking-widest">
                    Branch Gallery
                  </div>
                </div>
              </button>
              <div className="h-px bg-slate-100 my-2"></div>

              <Link
                href="/dorms"
                className="flex items-center gap-6 p-4 w-full text-left rounded-xl hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-colors font-bold group"
              >
                <div className="w-8 h-8 bg-slate-100 group-hover:bg-indigo-100 rounded-lg flex items-center justify-center transition-colors">
                  <MapPin
                    size={20}
                    className="text-slate-500 group-hover:text-indigo-600"
                  />
                </div>
                <div>
                  <div className="text-l font-black">ที่ปักหมุด</div>
                  <div className="text-[15px] text-slate-400 font-bold uppercase tracking-widest">
                    ฐานข้อมูลหอพัก
                  </div>
                </div>
              </Link>
              </>
              )}
              <div className="h-px bg-slate-100 my-2"></div>

              {(currentUserRole === "admin" || currentUserRole === "superadmin") && (
                <>
                  <Link href={`/board/${branchSlug}/dashboard`} prefetch={false} className="w-full flex items-center p-4 text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-2xl transition-all font-bold border border-transparent hover:border-blue-100 group">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform"><LayoutDashboard size={20} className="text-blue-600" /></div>สถิติประจำสาขานี้
                  </Link>
                  
                  <div className="h-px bg-slate-100 my-2"></div>
                  <Link
                    href="/menus"
                    prefetch={false}
                    className="w-full flex items-center p-4 text-slate-600 hover:bg-pink-50 hover:text-pink-700 rounded-2xl transition-all font-bold border border-transparent hover:border-pink-100 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                      <Utensils size={20} className="text-pink-600" />
                    </div>
                    จัดการเมนูและราคา
                  </Link>
                  <div className="h-px bg-slate-100 my-2"></div>
                  <Link
                    href="/setting"
                    prefetch={false}
                    className="w-full flex items-center p-4 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-2xl transition-all font-bold cursor-pointer border border-transparent hover:border-slate-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform group-hover:rotate-45">
                      <Settings size={20} className="text-slate-600" />
                    </div>
                    ตั้งค่าระบบ
                  </Link>
                  <div className="h-px bg-slate-100 my-2"></div>
                  <Link
                    href={`/board/${branchSlug}/logs`}
                    prefetch={false}
                    className="w-full flex items-center p-4 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-2xl transition-all font-bold border border-transparent hover:border-indigo-100 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                      <ClipboardList size={20} className="text-indigo-600" />
                    </div>
                    ประวัติการทำงาน (Logs)
                  </Link>

                  <div className="h-px bg-slate-100 my-2"></div>
                  <Link
                    href={`/board/${branchSlug}/trash`}
                    prefetch={false}
                    className="w-full flex items-center p-4 text-slate-600 hover:bg-rose-50 hover:text-rose-700 rounded-2xl transition-all font-bold border border-transparent hover:border-rose-100 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                      <Trash2 size={20} className="text-rose-600" />
                    </div>
                    ถังขยะ (Recycle Bin)
                  </Link>
                </>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button
                onClick={handleLogoutRequest}
                className="w-full flex items-center justify-center p-4 text-slate-500 bg-white border border-slate-200 hover:bg-slate-800 hover:text-white hover:border-slate-800 rounded-2xl transition-all duration-300 font-black cursor-pointer shadow-sm active:scale-95 group/logout"
              >
                <LogOut
                  size={18}
                  className="mr-2 group-hover/logout:-translate-x-1 transition-transform duration-300"
                />{" "}
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Rider Map Modal */}
      {showRiderMap && (currentUserRole === "admin" || currentUserRole === "superadmin" || currentUserRole === "kitchen") && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm z-50">
          <div className="bg-white rounded-4xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-slate-100 flex flex-col h-5/6 relative">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <MapViewIcon className="text-indigo-600" size={24} />{" "}
                ติดตามพิกัดไรเดอร์ (Live)
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
                  center={defaultMapCenter}
                  zoom={13}
                  options={{ disableDefaultUI: true, zoomControl: true, mapTypeId: "satellite" }}
                >
                  {/* Shop marker removed as requested */}

                  {ridersLoc.map(
                    (rider) =>
                      rider.last_lat &&
                      rider.last_lng && (
                        <MarkerF
                          key={rider.id}
                          position={{
                            lat: rider.last_lat,
                            lng: rider.last_lng,
                          }}
                          icon={{
                            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                          }}
                          label={{
                            text: rider.username,
                            color: "#1e293b",
                            className:
                              "bg-white/80 px-2 py-0.5 rounded-full shadow-sm text-xs font-bold mt-8 border border-slate-200 backdrop-blur-sm",
                          }}
                          onClick={() => setSelectedRiderMapInfo(rider)}
                        />
                      ),
                  )}

                  {selectedRiderMapInfo &&
                    selectedRiderMapInfo.last_lat &&
                    selectedRiderMapInfo.last_lng && (
                      <InfoWindowF
                        position={{
                          lat: selectedRiderMapInfo.last_lat,
                          lng: selectedRiderMapInfo.last_lng,
                        }}
                        onCloseClick={() => setSelectedRiderMapInfo(null)}
                      >
                        <div className="p-1 min-w-32 text-center">
                          <div className="font-bold text-base text-slate-800 mb-1">
                            {selectedRiderMapInfo.username}
                          </div>
                          {selectedRiderMapInfo.id !== "shop" &&
                            (() => {
                              const isOnline =
                                selectedRiderMapInfo.last_seen &&
                                (new Date().getTime() -
                                  new Date(
                                    selectedRiderMapInfo.last_seen,
                                  ).getTime()) /
                                  60000 <
                                  5;
                              return (
                                <div className="flex flex-col items-center gap-1">
                                  <div
                                    className={`text-sm font-bold px-2 py-0.5 rounded-full inline-block ${
                                      isOnline
                                        ? "bg-green-100 text-green-700"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {isOnline ? "🟢 ออนไลน์" : "⚫️ ออฟไลน์"}
                                  </div>
                                  {!isOnline &&
                                    selectedRiderMapInfo.last_seen && (
                                      <div className="text-xs text-slate-500 font-medium mt-1">
                                        {new Date(
                                          selectedRiderMapInfo.last_seen,
                                        ).toLocaleTimeString("th-TH", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        })}{" "}
                                        น.
                                      </div>
                                    )}
                                </div>
                              );
                            })()}
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
              <div className="px-3 py-1.5 bg-red-50 text-red-700 text-sm font-bold rounded-lg border border-red-100 shrink-0 flex items-center gap-1.5">
                <div className="w-3 h-3 bg-red-500 rounded-full shadow-inner"></div>{" "}
                ร้านของเรา
              </div>
              <div className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-bold rounded-lg border border-blue-100 shrink-0 flex items-center gap-1.5">
                <div className="w-3 h-3 bg-blue-500 rounded-full shadow-inner animate-pulse"></div>{" "}
                ไรเดอร์
              </div>
              <span className="text-sm text-slate-400 my-auto ml-auto pl-4 whitespace-nowrap">
                *พิกัดอัปเดตทุกๆ 15 วินาที*
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 KANBAN BOARD */}
      <div className="flex-1 p-2 md:p-4 overflow-y-auto z-10 flex flex-col">
        
        {/* ATTENDANCE CHECK */}
        {currentUserRole === 'kitchen' && !activeAttendance ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center bg-white/30 backdrop-blur-md rounded-3xl border border-white/40 shadow-xl animate-in fade-in duration-500 m-2">
              <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-rose-100">
                <Camera size={40} className="text-rose-500" />
              </div>
              <h3 className="text-slate-800 font-black mb-2 text-2xl tracking-tight">ยังไม่ได้ถ่ายรูปเข้างาน</h3>
              <p className="text-base text-slate-500 font-medium mb-8 leading-relaxed">
                ต้องถ่ายรูปเซลฟี่เพื่อเข้างานก่อน<br/>จึงจะมองเห็นกระดานออเดอร์ได้ครับ 📸
              </p>
              <button 
                onClick={() => { setCameraAction('in'); setShowCameraModal(true); }} 
                className="w-full max-w-xs py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/30 active:scale-95 transition-all text-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera size={20}/> ถ่ายรูปเข้างาน
              </button>
          </div>
        ) : orders.length === 0 && !searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full bg-white/30 backdrop-blur-md rounded-3xl border border-white/40 shadow-xl animate-in fade-in duration-500 m-2">
            <div
              className="w-28 h-28 bg-white/50 text-blue-600 rounded-full flex items-center justify-center mb-8 shadow-inner border border-white/60"
              style={{ animation: "spin 10s linear infinite" }}
            >
              <Sun size={56} />
            </div>
            <h2 className="text-4xl font-black text-slate-800 mb-3 tracking-tight drop-shadow-sm">
              เริ่มต้นวันใหม่! 🌤️
            </h2>
            <p className="text-slate-700 font-bold mb-10 text-center max-w-md leading-relaxed drop-shadow-sm">
              กระดานว่างเปล่าพร้อมรับออเดอร์สำหรับวันนี้แล้ว
              <br />
              {(currentUserRole === "admin" || currentUserRole === "superadmin")
                ? "กดปุ่มด้านล่างเพื่อเริ่มเปิดออเดอร์แรกของวันได้เลยครับ"
                : "รอรับออเดอร์จากหน้าร้านเพื่อเริ่มทำอาหารครับ"}
            </p>
            {(currentUserRole === "admin" || currentUserRole === "superadmin") && (
              <button
                onClick={openCreateModal}
                className="px-10 py-5 bg-blue-600 text-white font-black rounded-4xl hover:bg-blue-700 hover:-translate-y-1 transition-all duration-300 flex items-center cursor-pointer tracking-wider uppercase text-base active:scale-95 shadow-lg shadow-blue-500/50"
              >
                <ClipboardCheck size={22} className="mr-3" /> เปิดร้าน /
                สร้างออเดอร์แรก
              </button>
            )}
          </div>
        ) : (
                    <div
                  ref={scrollContainerRef}
                  className={`flex-1 overflow-x-auto overflow-y-auto thin-scrollbar pb-6 pt-2 px-2 flex items-start gap-4 md:gap-5 ${isDraggingBoard ? "cursor-grabbing select-none" : "cursor-grab"}`}
                  onMouseDown={(e) => {
  const target = e.target as HTMLElement;
  
  // ป้องกันการลากกระดาน ถ้าผู้ใช้ตั้งใจจะคลิกปุ่ม พิมพ์ข้อความ ดูรูปภาพ หรือจับหัวการ์ดเพื่อสลับตำแหน่ง
  if (target.closest('button, a, input, textarea, select, img')) {
    return;
  }

  setIsDraggingBoard(true);
  setStartDragX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
  setScrollDragLeft(scrollContainerRef.current?.scrollLeft || 0);
}}
                  onMouseLeave={() => setIsDraggingBoard(false)}
                  onMouseUp={() => setIsDraggingBoard(false)}
                  onMouseMove={(e) => {
                    if (!isDraggingBoard || !scrollContainerRef.current) return;
                    e.preventDefault();
                    const x = e.pageX - (scrollContainerRef.current.offsetLeft || 0);
                    const walk = (x - startDragX) * 1.5;
                    scrollContainerRef.current.scrollLeft = scrollDragLeft - walk;
                  }}
                >
                  {filteredOrders.map((order, _index) => (
                        <div
                          key={order.id}
                          // 🌟 ใช้ currentTime แทน new Date().getTime()
                            className={`shrink-0 flex flex-col transition-all duration-300 ${isCompact ? "w-48 md:w-56" : "w-72 md:w-80"} ${                            ((order.status === "ออเดอร์ใหม่" || order.status === "กำลังทำ") && Math.floor((currentTime - new Date(order.created_at || 0).getTime()) / 60000) >= 5) ||
                            (currentUserRole !== "kitchen" && order.status === "รับงาน" && Math.floor((currentTime - new Date(order.created_at || 0).getTime()) / 60000) >= 35)  ? "rounded-3xl animate-border-blink" 
                            : ""
                          }`}
                        >
                          <OrderCard
                            order={order}
                            isCompact={isCompact}
                            isUpdating={updatingOrders.has(order.id)}
                            userRole={currentUserRole}
                            onEdit={openEditModal}
                            onStart={handleStartOrder}
                            onFinish={handleFinishOrder}
                            onViewDetails={() => {
                              setSelectedViewOrder(order);
                              setShowContactInfo(false);
                            }}
                            onViewImages={(urls, startIndex) =>
                              setImageGallery({ urls, startIndex })
                            }
                            onDelete={(id) => requestDeleteOrder(id, order.order_number)}
                            onChangeStatusRequest={(orderInfo) =>
                              setStatusModal({ isOpen: true, order: orderInfo })
                            }
                            onUnassignRider={handleUnassignRider}
                            onChangeRider={handleOpenRiderModal}
                            onAssignRider={handleOpenRiderModal}

                            // 🌟 NEW: ฟังก์ชันรับไฟล์สลิปที่โดนลากมาหยอดใส่การ์ด
                            onSlipDrop={async (orderId, file) => {
                              const targetOrder = orders.find(o => o.id === orderId);
                              if (targetOrder?.job_type === 'shopee') {
                                toast.error("งาน Shopee ไม่ต้องอัปโหลดสลิป");
                                return;
                              }
                              if (targetOrder?.payment_method !== 'โอน') {
                                toast.error("อัปโหลดสลิปได้เฉพาะการชำระเงินแบบ 'โอน' เท่านั้น");
                                return;
                              }
                              const loadingToast = toast.loading("กำลังอัปโหลดสลิป...");
                              const fileExt = file.name.split(".").pop();
                              const fileName = `slip-quick-${Date.now()}.${fileExt}`;
                              const filePath = `order-photos/${fileName}`;
                              
                              const { error: uploadError } = await supabase.storage.from("order-images").upload(filePath, file);
                              
                              if (uploadError) {
                                toast.dismiss(loadingToast);
                                toast.error("อัปโหลดสลิปไม่สำเร็จ ❌");
                                return;
                              }

                              const { data } = supabase.storage.from("order-images").getPublicUrl(filePath);
                              const newSlipUrl = data.publicUrl;

                              const updatedSlips = targetOrder?.slip_image ? `${targetOrder.slip_image},${newSlipUrl}` : newSlipUrl;

                              // อัปเดตหน้าจอทันที
                              setOrders(prev => prev.map(o => o.id === orderId ? { ...o, slip_image: updatedSlips } : o));
                              toast.dismiss(loadingToast);
                              toast.success("แนบสลิปเรียบร้อย! 📸");

                              // บันทึกลง DB แบบเงียบๆ
                              supabase.from("orders").update({ slip_image: updatedSlips }).eq("id", orderId).then(({error}) => {
                                if(error) fetchOrdersAndLocations(); // โหลดใหม่ถ้ามีปัญหา
                              });
                            }}
                          />
                        </div>
                  ))}
                </div>
        )}
      </div>

      {/* 🌟 Create / Edit Order Modal (Dark Theme & Calculator) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm z-50">
          <div className="w-full max-w-7xl flex gap-4 h-[90vh]">
            
            {/* 🌟 Left Pane: Menu Search + Full Calculator */}
            <div className="hidden lg:flex flex-col w-[28%] bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-slate-800 rounded-4xl h-full">
              <div className="p-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl shrink-0 space-y-4">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mb-2">
                    <Search className="text-rose-500" size={24} />
                    ค้นหาเมนู
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                      type="text"
                      placeholder="พิมพ์ชื่อเมนู..."
                      className="w-full bg-slate-800 border border-slate-700 p-3 pl-11 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all font-bold text-white placeholder-slate-500"
                      value={menuModalSearchQuery}
                      onChange={(e) => setMenuModalSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-3">
                {allBranchMenus
                  .filter(m => m.menu_name.toLowerCase().includes(menuModalSearchQuery.toLowerCase()))
                  .slice(0, 30)
                  .map(menu => (
                    <div
                      key={menu.id}
                      className="bg-slate-800/50 border border-slate-700/50 p-3 rounded-2xl flex justify-between items-center hover:bg-slate-800 transition-colors cursor-pointer group"
                      onClick={() => {
                        const currentMenuText = formData.menu.trim();
                        const newMenuText = currentMenuText ? `${currentMenuText}\n- ${menu.menu_name} 1` : `- ${menu.menu_name} 1`;
                        setFormData({
                          ...formData,
                          menu: newMenuText
                        });
                        toast.success(`เพิ่ม ${menu.menu_name} ลงในออเดอร์`);
                      }}
                    >
                      <span className="font-bold text-slate-200 text-sm group-hover:text-rose-400 transition-colors">{menu.menu_name}</span>
                      <span className="font-black text-rose-400">฿{menu.price}</span>
                    </div>
                  ))}
                {allBranchMenus.filter(m => m.menu_name.toLowerCase().includes(menuModalSearchQuery.toLowerCase())).length === 0 && (
                  <div className="text-center text-slate-500 font-bold py-10 text-sm">ไม่พบเมนู</div>
                )}
              </div>

              {/* 🌟 Full calculator area (Sticky Bottom) */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 text-slate-300 font-black uppercase tracking-wide text-xs">
                    <Calculator size={16} className="text-blue-400" />
                    เครื่องคิดเลข
                  </div>
                </div>
                <div className="bg-slate-800 border border-slate-700 p-3 rounded-2xl">
                  <input
                    type="text"
                    placeholder="พิมพ์สูตรหรือใช้ปุ่ม"
                    className="w-full bg-slate-900 border border-slate-700 p-3 rounded-2xl text-sm outline-none text-white font-black placeholder-slate-500"
                    value={calcInput}
                    onChange={(e) => setCalcInput(e.target.value)}
                  />
                  <div className="text-slate-400 text-xs mt-2 flex justify-between">
                    <span>ผลลัพธ์:</span>
                    <span className="font-black text-white text-sm">{calcResult}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <button type="button" className="py-2 bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 rounded-lg font-black transition-colors" onClick={() => setCalcInput('')}>C</button>
                    <button type="button" className="py-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '/')}>/</button>
                    <button type="button" className="py-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '*')}>*</button>
                    <button type="button" className="py-2 bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 rounded-lg font-black transition-colors" onClick={() => setCalcInput(prev => prev.slice(0, -1))}>⌫</button>

                    <button type="button" className="py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '7')}>7</button>
                    <button type="button" className="py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '8')}>8</button>
                    <button type="button" className="py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '9')}>9</button>
                    <button type="button" className="py-2 bg-indigo-500/40 text-indigo-200 hover:bg-indigo-500/60 rounded-lg font-black text-2xl row-span-3 flex justify-center items-center shadow-inner" onClick={() => setCalcInput(prev => prev + '+')}>+</button>

                    <button type="button" className="py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '4')}>4</button>
                    <button type="button" className="py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '5')}>5</button>
                    <button type="button" className="py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '6')}>6</button>

                    <button type="button" className="py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '1')}>1</button>
                    <button type="button" className="py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '2')}>2</button>
                    <button type="button" className="py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '3')}>3</button>

                    <button type="button" className="col-span-2 py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '0')}>0</button>
                    <button type="button" className="py-2 bg-slate-700/50 hover:bg-slate-600 text-white rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '.')}>.</button>
                    <button type="button" className="py-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 rounded-lg font-black" onClick={() => setCalcInput(prev => prev + '-')}>-</button>

                    <button type="button" className="col-span-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black shadow-md mt-1" onClick={() => {
                        try {
                          const sanitized = calcInput.replace(/[^0-9+\-*/().]/g, '');
                          if (!sanitized) return;
                          const result = Function('"use strict";return (' + sanitized + ')')();
                          setCalcInput(String(result));
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        } catch (err) { toast.error('รูปแบบการคำนวณไม่ถูกต้อง'); }
                      }}>=</button>
                  </div>
                </div>
              </div>
            </div>

            {/* 🌟 Center Pane: Order Form */}
            <div className="flex-1 lg:w-[42%] bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-slate-800 thin-scrollbar rounded-4xl h-full pb-10 overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl sticky top-0 z-10">
              <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <ClipboardCheck className="text-blue-500" />
                {editingId ? "แก้ไขออเดอร์ 📝" : "สร้างออเดอร์ใหม่ ✨"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 p-2 rounded-xl transition-all cursor-pointer hover:rotate-90 duration-300 active:scale-90"
              >
                <X size={20} strokeWidth={3} />
              </button>
            </div>

            <form
              id="orderForm"
              onSubmit={handleSubmitOrder}
              className="p-4 space-y-2 bg-slate-900"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1 tracking-wide uppercase">
                    ออเดอร์ (ร้าน) *
                  </label>
                  <input
                    className="w-full bg-blue-900 border border-blue-700 p-2.5 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-500 transition-all font-bold text-white placeholder-blue-300 shadow-sm"
                    value={formData.order_number}
                    onChange={(e) =>
                      setFormData({ ...formData, order_number: e.target.value })
                    }
                    placeholder="พิมพ์หรือปล่อยว่างเพื่อรันอัตโนมัติ"
                    required={formData.job_type === "ร้าน"}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1 tracking-wide uppercase">
                    ประเภทงาน
                  </label>
                  <select
                    className="w-full bg-purple-900 border border-purple-700 p-2.5 rounded-xl text-base outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-500 transition-all cursor-pointer font-bold text-white shadow-sm"
                    value={formData.job_type}
                    onChange={(e) => {
                      setFormData({ ...formData, job_type: e.target.value });
                    }}
                  >
                    <option value="ร้าน">🍽️ งานร้าน</option>
                    <option value="shopee">🧡 Shopee</option>
                  </select>
                </div>
              </div>

              {formData.job_type !== "shopee" && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 mb-1 tracking-wide uppercase">
                        แหล่งที่มา (เพจ)
                      </label>
                      <select
                        required
                        className="w-full bg-amber-900 border border-amber-700 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-500 transition-all cursor-pointer font-bold text-white shadow-sm"
                        value={formData.contact_source}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            contact_source: e.target.value,
                          });
                        }}
                      >
                        <option value="" disabled>เลือกแหล่งที่มา...</option>
                        {contactSources.length > 0 ? (
                          contactSources.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>ไม่พบข้อมูล</option>
                        )}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="flex text-[10px] font-black text-slate-400 mb-1 tracking-wide uppercase items-center">
                        <Lock size={12} className="mr-1" /> ลิ้งค์ติดต่อ
                        (ซ่อนเป็นความลับ)
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full bg-emerald-900 border border-emerald-700 p-2.5 rounded-xl text-base outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 transition-all font-bold text-white placeholder-emerald-300 shadow-sm"
                        value={formData.contact_link}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contact_link: e.target.value,
                          })
                        }
                        placeholder="เช่น https://www.facebook.com/customer"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-black text-slate-400 tracking-wide uppercase">
                    รายการอาหาร / เมนู
                  </label>
                  <Link
                    href="/menus"
                    target="_blank"
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 border border-blue-500/50 text-blue-400 rounded-lg text-xs font-black shadow-md hover:bg-blue-600/30 transition-all cursor-pointer active:scale-95"
                  >
                    <Plus size={14} />
                    เพิ่มเมนูใหม่
                  </Link>
                </div>
                <textarea
                  rows={2}
                  required
                  className="w-full bg-rose-900 border border-rose-700 p-2.5 rounded-xl text-base outline-none focus:ring-2 focus:ring-rose-600 focus:border-rose-500 transition-all resize-none font-bold leading-relaxed text-white placeholder-rose-300 shadow-sm"
                  value={formData.menu}
                  onChange={(e) => {
                    setFormData({ ...formData, menu: e.target.value });
                  }}
                  placeholder={"พิมพ์คีย์เวิร์ด เช่น\n- กะเพราหมูกรอบ 2\n- ชาเขียว 1\nแล้วจะมีเมนูด้านล่างมาให้เลือก"}
                />
                
                <div className="flex overflow-x-auto gap-2 mt-2 pb-2 thin-scrollbar snap-x">
                  {(() => {
                    const lines = formData.menu.split('\n');
                    const currentLine = lines[lines.length - 1] || "";
                    const searchKeyword = currentLine.replace(/[0-9]/g, '').trim().toLowerCase();

                    let currentMenus = allBranchMenus;

                    if (searchKeyword) {
                      const matched = currentMenus.filter(m => m.menu_name.toLowerCase().includes(searchKeyword));
                      if (matched.length > 0) currentMenus = matched; 
                    }

                    return currentMenus.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          const newLines = [...lines];
                          if (searchKeyword) {
                            newLines[newLines.length - 1] = item.menu_name + " 1"; 
                          } else {
                            if (newLines[newLines.length - 1].trim() === "") {
                              newLines[newLines.length - 1] = item.menu_name + " 1";
                            } else {
                              newLines.push(item.menu_name + " 1");
                            }
                          }
                          
                          const newMenuText = newLines.join('\n');
                          setFormData({ ...formData, menu: newMenuText });
                        }}
                        className={`shrink-0 snap-start text-[10px] font-black px-3 py-1.5 border rounded-lg transition-all active:scale-95 shadow-sm cursor-pointer whitespace-nowrap ${
                          searchKeyword && item.menu_name.toLowerCase().includes(searchKeyword)
                            ? "bg-blue-900 border-blue-500 text-blue-300 ring-1 ring-blue-500/50" 
                            : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {searchKeyword && item.menu_name.toLowerCase().includes(searchKeyword) ? "✨ แนะนำ: " : "+ "} 
                        {item.menu_name} (฿{item.price})
                      </button>
                    ));
                  })()}
                </div>

              </div>

              <div className="pt-1">
                <label className="block text-[10px] font-black text-slate-400 mb-1 tracking-wide uppercase">
                  แนบรูปภาพ (หลายรูปได้)
                </label>
                {(existingImages.length > 0 || imagePreviews.length > 0) && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {existingImages.map((url, i) => (
                      <div
                        key={`exist-${i}`}
                        className="relative w-12 h-12 rounded-lg overflow-hidden shadow-sm border border-slate-700 group"
                      >
                        <Image
                          src={url}
                          fill
                          sizes="48px"
                          className="object-cover"
                          alt="Existing"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(i)}
                          className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} strokeWidth={3} />
                        </button>
                      </div>
                    ))}
                    {imagePreviews.map((url, i) => (
                      <div
                        key={`new-${i}`}
                        className="relative w-12 h-12 rounded-lg overflow-hidden shadow-sm border-2 border-blue-500 border-dashed group"
                      >
                        <Image
                          src={url}
                          fill
                          sizes="48px"
                          className="object-cover opacity-80"
                          alt="New"
                        />
                        <button
                          type="button"
                          onClick={() => removeNewImage(i)}
                          className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} strokeWidth={3} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  tabIndex={0}
                  onDrop={handleDropImage}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onPaste={handlePasteImage}
                  className="border border-dashed border-slate-600 rounded-xl p-2.5 hover:border-blue-500 hover:bg-slate-800/80 transition-all bg-slate-800 flex flex-row items-center justify-center gap-2 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <ImagePlus className="text-slate-400 shrink-0" size={18} strokeWidth={2} />
                  <div className="text-left flex-1 flex items-center gap-2">
                    <div className="font-bold text-slate-300 text-xs">ลากไฟล์ลงตรงนี้ หรือ</div>
                    <label htmlFor="file-upload" className="text-xs font-black text-blue-400 hover:text-blue-300 cursor-pointer underline tracking-wide">คลิกเลือกไฟล์</label>
                    <input id="file-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleFileInput} />
                  </div>
                </div>
              </div>

              {formData.job_type !== "shopee" && (
                <div className="space-y-2 pt-2 border-t border-slate-800 mt-2">
                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-3">
                      <label className="block text-[10px] font-black text-slate-400 mb-1 tracking-wide uppercase">
                        ค่าอาหาร (บาท)
                      </label>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        className="w-full bg-indigo-900 border border-indigo-700 p-2.5 rounded-xl text-lg outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-500 transition-all font-black text-white placeholder-indigo-300 shadow-sm"
                        value={formData.total_price}
                        onChange={(e) => setFormData({ ...formData, total_price: e.target.value.replace(/[^0-9]/g, "") })}
                        placeholder="0"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 mb-1 tracking-wide uppercase">
                        ช่องทางชำระเงิน
                      </label>
                      <select
                        required
                        className="w-full bg-cyan-900 border border-cyan-700 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-cyan-600 focus:border-cyan-500 transition-all cursor-pointer font-bold text-white shadow-sm"
                        value={formData.payment_method}
                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      >
                        <option value="" disabled>เลือกช่องทาง...</option>
                        <option value="โอน">📱 โอน</option>
                        <option value="เงินสด">💵 เงินสด</option>
                        <option value="คนละครึ่ง">½ คนละครึ่ง</option>
                      </select>
                    </div>
                  </div>

                  <div className="relative p-3 bg-slate-800/50 border border-slate-700 rounded-2xl shadow-sm">
                    <label className="text-[10px] font-black text-slate-400 mb-1.5 tracking-wide flex items-center uppercase">
                      <Search size={14} className="mr-1.5" /> สถานที่จัดส่ง / ลิงก์แผนที่ *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full bg-slate-900 border border-slate-600 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-400 font-bold text-white transition-all placeholder-slate-400 shadow-sm"
                      value={formData.location_name}
                      onChange={(e) => handleLocationSearch(e.target.value)}
                      onFocus={() => {
                        if (unifiedResults.length > 0) setShowSuggestions(true);
                      }}
                      onBlur={() =>
                        setTimeout(() => setShowSuggestions(false), 200)
                      }
                      placeholder="พิมพ์ชื่อหอพัก หรือ วางลิงก์ Google Maps ที่ลูกค้าแชร์มา..."
                    />

                    {showSuggestions && unifiedResults.length > 0 && (
                      <ul className="absolute z-50 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl mt-2 max-h-60 overflow-y-auto divide-y divide-slate-700 thin-scrollbar w-11/12 max-w-full">
                        {unifiedResults.map((item, idx) => (
                          <li
                            key={idx}
                            className="p-4 hover:bg-slate-700 cursor-pointer text-base flex justify-between items-center transition-colors group/item"
                            onClick={() => selectUnifiedResult(item)}
                          >
                            <div className="flex flex-col pr-4">
                              <div className="font-black text-white flex items-center group-hover/item:text-blue-400 transition-colors">
                                {item.type === "store" ? (
                                  <Store size={14} className="mr-2 text-blue-400" />
                                ) : (
                                  <MapIcon size={14} className="mr-2 text-rose-400" />
                                )}
                                {item.name}
                              </div>
                              <div className="text-sm text-slate-400 font-medium truncate mt-1">
                                {item.address}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {item.type === "store" ? (
                                <span className="text-sm font-black bg-blue-900/50 text-blue-300 px-2.5 py-1 rounded-lg border border-blue-800">
                                  หมุดร้าน ({item.distanceText})
                                </span>
                              ) : (
                                <span className="text-sm font-black bg-slate-900 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
                                  Google Maps
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex justify-end pt-4 pb-4">
                      <Link
                        href="/dorms"
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-[10px] font-black text-blue-400 hover:text-white hover:bg-blue-600 transition-colors uppercase tracking-widest bg-blue-900/30 border border-blue-800 px-3 py-2 rounded-xl active:scale-95 cursor-pointer shadow-sm"
                      >
                        <Plus size={12} strokeWidth={3} /> ไปหน้าเพิ่มที่อยู่ใหม่หากยังไม่มีข้อมูลในระบบร้าน
                      </Link>
                    </div>

                    <div className="border-t border-slate-700 pt-4">
                      <label className="block text-sm font-black text-slate-400 mb-2 tracking-wide uppercase">
                        รายละเอียดเพิ่มเติม (Note)
                      </label>
                      <textarea
                        rows={2}
                        className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-base outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none font-medium leading-relaxed text-white placeholder-slate-500 shadow-sm"
                        value={formData.details}
                        onChange={(e) =>
                          setFormData({ ...formData, details: e.target.value })
                        }
                        placeholder="ระบุข้อความถึงไรเดอร์..."
                      />
                    </div>
                  </div>
                </div>
              )}
            </form>
            </div>

            {/* 🌟 Right Pane: Order Summary */}
            <div className="hidden lg:flex flex-col w-[28%] bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-slate-800 rounded-4xl h-full">
              <div className="p-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl shrink-0">
                <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <ClipboardList className="text-rose-500" size={24} />
                  สรุปออเดอร์
                </h3>
                <p className="text-slate-400 text-sm mt-2">ดูยอด รวม และรายการที่เลือกแบบเรียลไทม์</p>
              </div>
              <div className="flex-1 overflow-y-auto thin-scrollbar p-6 space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-slate-400 uppercase tracking-widest text-[10px] font-black">
                    <span>เมนูที่เพิ่ม</span>
                    <span>{orderLineItems.length} รายการ</span>
                  </div>
                  <div className="space-y-2">
                    {orderLineItems.length > 0 ? orderLineItems.map((line, idx) => (
                      <div key={idx} className="rounded-3xl bg-slate-800 border border-slate-700 p-3 text-sm text-slate-200">
                        {line}
                      </div>
                    )) : (
                      <div className="text-slate-500 text-sm font-medium">ยังไม่มีเมนู</div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-800 border border-slate-700 rounded-3xl">
                  <div className="text-slate-400 uppercase tracking-wide text-[10px] font-black mb-4">สรุปราคา</div>
                  <div className="space-y-3 text-sm text-slate-300">
                    <div className="flex justify-between">
                      <span>ค่าอาหาร</span>
                      <span>฿{Number(formData.total_price || 0).toLocaleString()}</span>
                    </div>
                    
                  </div>
                  <div className="border-t border-slate-700 pt-4 mt-4 flex justify-between items-center text-white font-black text-lg">
                    <span>รวมทั้งหมด</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-800 border border-slate-700 rounded-3xl space-y-3">
                  <div className="text-slate-400 uppercase tracking-wide text-[10px] font-black">รายละเอียดด่วน</div>
                  <div className="text-sm text-slate-200 space-y-2">
                    <div className="flex justify-between"><span>ประเภทงาน</span><span>{formData.job_type}</span></div>
                    <div className="flex justify-between"><span>ช่องทางชำระ</span><span>{formData.payment_method}</span></div>
                    <div className="flex justify-between"><span>ชื่อที่อยู่</span><span>{formData.location_name || '-'}</span></div>
                  </div>
                </div>

                <button
                  type="submit"
                  form="orderForm"
                  disabled={isUploading}
                  className="w-full bg-blue-600 text-white font-black py-4 rounded-4xl hover:bg-blue-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 flex justify-center items-center cursor-pointer text-base uppercase tracking-widest disabled:bg-slate-700 disabled:text-slate-400 disabled:hover:translate-y-0 disabled:hover:shadow-none active:scale-95 shadow-lg shadow-blue-500/20"
                >
                  {isUploading
                    ? "กำลังจัดเก็บข้อมูล..."
                    : editingId
                      ? "บันทึกการแก้ไข"
                      : "สร้างออเดอร์"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Status Change Modal */}
      {statusModal.isOpen && statusModal.order && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 z-150">
          <div className="bg-white rounded-4xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 flex flex-col relative border border-white/20">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center shadow-inner">
                  <ArrowRightLeft size={24} className="animate-wiggle" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  เปลี่ยนสถานะ
                </h3>
              </div>
              <button
                onClick={() => setStatusModal({ isOpen: false, order: null })}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 active:scale-90"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-3 bg-slate-50/50">
              {["ออเดอร์ใหม่", "กำลังทำ", "รับงาน", "ส่งแล้ว/เสร็จ"].map((st) => (
                <button
                  key={st}
                  disabled={statusModal.order?.status === st}
                  onClick={() => executeStatusChange(st)}
                  className={`w-full py-4 rounded-2xl text-base font-black transition-all shadow-sm flex items-center justify-center active:scale-95 ${
                    statusModal.order?.status === st
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : st === "ออเดอร์ใหม่"
                        ? "bg-blue-50 hover:bg-blue-500 hover:text-white text-blue-700 border border-blue-200 hover:shadow-lg shadow-blue-500/30"
                        : st === "กำลังทำ"
                          ? "bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-700 border border-amber-200 hover:shadow-lg shadow-amber-500/30"
                          : st === "รับงาน"
                            ? "bg-purple-50 hover:bg-purple-500 hover:text-white text-purple-700 border border-purple-200 hover:shadow-lg shadow-purple-500/30"
                            : "bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-700 border border-emerald-200 hover:shadow-lg shadow-emerald-500/30"
                  }`}
                >
                  {statusModal.order?.status === st
                    ? `📌 สถานะปัจจุบัน: ${st === 'รับงาน' ? 'รับงาน (ทำอาหารเสร็จ)' : st}`
                    : `เปลี่ยนเป็น: ${st === 'รับงาน' ? 'รับงาน (ทำอาหารเสร็จ)' : st}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🌟 View Details Modal */}
      {selectedViewOrder && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm z-50">
          <div className="bg-white rounded-4xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 md:p-6 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
              <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center">
                <ClipboardList size={20} className="mr-2 text-blue-600" />{" "}
                รายละเอียดออเดอร์
              </h3>
              <button
                type="button"
                onClick={() => setSelectedViewOrder(null)}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all cursor-pointer hover:rotate-90 duration-300 active:scale-90"
              >
                <X size={20} strokeWidth={3} />
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-5 overflow-y-auto bg-slate-50/30 thin-scrollbar">
              <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                <div>
                  <div className="text-sm font-black text-slate-400 mb-1 tracking-wider uppercase">
                    เลขที่ออเดอร์
                  </div>
                  <div className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter">
                    {selectedViewOrder.order_number}
                  </div>
                </div>
                <div className="text-right mb-1">
                  <button
                    onClick={() => {
                      setStatusModal({
                        isOpen: true,
                        order: selectedViewOrder,
                      });
                    }}
                    className={`flex items-center gap-1.5 text-sm font-black px-3 py-1.5 rounded-lg shadow-sm border cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                      selectedViewOrder.status === "New"
                        ? "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200"
                        : selectedViewOrder.status === "กำลังทำ"
                          ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                          : selectedViewOrder.status === "รับงาน"
                            ? "bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                    }`}
                    title="คลิกเพื่อแก้ไขสถานะ"
                  >
                    {selectedViewOrder.status === 'รับงาน' ? 'รับงาน (ทำเสร็จแล้ว)' : selectedViewOrder.status}{" "}
                    <ArrowRightLeft size={12} className="opacity-70" />
                  </button>
                </div>
              </div>

              {(currentUserRole === "admin" || currentUserRole === "superadmin") &&
                (selectedViewOrder as Order & { contact_source?: string })
                  .contact_source && (
                  <div className="space-y-2 mt-2 mb-4">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center">
                      <Store size={14} className="mr-1.5 text-blue-500" /> แหล่งที่มา / ร้าน
                    </div>
                    <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-base font-black text-slate-800 shadow-sm flex items-center">
                      {
                        (
                          selectedViewOrder as Order & {
                            contact_source?: string;
                          }
                        ).contact_source
                      }
                    </div>
                  </div>
                )}

              {(currentUserRole === 'admin' || currentUserRole === 'superadmin') && (selectedViewOrder as Order & { contact_link?: string }).contact_link && (
                <div className="space-y-2">
                  <div className="text-sm font-black text-indigo-500 uppercase tracking-wider flex items-center">
                    <Lock size={14} className="mr-1.5" /> ช่องทางติดต่อลูกค้า (ลับ)
                  </div>
                  
                  {(() => {
                    const isRevealed = currentUserRole === 'superadmin' || isEmergencyMode || showContactInfo;
                    return (
                      <div className={`p-3 rounded-xl border flex justify-between items-center shadow-inner ${isEmergencyMode ? "bg-rose-50 border-rose-200" : "bg-indigo-50 border-indigo-100"}`}>
                        {isRevealed ? (
                          <a 
                            href={(selectedViewOrder as Order & { contact_link?: string }).contact_link!.startsWith('http') ? (selectedViewOrder as Order & { contact_link?: string }).contact_link : `https://${(selectedViewOrder as Order & { contact_link?: string }).contact_link}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-blue-600 font-bold text-sm underline break-all"
                          >
                            {(selectedViewOrder as Order & { contact_link?: string }).contact_link}
                          </a>
                        ) : (
                          <div className="text-sm text-indigo-300 blur-sm select-none font-black tracking-widest">
                            https://facebook.com/hidden-data...
                          </div>
                        )}
                        
                        {!isRevealed && (
                          <button
                            onClick={() => {
                              const pin = window.prompt("กรุณาใส่รหัส PIN เพื่อดูข้อมูลลูกค้า (ค่าเริ่มต้น: 9999):");
                              if (pin === "9999") setShowContactInfo(true);
                              else if (pin) alert("รหัสผ่านไม่ถูกต้อง ❌");
                            }}
                            className="ml-3 px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-[10px] font-black transition-colors shrink-0 shadow-sm cursor-pointer"
                          >
                            ปลดล็อก
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {selectedViewOrder.menu && (
                <div className="space-y-2">
                  <div className="text-sm font-black text-slate-400 uppercase tracking-wider">
                    รายการที่สั่ง
                  </div>
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-base text-slate-700 font-bold whitespace-pre-line leading-relaxed shadow-inner">
                    {selectedViewOrder.menu}
                  </div>
                </div>
              )}

              {selectedViewOrder.details && (
                <div className="space-y-2">
                  <div className="text-sm font-black text-slate-400 uppercase tracking-wider">
                    หมายเหตุ (Note)
                  </div>
                  <div className="p-4 bg-yellow-50/50 rounded-2xl border border-yellow-100/50 text-sm md:text-base text-slate-600 font-medium whitespace-pre-line leading-relaxed">
                    {selectedViewOrder.details}
                  </div>
                </div>
              )}

              {selectedViewOrder.image_url && (
                <div className="space-y-2">
                  <div className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center">
                    <ImageIcon size={14} className="mr-1.5" /> รูปภาพแนบ
                  </div>
                  <div className="flex flex-col gap-3">
                    {selectedViewOrder.image_url
                      .split(",")
                      .filter(Boolean)
                      .map((imgUrl: string, i: number) => (
                        <div
                          key={i}
                          onClick={() =>
                            setImageGallery({
                              urls: selectedViewOrder
                                .image_url!.split(",")
                                .filter(Boolean),
                              startIndex: i,
                            })
                          }
                          className="relative w-full h-48 rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-zoom-in bg-black/10"
                        >
                          <Image
                            src={imgUrl}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-contain"
                            alt={`img-${i}`}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 text-base shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">ประเภทงาน:</span>
                  <span className="font-black text-slate-700 uppercase px-2.5 py-1 bg-slate-50 rounded-md border border-slate-200">
                    {selectedViewOrder.job_type}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">
                    ยอดเรียกเก็บ:
                  </span>
                  <span className="font-black text-blue-600 text-2xl">
                    ฿{selectedViewOrder.total_price || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">ค่าส่ง:</span>
                  <span className="font-black text-orange-500 text-2xl">
                    ฿{selectedViewOrder.delivery_fee || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">
                    การชำระเงิน:
                  </span>
                  <span
                    className={`font-black text-sm uppercase px-2.5 py-1 rounded-md ${selectedViewOrder.payment_method === "โอน" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}
                  >
                    {selectedViewOrder.payment_method || "เงินสด"}
                  </span>
                </div>
              </div>

              {selectedViewOrder.address && (
                <div className="space-y-2">
                  <div className="text-sm font-black text-slate-400 uppercase tracking-wider">
                    สถานที่จัดส่ง
                  </div>
                  <div className="flex items-start text-sm md:text-base text-slate-700 bg-red-50/50 p-4 rounded-2xl border border-red-100 font-bold">
                    <MapIcon
                      size={16}
                      className="mr-2 mt-0.5 text-red-500 shrink-0"
                    />
                    <span className="leading-relaxed break-all">
                      {selectedViewOrder.address.startsWith("http") ? (
                        <a
                          href={selectedViewOrder.address}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline cursor-pointer"
                        >
                          {selectedViewOrder.address}
                        </a>
                      ) : (
                        selectedViewOrder.address
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 md:p-5 shrink-0 bg-white border-t border-slate-100 mt-0 flex flex-col gap-2 shadow-2xl z-20">
              {selectedViewOrder.status === "ออเดอร์ใหม่" &&
                selectedViewOrder.job_type !== "shopee" && (
                  <button
                    onClick={() => handleStartOrder(selectedViewOrder.id)}
                    className="w-full py-3.5 md:py-4 bg-blue-600 text-white font-black rounded-4xl hover:bg-blue-700 transition-all cursor-pointer shadow-lg active:scale-95 text-sm md:text-base uppercase tracking-wide flex items-center justify-center gap-2"
                  >
                    <PlayCircle size={18} /> ยืนยัน: ครัวเริ่มทำอาหาร
                  </button>
                )}
              {selectedViewOrder.status === "กำลังทำ" &&
                selectedViewOrder.job_type !== "shopee" && (
                  <button
                    onClick={() => handleFinishOrder(selectedViewOrder.id)}
                    className={`w-full py-3.5 md:py-4 text-white font-black rounded-4xl transition-all cursor-pointer shadow-lg active:scale-95 text-sm md:text-base uppercase tracking-wide flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600`}
                  >
                    <ChefHat size={18} /> ยืนยัน: ครัวทำเสร็จแล้ว
                  </button>
                )}
              <button
                onClick={() => setSelectedViewOrder(null)}
                className="w-full py-3 md:py-3.5 bg-slate-100 text-slate-600 font-bold rounded-4xl hover:bg-slate-200 transition-all cursor-pointer active:scale-95 text-sm uppercase tracking-widest"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Image Gallery (ปรับพื้นหลังโปร่งใส) */}
      {imageGallery && (
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex flex-col animate-in fade-in duration-200 z-200"
          onClick={() => {
            setImageGallery(null);
            setImgScale(1);
          }}
        >
          <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-210 text-white pointer-events-none">
            <span className="font-bold text-xs bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm">
              คลิก 2 ครั้งเพื่อซูม / ใช้ปุ่มลูกศรเลื่อน
            </span>
            <button
              type="button"
              onClick={() => {
                setImageGallery(null);
                setImgScale(1);
              }}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-90 pointer-events-auto cursor-pointer"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
          {imageGallery.urls.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  scrollGallery("left");
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-210 transition-all cursor-pointer hidden md:block"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  scrollGallery("right");
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-210 transition-all cursor-pointer hidden md:block"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          <div
            ref={galleryRef}
            className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory thin-scrollbar z-200"
          >
            {imageGallery.urls.map((url, i) => (
              <div
                key={i}
                className={`w-full h-full shrink-0 snap-center p-2 flex overflow-auto ${imgScale > 1 ? "items-start justify-start" : "items-center justify-center"}`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  className={`transition-all duration-300 origin-center cursor-zoom-in shadow-2xl rounded-lg ${imgScale > 1 ? "m-auto" : ""}`}
                  style={{
                    width: imgScale > 1 ? `${imgScale * 100}%` : "100%",
                    height: imgScale > 1 ? "auto" : "100%",
                    objectFit: "contain",
                    maxWidth: imgScale > 1 ? "none" : "100%",
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setImgScale((prev) => (prev === 1 ? 2.5 : 1));
                  }}
                  alt={`Gallery ${i}`}
                />
              </div>
            ))}
          </div>
          <div
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-6 bg-gray-800/80 px-6 py-3 rounded-full backdrop-blur-md shadow-2xl z-210"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setImgScale((prev) => Math.max(1, prev - 0.5))}
              className={`p-2 rounded-full transition-all cursor-pointer ${imgScale <= 1 ? "text-slate-500 cursor-not-allowed" : "text-white hover:bg-white/20"}`}
              disabled={imgScale <= 1}
            >
              <ZoomOut size={24} />
            </button>
            <span className="text-white font-black text-sm w-12 text-center">
              {Math.round(imgScale * 100)}%
            </span>
            <button
              onClick={() => setImgScale((prev) => Math.min(4, prev + 0.25))}
              className={`p-2 rounded-full transition-all cursor-pointer ${imgScale >= 4 ? "text-slate-500 cursor-not-allowed" : "text-white hover:bg-white/20"}`}
              disabled={imgScale >= 4}
            >
              <ZoomIn size={24} />
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 pointer-events-none z-40">
        <div className="bg-white/90 backdrop-blur-xl p-2.5 rounded-full shadow-xl border border-slate-100 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-500">
          <div
            className="bg-blue-600 p-2.5 rounded-full text-white shadow-lg shadow-blue-500/40"
            style={{ animation: "pulse 2s ease-in-out infinite" }}
          >
            <Volume2 size={18} />
          </div>
          <span className="text-xs font-black text-slate-500 pr-3 tracking-widest uppercase">
            เสียงแจ้งเตือนเปิดแล้ว
          </span>
        </div>
      </div>

      <style jsx global>{`
        .thin-scrollbar::-webkit-scrollbar {
          height: 6px;
          width: 6px;
        }
        .thin-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .thin-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.4);
          border-radius: 10px;
        }
        .thin-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.8);
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-2px) rotate(-1deg);
          }
          50% {
            transform: translateX(2px) rotate(1deg);
          }
          75% {
            transform: translateX(-2px) rotate(-1deg);
          }
        }
        @keyframes wiggle {
          0%,
          100% {
            transform: rotate(-3deg);
          }
          50% {
            transform: rotate(3deg);
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
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
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-wiggle {
          animation: wiggle 2s ease-in-out infinite;
        }
      `}</style>

      {/* 🌟 Camera Modal for Attendance */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 z-160">
          <div className="bg-white rounded-4xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 flex flex-col relative border border-white/20">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${cameraAction === 'in' ? 'bg-emerald-100 text-emerald-500' : 'bg-rose-100 text-rose-500'} rounded-full flex items-center justify-center shadow-inner`}>
                  <Camera size={24} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {cameraAction === 'in' ? 'ถ่ายรูปเข้างาน' : 'ถ่ายรูปออกงาน'}
                </h3>
              </div>
              <button onClick={() => setShowCameraModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 active:scale-90">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center gap-4 bg-slate-50/50">
              <div className="w-full aspect-square bg-slate-200 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-300 shadow-inner">
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="Selfie preview" className="object-cover w-full h-full" />
                ) : (
                  <div className="text-slate-400 text-center">
                    <Camera size={60} className="mb-2 mx-auto" />
                    <p className="font-bold">รอรูปภาพ...</p>
                  </div>
                )}
              </div>
              
              <input 
                type="file" 
                accept="image/*" 
                capture="user" 
                id="selfie-camera" 
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPhotoFile(file);
                    setPhotoPreview(URL.createObjectURL(file));
                  }
                }}
              />

              <label htmlFor="selfie-camera" className={`w-full text-center py-4 rounded-2xl text-lg font-black transition-all shadow-sm active:scale-95 cursor-pointer ${photoFile ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200' : 'bg-white hover:bg-slate-50 border border-slate-200'}`}>
                {photoFile ? '📸 ถ่ายรูปใหม่อีกครั้ง' : '📸 เปิดกล้องเพื่อถ่ายรูป'}
              </label>

              <div className="flex w-full gap-3 mt-2">
                <button onClick={() => {setShowCameraModal(false); setPhotoFile(null); setPhotoPreview(null);}} className="flex-1 py-4 bg-slate-200 text-slate-600 rounded-2xl font-bold">
                  ยกเลิก
                </button>
                <button 
                  onClick={submitAttendance} 
                  disabled={!photoFile || isProcessingAttendance}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessingAttendance ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    cameraAction === 'in' ? 'ยืนยันเข้างาน' : 'ยืนยันออกงาน'
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">ระบบจะบันทึกรูปภาพ เวลา และคำนวณชั่วโมงทำงานของคุณ</p>
            </div>
          </div>
        </div>
      )}

      {isGalleryOpen && (
        <SharedGallery
          branchId={currentBranchId}
          userName={adminName}
          userRole={currentUserRole}
          onClose={() => setIsGalleryOpen(false)}
        />
      )}

      {/* Rider Selection Modal */}
      {riderModalOrder && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300 z-[200]">
          <div className="bg-white rounded-4xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center shadow-inner">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                    {riderModalOrder.rider_id ? 'เปลี่ยนคนขับ' : 'มอบหมายงาน'}
                  </h3>
                  <p className="text-slate-500 font-bold text-sm">สำหรับออเดอร์ #{riderModalOrder.order_number}</p>
                </div>
              </div>
              <button
                onClick={() => setRiderModalOrder(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 active:scale-90"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อไรเดอร์..."
                  value={riderModalSearch}
                  onChange={(e) => setRiderModalSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-base font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto thin-scrollbar bg-slate-50/50">
              {isRiderModalLoading ? (
                <div className="flex items-center justify-center p-10 text-slate-500 font-bold">
                  <Loader2 size={24} className="animate-spin mr-2" /> กำลังโหลด...
                </div>
              ) : (
                <div className="p-4 flex flex-col gap-2">
                  {availableRiders
                    .filter(r => r.username.toLowerCase().includes(riderModalSearch.toLowerCase()))
                    .map(rider => (
                      <button
                        key={rider.id}
                        onClick={() => handleSelectRider(rider)}
                        className="w-full text-left p-4 bg-white hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl flex items-center gap-4 transition-all duration-200 active:scale-95 shadow-sm group"
                      >
                        <div className="w-10 h-10 bg-slate-100 group-hover:bg-indigo-100 rounded-full flex items-center justify-center font-black text-indigo-800 text-lg transition-colors">
                          {rider.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-lg text-slate-700 group-hover:text-indigo-800 transition-colors">{rider.username}</span>
                      </button>
                    ))
                  }
                  {availableRiders.filter(r => r.username.toLowerCase().includes(riderModalSearch.toLowerCase())).length === 0 && (
                      <div className="text-center p-10 text-slate-500 font-bold">
                        <p>ไม่พบไรเดอร์ที่คุณค้นหา</p>
                      </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
