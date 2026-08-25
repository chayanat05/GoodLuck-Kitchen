'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle, CheckCircle2, Eye, EyeOff, Save, Mail, Hash } from 'lucide-react';
import { supabase } from '../../lib/supabase'; 

export default function ResetPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // 🌟 State ใหม่ เช็คว่ามี Session จากการคลิกลิงก์แล้วหรือยัง
    const [isSessionActive, setIsSessionActive] = useState(false);

    useEffect(() => {
        // เช็คว่าระบบดึง Token จาก URL ไป Verify ให้เบื้องหลังแล้วหรือยัง
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setIsSessionActive(true);
            }
        };
        checkSession();

        // ดักจับ Event เผื่อ Supabase เพิ่งทำงานเสร็จหลังจากโหลดหน้าเว็บ
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
                setIsSessionActive(true);
            }
        });

        return () => authListener.subscription.unsubscribe();
    }, []);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (password !== confirmPassword) {
            setErrorMsg('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกันครับ');
            return;
        }
        if (password.length < 6) {
            setErrorMsg('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษรครับ');
            return;
        }
        if (!isSessionActive && otp.length !== 8) {
            setErrorMsg('รหัส OTP ต้องมี 8 หลักครับ');
            return;
        }

        setLoading(true);

        try {
            // 🌟 หากยังไม่มี Session (พิมพ์ OTP เอง) ต้อง Verify ก่อน
            if (!isSessionActive) {
                const { error: verifyError } = await supabase.auth.verifyOtp({
                    email: email.trim(), // ใส่ trim() ป้องกันช่องว่างแถมมา
                    token: otp.trim(),
                    type: 'recovery' 
                });

                if (verifyError) {
                    throw new Error("รหัส OTP ไม่ถูกต้อง หรือหมดอายุแล้วครับ");
                }
            }

            // 🌟 สั่งอัปเดตรหัสผ่านใหม่
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) {
                throw updateError;
            }

            setSuccessMsg('เปลี่ยนรหัสผ่านสำเร็จ! กรุณารอสักครู่ ระบบกำลังพากลับไปหน้าล็อกอิน...');
            
            setTimeout(async () => {
                await supabase.auth.signOut();
                router.push('/login');
            }, 3000);

        } catch (err: unknown) {
            if (err instanceof Error) setErrorMsg(err.message);
            else setErrorMsg('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-50 via-white to-blue-100 p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 animate-in fade-in zoom-in-95 duration-500 my-8">
                
                <div className="text-center mb-8">
                    <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">ตั้งรหัสผ่านใหม่</h1>
                    <p className="text-sm text-gray-500">
                        {isSessionActive 
                            ? "ยืนยันตัวตนสำเร็จแล้ว กรุณาตั้งรหัสผ่านใหม่" 
                            : "กรอกรหัส OTP ที่ได้รับทางอีเมลและตั้งรหัสผ่านใหม่"}
                    </p>
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

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                    
                    {/* 🌟 ซ่อนช่องอีเมลและ OTP ถ้าคลิกลิงก์มาและยืนยันแล้ว */}
                    {!isSessionActive && (
                        <>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-green-500 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input 
                                    type="email" 
                                    required
                                    placeholder="อีเมลของคุณ"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                                />
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-green-500 transition-colors">
                                    <Hash size={18} />
                                </div>
                                <input 
                                    type="text" 
                                    required
                                    maxLength={8}
                                    placeholder="รหัส OTP 8 หลัก จากอีเมล"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
                                    className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-black tracking-widest text-center"
                                />
                            </div>
                            <div className="h-px bg-gray-100 my-4"></div>
                        </>
                    )}

                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-green-500 transition-colors">
                            <Lock size={18} />
                        </div>
                        <input 
                            type={showPassword ? "text" : "password"} 
                            required
                            placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none cursor-pointer"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-green-500 transition-colors">
                            <Lock size={18} />
                        </div>
                        <input 
                            type={showConfirmPassword ? "text" : "password"} 
                            required
                            placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full pl-10 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none cursor-pointer"
                        >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading || !!successMsg}
                        className="w-full mt-6 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-200 transition-all active:scale-[0.98] flex justify-center items-center group cursor-pointer"
                    >
                        {loading ? 'กำลังตรวจสอบและบันทึก...' : (
                        <>
                            ยืนยันการตั้งรหัสผ่านใหม่
                            <Save size={18} className="ml-2" />
                        </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-gray-500">
                    <button onClick={() => router.push('/login')} className="font-bold text-gray-600 hover:text-gray-800 hover:underline transition-colors flex items-center justify-center w-full cursor-pointer">
                        กลับไปหน้าเข้าสู่ระบบ
                    </button>
                </div>
            </div>
        </div>
    );
}