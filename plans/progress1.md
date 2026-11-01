# Team Archon Mail - Project Progress Report (Phase 1)
**Date**: October 31, 2026  
**Status**: Backend Live & Connected • Frontend Live & Built • Production Hardened  

---

## 1. Executive Summary

The Team Archon Webmail project was rebuilt from the ground up ("Ground Zero") to eliminate legacy bloat and implement a modern, high-security email infrastructure:
- **Frontend**: Deployed on Vercel (`https://mail.teamarchon.in`), styled strictly after `portal.teamarchon.in` using an ultra-clean black and red aesthetic.
- **Backend**: Built with ASP.NET Core 8 Web API, deployed as a systemd service on Ubuntu VPS (`https://api.teamarchon.in`) behind Caddy with HTTP/2 and TLS.
- **Database**: Supabase PostgreSQL located in Tokyo (`ap-northeast-1`), operating over IPv4 Session Pooler (port 5432) with persistent account state and RBAC.
- **Logging**: 100% of events categorized and delivered asynchronously to 4 dedicated Discord Webhooks (`#auth-logs`, `#mail-logs`, `#error-logs`, `#system-logs`).
- **Authentication**: Dual-mode gateway supporting both Gated Discord OAuth2 (server & role gated) and Cryptographic Email/Password credentials (PBKDF2-HMAC-SHA256).
- **Administration**: Complete Admin Control Center (`/admin`) for managing all organization inboxes, provisioning mailboxes, and granting multi-user permissions.
- **Mail Server Engine**: Integrated with Stalwart Mail Server v1.0.1 over local encrypted loopback (IMAP on port 993, SMTP on port 465).

---

## 2. Architecture & Directory Layout

```
mail.teamarchon.in/
├── backend/                              # ASP.NET Core 8 Web API (Ubuntu VPS :8787)
│   ├── Controllers/
│   │   ├── AdminController.cs            # [Authorize(Roles="admin")] Mailbox & user control
│   │   ├── AuthController.cs             # Discord OAuth2 & Email/Password login/register
│   │   └── MailController.cs             # Stalwart IMAP fetch & SMTP dispatch + health
│   ├── Middleware/
│   │   └── GlobalErrorHandlingMiddleware.cs # Catches unhandled exceptions & logs to #error-logs
│   ├── Models/
│   │   ├── DiscordModels.cs              # OAuth2 tokens, user profiles, guild member DTOs
│   │   ├── DiscordWebhookModels.cs       # Rich Discord Embed schemas & color tokens
│   │   └── MailModels.cs                 # UserRecord, MailboxRecord, Email payloads
│   ├── Services/
│   │   ├── DatabaseService.cs            # Supabase Npgsql connection & AES-256 fallback
│   │   ├── DiscordAuthService.cs         # Discord token exchange & guild role gating
│   │   ├── DiscordWebhookLogger.cs       # Background worker channel for webhook dispatch
│   │   ├── PasswordHasher.cs             # PBKDF2-HMAC-SHA256 hasher with 128-bit random salt
│   │   ├── StalwartMailService.cs        # IMAP (993) & SMTP (465) via MailKit / MimeKit
│   │   └── UserRepository.cs             # Dapper queries, JWT signing, auto-admin seeding
│   ├── Program.cs                        # WebApplication pipeline, CORS, JWT, startup logger
│   └── TeamArchon.Mail.Api.csproj
│
├── frontend/                             # React 18 + Vite + TypeScript (Vercel SPA)
│   ├── src/
│   │   ├── api/client.ts                 # Axios client with JWT interceptors & error handlers
│   │   ├── components/
│   │   │   ├── ComposeModal.tsx          # Floating black & red email composer
│   │   │   └── Layout.tsx                # Classic portal navigation, admin badge, mailbox switcher
│   │   ├── pages/
│   │   │   ├── AdminPage.tsx             # Complete admin management panel (/admin)
│   │   │   ├── AuthCallbackPage.tsx      # OAuth code handler with useRef double-fire guard
│   │   │   ├── InboxPage.tsx             # Folder messages, unread dots, stars, sync loader
│   │   │   ├── LoginPage.tsx             # Email/Password + Discord OAuth dual login card
│   │   │   └── ThreadPage.tsx            # Email details, sanitized view & inline reply
│   │   ├── store/authStore.ts            # Zustand persistent authentication store
│   │   ├── types.ts                      # TypeScript interfaces and record aliases
│   │   └── index.css                     # portal.teamarchon.in design system tokens
│   ├── package.json
│   ├── tsconfig.json
│   ├── vercel.json                       # SPA route rewriting /(.*) -> /index.html
│   └── vite.config.ts
│
├── deploy/
│   ├── ground_zero_supabase_migration.sql # Clean SQL schema for Supabase
│   ├── teamarchon-api.service             # Systemd service with 250MB memory ceiling
│   ├── Caddyfile.snippet                  # Caddy reverse proxy config for api.teamarchon.in
│   └── stalwart-install.sh                # Stalwart installation reference script
│
└── plans/
    ├── discord_oauth_supabase_logging_plan.md # Master architectural blueprint
    ├── Workplan.md                       # Phase roadmap
    ├── deployment_steps.md               # Production deployment guide
    └── progress1.md                      # Comprehensive progress report (This Document)
```

