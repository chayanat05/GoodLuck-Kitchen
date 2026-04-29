import Link from 'next/link';
import { Navigation, Zap, MapPin, ArrowRight, UserPlus, LogIn, BadgeCheck } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 overflow-hidden relative font-sans">
    
      {/* 🌟 อนิเมชั่นพื้นหลัง (Floating Background Orbs) */}
      <div className="absolute top-[-20%] left-[-10%] w-[125vw] sm:w-125 h-[125vw] sm:h-125 bg-blue-400 rounded-full mix-blend-multiply filter blur-[100px] sm:blur-[120px] opacity-30 animate-pulse"></div>
      <div className="absolute top-[20%] right-[-10%] w-screen sm:w-100 h-[100vw] sm:h-100 bg-cyan-300 rounded-full mix-blend-multiply filter blur-[100px] sm:blur-[120px] opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-[-20%] left-[20%] w-[150vw] sm:w-150 h-[150vw] sm:h-150 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[100px] sm:blur-[120px] opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>

      {/* 🌟 Navigation Bar (ด้านบนสุด) */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex justify-between items-center animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3">
          <div className="bg-linear-to-br from-blue-600 to-indigo-600 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-500/30">
            <Navigation size={24} className="fill-white/20" />
          </div>
          <span className="text-2xl font-black text-gray-900 tracking-tight">
            GoodLuck<span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-cyan-500 ml-1">Rider</span>
          </span>
        </div>
      </nav>

      {/* 🌟 Hero Section (ส่วนเนื้อหาหลัก) */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-32 flex flex-col items-center text-center">
        
        {/* ป้าย Tag เล็กๆ ด้านบน */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold mb-8 animate-in fade-in zoom-in-95 duration-500 shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          ยินดีต้อนรับสู่ทีมจัดส่งของเรา 🎉
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 tracking-tight mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 leading-tight">
          แอปพลิเคชันรับงานสำหรับ <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-indigo-500 to-cyan-500">
            ไรเดอร์คนเก่งของเรา
          </span>
        </h1>
        
        <p className="max-w-2xl text-base md:text-xl text-gray-500 mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 font-medium">
          หากคุณได้รับลิงก์นี้ แสดงว่าคุณคือคนที่ร้านเลือก! <br className="hidden md:block"/>
          สมัครบัญชีผู้ใช้ของคุณ เพื่อเปิดระบบรับออเดอร์ ดูพิกัดแผนที่นำทาง <br className="hidden md:block"/>
          และจัดการรอบวิ่งงานของคุณได้ทันที
        </p>

        {/* ปุ่ม Call to Action (CTA) */}
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 px-4">
          <Link 
            href="/register" 
            className="group relative flex items-center justify-center gap-3 px-8 py-4.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-lg shadow-[0_8px_30px_rgba(79,70,229,0.3)] hover:shadow-[0_15px_40px_rgba(79,70,229,0.4)] hover:-translate-y-1 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            <UserPlus size={22} className="group-hover:scale-110 transition-transform" />
            สร้างบัญชีไรเดอร์ใหม่
            <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform" />
          </Link>
          
          <Link 
            href="/login" 
            className="group flex items-center justify-center gap-3 px-8 py-4.5 bg-white text-gray-700 border-2 border-gray-200 rounded-2xl font-bold text-lg hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md"
          >
            <LogIn size={22} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
            เข้าสู่ระบบแอปไรเดอร์
          </Link>
        </div>
      </main>

      {/* 🌟 Features Section (สิ่งที่ไรเดอร์จะได้ใช้งาน) */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-24 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          
          <div className="bg-white/70 backdrop-blur-xl p-8 rounded-4xl border border-white shadow-xl shadow-gray-200/40 hover:-translate-y-2 transition-transform duration-300 group">
            <div className="w-14 h-14 bg-linear-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner">
              <Zap size={28} className="text-blue-600 fill-blue-600/20" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tight">รับงานไว แจ้งเตือนทันที</h3>
            <p className="text-gray-500 leading-relaxed font-medium text-sm">
              เมื่อร้านอาหารจัดเตรียมออเดอร์เสร็จ ระบบจะเด้งแจ้งเตือนให้คุณกดรับงานผ่านมือถือได้ทันที ไม่พลาดทุกรอบวิ่ง
            </p>
          </div>

          <div className="bg-white/70 backdrop-blur-xl p-8 rounded-4xl border border-white shadow-xl shadow-gray-200/40 hover:-translate-y-2 transition-transform duration-300 group">
            <div className="w-14 h-14 bg-linear-to-br from-indigo-100 to-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner">
              <MapPin size={28} className="text-indigo-600 fill-indigo-600/20" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tight">แผนที่นำทางส่งถึงที่</h3>
            <p className="text-gray-500 leading-relaxed font-medium text-sm">
              แค่กดปุ่ม &ldquo;นำทาง&rdquo; ระบบจะคำนวณเส้นทางจากจุดที่คุณอยู่ ไปยังที่อยู่ลูกค้าผ่าน Google Maps ให้อัตโนมัติ
            </p>
          </div>

          <div className="bg-white/70 backdrop-blur-xl p-8 rounded-4xl border border-white shadow-xl shadow-gray-200/40 hover:-translate-y-2 transition-transform duration-300 group">
            <div className="w-14 h-14 bg-linear-to-br from-emerald-100 to-emerald-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner">
              <BadgeCheck size={28} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tight">เช็กประวัติชัดเจน</h3>
            <p className="text-gray-500 leading-relaxed font-medium text-sm">
              มีหน้า Dashboard สรุปยอดงานที่วิ่งสำเร็จในแต่ละวัน พร้อมรายละเอียดการเก็บเงินลูกค้า เพื่อให้คุณตรวจสอบได้ง่ายๆ
            </p>
          </div>

        </div>
      </section>
      
    </div>
  );
}