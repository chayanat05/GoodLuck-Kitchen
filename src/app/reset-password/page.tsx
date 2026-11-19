'use client'
import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck, LinkIcon, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authErrorToThai } from '@/lib/authErrors';
import { AuthShell, AuthAlert, AuthLoading, PasswordField, SubmitButton } from '@/components/auth/AuthUI';

const MIN_PASSWORD = 6;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // ลิงก์ในอีเมลจะสร้าง session ชั่วคราวให้ (event PASSWORD_RECOVERY)
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setIsSessionActive(true);
        setIsChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setIsSessionActive(true);
      setIsChecking(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < MIN_PASSWORD) return setErrorMsg(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`);
    if (password !== confirmPassword) return setErrorMsg('รหัสผ่านทั้งสองช่องไม่ตรงกัน');

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrorMsg(authErrorToThai(error, 'เปลี่ยนรหัสผ่านไม่สำเร็จ'));
      return;
    }

    setSuccess(true);
    // ออกจากระบบแล้วให้ล็อกอินใหม่ด้วยรหัสผ่านใหม่
    setTimeout(async () => {
      await supabase.auth.signOut();
      router.replace('/login');
    }, 2500);
  };

  if (isChecking) return <AuthLoading text="กำลังตรวจสอบลิงก์..." />;

  const backToLogin = (
    <Link href="/login" className="inline-flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900">
      <ArrowLeft size={16} /> กลับไปหน้าเข้าสู่ระบบ
    </Link>
  );

  if (!isSessionActive) {
    return (
      <AuthShell title="ลิงก์หมดอายุ" footer={backToLogin}>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
            <LinkIcon size={30} />
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            ลิงก์ตั้งรหัสผ่านนี้ใช้ไม่ได้แล้ว (หมดอายุ หรือถูกใช้ไปแล้ว)
            <br />
            กรุณาขอลิงก์ใหม่อีกครั้ง
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="mt-6 w-full h-12 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center hover:bg-slate-800 transition"
        >
          ขอลิงก์ใหม่
        </Link>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell title="เปลี่ยนรหัสผ่านแล้ว">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
            <ShieldCheck size={32} />
          </div>
          <p className="text-sm text-slate-600">กำลังพาไปหน้าเข้าสู่ระบบ ให้ล็อกอินด้วยรหัสผ่านใหม่</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่" subtitle="ยืนยันตัวตนแล้ว ตั้งรหัสผ่านใหม่ที่จำได้ง่ายแต่คนอื่นเดายาก" footer={backToLogin}>
      {errorMsg && <AuthAlert type="error">{errorMsg}</AuthAlert>}
      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <PasswordField
          label="รหัสผ่านใหม่"
          icon={Lock}
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          placeholder={`อย่างน้อย ${MIN_PASSWORD} ตัวอักษร`}
          invalid={passwordTooShort}
          hint={passwordTooShort ? `อีก ${MIN_PASSWORD - password.length} ตัวอักษร` : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          label="ยืนยันรหัสผ่านใหม่"
          icon={Lock}
          required
          autoComplete="new-password"
          placeholder="พิมพ์รหัสผ่านอีกครั้ง"
          invalid={mismatch}
          hint={mismatch ? 'รหัสผ่านไม่ตรงกัน' : undefined}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <div className="pt-2">
          <SubmitButton loading={loading} loadingText="กำลังบันทึก..." disabled={mismatch || passwordTooShort}>
            บันทึกรหัสผ่านใหม่
          </SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
