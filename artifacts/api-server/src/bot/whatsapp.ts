import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

import { db } from "@workspace/db";
import { usersTable, transactionsTable, announcementsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import OpenAI from "openai";
import Replicate from "replicate";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// __dirname here is artifacts/api-server/src/bot → go up 2 to artifacts/api-server
const PROOFS_DIR = path.join(__dirname, "../../public/proofs");
if (!fs.existsSync(PROOFS_DIR)) fs.mkdirSync(PROOFS_DIR, { recursive: true });

const REPLICATE_API_TOKEN = "r8_fGbDNjLpj5ReSWvlzu0Yn2NaepU94hM0yXXQB";

// Module-level client so admin routes can send WA messages
let activeClient: InstanceType<typeof Client> | null = null;

export async function sendBotMessage(phone: string, message: string): Promise<boolean> {
  if (!activeClient || !botStatus.connected) return false;
  try {
    // Remove @c.us if already present, then add it
    const chatId = phone.includes("@") ? phone : `${phone}@c.us`;
    await activeClient.sendMessage(chatId, message);
    return true;
  } catch (err) {
    console.error("sendBotMessage error:", err);
    return false;
  }
}

async function saveProofImage(mediaData: string, mimeType: string): Promise<string | null> {
  try {
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("gif") ? "gif" : "jpg";
    const filename = `proof_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const filepath = path.join(PROOFS_DIR, filename);
    fs.writeFileSync(filepath, Buffer.from(mediaData, "base64"));
    return `/api/proofs/${filename}`;
  } catch (err) {
    console.error("saveProofImage error:", err);
    return null;
  }
}

// Use Replit AI Integration (free) — env vars set automatically by setupReplitAIIntegrations
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

const YOUTUBE_VIDEOS = [
  "https://youtu.be/AwvIzgNC6gE?si=5x-AGUGbmwtlp7wp",
  "https://youtu.be/neys_e0vFaU?si=g1IjOzFEdMWBX58b",
  "https://youtu.be/0o07bxvRiCk?si=al_3AC2AhiiBvDev",
  "https://youtu.be/f-J7AMOm0aU?si=KSMCxlVhRAvLocj1",
  "https://youtu.be/FtoqcXio-eo?si=pA52b2JwfvofXm7A",
  "https://youtu.be/Ze_w7ac1u4w?si=6Qg9iH4kMdtJXqXq",
];

const WA_GROUP_URL = "https://chat.whatsapp.com/BYbZOfLWY5R52rtZSKwA2g?mode=gi_t";
const VIDEO_BONUS = 100;
const VIDEO_WATCH_DURATION_MS = 3 * 60 * 1000; // 3 minutes

function getRandomVideo(): string {
  return YOUTUBE_VIDEOS[Math.floor(Math.random() * YOUTUBE_VIDEOS.length)];
}

let botStatus = {
  connected: false,
  phone: null as string | null,
  qrCode: null as string | null,
  status: "initializing",
};

export function getBotStatus() {
  return { ...botStatus };
}

// Track active video countdown timers per phone
const videoTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

function clearVideoTimers(phone: string) {
  const timers = videoTimers.get(phone);
  if (timers) {
    timers.forEach(t => clearTimeout(t));
    videoTimers.delete(phone);
  }
}

function genReferralCode(phone: string): string {
  return "ALT" + phone.slice(-4).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
}

async function getOrCreateUser(phone: string) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (existing) return existing;
  const refCode = genReferralCode(phone);
  const [created] = await db.insert(usersTable).values({
    phone,
    name: "Pengguna",
    referralCode: refCode,
  }).returning();
  return created;
}

async function setMenuState(phone: string, state: string, tempData?: string) {
  await db.update(usersTable).set({
    menuState: state,
    tempData: tempData ?? null,
  }).where(eq(usersTable.phone, phone));
}

function hasActivePackage(user: { packageExpiry: Date | null }): boolean {
  if (!user.packageExpiry) return false;
  return user.packageExpiry > new Date();
}

function formatCurrency(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function welcomeMessage(user: { name: string }) {
  return `╔════════════════════════╗
║    🤖 *ALTOGEN BOT* 🤖     ║
║  _AI Generator WhatsApp_  ║
╚════════════════════════╝

Halo *${user.name}*! 👋
Selamat datang di *ALTOGEN* - Bot Generator AI terbaik!

✨ Nikmati fitur canggih:
🎯 Generator Prompt AI
🎬 Generator Video AI
💰 Sistem Saldo & Bonus

Ketuk angka untuk navigasi 👇`;
}

function mainMenu() {
  return `🏠 *MENU UTAMA*
━━━━━━━━━━━━━━━━━━━━━━

1️⃣  🏠 HOME
2️⃣  🎁 BONUS
3️⃣  ✨ GEN (Generator AI)
4️⃣  💰 SALDO
5️⃣  👤 PROFIL

━━━━━━━━━━━━━━━━━━━━━━
_Balas dengan angka menu_`;
}

function bonusMenu() {
  return `🎁 *MENU BONUS*
━━━━━━━━━━━━━━━━━━━━━━

1️⃣  📦 Paket Langganan
2️⃣  ✅ Check-In Harian
3️⃣  👥 Undang Teman
4️⃣  📺 Tonton Video (Rp 100/video, 3 menit)

━━━━━━━━━━━━━━━━━━━━━━
0️⃣  ◀ Kembali | 00 Menu Utama`;
}

function paketMenu() {
  return `📦 *PAKET LANGGANAN*
━━━━━━━━━━━━━━━━━━━━━━

Aktifkan paket untuk menggunakan Generator AI!

1️⃣  ⭐ 7 Hari  — *Rp 15.000*
2️⃣  ⭐ 10 Hari — *Rp 25.000*
3️⃣  ⭐ 30 Hari — *Rp 60.000*

Pembayaran via *DANA*
Konfirmasi oleh admin setelah transfer.

━━━━━━━━━━━━━━━━━━━━━━
0️⃣  ◀ Kembali | 00 Menu Utama`;
}

function genMenu() {
  return `✨ *GENERATOR AI*
━━━━━━━━━━━━━━━━━━━━━━

1️⃣  🎯 Generator PROMPT AI
2️⃣  🎬 Generator VIDEO AI

━━━━━━━━━━━━━━━━━━━━━━
0️⃣  ◀ Kembali | 00 Menu Utama`;
}

function saldoMenu(balance: number) {
  return `💰 *SALDO KAMU*
━━━━━━━━━━━━━━━━━━━━━━

💵 Saldo: *${formatCurrency(balance)}*

1️⃣  💸 Tarik Saldo
2️⃣  💳 Deposit

━━━━━━━━━━━━━━━━━━━━━━
_Min. tarik: Rp 100.000_
0️⃣  ◀ Kembali | 00 Menu Utama`;
}

async function handleMessage(client: Client, msg: { from: string; body: string; hasMedia: boolean; downloadMedia: () => Promise<MessageMedia> }) {
  const phone = msg.from.replace("@c.us", "").replace("@g.us", "");
  if (msg.from.endsWith("@g.us")) return; // ignore group messages

  const user = await getOrCreateUser(phone);
  if (user.isBlocked) {
    await client.sendMessage(msg.from, "❌ Akun Anda telah diblokir. Hubungi admin.");
    return;
  }

  const body = msg.body?.trim() ?? "";
  const state = user.menuState ?? "main";

  // Handle global navigation
  if (body === "00") {
    await setMenuState(phone, "main");
    await client.sendMessage(msg.from, mainMenu());
    return;
  }

  // State machine
  switch (state) {
    case "main":
    case "welcome": {
      if (!body || body === "0" || body.toLowerCase().includes("hai") || body.toLowerCase().includes("halo") || body.toLowerCase().includes("hi") || body.toLowerCase().includes("menu")) {
        await client.sendMessage(msg.from, welcomeMessage(user));
        await client.sendMessage(msg.from, mainMenu());
        await setMenuState(phone, "main");
      } else if (body === "1") {
        await setMenuState(phone, "main");
        const announcements = await db.select().from(announcementsTable).orderBy(sql`created_at DESC`).limit(3);
        let homeMsg = `🏠 *HOME - ALTOGEN*\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        homeMsg += `👤 Nama: *${user.name}*\n`;
        homeMsg += `📱 No: ${phone}\n`;
        homeMsg += `💰 Saldo: *${formatCurrency(parseFloat(user.balance as string))}*\n`;
        homeMsg += `📦 Paket: ${hasActivePackage(user) ? `✅ Aktif s/d ${user.packageExpiry!.toLocaleDateString("id-ID")}` : "❌ Tidak aktif"}\n\n`;
        if (announcements.length > 0) {
          homeMsg += `📢 *PENGUMUMAN:*\n`;
          announcements.forEach(a => { homeMsg += `• ${a.message}\n`; });
        }
        homeMsg += `\n━━━━━━━━━━━━━━━━━━━━━━\n${mainMenu()}`;
        await client.sendMessage(msg.from, homeMsg);
      } else if (body === "2") {
        await setMenuState(phone, "bonus");
        await client.sendMessage(msg.from, bonusMenu());
      } else if (body === "3") {
        await setMenuState(phone, "gen");
        await client.sendMessage(msg.from, genMenu());
      } else if (body === "4") {
        await setMenuState(phone, "saldo");
        await client.sendMessage(msg.from, saldoMenu(parseFloat(user.balance as string)));
      } else if (body === "5") {
        await setMenuState(phone, "profil");
        const bal = parseFloat(user.balance as string);
        const refCount = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.referredBy, user.referralCode));
        let profilMsg = `👤 *PROFIL KAMU*\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        profilMsg += `👤 Nama: *${user.name}*\n`;
        profilMsg += `📱 No: ${phone}\n`;
        profilMsg += `🔑 Kode Referal: *${user.referralCode}*\n`;
        profilMsg += `👥 Teman Diundang: ${refCount[0].count} orang\n`;
        profilMsg += `💰 Saldo: *${formatCurrency(bal)}*\n`;
        profilMsg += `📦 Paket: ${hasActivePackage(user) ? `✅ Aktif s/d ${user.packageExpiry!.toLocaleDateString("id-ID")}` : "❌ Tidak aktif"}\n`;
        profilMsg += `💳 E-Wallet: ${user.ewalletType ? `${user.ewalletType} - ${user.ewalletNumber}` : "Belum diatur"}\n\n`;
        profilMsg += `📋 *INFO*\n`;
        profilMsg += `📌 About: ALTOGEN - Bot Generator AI\n`;
        profilMsg += `🔒 Privasi: Data pengguna dijaga kerahasiaannya\n`;
        profilMsg += `⚠️ Disclaimer: Layanan ini hanya untuk keperluan kreatif\n\n`;
        profilMsg += `🔗 Telegram: t.me/altomediaindonesia\n`;
        profilMsg += `💬 Group WA: ${WA_GROUP_URL}\n\n`;
        profilMsg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        profilMsg += `1️⃣ Edit Nama\n2️⃣ Edit E-Wallet\n0️⃣ ◀ Kembali`;
        await client.sendMessage(msg.from, profilMsg);
      } else {
        await client.sendMessage(msg.from, welcomeMessage(user));
        await client.sendMessage(msg.from, mainMenu());
      }
      break;
    }

    case "bonus": {
      if (body === "0") {
        await setMenuState(phone, "main");
        await client.sendMessage(msg.from, mainMenu());
      } else if (body === "1") {
        await setMenuState(phone, "bonus_paket");
        await client.sendMessage(msg.from, paketMenu());
      } else if (body === "2") {
        // Check-in harian
        const today = new Date().toDateString();
        const lastCheckin = user.lastCheckin ? user.lastCheckin.toDateString() : null;
        if (lastCheckin === today) {
          await client.sendMessage(msg.from, `✅ *CHECK-IN HARIAN*\n\nKamu sudah check-in hari ini!\nCoba lagi besok ya 😊\n\n0️⃣ ◀ Kembali | 00 Menu Utama`);
        } else {
          await db.update(usersTable).set({ lastCheckin: new Date() }).where(eq(usersTable.phone, phone));
          await db.insert(transactionsTable).values({
            userId: user.id,
            type: "checkin",
            amount: "50",
            status: "approved",
            notes: "Check-in harian",
          });
          const newBal = parseFloat(user.balance as string) + 50;
          await db.update(usersTable).set({ balance: String(newBal) }).where(eq(usersTable.phone, phone));
          await client.sendMessage(msg.from, `✅ *CHECK-IN BERHASIL!*\n\n🎉 Kamu mendapat bonus *Rp 50*\n💰 Saldo sekarang: *${formatCurrency(newBal)}*\n\nCheck-in lagi besok ya! 😊\n\n0️⃣ ◀ Kembali | 00 Menu Utama`);
        }
      } else if (body === "3") {
        // Undang teman
        await setMenuState(phone, "main");
        const refLink = `https://wa.me/?text=Halo! Gabung yuk di ALTOGEN Bot Generator AI yang keren! Daftar pakai kode referalku: *${user.referralCode}* Langsung chat bot ini: https://wa.me/${process.env.BOT_PHONE ?? ""}`;
        await client.sendMessage(msg.from, `👥 *UNDANG TEMAN*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🔑 Kode Referal kamu: *${user.referralCode}*\n💰 Bonus: *Rp 500* per undangan valid\n\nShare kode ini ke temanmu!\n\nLink undangan:\n${refLink}\n\n_Bonus diberikan setelah teman mendaftar dan melakukan deposit pertama_\n\n0️⃣ ◀ Kembali | 00 Menu Utama`);
      } else if (body === "4") {
        // Tonton video — kirim URL YouTube acak, timer 3 menit
        const today = new Date().toISOString().split("T")[0];
        const watchedToday = user.videosWatchedDate === today ? user.videosWatched : 0;
        if (watchedToday >= 20) {
          await client.sendMessage(msg.from, `📺 *TONTON VIDEO*\n\nKamu sudah menonton 20 video hari ini!\nMaksimum 20x per hari.\n\n💰 Total bonus hari ini: *${formatCurrency(20 * VIDEO_BONUS)}*\n\nCoba lagi besok! 😊\n\n0️⃣ ◀ Kembali | 00 Menu Utama`);
        } else {
          const videoUrl = getRandomVideo();
          const startTime = Date.now();
          await setMenuState(phone, "bonus_video_watching", JSON.stringify({ videoUrl, startTime, watchedToday }));
          // Clear any existing timers for this phone
          clearVideoTimers(phone);
          // Send initial message with video link
          await client.sendMessage(msg.from,
            `📺 *TONTON VIDEO - DAPAT BONUS!*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🎬 Video ke-*${watchedToday + 1}*/20\n💰 Bonus: *${formatCurrency(VIDEO_BONUS)}*\n⏱️ Durasi wajib: *3 menit*\n\n▶️ *Link Video:*\n${videoUrl}\n\n⚠️ *PERHATIAN:* Jangan kirim pesan apapun selama 3 menit!\nJika kamu kirim pesan sebelum 3 menit selesai, bonus akan *HANGUS*.\n\nBot akan memberi tahu saat waktunya selesai.`
          );
          // Schedule countdown notifications
          const t1 = setTimeout(() => {
            client.sendMessage(msg.from, `⏱️ *1 menit berlalu...*\n\n⏳ Sisa waktu: *2 menit* lagi\n\n_Jangan kirim pesan dulu! Tetap tonton videonya._ 🎬`).catch(() => {});
          }, 60_000);
          const t2 = setTimeout(() => {
            client.sendMessage(msg.from, `⏱️ *2 menit berlalu...*\n\n⏳ Sisa waktu: *1 menit* lagi\n\n_Hampir selesai! Tetap tonton videonya._ 🎬`).catch(() => {});
          }, 120_000);
          const t3 = setTimeout(async () => {
            // Check if user is still in watching state before giving notification
            clearVideoTimers(phone);
            client.sendMessage(msg.from,
              `✅ *WAKTU MENONTON SELESAI!*\n\n🎉 Kamu telah menonton selama 3 menit!\n💰 Bonus *${formatCurrency(VIDEO_BONUS)}* siap diklaim!\n\nKetik *selesai* untuk klaim bonus kamu sekarang!`
            ).catch(() => {});
          }, 180_000);
          videoTimers.set(phone, [t1, t2, t3]);
        }
      } else {
        await client.sendMessage(msg.from, bonusMenu());
      }
      break;
    }

    case "bonus_paket": {
      if (body === "0") {
        await setMenuState(phone, "bonus");
        await client.sendMessage(msg.from, bonusMenu());
      } else if (body === "1" || body === "2" || body === "3") {
        const packages: Record<string, { days: number; price: number; label: string }> = {
          "1": { days: 7, price: 15000, label: "7 Hari" },
          "2": { days: 10, price: 25000, label: "10 Hari" },
          "3": { days: 30, price: 60000, label: "30 Hari" },
        };
        const pkg = packages[body];
        await setMenuState(phone, "bonus_paket_confirm", JSON.stringify(pkg));
        await client.sendMessage(msg.from, `📦 *KONFIRMASI PAKET*\n━━━━━━━━━━━━━━━━━━━━━━\n\n✅ Paket: *${pkg.label}*\n💰 Harga: *${formatCurrency(pkg.price)}*\n\nTransfer ke *DANA*:\n📱 *085813899649* (Admin ALTOGEN)\n\nSetelah transfer, kirim bukti transfer ke sini.\n\n_Paket akan aktif setelah dikonfirmasi admin_\n\nKetik *batal* untuk membatalkan.`);
      } else if (body.toLowerCase() === "batal") {
        await setMenuState(phone, "bonus");
        await client.sendMessage(msg.from, bonusMenu());
      } else {
        await client.sendMessage(msg.from, paketMenu());
      }
      break;
    }

    case "bonus_paket_confirm": {
      if (body.toLowerCase() === "batal") {
        await setMenuState(phone, "bonus");
        await client.sendMessage(msg.from, bonusMenu());
      } else if (msg.hasMedia) {
        // User sent proof of payment
        const tempData = user.tempData ? JSON.parse(user.tempData) : null;
        if (tempData) {
          let proofUrl: string | null = null;
          try {
            const media = await msg.downloadMedia();
            proofUrl = await saveProofImage(media.data, media.mimetype);
          } catch {}
          await db.insert(transactionsTable).values({
            userId: user.id,
            type: "package",
            amount: String(tempData.price),
            status: "pending",
            notes: `Paket ${tempData.label} - ${user.name} (${phone})`,
            packageDays: tempData.days,
            proofUrl,
          });
          await setMenuState(phone, "main");
          await client.sendMessage(msg.from,
            `✅ *BUKTI DITERIMA!*\n━━━━━━━━━━━━━━━━━━━━━━\n\n📦 Paket: *${tempData.label}*\n💰 Harga: *${formatCurrency(tempData.price)}*\n📸 Bukti pembayaran sudah kami terima\n\n_Paket akan aktif dalam 1x24 jam setelah diverifikasi admin_\n\nTerima kasih! 🙏\n\n${mainMenu()}`);
        }
      } else {
        const tempData = user.tempData ? JSON.parse(user.tempData) : null;
        if (tempData) {
          await client.sendMessage(msg.from, `📦 *PAKET ${tempData.label}*\n\nSilakan kirim *foto bukti transfer* DANA senilai *${formatCurrency(tempData.price)}* ke:\n📱 *085813899649* (Admin ALTOGEN)\n\nKetik *batal* untuk membatalkan.`);
        }
      }
      break;
    }

    case "bonus_video_watching": {
      const tempData = user.tempData ? JSON.parse(user.tempData) : null;
      const elapsed = tempData ? Date.now() - tempData.startTime : 0;
      const timeOk = elapsed >= VIDEO_WATCH_DURATION_MS;

      if (body.toLowerCase() === "selesai" || body.toLowerCase() === "klaim" || body.toLowerCase() === "done") {
        // Klaim bonus — hanya jika 3 menit sudah berlalu
        if (!tempData) {
          await setMenuState(phone, "bonus");
          await client.sendMessage(msg.from, bonusMenu());
          break;
        }
        if (!timeOk) {
          // Bonus HANGUS — kirim pesan sebelum waktunya
          clearVideoTimers(phone);
          await setMenuState(phone, "bonus");
          await client.sendMessage(msg.from,
            `❌ *BONUS HANGUS!*\n\nKamu mengirim pesan sebelum 3 menit selesai!\n\n⏱️ Baru menonton: *${Math.floor(elapsed / 1000)} detik* dari 180 detik\n\n_Bonus tidak dapat diklaim. Coba lagi dengan menonton penuh 3 menit tanpa mengirim pesan._\n\n${bonusMenu()}`
          );
        } else {
          // Waktu cukup — berikan bonus
          clearVideoTimers(phone);
          const today = new Date().toISOString().split("T")[0];
          const newWatched = (user.videosWatchedDate === today ? user.videosWatched : 0) + 1;
          await db.update(usersTable).set({
            videosWatched: newWatched,
            videosWatchedDate: today,
          }).where(eq(usersTable.phone, phone));
          await db.insert(transactionsTable).values({
            userId: user.id,
            type: "video",
            amount: String(VIDEO_BONUS),
            status: "approved",
            notes: `Tonton video ke-${newWatched}`,
          });
          const newBal = parseFloat(user.balance as string) + VIDEO_BONUS;
          await db.update(usersTable).set({ balance: String(newBal) }).where(eq(usersTable.phone, phone));
          await setMenuState(phone, "bonus");
          await client.sendMessage(msg.from,
            `✅ *BONUS DITERIMA!*\n━━━━━━━━━━━━━━━━━━━━━━\n\n📺 Video ke-*${newWatched}*/20 berhasil ditonton!\n💰 Bonus: *${formatCurrency(VIDEO_BONUS)}*\n💰 Saldo sekarang: *${formatCurrency(newBal)}*\n\n${newWatched < 20 ? `Ketik *4* untuk tonton video berikutnya!` : "🎉 Selamat! Kamu sudah menonton 20 video hari ini!"}\n\n0️⃣ ◀ Kembali | 00 Menu Utama`
          );
        }
      } else if (body.toLowerCase() === "batal" || body === "0") {
        // User sengaja membatalkan — bonus hangus
        clearVideoTimers(phone);
        await setMenuState(phone, "bonus");
        await client.sendMessage(msg.from, `❌ Menonton dibatalkan. Bonus tidak diklaim.\n\n${bonusMenu()}`);
      } else {
        // User kirim pesan sembarangan sebelum 3 menit → HANGUS
        if (!timeOk) {
          clearVideoTimers(phone);
          await setMenuState(phone, "bonus");
          await client.sendMessage(msg.from,
            `❌ *BONUS HANGUS!*\n\nKamu mengirim pesan sebelum 3 menit selesai!\n\n⏱️ Baru menonton: *${Math.floor(elapsed / 1000)} detik* dari 180 detik\n\n_Bonus tidak dapat diklaim. Jangan kirim pesan apapun selama menonton. Coba lagi!_\n\n${bonusMenu()}`
          );
        } else {
          // Waktu sudah selesai, user lupa ketik selesai
          await client.sendMessage(msg.from, `✅ Waktu menonton sudah selesai!\nKetik *selesai* untuk klaim bonus *${formatCurrency(VIDEO_BONUS)}* kamu.`);
        }
      }
      break;
    }

    case "gen": {
      if (body === "0") {
        await setMenuState(phone, "main");
        await client.sendMessage(msg.from, mainMenu());
      } else if (body === "1") {
        if (!hasActivePackage(user)) {
          await client.sendMessage(msg.from, `❌ *PAKET TIDAK AKTIF*\n\nKamu perlu paket aktif untuk menggunakan Generator AI!\n\nKetik *2* dari menu utama untuk beli paket.\n\n0️⃣ ◀ Kembali | 00 Menu Utama`);
        } else {
          await setMenuState(phone, "gen_prompt_nama");
          await client.sendMessage(msg.from, `🎯 *GENERATOR PROMPT AI*\n━━━━━━━━━━━━━━━━━━━━━━\n\nKirim *nama/judul produk* kamu:\n\n_Contoh: Sepatu Sneakers Nike Air Max_\n\nKetik *batal* untuk keluar.`);
        }
      } else if (body === "2") {
        if (!hasActivePackage(user)) {
          await client.sendMessage(msg.from, `❌ *PAKET TIDAK AKTIF*\n\nKamu perlu paket aktif untuk menggunakan Generator Video AI!\n\nKetik *2* dari menu utama untuk beli paket.\n\n0️⃣ ◀ Kembali | 00 Menu Utama`);
        } else {
          await setMenuState(phone, "gen_video_prompt");
          await client.sendMessage(msg.from, `🎬 *GENERATOR VIDEO AI*\n━━━━━━━━━━━━━━━━━━━━━━\n\nKetik *deskripsi video* yang ingin dibuat:\n\n_Contoh: A beautiful sunset over the ocean with waves crashing on the shore_\n\n_Opsional: Lampirkan gambar sebagai referensi_\n\nKetik *batal* untuk keluar.`);
        }
      } else {
        await client.sendMessage(msg.from, genMenu());
      }
      break;
    }

    case "gen_prompt_nama": {
      if (body.toLowerCase() === "batal" || body === "0") {
        await setMenuState(phone, "gen");
        await client.sendMessage(msg.from, genMenu());
      } else {
        await setMenuState(phone, "gen_prompt_gambar", JSON.stringify({ nama: body }));
        await client.sendMessage(msg.from, `🎯 *GENERATOR PROMPT AI*\n\nNama produk: *${body}*\n\nSekarang kirim *foto produk* kamu (opsional).\nAtau ketik *skip* jika tidak ada foto.\n\nKetik *batal* untuk keluar.`);
      }
      break;
    }

    case "gen_prompt_gambar": {
      if (body.toLowerCase() === "batal" || body === "0") {
        await setMenuState(phone, "gen");
        await client.sendMessage(msg.from, genMenu());
      } else {
        const tempData = user.tempData ? JSON.parse(user.tempData) : { nama: "" };
        await client.sendMessage(msg.from, `⏳ *Sedang memproses...*\n\nMohon tunggu, AI sedang membuat prompt untuk produk:\n*${tempData.nama}*`);

        try {
          let imageBase64: string | undefined;
          if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            imageBase64 = media.data;
          }

          const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            {
              role: "system" as const,
              content: "Kamu adalah AI yang ahli dalam membuat prompt untuk konten marketing dan iklan visual yang menarik. Buatlah 3 scene prompt dalam Bahasa Inggris yang detail dan profesional untuk digunakan sebagai prompt AI image/video generator. Setiap scene harus deskriptif, visual, dan menarik untuk produk yang dimaksud.",
            },
            {
              role: "user" as const,
              content: imageBase64
                ? [
                    { type: "text" as const, text: `Buatkan 3 scene prompt yang berbeda untuk produk: "${tempData.nama}". Gunakan gambar ini sebagai referensi visual produk.` },
                    { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
                  ]
                : `Buatkan 3 scene prompt yang berbeda dan menarik untuk produk: "${tempData.nama}". Setiap scene harus menampilkan produk dari sudut pandang yang berbeda dengan latar belakang yang menarik.`,
            },
          ];

          const response = await openai.chat.completions.create({
            model: "gpt-5.2",
            messages,
            max_completion_tokens: 1000,
          });

          const result = response.choices[0]?.message?.content ?? "Gagal menghasilkan prompt.";
          await setMenuState(phone, "gen");
          await client.sendMessage(msg.from, `✅ *PROMPT AI BERHASIL DIBUAT!*\n━━━━━━━━━━━━━━━━━━━━━━\n\n*Produk:* ${tempData.nama}\n\n${result}\n\n━━━━━━━━━━━━━━━━━━━━━━\n${genMenu()}`);
        } catch (err) {
          console.error("OpenAI error:", err);
          await setMenuState(phone, "gen");
          await client.sendMessage(msg.from, `❌ Gagal membuat prompt. Coba lagi nanti.\n\n${genMenu()}`);
        }
      }
      break;
    }

    case "gen_video_prompt": {
      if (body.toLowerCase() === "batal" || body === "0") {
        await setMenuState(phone, "gen");
        await client.sendMessage(msg.from, genMenu());
      } else {
        const prompt = body;
        await client.sendMessage(msg.from,
          `⏳ *Sedang membuat video...*\n\nAI sedang memproses video kamu.\nProses ini biasanya memerlukan waktu *2-5 menit*.\n\nPrompt: _${prompt}_\n\n_Mohon tunggu, kami akan mengirim link video saat selesai._`
        );
        await setMenuState(phone, "gen");

        // Run Replicate async so bot stays responsive
        (async () => {
          try {
            // Create prediction and poll until done
            let prediction = await replicate.predictions.create({
              model: "minimax/video-01",
              input: { prompt },
            });

            // Poll every 10 seconds max 30 attempts (~5 minutes)
            let attempts = 0;
            while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled" && attempts < 30) {
              await new Promise(res => setTimeout(res, 10000));
              prediction = await replicate.predictions.get(prediction.id);
              attempts++;
            }

            if (prediction.status === "succeeded" && prediction.output) {
              let videoUrl: string | undefined;
              const out = prediction.output;
              if (typeof out === "string") {
                videoUrl = out;
              } else if (Array.isArray(out) && out.length > 0) {
                videoUrl = String(out[0]);
              } else if (out && typeof out === "object" && "url" in (out as object)) {
                videoUrl = String((out as { url: string }).url);
              }

              if (videoUrl) {
                await client.sendMessage(msg.from,
                  `✅ *VIDEO BERHASIL DIBUAT!*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🎬 Video kamu sudah siap!\n\n🔗 *Link Download:*\n${videoUrl}\n\nPrompt: _${prompt}_\n\n━━━━━━━━━━━━━━━━━━━━━━\n${genMenu()}`
                );
              } else {
                throw new Error("No video URL in output");
              }
            } else {
              const errMsg = prediction.error ? String(prediction.error) : `Status: ${prediction.status}`;
              throw new Error(errMsg);
            }
          } catch (err) {
            console.error("Replicate video error:", err);
            await client.sendMessage(msg.from,
              `❌ *Gagal membuat video.*\n\nKemungkinan server AI sedang sibuk. Coba ulangi permintaanmu.\n\n${genMenu()}`
            );
          }
        })();
      }
      break;
    }

    case "saldo": {
      if (body === "0") {
        await setMenuState(phone, "main");
        await client.sendMessage(msg.from, mainMenu());
      } else if (body === "1") {
        const bal = parseFloat(user.balance as string);
        if (bal < 100000) {
          await client.sendMessage(msg.from, `❌ *TARIK SALDO*\n\nSaldo kamu tidak mencukupi!\n💰 Saldo: *${formatCurrency(bal)}*\n📏 Minimum: *Rp 100.000*\n\n0️⃣ ◀ Kembali | 00 Menu Utama`);
        } else if (!user.ewalletNumber) {
          await setMenuState(phone, "saldo_tarik_ewallet");
          await client.sendMessage(msg.from, `💸 *TARIK SALDO*\n\nKamu belum menyimpan data e-wallet!\n\nKetik jenis e-wallet kamu:\n_Contoh: DANA / OVO / GoPay / ShopeePay_`);
        } else {
          await setMenuState(phone, "saldo_tarik_jumlah");
          await client.sendMessage(msg.from, `💸 *TARIK SALDO*\n━━━━━━━━━━━━━━━━━━━━━━\n\n💰 Saldo tersedia: *${formatCurrency(bal)}*\n💳 E-Wallet: *${user.ewalletType} - ${user.ewalletNumber}*\n\nKetik jumlah yang ingin ditarik (min. Rp 100.000):\n\nKetik *batal* untuk keluar.`);
        }
      } else if (body === "2") {
        await setMenuState(phone, "saldo_deposit");
        await client.sendMessage(msg.from, `💳 *DEPOSIT SALDO*\n━━━━━━━━━━━━━━━━━━━━━━\n\nTransfer DANA ke:\n📱 *085813899649* (Admin ALTOGEN)\n\nKetik jumlah yang ingin di-deposit:\n\nKetik *batal* untuk keluar.`);
      } else {
        await client.sendMessage(msg.from, saldoMenu(parseFloat(user.balance as string)));
      }
      break;
    }

    case "saldo_tarik_ewallet": {
      if (body.toLowerCase() === "batal" || body === "0") {
        await setMenuState(phone, "saldo");
        await client.sendMessage(msg.from, saldoMenu(parseFloat(user.balance as string)));
      } else {
        await setMenuState(phone, "saldo_tarik_nomor", JSON.stringify({ ewalletType: body }));
        await client.sendMessage(msg.from, `💸 *TARIK SALDO*\n\nJenis E-Wallet: *${body}*\n\nKetik *nomor* e-wallet kamu:`);
      }
      break;
    }

    case "saldo_tarik_nomor": {
      if (body.toLowerCase() === "batal" || body === "0") {
        await setMenuState(phone, "saldo");
        await client.sendMessage(msg.from, saldoMenu(parseFloat(user.balance as string)));
      } else {
        const tempData = user.tempData ? JSON.parse(user.tempData) : {};
        await setMenuState(phone, "saldo_tarik_nama_ewallet", JSON.stringify({ ...tempData, ewalletNumber: body }));
        await client.sendMessage(msg.from, `💸 *TARIK SALDO*\n\nNomor E-Wallet: *${body}*\n\nKetik *nama* pemilik rekening:`);
      }
      break;
    }

    case "saldo_tarik_nama_ewallet": {
      if (body.toLowerCase() === "batal" || body === "0") {
        await setMenuState(phone, "saldo");
        await client.sendMessage(msg.from, saldoMenu(parseFloat(user.balance as string)));
      } else {
        const tempData = user.tempData ? JSON.parse(user.tempData) : {};
        // Save ewallet data
        await db.update(usersTable).set({
          ewalletType: tempData.ewalletType,
          ewalletNumber: tempData.ewalletNumber,
          ewalletName: body,
        }).where(eq(usersTable.phone, phone));

        const bal = parseFloat(user.balance as string);
        await setMenuState(phone, "saldo_tarik_jumlah");
        await client.sendMessage(msg.from, `✅ Data e-wallet tersimpan!\n\n💳 E-Wallet: *${tempData.ewalletType} - ${tempData.ewalletNumber}*\n👤 Nama: *${body}*\n\nKetik jumlah yang ingin ditarik (min. Rp 100.000):\n💰 Saldo tersedia: *${formatCurrency(bal)}*`);
      }
      break;
    }

    case "saldo_tarik_jumlah": {
      if (body.toLowerCase() === "batal" || body === "0") {
        await setMenuState(phone, "saldo");
        await client.sendMessage(msg.from, saldoMenu(parseFloat(user.balance as string)));
      } else {
        const amount = parseInt(body.replace(/[^0-9]/g, ""));
        const bal = parseFloat(user.balance as string);
        if (isNaN(amount) || amount < 100000) {
          await client.sendMessage(msg.from, `❌ Jumlah tidak valid!\nMinimum penarikan: *Rp 100.000*\n\nCoba lagi atau ketik *batal*.`);
        } else if (amount > bal) {
          await client.sendMessage(msg.from, `❌ Saldo tidak mencukupi!\nSaldo: *${formatCurrency(bal)}*\nJumlah ditarik: *${formatCurrency(amount)}*\n\nCoba lagi atau ketik *batal*.`);
        } else {
          await db.insert(transactionsTable).values({
            userId: user.id,
            type: "withdraw",
            amount: String(amount),
            status: "pending",
            notes: `Tarik ke ${user.ewalletType} - ${user.ewalletNumber} (${user.ewalletName})`,
          });
          await setMenuState(phone, "main");
          await client.sendMessage(msg.from, `✅ *PERMINTAAN TARIK SALDO DIKIRIM!*\n\n💸 Jumlah: *${formatCurrency(amount)}*\n💳 Tujuan: *${user.ewalletType} - ${user.ewalletNumber}*\n👤 Nama: *${user.ewalletName}*\n\nPermintaan sedang diproses admin dalam 1x24 jam.\n\n${mainMenu()}`);
        }
      }
      break;
    }

    case "saldo_deposit": {
      if (body.toLowerCase() === "batal" || body === "0") {
        await setMenuState(phone, "saldo");
        await client.sendMessage(msg.from, saldoMenu(parseFloat(user.balance as string)));
      } else if (!isNaN(parseInt(body.replace(/[^0-9]/g, "")))) {
        const amount = parseInt(body.replace(/[^0-9]/g, ""));
        await setMenuState(phone, "saldo_deposit_bukti", JSON.stringify({ amount }));
        await client.sendMessage(msg.from, `💳 *DEPOSIT*\n\nJumlah: *${formatCurrency(amount)}*\n\nTransfer ke DANA:\n📱 *085813899649* (Admin ALTOGEN)\n\nLalu kirim *foto bukti transfer* ke sini!\n\nKetik *batal* untuk keluar.`);
      } else if (msg.hasMedia) {
        // proof sent
        const tempData = user.tempData ? JSON.parse(user.tempData) : null;
        if (tempData?.amount) {
          await db.insert(transactionsTable).values({
            userId: user.id,
            type: "deposit",
            amount: String(tempData.amount),
            status: "pending",
            notes: "Deposit via DANA",
          });
          await setMenuState(phone, "main");
          await client.sendMessage(msg.from, `✅ *BUKTI DEPOSIT DITERIMA!*\n\nDeposit *${formatCurrency(tempData.amount)}* sedang diverifikasi.\nSaldo akan ditambahkan dalam 1x24 jam.\n\n${mainMenu()}`);
        }
      } else {
        await client.sendMessage(msg.from, `💳 Ketik *jumlah* yang ingin di-deposit:\nContoh: 50000\n\nKetik *batal* untuk keluar.`);
      }
      break;
    }

    case "saldo_deposit_bukti": {
      if (body.toLowerCase() === "batal" || body === "0") {
        await setMenuState(phone, "saldo");
        await client.sendMessage(msg.from, saldoMenu(parseFloat(user.balance as string)));
      } else if (msg.hasMedia) {
        const tempData = user.tempData ? JSON.parse(user.tempData) : null;
        if (tempData?.amount) {
          let proofUrl: string | null = null;
          try {
            const media = await msg.downloadMedia();
            proofUrl = await saveProofImage(media.data, media.mimetype);
          } catch {}
          await db.insert(transactionsTable).values({
            userId: user.id,
            type: "deposit",
            amount: String(tempData.amount),
            status: "pending",
            notes: `Deposit via DANA - ${user.name} (${phone})`,
            proofUrl,
          });
          await setMenuState(phone, "main");
          await client.sendMessage(msg.from,
            `✅ *BUKTI DEPOSIT DITERIMA!*\n━━━━━━━━━━━━━━━━━━━━━━\n\n💳 Jumlah: *${formatCurrency(tempData.amount)}*\n📸 Bukti transfer sudah kami terima\n\n_Saldo akan ditambahkan setelah admin verifikasi (maks 1x24 jam)_\n\n${mainMenu()}`
          );
        } else {
          await client.sendMessage(msg.from, `⚠️ Terjadi kesalahan. Silakan mulai ulang deposit dari menu SALDO.\n\n${mainMenu()}`);
          await setMenuState(phone, "main");
        }
      } else {
        const tempData = user.tempData ? JSON.parse(user.tempData) : null;
        if (tempData?.amount) {
          await client.sendMessage(msg.from, `💳 Silakan kirim *foto bukti transfer* DANA senilai *${formatCurrency(tempData.amount)}*!\n\nKetik *batal* untuk keluar.`);
        }
      }
      break;
    }

    case "profil": {
      if (body === "0") {
        await setMenuState(phone, "main");
        await client.sendMessage(msg.from, mainMenu());
      } else if (body === "1") {
        await setMenuState(phone, "profil_edit_nama");
        await client.sendMessage(msg.from, `👤 *EDIT NAMA*\n\nNama saat ini: *${user.name}*\n\nKetik nama baru kamu:\nKetik *batal* untuk keluar.`);
      } else if (body === "2") {
        await setMenuState(phone, "saldo_tarik_ewallet");
        await client.sendMessage(msg.from, `💳 *EDIT E-WALLET*\n\nKetik jenis e-wallet kamu:\n_Contoh: DANA / OVO / GoPay / ShopeePay_`);
      } else {
        await client.sendMessage(msg.from, `1️⃣ Edit Nama\n2️⃣ Edit E-Wallet\n0️⃣ ◀ Kembali`);
      }
      break;
    }

    case "profil_edit_nama": {
      if (body.toLowerCase() === "batal" || body === "0") {
        await setMenuState(phone, "profil");
        await client.sendMessage(msg.from, `👤 Profil\n1️⃣ Edit Nama\n2️⃣ Edit E-Wallet\n0️⃣ ◀ Kembali`);
      } else {
        await db.update(usersTable).set({ name: body }).where(eq(usersTable.phone, phone));
        await setMenuState(phone, "main");
        await client.sendMessage(msg.from, `✅ Nama berhasil diubah menjadi *${body}*!\n\n${mainMenu()}`);
      }
      break;
    }

    default: {
      await setMenuState(phone, "main");
      await client.sendMessage(msg.from, welcomeMessage(user));
      await client.sendMessage(msg.from, mainMenu());
    }
  }
}

