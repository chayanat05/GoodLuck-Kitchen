// ไฟล์: next.config.mjs
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public', 
  disable: process.env.NODE_ENV === 'development', 
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, // 🌟 1. เพิ่มบรรทัดนี้เพื่อปิดการคำนวณโควต้ารูปภาพของ Vercel
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mdftttvjgizzbtevcxkf.supabase.co',
        port: '',
        pathname: '/**',
      },
      // 🌟 2. (เผื่อไว้) ถ้าคุณย้ายไป R2 เมื่อไหร่ ให้มาเพิ่ม hostname ของ R2 ต่อท้ายตรงนี้ด้วยครับ
      // {
      //   protocol: 'https',
      //   hostname: 'pub-xxxxxxxxxxxxxx.r2.dev',
      // },
    ],
  },
  
  // 🌟 ส่วนนี้คือแก้ปัญหา CSP บล็อก eval() ในโหมด Dev ของคุณ (คงไว้เหมือนเดิม)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http: wss:; worker-src 'self' blob:;"
          }
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);