'use client'
import { useState, useEffect } from 'react';
import { Lock, AlertCircle, CheckCircle2, Eye, EyeOff, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase'; 

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

// ตรวจสอบว่ามาจากการกดลิงก์ในอีเมลจริงๆ หรือไม่
useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
    if (event === "PASSWORD_RECOVERY") {
        console.log("Password recovery mode active");
    }
    });

    // 🌟 สิ่งที่ต้องเพิ่ม: Cleanup function เพื่อปิดตัวดักจับเวลาเปลี่ยนหน้า
    return () => {
    subscription.unsubscribe();
    };
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

    setLoading(true);

    try {
      // 🌟 อัปเดตรหัสผ่านใหม่เข้าระบบ
    const { error } = await supabase.auth.updateUser({
        password: password
    });

    if (error) {
        setErrorMsg(error.message);
    } else {
        setSuccessMsg('เปลี่ยนรหัสผ่านสำเร็จ! กรุณารอสักครู่ ระบบกำลังพากลับไปหน้าล็อกอิน...');
        setPassword('');
        setConfirmPassword('');
        
        // รอ 3 วิแล้วเด้งกลับหน้าล็อกอิน
        setTimeout(() => {
        window.location.href = '/login';
        }, 3000);
    }
    } catch (err: unknown) {
    if (err instanceof Error) setErrorMsg(err.message);
    else setErrorMsg('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
    } finally {
    setLoading(false);
    }
};

    return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-50 via-white to-blue-100 p-4">
    <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <Lock size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">ตั้งรหัสผ่านใหม่</h1>
        <p className="text-sm text-gray-500">กรุณากำหนดรหัสผ่านใหม่ที่คาดเดาได้ยาก</p>
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
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-green-500 transition-colors">
            <Lock size={18} />
            </div>
            <input 
            type={showPassword ? "text" : "password"} 
            required
            placeholder="รหัสผ่านใหม่ (New Password)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
            />
            <button 
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
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
            placeholder="ยืนยันรหัสผ่านใหม่ (Confirm Password)"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full pl-10 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
            />
            <button 
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
            >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>

        <button 
            type="submit" 
            disabled={loading || !!successMsg}
            className="w-full mt-6 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-200 transition-all active:scale-[0.98] flex justify-center items-center group cursor-pointer"
        >
            {loading ? 'กำลังบันทึก...' : (
            <>
                บันทึกรหัสผ่านใหม่
                <Save size={18} className="ml-2" />
            </>
            )}
        </button>
        </form>
    </div>
    </div>
);
}