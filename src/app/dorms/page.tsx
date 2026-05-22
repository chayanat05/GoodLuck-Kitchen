"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import JobMap from "@/components/JobMap"; 
import { 
  ArrowLeft, Search, MapPin, Plus, X, 
  ExternalLink, ImagePlus, 
  Loader2, Trash2, ImageIcon, Camera, Edit, Lock, Key
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface DormLocation {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  image_url: string | null;
}

export default function DormDatabasePage() {
  const router = useRouter();
  const [dorms, setDorms] = useState<DormLocation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🌟 User Role State
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // 🌟 Delete Confirmation State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [adminPassInput, setAdminPassInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    lat: 16.248130,
    lng: 103.242206,
    image_url: "" as string | null
  });

  useEffect(() => {
    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setUserRole(profile?.role || 'rider');
      }
      fetchDorms();
    };
    initPage();
  }, []);

  const fetchDorms = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("saved_locations")
      .select("id, name, address, lat, lng, image_url")
      .order("name");
      
    if (data) setDorms(data as DormLocation[]);
    setIsLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `dorm-${Math.random()}.${fileExt}`;
    const filePath = `dorms/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('order-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('order-images').getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, image_url: data.publicUrl }));
      setPreviewUrl(data.publicUrl);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      alert("อัปโหลดรูปภาพไม่สำเร็จ");
    } finally {
      setIsUploading(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: "", address: "", lat: 16.248130, lng: 103.242206, image_url: null });
    setPreviewUrl(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dorm: DormLocation) => {
    setEditingId(dorm.id);
    setFormData({
      name: dorm.name,
      address: dorm.address || "",
      lat: Number(dorm.lat),
      lng: Number(dorm.lng),
      image_url: dorm.image_url
    });
    setPreviewUrl(dorm.image_url);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const payload = editingId ? { id: editingId, ...formData } : formData;

    const { error } = await supabase
      .from("saved_locations")
      .upsert([payload]);

    if (!error) {
      setIsModalOpen(false);
      setPreviewUrl(null);
      fetchDorms();
    } else {
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
    setIsSubmitting(false);
  };

  const handleConfirmDelete = async () => {
    if (userRole !== "superadmin" && adminPassInput !== "8888") {
      alert("รหัสผ่านไม่ถูกต้อง! ไม่สามารถลบได้");
      return;
    }
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("saved_locations").delete().eq("id", deleteId);
      if (error) throw error;
      setDeleteId(null);
      setAdminPassInput("");
      setSearchQuery(""); 
      fetchDorms();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการลบ");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDorms = dorms.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans pb-20">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4 w-full">
            <button 
              onClick={() => router.back()} 
              className="p-2 bg-white rounded-full shadow-sm border border-slate-200 hover:bg-slate-100 transition-colors active:scale-95 cursor-pointer"
            >
              <ArrowLeft size={20} className="text-slate-500" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
                <Camera className="text-indigo-500" size={28} /> Dormitory Bank
              </h1>
              <p className="text-xs font-bold text-slate-400 mt-1">คลังรูปและพิกัดหอพักสารคาม (ระบบจัดการโดย {userRole})</p>
            </div>
          </div>
          <p className="text-x font-bold text-slate-800 mt-1">กรุณาระบุชื่อตึก/ซอยให้ชัดเจน</p>
          <button 
            onClick={openAddModal}
            className="w-full md:w-auto px-6 py-3 bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
          >
            <Plus size={20} /> เพิ่มหอพัก
          </button>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="ค้นหาชื่อหอพัก..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-3xl shadow-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
          {isLoading ? (
            <div className="col-span-full py-20 text-center text-slate-400 font-bold flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-indigo-500" size={40} />
              <p className="tracking-widest uppercase text-[10px]">Loading Database...</p>
            </div>
          ) : filteredDorms.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400 font-bold bg-white rounded-4xl border-2 border-dashed border-slate-200 uppercase tracking-widest text-xs">
              ไม่พบข้อมูลหอพัก
            </div>
          ) : filteredDorms.map((dorm) => (
            <div key={dorm.id} className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full">
              <div className="relative aspect-video bg-slate-100 overflow-hidden cursor-zoom-in" onClick={() => dorm.image_url && setSelectedFullImage(dorm.image_url)}>
                {dorm.image_url ? (
                  <Image src={dorm.image_url} alt={dorm.name} fill sizes="(max-width: 768px) 100vw, 300px" className="object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                    <ImageIcon size={48} strokeWidth={1} />
                    <span className="text-[10px] font-black uppercase tracking-widest mt-2">No Photo</span>
                  </div>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-lg font-black text-slate-800 mb-1 line-clamp-1">{dorm.name}</h3>
                <p className="text-slate-500 text-xs font-medium mb-4 flex items-start gap-1.5 h-8 line-clamp-2">
                  <MapPin size={12} className="shrink-0 mt-0.5 text-indigo-400" /> {dorm.address || 'ไม่ได้ระบุจุดสังเกต'}
                </p>
                
                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    ID: {dorm.id.slice(0, 5)}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <a 
                      href={`http://googleusercontent.com/maps.google.com/maps?q=${dorm.lat},${dorm.lng}`}
                      target="_blank" rel="noreferrer"
                      className="p-2 bg-slate-50 text-slate-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all active:scale-90"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <button 
                      onClick={() => openEditModal(dorm)}
                      className="p-2 bg-slate-50 text-slate-500 hover:bg-indigo-500 hover:text-white rounded-xl transition-all active:scale-90 cursor-pointer"
                    >
                      <Edit size={16} />
                    </button>

                    {(userRole === 'admin' || userRole === 'superadmin') && (
                      <button 
                        onClick={() => { setDeleteId(dorm.id); setDeleteConfirmName(dorm.name); }}
                        className="p-2 bg-slate-50 text-slate-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all active:scale-90 cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-200 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Lock size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800 text-center mb-2">ยืนยันการลบ</h3>
            <p className="text-sm text-slate-500 text-center mb-6 font-bold">
              กรุณาใส่รหัสผ่านแอดมินเพื่อลบ <br/>
              <span className="text-rose-600">&quot;{deleteConfirmName}&quot;</span>
            </p>
            <div className="relative mb-6">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="password"
                autoComplete="new-password"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-rose-500 transition-all font-black text-center tracking-widest"
                placeholder="รหัสผ่านยืนยัน"
                value={adminPassInput}
                onChange={e => setAdminPassInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setDeleteId(null); setAdminPassInput(""); }} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl cursor-pointer hover:bg-slate-200">ยกเลิก</button>
              <button 
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 bg-rose-600 text-white font-black rounded-xl shadow-lg shadow-rose-200 flex justify-center items-center gap-2 cursor-pointer hover:bg-rose-700 disabled:bg-rose-300"
              >
                {isDeleting ? <Loader2 className="animate-spin" size={18} /> : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedFullImage && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-300 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedFullImage(null)}>
          <button className="absolute top-6 right-6 text-white p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer">
            <X size={32} />
          </button>
          <div className="relative w-full max-w-5xl h-full max-h-[80vh]">
            <Image src={selectedFullImage} alt="Preview" fill sizes="100vw" className="object-contain rounded-2xl" />
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-150 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
                {editingId ? <Edit className="text-indigo-500" /> : <Plus className="text-indigo-500" />} 
                {editingId ? "Edit Dormitory" : "New Dormitory"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors active:scale-90 cursor-pointer">
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto thin-scrollbar p-6 lg:p-8 bg-slate-50/50">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <form id="dorm-form" onSubmit={handleSave} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Photo Preview</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative aspect-video rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden ${previewUrl ? 'border-indigo-500 bg-white' : 'border-slate-300 bg-slate-100 hover:bg-white hover:border-indigo-400'}`}
                    >
                      {previewUrl ? (
                        <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                      ) : (
                        <>
                          {isUploading ? <Loader2 className="animate-spin text-indigo-500" size={32} /> : <ImagePlus size={40} className="text-slate-400" />}
                          <span className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">{isUploading ? 'Uploading...' : 'Tap to Upload'}</span>
                        </>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Dormitory Name *</label>
                      <input 
                        required
                        className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-800 transition-all shadow-sm"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="กรอกชื่อหอพัก..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">จุดสังเกต / ซอย</label>
                      <input 
                        className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-800 transition-all shadow-sm"
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        placeholder="เช่น ซอยตรงข้ามเซเว่น..."
                      />
                    </div>
                    
                    {/* 🌟 เพิ่มช่องกรอกพิกัดแบบ Manual */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Latitude</label>
                        <input 
                          type="number" step="any"
                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-800 transition-all shadow-sm"
                          value={formData.lat}
                          onChange={e => setFormData({...formData, lat: parseFloat(e.target.value) || 0})}
                          placeholder="เช่น 16.248130"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Longitude</label>
                        <input 
                          type="number" step="any"
                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-800 transition-all shadow-sm"
                          value={formData.lng}
                          onChange={e => setFormData({...formData, lng: parseFloat(e.target.value) || 0})}
                          placeholder="เช่น 103.242206"
                        />
                      </div>
                    </div>
                  </div>
                </form>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Pin Location</label>
                  <div className="h-100 rounded-3xl overflow-hidden border-2 border-slate-200 shadow-sm relative">
                    <JobMap 
                      lat={formData.lat}
                      lng={formData.lng}
                      onPinChange={(lat, lng) => setFormData({...formData, lat, lng})}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-white flex gap-3 shrink-0">
              <button 
                type="button" onClick={() => setIsModalOpen(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                type="submit" form="dorm-form" disabled={isSubmitting || isUploading}
                className="flex-2 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-indigo-600 transition-all cursor-pointer shadow-lg shadow-indigo-200 active:scale-95 disabled:bg-slate-300 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
                {editingId ? "Update Dorm" : "Save to Database"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .thin-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .thin-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
        .thin-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
      `}</style>
    </div>
  );
}