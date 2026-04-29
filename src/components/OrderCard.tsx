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

function OrderCard({ order, onEdit, onStart, onFinish, onViewDetails, onViewImages }: OrderProps) {
  const isShopee = order.job_type === "shopee";
  const isCustomJob = order.job_type === "รับหิ้ว" || order.job_type === "รับส่ง"; 
  const isLocked = !!order.rider_id;

  const images = useMemo(() => {
  return order.image_url 
    ? order.image_url.split(',').filter(Boolean)
    : [];
  }, [order.image_url]);
  const hasImages = images.length > 0;

  return (
    // 🌟 ลด Padding หลักของ Card จาก p-4 เป็น p-3
    <div className={`p-3 mb-2 bg-white rounded-xl shadow-sm border-l-4 group relative transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${isShopee ? "border-l-orange-500" : isCustomJob ? "border-l-purple-500" : "border-l-blue-500"} border border-slate-100`}>
      
      {/* ส่วนหัว: เลขออเดอร์ & ปุ่ม */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-100 text-slate-800 tracking-wide shadow-inner">
            {isShopee 
              ? (order.order_number.startsWith('#') ? order.order_number : `#${order.order_number}`) 
              : order.order_number}
          </span>
          
          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${isShopee ? "bg-orange-50 text-orange-600 border border-orange-100" : isCustomJob ? "bg-purple-50 text-purple-600 border border-purple-100" : "bg-blue-50 text-blue-600 border border-blue-100"}`}>
            {order.job_type}
          </span>

          {onViewDetails && (
            <button 
              onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
              className="bg-white text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded shadow-sm text-[9px] font-black flex items-center hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 cursor-pointer group/eye"
            >
              <Eye size={10} className="mr-1 group-hover/eye:scale-110 transition-transform" /> รายละเอียด
            </button>
          )}
        </div>

        <button 
          onClick={() => onEdit?.(order)} 
          className="text-slate-300 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer active:scale-90"
        >
          <Edit2 size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* 🌟 เมนู: บีบให้แสดงแค่ 2 บรรทัด (line-clamp-2) ฟอนต์เล็กลง */}
      {order.menu && (
        <div className="mb-2 p-2 bg-slate-50/80 rounded-lg border border-slate-100 text-xs text-slate-800 font-bold line-clamp-2 shadow-inner">
          {order.menu}
        </div>
      )}

      {/* 🌟 หมายเหตุ: บีบให้แสดงแค่ 1 บรรทัด */}
      {order.details && <p className="text-[10px] text-slate-500 mb-2 font-medium line-clamp-1 pl-1">{order.details}</p>}

      {/* 🌟 รูปพรีวิว: ย่อความสูงจาก h-28 เหลือแค่ h-14 */}
      {hasImages && (
        <div 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (onViewImages) onViewImages(images, 0); 
            else onViewDetails?.(); 
          }}
          className="mb-2 relative h-14 rounded-lg overflow-hidden border border-slate-200 shadow-sm cursor-pointer group/img"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={images[0]} 
            alt="Order attachment" 
            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" 
          />
          
          {images.length > 1 ? (
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center">
              <span className="text-white font-black text-xs flex items-center drop-shadow-md">
                <ImageIcon size={12} className="mr-1 opacity-80" /> +{images.length - 1}
              </span>
            </div>
          ) : (
            <div className="absolute inset-0 bg-slate-900/0 group-hover/img:bg-slate-900/20 transition-colors flex items-center justify-center">
              <Eye className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" size={16} />
            </div>
          )}
        </div>
      )}

      {/* 🌟 ที่อยู่: บีบให้แสดง 1 บรรทัด และย่อ Padding */}
      {order.address && (
        <div className="flex items-start text-[10px] text-slate-600 mb-2 bg-red-50/50 p-2 rounded-lg border border-red-100/50">
          <MapPin size={12} className="mr-1 mt-0.5 shrink-0 text-red-500" />
          <span className="line-clamp-1 font-medium">{order.address}</span>
        </div>
      )}

      {/* ส่วนท้าย: เวลา และ ราคา */}
      <div className="flex items-center justify-between mb-2 border-t border-slate-100 pt-2">
        <div className="flex items-center text-[10px] text-slate-400 font-bold tracking-wide">
          <Clock size={12} className="mr-1" />
          {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
        </div>
        {!isShopee && (
          <div className="flex items-center gap-1.5">
            <span className="font-black text-slate-800 text-xs">฿{order.total_price}</span>
            {order.payment_method && (
              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm ${order.payment_method === 'โอน' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {order.payment_method}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 🌟 ปุ่มกดต่างๆ: ลดขนาดปุ่ม (py-3 -> py-2) */}
      <div className="flex flex-col gap-1.5 mt-1">
        {order.status === 'New' && !isCustomJob && onStart && (
          <button 
            onClick={() => onStart(order.id)}
            className="w-full py-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-600 hover:text-blue-700 rounded-lg text-[10px] font-black transition-all duration-300 flex justify-center items-center gap-1.5 cursor-pointer group/btn shadow-sm active:scale-95 uppercase tracking-wide"
          >
            <PlayCircle size={14} className="group-hover/btn:scale-110 transition-transform" />
            {isShopee ? 'เริ่มเตรียมของ (Shopee)' : 'ครัวเริ่มทำอาหาร'}
          </button>
        )}

        {order.status === 'กำลังทำ' && !isCustomJob && onFinish && (
          <button 
            onClick={() => onFinish(order.id)}
            className={`w-full py-2 rounded-lg text-[10px] font-black transition-all duration-300 flex justify-center items-center gap-1.5 cursor-pointer group/btn shadow-sm active:scale-95 uppercase tracking-wide ${
              isShopee 
              ? 'bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700' 
              : 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700'
            }`}
          >
            {isShopee ? <PackageCheck size={14} className="group-hover/btn:scale-110 transition-transform" /> : <ChefHat size={14} className="group-hover/btn:scale-110 transition-transform" />}
            {isShopee ? 'ส่งมอบให้ขนส่งแล้ว' : 'ครัวทำเสร็จแล้ว'}
          </button>
        )}

        {isCustomJob && order.status !== 'ส่งแล้ว/เสร็จ' && (
          <div className="text-center p-2 text-[10px] text-purple-600 font-black bg-purple-50 border border-purple-100 rounded-lg shadow-inner animate-pulse tracking-wide">
            🛵 ไรเดอร์ดำเนินการเอง (รับหิ้ว/รับส่ง)
          </div>
        )}

        {isLocked && !isCustomJob && (
          <div className="flex items-center justify-center p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 text-[10px] font-black shadow-inner tracking-wide">
            <Lock size={10} className="mr-1 shrink-0" /> จองโดย: {order.rider_name || "ไรเดอร์"}
          </div>
        )}
        
        {isShopee && order.status === 'รับงาน' && (
          <div className="text-center p-2 text-[10px] text-orange-600 font-black bg-orange-50 border border-orange-100 rounded-lg shadow-inner tracking-wide">
            📦 ออเดอร์ Shopee (รอมารับ)
          </div>
        )}
      </div>
      
    </div>
  );
}

export default React.memo(OrderCard);