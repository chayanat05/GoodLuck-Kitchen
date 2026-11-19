'use client'
import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authErrorToThai } from '@/lib/authErrors';
import { AuthShell, AuthAlert, AuthLoading, Field, PasswordField, SubmitButton } from '@/components/auth/AuthUI';

type RouteResult = { path: string } | { error: string };

// เลือกหน้าปลายทางตาม role (ใช้ทั้งตอนเปิดแอปที่ล็อกอินค้างไว้ และหลังกดเข้าสู่ระบบ)
async function resolveHomePath(userId: string): Promise<RouteResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id, is_approved')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return { error: 'ไม่พบข้อมูลพนักงานของบัญชีนี้ กรุณาติดต่อแอดมิน' };

  if (profile.role === 'admin' || profile.role === 'superadmin') return { path: '/home' };

  if (profile.role === 'kitchen') {
    if (profile.is_approved === false) {
      return { error: 'บัญชีของคุณกำลังรอแอดมินอนุมัติ หรือถูกปิดใช้งานอยู่' };
    }
    // ทุกสาขาอยู่ที่เดียวกัน: ถ้าไม่ได้ระบุสาขา ให้เข้าบอร์ดสาขาแรก
    const branchQuery = supabase.from('branches').select('id, slug');
    const { data: branch } = profile.branch_id
      ? await branchQuery.eq('id', profile.branch_id).maybeSingle()
      : await branchQuery.order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (!branch) return { error: 'ยังไม่มีสาขาในระบบ กรุณาติดต่อแอดมิน' };
    return { path: `/board/${branch.slug || branch.id}` };
  }

  // ไรเดอร์: หน้า /rider จะแสดงหน้ารออนุมัติเองถ้ายังไม่ได้รับอนุมัติ
  return { path: '/rider' };
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // ถ้าล็อกอินค้างไว้ ให้พาไปหน้าของตัวเองเลย
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return setIsCheckingAuth(false);

        const result = await resolveHomePath(session.user.id);
        if ('path' in result) {
          router.replace(result.path);
        } else {
          await supabase.auth.signOut();
          setErrorMsg(result.error);
          setIsCheckingAuth(false);
        }
      } catch {
        setIsCheckingAuth(false);
      }
    };
    checkExistingSession();
  }, [router]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const input = identifier.trim();
    const usedNickname = !input.includes('@');

    try {
      let loginEmail = input;
      if (usedNickname) {
        const { data: email, error: rpcError } = await supabase.rpc('get_email_by_username', { p_username: input });
        if (rpcError || !email) {
          setErrorMsg('ไม่พบชื่อเล่นนี้ในระบบ ลองตรวจตัวสะกด หรือเข้าด้วยอีเมลแทน');
          setLoading(false);
          return;
        }
        loginEmail = email as string;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error || !data.user) {
        const base = authErrorToThai(error, 'เข้าสู่ระบบไม่สำเร็จ');
        // ชื่อเล่นอาจซ้ำกับคนอื่น ทำให้ระบบไปเจออีเมลของอีกคน
        setErrorMsg(usedNickname && error?.code === 'invalid_credentials'
          ? `${base} (ถ้าชื่อเล่นซ้ำกับคนอื่น ให้ลองเข้าด้วยอีเมลแทน)`
          : base);
        setLoading(false);
        return;
      }

      const result = await resolveHomePath(data.user.id);
      if ('path' in result) {
        router.push(result.path); // คงสถานะโหลดไว้จนเปลี่ยนหน้า
      } else {
        await supabase.auth.signOut();
        setErrorMsg(result.error);
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg(authErrorToThai(err as { message?: string }, 'เกิดข้อผิดพลาดในการเชื่อมต่อ'));
      setLoading(false);
    }
  };

  if (isCheckingAuth) return <AuthLoading />;

  return (
    <AuthShell
      title="เข้าสู่ระบบ"
      subtitle="ใช้อีเมล หรือชื่อเล่นที่ตั้งไว้ตอนสมัคร"
      footer={
        <>
          ยังไม่มีบัญชี?{' '}
          <Link href="/register" className="font-bold text-slate-900 underline decoration-amber-400 decoration-2 underline-offset-4 hover:decoration-amber-500">
            สมัครสมาชิก
          </Link>
        </>
      }
    >
      {errorMsg && <AuthAlert type="error">{errorMsg}</AuthAlert>}

      <form onSubmit={handleLogin} className="space-y-4">
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

        <div>
          <PasswordField
            label="รหัสผ่าน"
            icon={Lock}
            required
            autoComplete="current-password"
            placeholder="รหัสผ่านของคุณ"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm font-bold text-amber-700 hover:text-amber-800">
              ลืมรหัสผ่าน?
            </Link>
          </div>
        </div>

        <div className="pt-2">
          <SubmitButton loading={loading} loadingText="กำลังเข้าสู่ระบบ...">
            เข้าสู่ระบบ <ArrowRight size={18} />
          </SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
