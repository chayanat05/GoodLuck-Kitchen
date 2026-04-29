'use client'
import { useState,FormEvent } from 'react';
import Link from 'next/link';
import { User, Mail, Lock, UserPlus, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase'; 
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    nickname: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกันครับ 🧐');
      return;
    }
    if (formData.password.length < 6) {
      setErrorMsg('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษรครับ 🔒');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            username: formData.nickname.trim(), 
            role: 'rider', 
          }
        }
      });
      if (data?.user) {
        setSuccessMsg('สมัครสำเร็จ');
      }
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('🎉 สร้างบัญชีสำเร็จแล้ว! ระบบจะพากลับไปหน้าล็อกอิน...');
        setTimeout(() => { router.push('/login'); }, 2000);
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
      {/* 🌟 อนิเมชั่นพื้นหลัง (Floating Orbs - สลับสีให้ต่างจาก Login นิดหน่อย) */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse"></div>
      <div className="absolute bottom-[10%] left-[-10%] w-80 h-80 bg-green-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[30%] left-[30%] w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse" style={{ animationDelay: '4s' }}></div>

      {/* 🌟 กล่องหลักแบบ Glassmorphism */}
      <div className="relative w-full max-w-md bg-white/80 backdrop-blur-2xl rounded-4xl shadow-[0_8px_40px_rgb(0,0,0,0.08)] border border-white p-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-linear-to-r from-blue-600 to-cyan-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-cyan-500/30 transform transition-transform hover:scale-110 hover:-rotate-3 duration-500">
            <UserPlus size={36} />
          </div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-blue-700 to-cyan-600 mb-2">
            สร้างบัญชีใหม่
          </h1>
          <p className="text-sm text-gray-500 font-medium">ร่วมทีมไรเดอร์กับเรา สมัครฟรีไม่มีค่าใช้จ่าย ✨</p>
        </div>

        {errorMsg && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-2xl text-sm flex items-start border border-red-100 shadow-sm animate-in shake duration-300">
            <AlertCircle size={18} className="mr-2.5 mt-0.5 shrink-0" />
            <span className="font-medium leading-relaxed">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-2xl text-sm flex items-start border border-green-100 shadow-sm animate-in slide-in-from-top-4 duration-500">
            <CheckCircle2 size={18} className="mr-2.5 mt-0.5 shrink-0" />
            <span className="font-medium leading-relaxed">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors duration-300">
              <User size={20} />
            </div>
            <input 
              type="text" 
              required
              placeholder="ชื่อเล่น (เอาไว้เรียกในแอป)"
              value={formData.nickname}
              onChange={(e) => setFormData({...formData, nickname: e.target.value})}
              className="w-full pl-12 pr-4 py-4 bg-white/50 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 hover:border-gray-200 shadow-sm"
            />
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors duration-300">
              <Mail size={20} />
            </div>
            <input 
              type="email" 
              required
              placeholder="อีเมล (Email)"
              aria-label="อีเมล"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full pl-12 pr-4 py-4 bg-white/50 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 hover:border-gray-200 shadow-sm"
            />
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors duration-300">
              <Lock size={20} />
            </div>
            <input 
              type={showPassword ? "text" : "password"} 
              required
              placeholder="ตั้งรหัสผ่าน (6 ตัวอักษรขึ้นไป)"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full pl-12 pr-12 py-4 bg-white/50 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 hover:border-gray-200 shadow-sm"
            />
            <button 
              type="button"
              aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600 transition-colors duration-300 focus:outline-none"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors duration-300">
              <Lock size={20} />
            </div>
            <input 
              type={showConfirmPassword ? "text" : "password"} 
              required
              placeholder="ยืนยันรหัสผ่านอีกครั้ง"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              className={`w-full pl-12 pr-12 py-4 bg-white/50 border-2 rounded-2xl text-sm outline-none focus:bg-white focus:ring-4 transition-all duration-300 shadow-sm
                ${formData.confirmPassword && formData.password !== formData.confirmPassword 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10 bg-red-50/50' 
                  : 'border-gray-100 focus:border-blue-500 focus:ring-blue-500/10 hover:border-gray-200'}`}
            />
            <button 
              type="button"
              aria-label={showConfirmPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600 transition-colors duration-300 focus:outline-none"
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button 
            type="submit" 
            disabled={loading || !!successMsg}
            className="relative w-full overflow-hidden bg-linear-to-r from-blue-600 to-cyan-500 text-white font-bold py-4 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] hover:-translate-y-1 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0 flex justify-center items-center group mt-8"
          >
            {/* เอฟเฟกต์แสงวิ่งพาดปุ่ม */}
            <div className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                กำลังสร้างบัญชี...
              </span>
            ) : (
              <span className="flex items-center text-base tracking-wide">
                เริ่มต้นใช้งานเลย <ArrowRight size={18} className="ml-2 group-hover:translate-x-1.5 transition-transform" />
              </span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-500 font-medium">
          มีบัญชีผู้ใช้อยู่แล้ว?{' '}
          <Link href="/login" className="font-bold text-blue-600 hover:text-cyan-600 hover:underline transition-all ml-1">
            เข้าสู่ระบบที่นี่
          </Link>
        </div>
      </div>
    </div>
  );
}