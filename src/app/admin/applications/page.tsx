"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  X,
  ArrowLeft,
  ZoomIn,
  ChefHat,
  Bike,
  ShieldCheck,
  Phone,
  MapPin,
  CalendarDays,
  Clock,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface Application {
  id: string;
  created_at: string;
  full_name: string;
  fb_profile_image: string;
  phone_number: string;
  status: string;
  app_type: "rider" | "kitchen" | "admin";
  age?: number;
  // ไรเดอร์
  faculty?: string;
  vehicle_model?: string;
  driving_license_status?: string;
  experience_and_area?: string;
  start_date_and_commitment?: string;
  // แม่ครัว
  current_address?: string;
  can_commute?: string;
  education?: string;
  experience?: string;
  can_work_late?: string;
  family_approval?: string;
  handle_pressure?: string;
  start_date?: string;
  days_per_week?: string;
  about_me?: string;
  // แอดมิน
  address_commute?: string;
  faculty_year?: string;
  prev_admin_exp?: string;
  typing_speed_focus?: string;
  availability?: string;
  late_night_shift?: string;
}

export default function ApplicationsDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"rider" | "kitchen" | "admin">(
    "rider",
  );
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  // 🌟 เพิ่ม State สำหรับจัดการการซูมภาพโดยเฉพาะ
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(
    null,
  );
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    const fetchApplications = async () => {
      const [riderRes, kitchenRes, adminRes] = await Promise.all([
        supabase
          .from("rider_applications")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("kitchen_applications")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("admin_applications")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      const riderApps: Application[] = (riderRes.data || []).map((a) => ({
        ...a,
        app_type: "rider",
        status: a.status || "pending",
      }));
      const kitchenApps: Application[] = (kitchenRes.data || []).map((a) => ({
        ...a,
        app_type: "kitchen",
        status: "pending",
      }));
      const adminApps: Application[] = (adminRes.data || []).map((a) => ({
        ...a,
        app_type: "admin",
        status: a.status || "pending",
      }));

      setApplications([...riderApps, ...kitchenApps, ...adminApps]);
    };

    fetchApplications();
  }, []);

  const updateStatus = async (
    id: string,
    type: "rider" | "kitchen" | "admin",
    newStatus: string,
  ) => {
    const tableMap = {
      rider: "rider_applications",
      kitchen: "kitchen_applications",
      admin: "admin_applications",
    };
    const table = tableMap[type];
    const { error } = await supabase
      .from(table)
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      alert("เกิดข้อผิดพลาด");
      return;
    }

    setApplications((apps) =>
      apps.map((app) => (app.id === id ? { ...app, status: newStatus } : app)),
    );
    if (selectedApp?.id === id)
      setSelectedApp({ ...selectedApp, status: newStatus });
  };

  const filteredApps = applications.filter(
    (app) =>
      app.app_type === viewMode &&
      (app.full_name.toLowerCase().includes(search.toLowerCase()) ||
        app.phone_number.includes(search)),
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/home"
              className="p-2 bg-white rounded-full shadow-sm border border-slate-200 cursor-pointer active:scale-95"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-slate-800">
                จัดการใบสมัคร
              </h1>
              <p className="text-xs font-bold text-slate-500">
                คัดกรองผู้สมัคร{" "}
                {viewMode === "rider"
                  ? "ไรเดอร์"
                  : viewMode === "kitchen"
                    ? "แม่ครัว"
                    : "แอดมิน"}
              </p>
            </div>
          </div>

          <div className="flex p-1 bg-slate-100 border border-slate-200 rounded-2xl w-full md:w-auto shadow-inner">
            <button
              onClick={() => {
                setViewMode("rider");
                setSelectedApp(null);
              }}
              className={`flex-1 md:w-32 py-2.5 px-4 text-xs font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer 
              ${viewMode === "rider" ? "bg-white text-indigo-600 shadow-md ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Bike size={14} /> ไรเดอร์
            </button>
            <button
              onClick={() => {
                setViewMode("kitchen");
                setSelectedApp(null);
              }}
              className={`flex-1 md:w-32 py-2.5 px-4 text-xs font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer 
              ${viewMode === "kitchen" ? "bg-white text-amber-600 shadow-md ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700"}`}
            >
              <ChefHat size={14} /> แม่ครัว
            </button>
            <button
              onClick={() => {
                setViewMode("admin");
                setSelectedApp(null);
              }}
              className={`flex-1 md:w-32 py-2.5 px-4 text-xs font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer 
              ${viewMode === "admin" ? "bg-white text-rose-600 shadow-md ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700"}`}
            >
              <ShieldCheck size={14} /> แอดมิน
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row h-[75vh]">
          <div className="w-full md:w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/50">
            {/* Search Input */}
            <div className="p-4">
              <input
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="ค้นหาชื่อ, เบอร์โทร..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto thin-scrollbar">
              {filteredApps.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-bold text-sm">
                  ไม่พบข้อมูลผู้สมัคร
                </div>
              ) : (
                filteredApps.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={`p-4 border-b border-slate-100 cursor-pointer flex items-center gap-3 transition-colors ${selectedApp?.id === app.id ? "bg-indigo-50/80 border-l-4 border-l-indigo-500" : "hover:bg-white border-l-4 border-l-transparent"}`}
                  >
                    <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 bg-slate-200 shadow-sm border border-white">
                      <Image
                        src={app.fb_profile_image}
                        alt="Profile"
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-slate-800 truncate">
                        {app.full_name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                        <Phone size={10} /> {app.phone_number}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-8 thin-scrollbar">
            {selectedApp ? (
              <div className="animate-in fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4 border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-4">
                    <div
                      className="relative group cursor-zoom-in shrink-0"
                      onClick={() =>
                        setSelectedFullImage(selectedApp.fb_profile_image)
                      }
                    >
                      <Image
                        src={selectedApp.fb_profile_image}
                        width={96}
                        height={96}
                        alt="Profile"
                        className="rounded-2xl object-cover transition-opacity group-hover:opacity-80 shadow-md border-2 border-white aspect-square"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn className="text-white" size={24} />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800">
                        {selectedApp.full_name}
                      </h2>
                      <div className="text-sm font-bold text-slate-500 flex flex-wrap items-center gap-y-1 gap-x-4 mt-1.5">
                        <span className="flex items-center gap-1">
                          <Phone size={14} className="text-indigo-500" />{" "}
                          {selectedApp.phone_number}
                        </span>
                        {/* 🌟 แสดงวันที่และเวลาในการส่งใบสมัครแบบชัดเจน */}
                        <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          <CalendarDays size={14} className="text-amber-500" />
                          {new Date(selectedApp.created_at).toLocaleDateString(
                            "th-TH",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                          <span className="mx-0.5 text-slate-300">•</span>
                          <Clock size={14} className="text-blue-500" />
                          {new Date(selectedApp.created_at).toLocaleTimeString(
                            "th-TH",
                            { hour: "2-digit", minute: "2-digit" },
                          )}{" "}
                          น.
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto shrink-0">
                    <button
                      onClick={() =>
                        updateStatus(
                          selectedApp.id,
                          selectedApp.app_type,
                          "approved",
                        )
                      }
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      รับเข้าทำงาน
                    </button>
                    <button
                      onClick={() =>
                        updateStatus(
                          selectedApp.id,
                          selectedApp.app_type,
                          "rejected",
                        )
                      }
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      ปฏิเสธ
                    </button>
                  </div>
                </div>

                {/* 🌟 Dynamic Content (แสดงครบทุกฟิลด์) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 🛡️ ข้อมูลแอดมิน */}
                  {selectedApp.app_type === "admin" && (
                    <>
                      <DetailItem
                        label="อายุ"
                        value={selectedApp.age ? `${selectedApp.age} ปี` : "-"}
                      />
                      <DetailItem
                        label="ที่อยู่ปัจจุบัน / การเดินทาง"
                        value={selectedApp.address_commute || "-"}
                      />
                      <DetailItem
                        label="คณะ / ปีที่เรียน"
                        value={selectedApp.faculty_year || "-"}
                      />
                      <DetailItem
                        label="วันที่สะดวกทำงาน"
                        value={selectedApp.availability || "-"}
                      />
                      <DetailItem
                        label="การพิมพ์แชท / สมาธิ"
                        value={selectedApp.typing_speed_focus || "-"}
                        fullWidth
                      />
                      <DetailItem
                        label="ประสบการณ์แอดมิน"
                        value={selectedApp.prev_admin_exp || "-"}
                        fullWidth
                      />
                      <DetailItem
                        label="แนะนำตัว / ทักษะเพิ่มเติม"
                        value={selectedApp.about_me || "-"}
                        fullWidth
                      />
                    </>
                  )}

                  {/* 🛵 ข้อมูลไรเดอร์ */}
                  {selectedApp.app_type === "rider" && (
                    <>
                      <DetailItem
                        label="อายุ"
                        value={selectedApp.age ? `${selectedApp.age} ปี` : "-"}
                      />
                      <DetailItem
                        label="คณะ / สาขา"
                        value={selectedApp.faculty || "-"}
                      />
                      <DetailItem
                        label="รุ่นรถที่ใช้งาน"
                        value={selectedApp.vehicle_model || "-"}
                      />
                      <DetailItem
                        label="ใบขับขี่ / พ.ร.บ."
                        value={selectedApp.driving_license_status || "-"}
                      />
                      <DetailItem
                        label="ที่อยู่ปัจจุบัน"
                        value={selectedApp.current_address || "-"}
                        fullWidth
                      />
                      <DetailItem
                        label="เวลาว่างทำงาน"
                        value={selectedApp.availability || "-"}
                      />
                      <DetailItem
                        label="ทำงานรอบดึก (19.00 - 04.00)"
                        value={selectedApp.late_night_shift || "-"}
                      />
                      <DetailItem
                        label="การรับแรงกดดัน / งานเร่งด่วน"
                        value={selectedApp.handle_pressure || "-"}
                      />
                      <DetailItem
                        label="ครอบครัวอนุญาต"
                        value={selectedApp.family_approval || "-"}
                      />
                      <DetailItem
                        label="ประสบการณ์ / รู้จักพื้นที่ มมส."
                        value={selectedApp.experience_and_area || "-"}
                        fullWidth
                      />
                      <DetailItem
                        label="เริ่มงานได้เมื่อไหร่ / สัญญา 10 เดือน"
                        value={selectedApp.start_date_and_commitment || "-"}
                        fullWidth
                      />
                    </>
                  )}

                  {/* 🍳 ข้อมูลแม่ครัว */}
                  {selectedApp.app_type === "kitchen" && (
                    <>
                      <DetailItem
                        label="ที่อยู่ปัจจุบัน"
                        value={selectedApp.current_address || "-"}
                      />
                      <DetailItem
                        label="การเดินทางมาทำงาน"
                        value={selectedApp.can_commute || "-"}
                      />
                      <DetailItem
                        label="คณะ / ปีที่เรียน"
                        value={selectedApp.education || "-"}
                      />
                      <DetailItem
                        label="วันที่สะดวกทำงาน"
                        value={selectedApp.days_per_week || "-"}
                      />
                      <DetailItem
                        label="เริ่มงานได้เมื่อไหร่"
                        value={selectedApp.start_date || "-"}
                      />
                      <DetailItem
                        label="ทำงานเลิกดึกได้ไหม"
                        value={selectedApp.can_work_late || "-"}
                      />
                      <DetailItem
                        label="ครอบครัวอนุญาต"
                        value={selectedApp.family_approval || "-"}
                      />
                      <DetailItem
                        label="การรับแรงกดดัน"
                        value={selectedApp.handle_pressure || "-"}
                      />
                      <DetailItem
                        label="ประสบการณ์การทำอาหาร / ทำงาน"
                        value={selectedApp.experience || "-"}
                        fullWidth
                      />
                      <DetailItem
                        label="แนะนำตัว"
                        value={selectedApp.about_me || "-"}
                        fullWidth
                      />
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                <ShieldCheck size={64} className="opacity-50" strokeWidth={1} />
                <p className="font-bold tracking-widest uppercase">
                  เลือกใบสมัครเพื่อดูรายละเอียด
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🌟 Image Modal (อัปเดตระบบซูมให้ลากและเลื่อนจอได้) */}
      {selectedFullImage && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/95 animate-in fade-in"
          onClick={() => {
            setSelectedFullImage(null);
            setIsZoomed(false);
          }}
        >
          <button
            className="absolute top-6 right-6 text-white hover:text-slate-300 z-110 bg-white/10 p-2 rounded-full backdrop-blur-sm transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFullImage(null);
              setIsZoomed(false);
            }}
          >
            <X size={24} />
          </button>

          <div className="absolute top-6 left-6 text-white/50 text-xs font-bold bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm z-110 pointer-events-none">
            คลิกที่รูปภาพเพื่อ {isZoomed ? "ย่อรูป" : "ซูมรูป"}
          </div>

          <div
            className="relative w-full h-full flex overflow-auto p-4 md:p-10 thin-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedFullImage}
              alt="Full view"
              className={`transition-all duration-300 rounded-2xl m-auto shadow-2xl ${isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
              style={{
                maxHeight: isZoomed ? "none" : "100%",
                maxWidth: isZoomed ? "none" : "100%",
                width: isZoomed ? "250%" : "auto",
                objectFit: "contain",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(!isZoomed);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`bg-slate-50 p-4 rounded-2xl border border-slate-100 ${fullWidth ? "md:col-span-2" : ""}`}
    >
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
        {label}
      </p>
      <p className="text-sm font-bold mt-1.5 text-slate-700 whitespace-pre-line leading-relaxed">
        {value}
      </p>
    </div>
  );
}
