import { NextResponse } from "next/server";
import { presignPrivate } from "@/lib/r2";
import { checkToken, bearerToken } from "@/lib/serverAuth";
import { viewLevelForPrivateKey } from "@/lib/mediaKinds";
import { MEDIA_TOKEN_COOKIE } from "@/lib/mediaCookie";

// เปิดรูปใน bucket ส่วนตัว: /api/media/private/slips/2026/11/xxx.webp
// ตรวจสิทธิ์จาก cookie (แท็ก <img> ส่ง header เองไม่ได้) หรือ Authorization header
// ผ่านแล้ว redirect ไปลิงก์ชั่วคราวของ R2 (หมดอายุใน 10 นาที)
const KEY_RE = /^private\/[a-z0-9-]+\/[0-9]{4}\/[0-9]{2}\/[0-9a-f-]{36}\.(webp|jpg|png)$/;

export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (!KEY_RE.test(key)) return new NextResponse("Not found", { status: 404 });

  const cookieToken = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(MEDIA_TOKEN_COOKIE + "="))
    ?.slice(MEDIA_TOKEN_COOKIE.length + 1);
  const token = bearerToken(req) || (cookieToken ? decodeURIComponent(cookieToken) : null);

  const auth = await checkToken(token, viewLevelForPrivateKey(key));
  if (!auth.ok) return new NextResponse(auth.error, { status: auth.status });

  const objectKey = key.slice("private/".length);
  const url = await presignPrivate(objectKey, 600);
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
