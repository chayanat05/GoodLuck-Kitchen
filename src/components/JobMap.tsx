'use client'
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { useCallback, useState } from 'react';
import { useMemo } from 'react';

const containerStyle = { width: '100%', height: '400px', borderRadius: '0.75rem' };
const LIBRARIES: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

interface SavedLocation {
  name: string;
  lat: number;
  lng: number;
}

interface JobMapProps {
  lat?: number | null;
  lng?: number | null;
  savedLocations?: SavedLocation[]; // 🌟 รับข้อมูลหมุดที่เซฟไว้มาโชว์
  onPinChange?: (lat: number, lng: number) => void;
  readOnly?: boolean;
}

export default function JobMap({ lat, lng, savedLocations = [], onPinChange, readOnly = false }: JobMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
    language: 'th', // 🌟 บังคับให้แผนที่เป็นภาษาไทย
    region: 'TH'
  });

  const [, setMap] = useState<google.maps.Map | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const center = lat && lng ? { lat, lng } : { lat: 16.248130, lng: 103.242206 };

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onMapClick = (e: google.maps.MapMouseEvent) => {
    if (readOnly || !onPinChange || !e.latLng) return;
    onPinChange(e.latLng.lat(), e.latLng.lng());
    setActiveMarker(null);
  };

  const limitedLocations = useMemo(() => {
  return savedLocations.slice(0, 50);
}, [savedLocations]);

  if (loadError) return <div className="p-6 bg-red-50 text-red-500 rounded-xl font-medium flex items-center justify-center border border-red-100">เกิดข้อผิดพลาดในการโหลดแผนที่</div>;
  if (!isLoaded) return <div className="h-400px bg-gray-100 animate-pulse flex items-center justify-center rounded-xl text-gray-400 font-medium">กำลังโหลดดาวเทียม...</div>;

  return (
    <div className="border-2 border-gray-100 rounded-xl overflow-hidden shadow-sm relative transition-all hover:border-blue-200">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={lat && lng ? 17 : 14}
        onLoad={onLoad}
        onClick={onMapClick}
        options={{
          disableDefaultUI: false,
          mapTypeControl: true, // สลับแผนที่/ดาวเทียม
          zoomControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControlOptions: {
            position: window.google?.maps?.ControlPosition?.TOP_LEFT, // 🌟 ย้ายมาซ้ายบนให้กดง่าย
            style: window.google?.maps?.MapTypeControlStyle?.DROPDOWN_MENU
          },
          zoomControlOptions: {
            position: window.google?.maps?.ControlPosition?.RIGHT_BOTTOM // ซูมไว้ขวาล่าง
          }
        }}
      >
        {/* 🌟 1. เรนเดอร์หมุดที่เคยบันทึกไว้ของร้าน (สีน้ำเงิน) */}
        {limitedLocations.map((loc, idx) => (
          <MarkerF
            key={`saved-${idx}`}
            position={{ lat: loc.lat, lng: loc.lng }}
            icon="http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
            onClick={() => setActiveMarker(`saved-${idx}`)}
          >
            {activeMarker === `saved-${idx}` && (
              <InfoWindowF onCloseClick={() => setActiveMarker(null)}>
                <div className="p-1 max-w-150px text-center font-bold text-blue-700 text-xs">
                  🏪 {loc.name}
                </div>
              </InfoWindowF>
            )}
          </MarkerF>
        ))}

        {/* 🌟 2. เรนเดอร์หมุดที่กำลังปักอยู่ (สีแดงปกติ) */}
        {lat && lng && (
          <MarkerF 
            position={{ lat, lng }} 
            animation={window.google?.maps?.Animation?.DROP} 
          />
        )}
      </GoogleMap>
      
      {!readOnly && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-bold rounded-full shadow-lg border border-gray-200 pointer-events-none">
          📍 จิ้มบนแผนที่เพื่อปักหมุด
        </div>
      )}
    </div>
  );
}