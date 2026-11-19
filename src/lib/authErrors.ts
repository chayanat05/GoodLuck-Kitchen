// แปลง error จาก Supabase Auth เป็นข้อความภาษาไทยที่พนักงานเข้าใจ
// อิงจาก error.code (supabase-js v2) และ fallback ด้วยข้อความภาษาอังกฤษเดิม

type MaybeAuthError = { code?: string; message?: string; status?: number } | null | undefined;

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'อีเมล/ชื่อเล่น หรือรหัสผ่านไม่ถูกต้อง',
  email_not_confirmed: 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรุณากดลิงก์ยืนยันในอีเมลก่อน',
  user_already_exists: 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบ หรือกด "ลืมรหัสผ่าน"',
  email_exists: 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบ หรือกด "ลืมรหัสผ่าน"',
  weak_password: 'รหัสผ่านง่ายเกินไป กรุณาตั้งให้ยาวขึ้นหรือผสมตัวเลข',
  same_password: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม',
  email_address_invalid: 'รูปแบบอีเมลไม่ถูกต้อง',
  validation_failed: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
  over_email_send_rate_limit: 'ขอส่งอีเมลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  over_request_rate_limit: 'ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
  signup_disabled: 'ระบบปิดรับสมัครชั่วคราว กรุณาติดต่อแอดมิน',
  user_banned: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อแอดมิน',
  session_expired: 'เซสชันหมดอายุ กรุณาขอลิงก์ใหม่อีกครั้ง',
  otp_expired: 'ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง',
};

export function authErrorToThai(error: MaybeAuthError, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'): string {
  if (!error) return fallback;
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];

  const msg = (error.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return BY_CODE.invalid_credentials;
  if (msg.includes('email not confirmed')) return BY_CODE.email_not_confirmed;
  if (msg.includes('already registered')) return BY_CODE.user_already_exists;
  if (msg.includes('different from the old password')) return BY_CODE.same_password;
  if (msg.includes('for security purposes') || msg.includes('rate limit')) return BY_CODE.over_request_rate_limit;
  if (msg.includes('password should be')) return BY_CODE.weak_password;
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาตรวจสอบสัญญาณแล้วลองใหม่';
  return fallback;
}
