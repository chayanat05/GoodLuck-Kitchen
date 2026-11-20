#!/usr/bin/env node
/**
 * ย้ายรูปเก่าจาก Supabase Storage → Cloudflare R2 แล้วเปลี่ยนค่าใน DB จาก "URL เต็ม" เป็น "ตำแหน่งไฟล์"
 *
 *   node scripts/migrate-images-to-r2.mjs                     ทดลอง (ไม่เขียนอะไรเลย) — นับจำนวน + ทดสอบโหลด 3 รูป
 *   node scripts/migrate-images-to-r2.mjs --apply --limit=20  ย้ายจริงแค่ 20 แถวต่อคอลัมน์ (ลองก่อน)
 *   node scripts/migrate-images-to-r2.mjs --apply             ย้ายจริงทั้งหมด (หยุดกลางทางแล้วรันต่อได้)
 *   node scripts/migrate-images-to-r2.mjs --apply --only=orders.slip_image
 *   node scripts/migrate-images-to-r2.mjs --rollback=scripts/migration-logs/<ไฟล์>.jsonl
 *
 * ความปลอดภัย
 * - ไม่ลบไฟล์ใน Supabase (ลบเองทีหลังเมื่อตรวจครบแล้ว)
 * - อัปเดตแถวเฉพาะเมื่อค่าในคอลัมน์ยังเหมือนตอนอ่าน (ถ้ามีคนแก้ระหว่างนั้น ข้ามแถวนั้นไป)
 * - ชื่อไฟล์ใน R2 คำนวณจาก URL เดิม → รันซ้ำได้ ไม่เกิดไฟล์ซ้ำ
 * - ทุกแถวที่เปลี่ยนถูกบันทึกใน scripts/migration-logs/*.jsonl ใช้ --rollback คืนค่าเดิมได้
 *
 * ต้องมีใน .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 *                      R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PRIVATE_BUCKET_NAME
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// ---------------------------------------------------------------- config
// kind/folder ต้องตรงกับ src/lib/mediaKinds.ts
const TARGETS = [
  { table: "orders", column: "image_url", csv: true, folder: "orders", private: false },
  { table: "orders", column: "slip_image", csv: true, folder: "slips", private: true },
  { table: "shared_gallery", column: "image_url", folder: "gallery", private: false },
  { table: "rider_attendance", column: "check_in_image", folder: "attendance", private: true },
  { table: "rider_attendance", column: "check_out_image", folder: "attendance", private: true },
  { table: "rider_attendance", column: "payment_slip_url", folder: "payroll-slips", private: true },
  { table: "kitchen_attendance", column: "check_in_image", folder: "attendance", private: true },
  { table: "kitchen_attendance", column: "check_out_image", folder: "attendance", private: true },
  { table: "monthly_payments", column: "slip_url", folder: "payroll-slips", private: true, noCreatedAt: true },
  { table: "rider_applications", column: "fb_profile_image", folder: "applications", private: true },
  { table: "kitchen_applications", column: "fb_profile_image", folder: "applications", private: true },
  { table: "admin_applications", column: "fb_profile_image", folder: "applications", private: true },
];
const STORAGE_MARK = "/storage/v1/object/";
const CONCURRENCY = 6;
const PAGE = 200;

// ---------------------------------------------------------------- args / env
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const APPLY = !!args.apply;
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const ONLY = args.only ? String(args.only).split(",") : null;

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=\s*(?:"([^"]*)"|'([^']*)'|([^#\s]*))/);
  if (m) env[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
}
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PRIVATE_BUCKET_NAME"]) {
  if (!env[k]) {
    console.error(`ไม่พบ ${k} ใน .env.local`);
    process.exit(1);
  }
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

// ---------------------------------------------------------------- helpers
const isLegacy = (v) => typeof v === "string" && v.includes(STORAGE_MARK);
const splitCsv = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);

function uuidFrom(text) {
  const h = crypto.createHash("sha1").update(text).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function extFor(contentType, url) {
  const t = (contentType || "").toLowerCase();
  if (t.includes("webp")) return ["webp", "image/webp"];
  if (t.includes("png")) return ["png", "image/png"];
  if (t.includes("jpeg") || t.includes("jpg")) return ["jpg", "image/jpeg"];
  const e = url.split("?")[0].split(".").pop().toLowerCase();
  if (e === "webp") return ["webp", "image/webp"];
  if (e === "png") return ["png", "image/png"];
  if (["jpg", "jpeg", "jfif"].includes(e)) return ["jpg", "image/jpeg"];
  return null;
}

/** ตำแหน่งไฟล์ใหม่ (ไม่รวมนามสกุล) — ใช้ปี/เดือนของแถว และ uuid ที่คำนวณจาก URL เดิม */
function baseKey(target, url, createdAt) {
  const d = createdAt ? new Date(createdAt) : new Date();
  const ym = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${target.folder}/${ym}/${uuidFrom(url)}`;
}

async function download(url) {
  const res = await fetch(url);
  if (res.ok) return { body: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") };
  // สำรอง: โหลดด้วยสิทธิ์ service ผ่าน API ของ Storage
  const m = url.split("?")[0].match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
  if (!m) throw new Error(`HTTP ${res.status}`);
  const { data, error } = await db.storage.from(m[1]).download(decodeURIComponent(m[2]));
  if (error || !data) throw new Error(`HTTP ${res.status} / ${error?.message}`);
  return { body: new Uint8Array(await data.arrayBuffer()), type: data.type };
}

async function exists(bucket, key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** คัดลอก 1 ไฟล์ → คืนค่าที่จะเก็บใน DB ("orders/..." หรือ "private/slips/...") */
const copied = new Map();
async function copyOne(target, url, createdAt) {
  if (copied.has(url)) return copied.get(url);
  const p = (async () => {
    const { body, type } = await download(url);
    const ext = extFor(type, url);
    if (!ext) throw new Error(`ชนิดไฟล์ไม่รองรับ: ${type}`);
    const objectKey = `${baseKey(target, url, createdAt)}.${ext[0]}`;
    const bucket = target.private ? env.R2_PRIVATE_BUCKET_NAME : env.R2_BUCKET_NAME;
    if (!(await exists(bucket, objectKey))) {
      await r2.send(new PutObjectCommand({
        Bucket: bucket, Key: objectKey, Body: body, ContentType: ext[1],
        CacheControl: "public, max-age=31536000, immutable",
      }));
    }
    return { value: target.private ? `private/${objectKey}` : objectKey, bytes: body.length };
  })();
  copied.set(url, p);
  p.catch(() => copied.delete(url));
  return p;
}

async function pool(items, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

/** อ่านแถวที่ยังมี URL ของ Supabase ทีละหน้า (เรียงตาม id ใช้ keyset → แถวที่อัปเดตแล้วไม่ทำให้หน้าเลื่อน) */
async function* legacyRows(target) {
  let lastId = null;
  let seen = 0;
  const cols = ["id", target.column, ...(target.noCreatedAt ? [] : ["created_at"])].join(", ");
  while (seen < LIMIT) {
    let q = db.from(target.table).select(cols).like(target.column, `%${STORAGE_MARK}%`).order("id").limit(Math.min(PAGE, LIMIT - seen));
    if (lastId) q = q.gt("id", lastId);
    const { data, error } = await q;
    if (error) throw new Error(`${target.table}: ${error.message}`);
    if (!data.length) return;
    lastId = data[data.length - 1].id;
    seen += data.length;
    yield data;
  }
}

// ---------------------------------------------------------------- rollback
if (args.rollback) {
  const lines = fs.readFileSync(String(args.rollback), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  let ok = 0, skipped = 0;
  for (const r of lines) {
    const { data, error } = await db.from(r.table).update({ [r.column]: r.old }).eq("id", r.id).eq(r.column, r.new).select("id");
    if (error || !data?.length) skipped++;
    else ok++;
  }
  console.log(`คืนค่าเดิม ${ok} แถว, ข้าม ${skipped} แถว (ค่าถูกแก้ไปแล้ว)`);
  process.exit(0);
}

// ---------------------------------------------------------------- main
const targets = TARGETS.filter((t) => !ONLY || ONLY.includes(`${t.table}.${t.column}`));
fs.mkdirSync("scripts/migration-logs", { recursive: true });
const logFile = path.join("scripts/migration-logs", `${new Date().toISOString().replace(/[:.]/g, "-")}${APPLY ? "" : "-dryrun"}.jsonl`);
const failFile = logFile.replace(/\.jsonl$/, "-failed.jsonl");
const log = APPLY ? fs.createWriteStream(logFile, { flags: "a" }) : null;
const fails = fs.createWriteStream(failFile, { flags: "a" });

console.log(APPLY ? "=== ย้ายจริง ===" : "=== ทดลอง (ไม่เขียนอะไร) — ใส่ --apply เพื่อย้ายจริง ===");
const totals = { rows: 0, files: 0, updated: 0, conflict: 0, failed: 0, bytes: 0 };

for (const target of targets) {
  const name = `${target.table}.${target.column}`;
  const t = { rows: 0, files: 0, updated: 0, conflict: 0, failed: 0 };
  let sampled = 0;

  for await (const rows of legacyRows(target)) {
    await pool(rows, async (row) => {
      const oldValue = row[target.column];
      const parts = target.csv ? splitCsv(oldValue) : [oldValue.trim()];
      t.rows++;

      if (!APPLY) {
        t.files += parts.filter(isLegacy).length;
        // ทดลองโหลด 3 รูปแรกของคอลัมน์ ให้แน่ใจว่าเข้าถึงได้
        if (sampled < 3 && parts.some(isLegacy)) {
          sampled++;
          const url = parts.find(isLegacy);
          try {
            const { body, type } = await download(url);
            console.log(`  ตัวอย่าง ${name}: ${(body.length / 1024).toFixed(0)}KB ${type} → ${target.private ? "private/" : ""}${baseKey(target, url, row.created_at)}.${extFor(type, url)?.[0]}`);
          } catch (e) {
            console.log(`  ตัวอย่าง ${name}: โหลดไม่ได้ (${e.message})`);
          }
        }
        return;
      }

      const next = [];
      let rowFailed = false;
      for (const part of parts) {
        if (!isLegacy(part)) { next.push(part); continue; }
        try {
          const { value, bytes } = await copyOne(target, part, row.created_at);
          next.push(value);
          t.files++;
          totals.bytes += bytes;
        } catch (e) {
          rowFailed = true;
          next.push(part); // เก็บ URL เดิมไว้ — รูปยังเปิดได้จาก Supabase
          fails.write(JSON.stringify({ table: target.table, id: row.id, column: target.column, url: part, error: e.message }) + "\n");
        }
      }
      if (rowFailed) t.failed++;

      const newValue = target.csv ? next.join(",") : next[0];
      if (newValue === oldValue) return;
      const { data, error } = await db.from(target.table).update({ [target.column]: newValue }).eq("id", row.id).eq(target.column, oldValue).select("id");
      if (error || !data?.length) {
        t.conflict++;
        return;
      }
      t.updated++;
      log.write(JSON.stringify({ table: target.table, id: row.id, column: target.column, old: oldValue, new: newValue }) + "\n");
    });
    if (APPLY) process.stdout.write(`\r  ${name}: ${t.rows} แถว, ${t.files} ไฟล์, อัปเดต ${t.updated}   `);
  }

  if (APPLY) process.stdout.write("\n");
  console.log(`${name}: ${t.rows} แถว / ${t.files} ไฟล์` + (APPLY ? ` / อัปเดต ${t.updated} / ข้าม(มีคนแก้) ${t.conflict} / ผิดพลาด ${t.failed}` : ""));
  for (const k of Object.keys(t)) totals[k] += t[k];
}

log?.end();
fails.end();
console.log(`\nรวม ${totals.rows} แถว, ${totals.files} ไฟล์` + (APPLY ? `, ${(totals.bytes / 1024 / 1024).toFixed(1)}MB, อัปเดต ${totals.updated}, ผิดพลาด ${totals.failed}` : ""));
if (APPLY) console.log(`บันทึกการเปลี่ยน: ${logFile}\nคืนค่า: node scripts/migrate-images-to-r2.mjs --rollback=${logFile}`);
if (totals.failed) console.log(`รายการที่ย้ายไม่ได้: ${failFile}`);