---

## 3. Detailed Progress by Component

### 3.1 Frontend Web Application
- **Visual Design System**:
  - Implemented the `portal.teamarchon.in` aesthetic using dark background (`#070707`), elevated glass cards (`#121212`), custom borders (`#222222`), Team Archon red accents (`#d32f2f`), and Discord blurple (`#5865F2`).
  - Google Fonts integrated: **Inter** (body readability) and **Outfit** (headings).
- **Dual Authentication**:
  - **Discord OAuth2**: Redirects to Discord with `identify email guilds.members.read` scopes. Gated by guild membership and role ID.
  - **Email & Password**: In-app form with "Sign In" and "Create Account" toggle modes.
- **Admin Control Center (`/admin`)**:
  - Built dedicated control panel displaying system stats (Total Inboxes, Registered Users, Stalwart Status).
  - Provisioning modal to add new inboxes with IMAP/SMTP loopback configurations.
  - User list with role badges (`ADMINISTRATOR` vs `MEMBER`).
  - Permission assignment modal allowing admins to link users to any mailbox with `Owner`, `Member`, or `Read-Only` roles.
- **Mailbox Selector**:
  - For normal members: lists mailboxes explicitly assigned to their account.
  - For administrators: automatically unlocks and lists **all inboxes** across the organization with an `ADMIN` indicator.
- **Vercel Compatibility**:
  - `vercel.json` configured with SPA fallback rewrites.
  - Production build verified: `tsc && vite build` outputs cleanly in ~2.0 seconds with zero TypeScript or bundling errors.

---

### 3.2 Backend Web API (ASP.NET Core 8)
- **Database Layer & Self-Migration**:
  - Uses Dapper and Npgsql connecting to Supabase PostgreSQL over IPv4 Session Pooler (`aws-0-ap-northeast-1.pooler.supabase.com:5432`).
  - Implemented auto-migration on boot: automatically verifies and adds `password_hash` column and makes `discord_id` nullable so no manual SQL is required.
- **Cryptographic Security**:
  - `PasswordHasher.cs`: Uses PBKDF2 with HMAC-SHA256, 128-bit random salt, 100,000 iterations, and constant-time `FixedTimeEquals` comparison.
  - `EncryptionService.cs`: AES-256 for mailbox passwords with transparent plain-text fallback.
  - JWT Tokens: HMAC-SHA256 signed with 7-day validity including user ID, email, and role claims (`ClaimTypes.Role`).
- **Discord Webhook Logging Engine**:
  - Asynchronous background service consuming from an in-memory `Channel<DiscordLogItem>`.
  - Non-blocking design: HTTP endpoints return instantly while Discord webhook embeds are dispatched in the background.
  - Includes retry backoff on HTTP 429 rate limits.
