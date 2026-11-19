'use client'
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { User, ArrowLeft, Send, MailCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authErrorToThai } from '@/lib/authErrors';
import { AuthShell, AuthAlert, Field, SubmitButton } from '@/components/auth/AuthUI';

const RESEND_COOLDOWN = 60; // Supabase จำกัดการส่งอีเมลซ้ำประมาณ 60 วินาที

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendResetLink = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const input = identifier.trim();
      let email = input;

      // พนักงานส่วนใหญ่ล็อกอินด้วยชื่อเล่น เลยรองรับการกรอกชื่อเล่นด้วย
      if (!input.includes('@')) {
        const { data } = await supabase.rpc('get_email_by_username', { p_username: input });
        if (!data) {
          setErrorMsg('ไม่พบชื่อเล่นนี้ในระบบ ลองกรอกเป็นอีเมลแทน');
          return;
        }
        email = data as string;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setErrorMsg(authErrorToThai(error, 'ส่งอีเมลไม่สำเร็จ'));
        return;
      }
      setSentTo(email);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setErrorMsg(authErrorToThai(err as { message?: string }, 'เกิดข้อผิดพลาดในการเชื่อมต่อ'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendResetLink();
  };

  const backToLogin = (
    <Link href="/login" className="inline-flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900">
      <ArrowLeft size={16} /> กลับไปหน้าเข้าสู่ระบบ
    </Link>
  );

  if (sentTo) {
    return (
      <AuthShell title="เช็คอีเมลของคุณ" footer={backToLogin}>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
            <MailCheck size={32} />
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่
            <br />
            <span className="font-bold text-slate-900 break-all">{maskEmail(sentTo)}</span>
          </p>
          <p className="mt-3 text-xs text-slate-500">ถ้าไม่เจอ ลองดูในกล่องจดหมายขยะ (Spam / Junk)</p>
        </div>

        {errorMsg && <div className="mt-5"><AuthAlert type="error">{errorMsg}</AuthAlert></div>}

        <button
          type="button"
          onClick={sendResetLink}
          disabled={cooldown > 0 || loading}
          className="mt-6 w-full h-12 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'กำลังส่ง...' : cooldown > 0 ? `ส่งอีกครั้งได้ใน ${cooldown} วินาที` : 'ส่งลิงก์อีกครั้ง'}
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="ลืมรหัสผ่าน"
      subtitle="กรอกอีเมลหรือชื่อเล่น ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของคุณ"
      footer={backToLogin}
    >
      {errorMsg && <AuthAlert type="error">{errorMsg}</AuthAlert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="อีเมล หรือ ชื่อเล่น"
          icon={User}
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="เช่น somchai@gmail.com หรือ สมชาย"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <div className="pt-2">
          <SubmitButton loading={loading} loadingText="กำลังส่งลิงก์...">
            ส่งลิงก์ตั้งรหัสผ่านใหม่ <Send size={16} />
          </SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}

// แสดงอีเมลแบบบังบางส่วน (กรณีกรอกชื่อเล่น จะได้ไม่เผยอีเมลเต็มของคนอื่น)
function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${'•'.repeat(Math.max(1, name.length - visible.length))}@${domain}`;
}
