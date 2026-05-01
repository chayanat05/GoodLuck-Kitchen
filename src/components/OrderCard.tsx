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
    // 🌟 3. เปลี่ยนจาก h-full เป็น h-max เพื่อให้การ์ดยืดตามข้อมูลข้างใน ไม่ถูกบีบจนพัง
    <div className={`p-3 md:p-4 mb-2 bg-white rounded-2xl shadow-sm border-l-[5px] group relative transition-all duration-300 hover:shadow-lg ${isShopee ? "border-l-orange-500" : isCustomJob ? "border-l-purple-500" : "border-l-blue-500"} border border-slate-200 flex flex-col h-max min-h-56`}>
      
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 tracking-wider shadow-inner">
            {isShopee 
              ? (order.order_number.startsWith('#') ? order.order_number : `#${order.order_number}`) 
              : order.order_number}
          </span>
          
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${isShopee ? "bg-orange-50 text-orange-600 border border-orange-100" : isCustomJob ? "bg-purple-50 text-purple-600 border border-purple-100" : "bg-blue-50 text-blue-600 border border-blue-100"}`}>
            {order.job_type}
          </span>

          {onViewDetails && (
            <button 
              onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
              className="bg-white text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md shadow-sm text-[10px] font-black flex items-center hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 cursor-pointer"
            >
              <Eye size={12} className="mr-1" /> ดูเต็มๆ
            </button>
          )}
        </div>

        <button 
          onClick={() => onEdit?.(order)} 
          className="text-slate-300 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
        >
          <Edit2 size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* 🌟 4. บังคับให้เมนูโชว์แค่ 3 บรรทัด (line-clamp-3) เพื่อไม่ให้การ์ดยาวเกินไปจนน่าเกลียด */}
      {order.menu && (
        <div className="mb-2 text-sm text-slate-800 font-bold whitespace-pre-line leading-relaxed line-clamp-3">
          {order.menu}
        </div>
      )}

      {/* บังคับหมายเหตุโชว์แค่ 2 บรรทัด (line-clamp-2) */}
      {order.details && <p className="text-[11px] text-slate-500 mb-3 font-medium line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">{order.details}</p>}

      {hasImages && (
        <div 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (onViewImages) onViewImages(images, 0); 
            else onViewDetails?.(); 
          }}
          className="mb-3 mt-1 relative h-24 w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer group/img shrink-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={images[0]} 
            alt="Order attachment" 
            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" 
          />
          
          {images.length > 1 && (
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center">
              <span className="text-white font-black text-sm flex items-center drop-shadow-md">
                <ImageIcon size={16} className="mr-1.5 opacity-90" /> +{images.length - 1}
              </span>
            </div>
          )}
        </div>
      )}

      {order.address && (
        <div className="flex items-start text-xs text-slate-600 mb-4 bg-red-50/50 p-2.5 rounded-xl border border-red-100/50">
          <MapPin size={14} className="mr-1.5 mt-0.5 shrink-0 text-red-500" />
          <span className="line-clamp-2 leading-relaxed font-medium">{order.address}</span>
        </div>
      )}

      {/* เส้นแบ่งล่าง จะถูกดันลงไปชิดด้านล่างอัตโนมัติด้วย mt-auto */}
      <div className={`flex flex-wrap items-center justify-between mb-3 border-t border-slate-100 pt-3 gap-2 mt-auto`}>
        <div className="flex items-center text-[11px] text-slate-400 font-bold tracking-wide shrink-0">
          <Clock size={12} className="mr-1.5" />
          {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
        </div>
        {!isShopee && (
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-800 text-sm">฿{order.total_price}</span>
            {order.payment_method && (
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm ${order.payment_method === 'โอน' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {order.payment_method}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 shrink-0">
        {order.status === 'New' && !isCustomJob && onStart && (
          <button 
            onClick={() => onStart(order.id)}
            className="w-full py-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 rounded-xl text-[11px] font-black transition-all duration-300 flex justify-center items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 uppercase tracking-wide"
          >
            <PlayCircle size={14} className="shrink-0" />
            <span className="truncate">{isShopee ? 'เตรียมของ (Shopee)' : 'เริ่มทำอาหาร'}</span>
          </button>
        )}

        {order.status === 'กำลังทำ' && !isCustomJob && onFinish && (
          <button 
            onClick={() => onFinish(order.id)}
            className={`w-full py-2.5 rounded-xl text-[11px] font-black transition-all duration-300 flex justify-center items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 uppercase tracking-wide ${
              isShopee 
              ? 'bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700' 
              : 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700'
            }`}
          >
            {isShopee ? <PackageCheck size={14} className="shrink-0"/> : <ChefHat size={14} className="shrink-0" />}
            <span className="truncate">{isShopee ? 'ส่งขนส่งแล้ว' : 'ทำเสร็จแล้ว'}</span>
          </button>
        )}

        {isCustomJob && order.status !== 'ส่งแล้ว/เสร็จ' && (
          <div className="text-center py-2 text-[10px] text-purple-600 font-black bg-purple-50 border border-purple-100 rounded-xl shadow-inner tracking-wide">
            🛵 ไรเดอร์ดำเนินการเอง
          </div>
        )}

        {isLocked && !isCustomJob && (
          <div className="flex items-center justify-center py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-[10px] font-black shadow-inner tracking-wide">
            <Lock size={12} className="mr-1.5 shrink-0" /> <span className="truncate">จองโดย: {order.rider_name || "ไรเดอร์"}</span>
          </div>
        )}
        
        {isShopee && order.status === 'รับงาน' && (
          <div className="text-center py-2 text-[10px] text-orange-600 font-black bg-orange-50 border border-orange-100 rounded-xl shadow-inner tracking-wide">
            📦 Shopee (รอมารับ)
          </div>
        )}
      </div>
      
    </div>
  );
}

export default React.memo(OrderCard);