export function initBot() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "/home/runner/.wwebjs_auth" }),
    puppeteer: {
      headless: true,
      executablePath: "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium-browser",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-sync",
        "--disable-translate",
        "--hide-scrollbars",
        "--metrics-recording-only",
        "--mute-audio",
        "--safebrowsing-disable-auto-update",
        "--ignore-certificate-errors",
        "--ignore-ssl-errors",
        "--ignore-certificate-errors-spki-list",
      ],
    },
  });

  // Expose client globally for WA notifications from admin routes
  activeClient = client;

  client.on("qr", async (qr) => {
    console.log("QR Code received, scan to connect WhatsApp!");
    try {
      const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 300 });
      botStatus = { connected: false, phone: null, qrCode: qrDataUrl, status: "waiting_qr" };
    } catch (err) {
      console.error("Failed to generate QR image:", err);
      botStatus = { connected: false, phone: null, qrCode: null, status: "waiting_qr" };
    }
  });

  client.on("ready", async () => {
    const info = await client.getState();
    console.log("WhatsApp Bot connected!");
    botStatus = { connected: true, phone: null, qrCode: null, status: "connected" };
  });

  client.on("authenticated", () => {
    console.log("WhatsApp Bot authenticated!");
    botStatus = { ...botStatus, status: "authenticated", qrCode: null };
  });

  client.on("auth_failure", (msg) => {
    console.error("WhatsApp auth failure:", msg);
    botStatus = { connected: false, phone: null, qrCode: null, status: "auth_failed" };
    // Auto-reinitialize after auth failure
    setTimeout(() => {
      console.log("Reinitializing WhatsApp bot after auth failure...");
      botStatus = { connected: false, phone: null, qrCode: null, status: "initializing" };
      initBot();
    }, 5000);
  });

  client.on("disconnected", (reason) => {
    console.log("WhatsApp Bot disconnected:", reason);
    botStatus = { connected: false, phone: null, qrCode: null, status: "disconnected" };
    // Auto-reinitialize on disconnect
    setTimeout(() => {
      console.log("Reinitializing WhatsApp bot after disconnect...");
      botStatus = { connected: false, phone: null, qrCode: null, status: "initializing" };
      initBot();
    }, 5000);
  });

  client.on("message", async (msg) => {
    try {
      await handleMessage(client, msg);
    } catch (err) {
      console.error("Error handling message:", err);
    }
  });

  client.initialize().catch(err => {
    console.error("Failed to initialize WhatsApp client:", err);
    botStatus = { connected: false, phone: null, qrCode: null, status: "error" };
    // Auto-reinitialize on init failure
    setTimeout(() => {
      console.log("Reinitializing WhatsApp bot after init failure...");
      botStatus = { connected: false, phone: null, qrCode: null, status: "initializing" };
      initBot();
    }, 10000);
  });

  return client;
}