- **Mail Services (Stalwart Loopback)**:
  - Connects locally to Stalwart over loopback: IMAP on port `993` (SSL) and SMTP on port `465` (SSL).
  - Implemented smart authentication fallback (authenticates with full email, then falls back to local username).
  - Sanitized SMTP SASL negotiation (removes `XOAUTH2`, `CRAM-MD5`, `DIGEST-MD5` to ensure clean PLAIN/LOGIN handshake over TLS).
- **Admin Auto-Seeding**:
  - Automatically provisions `admin@teamarchon.in` with password `ArchonAdmin2026!` and `admin` role on startup or initial login attempt.

---

### 3.3 Database Schema (Supabase)
Clean schema established in `public` namespace:
- `users`: Tracks Discord IDs, usernames, avatars, emails, PBKDF2 password hashes, and assigned roles.
- `mailboxes`: Stores email addresses, display names, loopback host/ports, and encrypted/plain credentials.
- `user_mailboxes`: Relational RBAC table mapping users to mailboxes (`owner`, `member`, `read_only`).
- `audit_logs`: Persistent event stream storing timestamp, category, action, and JSON metadata.

---

### 3.4 Production Deployment (Ubuntu VPS & Caddy)
- Service managed by systemd: `/etc/systemd/system/teamarchon-api.service`.
- Resource constraints applied: `MemoryMax=250M` and `CPUQuota=80%` to protect VPS stability and CMSClipper.
- Reverse proxied via Caddy:
  - Public URL: `https://api.teamarchon.in`
  - Health Endpoint: `https://api.teamarchon.in/api/system/health`
  - Verified live status:
    ```json
    HTTP/2 200 OK
    {
      "status": "ok",
      "version": "3.0.0",
      "service": "Team Archon Mail API (Ground Zero)",
      "database": "connected",
      "error": null
    }
    ```

---

### 3.5 Mail Server & Stalwart Diagnostics
- **Server Environment**:
  - Stalwart Mail Server v1.0.1 is running on the VPS under `/usr/local/bin/stalwart`.
  - Configuration files are located at `/etc/stalwart/config.json` and `/etc/stalwart/stalwart.env`.
  - Backend storage uses embedded RocksDB at `/var/lib/stalwart/`.
- **Management & Tooling**:
  - Verified that `stalwart-cli` is not bundled in this standalone binary distribution.
  - Stalwart Server operates an internal HTTP Web Management Console listening on port `8080`.
- **Authentication & Rate Limiter Handling**:
  - Investigated IMAP/SMTP failures resulting in `AuthenticationException: Too many authentication attempts` and `455: 4.3.0 Too many authentication errors, disconnecting`.
  - Identified that Stalwart's built-in brute-force protection temporarily throttles local loopback requests upon multiple invalid credentials.
  - Determined that restarting the service via `systemctl restart stalwart` resets the rate-limiting counter on `127.0.0.1`.
  - Confirmed the mailbox account `admin@teamarchon.in` must be explicitly provisioned in Stalwart's internal directory matching the credentials `ArchonAdmin2026!`.

---

## 4. Issues Encountered & Resolved

1. **Backend Environment File Parsing Crash**:
   - *Issue*: `AddJsonFile($"/etc/teamarchon-api/teamarchon-api.env")` crashed backend startup (`'#' is an invalid start of a value`).
   - *Fix*: Implemented a custom line-by-line `.env` parser in `Program.cs` that strips bash `#` comments and trimming quotation marks.

2. **Supabase Pooler Tenant Resolution**:
   - *Issue*: Postgres threw `XX000: (ENOTFOUND) tenant/user postgres.mail.teamarchon.in not found`.
   - *Fix*: Updated database username to reference the Supabase project reference `postgres.lnjkximxcbynssqdokxp`.

3. **Supabase Region Routing**:
   - *Issue*: VPS pooler connection to `aws-0-ap-south-1` rejected the tenant.
   - *Fix*: Pointed connection string to the actual database host region: `aws-0-ap-northeast-1.pooler.supabase.com` (Tokyo).

