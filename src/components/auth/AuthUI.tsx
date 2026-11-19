'use client'
// ชุด UI กลางสำหรับหน้า login / register / forgot-password / reset-password
// ใช้สีแบรนด์ (เหลืองอำพันจากโลโก้ม้า) + slate ให้ทุกหน้าดูเป็นชุดเดียวกัน

import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import Image from 'next/image';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Loader2, type LucideIcon } from 'lucide-react';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-slate-100 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <main className="w-full max-w-md lg:max-w-4xl">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-200/70 overflow-hidden lg:grid lg:grid-cols-[5fr_6fr]">
          {/* แผงแบรนด์: จอใหญ่อยู่ซ้าย / มือถือเป็นแถบบนการ์ด */}
          <aside className="relative bg-amber-400 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.14] bg-[repeating-linear-gradient(115deg,#fff_0_2px,transparent_2px_22px)]" aria-hidden />

            {/* มือถือ / แท็บเล็ต */}
            <div className="relative flex items-center gap-3 px-6 py-5 lg:hidden">
              <BrandLogo size={44} />
              <BrandName />
            </div>

            {/* จอใหญ่ */}
            <div className="relative hidden lg:flex flex-col justify-between h-full p-10">
              <BrandLogo size={88} />
              <div>
                <BrandName large />
                <p className="mt-4 text-sm font-medium text-slate-900/70 leading-relaxed max-w-xs">
                  ทุกออเดอร์ส่งถึงมือลูกค้าได้ เพราะทีมเรา 💛
                </p>
              </div>
            </div>
          </aside>

          {/* ฟอร์ม */}
          <section className="p-6 sm:p-8 lg:p-12 lg:min-h-[520px] flex flex-col justify-center">
            <div className="mb-6">
              <h1 className="text-2xl font-black text-slate-900">{title}</h1>
              {subtitle && <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{subtitle}</p>}
            </div>
            {children}
          </section>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
      </main>
    </div>
  );
}

function BrandLogo({ size }: { size: number }) {
  return (
    <Image
      src="/riderlogo_192x192.png"
      alt=""
      width={size}
      height={size}
      priority
      className="rounded-2xl ring-4 ring-white/50 shadow-md shrink-0"
    />
  );
}

function BrandName({ large = false }: { large?: boolean }) {
  return (
    <div className="leading-tight">
      <div className={`font-black text-slate-900 tracking-tight ${large ? 'text-3xl' : 'text-lg'}`}>GoodLuck Kitchen</div>
      <div className={`font-bold text-slate-900/65 ${large ? 'text-sm mt-1' : 'text-xs'}`}>ระบบจัดการร้าน &amp; ไรเดอร์</div>
    </div>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: LucideIcon;
  hint?: ReactNode;
  invalid?: boolean;
};

const inputBase =
  'w-full h-12 pl-11 rounded-xl border bg-slate-50 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:bg-white focus:ring-4 disabled:opacity-60';

function inputTone(invalid?: boolean) {
  return invalid
    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10'
    : 'border-slate-200 hover:border-slate-300 focus:border-amber-500 focus:ring-amber-400/20';
}

export function Field({ label, icon: Icon, hint, invalid, className = '', ...props }: FieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <Icon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input id={id} aria-invalid={invalid || undefined} className={`${inputBase} pr-4 ${inputTone(invalid)} ${className}`} {...props} />
      </div>
      {hint && <p className={`mt-1.5 text-xs ${invalid ? 'text-rose-600' : 'text-slate-500'}`}>{hint}</p>}
    </div>
  );
}

export function PasswordField({ label, icon: Icon, hint, invalid, className = '', ...props }: FieldProps) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <Icon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          aria-invalid={invalid || undefined}
          className={`${inputBase} pr-12 ${inputTone(invalid)} ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && <p className={`mt-1.5 text-xs ${invalid ? 'text-rose-600' : 'text-slate-500'}`}>{hint}</p>}
    </div>
  );
}

export function AuthAlert({ type, children }: { type: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: { box: 'bg-rose-50 border-rose-200 text-rose-700', Icon: AlertCircle },
    success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-800', Icon: CheckCircle2 },
    info: { box: 'bg-amber-50 border-amber-200 text-amber-900', Icon: Info },
  }[type];
  const { Icon } = styles;
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`mb-5 flex items-start gap-2.5 rounded-xl border p-3.5 text-sm font-medium leading-relaxed animate-in fade-in slide-in-from-top-1 ${styles.box}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function SubmitButton({
  loading,
  loadingText,
  children,
  disabled,
}: {
  loading: boolean;
  loadingText: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 hover:bg-slate-800 active:scale-[0.99] transition disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
    >
      {loading ? (
        <>
          <Loader2 size={18} className="animate-spin" /> {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function AuthLoading({ text = 'กำลังเชื่อมต่อระบบ...' }: { text?: string }) {
  return (
    <div className="min-h-dvh bg-slate-100 flex flex-col items-center justify-center gap-4">
      <Image src="/riderlogo_192x192.png" alt="" width={64} height={64} priority className="rounded-2xl shadow-md animate-pulse" />
      <p className="text-sm font-bold text-slate-500 flex items-center gap-2">
        <Loader2 size={16} className="animate-spin" /> {text}
      </p>
    </div>
  );
}
