# ALTOGEN WhatsApp Bot System

## Overview

ALTOGEN is a WhatsApp bot system with an AI generator feature. The bot connects to WhatsApp via QR code scan and handles users via message-based menus. The admin panel is a React web application.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **WhatsApp**: whatsapp-web.js (QR scan based)
- **AI**: OpenAI GPT-4o (Prompt Generator), Replicate minimax/video-01 (Video Generator)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui

## Structure

```text
artifacts/
  admin-panel/       # React admin web panel (runs at /)
  api-server/        # Express API + WhatsApp bot
    src/
      bot/whatsapp.ts   # Full WhatsApp bot logic
      routes/admin.ts   # All admin API routes
      routes/bot.ts     # Bot status route
lib/
  db/                # Drizzle ORM schema (users, transactions, announcements)
  api-spec/          # OpenAPI spec + Orval codegen
  api-zod/           # Generated Zod schemas
  api-client-react/  # Generated React Query hooks
```

## Admin Panel

- URL: `/`
- Login: Phone `085813899649` (no password)
- Features: Dashboard stats, User management, Transaction approval, Announcements

## Bot Features

### Menus (navigate with 1-5, 0=back, 00=main menu)
1. **HOME** - User info + announcements
2. **BONUS** - Packages, daily check-in (Rp50), referral (Rp500/invite), watch video (Rp50, max 20x/day)
3. **GEN** - Prompt Generator (OpenAI) + Video Generator (Replicate)
4. **SALDO** - Balance, withdraw (min Rp100k), deposit via DANA
5. **PROFIL** - User profile, edit name/e-wallet

### Packages
- 7 days = Rp 15.000
- 10 days = Rp 25.000
- 30 days = Rp 60.000

## API Keys
- OpenAI: sk-svcacct-...
- Replicate: r8_fGbDN...

## Admin Token

`altogen-admin-secret-token-2024` — used as Bearer token in Authorization header

## Bot Connection

WhatsApp bot connects via QR code (visible in admin dashboard). Auth stored at `/home/runner/.wwebjs_auth`.

## Database Schema

- `users` — phone, name, referralCode, referredBy, balance, ewallet info, isBlocked, packageExpiry, lastCheckin, videosWatched
- `transactions` — userId, type (deposit/withdraw/package/checkin/referral/video), amount, status (pending/approved/rejected), notes, proofUrl, packageDays
- `announcements` — message, createdAt
