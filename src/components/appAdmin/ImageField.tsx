"use client";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadMedia } from "@/lib/mediaUpload";
import { mediaUrl } from "@/lib/media";

/** ช่องเลือกรูป → ย่อ + อัปโหลด R2 ทันที แล้วคืนตำแหน่งไฟล์ (key) */
export default function ImageField({
  label,
  value,
  onChange,
  aspect = "aspect-square",
  className = "",
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  aspect?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadMedia(file, "store"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className={className}>
      <p className="mb-1.5 text-xs font-bold text-slate-500">{label}</p>
      <div className={`relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 ${aspect}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(value)} alt="" className="h-full w-full object-cover" />
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-500">
            <ImagePlus size={26} />
            <span className="text-xs font-bold">เลือกรูป</span>
          </button>
        )}
        {value && !busy && (
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-white/90 px-2 py-1 text-xs font-bold text-slate-700 shadow">
              เปลี่ยน
            </button>
            <button type="button" aria-label="ลบรูป" onClick={() => onChange(null)} className="rounded-lg bg-white/90 p-1 text-red-500 shadow">
              <X size={14} />
            </button>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="animate-spin text-blue-500" />
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs font-bold text-red-500">{error}</p>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
