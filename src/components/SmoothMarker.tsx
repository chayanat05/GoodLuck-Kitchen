"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { MarkerF } from "@react-google-maps/api";

type LatLng = { lat: number; lng: number };

/** MarkerF ที่เลื่อนไปตำแหน่งใหม่แบบนุ่ม ๆ แทนการกระโดด */
export default function SmoothMarker({
  position,
  durationMs = 1200,
  ...rest
}: ComponentProps<typeof MarkerF> & { position: LatLng; durationMs?: number }) {
  const [shown, setShown] = useState<LatLng>(position);
  const shownRef = useRef<LatLng>(position);
  const { lat, lng } = position;

  useEffect(() => {
    const from = shownRef.current;
    if (from.lat === lat && from.lng === lng) return;

    // กระโดดไกล (> ~1 กม.) ไม่ต้องเลื่อน ย้ายทันที
    const far = Math.abs(from.lat - lat) > 0.01 || Math.abs(from.lng - lng) > 0.01;
    const dur = far ? 0 : durationMs;

    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = dur > 0 ? Math.min(1, (now - start) / dur) : 1;
      const e = 1 - (1 - t) * (1 - t); // ease-out
      const next = { lat: from.lat + (lat - from.lat) * e, lng: from.lng + (lng - from.lng) * e };
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [lat, lng, durationMs]);

  return <MarkerF {...rest} position={shown} />;
}
