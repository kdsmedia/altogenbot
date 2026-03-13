import { pgTable, text, serial, boolean, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull().default("Pengguna"),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: text("referred_by"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  ewalletType: text("ewallet_type"),
  ewalletNumber: text("ewallet_number"),
  ewalletName: text("ewallet_name"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  packageExpiry: timestamp("package_expiry"),
  lastCheckin: timestamp("last_checkin"),
  videosWatched: integer("videos_watched").notNull().default(0),
  videosWatchedDate: text("videos_watched_date"),
  menuState: text("menu_state").default("main"),
  tempData: text("temp_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
