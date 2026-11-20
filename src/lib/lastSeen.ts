// แสดงเวลา "ออนไลน์ล่าสุด" ของไรเดอร์
export const ONLINE_WINDOW_MS = 5 * 60000;

export function isOnlineAt(lastSeen: string | null, now: number) {
  if (!lastSeen) return false;
  return now - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;
}

const time = (d: Date) =>
  d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** ข้อความสั้นบนหมุด เช่น "ออนไลน์อยู่", "12 นาทีที่แล้ว", "เมื่อวาน 18:40", "18 พ.ย. 09:15" */
export function lastSeenShort(lastSeen: string | null, now: number) {
  if (!lastSeen) return "ไม่มีข้อมูล";
  const d = new Date(lastSeen);
  const diff = now - d.getTime();
  if (diff < ONLINE_WINDOW_MS) return "ออนไลน์อยู่";
  if (diff < 60 * 60000) return `${Math.floor(diff / 60000)} นาทีที่แล้ว`;

  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return `วันนี้ ${time(d)}`;
  if (dayKey(d) === dayKey(yesterday)) return `เมื่อวาน ${time(d)}`;

  const sameYear = d.getFullYear() === today.getFullYear();
  const date = d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
  return `${date} ${time(d)}`;
}

/** ข้อความเต็ม เช่น "วันศุกร์ที่ 20 พ.ย. 2569 · 18:40 น." */
export function lastSeenFull(lastSeen: string | null) {
  if (!lastSeen) return "ยังไม่เคยส่งพิกัด";
  const d = new Date(lastSeen);
  const date = d.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${date} · ${time(d)} น.`;
}
