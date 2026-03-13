import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable, announcementsTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { sendBotMessage } from "../bot/whatsapp";

function formatCurrencyAdmin(amount: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

const router: IRouter = Router();

const ADMIN_PHONE = "085813899649";
const ADMIN_TOKEN = "altogen-admin-secret-token-2024";

function requireAdmin(req: Request, res: Response, next: () => void) {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ADMIN_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.post("/admin/login", (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone || phone.replace(/\s/g, "") !== ADMIN_PHONE) {
    res.status(401).json({ error: "Nomor bukan admin" });
    return;
  }
  res.json({ success: true, token: ADMIN_TOKEN, phone: ADMIN_PHONE });
});

router.get("/admin/check", requireAdmin, (_req: Request, res: Response) => {
  res.json({ valid: true, phone: ADMIN_PHONE });
});

router.get("/admin/stats", requireAdmin, async (_req: Request, res: Response) => {
  const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const now = new Date();
  const [activePackages] = await db.select({ count: sql<number>`count(*)` }).from(usersTable)
    .where(sql`package_expiry > ${now}`);
  const [pendingTx] = await db.select({ count: sql<number>`count(*)` }).from(transactionsTable)
    .where(eq(transactionsTable.status, "pending"));
  const [totalBalanceRow] = await db.select({ total: sql<string>`coalesce(sum(balance::numeric),0)` }).from(usersTable);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayCheckins] = await db.select({ count: sql<number>`count(*)` }).from(usersTable)
    .where(sql`last_checkin >= ${today}`);

  res.json({
    totalUsers: Number(usersCount.count),
    activePackages: Number(activePackages.count),
    pendingTransactions: Number(pendingTx.count),
    totalBalance: parseFloat(totalBalanceRow.total),
    todayCheckins: Number(todayCheckins.count),
  });
});

router.get("/admin/users", requireAdmin, async (_req: Request, res: Response) => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const mapped = users.map(u => ({
    id: u.id,
    phone: u.phone,
    name: u.name,
    referralCode: u.referralCode,
    referredBy: u.referredBy,
    balance: parseFloat(u.balance as string),
    ewalletType: u.ewalletType,
    ewalletNumber: u.ewalletNumber,
    ewalletName: u.ewalletName,
    isBlocked: u.isBlocked,
    packageExpiry: u.packageExpiry?.toISOString() ?? null,
    lastCheckin: u.lastCheckin?.toISOString() ?? null,
    videosWatched: u.videosWatched,
    createdAt: u.createdAt.toISOString(),
  }));
  res.json({ users: mapped, total: mapped.length });
});

router.get("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!u) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ user: {
    id: u.id, phone: u.phone, name: u.name, referralCode: u.referralCode,
    referredBy: u.referredBy, balance: parseFloat(u.balance as string),
    ewalletType: u.ewalletType, ewalletNumber: u.ewalletNumber, ewalletName: u.ewalletName,
    isBlocked: u.isBlocked, packageExpiry: u.packageExpiry?.toISOString() ?? null,
    lastCheckin: u.lastCheckin?.toISOString() ?? null,
    videosWatched: u.videosWatched, createdAt: u.createdAt.toISOString(),
  }});
});

router.put("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { name, balance, isBlocked, ewalletType, ewalletNumber, ewalletName } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (balance !== undefined) updateData.balance = String(balance);
  if (isBlocked !== undefined) updateData.isBlocked = isBlocked;
  if (ewalletType !== undefined) updateData.ewalletType = ewalletType;
  if (ewalletNumber !== undefined) updateData.ewalletNumber = ewalletNumber;
  if (ewalletName !== undefined) updateData.ewalletName = ewalletName;

  const [updated] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ user: {
    id: updated.id, phone: updated.phone, name: updated.name, referralCode: updated.referralCode,
    referredBy: updated.referredBy, balance: parseFloat(updated.balance as string),
    ewalletType: updated.ewalletType, ewalletNumber: updated.ewalletNumber, ewalletName: updated.ewalletName,
    isBlocked: updated.isBlocked, packageExpiry: updated.packageExpiry?.toISOString() ?? null,
    lastCheckin: updated.lastCheckin?.toISOString() ?? null,
    videosWatched: updated.videosWatched, createdAt: updated.createdAt.toISOString(),
  }});
});

router.delete("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await db.delete(transactionsTable).where(eq(transactionsTable.userId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ success: true, message: "User deleted" });
});

router.post("/admin/users/:id/block", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { blocked } = req.body;
  await db.update(usersTable).set({ isBlocked: blocked }).where(eq(usersTable.id, id));
  res.json({ success: true, message: blocked ? "User blocked" : "User unblocked" });
});

router.get("/admin/transactions", requireAdmin, async (req: Request, res: Response) => {
  const { status, type } = req.query as { status?: string; type?: string };
  const conditions = [];
  if (status) conditions.push(eq(transactionsTable.status, status));
  if (type) conditions.push(eq(transactionsTable.type, type));

  const txList = conditions.length > 0
    ? await db.select({
        tx: transactionsTable,
        phone: usersTable.phone,
        name: usersTable.name,
      }).from(transactionsTable)
        .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
        .where(and(...conditions))
        .orderBy(desc(transactionsTable.createdAt))
    : await db.select({
        tx: transactionsTable,
        phone: usersTable.phone,
        name: usersTable.name,
      }).from(transactionsTable)
        .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
        .orderBy(desc(transactionsTable.createdAt));

  const mapped = txList.map(({ tx, phone, name }) => ({
    id: tx.id,
    userId: tx.userId,
    userPhone: phone ?? "",
    userName: name ?? "",
    type: tx.type,
    amount: parseFloat(tx.amount as string),
    status: tx.status,
    notes: tx.notes,
    proofUrl: tx.proofUrl,
    packageDays: tx.packageDays,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  }));
  res.json({ transactions: mapped, total: mapped.length });
});

