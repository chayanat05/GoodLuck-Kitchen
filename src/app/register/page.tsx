'use client'
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { User, Mail, Lock, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authErrorToThai } from '@/lib/authErrors';
import { AuthShell, AuthAlert, Field, PasswordField, SubmitButton } from '@/components/auth/AuthUI';

const MIN_PASSWORD = 6;

export default function RegisterPage() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // needsEmailConfirm = Supabase เปิดยืนยันอีเมลอยู่ (สมัครแล้วยังไม่มี session)
  const [done, setDone] = useState<null | { needsEmailConfirm: boolean }>(null);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = nickname.trim();
    if (name.length < 2) return setErrorMsg('ชื่อเล่นต้องมีอย่างน้อย 2 ตัวอักษร');
    if (password.length < MIN_PASSWORD) return setErrorMsg(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`);
    if (password !== confirmPassword) return setErrorMsg('รหัสผ่านทั้งสองช่องไม่ตรงกัน');

    setLoading(true);
    try {
      // ชื่อเล่นใช้ล็อกอินได้ จึงห้ามซ้ำกับคนอื่น
      const { data: existing } = await supabase.rpc('get_email_by_username', { p_username: name });
      if (existing) {
        setErrorMsg(`ชื่อเล่น "${name}" มีคนใช้แล้ว กรุณาเพิ่มตัวอักษรให้ต่างกัน เช่น "${name} ครัว" หรือ "${name}2"`);
        return;
      }

      // role กำหนดเป็น rider ที่ฝั่งฐานข้อมูล (trigger handle_new_user) และต้องรอแอดมินอนุมัติ
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: name } },
      });

      if (error) {
        setErrorMsg(authErrorToThai(error, 'สมัครสมาชิกไม่สำเร็จ'));
        return;
      }

      const needsEmailConfirm = !data.session;
      // ไม่ต้องค้าง session ไว้ เพราะยังเข้าใช้งานไม่ได้จนกว่าจะอนุมัติ
      if (data.session) await supabase.auth.signOut();
      setDone({ needsEmailConfirm });
    } catch (err) {
      setErrorMsg(authErrorToThai(err as { message?: string }, 'เกิดข้อผิดพลาดในการเชื่อมต่อ'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="สมัครสำเร็จ 🎉" subtitle={`ยินดีต้อนรับ ${nickname.trim()}`}>
        <ol className="space-y-3 mb-6">
          <li className="flex gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-900"><b>สร้างบัญชีแล้ว</b></div>
          </li>
          {done.needsEmailConfirm && (
            <li className="flex gap-3 rounded-xl bg-amber-50 border border-amber-200 p-3.5">
              <Mail size={20} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <b>ยืนยันอีเมล</b> — เปิดอีเมล <span className="font-mono">{email.trim()}</span> แล้วกดลิงก์ยืนยัน (ถ้าไม่เจอ ดูในกล่องจดหมายขยะ)
              </div>
            </li>
          )}
          <li className="flex gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3.5">
            <Clock size={20} className="text-slate-600 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700">
              <b>รอแอดมินอนุมัติ</b> — แจ้งแอดมินว่าสมัครด้วยชื่อ <b>{nickname.trim()}</b> เมื่ออนุมัติแล้วจะเข้าใช้งานได้ทันที
            </div>
          </li>
        </ol>
        <Link
          href="/login"
          className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition"
        >
          ไปหน้าเข้าสู่ระบบ <ArrowRight size={18} />
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="สมัครสมาชิก"
      subtitle="สมัครแล้วรอแอดมินอนุมัติก่อนเริ่มใช้งาน"
      footer={
        <>
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/login" className="font-bold text-slate-900 underline decoration-amber-400 decoration-2 underline-offset-4 hover:decoration-amber-500">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      {errorMsg && <AuthAlert type="error">{errorMsg}</AuthAlert>}

      <form onSubmit={handleRegister} className="space-y-4">
        <Field
          label="ชื่อเล่น"
          icon={User}
          required
          maxLength={30}
          autoComplete="nickname"
          placeholder="ชื่อที่ใช้เรียกในร้าน"
          hint="ใช้แทนอีเมลตอนเข้าสู่ระบบได้ ห้ามซ้ำกับคนอื่น"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <Field
          label="อีเมล"
          icon={Mail}
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@gmail.com"
          hint="ใช้สำหรับรีเซ็ตรหัสผ่านถ้าลืม"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="รหัสผ่าน"
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
          label="ยืนยันรหัสผ่าน"
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
          <SubmitButton loading={loading} loadingText="กำลังสร้างบัญชี..." disabled={mismatch || passwordTooShort}>
            สมัครสมาชิก <ArrowRight size={18} />
          </SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
