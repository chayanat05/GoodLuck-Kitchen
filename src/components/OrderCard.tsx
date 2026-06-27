// OrderCard.tsx
'use client'
import { Clock, Lock, MapPin, Edit2, ChefHat, PlayCircle, PackageCheck, Eye, MoreVertical, CheckCircle2, AlertCircle, XCircle, Trash2, ArrowRightLeft, Store, ImageIcon } from "lucide-react";
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { motion } from "framer-motion";
import Image from 'next/image';
import { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd"; 

export interface Order {
  slip_image?: string | null;
  id: string;
  order_number: string;
  job_type: "ร้าน" | "shopee" | string; 
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
  sort_index?: number;
  contact_link?: string;
  contact_source?: string; 
  delivery_fee?: number | null;
  is_deleted?: boolean;
  is_archived?: boolean;
}

interface OrderProps {
  order: Order;
  isCompact?: boolean;
  isUpdating?: boolean;
  userRole?: string; 
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onEdit?: (order: Order) => void; 
  onStart?: (id: string) => void;  
  onFinish?: (id: string) => void; 
  onViewDetails?: () => void; 
  onViewImages?: (urls: string[], startIndex: number) => void; 
  onDelete?: (id: string) => void; 
  onChangeStatusRequest?: (order: Order) => void;
  onSlipDrop?: (orderId: string, file: File) => void;
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

function OrderCard({
    order,
    isCompact,
    isUpdating,
    userRole,
    dragHandleProps,
    onEdit,
    onStart,
    onFinish,
    onViewDetails,
    onViewImages,
    onDelete,
    onChangeStatusRequest,
    onSlipDrop
}: OrderProps) {
  const isShopee = order.job_type === "shopee";
  const isLocked = !!order.rider_id;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
  }, [isMenuOpen]);

  const images = useMemo(() => {
    return order.image_url ? order.image_url.split(',').filter(Boolean) : [];
  }, [order.image_url]);
  const hasImages = images.length > 0;

  const theme = getCardTheme(order.status);

  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/') && onSlipDrop) {
        onSlipDrop(order.id, file);
      }
    }
  };

  useEffect(() => {
    const calculateTime = () => {
      const startTime = new Date(order.created_at).getTime();
      const now = new Date().getTime();
      setElapsedMinutes(Math.floor((now - startTime) / 60000));
    };

    calculateTime();
    const interval = setInterval(calculateTime, 30000); 
    return () => clearInterval(interval);
  }, [order.created_at]);

  const isKitchenLate = (order.status === "New" || order.status === "กำลังทำ") && elapsedMinutes >= 5;
  const isRiderLate = userRole !== "kitchen" && (order.status === "รับงาน") && elapsedMinutes >= 35;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      // 🌟 ใช้ max-h-full เพื่อให้การ์ดยืดได้สุดความสูงของบอร์ด และมีปุ่มค้างด้านล่างเสมอ
      className={`${isCompact ? 'p-1.5' : 'p-2'} rounded-3xl shadow-xl border-b-8 relative transition-all duration-300 flex flex-col w-full max-h-full min-h-56 ${theme.bg} ${isDragOver ? 'ring-4 ring-white scale-[1.01]' : '' }`}
    >
      
      {/* 📍 ส่วนที่ 1: หัวการ์ด (Fixed) */}
      <div {...dragHandleProps} className={`shrink-0 flex justify-between items-start ${isCompact ? 'mb-2' : 'mb-3'} gap-2 border-b border-white/10 pb-2 ${dragHandleProps ? 'cursor-grab active:cursor-grabbing' : ''}`}>
        <div className="flex flex-wrap gap-2 items-center pointer-events-none">
          <span className={`${isCompact ? 'text-base px-2 py-1' : 'text-lg px-2.5 py-1'} font-black rounded-lg bg-white/90 text-slate-800 tracking-wider shadow-sm`}>
            {isShopee ? (String(order.order_number).startsWith('#') ? order.order_number : `#${order.order_number}`) : order.order_number}
          </span>
          
          {order.status !== 'ส่งแล้ว/เสร็จ' && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-black text-[10px] shadow-sm animate-in fade-in ${
              isKitchenLate || isRiderLate 
              ? "bg-rose-500 text-white animate-pulse" 
              : elapsedMinutes >= (order.status === "รับงาน" ? 30 : 4)
              ? "bg-amber-400 text-slate-900" 
              : "bg-black/20 text-white" 
            }`}>
              <Clock size={10} />
              {elapsedMinutes} นาที
              {(isKitchenLate || isRiderLate) && " ⚠️ เกินกำหนด!"}
            </div>
          )}

          <span className={`text-sm font-black ${isCompact ? 'px-1.5 py-0.5' : 'px-2.5 py-1'} rounded-md uppercase tracking-wider border ${theme.badgeBg}`}>
            {order.job_type}
          </span>
          <span className={`text-sm font-black ${isCompact ? 'px-1.5 py-0.5' : 'px-2.5 py-1'} rounded-md uppercase tracking-wider border ${theme.badgeBg}`}>
            {order.status === 'รับงาน' ? 'ทำอาหารเสร็จแล้ว' : order.status}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 relative" ref={menuRef}>
          {onViewDetails && !isCompact && (
            <button onClick={(e) => { e.stopPropagation(); onViewDetails(); }} className={`p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/20 ${theme.text}`} title="ดูรายละเอียด">
              <Eye size={16} strokeWidth={2.5}/>
            </button>
          )}
          
          {(userRole === 'admin' || userRole === 'superadmin') && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className={`p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/20 ${theme.text} ${isMenuOpen ? 'bg-white/20' : ''}`} title="เมนูเพิ่มเติม">
                <MoreVertical size={16} strokeWidth={2.5} />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right flex flex-col">
                  {onChangeStatusRequest && (
                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onChangeStatusRequest(order); }} className="w-full text-left px-4 py-3 text-base font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2 transition-colors border-b border-slate-50">
                      <ArrowRightLeft size={16} /> เปลี่ยนสถานะออเดอร์
                    </button>
                  )}
                  {onEdit && (
                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onEdit(order); }} className="w-full text-left px-4 py-3 text-base font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors border-b border-slate-50">
                      <Edit2 size={16} /> แก้ไขข้อมูลออเดอร์
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onDelete(order.id); }} className="w-full text-left px-4 py-3 text-base font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors">
                      <Trash2 size={16} /> ลบออเดอร์นี้
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 📍 ส่วนที่ 2: เนื้อหาตรงกลาง (Scroll ได้! เมนูยาว/สลิปยาวจะไม่ดันปุ่มให้ตกขอบ) */}
      <div className="flex-1 overflow-y-auto thin-scrollbar flex flex-col pr-1 gap-2 pb-2">
        {order.menu && (
          <div className={`${isCompact ? 'text-base' : 'text-lg md:text-xl'} font-black whitespace-pre-line leading-relaxed shrink-0 ${theme.text}`}>
            {order.menu}
          </div>
        )}

        {hasImages && (
          <div className={`flex flex-col gap-2 shrink-0 items-center w-full`}>
            {images.map((url, i) => (
              <div key={i} onClick={(e) => { e.stopPropagation(); if (onViewImages) onViewImages(images, i); else onViewDetails?.(); }} className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/20 shadow-sm cursor-pointer group/img bg-black/10">
                <Image src={url} fill sizes="(max-width: 768px) 100vw, 33vw" alt={`Order attachment ${i}`} className="object-cover block group-hover/img:scale-105 transition-transform duration-500" />
              </div>
            ))}
          </div>
        )}

        {order.details && <p className={`text-sm font-medium shrink-0 leading-relaxed p-2.5 rounded-xl border border-white/10 bg-black/10 backdrop-blur-sm ${theme.subText}`}>{order.details}</p>}
      </div>

      {/* 📍 ส่วนที่ 3: ท้ายการ์ด (Fixed ล็อกติดก้นการ์ดเสมอ!) */}
      <div className="shrink-0 flex flex-col gap-2 pt-3 border-t border-white/10 mt-1">
        
        {/* ที่อยู่ */}
        {order.address && (
          <div className={`flex items-start text-[10px] md:text-sm p-2.5 rounded-xl border border-white/10 bg-black/10 backdrop-blur-sm ${theme.text}`}>
            <MapPin size={14} className="mr-1.5 mt-0.5 shrink-0" />
            <span className="leading-relaxed font-medium">{order.address}</span>
          </div>
        )}

        {/* เวลาและราคา */}
        <div className={`flex flex-wrap items-center justify-between mb-1 ${theme.subText}`}>
          <div className="flex items-center text-sm font-bold tracking-wide shrink-0">
            <Clock size={12} className="mr-1.5" />
            {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
          </div>
          {!isShopee && (
            <div className="flex items-center gap-2">
              <span className={`font-black text-lg flex items-baseline ${theme.text}`}>
                ฿{order.total_price}
                {order.delivery_fee ? <span className="text-sm ml-1 opacity-80">(รวมค่าส่งแล้ว ฿{order.delivery_fee})</span> : null}
              </span>
              {order.payment_method && !isCompact && (
                <span className={`text-sm font-black uppercase px-2 py-0.5 rounded shadow-sm border ${theme.badgeBg}`}>
                  {order.payment_method}
                </span>
              )}
            </div>
          )}
        </div>

        {order.status === "New" && onStart && (
  <button
    disabled={isUpdating}
    onClick={() => {
      if (isUpdating) return;
      onStart(order.id);
    }}
    className={`w-full ${
      isCompact ? "py-2.5 text-sm" : "py-3 text-sm"
    } rounded-xl font-black transition-all duration-300 flex justify-center items-center gap-1.5 shadow-lg uppercase tracking-wide border-b-4 border-transparent
    ${
      isUpdating
        ? "bg-gray-400 text-white opacity-70 cursor-not-allowed"
        : `${theme.btnBg} cursor-pointer active:scale-95 active:border-none`
    }`}
  >
    <PlayCircle size={16} className="shrink-0" />

    <span className="truncate">
      {isUpdating
        ? "กำลังบันทึก..."
        : isShopee
        ? "รับงาน / เตรียมของ"
        : "คลิกเพื่อเริ่มทำอาหาร"}
    </span>
  </button>
)}

        {order.status === "กำลังทำ" && onFinish && (
  <button
    disabled={isUpdating}
    onClick={() => {
      if (isUpdating) return;
      onFinish(order.id);
    }}
    className={`w-full ${
      isCompact ? "py-2.5 text-sm" : "py-3 text-sm"
    } rounded-xl font-black transition-all duration-300 flex justify-center items-center gap-1.5 shadow-lg uppercase tracking-wide border-b-4 border-transparent
    ${
      isUpdating
        ? "bg-gray-400 text-white opacity-70 cursor-not-allowed"
        : `${theme.btnBg} cursor-pointer active:scale-95 active:border-none`
    }`}
  >
    {isShopee ? (
      <PackageCheck size={16} className="shrink-0" />
    ) : (
      <ChefHat size={16} className="shrink-0" />
    )}

    <span className="truncate">
      {isUpdating
        ? "กำลังบันทึก..."
        : isShopee
        ? "ส่งมอบให้ขนส่งแล้ว"
        : "คลิกเมื่อทำอาหารเสร็จ"}
    </span>
  </button>
)}

        {isLocked && (
          <div className={`flex items-center justify-center py-2.5 rounded-xl text-sm font-black shadow-inner tracking-wide bg-black/10 border border-white/10 ${theme.text}`}>
            <Lock size={12} className="mr-1.5 shrink-0" /> <span className="truncate">จองโดย: {order.rider_name || "ไรเดอร์"}</span>
          </div>
        )}

        {/* แหล่งที่มา */}
        {(userRole === 'admin' || userRole === 'superadmin') && order.contact_source && order.job_type !== 'shopee' && (
          <span className={`flex items-center justify-center gap-1 text-[14px] font-black px-2 py-1.5 rounded-xl uppercase tracking-wider border bg-black/20 text-white border-white/10 shadow-inner`}>
            <Store size={14} className="opacity-80" />
            {order.contact_source}
          </span>
        )}

        {/* สลิป */}
{order.slip_image && (
  <div className="max-h-80 overflow-y-auto mt-2 pt-2 border-t border-white/10">
    <div className="text-sm font-black uppercase text-white/90 mb-3 flex items-center gap-1.5">
      <ImageIcon size={16} />
      หลักฐานการโอน (สลิป)
    </div>

    <div className="flex flex-col gap-3">
      {order.slip_image
        .split(',')
        .filter(Boolean)
        .map((url, i) => (
          <div
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              onViewImages?.(
                order.slip_image!.split(',').filter(Boolean),
                i
              );
            }}
            className="relative w-full rounded-xl overflow-hidden border border-white/20 shadow-md cursor-zoom-in"
          >
            <Image
  src={url}
  alt={`Slip ${i}`}
  width={1200}
  height={1600}
  className="w-full h-auto"
/>
          </div>
      ))}
    </div>
  </div>
)}

        {isShopee && order.status === 'รับงาน' && (
          <div className={`text-center py-2.5 text-sm font-black rounded-xl shadow-inner tracking-wide bg-black/10 border border-white/10 ${theme.text}`}>
            📦 ออเดอร์ Shopee (รอมารับ)
          </div>
        )}
      </div>

    </motion.div>
  );
}

export default React.memo(OrderCard);