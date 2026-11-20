import { supabase } from "@/lib/supabase";

// เปิด/ปิดร้าน และ เมนูหมด ผ่านฟังก์ชันใน DB — แม่ครัวและแอดมินใช้ได้ (migration 20261121)
const message = (e: { message?: string } | null) =>
  !e ? null : e.message?.includes("FORBIDDEN") ? "ไม่มีสิทธิ์" : e.message?.includes("set_") ? "ยังไม่ได้รัน migration 20261121" : e.message || "ไม่สำเร็จ";

export async function setStoreOpen(storeId: string, open: boolean) {
  const { error } = await supabase.rpc("set_store_open", { p_store_id: storeId, p_open: open });
  return message(error);
}

export async function setMenuAvailable(menuId: string, available: boolean) {
  const { error } = await supabase.rpc("set_menu_available", { p_menu_id: menuId, p_available: available });
  return message(error);
}
