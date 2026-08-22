import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  const headers = new Headers(options?.headers);
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');

  return fetch(url, { 
    ...options, 
    headers,
    cache: 'no-store' 
  });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // 🌟 1. ตั้งค่า Fetch เดิมของคุณปลั๊ก (กัน Cache)
  global: {
    fetch: customFetch as typeof fetch
  },
  // 🌟 2. เพิ่มการตั้งค่า Auth ตรงนี้ เพื่อให้จำการล็อกอินถาวร!
  auth: {
    persistSession: true,     // บังคับจำลง LocalStorage
    autoRefreshToken: true,   // ต่ออายุ Token ให้เรื่อยๆ ก่อนจะหมดอายุ
    detectSessionInUrl: true, 
  }
})