"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useGoogleMap } from "@react-google-maps/api";
import { isOnlineAt, lastSeenFull, lastSeenShort } from "@/lib/lastSeen";

// สร้าง class หลัง Google Maps โหลดแล้วเท่านั้น (ตอน import ยังไม่มี google.maps)
function createHtmlOverlay(
  container: HTMLElement,
  getPos: () => { lat: number; lng: number },
  getZ: () => number,
) {
  class HtmlOverlay extends google.maps.OverlayView {
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(container);
      google.maps.OverlayView.preventMapHitsAndGesturesFrom(container);
    }
    draw() {
      const { lat, lng } = getPos();
      const p = this.getProjection()?.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));
      if (!p) return;
      container.style.left = `${p.x}px`;
      container.style.top = `${p.y}px`;
      container.style.zIndex = String(getZ());
    }
    onRemove() {
      container.remove();
    }
  }
  return new HtmlOverlay();
}

/**
 * วาง HTML บนแผนที่ที่พิกัด lat/lng โดยจุดล่างกลางของเนื้อหาชี้ที่พิกัด
 * เมื่อพิกัดเปลี่ยนจะค่อย ๆ เลื่อนไป (ขยับ DOM ตรง ๆ ไม่ re-render React ทุกเฟรม)
 */
function HtmlMarker({
  lat,
  lng,
  zIndex,
  children,
}: {
  lat: number;
  lng: number;
  zIndex: number;
  children: ReactNode;
}) {
  const map = useGoogleMap();
  const container = useMemo(() => {
    const d = document.createElement("div");
    d.style.position = "absolute";
    // จุดตำแหน่ง (สูง 14px) อยู่ล่างสุด → เลื่อนขึ้นให้กึ่งกลางจุดตรงพิกัด
    d.style.transform = "translate(-50%, calc(-100% + 7px))";
    return d;
  }, []);
  const posRef = useRef({ lat, lng });
  const zRef = useRef(zIndex);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);

  useEffect(() => {
    if (!map) return;
    const o = createHtmlOverlay(container, () => posRef.current, () => zRef.current);
    o.setMap(map);
    overlayRef.current = o;
    return () => {
      o.setMap(null);
      overlayRef.current = null;
    };
  }, [map, container]);

  useEffect(() => {
    zRef.current = zIndex;
    overlayRef.current?.draw();
  }, [zIndex]);

  useEffect(() => {
    const from = { ...posRef.current };
    if (from.lat === lat && from.lng === lng) return;
    // กระโดดไกล (> ~1 กม.) ย้ายทันที
    const dur = Math.abs(from.lat - lat) > 0.01 || Math.abs(from.lng - lng) > 0.01 ? 0 : 1200;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = dur > 0 ? Math.min(1, (now - start) / dur) : 1;
      const e = 1 - (1 - t) * (1 - t); // ease-out
      posRef.current = { lat: from.lat + (lat - from.lat) * e, lng: from.lng + (lng - from.lng) * e };
      overlayRef.current?.draw();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [lat, lng]);

  return createPortal(children, container);
}

type Tone = { avatar: string; dot: string; text: string };
const TONES: Record<"me" | "online" | "offline" | "shop", Tone> = {
  me: { avatar: "bg-linear-to-br from-indigo-500 to-blue-500", dot: "bg-indigo-500", text: "text-indigo-600" },
  online: { avatar: "bg-linear-to-br from-emerald-400 to-teal-500", dot: "bg-emerald-500", text: "text-emerald-600" },
  offline: { avatar: "bg-linear-to-br from-slate-300 to-slate-400", dot: "bg-slate-400", text: "text-slate-500" },
  shop: { avatar: "bg-linear-to-br from-rose-500 to-orange-500", dot: "bg-rose-500", text: "text-rose-600" },
};

/** หมุดไรเดอร์/ร้านบนแผนที่: ชื่อ + สถานะ + ออนไลน์ล่าสุด กดเพื่อดูวันเวลาเต็ม */
export default function RiderMapPin({
  lat,
  lng,
  name,
  lastSeen,
  now,
  isMe = false,
  isShop = false,
  selected = false,
  onClick,
}: {
  lat: number;
  lng: number;
  name: string;
  lastSeen: string | null;
  now: number;
  isMe?: boolean;
  isShop?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const online = isOnlineAt(lastSeen, now);
  const tone = TONES[isShop ? "shop" : isMe ? "me" : online ? "online" : "offline"];
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const status = isShop ? "จุดประจำร้าน" : lastSeenShort(lastSeen, now);

  return (
    <HtmlMarker lat={lat} lng={lng} zIndex={selected ? 1000 : isShop ? 50 : isMe ? 100 : online ? 20 : 10}>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={`flex flex-col items-center cursor-pointer select-none transition-transform duration-200 ${
          selected ? "scale-105" : "hover:scale-105"
        } ${!online && !isShop && !isMe && !selected ? "opacity-85" : ""}`}
      >
        <div
          className={`rounded-2xl bg-white shadow-lg shadow-slate-900/20 ring-1 text-left ${
            selected ? "ring-2 ring-slate-900/10" : "ring-black/5"
          }`}
        >
          <div className="flex items-center gap-2 py-1.5 pl-1.5 pr-3">
            <div className="relative shrink-0">
              <div
                className={`w-8 h-8 rounded-full ${tone.avatar} flex items-center justify-center text-white text-sm font-black shadow-inner`}
              >
                {isShop ? "🏪" : initial}
              </div>
              {!isShop && (
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                    online ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
              )}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-[13px] font-black text-slate-800 max-w-32 truncate">
                {name}
                {isMe && <span className="ml-1 text-[10px] font-bold text-indigo-500">(คุณ)</span>}
              </div>
              <div className={`text-[11px] font-semibold whitespace-nowrap ${online || isShop ? tone.text : "text-slate-500"}`}>
                {!isShop && !online && <span className="text-slate-400">ออนไลน์ล่าสุด </span>}
                {status}
              </div>
            </div>
          </div>

          {selected && !isShop && (
            <div className="border-t border-slate-100 px-3 py-2 text-[11px] leading-snug">
              <div className="text-slate-400 font-semibold">ออนไลน์ล่าสุด</div>
              <div className="text-slate-700 font-bold whitespace-nowrap">{lastSeenFull(lastSeen)}</div>
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-1.5 inline-block font-bold text-blue-600 hover:underline"
              >
                เปิดใน Google Maps ↗
              </a>
            </div>
          )}
        </div>

        {/* หางชี้ + จุดตำแหน่ง */}
        <div className="w-3 h-3 bg-white rotate-45 -mt-1.5 shadow-md shadow-slate-900/10" />
        <div className="relative mt-1 w-3.5 h-3.5">
          {(online || isMe) && !isShop && (
            <span className={`absolute inset-0 rounded-full ${tone.dot} opacity-60 animate-ping`} />
          )}
          <span className={`absolute inset-0 rounded-full ${tone.dot} border-2 border-white shadow`} />
        </div>
      </div>
    </HtmlMarker>
  );
}
