'use client'
// หน้ารออนุมัติ: ล็อกอินค้างไว้ แล้วคอยเช็คสถานะ พอแอดมินอนุมัติจะพาเข้าหน้าของตัวเองทันที
// พนักงานไม่ต้องกลับไปพิมพ์เข้าสู่ระบบใหม่

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, LogOut, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { resolveHomePath } from '@/lib/homePath';
import { AuthShell, AuthAlert, AuthLoading } from '@/components/auth/AuthUI';

const POLL_MS = 5000;

export default function PendingPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [approved, setApproved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const doneRef = useRef(false);

  const check = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId || doneRef.current) return;
    setIsChecking(true);
    try {
      const result = await resolveHomePath(userId);
      if ('error' in result) {
        setErrorMsg(result.error);
      } else if (result.path !== '/pending') {
        doneRef.current = true;
        setApproved(true);
        setTimeout(() => router.replace(result.path), 1200);
      }
    } finally {
      setIsChecking(false);
    }
  }, [router]);

  // โหลดครั้งแรก: ต้องมี session (ล็อกอินค้างจากตอนสมัคร / เข้าสู่ระบบ)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      userIdRef.current = session.user.id;
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle();
      setNickname(profile?.username || '');
      setIsLoading(false);
      check();
    })();
  }, [router, check]);

  // เช็คซ้ำทุก 5 วินาที และทันทีที่กลับมาเปิดแอป
  useEffect(() => {
    if (isLoading) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') check();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isLoading, check]);

  const handleLogout = async () => {
    doneRef.current = true;
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (isLoading) return <AuthLoading text="กำลังตรวจสอบสถานะบัญชี..." />;

  if (approved) {
    return (
      <AuthShell title="อนุมัติแล้ว 🎉" subtitle="กำลังพาเข้าสู่ระบบ...">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={32} />
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="รอแอดมินอนุมัติ" subtitle={nickname ? `สวัสดี ${nickname} 👋` : undefined}>
      {errorMsg && <AuthAlert type="error">{errorMsg}</AuthAlert>}

      <div className="flex flex-col items-center text-center">
        <div className="relative w-16 h-16 mb-4">
          <span className="absolute inset-0 rounded-2xl bg-amber-300/60 animate-ping" aria-hidden />
          <div className="relative w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock size={30} />
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          บอกแอดมินว่าสมัครด้วยชื่อ <b className="text-slate-900">{nickname || 'ของคุณ'}</b>
          <br />
          พออนุมัติแล้ว หน้านี้จะพาเข้าใช้งานให้เอง ไม่ต้องเข้าสู่ระบบใหม่
        </p>
        <p className="mt-3 text-xs text-slate-400 flex items-center gap-1.5" aria-live="polite">
          <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} /> ตรวจสอบสถานะอัตโนมัติ
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={check}
          disabled={isChecking}
          className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} /> เช็คสถานะตอนนี้
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full h-11 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <LogOut size={16} /> ออกจากระบบ
        </button>
      </div>
    </AuthShell>
  );
}