router.post("/admin/transactions/:id/confirm", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { action, notes } = req.body;

  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));
  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (tx.status !== "pending") { res.status(400).json({ error: "Transaction already processed" }); return; }

  const newStatus = action === "approve" ? "approved" : "rejected";
  await db.update(transactionsTable).set({
    status: newStatus,
    notes: notes ?? tx.notes,
    updatedAt: new Date(),
  }).where(eq(transactionsTable.id, id));

  if (action === "approve") {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, tx.userId));
    if (user) {
      if (tx.type === "deposit" || tx.type === "referral" || tx.type === "checkin" || tx.type === "video") {
        const newBal = parseFloat(user.balance as string) + parseFloat(tx.amount as string);
        await db.update(usersTable).set({ balance: String(newBal) }).where(eq(usersTable.id, tx.userId));
        // Notify user via WhatsApp
        const waPhone = user.phone.replace("@c.us", "").replace("@lid", "");
        await sendBotMessage(waPhone,
          `✅ *DEPOSIT DISETUJUI!*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🎉 Deposit kamu telah dikonfirmasi!\n💰 Jumlah: *${formatCurrencyAdmin(parseFloat(tx.amount as string))}*\n💰 Saldo terbaru: *${formatCurrencyAdmin(newBal)}*\n\nTerima kasih telah menggunakan ALTOGEN! 🙏`
        );
      } else if (tx.type === "withdraw") {
        const newBal = Math.max(0, parseFloat(user.balance as string) - parseFloat(tx.amount as string));
        await db.update(usersTable).set({ balance: String(newBal) }).where(eq(usersTable.id, tx.userId));
        // Notify user via WhatsApp
        const waPhone = user.phone.replace("@c.us", "").replace("@lid", "");
        await sendBotMessage(waPhone,
          `✅ *PENARIKAN DIPROSES!*\n━━━━━━━━━━━━━━━━━━━━━━\n\n💸 Penarikan sebesar *${formatCurrencyAdmin(parseFloat(tx.amount as string))}* sedang diproses.\n💰 Saldo terbaru: *${formatCurrencyAdmin(newBal)}*\n\nDana akan masuk dalam 1x24 jam. Terima kasih! 🙏`
        );
      } else if (tx.type === "package" && tx.packageDays) {
        const now = new Date();
        const expiry = user.packageExpiry && user.packageExpiry > now
          ? new Date(user.packageExpiry.getTime() + tx.packageDays * 86400000)
          : new Date(now.getTime() + tx.packageDays * 86400000);
        await db.update(usersTable).set({ packageExpiry: expiry }).where(eq(usersTable.id, tx.userId));
        // Notify user via WhatsApp
        const waPhone = user.phone.replace("@c.us", "").replace("@lid", "");
        const expiryStr = expiry.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        await sendBotMessage(waPhone,
          `✅ *PAKET AKTIF!*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🎉 Paket *${tx.packageDays} hari* kamu sudah aktif!\n📅 Berlaku hingga: *${expiryStr}*\n\nSekarang kamu bisa menggunakan fitur Generator AI.\nKetik *3* di menu utama untuk mulai. 🚀`
        );
      }
    }
  } else {
    // Rejected — notify user
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, tx.userId));
    if (user) {
      const waPhone = user.phone.replace("@c.us", "").replace("@lid", "");
      const typeLabel = tx.type === "deposit" ? "Deposit" : tx.type === "package" ? "Pembelian Paket" : "Penarikan";
      await sendBotMessage(waPhone,
        `❌ *${typeLabel.toUpperCase()} DITOLAK*\n━━━━━━━━━━━━━━━━━━━━━━\n\n${typeLabel} sebesar *${formatCurrencyAdmin(parseFloat(tx.amount as string))}* tidak dapat diproses.\n\n${notes ? `📝 Alasan: _${notes}_\n\n` : ""}Silakan hubungi admin untuk informasi lebih lanjut.`
      );
    }
  }

  res.json({ success: true, message: `Transaction ${newStatus}` });
});

router.get("/admin/announcements", requireAdmin, async (_req: Request, res: Response) => {
  const announcements = await db.select().from(announcementsTable).orderBy(desc(announcementsTable.createdAt));
  res.json({ announcements: announcements.map(a => ({
    id: a.id, message: a.message, createdAt: a.createdAt.toISOString()
  }))});
});

router.post("/admin/announcements", requireAdmin, async (req: Request, res: Response) => {
  const { message } = req.body;
  if (!message) { res.status(400).json({ error: "Message required" }); return; }
  const [a] = await db.insert(announcementsTable).values({ message }).returning();
  res.status(201).json({ announcement: { id: a.id, message: a.message, createdAt: a.createdAt.toISOString() } });
});

router.delete("/admin/announcements/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  res.json({ success: true, message: "Deleted" });
});

export default router;