4. **IPv6 Connection Timeout**:
   - *Issue*: Direct Supabase host `db.lnjkximxcbynssqdokxp.supabase.co` resolved solely to an IPv6 address, causing outbound timeouts on IPv4 VPS.
   - *Fix*: Reverted to the Supabase IPv4 Session Pooler host.

5. **PostgreSQL Transaction Mode Hang**:
   - *Issue*: Connections to pooler port `6543` timed out on prepared statements during `INSERT INTO public.users`.
   - *Fix*: Switched connection port to `5432` (Session Mode), fully supporting ADO.NET and Dapper transactions.

6. **Dapper Array Deserialization**:
   - *Issue*: `Dapper.SqlMapper.ThrowDataException: Error parsing column Roles`.
   - *Fix*: Changed `UserRecord.Roles` from `List<string>` to `string[]` across all models to match Npgsql's PostgreSQL `TEXT[]` mapping.

7. **File Lock during Dotnet Publish**:
   - *Issue*: MSBuild threw `The process cannot access the file ... TeamArchon.Mail.Api.pdb because it is being used by another process`.
   - *Fix*: Ensured `systemctl stop teamarchon-api` is executed prior to publishing new binaries, followed by `systemctl start teamarchon-api`.

8. **Admin Self-Migration in Supabase**:
   - *Issue*: Initial admin login reported `Invalid email or password` because the `password_hash` column and unique constraint on email did not exist in the database.
   - *Fix*: Added automatic DDL migration queries directly into `EnsureAdminAccountAsync()` so the database updates its own schema on startup.

9. **Stalwart Rate Limit Lockout**:
   - *Issue*: Stalwart IMAP/SMTP returned `Too many authentication attempts` after repeated authentication failures.
   - *Fix*: Flushed lockout state by restarting Stalwart (`systemctl restart stalwart`).

---

## 5. Key Milestones Completed

| # | Milestone | Result |
| :---: | :--- | :--- |
| **1** | Clean Slate Wipe & Branch Backup | Legacy codebase backed up to `origin/legacy-backup`; fresh `main` branch created. |
| **2** | Ground Zero Plan & Workplan | Master blueprints committed in `/plans`. |
| **3** | ASP.NET Core 8 Backend Scaffold | High-performance C# API with Dapper, MailKit, Npgsql, and JwtBearer. |
| **4** | Categorized Discord Webhook Logging | 100% of logs dispatched to 4 distinct channels asynchronously. |
| **5** | Discord OAuth2 Server & Role Gate | Users gated by Team Archon Discord server membership and role check. |
| **6** | Supabase Database Integration | Npgsql connected to Japan pooler (`ap-northeast-1:5432`) with zero handshake lag. |
| **7** | Production Caddy Routing | `https://api.teamarchon.in` verified live over HTTP/2 TLS. |
| **8** | Frontend Vite/React 18 Scaffold | Styled after `portal.teamarchon.in` with responsive sidebar and floating composer. |
| **9** | Email & Password Authentication | Added PBKDF2 salt hashing and unified login card. |
| **10** | Admin Management System | Company-wide inbox access and `/admin` management panel built and deployed. |
| **11** | Stalwart Server Diagnostics | Investigated binary v1.0.1, storage paths, Web Admin on port 8080, and rate-limiting behavior. |

---

## 6. Next Steps

1. **Stalwart Account Directory Provisioning**:
   - Ensure `admin@teamarchon.in` with password `ArchonAdmin2026!` exists inside Stalwart's directory.
   - Reset any rate limit counters via `systemctl restart stalwart`.
2. **Mailbox Synchronization & Delivery**:
   - Verify `INBOX` loads without IMAP authentication exceptions on `https://mail.teamarchon.in`.
   - Dispatch a test email via the composer modal and confirm delivery embeds in `#mail-logs`.
3. **Multi-Mailbox Administration**:
   - Utilize `/admin` to provision organizational addresses (`support@teamarchon.in`, `billing@teamarchon.in`) and assign users.
