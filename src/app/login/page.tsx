'use client'
import { useState } from 'react';
import Link from 'next/link';
import { User, Lock, LogIn, AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase'; 

export default function LoginPage() {
  const [formData, setFormData] = useState({
    identifier: '', 
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      let loginEmail = formData.identifier.trim();

      // เปลี่ยนจาก .from('profiles') มาเป็นเรียกใช้ฟังก์ชัน rpc
  if (!loginEmail.includes('@')) {
  const { data: userEmail, error: rpcError } = await supabase
    .rpc('get_email_by_username', { p_username: loginEmail });

  if (rpcError || !userEmail) {
    setErrorMsg('ไม่พบชื่อผู้ใช้งานนี้ในระบบ หรือพิมพ์ชื่อผิดครับ 😢');
    setLoading(false);
    return;
  }
  
  // ได้อีเมลมาแล้ว นำไปล็อกอินต่อ
  loginEmail = userEmail; 
  }

      // 🌟 ส่งล็อกอิน
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: formData.password,
      });

      if (error) {
        setErrorMsg('รหัสผ่านไม่ถูกต้อง หรือบัญชีนี้ไม่มีอยู่จริงครับ');
      } else if (authData.user) {
        
        // 🌟 สับราง! วิ่งไปเช็ค Role ของคนที่เพิ่งล็อกอินสำเร็จ
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        // ตรวจสอบสิทธิ์แล้วส่งไปหน้าที่ถูกต้อง
        if (userProfile?.role === 'admin') {
          window.location.href = '/board'; // แอดมินไปห้องคุมการบิน
        } else {
          window.location.href = '/rider'; // ไรเดอร์ไปหน้าลงพื้นที่
        }
        
      }
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
      else setErrorMsg('เกิดข้อผิดพลาดบางอย่าง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gray-50 p-4">
      {/* อนิเมชั่นพื้นหลัง */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse"></div>
      <div className="absolute top-[20%] right-[-10%] w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-[-10%] left-[20%] w-80 h-80 bg-cyan-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse" style={{ animationDelay: '4s' }}></div>

      {/* กล่องหลักแบบ Glassmorphism */}
      <div className="relative w-full max-w-md bg-white/80 backdrop-blur-2xl rounded-4xl shadow-[0_8px_40px_rgb(0,0,0,0.08)] border border-white p-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 bg-linear-to-tr from-blue-600 to-indigo-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/30 transform transition-transform hover:scale-110 hover:rotate-3 duration-500">
            <LogIn size={36} className="ml-1" />
          </div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-blue-700 to-indigo-600 mb-2">
            ยินดีต้อนรับกลับมา
          </h1>
          <p className="text-sm text-gray-500 font-medium">เข้าสู่ระบบเพื่อลุยงานต่อได้เลย 🚀</p>
        </div>

        {errorMsg && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-2xl text-sm flex items-start border border-red-100 shadow-sm animate-in shake duration-300">
            <AlertCircle size={18} className="mr-2.5 mt-0.5 shrink-0" />
            <span className="font-medium leading-relaxed">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-5">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors duration-300">
                <User size={20} />
              </div>
              <input 
                type="text" 
                required
                placeholder="อีเมล หรือ ชื่อเล่น"
                value={formData.identifier}
                onChange={(e) => setFormData({...formData, identifier: e.target.value})}
                className="w-full pl-12 pr-4 py-4 bg-white/50 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 hover:border-gray-200 shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors duration-300">
                  <Lock size={20} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  placeholder="รหัสผ่าน"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full pl-12 pr-12 py-4 bg-white/50 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 hover:border-gray-200 shadow-sm"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600 transition-colors duration-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              
              <div className="flex justify-end">
                <Link 
                  href="/forgot-password"
                  className="text-[13px] font-bold text-blue-600 hover:text-indigo-700 transition-all hover:underline"
                >
                  ลืมรหัสผ่านใช่ไหม?
                </Link>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="relative w-full overflow-hidden bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] hover:-translate-y-1 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0 flex justify-center items-center group"
          >
            <div className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                กำลังตรวจสอบ...
              </span>
            ) : (
              <span className="flex items-center text-base tracking-wide">
                เข้าสู่ระบบ <Sparkles size={18} className="ml-2 opacity-70 group-hover:scale-125 transition-transform" />
              </span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-500 font-medium">
          ยังไม่มีบัญชีใช่ไหม?{' '}
          <Link href="/register" className="font-bold text-blue-600 hover:text-indigo-700 hover:underline transition-all ml-1">
            สมัครสมาชิก
          </Link>
        </div>
      </div>
    </div>
  );
}