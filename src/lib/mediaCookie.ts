// cookie ที่เก็บ access token ไว้ให้ /api/media ตรวจสิทธิ์ตอนเปิดรูปส่วนตัว
// (จำกัด path แค่ /api/media จึงไม่ถูกส่งไปกับ request อื่น)
export const MEDIA_TOKEN_COOKIE = "gl_media_token";

export function setMediaTokenCookie(token: string | null, expiresAt?: number) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  if (!token) {
    document.cookie = `${MEDIA_TOKEN_COOKIE}=; Path=/api/media; Max-Age=0; SameSite=Lax${secure}`;
    return;
  }
  const maxAge = expiresAt ? Math.max(60, Math.floor(expiresAt - Date.now() / 1000)) : 3600;
  document.cookie = `${MEDIA_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/api/media; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}
