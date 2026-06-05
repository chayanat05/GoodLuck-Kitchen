"use client";
import { useState, useEffect, useRef, useMemo, useCallback, use } from "react";
import Link from "next/link";
import OrderCard, { Order } from "@/components/OrderCard";
import SlipScanner from "@/components/SlipScanner";
import SharedGallery from "@/components/SharedGallery";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
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
  CheckCircle2,
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
  AlertTriangle,
  Utensils,
  Calendar,
  Calculator,
  History,
  Trash2,
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
  const NOTIFICATION_SOUND_URL = "/audio-shop.mp3";

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
  interface CalcItem { name: string; qty: number; unitPrice: number; total: number; found: boolean; }
  interface UnifiedSearchResult { type: string; name: string; address?: string; lat?: number; lng?: number; distanceText?: string; menu_name?: string; price?: number; place_id?: string; }


  // 🌟 กำจัด Any ทั้งหมดและแทนที่ด้วย Interface ที่ถูกต้อง 100% 🌟
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [adminName, setAdminName] = useState<string>("กำลังโหลด...");
  const [currentUserRole, setCurrentUserRole] = useState<string>("kitchen");
  const [setSavedLocations] = useState<SavedLocation[]>([]);
  const [allBranchMenus, setAllBranchMenus] = useState<BranchMenu[]>([]);
  const [contactSources, setContactSources] = useState<ContactSource[]>([]);
  const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(false);
  const [bgColor, setBgColor] = useState<string>("#1e293b");
  const [bgImage, setBgImage] = useState<string>("");
  const [bgOption, setBgOption] = useState<"cover" | "contain" | "repeat">("cover");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedViewOrder, setSelectedViewOrder] = useState<Order | null>(null);
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; order: Order | null }>({ isOpen: false, order: null });
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [scannerConfig, setScannerConfig] = useState<{ isOpen: boolean; orderId: string | null; amount: number; initialImageUrls?: string[] }>({ isOpen: false, orderId: null, amount: 0 });
  const [showContactInfo, setShowContactInfo] = useState<boolean>(false);
  const [imageGallery, setImageGallery] = useState<{ urls: string[]; startIndex: number } | null>(null);
  const [imgScale, setImgScale] = useState<number>(1);
  const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResult[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  
  // 🌟 จัดการ State ที่เขียนไว้แปลกๆ ให้เป็นมาตรฐาน
  const [ridersLoc, setRidersLoc] = useState<RiderLocation[]>([]);

  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [showRiderMap, setShowRiderMap] = useState<boolean>(false);
  const [selectedRiderMapInfo, setSelectedRiderMapInfo] = useState<RiderLocation | null>(null);
  const [menuModalSearchQuery, setMenuModalSearchQuery] = useState("");
  const [calcInput, setCalcInput] = useState("");
  
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
    total_price: "10",
    delivery_fee: "10",
    payment_method: "โอน",
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
  const notificationAudio = useRef<HTMLAudioElement | null>(typeof window !== 'undefined' ? new Audio(NOTIFICATION_SOUND_URL) : null);

  const defaultMapCenter = useMemo(() => ({ lat: SHOP_LAT, lng: SHOP_LNG }), []);
  const [mapLibraries] = useState<"places"[]>(["places"]);
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: mapLibraries,
    language: "th",
    region: "TH",
  });

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
  
  const showToast = useCallback((msg: string) => {
    if (msg.includes('❌') || msg.includes('เกิดข้อผิดพลาด')) {
      toast.error(msg);
    } else if (msg.includes('🔔')) {
      toast.info(msg);
    } else {
      toast.success(msg);
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

    // Fetch Orders - แม่ครัวมองเห็นทั้งหมด แต่กรองอันที่โดนย้ายลงถังขยะออก
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("branch_id", currentBranchId,)
      .or("is_archived.is.null,is_archived.eq.false")
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("sort_index", { ascending: true })
      .order("created_at", { ascending: false });

    if (orderError) console.error("Error fetching orders:", orderError);
    if (orderData) {
      setOrders(orderData as Order[]);
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
      .order("created_at", { ascending: false }); 

    if (menuData) setAllBranchMenus(menuData as BranchMenu[]);
    if (sourceData) setContactSources(sourceData as ContactSource[]);

  }, [currentBranchId]);

  const fetchRidersLocation = useCallback(async () => {
    if (!currentBranchId) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, last_lat, last_lng, last_seen")
      .not("last_lat", "is", null);

    if (error) console.error(error);
    if (data) setRidersLoc(data as RiderLocation[]);
  }, [currentBranchId]);

  // 🌟 Smart Menu Matching
  const normalizeText = (text: string) => text.replace(/[\s\+\-\*\/_.,]/g, '').toLowerCase();

  const getExtractedQty = useCallback((cleanLine: string, menuName: string): number => {
    let qty = 1;
    const normalizedLine = normalizeText(cleanLine);
    const normalizedMenu = normalizeText(menuName);
    const idx = normalizedLine.indexOf(normalizedMenu);
    
    if (idx !== -1) {
        const afterStr = normalizedLine.substring(idx + normalizedMenu.length);
        const nextNumMatch = afterStr.match(/(\d+)/);
        if (nextNumMatch && nextNumMatch[1]) {
            qty = parseInt(nextNumMatch[1], 10);
        } else {
            const numbers = normalizedLine.match(/\d+/g);
            if (numbers && numbers.length > 0) {
                qty = parseInt(numbers[numbers.length - 1], 10);
            }
        }
    }
    return qty;
  }, []);

  const calculateAutoPrice = useCallback((menuText: string): string | null => {
    if (!menuText.trim()) return null;
    const lines = menuText.split('\n');
    let total = 0;
    const sortedMenus = [...allBranchMenus].sort((a, b) => b.menu_name.length - a.menu_name.length);

    lines.forEach(line => {
      const cleanLine = line.trim();
      if (!cleanLine) return;
      const normalizedLine = normalizeText(cleanLine);
      for (const item of sortedMenus) {
        if (normalizedLine.includes(normalizeText(item.menu_name))) {
          const qty = getExtractedQty(cleanLine, item.menu_name);
          total += (item.price * qty);
          break;
        }
      }
    });
    return total > 0 ? total.toString() : null;
  }, [allBranchMenus, getExtractedQty]);

  const calcBreakdown = useMemo<CalcItem[]>(() => {
    if (!formData.menu.trim()) return [];
    const lines = formData.menu.split('\n');
    const breakdown: CalcItem[] = [];
    const sortedMenus = [...allBranchMenus].sort((a, b) => b.menu_name.length - a.menu_name.length);

    lines.forEach(line => {
      const cleanLine = line.trim();
      if (!cleanLine) return;
      const normalizedLine = normalizeText(cleanLine);

      let matched = false;
      for (const item of sortedMenus) {
        if (normalizedLine.includes(normalizeText(item.menu_name))) {
          const qty = getExtractedQty(cleanLine, item.menu_name);
          breakdown.push({
            name: item.menu_name,
            qty,
            unitPrice: item.price,
            total: item.price * qty,
            found: true
          });
          matched = true;
          break;
        }
      }
      if (!matched) {
        breakdown.push({ name: cleanLine, qty: 0, unitPrice: 0, total: 0, found: false });
      }
    });
    return breakdown;
  }, [formData.menu, allBranchMenus, getExtractedQty]);


  // ---------------------------------------------------------------------------
  // 3. EFFECTS
  // ---------------------------------------------------------------------------

  // Unlock audio on first user interaction for iOS Safari
  useEffect(() => {
    const unlockAudio = () => {
      if (notificationAudio.current) {
        notificationAudio.current.play().then(() => {
          notificationAudio.current?.pause();
          if (notificationAudio.current) {
            notificationAudio.current.currentTime = 0;
          }
        }).catch(() => {});
        document.removeEventListener("touchstart", unlockAudio);
        document.removeEventListener("click", unlockAudio);
      }
    };
    document.addEventListener("touchstart", unlockAudio, { once: true });
    document.addEventListener("click", unlockAudio, { once: true });
    return () => {
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("click", unlockAudio);
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
      const { data } = await supabase.from("branches").select("id, theme_bg_color, theme_bg_image, theme_bg_option").eq("slug", branchSlug).single();
      if (data) {
        setCurrentBranchId(data.id);
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

      setCurrentUser(session.user);
      setAdminName(profile.username || (profile.role === "admin" ? "แอดมิน" : "แม่ครัว" ));
      setCurrentUserRole(profile.role);
      setIsMounted(true);
      fetchOrdersAndLocations();
    };

    checkAuthAndInit();

    const orderChannel = supabase
      .channel("public:orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `branch_id=eq.${currentBranchId}` }, (payload) => {
          if (!payload.new.is_archived) {
            notificationAudio.current?.play().catch(() => {});
            showToast(`🔔 มีออเดอร์ใหม่เข้า! ออเดอร์ที่ ${payload.new.order_number}`);
          }
          fetchOrdersAndLocations();
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `branch_id=eq.${currentBranchId}` }, () => fetchOrdersAndLocations())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders", filter: `branch_id=eq.${currentBranchId}` }, () => fetchOrdersAndLocations())
      .subscribe();

    const syncChannel = supabase
      .channel("public:sync_menus_sources")
      .on("postgres_changes", { event: "*", schema: "public", table: "branch_menus", filter: `branch_id=eq.${currentBranchId}` }, () => fetchOrdersAndLocations())
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_sources", filter: `branch_id=eq.${currentBranchId}` }, () => fetchOrdersAndLocations())
      .subscribe();
      
    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(syncChannel);
    };
  }, [fetchOrdersAndLocations, showToast, currentBranchId]);

  useEffect(() => {
    if (showRiderMap && currentBranchId) {
      const timer = setTimeout(() => fetchRidersLocation(), 0);
      const interval = setInterval(fetchRidersLocation, 10000);
      const profileChannel = supabase
        .channel("public:profiles")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => fetchRidersLocation())
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
      total_price: "10",
      delivery_fee: "10",
      payment_method: "โอน",
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
      total_price: order.total_price.toString(),
      delivery_fee: order.delivery_fee?.toString() || "10",
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
    const cleanDelivery = formData.job_type === "shopee" ? 0 : parseInt(formData.delivery_fee.replace(/[^0-9]/g, ""), 10) || 0;

    const orderData = {
      order_number: finalOrderNumber,
      job_type: formData.job_type,
      menu: formData.menu.trim(),
      details: formData.details.trim() || "",
      address: formData.job_type === "shopee" ? null : formData.location_name,
      image_url: currentExisting.join(","),
      total_price: cleanPrice,
      delivery_fee: cleanDelivery,
      payment_method: formData.job_type === "shopee" ? "โอน" : formData.payment_method,
      lat: formData.job_type === "shopee" ? null : formData.lat,
      lng: formData.job_type === "shopee" ? null : formData.lng,
      contact_link: formData.contact_link.trim(),
      contact_source: formData.contact_source.trim(),
    };

    let targetId = editingId;
    const isEdit = !!editingId;

    if (isEdit) {
      const { data } = await supabase.from("orders").update(orderData).eq("branch_id", currentBranchId).eq("id", editingId).select();
      if (data) {
        setOrders(orders.map((o) => (o.id === editingId ? (data[0] as Order) : o)));
        showToast("อัปเดตข้อมูลสำเร็จ! 📝");

        // 🌟 1. เพิ่ม Log การแก้ไขออเดอร์
        await supabase.from("activity_logs").insert([{
          branch_id: currentBranchId,
          user_name: adminName,
          action: "EDIT_ORDER",
          details: `แก้ไขข้อมูลออเดอร์ #${finalOrderNumber}`
        }]);
      }
    } else {
      const { data } = await supabase.from("orders").insert([{ ...orderData, branch_id: currentBranchId, status: "New" }]).select();
      if (data && data.length > 0) {
        targetId = data[0].id;
        setOrders([data[0] as Order, ...orders]);
        showToast("สร้างออเดอร์สำเร็จ! 🚀");
        
        // 🌟 2. เพิ่ม Log การสร้างออเดอร์
        await supabase.from("activity_logs").insert([{
          branch_id: currentBranchId,
          user_name: adminName,
          action: "CREATE_ORDER",
          details: `สร้างออเดอร์ใหม่ #${finalOrderNumber}`
        }]);

        notifyRoles(
          ['kitchen', 'rider', 'admin', 'superadmin'], 
          "✨ มีออเดอร์ใหม่เข้า!", 
          `ออเดอร์ #${finalOrderNumber} รอการยืนยัน`, 
          `/board/${branchSlug}`
        );
      }
    }

    setIsUploading(false);
    setIsModalOpen(false);
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);

    if (filesToUpload.length > 0 && targetId) {
      const uploadedUrls: string[] = [];
      for (const file of filesToUpload) {
        const url = await uploadImage(file);
        if (url) uploadedUrls.push(url);
      }
      if (uploadedUrls.length > 0) {
        const finalUrls = [...currentExisting, ...uploadedUrls].join(",");
        await supabase.from("orders").update({ image_url: finalUrls }).eq("branch_id", currentBranchId).eq("id", targetId);
        showToast("อัปโหลดรูปภาพทั้งหมดเสร็จสิ้น! 📸");
        fetchOrdersAndLocations();
      }
    }
  };

  const executeStatusChange = async (newStatus: string) => {
    if (!statusModal.order) return;
    const targetOrder = statusModal.order;

    const updateData: { status: string; end_time?: string } = { status: newStatus };
    if (newStatus === "ส่งแล้ว/เสร็จ" && targetOrder.job_type === "shopee") {
      updateData.end_time = new Date().toISOString();
    }

    setStatusModal({ isOpen: false, order: null });

    const { data, error } = await supabase.from("orders").update(updateData).eq("branch_id", currentBranchId).eq("id", targetOrder.id).select();
    if (error) {
      console.error(error);
      showToast("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ ❌");
    } else if (data) {
      setOrders(orders.map((o) => (o.id === targetOrder.id ? { ...o, ...data[0] } : o)));
      showToast(`เปลี่ยนสถานะเป็น "${newStatus}" แล้ว! 🔄`);
      
      // 🌟 3. เพิ่ม Log การปรับสถานะด้วยมือ
      await supabase.from("activity_logs").insert([{
        branch_id: currentBranchId,
        user_name: adminName,
        action: "CHANGE_STATUS",
        details: `ปรับสถานะออเดอร์ #${targetOrder.order_number} เป็น "${newStatus}"`
      }]);

      notifyRoles(
        ['rider', 'admin', 'superadmin', 'kitchen'], 
        `🔄 อัปเดตสถานะออเดอร์`, 
        `ออเดอร์ #${targetOrder.order_number} ถูกเปลี่ยนเป็น: ${newStatus}`, 
        `/board/${branchSlug}`
      );
      
      setSelectedViewOrder(null);
    }
  };

  const handleStartOrder = async (orderId: string) => {
    const { data, error } = await supabase.from("orders").update({ status: "กำลังทำ" }).eq("branch_id", currentBranchId).eq("id", orderId).select();
    if (error) console.error(error);
    if (data) {
      setOrders(orders.map((o) => (o.id === orderId ? (data[0] as Order) : o)));
      showToast("ครัวเริ่มทำอาหารแล้ว! 🍳");
      
      const orderNum = orders.find(o => o.id === orderId)?.order_number || "ล่าสุด";
      
      // 🌟 4. เพิ่ม Log การเริ่มทำอาหาร
      await supabase.from("activity_logs").insert([{
        branch_id: currentBranchId,
        user_name: adminName,
        action: "CHANGE_STATUS",
        details: `เริ่มทำอาหารออเดอร์ #${orderNum} (สถานะ: กำลังทำ)`
      }]);

      notifyRoles(
        ['rider', 'admin', 'superadmin'], 
        "🍳 ครัวกำลังทำอาหาร", 
        `ออเดอร์ #${orderNum} เริ่มปรุงแล้ว`, 
        `/board/${branchSlug}`
      );
      setSelectedViewOrder(null);
    }
  };

  const handleFinishOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const isShopee = targetOrder?.job_type === "shopee";
    const nextStatus = isShopee ? "ส่งแล้ว/เสร็จ" : "รับงาน";
    const updateData: { status: string; end_time?: string } = { status: nextStatus };
    if (isShopee) updateData.end_time = new Date().toISOString();

    const { data, error } = await supabase.from("orders").update(updateData).eq("branch_id", currentBranchId).eq("id", orderId).select();
    if (error) console.error(error);
    if (data) {
      setOrders(orders.map((o) => (o.id === orderId ? (data[0] as Order) : o)));
      showToast(isShopee ? "ส่งมอบให้ขนส่ง Shopee สำเร็จ! 📦" : "อาหารเสร็จแล้ว รอไรเดอร์มารับ! 🛵");

      const orderNum = orders.find(o => o.id === orderId)?.order_number || "ล่าสุด";
      
      // 🌟 5. เพิ่ม Log การทำอาหารเสร็จ
      await supabase.from("activity_logs").insert([{
        branch_id: currentBranchId,
        user_name: adminName,
        action: "CHANGE_STATUS",
        details: `ทำอาหารออเดอร์ #${orderNum} เสร็จแล้ว (สถานะ: ${nextStatus})`
      }]);

      notifyRoles(
        ['rider', 'admin', 'superadmin'], 
        "📦 อาหารพร้อมส่ง!", 
        `ออเดอร์ #${orderNum} เสร็จแล้ว ไรเดอร์มารับได้เลย`, 
        `/board/${branchSlug}`
      );
      setSelectedViewOrder(null);
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

  const requestDeleteOrder = (id: string, orderNumber: string) => {
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
        // 🌟 1. ทำ Soft Delete (ซ่อนออเดอร์)
        const { error } = await supabase
          .from("orders")
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq("id", id);
          
        if (error) {
          showToast("เกิดข้อผิดพลาดในการลบ ❌");
          return;
        }

        // 🌟 2. บันทึก Log การกระทำ
        await supabase.from("activity_logs").insert([{
          branch_id: currentBranchId,
          user_name: adminName,
          action: "DELETE_ORDER",
          details: `ย้ายออเดอร์ #${orderNumber} ลงถังขยะ`
        }]);

        setOrders((prev) => prev.filter((order) => order.id !== id));
        showToast("ย้ายออเดอร์ลงถังขยะแล้ว 🗑️");
      }
    });
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(orders);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setOrders(items);
    items.forEach((item, index) => {
      supabase.from("orders").update({ sort_index: index }).eq("branch_id", currentBranchId).eq("id", item.id).then(({ error }) => {
          if (error) console.error("Error updating sort index:", error);
        });
    });
  };

  const pendingOrders = useMemo(() => orders.filter((o) => ["New", "กำลังทำ", "รับงาน"].includes(o.status)), [orders]);

  const filteredOrders = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return orders.filter(
      (order) =>
        (order.order_number?.toLowerCase() || "").includes(q) ||
        (order.address?.toLowerCase() || "").includes(q) ||
        (order.rider_name?.toLowerCase() || "").includes(q),
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
            <h1 className="text-lg md:text-xl font-black text-slate-800 flex items-center whitespace-nowrap tracking-tight">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center hover:opacity-70 transition-opacity cursor-pointer text-left mr-2 md:mr-3"
                title="โหลดหน้าเว็บใหม่เพื่อแก้หน้าจอค้าง"
              >
                KANBAN <span className="text-blue-600 ml-1">BOARD</span>
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
          </div>

          <div className="flex flex-col sm:flex-row items-center w-full lg:w-auto gap-2">
            <div className="relative w-full sm:w-56">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="ค้นหาออเดอร์, สถานที่..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium shadow-inner"
              />
            </div>

            {currentUserRole === 'superadmin' && (
              <button
                onClick={async () => {
                  const newVal = !isEmergencyMode;
                  setIsEmergencyMode(newVal);
                  await supabase.from("store_settings").update({ emergency_reveal_contacts: newVal }).eq("id", 1);
                  showToast(newVal ? "เปิดโหมดฉุกเฉิน: แอดมินทุกคนเห็นลิ้งก์แล้ว! 🚨" : "ปิดโหมดฉุกเฉิน: ล็อกลิ้งก์ตามปกติ 🔒");
                }}
                className={`w-full sm:w-auto px-3 py-1.5 text-sm font-bold rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                  isEmergencyMode 
                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" 
                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                }`}
              >
                {isEmergencyMode ? "🚨 ปิดโหมดฉุกเฉิน" : "🔒 เปิดโหมดฉุกเฉิน"}
              </button>
            )}
            
            <button
              onClick={() => setIsCompact(!isCompact)}
              className="w-full sm:w-auto px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 text-sm font-bold rounded-xl hover:bg-slate-200 transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
            >
              {isCompact ? (
                <Expand size={14} className="text-blue-500" />
              ) : (
                <Shrink size={14} className="text-blue-500" />
              )}
              {isCompact ? "ขยายการ์ด" : "ย่อการ์ด"}
            </button>

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
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-8 text-white relative">
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

              <div className="h-px bg-slate-100 my-2"></div>

              {(currentUserRole === "kitchen" || currentUserRole === "superadmin") && (
                <Link
                  href="/kitchen"
                  prefetch={false}
                  className="w-full flex items-center p-4 text-slate-600 hover:bg-orange-50 hover:text-orange-700 rounded-2xl transition-all font-bold border border-transparent hover:border-orange-100 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                    <ChefHat size={20} className="text-orange-600" />
                  </div>
                  แดชบอร์ดของฉัน
                </Link>
              )}

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
                  <MarkerF
                    position={{ lat: SHOP_LAT, lng: SHOP_LNG }}
                    icon={{
                      url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                    }}
                    label={{
                      text: "ร้านของเรา",
                      color: "#b91c1c",
                      className:
                        "bg-white/90 px-2 py-0.5 rounded-full shadow-sm text-xs font-black mt-8 border border-red-200",
                    }}
                    onClick={() =>
                      setSelectedRiderMapInfo({
                        id: "shop",
                        username: "ร้านของเรา",
                        last_lat: SHOP_LAT,
                        last_lng: SHOP_LNG,
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
                          {selectedRiderMapInfo.id !== "shop" && (
                            <div
                              className={`text-sm font-bold px-2 py-0.5 rounded-full inline-block ${
                                ((lastSeen) => {
                                  if (!lastSeen) return false;
                                  const diffMins =
                                    (new Date().getTime() -
                                      new Date(lastSeen).getTime()) /
                                    60000;
                                  return diffMins < 5;
                                })(selectedRiderMapInfo.last_seen)
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {((lastSeen) => {
                                if (!lastSeen) return false;
                                const diffMins =
                                  (new Date().getTime() -
                                    new Date(lastSeen).getTime()) /
                                  60000;
                                return diffMins < 5;
                              })(selectedRiderMapInfo.last_seen)
                                ? "🟢 ออนไลน์"
                                : "⚫️ ออฟไลน์"}
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
              <div className="px-3 py-1.5 bg-red-50 text-red-700 text-sm font-bold rounded-lg border border-red-100 shrink-0 flex items-center gap-1.5">
                <div className="w-3 h-3 bg-red-500 rounded-full shadow-inner"></div>{" "}
                ร้านของเรา
              </div>
              <div className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-bold rounded-lg border border-blue-100 shrink-0 flex items-center gap-1.5">
                <div className="w-3 h-3 bg-blue-500 rounded-full shadow-inner animate-pulse"></div>{" "}
                ไรเดอร์
              </div>
              <span className="text-sm text-slate-400 my-auto ml-auto pl-4 whitespace-nowrap">
                *พิกัดอัปเดตทุก 30 วินาที*
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 KANBAN BOARD */}
      <div className="flex-1 p-2 md:p-4 overflow-hidden z-10 flex flex-col">
        {orders.length === 0 && !searchQuery ? (
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
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="all-orders" direction="horizontal">
              {(provided) => (
                <div
                  ref={(el) => {
                    provided.innerRef(el);
                    scrollContainerRef.current = el;
                  }}
                  {...provided.droppableProps}
                  className={`flex-1 overflow-x-auto overflow-y-hidden thin-scrollbar pb-6 pt-2 px-2 flex items-start gap-4 md:gap-5 ${isDraggingBoard ? "cursor-grabbing select-none" : "cursor-grab"}`}
                  onMouseDown={(e) => {
                    if (e.target !== scrollContainerRef.current) return;
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
                  {filteredOrders.map((order, index) => (
                    <Draggable
                      key={order.id}
                      draggableId={order.id}
                      index={index}
                      isDragDisabled={currentUserRole === "kitchen"}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`shrink-0 max-h-full flex flex-col transition-all duration-300 ${isCompact ? "w-48 md:w-56" : "w-72 md:w-80"} ${snapshot.isDragging ? "scale-[1.02] rotate-2 shadow-2xl z-50 ring-4 ring-blue-500/30 rounded-3xl" : ""} ${
  ((order.status === "New" || order.status === "กำลังทำ") && Math.floor((new Date().getTime() - new Date(order.created_at).getTime()) / 60000) >= 5) ||
  (currentUserRole !== "kitchen" && order.status === "รับงาน" && Math.floor((new Date().getTime() - new Date(order.created_at).getTime()) / 60000) >= 35)  ? "rounded-3xl animate-border-blink" 
  : ""
}`}
                        >
                          <OrderCard
                            order={order}
                            isCompact={isCompact}
                            userRole={currentUserRole}
                            dragHandleProps={provided.dragHandleProps}
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
                            onVerifySlip={(orderInfo) =>
                              setScannerConfig({
                                isOpen: true,
                                orderId: orderInfo.id,
                                amount: orderInfo.total_price,
                                initialImageUrls: orderInfo.slip_image ? orderInfo.slip_image.split(',').filter(Boolean) : undefined,
                              })
                            }
                            onDelete={(id) => requestDeleteOrder(id, order.order_number)}
                            onChangeStatusRequest={(orderInfo) =>
                              setStatusModal({ isOpen: true, order: orderInfo })
                            }
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
                        const autoFoodPrice = calculateAutoPrice(newMenuText);
                        let newTotalPrice = formData.total_price;

                        if (autoFoodPrice !== null) {
                          const currentDeliveryFee = parseInt(formData.delivery_fee || "0", 10);
                          newTotalPrice = (parseInt(autoFoodPrice, 10) + currentDeliveryFee).toString();
                        }
                        
                        setFormData({
                          ...formData,
                          menu: newMenuText,
                          total_price: newTotalPrice
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
                    {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','(',')'].map((k) => (
                      <button key={k} type="button" className="py-2 bg-slate-700/50 hover:bg-slate-600 rounded-lg font-bold text-white transition-colors" onClick={() => setCalcInput(prev => prev + k)}>{k}</button>
                    ))}
                    <button type="button" className="col-span-2 py-2 bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 rounded-lg font-black transition-colors" onClick={() => setCalcInput('')}>C</button>
                    <button type="button" className="col-span-2 py-2 bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 rounded-lg font-black transition-colors" onClick={() => setCalcInput(prev => prev.slice(0, -1))}>⌫</button>
                    <button
                      type="button"
                      className="col-span-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-black text-white transition-colors mt-1"
                      onClick={() => {
                        try {
                          const sanitized = calcInput.replace(/[^0-9+\-*/().]/g, '');
                          if (!sanitized) return;
                          const result = Function('"use strict";return (' + sanitized + ')')();
                          setCalcInput(String(result));
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        } catch (err) { toast.error('รูปแบบการคำนวณไม่ถูกต้อง'); }
                      }}
                    >=</button>

                    <button
                      type="button"
                      className="col-span-2 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg font-black transition-colors mt-1 text-xs"
                      onClick={() => {
                        try {
                          const sanitized = calcInput.replace(/[^0-9+\-*/().]/g, '');
                          if (!sanitized) return;
                          const result = Number(Function('"use strict";return (' + sanitized + ')')());
                          const currentPrice = Number(formData.total_price) || 0;
                          setFormData({ ...formData, total_price: String(currentPrice + result) });
                          toast.success(`เพิ่ม฿${result.toLocaleString()} เข้าเป็นยอดรวม`);
                          setCalcInput('');
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        } catch (e) { toast.error('ไม่สามารถเพิ่มยอดได้'); }
                      }}
                    >+ เป็นยอดรวม</button>

                    <button
                      type="button"
                      className="col-span-2 py-2 bg-fuchsia-600/20 hover:bg-fuchsia-600/40 text-fuchsia-400 rounded-lg font-black transition-colors mt-1 text-xs"
                      onClick={() => {
                        const val = calcInput.replace(/[^0-9.]/g, '');
                        if (!val) { toast.error('ไม่มีตัวเลขให้เพิ่มเป็นเมนู'); return; }
                        const newMenuText = formData.menu.trim() ? `${formData.menu}\n- ${val}` : `- ${val}`;
                        setFormData({ ...formData, menu: newMenuText });
                        toast.success(`เพิ่ม ${val} เป็นรายการชั่วคราว`);
                        setCalcInput('');
                      }}
                    >+ เป็นเมนู</button>
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
              onSubmit={handleSubmitOrder}
              className="p-6 space-y-6 bg-slate-900"
            >
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-black text-slate-400 mb-2 tracking-wide uppercase">
                    ออเดอร์ (ร้าน) *
                  </label>
                  <input
                    className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-lg outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-white placeholder-slate-500 shadow-sm"
                    value={formData.order_number}
                    onChange={(e) =>
                      setFormData({ ...formData, order_number: e.target.value })
                    }
                    placeholder="พิมพ์หรือปล่อยว่างเพื่อรันอัตโนมัติ"
                    required={formData.job_type === "ร้าน"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-400 mb-2 tracking-wide uppercase">
                    ประเภทงาน
                  </label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-base outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-bold text-white shadow-sm"
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
                  <div className="grid grid-cols-3 gap-5">
                    <div className="col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 mb-2 tracking-wide uppercase">
                        แหล่งที่มา (เพจ)
                      </label>
                      <select
                        className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-bold text-white shadow-sm"
                        value={formData.contact_source}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            contact_source: e.target.value,
                          });
                        }}
                      >
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
                      <label className="flex text-[10px] font-black text-slate-400 mb-2 tracking-wide uppercase items-center">
                        <Lock size={12} className="mr-1" /> ลิ้งค์ติดต่อ
                        (ซ่อนเป็นความลับ)
                      </label>
                      <input
                        type="text"
                        className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-base outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-white placeholder-slate-500 shadow-sm"
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
                <div className="flex justify-between items-center mb-2">
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
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-base outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none font-bold leading-relaxed text-white placeholder-slate-500 shadow-sm"
                  value={formData.menu}
                  onChange={(e) => {
                    const newMenu = e.target.value;
                    const autoFoodPrice = calculateAutoPrice(newMenu);
                    let newTotalPrice = formData.total_price;
                    
                    if (autoFoodPrice !== null) {
                      const currentDeliveryFee = parseInt(formData.delivery_fee || "0", 10);
                      newTotalPrice = (parseInt(autoFoodPrice, 10) + currentDeliveryFee).toString();
                    }
                    
                    setFormData({ ...formData, menu: newMenu, total_price: newTotalPrice });
                  }}
                  placeholder={"พิมพ์คีย์เวิร์ด เช่น\n- กะเพราหมูกรอบ 2\n- ชาเขียว 1\nแล้วจะมีเมนูด้านล่างมาให้เลือก"}
                />
                
                <div className="flex overflow-x-auto gap-2 mt-3 pb-2 thin-scrollbar snap-x">
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
                          const autoFoodPrice = calculateAutoPrice(newMenuText);
                          let newTotalPrice = formData.total_price;

                          if (autoFoodPrice !== null) {
                            const currentDeliveryFee = parseInt(formData.delivery_fee || "0", 10);
                            newTotalPrice = (parseInt(autoFoodPrice, 10) + currentDeliveryFee).toString();
                          }
                          
                          setFormData({ ...formData, menu: newMenuText, total_price: newTotalPrice });
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

                {calcBreakdown.length > 0 && formData.job_type !== "shopee" && (
                  <div className="mt-4 p-4 bg-slate-800 border border-slate-700 rounded-2xl space-y-2 shadow-inner">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <LayoutDashboard size={12} /> สรุปการคำนวณอัตโนมัติ
                    </div>
                    {calcBreakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm font-bold">
                        {item.found ? (
                          <>
                            <span className="text-slate-300 flex items-center gap-2">
                              <CheckCircle2 size={14} className="text-emerald-400" />
                              {item.name} <span className="text-slate-500 font-medium">x{item.qty}</span>
                            </span>
                            <span className="text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-md border border-emerald-800/50">{item.total}.-</span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-500 flex items-center gap-2 line-through decoration-slate-600">
                              <AlertTriangle size={14} className="text-amber-500/50" />
                              {item.name}
                            </span>
                            <span className="text-amber-500/70 text-[10px] bg-amber-900/20 px-2 py-0.5 rounded-md border border-amber-800/30">ไม่พบในฐานข้อมูลสาขา</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formData.job_type !== "shopee" && (
                <>
                  <div>
                    <label className="block text-sm font-black text-slate-400 mb-2 tracking-wide uppercase">
                      รายละเอียดเพิ่มเติม (Note)
                    </label>
                    <textarea
                      rows={2}
                      className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-base outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none font-medium leading-relaxed text-white placeholder-slate-500 shadow-sm"
                      value={formData.details}
                      onChange={(e) =>
                        setFormData({ ...formData, details: e.target.value })
                      }
                      placeholder="ระบุข้อความถึงไรเดอร์..."
                    />
                  </div>
                </>
              )}

              <div className="pt-2">
                <label className="block text-sm font-black text-slate-400 mb-3 tracking-wide uppercase">
                  แนบรูปภาพ (หลายรูปได้)
                </label>
                {(existingImages.length > 0 || imagePreviews.length > 0) && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    {existingImages.map((url, i) => (
                      <div
                        key={`exist-${i}`}
                        className="relative w-20 h-20 rounded-xl overflow-hidden shadow-sm border border-slate-700 group"
                      >
                        <Image
                          src={url}
                          fill
                          sizes="80px"
                          className="object-cover"
                          alt="Existing"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(i)}
                          className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                      </div>
                    ))}
                    {imagePreviews.map((url, i) => (
                      <div
                        key={`new-${i}`}
                        className="relative w-20 h-20 rounded-xl overflow-hidden shadow-sm border-2 border-blue-500 border-dashed group"
                      >
                        <Image
                          src={url}
                          fill
                          sizes="80px"
                          className="object-cover opacity-80"
                          alt="New"
                        />
                        <button
                          type="button"
                          onClick={() => removeNewImage(i)}
                          className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  onDrop={handleDropImage}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onPaste={handlePasteImage}
                  className="border-2 border-dashed border-slate-600 rounded-3xl p-8 text-center hover:border-blue-500 hover:bg-slate-800/80 transition-all bg-slate-800 flex flex-col items-center justify-center cursor-pointer shadow-sm"
                >
                  <div className="text-slate-400 text-base">
                    <ImagePlus
                      className="mx-auto mb-3 text-slate-500"
                      size={36}
                      strokeWidth={1.5}
                    />
                    <div className="font-bold text-slate-300 text-base mb-1">
                      ลากไฟล์มาวาง หรือ กด Ctrl+V
                    </div>
                    <div className="my-2 text-sm font-black text-slate-500 uppercase tracking-widest">
                      หรือ
                    </div>
                    <label
                      htmlFor="file-upload"
                      className="inline-block bg-slate-700 border border-slate-600 text-slate-300 rounded-xl px-5 py-2 text-sm font-black tracking-wide cursor-pointer hover:bg-slate-600 hover:text-white transition-all mt-1"
                    >
                      เลือกไฟล์จากอุปกรณ์
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </div>
                </div>
              </div>

              {formData.job_type !== "shopee" && (
                <div className="space-y-6 pt-3 border-t border-slate-800 mt-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-2 tracking-wide uppercase">
                        ค่าอาหาร (บาท)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-2xl outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-black text-blue-400 shadow-sm"
                        value={formData.total_price}
                        onChange={(e) => setFormData({ ...formData, total_price: e.target.value.replace(/[^0-9]/g, "") })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-2 tracking-wide uppercase">
                        ค่าส่ง (บาท)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-2xl outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-black text-orange-400 shadow-sm"
                        value={formData.delivery_fee}
                        onChange={(e) => {
                          const newFeeStr = e.target.value.replace(/[^0-9]/g, "");
                          const newFeeNum = parseInt(newFeeStr || "0", 10);
                          const oldFeeNum = parseInt(formData.delivery_fee || "0", 10);
                          const currentTotal = parseInt(formData.total_price || "0", 10);
                          
                          const newTotal = currentTotal - oldFeeNum + newFeeNum;
                          
                          setFormData({ 
                            ...formData, 
                            delivery_fee: newFeeStr, 
                            total_price: Math.max(0, newTotal).toString() 
                          });
                        }}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-2 tracking-wide uppercase">
                        ช่องทางชำระเงิน
                      </label>
                      <select
                        className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-bold text-white shadow-sm"
                        value={formData.payment_method}
                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      >
                        <option value="โอน">📱 โอน</option>
                        <option value="เงินสด">💵 เงินสด</option>
                        <option value="คนละครึ่ง">🔵 ครึ่งๆ</option>
                      </select>
                    </div>
                  </div>

                  <div className="relative p-5 bg-slate-800 border border-slate-700 rounded-3xl shadow-sm">
                    <label className="text-sm font-black text-blue-400 mb-3 tracking-wide flex items-center uppercase">
                      <Search size={14} className="mr-1.5" /> สถานที่จัดส่ง / ลิงก์แผนที่ *
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl text-base outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-white transition-all placeholder-slate-500"
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

                    <div className="flex justify-end pt-4">
                      <Link
                        href="/dorms"
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-[10px] font-black text-blue-400 hover:text-white hover:bg-blue-600 transition-colors uppercase tracking-widest bg-blue-900/30 border border-blue-800 px-3 py-2 rounded-xl active:scale-95 cursor-pointer shadow-sm"
                      >
                        <Plus size={12} strokeWidth={3} /> ไปหน้าเพิ่มที่อยู่ใหม่หากยังไม่มีข้อมูลในระบบร้าน
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-5 flex gap-4 mt-2 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="w-full bg-blue-600 text-white font-black py-4 rounded-4xl hover:bg-blue-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 flex justify-center items-center cursor-pointer text-base uppercase tracking-widest disabled:bg-slate-700 disabled:text-slate-400 disabled:hover:translate-y-0 disabled:hover:shadow-none active:scale-95"
                >
                  {isUploading
                    ? "กำลังจัดเก็บข้อมูล..."
                    : editingId
                      ? "บันทึกการแก้ไข"
                      : "สร้างออเดอร์"}
                </button>
              </div>
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
                    <div className="flex justify-between">
                      <span>ค่าส่ง</span>
                      <span>฿{Number(formData.delivery_fee || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-4 mt-4 flex justify-between items-center text-white font-black text-lg">
                    <span>รวมทั้งหมด</span>
                    <span>฿{(Number(formData.total_price || 0) + Number(formData.delivery_fee || 0)).toLocaleString()}</span>
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
                  type="button"
                  onClick={() => setFormData({ ...formData, menu: '', total_price: '0', delivery_fee: '0' })}
                  className="w-full bg-rose-500 hover:bg-rose-400 text-white py-3 rounded-3xl font-black transition-all active:scale-95"
                >
                  ล้างรายการทันที
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
              {["New", "กำลังทำ", "รับงาน", "ส่งแล้ว/เสร็จ"].map((st) => (
                <button
                  key={st}
                  disabled={statusModal.order?.status === st}
                  onClick={() => executeStatusChange(st)}
                  className={`w-full py-4 rounded-2xl text-base font-black transition-all shadow-sm flex items-center justify-center active:scale-95 ${
                    statusModal.order?.status === st
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : st === "New"
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
              {selectedViewOrder.status === "New" &&
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

      {/* 🌟 SlipScanner */}
      {scannerConfig?.isOpen && (
        <SlipScanner
          orderId={scannerConfig.orderId!}
          expectedAmount={scannerConfig.amount}
          initialImageUrls={scannerConfig.initialImageUrls}
          onClose={() => setScannerConfig({ isOpen: false, orderId: null, amount: 0 })}
          onSuccess={(newImageUrl, statusText) => {
            setScannerConfig({ isOpen: false, orderId: null, amount: 0 });

            setOrders(
              orders.map((o) => {
                if (o.id === scannerConfig.orderId) {
                  const updatedImages = o.slip_image
                    ? `${o.slip_image},${newImageUrl}`
                    : newImageUrl;
                  return {
                    ...o,
                    slip_image: updatedImages,
                    slip_status: statusText,
                  };
                }
                return o;
              }),
            );

            supabase
              .from("orders")
              .update({ slip_image: newImageUrl, slip_status: statusText })
              .eq("branch_id", currentBranchId)
              .eq("id", scannerConfig.orderId)
              .then(({ error }) => {
                if (error) console.error("Update slip error:", error);
              });

            showToast(`✅ บันทึกสลิปเรียบร้อยแล้ว: ${statusText}`);
          }}
        />
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
      {isGalleryOpen && (
        <SharedGallery
          branchId={currentBranchId}
          userName={adminName}
          userRole={currentUserRole}
          onClose={() => setIsGalleryOpen(false)}
        />
      )}
    </div>
  );
}