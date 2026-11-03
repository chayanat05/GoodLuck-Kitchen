import { NextResponse } from "next/server";
import { uploadImageToR2 } from "@/lib/r2";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  
  const url = await uploadImageToR2(file, "profiles");
  return NextResponse.json({ success: true, url });
}