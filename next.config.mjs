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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mdftttvjgizzbtevcxkf.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
  // 🌟 เพิ่มส่วนนี้เข้าไปเพื่อแก้ปัญหา CSP บล็อก eval() ในโหมด Dev
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // อนุญาต eval(), inline script และการดึงข้อมูลจากภายนอก (Google Maps, Supabase)
            value: "script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http: wss:; worker-src 'self' blob:;"
          }
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);