'use client'
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; 
import { User, Lock, LogIn, AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // 🌟 แนะนำใช้ @/ เพื่อลดโอกาส Path เพี้ยน

export default function LoginPage() {
  const [formData, setFormData] = useState({
    identifier: '', 
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const router = useRouter(); 

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      let loginEmail = formData.identifier.trim();

      // 🌟 ตรวจสอบ Username ผ่าน RPC (No Any!)
      if (!loginEmail.includes('@')) {
        const { data: userEmail, error: rpcError } = await supabase
          .rpc('get_email_by_username', { p_username: loginEmail });

        if (rpcError || !userEmail) {
          setErrorMsg('ไม่พบชื่อผู้ใช้งาน หรือพิมพ์ชื่อผิดครับ 😢');
          setLoading(false);
          return;
        }
        loginEmail = userEmail as string; 
      }

      // 🌟 ดำเนินการล็อกอิน
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: formData.password,
      });

      if (error) {
        setErrorMsg('รหัสผ่านไม่ถูกต้อง หรือบัญชีไม่มีในระบบครับ');
      } else if (authData.user) {
        
        // 🌟 ดึงข้อมูล Profile และ Branch
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('role, branch_id')
          .eq('id', authData.user.id)
          .single();

        // 🌟 แยกเส้นทางตามระดับผู้ใช้งาน
        if (userProfile?.role === 'admin') {
          router.push('/home'); 
        } else if (userProfile?.role === 'kitchen') {
          if (userProfile.branch_id) {
            const { data: branchData } = await supabase
              .from('branches')
              .select('slug')
              .eq('id', userProfile.branch_id)
              .single();
            
            const slugToUse = branchData?.slug || userProfile.branch_id;
            router.push(`/board/${slugToUse}`);
          } else {
            setErrorMsg('บัญชีของคุณยังไม่ได้กำหนดสาขา กรุณาแจ้งแอดมินครับ');
            await supabase.auth.signOut();
          }
        } else {
          router.push('/rider'); 
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-50 p-4 font-sans">
      {/* 🌟 ปรับอนิเมชั่นพื้นหลังให้ลื่นไหลขึ้น */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400/20 rounded-full filter blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-400/20 rounded-full filter blur-[100px] animate-pulse delay-700"></div>

      <div className="relative w-full max-w-md bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 bg-linear-to-tr from-blue-600 to-indigo-600 text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/30 transform transition-transform hover:scale-105 hover:rotate-3 duration-300">
            <LogIn size={36} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">
            เข้าสู่ระบบ
          </h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Store Management System</p>
        </div>

        {errorMsg && (
          <div className="mb-6 bg-rose-50 text-rose-600 p-4 rounded-2xl text-sm flex items-start border border-rose-100 animate-in shake duration-300">
            <AlertCircle size={18} className="mr-3 mt-0.5 shrink-0" />
            <span className="font-bold">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                <User size={20} />
              </div>
              <input 
                type="text" 
                required
                placeholder="อีเมล หรือ ชื่อเล่น"
                value={formData.identifier}
                onChange={(e) => setFormData({...formData, identifier: e.target.value})}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-inner"
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                <Lock size={20} />
              </div>
              <input 
                type={showPassword ? "text" : "password"} 
                required
                placeholder="รหัสผ่าน"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-inner"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="flex justify-end pr-1">
              <Link href="/forgot-password" className="text-xs font-black text-blue-600 hover:text-indigo-700 uppercase tracking-widest">
                ลืมรหัสผ่าน?
              </Link>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-900/10 hover:bg-blue-600 hover:-translate-y-1 transition-all duration-300 disabled:bg-slate-300 active:scale-95 uppercase tracking-widest text-sm flex justify-center items-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ตรวจสอบข้อมูล...
              </span>
            ) : (
              <>เข้าสู่ระบบ <Sparkles size={18} /></>
            )}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest inline">ยังไม่มีบัญชี? </p>
          <Link href="/register" className="text-xs font-black text-blue-600 hover:text-indigo-700 uppercase tracking-widest ml-1">
            สมัครสมาชิกใหม่
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
}