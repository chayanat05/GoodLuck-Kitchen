"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ImagePlus, X, Loader2, Trash2, Filter, FolderPlus, Tag, Camera } from "lucide-react";
import Image from "next/image";


interface GalleryImage {
  id: string;
  image_url: string;
  title: string;
  category: string;
  uploader_name: string;
  created_at: string;
}

interface SharedGalleryProps {
  branchId?: string | null;
  userName: string;
  userRole: string;
  onClose: () => void;
}

export default function SharedGallery({ branchId = null, userName, userRole, onClose }: SharedGalleryProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("ทั้งหมด");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Full Screen View
  const [viewImage, setViewImage] = useState<string | null>(null);

  // 🌟 หุ้มด้วย useCallback เพื่อป้องกัน Warning
  const fetchGallery = useCallback(async () => {
    setIsLoading(true);
    
    // ดึงรูปภาพทั้งหมดมาโชว์เลย ไม่ต้องสนว่ามาจากสาขาไหนหรือส่วนกลาง
    const { data } = await supabase
      .from("shared_gallery")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setImages(data as GalleryImage[]);
      const uniqueCats = Array.from(new Set((data as GalleryImage[]).map(img => img.category)));
      setCategories(["เมนูอาหาร", "ประกาศ", ...uniqueCats.filter(c => c !== "เมนูอาหาร" && c !== "ประกาศ")]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]); // ใส่ Dependencies ตามที่ React แนะนำ

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setupFile(e.target.files[0]);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const pastedFile = items[i].getAsFile();
        if (pastedFile) setupFile(pastedFile);
        break;
      }
    }
  };

  const setupFile = (selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;
    setIsUploading(true);

    try {
      let finalCategory = selectedCategory;

      if (selectedCategory === "new" && customCategory.trim()) {
        finalCategory = customCategory.trim();
        await supabase.from("gallery_categories").insert([{ name: finalCategory }]);
        await fetchGallery(); // รอให้ดึงข้อมูลหมวดหมู่ใหม่เสร็จก่อน
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `gallery-${Date.now()}.${fileExt}`;
      const filePath = `shared/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("order-images").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("order-images").getPublicUrl(filePath);
      
      const { error: insertError } = await supabase.from("shared_gallery").insert([{
        image_url: publicUrl,
        title: title,
        category: finalCategory || "ทั่วไป",
        uploader_name: userName,
        branch_id: branchId
      }]);

      if (insertError) throw insertError;

      setIsModalOpen(false);
      resetForm();
      fetchGallery();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการอัปโหลด");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ต้องการลบรูปภาพนี้ใช่หรือไม่?")) return;
    await supabase.from("shared_gallery").delete().eq("id", id);
    fetchGallery();
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setTitle("");
    setSelectedCategory(categories.length > 0 ? categories[0] : "");
    setCustomCategory("");
  };

  const filteredImages = filterCategory === "ทั้งหมด" 
    ? images 
    : images.filter(img => img.category === filterCategory);

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-150 flex flex-col animate-in fade-in duration-300">
      <div className="bg-white px-6 py-4 flex justify-between items-center shrink-0 shadow-sm z-10">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <ImagePlus className="text-indigo-500" /> คลังรูปภาพ {branchId ? "ประจำสาขา" : "ส่วนกลาง"}
          </h2>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Share Photos & Announcements</p>
        </div>
        <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 rounded-full transition-colors cursor-pointer active:scale-90">
          <X size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="bg-white/95 px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
        <div className="relative w-full sm:w-64">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select 
            value={filterCategory} 
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all cursor-pointer"
          >
            <option value="ทั้งหมด">หมวดหมู่ทั้งหมด</option>
            {categories.map((cat, i) => (
              <option key={i} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white font-black text-sm rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <FolderPlus size={18} /> อัปโหลด / ถ่ายรูป
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 thin-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300">
            <Loader2 size={40} className="animate-spin mb-4" />
            <p className="font-bold tracking-widest uppercase text-xs">กำลังโหลดรูปภาพ...</p>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-slate-400/50">
              <ImagePlus size={32} />
            </div>
            <p className="font-bold text-sm">ยังไม่มีรูปภาพในหมวดหมู่นี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredImages.map((img) => (
              <div key={img.id} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl border border-white/20 transition-all group flex flex-col">
                <div 
                  className="aspect-square relative cursor-zoom-in overflow-hidden bg-slate-100"
                  onClick={() => setViewImage(img.image_url)}
                >
                  <Image src={img.image_url} fill sizes="(max-width: 768px) 50vw, 250px" className="object-cover group-hover:scale-110 transition-transform duration-500" alt={img.title} />
                </div>
                <div className="p-3 flex-1 flex flex-col bg-white">
                  <h3 className="text-sm font-black text-slate-800 line-clamp-1 mb-1">{img.title}</h3>
                  <div className="mt-1 mb-3">
                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest inline-flex items-center gap-1">
                      <Tag size={8} /> {img.category}
                    </span>
                  </div>
                  <div className="mt-auto flex justify-between items-end border-t border-slate-50 pt-2">
                    <span className="text-[9px] font-bold text-slate-400">โดย: {img.uploader_name}</span>
                    {(userRole === 'admin' || img.uploader_name === userName) && (
                      <button onClick={() => handleDelete(img.id)} className="text-rose-400 hover:text-white hover:bg-rose-500 p-1.5 rounded-lg transition-colors cursor-pointer active:scale-90">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-250 flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white w-full max-w-md rounded-4xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                <FolderPlus size={20} className="text-indigo-500" /> เพิ่มรูปลงคลัง
              </h3>
              <button onClick={() => {setIsModalOpen(false); resetForm();}} className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleUpload} className="p-6 space-y-5 bg-slate-50/50">
              <div 
                onPaste={handlePaste} 
                className={`relative aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all bg-white ${preview ? 'border-indigo-500' : 'border-slate-300'}`}
              >
                {preview ? (
                  <>
                    <Image src={preview} fill className="object-contain" alt="Preview" />
                    <button type="button" onClick={() => {setPreview(null); setFile(null);}} className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full hover:scale-110 transition-transform shadow-md cursor-pointer"><X size={14}/></button>
                  </>
                ) : (
                  <div className="text-center p-4 flex flex-col gap-3 w-full">
                    <div className="flex gap-2 justify-center w-full px-4">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-black text-xs hover:bg-indigo-100 transition-colors cursor-pointer flex flex-col items-center gap-1">
                        <ImagePlus size={24} /> คลังภาพ
                      </button>
                      <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-black text-xs hover:bg-slate-700 transition-colors cursor-pointer flex flex-col items-center gap-1 shadow-md shadow-slate-800/30">
                        <Camera size={24} /> กล้องสด
                      </button>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 tracking-widest uppercase">หรือ กด Ctrl+V เพื่อวางรูปภาพ</p>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide">ชื่อรูปภาพ (ใส่ให้ชัดเจน) *</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น สภาพร้านกะเช้า, เมนูใหม่..." className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-black text-slate-800 transition-all shadow-sm" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wide">เลือกหมวดหมู่</label>
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-bold text-slate-700 transition-all shadow-sm cursor-pointer mb-3">
                  {categories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                  <option value="new">+ เพิ่มหมวดหมู่ใหม่...</option>
                </select>
                
                {selectedCategory === "new" && (
                  <input required type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="พิมพ์ชื่อหมวดหมู่ที่ต้องการบันทึก..." className="w-full p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 text-xs font-black text-indigo-700 transition-all shadow-sm" />
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => {setIsModalOpen(false); resetForm();}} className="flex-1 py-4 bg-slate-200 text-slate-700 font-black text-xs rounded-2xl hover:bg-slate-300 transition-all cursor-pointer">
                  ยกเลิก
                </button>
                <button disabled={!file || isUploading || !title} type="submit" className="flex-[1.5] py-4 bg-indigo-600 text-white font-black text-xs rounded-2xl hover:bg-indigo-700 transition-all disabled:bg-slate-300 flex justify-center items-center gap-2 active:scale-95 shadow-lg shadow-indigo-600/30 cursor-pointer">
                  {isUploading ? <><Loader2 size={16} className="animate-spin" /> กำลังอัปโหลด...</> : "บันทึกรูปลงคลัง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewImage && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-300 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setViewImage(null)}>
          <button className="absolute top-6 right-6 text-white p-2 hover:bg-white/20 rounded-full transition-colors cursor-pointer">
            <X size={32} />
          </button>
          <div className="relative w-full max-w-5xl h-full max-h-[80vh] animate-in zoom-in-95">
            <Image src={viewImage} alt="Preview" fill sizes="100vw" className="object-contain rounded-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}