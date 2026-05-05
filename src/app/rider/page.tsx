"use client";
import { useState, useEffect, useRef, useMemo } from "react";
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
} from "lucide-react";
import { Order } from "../../components/OrderCard";
import { User as SupabaseUser } from "@supabase/supabase-js";
import DashboardView from "./DashboardView";
import Image from "next/image";

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

export default function RiderPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [myLocation, setMyLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState<boolean | null>(null);

  const [activeTab, setActiveTab] = useState<"available" | "jobs" | "history">(
    "available",
  );
  const [selectedViewOrder, setSelectedViewOrder] = useState<Order | null>(
    null,
  );

  const [isCompact, setIsCompact] = useState<boolean>(false);

  // 🌟 State เก็บเวลาตัดยอดของร้าน
  const [cutOffHour, setCutOffHour] = useState<number>(4);

  const [imageGallery, setImageGallery] = useState<{
    urls: string[];
    startIndex: number;
  } | null>(null);
  const [imgScale, setImgScale] = useState(1);
  const galleryRef = useRef<HTMLDivElement>(null);

  const [popup, setPopup] = useState<PopupConfig>({
    isOpen: false,
    type: "alert",
    title: "",
    message: "",
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [riderName, setRiderName] = useState<string>("กำลังโหลด...");

  // 🌟 เพิ่ม State 2 ตัวนี้เข้ามา เพื่อเก็บข้อมูลสาขาของไรเดอร์คนนี้
  const [myBranchId, setMyBranchId] = useState<string | null>(null);
  const [shopLocation, setShopLocation] = useState<{
    lat: number;
    lng: number;
  }>({ lat: 0, lng: 0 });
  const lastGpsUpdateRef = useRef<number>(0);

  const showAlert = (
    title: string,
    message: string,
    icon: "success" | "error" | "warning" | "info" = "info",
  ) => setPopup({ isOpen: true, type: "alert", title, message, icon });
  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = "ยืนยัน",
    cancelText = "ยกเลิก",
  ) =>
    setPopup({
      isOpen: true,
      type: "confirm",
      title,
      message,
      onConfirm,
      confirmText,
      cancelText,
      icon: "warning",
    });
  const closePopup = () => setPopup((prev) => ({ ...prev, isOpen: false }));

  const fetchOrders = async (userId: string, branchId: string | null) => {
    if (!userId || !branchId) return;
    const { data: myJobs, error: err1 } = await supabase
      .from("orders")
      .select("*")
      .eq("rider_id", userId)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });
    if (err1) console.error("Error fetching my jobs:", err1);

    const { data: availableJobs, error: err2 } = await supabase
      .from("orders")
      .select("*")
      .eq("branch_id", branchId) // 🌟 กรองสาขา
      .is("rider_id", null)
      .or("job_type.is.null,job_type.neq.shopee")
      .in("status", ["New", "กำลังทำ", "รับงาน"])
      .order("created_at", { ascending: false });
    if (err2) console.error("Error fetching available jobs:", err2);

    const jobs1 = availableJobs || [];
    const jobs2 = myJobs || [];

    const combined = [...jobs1, ...jobs2];
    const uniqueOrders = Array.from(
      new Map(combined.map((item) => [item.id, item])).values(),
    );
    setOrders(uniqueOrders as Order[]);
  };

  useEffect(() => {
    let currentUserId = "";
    let currentBranchId = ""; // 🌟 เก็บค่า Branch ID

    const checkAuthAndInit = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      // 🌟 ดึงชื่อ และ branch_id ของไรเดอร์คนนี้
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, branch_id")
        .eq("id", session.user.id)
        .single();

      setCurrentUser(session.user);
      currentUserId = session.user.id;
      setRiderName(profile?.username || "ไรเดอร์");

      if (profile?.branch_id) {
        currentBranchId = profile.branch_id;
        setMyBranchId(currentBranchId);

        // 🌟 ดึงข้อมูลพิกัด และเวลาตัดยอดของสาขานี้!
        const { data: branchData } = await supabase
          .from("branches")
          .select("lat, lng, cut_off_hour")
          .eq("id", currentBranchId)
          .single();

        if (branchData) {
          setShopLocation({ lat: branchData.lat, lng: branchData.lng });
          setCutOffHour(branchData.cut_off_hour || 4);
        }

        // 🌟 ส่ง branchId ไปตอนดึงออเดอร์ด้วย
        fetchOrders(currentUserId, currentBranchId);
      } else {
        // ถ้าไรเดอร์ยังไม่มีสาขา (แอดมินลืมตั้ง)
        showAlert(
          "แจ้งเตือน",
          "บัญชีของคุณยังไม่ได้ระบุสาขาประจำ กรุณาติดต่อแอดมิน",
          "warning",
        );
      }
    };

    checkAuthAndInit();

    // 🌟 เปลี่ยนให้ Realtime ดักฟังออเดอร์เฉพาะสาขาตัวเอง (ถ้าทำได้)
    const riderChannel = supabase
      .channel("public:orders:rider")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          if (currentUserId && currentBranchId)
            fetchOrders(currentUserId, currentBranchId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(riderChannel);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    if (!navigator.geolocation) {
      setTimeout(() => {
        setGpsEnabled(false);
        setLocationError("เบราว์เซอร์ไม่รองรับ GPS");
      }, 0);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        setGpsEnabled(true);
        setLocationError(null);
        setMyLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        const now = Date.now();
        if (now - lastGpsUpdateRef.current > 30000) {
          lastGpsUpdateRef.current = now;
          await supabase
            .from("profiles")
            .update({
              last_lat: position.coords.latitude,
              last_lng: position.coords.longitude,
              last_seen: new Date().toISOString(),
            })
            .eq("id", currentUser.id);
        }
      },
      (error) => {
        console.error("GPS Error:", error);
        setGpsEnabled(false);
        setLocationError("กรุณาเปิด GPS");
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentUser]);

  useEffect(() => {
    if (imageGallery && galleryRef.current) {
      const target = galleryRef.current.children[
        imageGallery.startIndex
      ] as HTMLElement;
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

  // 🌟 ฟังก์ชันคำนวณระยะทาง
  const getDistanceFromLatLonInKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371; // รัศมีโลกเป็น km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleTakeJob = async (orderId: string) => {
    if (!currentUser) return;

    if (!myLocation) {
      showAlert(
        "แจ้งเตือน",
        "กำลังค้นหาตำแหน่งของคุณ กรุณารอสักครู่",
        "warning",
      );
      return;
    }

    if (shopLocation.lat !== 0 && shopLocation.lng !== 0) {
      const distance =
        getDistanceFromLatLonInKm(
          myLocation.lat,
          myLocation.lng,
          shopLocation.lat,
          shopLocation.lng,
        ) * 1000; // แปลงเป็นเมตร

      if (distance > 100) {
        showAlert(
          "คุณอยู่ไกลจากร้านเกินไป",
          `ต้องอยู่ในรัศมี 100 เมตรจากร้านเพื่อรับงาน (ปัจจุบันห่าง ${Math.round(distance)} เมตร)`,
          "error",
        );
        return;
      }
    }

    const { data } = await supabase
      .from("orders")
      .update({
        rider_id: currentUser.id,
        rider_name: riderName,
        start_time: new Date().toISOString(),
      })
      .eq("id", orderId)
      .is("rider_id", null)
      .select();
    if (data && data.length > 0) {
      showAlert(
        "จองงานสำเร็จ!",
        "งานอยู่ในความดูแลของคุณแล้วครับ 🎉",
        "success",
      );
      fetchOrders(currentUser.id, myBranchId);
    } else {
      showAlert(
        "อ๊ะ!",
        "งานนี้มีเพื่อนไรเดอร์ท่านอื่นกดรับไปก่อนแล้วครับ 😢",
        "error",
      );
      fetchOrders(currentUser.id, myBranchId);
    }
  };

  const handleRiderAction = async (order: Order) => {
    let nextStatus = "";
    let confirmMsg = "";
    const isCustomJob =
      order.job_type === "รับหิ้ว" || order.job_type === "รับส่ง";

    if (isCustomJob) {
      if (order.status === "New") {
        nextStatus = "กำลังทำ";
        confirmMsg = "เริ่มเดินทางไปทำธุระให้ลูกค้าใช่ไหม?";
      } else if (order.status === "กำลังทำ") {
        nextStatus = "รับงาน";
        confirmMsg = "คุณจัดการธุระเสร็จสิ้นแล้วและกำลังเดินทางไปส่งใช่ไหม?";
      } else if (order.status === "รับงาน") {
        nextStatus = "ส่งแล้ว/เสร็จ";
        confirmMsg =
          "คุณได้ส่งของให้ลูกค้าเรียบร้อยแล้วใช่ไหม? (ตรวจสอบยอดเงินด้วยนะ)";
      }
    } else {
      if (order.status === "รับงาน") {
        nextStatus = "ส่งแล้ว/เสร็จ";
        confirmMsg =
          "ส่งอาหารให้ลูกค้าเรียบร้อยแล้วใช่ไหม? (ตรวจสอบยอดเงินด้วยนะ)";
      }
    }

    if (!nextStatus) return;

    showConfirm(
      "ยืนยันการดำเนินการ",
      confirmMsg,
      async () => {
        closePopup();
        const updateData: { status: string; end_time?: string } = {
          status: nextStatus,
        };
        if (nextStatus === "ส่งแล้ว/เสร็จ")
          updateData.end_time = new Date().toISOString();
        const { error } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", order.id);
        if (error) showAlert("เกิดข้อผิดพลาด", "อัปเดตไม่สำเร็จ", "error");
        else fetchOrders(currentUser!.id, myBranchId);
      },
      "ยืนยัน",
      "ยกเลิก",
    );
  };

  const handleDropJob = async (orderId: string) => {
    if (!currentUser) return;
    showConfirm(
      "คืนงานใช่ไหม?",
      "งานนี้จะถูกปลดล็อกให้ไรเดอร์ท่านอื่นสามารถแย่งรับได้นะครับ",
      async () => {
        closePopup();
        const { error } = await supabase
          .from("orders")
          .update({ rider_id: null, rider_name: null, start_time: null })
          .eq("id", orderId);
        if (error) showAlert("เกิดข้อผิดพลาด", "ไม่สามารถคืนงานได้", "error");
        else {
          showAlert("เรียบร้อย!", "คืนงานให้ระบบกลางแล้ว", "success");
          setActiveTab("available");
          fetchOrders(currentUser.id, myBranchId);
        }
      },
      "คืนงาน",
      "ยกเลิก",
    );
  };

  const calculateRoute = (order: Order) => {
    if (!myLocation) {
      showAlert("รอก่อนนะ", "กำลังหาตำแหน่งของคุณอยู่ครับ 📡", "warning");
      return;
    }
    if (!order.lat || !order.lng) {
      showAlert("ขออภัย", "ออเดอร์นี้แอดมินไม่ได้ปักพิกัดไว้ครับ", "error");
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&origin=${myLocation.lat},${myLocation.lng}&destination=${order.lat},${order.lng}&travelmode=driving`;
    window.open(url, "_blank");
  };

  const handleLogout = () => {
    showConfirm(
      "ออกจากระบบ?",
      "คุณต้องการออกจากระบบใช่หรือไม่?",
      async () => {
        closePopup();
        await supabase.auth.signOut();
        window.location.href = "/login";
      },
      "ออกจากระบบ",
      "ยกเลิก",
    );
  };

  const availableOrders = orders.filter(
    (o) => !o.rider_id && ["New", "กำลังทำ", "รับงาน"].includes(o.status),
  );
  const activeOrders = orders.filter(
    (o) => o.rider_id === currentUser?.id && o.status !== "ส่งแล้ว/เสร็จ",
  );
  const completedOrders = orders.filter(
    (o) => o.rider_id === currentUser?.id && o.status === "ส่งแล้ว/เสร็จ",
  );

  // 🌟 ประยุกต์ใช้เวลาตัดยอดสำหรับ "ประวัติรอบวันนี้" ของไรเดอร์โดยเฉพาะ
  const shiftCompletedOrders = useMemo(() => {
    const now = new Date();
    const shiftStart = new Date(now);
    if (now.getHours() < cutOffHour) {
      shiftStart.setDate(shiftStart.getDate() - 1);
    }
    shiftStart.setHours(cutOffHour, 0, 0, 0);

    return completedOrders.filter((order) => {
      const orderDate = new Date(order.end_time || order.created_at);
      return orderDate >= shiftStart;
    });
  }, [completedOrders, cutOffHour]);

  const getRiderStatusDisplay = (status: string) => {
    if (status === "New")
      return {
        text: "ออเดอร์เข้าใหม่",
        color: "bg-blue-500/20 text-blue-300 border-blue-400/30",
      };
    if (status === "กำลังทำ")
      return {
        text: "ครัวกำลังทำอาหาร",
        color: "bg-amber-500/20 text-amber-300 border-amber-400/30",
        icon: <ChefHat size={12} className="mr-1" />,
      };
    if (status === "รับงาน")
      return {
        text: "ของเสร็จแล้ว! ไปรับได้เลย",
        color:
          "bg-emerald-500/20 text-emerald-300 border-emerald-400/30 shadow-sm animate-pulse",
        icon: <PackageCheck size={12} className="mr-1" />,
      };
    return {
      text: status,
      color: "bg-slate-700/50 text-slate-300 border-slate-500/50",
    };
  };

  const renderPopupIcon = (type: string) => {
    switch (type) {
      case "success":
        return (
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-emerald-500/20 mb-4 animate-bounce">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
        );
      case "error":
        return (
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-rose-500/20 mb-4 animate-bounce">
            <X className="h-10 w-10 text-rose-400" />
          </div>
        );
      case "warning":
        return (
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-amber-500/20 mb-4 animate-bounce">
            <AlertTriangle className="h-10 w-10 text-amber-400" />
          </div>
        );
      default:
        return (
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-blue-500/20 mb-4 animate-bounce">
            <Info className="h-10 w-10 text-blue-400" />
          </div>
        );
    }
  };

  const renderThumbnail = (order: Order) => {
    const images = order.image_url
      ? order.image_url.split(",").filter(Boolean)
      : [];
    if (images.length === 0) return null;

    return (
      <div className="flex flex-col gap-2 shrink-0 mb-3 mt-1 items-center">
        {images.map((url, i) => (
          <div
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              setImageGallery({ urls: images, startIndex: i });
            }}
            className="relative w-[65%] rounded-xl overflow-hidden border border-indigo-500/20 shadow-sm cursor-pointer group/img bg-black/10"
            style={{ aspectRatio: "9/16" }}
          >
            <Image
              src={url}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              alt="Order Evidence"
              className="object-cover group-hover/img:scale-105 transition-transform duration-500 block"
              priority={i === 0}
            />
          </div>
        ))}
      </div>
    );
  };

  if (!currentUser)
    return (
      <div className="h-dvh bg-indigo-950 flex flex-col items-center justify-center text-white overflow-hidden">
        <div className="w-12 h-12 border-4 border-indigo-800 border-t-blue-400 rounded-full animate-spin mb-4"></div>
        <h2 className="font-bold text-sm tracking-wider text-indigo-300 animate-pulse">
          กำลังเตรียมระบบ...
        </h2>
      </div>
    );

  if (gpsEnabled === false) {
    return (
      <div
        className="h-dvh bg-indigo-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden text-white"
        style={{ zIndex: 50 }}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
          <div
            className="absolute w-64 h-64 border border-blue-500 rounded-full"
            style={{ animation: "ping 3s ease-in-out infinite" }}
          ></div>
        </div>
        <div className="relative z-10 bg-indigo-900/90 backdrop-blur-xl p-6 rounded-3xl border border-indigo-800 shadow-2xl max-w-sm w-full animate-in zoom-in duration-500">
          <div
            className="w-20 h-20 bg-rose-500/20 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
            style={{ animation: "bounce 3s ease-in-out infinite" }}
          >
            <MapPinned size={32} className="text-rose-400" />
          </div>
          <h1 className="text-xl font-black mb-2 text-white">
            ระบบต้องการตำแหน่ง
          </h1>
          <p className="text-indigo-300 font-medium mb-6 text-xs">
            {locationError || "กรุณาเปิด GPS เพื่อเข้าใช้งานแอปไรเดอร์"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl active:scale-95 transition-all shadow-md shadow-blue-600/30"
          >
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
      />
    );
  }

  return (
    <div className="h-dvh bg-indigo-950 text-indigo-100 font-sans flex flex-col overflow-hidden transition-colors duration-500">
      {/* Header */}
      <div className="shrink-0 bg-indigo-950/90 backdrop-blur-xl text-white p-3.5 shadow-md flex justify-between items-center border-b border-indigo-900 z-30">
        <div className="flex items-center">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="mr-2 p-1.5 hover:bg-indigo-800 rounded-lg active:scale-90 transition-all cursor-pointer"
          >
            <Menu size={20} className="text-indigo-300" />
          </button>
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center drop-shadow-sm text-white">
              <Zap className="mr-1 text-blue-400 fill-blue-400" size={16} />{" "}
              RIDER APP
            </h1>
            <div className="text-[9px] text-indigo-300 mt-0.5 flex items-center font-bold uppercase tracking-wider">
              {myLocation ? (
                <span className="flex items-center text-emerald-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>{" "}
                  GPS Active
                </span>
              ) : (
                <span className="opacity-70 animate-pulse text-amber-400">
                  หาสัญญาณ...
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="bg-indigo-900 border border-indigo-800 px-3 py-1.5 rounded-full text-[10px] font-black tracking-wide text-blue-300 shadow-inner truncate max-w-25">
          {riderName}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-5xl mx-auto overflow-hidden flex flex-col relative">
        {/* Available Tab */}
        {activeTab === "available" && (
          <div className="flex-1 flex flex-col overflow-hidden w-full pt-4 px-3 sm:px-5 pb-24 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h2 className="font-black text-white text-lg flex items-center">
                งานว่าง
                <span className="ml-2 px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] rounded-md shadow-sm">
                  {availableOrders.length}
                </span>
              </h2>
              <button
                onClick={() => setIsCompact(!isCompact)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-900 border border-indigo-800 rounded-lg text-[10px] font-black text-indigo-300 hover:text-white transition-all active:scale-95 shadow-sm"
              >
                {isCompact ? (
                  <ZoomIn size={12} className="text-blue-400" />
                ) : (
                  <ZoomOut size={12} className="text-blue-400" />
                )}
                {isCompact ? "ซูมเข้า" : "ซูมออก"}
              </button>
            </div>

            {availableOrders.length === 0 ? (
              <div className="text-center bg-indigo-900/40 rounded-4xl border border-indigo-800/50 shadow-sm flex flex-col items-center justify-center mx-auto max-w-xs w-full flex-1 p-6">
                <div className="w-20 h-20 bg-indigo-900/80 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <PackageCheck size={36} className="text-indigo-400" />
                </div>
                <p className="text-indigo-200 font-bold mb-1 text-base">
                  ยังไม่มีงานเข้ามา
                </p>
                <p className="text-xs text-indigo-400 font-medium">
                  รอแอดมินจ่ายงานสักครู่นะครับ ☕
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex gap-3 items-stretch hide-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
                {availableOrders.map((order, index) => (
                  <div
                    key={order.id}
                    className={`${isCompact ? "w-[42vw] sm:w-42.5" : "w-[82vw] sm:w-[320px]"} h-full shrink-0 snap-center bg-indigo-900/60 rounded-3xl shadow-xl border border-indigo-800 overflow-hidden flex flex-col transition-all duration-300 hover:border-blue-500/50`}
                    style={{
                      animation: `fadeIn 0.5s ease-out ${index * 0.05}s both`,
                    }}
                  >
                    <div className="flex-1 overflow-y-auto hide-scrollbar p-3 sm:p-4 relative border-b border-indigo-800/50 flex flex-col">
                      <div
                        className={`absolute top-0 left-0 w-full h-1 ${isCustomJob(order) ? "bg-purple-500" : "bg-blue-500"}`}
                      ></div>

                      {/* Header */}
                      <div className="flex justify-between items-center mb-3 mt-1 shrink-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`${isCompact ? "text-[15px]" : "text-xl"} font-black text-white tracking-tight`}
                          >
                            {order.order_number}
                          </span>
                          {!isCompact && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedViewOrder(order);
                              }}
                              className="bg-indigo-950/80 text-indigo-300 border border-indigo-800 px-2 py-1 rounded-md text-[9px] uppercase font-black flex items-center hover:bg-indigo-800 active:scale-95 transition-colors"
                            >
                              <Eye size={10} className="mr-1" /> ข้อมูล
                            </button>
                          )}
                        </div>
                        <span
                          className={`${isCompact ? "text-[8px] px-1.5 py-0.5" : "text-[9px] px-2 py-1"} font-black rounded-md uppercase border shadow-sm ${isCustomJob(order) ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : getRiderStatusDisplay(order.status).color}`}
                        >
                          {order.job_type}
                        </span>
                      </div>

                      {/* Menu */}
                      {order.menu && (
                        <div
                          className={`mb-3 ${isCompact ? "p-2.5 text-[10px]" : "p-3 text-sm"} bg-indigo-950/50 rounded-xl border border-indigo-800/80 text-indigo-200 font-bold whitespace-pre-line leading-relaxed shrink-0`}
                        >
                          {order.menu}
                        </div>
                      )}

                      {/* Thumbnail */}
                      {renderThumbnail(order)}

                      {/* Details */}
                      {order.details && (
                        <div
                          className={`${isCompact ? "text-[9px]" : "text-xs"} text-indigo-300 font-medium mb-3 flex items-start gap-2 shrink-0`}
                        >
                          <div
                            className={`mt-1 w-1 h-3 rounded-full shrink-0 ${isCustomJob(order) ? "bg-purple-500" : "bg-blue-500"}`}
                          ></div>
                          <span className="leading-relaxed line-clamp-3">
                            {order.details}
                          </span>
                        </div>
                      )}

                      {/* Address & Price */}
                      <div className="mt-auto shrink-0 space-y-2.5">
                        {order.address && (
                          <div
                            className={`flex items-start ${isCompact ? "text-[9px] p-2.5" : "text-[11px] p-3"} text-red-200 bg-red-500/10 border border-red-500/20 rounded-xl shadow-inner`}
                          >
                            <MapPin
                              size={isCompact ? 12 : 14}
                              className="mr-1.5 mt-0.5 text-red-400 shrink-0"
                            />
                            <span className="font-bold leading-relaxed line-clamp-3">
                              {order.address}
                            </span>
                          </div>
                        )}

                        <div
                          className={`flex justify-between items-center ${isCompact ? "text-[9px] px-2.5 py-2" : "text-[10px] px-3 py-2.5"} text-indigo-300 bg-indigo-950 rounded-xl border border-indigo-800`}
                        >
                          <div className="flex items-center font-bold">
                            <Clock size={10} className="mr-1 text-indigo-400" />{" "}
                            {new Date(order.created_at).toLocaleTimeString(
                              "th-TH",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </div>
                          {order.total_price > 0 && (
                            <div
                              className={`${isCompact ? "text-xs" : "text-base"} font-black text-white`}
                            >
                              ฿{order.total_price}{" "}
                              {!isCompact && (
                                <span
                                  className={`ml-1 px-1.5 py-0.5 rounded text-[8px] uppercase font-black ${order.payment_method === "โอน" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300"}`}
                                >
                                  {order.payment_method}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTakeJob(order.id)}
                      className={`w-full ${isCompact ? "py-3 text-[10px]" : "py-3.5 text-sm"} bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center shrink-0`}
                    >
                      <Zap
                        size={14}
                        className="mr-1.5 fill-white animate-pulse"
                      />{" "}
                      {isCompact ? "รับงาน" : "กดรับงานนี้"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === "jobs" && (
          <div className="flex-1 flex flex-col overflow-hidden w-full pt-4 px-3 sm:px-5 pb-24 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h2 className="font-black text-white text-lg flex items-center">
                กำลังทำ
                <span className="ml-2 px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] rounded-md shadow-sm">
                  {activeOrders.length}
                </span>
              </h2>
              <button
                onClick={() => setIsCompact(!isCompact)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-900 border border-indigo-800 rounded-lg text-[10px] font-black text-indigo-300 hover:text-white transition-all active:scale-95 shadow-sm"
              >
                {isCompact ? (
                  <ZoomIn size={12} className="text-blue-400" />
                ) : (
                  <ZoomOut size={12} className="text-blue-400" />
                )}
                {isCompact ? "ซูมเข้า" : "ซูมออก"}
              </button>
            </div>

            {activeOrders.length === 0 ? (
              <div className="text-center bg-indigo-900/40 rounded-4xl border border-indigo-800/50 shadow-sm flex flex-col items-center justify-center mx-auto max-w-xs w-full flex-1 p-6">
                <div className="w-20 h-20 bg-indigo-900/80 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={36} className="text-indigo-400" />
                </div>
                <p className="text-indigo-200 font-bold mb-1 text-base">
                  ไม่มีงานค้างในมือ
                </p>
                <p className="text-xs text-indigo-400 font-medium">
                  ไปดูที่ &quot;งานว่าง&quot; เพื่อรับงานต่อ 🛵
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex gap-3 items-stretch hide-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
                {activeOrders.map((order, index) => (
                  <div
                    key={order.id}
                    className={`${isCompact ? "w-[42vw] sm:w-42.5" : "w-[82vw] sm:w-[320px]"} h-full shrink-0 snap-center bg-indigo-900/60 rounded-3xl shadow-lg border overflow-hidden flex flex-col transition-all duration-300 ${order.status === "รับงาน" ? "border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-emerald-900/20" : "border-indigo-800"}`}
                    style={{
                      animation: `fadeIn 0.5s ease-out ${index * 0.05}s both`,
                    }}
                  >
                    <div className="flex-1 overflow-y-auto hide-scrollbar p-3 sm:p-4 border-b border-indigo-800/50 flex flex-col">
                      <div className="flex justify-between items-center mb-3 shrink-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`${isCompact ? "text-[15px]" : "text-xl"} font-black text-white tracking-tight`}
                          >
                            {order.order_number}
                          </span>
                          {!isCompact && (
                            <button
                              onClick={() => setSelectedViewOrder(order)}
                              className="bg-indigo-950/80 text-indigo-300 border border-indigo-800 px-2 py-1 rounded-md text-[9px] uppercase font-black flex items-center hover:bg-indigo-800 active:scale-95 transition-colors"
                            >
                              <Eye size={10} className="mr-1" /> ข้อมูล
                            </button>
                          )}
                        </div>
                        <span
                          className={`${isCompact ? "text-[8px] px-1.5 py-0.5" : "text-[9px] px-2 py-1"} font-black rounded-md uppercase border shadow-sm ${isCustomJob(order) ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : getRiderStatusDisplay(order.status).color}`}
                        >
                          {order.status === "รับงาน"
                            ? "ไปส่งเลย!"
                            : order.status}
                        </span>
                      </div>

                      {order.menu && (
                        <div
                          className={`mb-3 ${isCompact ? "p-2.5 text-[10px]" : "p-3 text-sm"} bg-indigo-950/50 rounded-xl border border-indigo-800/80 text-indigo-200 font-bold whitespace-pre-line leading-relaxed shrink-0`}
                        >
                          {order.menu}
                        </div>
                      )}

                      {/* Thumbnail */}
                      {renderThumbnail(order)}

                      <div className="mt-auto shrink-0 space-y-2.5">
                        {order.address && (
                          <div
                            className={`flex items-start ${isCompact ? "text-[9px] p-2.5" : "text-[11px] p-3"} text-indigo-200 bg-indigo-950 border border-indigo-800 rounded-xl font-bold shadow-inner`}
                          >
                            <MapPin
                              size={isCompact ? 12 : 14}
                              className="mr-1.5 mt-0.5 text-red-400 shrink-0"
                            />
                            <span
                              className={`leading-relaxed ${isCompact ? "line-clamp-2" : "line-clamp-3"}`}
                            >
                              {order.address}
                            </span>
                          </div>
                        )}

                        <div
                          className={`flex justify-between items-center ${isCompact ? "text-[9px] px-2.5 py-2" : "text-[10px] px-3 py-2.5"} bg-indigo-950 border border-indigo-800 rounded-xl`}
                        >
                          <div className="text-indigo-300 font-bold">
                            <Clock
                              size={10}
                              className="inline mr-1 text-indigo-400"
                            />{" "}
                            {order.start_time
                              ? new Date(order.start_time).toLocaleTimeString(
                                  "th-TH",
                                  { hour: "2-digit", minute: "2-digit" },
                                )
                              : "-"}
                          </div>
                          <div
                            className={`${isCompact ? "text-xs" : "text-base"} font-black text-white`}
                          >
                            ฿{order.total_price}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`p-2.5 sm:p-3 bg-indigo-950/80 flex shrink-0 ${isCompact ? "flex-col gap-2" : "flex-col sm:flex-row gap-2"}`}
                    >
                      <div className="flex flex-1 gap-2 w-full">
                        <button
                          onClick={() => calculateRoute(order)}
                          className={`flex-1 ${isCompact ? "py-2.5" : "py-3"} bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 font-black text-[10px] rounded-lg active:scale-95 border border-indigo-500/20 transition-colors flex justify-center items-center`}
                        >
                          <MapIcon size={12} className="mr-1.5" /> นำทาง
                        </button>
                        <button
                          onClick={() => handleDropJob(order.id)}
                          className={`flex-1 ${isCompact ? "py-2.5" : "py-3"} bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 font-black text-[10px] rounded-lg active:scale-95 border border-rose-500/20 transition-colors flex justify-center items-center`}
                        >
                          <X size={12} className="mr-1.5" /> คืนงาน
                        </button>
                      </div>
                      <button
                        onClick={() => handleRiderAction(order)}
                        disabled={!canAction(order)}
                        className={`w-full ${isCompact ? "py-2.5 text-[9px]" : "py-3 text-[11px]"} font-black rounded-lg transition-all cursor-pointer uppercase tracking-wider flex justify-center items-center ${canAction(order) ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md active:scale-95" : "bg-indigo-900 text-indigo-500 border border-indigo-800 cursor-not-allowed"}`}
                      >
                        {canAction(order) && (
                          <CheckCircle2 size={12} className="mr-1" />
                        )}
                        {getActionBtnLabel(order)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 🌟 History Tab: ดึงค่าจาก shiftCompletedOrders เท่านั้น (เวลาตัดยอด) */}
        {activeTab === "history" && (
          <div className="flex-1 overflow-y-auto hide-scrollbar pb-36 pt-4 px-3 sm:px-5 w-full animate-in fade-in duration-500 mx-auto max-w-2xl">
            <h2 className="font-black text-white mb-4 text-lg flex items-center">
              ประวัติรอบวันนี้
              <span className="ml-2 px-2 py-0.5 bg-indigo-900 border border-indigo-800 text-indigo-300 text-[10px] rounded-md shadow-sm">
                {shiftCompletedOrders.length}
              </span>
            </h2>
            <div className="space-y-3">
              {shiftCompletedOrders.length === 0 ? (
                <div className="text-center py-16 bg-indigo-900/40 rounded-3xl border border-indigo-800/50 shadow-sm">
                  <History size={40} className="mx-auto mb-3 text-indigo-500" />
                  <p className="text-indigo-300 font-bold text-base">
                    ยังไม่มีงานที่สำเร็จ
                  </p>
                </div>
              ) : (
                shiftCompletedOrders.map((order, idx) => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedViewOrder(order)}
                    className="bg-indigo-900/60 p-4 rounded-2xl shadow-sm border border-indigo-800 flex justify-between items-center cursor-pointer active:scale-95 transition-all hover:border-blue-500/50 group animate-in slide-in-from-bottom-2"
                    style={{
                      animationDelay: `${idx * 30}ms`,
                      animationFillMode: "both",
                    }}
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-indigo-950 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors text-indigo-400 text-xs font-black flex items-center justify-center mr-3 border border-indigo-800">
                        {shiftCompletedOrders.length - idx}
                      </div>
                      <div>
                        <div className="font-black text-white text-base group-hover:text-blue-300 transition-colors">
                          {order.order_number}
                        </div>
                        <div className="text-[10px] text-indigo-300 font-medium mt-1 flex items-center">
                          <span className="font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded mr-2 uppercase border border-blue-500/20">
                            {order.job_type}
                          </span>
                          ส่งเมื่อ{" "}
                          {order.end_time
                            ? new Date(order.end_time).toLocaleTimeString(
                                "th-TH",
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : "-"}{" "}
                          น.
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg flex items-center border border-emerald-500/20">
                      <CheckCircle2 size={12} className="mr-1" /> สำเร็จ
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-2 left-1/2 transform -translate-x-1/2 w-[92%] max-w-sm z-40">
        <div className="bg-indigo-950/95 backdrop-blur-xl border border-indigo-800 shadow-[0_10px_30px_rgba(0,0,0,0.6)] rounded-2xl p-1 flex items-center justify-between">
          <button
            onClick={() => setActiveTab("available")}
            className={`relative flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "available" ? "bg-blue-500/20 text-blue-300 shadow-inner border border-blue-500/30" : "text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900/50"}`}
          >
            <Zap
              size={20}
              className={`mb-1 transition-all ${activeTab === "available" ? "fill-blue-400" : ""}`}
            />
            <span className="text-[9px] font-black uppercase tracking-widest">
              งานว่าง
            </span>
            {availableOrders.length > 0 && (
              <span className="absolute top-1.5 right-1/4 translate-x-2 bg-red-500 text-white text-[9px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center animate-bounce shadow-md">
                {availableOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("jobs")}
            className={`relative flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "jobs" ? "bg-blue-500/20 text-blue-300 shadow-inner border border-blue-500/30" : "text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900/50"}`}
          >
            <ClipboardList size={20} className="mb-1" />
            <span className="text-[9px] font-black uppercase tracking-widest">
              งานของฉัน
            </span>
            {activeOrders.length > 0 && (
              <span className="absolute top-1.5 right-1/4 translate-x-2 bg-blue-500 text-white text-[9px] font-black rounded-full h-4 min-w-4 px-1 flex items-center justify-center shadow-md">
                {activeOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`relative flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === "history" ? "bg-blue-500/20 text-blue-300 shadow-inner border border-blue-500/30" : "text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900/50"}`}
          >
            <History size={20} className="mb-1" />
            <span className="text-[9px] font-black uppercase tracking-widest">
              ประวัติ
            </span>
          </button>
        </div>
      </div>

      {/* Hamburger Drawer */}
      {isMenuOpen && (
        <div className="fixed inset-0 flex" style={{ zIndex: 110 }}>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsMenuOpen(false)}
          ></div>
          <div className="relative w-4/5 max-w-xs bg-indigo-950 border-l border-indigo-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 z-10 rounded-r-4xl overflow-hidden">
            <div className="bg-linear-to-brrom-indigo-900 to-indigo-950 p-6 text-white relative border-b border-indigo-800">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="absolute top-5 right-5 p-1.5 bg-indigo-950 rounded-full hover:bg-indigo-800 transition-all cursor-pointer active:scale-90 border border-indigo-800"
              >
                <X size={16} />
              </button>
              <div className="w-14 h-14 bg-indigo-950 rounded-xl flex items-center justify-center mb-4 text-xl font-black shadow-inner border border-indigo-800 text-blue-400">
                {riderName.charAt(0)}
              </div>
              <h2 className="font-black text-xl mb-1 tracking-tight text-white">
                {riderName}
              </h2>
              <p className="text-indigo-400 text-[10px] flex items-center font-bold tracking-wide">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>{" "}
                พร้อมรับงานเสมอ
              </p>
            </div>
            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowDashboard(true);
                }}
                className="w-full flex items-center p-3 text-indigo-200 bg-indigo-900/50 hover:bg-indigo-800 hover:text-white rounded-xl transition-all text-sm font-bold cursor-pointer border border-indigo-800/50"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-950 flex items-center justify-center mr-3">
                  <LayoutDashboard size={16} className="text-blue-400" />
                </div>
                Dashboard ของฉัน
              </button>
            </div>
            <div className="p-4 border-t border-indigo-900 bg-indigo-950">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center p-3 text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-xl transition-all text-sm font-black cursor-pointer shadow-sm active:scale-95"
              >
                <LogOut size={16} className="mr-2" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {selectedViewOrder && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm"
          style={{ zIndex: 200 }}
        >
          <div
            className="bg-indigo-950 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 border border-indigo-800 flex flex-col"
            style={{ maxHeight: "85vh" }}
          >
            <div className="bg-indigo-900 border-b border-indigo-800 p-5 flex justify-between items-center text-white shrink-0">
              <h3 className="font-black flex items-center text-base tracking-tight">
                <ClipboardList size={18} className="mr-2 text-blue-400" />{" "}
                รายละเอียดออเดอร์
              </h3>
              <button
                onClick={() => setSelectedViewOrder(null)}
                className="p-1.5 bg-indigo-800 hover:bg-indigo-700 rounded-full transition-all cursor-pointer active:scale-90 hover:rotate-90 duration-300"
              >
                <X size={16} strokeWidth={3} className="text-indigo-200" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto hide-scrollbar">
              <div className="flex justify-between items-end border-b border-indigo-800 pb-4">
                <div>
                  <div className="text-[10px] font-black text-indigo-400 mb-1 tracking-wider uppercase">
                    เลขที่ออเดอร์
                  </div>
                  <div className="text-2xl font-black text-white tracking-tighter">
                    {selectedViewOrder.order_number}
                  </div>
                </div>
                <div className="text-right mb-1">
                  <span
                    className={`text-[9px] font-black px-2.5 py-1 rounded-md border shadow-sm ${getRiderStatusDisplay(selectedViewOrder.status).color}`}
                  >
                    {selectedViewOrder.status}
                  </span>
                </div>
              </div>

              {selectedViewOrder.menu && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                    รายการที่สั่ง
                  </div>
                  <div className="p-4 bg-indigo-900/50 rounded-xl border border-indigo-800 text-xs text-indigo-100 font-bold whitespace-pre-line leading-relaxed">
                    {selectedViewOrder.menu}
                  </div>
                </div>
              )}

              {selectedViewOrder.details && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                    หมายเหตุ (Note)
                  </div>
                  <div className="p-4 bg-indigo-900/30 rounded-xl border border-indigo-800/50 text-xs text-indigo-300 font-medium whitespace-pre-line leading-relaxed">
                    {selectedViewOrder.details}
                  </div>
                </div>
              )}

              {selectedViewOrder.image_url && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-wider flex items-center">
                    <ImageIcon size={12} className="mr-1.5" /> รูปภาพแนบ
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedViewOrder.image_url
                      .split(",")
                      .filter(Boolean)
                      .map((url, i) => (
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
                          className="relative w-full h-48 rounded-xl overflow-hidden border border-indigo-800 cursor-pointer hover:shadow-lg transition-all bg-black/40"
                        >
                          <Image
                            src={url}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-contain"
                            alt={`Detail ${i}`}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="bg-indigo-900/50 rounded-xl border border-indigo-800 p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-indigo-300 font-medium">
                    ประเภทงาน:
                  </span>
                  <span className="font-black text-white uppercase px-2.5 py-1 bg-indigo-800 rounded-md shadow-sm">
                    {selectedViewOrder.job_type}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2.5 border-t border-indigo-800/50">
                  <span className="text-indigo-300 font-medium">
                    ยอดเรียกเก็บ:
                  </span>
                  <span className="font-black text-white text-lg">
                    ฿{selectedViewOrder.total_price}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-indigo-300 font-medium">
                    การชำระเงิน:
                  </span>
                  <span
                    className={`font-black text-[9px] uppercase px-2 py-1 rounded ${selectedViewOrder.payment_method === "โอน" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300"}`}
                  >
                    {selectedViewOrder.payment_method || "เงินสด"}
                  </span>
                </div>
              </div>

              {selectedViewOrder.address && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                    สถานที่จัดส่ง
                  </div>
                  <div className="flex items-start text-xs text-red-200 bg-red-500/10 p-4 rounded-xl border border-red-500/20 font-bold shadow-inner">
                    <MapIcon
                      size={16}
                      className="mr-2 mt-0.5 text-red-400 shrink-0"
                    />
                    <span className="leading-relaxed">
                      {selectedViewOrder.address}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 pt-0 shrink-0 bg-indigo-950 mt-2">
              <button
                onClick={() => setSelectedViewOrder(null)}
                className="w-full py-3.5 bg-indigo-900 text-indigo-200 hover:text-white hover:bg-indigo-800 border border-indigo-800 font-black rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 text-xs uppercase tracking-widest"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery Modal */}
      {imageGallery && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200"
          onClick={() => {
            setImageGallery(null);
            setImgScale(1);
          }}
          style={{ zIndex: 300 }}
        >
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 text-white pointer-events-none">
            <span className="font-bold text-[10px] bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm border border-white/10">
              ปัดซ้าย-ขวา / ซูมได้
            </span>
            <button
              type="button"
              onClick={() => {
                setImageGallery(null);
                setImgScale(1);
              }}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-90 pointer-events-auto cursor-pointer"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          {imageGallery.urls.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  scrollGallery("left");
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 transition-all cursor-pointer hidden md:block"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  scrollGallery("right");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white z-50 transition-all cursor-pointer hidden md:block"
              >
                <ChevronRight size={20} />
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
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-5 bg-slate-800/80 px-5 py-2.5 rounded-full backdrop-blur-md border border-slate-700 shadow-2xl z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setImgScale((prev) => Math.max(1, prev - 0.5))}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${imgScale <= 1 ? "text-slate-600 cursor-not-allowed" : "text-slate-300 hover:text-white hover:bg-slate-700"}`}
              disabled={imgScale <= 1}
            >
              <ZoomOut size={20} />
            </button>
            <span className="text-white font-black text-xs w-10 text-center">
              {Math.round(imgScale * 100)}%
            </span>
            <button
              onClick={() => setImgScale((prev) => Math.min(4, prev + 0.25))}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${imgScale >= 4 ? "text-slate-600 cursor-not-allowed" : "text-slate-300 hover:text-white hover:bg-slate-700"}`}
              disabled={imgScale >= 4}
            >
              <ZoomIn size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Popup Notifications */}
      {popup.isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          style={{ zIndex: 350 }}
        >
          <div className="bg-indigo-950 rounded-4xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 border border-indigo-800">
            {renderPopupIcon(popup.icon || "info")}
            <h3 className="text-lg font-black text-white mb-2 tracking-tight">
              {popup.title}
            </h3>
            <p className="text-indigo-300 text-xs mb-6 font-medium leading-relaxed">
              {popup.message}
            </p>
            {popup.type === "alert" ? (
              <button
                onClick={closePopup}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl active:scale-95 transition-all shadow-lg shadow-blue-600/30 cursor-pointer text-sm"
              >
                ตกลง
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={closePopup}
                  className="flex-[0.8] py-3.5 bg-indigo-900 border border-indigo-800 hover:bg-indigo-800 text-indigo-200 font-black rounded-xl active:scale-95 transition-all cursor-pointer text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={popup.onConfirm}
                  className="flex-[1.2] py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl active:scale-95 transition-all shadow-lg shadow-blue-600/30 cursor-pointer text-sm"
                >
                  ยืนยัน
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .touch-pinch-zoom {
          touch-action: pinch-zoom;
        }
      `}</style>
    </div>
  );
}

// 🌟 Helper Functions
function isCustomJob(order: Order) {
  return order.job_type === "รับหิ้ว" || order.job_type === "รับส่ง";
}

function canAction(order: Order) {
  if (isCustomJob(order)) return true;
  return order.status === "รับงาน";
}

function getActionBtnLabel(order: Order) {
  if (isCustomJob(order)) {
    if (order.status === "New") return "เริ่มทำงาน";
    if (order.status === "กำลังทำ") return "ทำธุระเสร็จแล้ว";
    if (order.status === "รับงาน") return "ส่งลูกค้าสำเร็จ";
  }
  return order.status === "รับงาน" ? "ส่งลูกค้าสำเร็จ" : "รอครัวทำอาหาร...";
}
