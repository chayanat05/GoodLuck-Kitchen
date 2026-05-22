"use client";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { useCallback, useState, useMemo, useEffect } from 'react';

const containerStyle = { width: '100%', height: '100%', minHeight: '350px', borderRadius: '1.5rem' };
const LIBRARIES: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

interface SavedLocation {
  id?: string;
  name: string;
  lat: number | string;
  lng: number | string;
}

interface JobMapProps {
  lat?: number | null;
  lng?: number | null;
  savedLocations?: SavedLocation[]; 
  onPinChange?: (lat: number, lng: number) => void;
  readOnly?: boolean;
}

export default function JobMap({ lat, lng, savedLocations = [], onPinChange, readOnly = false }: JobMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
    language: 'th', 
    region: 'TH'
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const center = useMemo(() => ({
    lat: lat ? Number(lat) : 16.248130,
    lng: lng ? Number(lng) : 103.242206
  }), [lat, lng]);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  // 🌟 ทำให้แผนที่เลื่อนไปหาจุดศูนย์กลางทันทีเมื่อมีการพิมพ์พิกัดใหม่ในช่อง Input
  useEffect(() => {
    if (map && lat && lng) {
      map.panTo({ lat: Number(lat), lng: Number(lng) });
    }
  }, [lat, lng, map]);

  const onMapClick = (e: google.maps.MapMouseEvent) => {
    if (readOnly || !onPinChange || !e.latLng) return;
    onPinChange(e.latLng.lat(), e.latLng.lng());
    setActiveMarker(null);
  };

  if (loadError) return <div className="p-6 bg-red-50 text-red-500 rounded-xl font-medium flex items-center justify-center border border-red-100">เกิดข้อผิดพลาดในการโหลดแผนที่</div>;
  if (!isLoaded) return <div className="h-87.5 w-full bg-slate-100 animate-pulse flex items-center justify-center rounded-3xl text-slate-400 font-bold tracking-widest uppercase">กำลังโหลดแผนที่...</div>;

  return (
    <div className="w-full h-full relative rounded-3xl overflow-hidden shadow-sm">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={lat && lng ? 17 : 14}
        onLoad={onLoad}
        onClick={onMapClick}
        options={{
          disableDefaultUI: false,
          mapTypeControl: true,
          zoomControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeId: "satellite",
        }}
      >
        {savedLocations.map((loc, idx) => {
          const position = { lat: Number(loc.lat), lng: Number(loc.lng) };
          if (isNaN(position.lat) || isNaN(position.lng)) return null;

          return (
            <MarkerF
              key={loc.id || `saved-${idx}`}
              position={position}
              onClick={() => setActiveMarker(loc.id || `saved-${idx}`)}
            >
              {activeMarker === (loc.id || `saved-${idx}`) && (
                <InfoWindowF onCloseClick={() => setActiveMarker(null)}>
                  <div className="p-2 max-w-45 text-center font-black text-blue-700 text-sm">
                    🏪 {loc.name}
                  </div>
                </InfoWindowF>
              )}
            </MarkerF>
          );
        })}

        {lat && lng && (
          <MarkerF 
            position={{ lat: Number(lat), lng: Number(lng) }} 
          />
        )}
      </GoogleMap>
      
      {!readOnly && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 px-5 py-2.5 bg-slate-900/90 backdrop-blur-sm text-white text-xs font-black rounded-full shadow-2xl pointer-events-none tracking-widest border border-white/10">
          📍 จิ้มบนแผนที่เพื่อปักหมุด
        </div>
      )}
    </div>
  );
}