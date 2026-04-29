'use client'
import { useState } from 'react';
import Link from 'next/link';
import { Mail, KeyRound, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase'; 

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // 🌟 สั่งให้ Supabase ส่งอีเมลรีเซ็ตรหัสผ่าน และบอกให้เด้งกลับมาที่หน้า /reset-password
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
        setErrorMsg(error.message);
    } else {
        setSuccessMsg('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้วครับ กรุณาเช็คกล่องจดหมาย (หรือกล่องจดหมายขยะ)');
        setEmail('');
    }
    } catch (err: unknown) {
    if (err instanceof Error) setErrorMsg(err.message);
    else setErrorMsg('เกิดข้อผิดพลาดในการส่งอีเมล');
    } finally {
    setLoading(false);
    }
};

return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-blue-100 p-4">
    <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <KeyRound size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">ลืมรหัสผ่าน?</h1>
        <p className="text-sm text-gray-500">กรอกอีเมลของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่</p>
        </div>

        {errorMsg && (
        <div className="mb-6 bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-start border border-red-100 animate-in slide-in-from-top-2">
            <AlertCircle size={16} className="mr-2 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
        </div>
        )}
        {successMsg && (
        <div className="mb-6 bg-green-50 text-green-700 p-3 rounded-xl text-sm flex items-start border border-green-100 animate-in slide-in-from-top-2">
            <CheckCircle2 size={16} className="mr-2 mt-0.5 shrink-0" />
            <span>{successMsg}</span>
        </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4">
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
            <Mail size={18} />
            </div>
            <input 
            type="email" 
            required
            placeholder="อีเมลที่ใช้สมัครสมาชิก"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
        </div>

        <button 
            type="submit" 
            disabled={loading || !!successMsg}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] flex justify-center items-center group cursor-pointer"
        >
            {loading ? 'กำลังส่งอีเมล...' : (
            <>
                ส่งลิงก์รีเซ็ตรหัสผ่าน
                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </>
            )}
        </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500">
        <Link href="/login" className="font-bold text-gray-600 hover:text-gray-800 hover:underline transition-colors flex items-center justify-center">
            กลับไปหน้าเข้าสู่ระบบ
        </Link>
        </div>
    </div>
    </div>
);
}