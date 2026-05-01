'use client'
import { Clock, Lock, MapPin, Edit2, ChefHat, PlayCircle, PackageCheck, Eye, Image as ImageIcon } from "lucide-react";
import React, { useMemo } from 'react';

export interface Order {
  id: string;
  order_number: string;
  job_type: "ร้าน" | "รับหิ้ว" | "รับส่ง" | "shopee" | string;
  status: "New" | "กำลังทำ" | "รับงาน" | "ส่งแล้ว/เสร็จ" | string;
  menu?: string; 
  details: string;
  total_price: number;
  created_at: string;
  address?: string | null; 
  rider_id?: string | null;
  rider_name?: string | null;
  image_url?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  lat?: number | null;
  lng?: number | null;
  payment_method?: string;
}

interface OrderProps {
  order: Order;
  onEdit?: (order: Order) => void; 
  onStart?: (id: string) => void;  
  onFinish?: (id: string) => void; 
  onViewDetails?: () => void; 
  onViewImages?: (urls: string[], startIndex: number) => void; 
}

const getCardTheme = (status: string) => {
  switch (status) {
    case 'New': return { bg: 'bg-blue-600 border-blue-700', text: 'text-white', subText: 'text-blue-100', btnBg: 'bg-white hover:bg-blue-50 text-blue-700', badgeBg: 'bg-white/20 text-white border-white/30' };
    case 'กำลังทำ': return { bg: 'bg-yellow-400 border-yellow-500', text: 'text-slate-900', subText: 'text-slate-700', btnBg: 'bg-slate-900 hover:bg-slate-800 text-white', badgeBg: 'bg-white/40 text-slate-900 border-slate-900/10' };
    case 'รับงาน': return { bg: 'bg-purple-600 border-purple-700', text: 'text-white', subText: 'text-purple-100', btnBg: 'bg-white hover:bg-purple-50 text-purple-700', badgeBg: 'bg-white/20 text-white border-white/30' };
    case 'ส่งแล้ว/เสร็จ': return { bg: 'bg-emerald-600 border-emerald-700', text: 'text-white', subText: 'text-emerald-100', btnBg: 'bg-white hover:bg-emerald-50 text-emerald-700', badgeBg: 'bg-white/20 text-white border-white/30' };
    default: return { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-900', subText: 'text-gray-500', btnBg: 'bg-white text-gray-700', badgeBg: 'bg-gray-200 text-gray-800 border-gray-300' };
  }
};

function OrderCard({ order, onEdit, onStart, onFinish, onViewDetails, onViewImages }: OrderProps) {
  const isShopee = order.job_type === "shopee";
  const isCustomJob = order.job_type === "รับหิ้ว" || order.job_type === "รับส่ง"; 
  const isLocked = !!order.rider_id;

  const images = useMemo(() => {
    return order.image_url ? order.image_url.split(',').filter(Boolean) : [];
  }, [order.image_url]);
  const hasImages = images.length > 0;

  const theme = getCardTheme(order.status);

  return (
    <div className={`p-4 rounded-3xl shadow-xl border-b-[6px] relative transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:-translate-y-2 flex flex-col h-max min-h-[14rem] ${theme.bg}`}>
      
      <div className="flex justify-between items-start mb-4 gap-2 border-b border-white/10 pb-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-black px-2.5 py-1 rounded-lg bg-white/90 text-slate-800 tracking-wider shadow-sm">
            {isShopee ? (order.order_number.startsWith('#') ? order.order_number : `#${order.order_number}`) : order.order_number}
          </span>
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider border ${theme.badgeBg}`}>
            {order.job_type}
          </span>
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider border ${theme.badgeBg}`}>
            {order.status}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onViewDetails && (
            <button onClick={(e) => { e.stopPropagation(); onViewDetails(); }} className={`p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/20 ${theme.text}`}>
              <Eye size={16} strokeWidth={2.5}/>
            </button>
          )}
          <button onClick={() => onEdit?.(order)} className={`p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/20 ${theme.text}`}>
            <Edit2 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {order.menu && (
        <div className={`mb-3 text-sm font-black whitespace-pre-line leading-relaxed line-clamp-3 ${theme.text}`}>
          {order.menu}
        </div>
      )}

      {order.details && <p className={`text-[11px] font-medium line-clamp-2 leading-relaxed p-2.5 rounded-xl border border-white/10 bg-black/10 backdrop-blur-sm mb-4 ${theme.subText}`}>{order.details}</p>}

      {hasImages && (
        <div onClick={(e) => { e.stopPropagation(); if (onViewImages) onViewImages(images, 0); else onViewDetails?.(); }} className="mb-4 relative h-28 w-full rounded-2xl overflow-hidden border border-white/20 shadow-md cursor-pointer group/img shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt="Order attachment" className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" />
          {images.length > 1 && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center">
              <span className="text-white font-black text-sm flex items-center drop-shadow-md"><ImageIcon size={16} className="mr-1.5 opacity-90" /> +{images.length - 1}</span>
            </div>
          )}
        </div>
      )}

      {order.address && (
        <div className={`flex items-start text-xs mb-4 p-2.5 rounded-xl border border-white/10 bg-black/10 backdrop-blur-sm ${theme.text}`}>
          <MapPin size={14} className="mr-1.5 mt-0.5 shrink-0" />
          <span className="line-clamp-2 leading-relaxed font-medium">{order.address}</span>
        </div>
      )}

      <div className={`flex flex-wrap items-center justify-between mb-4 border-t border-white/10 pt-3 gap-2 mt-auto ${theme.subText}`}>
        <div className="flex items-center text-[11px] font-bold tracking-wide shrink-0">
          <Clock size={12} className="mr-1.5" />
          {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
        </div>
        {!isShopee && (
          <div className="flex items-center gap-2">
            <span className={`font-black text-sm ${theme.text}`}>฿{order.total_price}</span>
            {order.payment_method && (
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm border ${theme.badgeBg}`}>
                {order.payment_method}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 shrink-0">
        {order.status === 'New' && !isCustomJob && onStart && (
          <button onClick={() => onStart(order.id)} className={`w-full py-3 rounded-xl text-[11px] font-black transition-all duration-300 flex justify-center items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 uppercase tracking-wide border-b-4 border-transparent active:border-none ${theme.btnBg}`}>
            <PlayCircle size={16} className="shrink-0" />
            <span className="truncate">{isShopee ? 'รับงาน / เตรียมของ' : 'คลิกเพื่อเริ่มทำอาหาร'}</span>
          </button>
        )}

        {order.status === 'กำลังทำ' && !isCustomJob && onFinish && (
          <button onClick={() => onFinish(order.id)} className={`w-full py-3 rounded-xl text-[11px] font-black transition-all duration-300 flex justify-center items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 uppercase tracking-wide border-b-4 border-transparent active:border-none ${theme.btnBg}`}>
            {isShopee ? <PackageCheck size={16} className="shrink-0"/> : <ChefHat size={16} className="shrink-0" />}
            <span className="truncate">{isShopee ? 'ส่งมอบให้ขนส่งแล้ว' : 'คลิกเมื่อทำอาหารเสร็จ'}</span>
          </button>
        )}

        {isCustomJob && order.status !== 'ส่งแล้ว/เสร็จ' && (
          <div className={`text-center py-2.5 text-[10px] font-black rounded-xl shadow-inner tracking-wide bg-black/10 border border-white/10 ${theme.text}`}>
            🛵 ไรเดอร์ดำเนินการรับส่งเอง
          </div>
        )}

        {isLocked && !isCustomJob && (
          <div className={`flex items-center justify-center py-2.5 rounded-xl text-[10px] font-black shadow-inner tracking-wide bg-black/10 border border-white/10 ${theme.text}`}>
            <Lock size={12} className="mr-1.5 shrink-0" /> <span className="truncate">จองโดย: {order.rider_name || "ไรเดอร์"}</span>
          </div>
        )}
        
        {isShopee && order.status === 'รับงาน' && (
          <div className={`text-center py-2.5 text-[10px] font-black rounded-xl shadow-inner tracking-wide bg-black/10 border border-white/10 ${theme.text}`}>
            📦 ออเดอร์ Shopee (รอมารับ)
          </div>
        )}
      </div>
      
    </div>
  );
}

export default React.memo(OrderCard);