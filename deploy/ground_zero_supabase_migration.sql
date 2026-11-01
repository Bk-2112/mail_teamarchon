-- ==============================================================================
-- Team Archon Mail - Ground Zero Supabase Database Migration
-- Execute this script in your Supabase Project -> SQL Editor
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop legacy tables if doing a 100% clean wipe
-- DROP TABLE IF EXISTS public.group_mailboxes CASCADE;
-- DROP TABLE IF EXISTS public.group_members CASCADE;
-- DROP TABLE IF EXISTS public.groups CASCADE;
-- DROP TABLE IF EXISTS public.audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.user_mailboxes CASCADE;
-- DROP TABLE IF EXISTS public.mailboxes CASCADE;
-- DROP TABLE IF EXISTS public.users CASCADE;

-- 1. Users Table: Provisioned by Admin with Salted & Hashed PBKDF2 Credentials
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id VARCHAR(64) UNIQUE,
    discord_username VARCHAR(100),
    discord_avatar VARCHAR(255),
    display_name VARCHAR(100),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- PBKDF2-HMAC-SHA256 (128-bit salt, 100k iterations)
    roles TEXT[] DEFAULT '{member}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Mailboxes Table: Physical accounts on VPS Stalwart Mail Server
CREATE TABLE IF NOT EXISTS public.mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    imap_host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
    imap_port INT NOT NULL DEFAULT 993,
    imap_ssl BOOLEAN NOT NULL DEFAULT true,
    smtp_host VARCHAR(255) NOT NULL DEFAULT '127.0.0.1',
    smtp_port INT NOT NULL DEFAULT 465,
    smtp_ssl BOOLEAN NOT NULL DEFAULT true,
    encrypted_password TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. User to Mailbox Access Control (Direct RBAC)
CREATE TABLE IF NOT EXISTS public.user_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'member', 'read_only'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, mailbox_id)
);

-- 4. Groups / Distribution Lists Table
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Group Members Table (Users assigned to Groups)
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- 6. Group Mailboxes Table (Mailboxes assigned to Groups)
CREATE TABLE IF NOT EXISTS public.group_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, mailbox_id)
);

-- 7. Audit Log Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_mailboxes_email ON public.mailboxes(email);
CREATE INDEX IF NOT EXISTS idx_user_mailboxes_user_id ON public.user_mailboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_mailboxes_mailbox_id ON public.group_mailboxes(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 9. Insert Primary Admin Mailbox (Stalwart on VPS)
INSERT INTO public.mailboxes (email, display_name, imap_host, imap_port, imap_ssl, smtp_host, smtp_port, smtp_ssl, encrypted_password, is_active)
VALUES (
    'admin@teamarchon.in',
    'Team Archon Admin',
    '127.0.0.1',
    993,
    true,
    '127.0.0.1',
    465,
    true,
    'ArchonAdmin2026!',
    true
)
ON CONFLICT (email) DO UPDATE SET encrypted_password = 'ArchonAdmin2026!';
