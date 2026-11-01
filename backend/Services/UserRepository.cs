using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Dapper;
using Microsoft.IdentityModel.Tokens;
using TeamArchon.Mail.Api.Models;

namespace TeamArchon.Mail.Api.Services;

public class UserRepository
{
    private readonly DatabaseService _db;
    private readonly IConfiguration _config;
    private readonly EncryptionService _encryption;
    private readonly IDiscordLogService _discordLogger;

    public UserRepository(
        DatabaseService db,
        IConfiguration config,
        EncryptionService encryption,
        IDiscordLogService discordLogger)
    {
        _db = db;
        _config = config;
        _encryption = encryption;
        _discordLogger = discordLogger;
    }

    public async Task<UserRecord?> GetUserByIdAsync(Guid userId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            SELECT id, discord_id AS DiscordId, discord_username AS DiscordUsername, 
                   discord_avatar AS DiscordAvatar, display_name AS DisplayName, 
                   email AS Email, password_hash AS PasswordHash, 
                   roles AS Roles, is_active AS IsActive, last_login_at AS LastLoginAt, 
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM public.users 
            WHERE id = @userId AND is_active = true;";

        return await conn.QuerySingleOrDefaultAsync<UserRecord>(sql, new { userId });
    }

    public async Task<UserRecord?> GetUserByEmailWithPasswordAsync(string email)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            SELECT id, discord_id AS DiscordId, discord_username AS DiscordUsername, 
                   discord_avatar AS DiscordAvatar, display_name AS DisplayName, 
                   email AS Email, password_hash AS PasswordHash, 
                   roles AS Roles, is_active AS IsActive, last_login_at AS LastLoginAt, 
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM public.users 
            WHERE LOWER(email) = LOWER(@email) AND is_active = true;";

        return await conn.QuerySingleOrDefaultAsync<UserRecord>(sql, new { email });
    }

    public async Task<List<MailboxRecord>> GetAssignedMailboxesAsync(Guid userId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var user = await GetUserByIdAsync(userId);
        if (user != null && user.Roles.Contains("admin"))
        {
            // Admin users can access and manage ALL company inboxes
            const string adminSql = @"
                SELECT m.id, m.email, m.display_name AS DisplayName, 
                       m.imap_host AS ImapHost, m.imap_port AS ImapPort, m.imap_ssl AS ImapSsl, 
                       m.smtp_host AS SmtpHost, m.smtp_port AS SmtpPort, m.smtp_ssl AS SmtpSsl, 
                       m.encrypted_password AS EncryptedPassword, m.is_active AS IsActive, m.created_at AS CreatedAt
                FROM public.mailboxes m
                WHERE m.is_active = true
                ORDER BY m.email ASC;";

            return (await conn.QueryAsync<MailboxRecord>(adminSql)).ToList();
        }

        // Return Union of directly assigned mailboxes + mailboxes assigned to user's groups
        const string sql = @"
            SELECT DISTINCT m.id, m.email, m.display_name AS DisplayName, 
                   m.imap_host AS ImapHost, m.imap_port AS ImapPort, m.imap_ssl AS ImapSsl, 
                   m.smtp_host AS SmtpHost, m.smtp_port AS SmtpPort, m.smtp_ssl AS SmtpSsl, 
                   m.encrypted_password AS EncryptedPassword, m.is_active AS IsActive, m.created_at AS CreatedAt
            FROM public.mailboxes m
            LEFT JOIN public.user_mailboxes um ON m.id = um.mailbox_id AND um.user_id = @userId
            LEFT JOIN public.group_mailboxes gm ON m.id = gm.mailbox_id
            LEFT JOIN public.group_members gmem ON gm.group_id = gmem.group_id AND gmem.user_id = @userId
            WHERE m.is_active = true 
              AND (um.user_id = @userId OR gmem.user_id = @userId)
            ORDER BY m.email ASC;";

        var list = (await conn.QueryAsync<MailboxRecord>(sql, new { userId })).ToList();
        return list;
    }

    public async Task<MailboxRecord?> GetMailboxWithPasswordAsync(Guid mailboxId, Guid userId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var user = await GetUserByIdAsync(userId);
        if (user != null && user.Roles.Contains("admin"))
        {
            const string adminSql = @"
                SELECT m.id, m.email, m.display_name AS DisplayName, 
                       m.imap_host AS ImapHost, m.imap_port AS ImapPort, m.imap_ssl AS ImapSsl, 
                       m.smtp_host AS SmtpHost, m.smtp_port AS SmtpPort, m.smtp_ssl AS SmtpSsl, 
                       m.encrypted_password AS EncryptedPassword, m.is_active AS IsActive, m.created_at AS CreatedAt
                FROM public.mailboxes m
                WHERE m.id = @mailboxId AND m.is_active = true;";

            return await conn.QuerySingleOrDefaultAsync<MailboxRecord>(adminSql, new { mailboxId });
        }

        const string sql = @"
            SELECT DISTINCT m.id, m.email, m.display_name AS DisplayName, 
                   m.imap_host AS ImapHost, m.imap_port AS ImapPort, m.imap_ssl AS ImapSsl, 
                   m.smtp_host AS SmtpHost, m.smtp_port AS SmtpPort, m.smtp_ssl AS SmtpSsl, 
                   m.encrypted_password AS EncryptedPassword, m.is_active AS IsActive, m.created_at AS CreatedAt
            FROM public.mailboxes m
            LEFT JOIN public.user_mailboxes um ON m.id = um.mailbox_id AND um.user_id = @userId
            LEFT JOIN public.group_mailboxes gm ON m.id = gm.mailbox_id
            LEFT JOIN public.group_members gmem ON gm.group_id = gmem.group_id AND gmem.user_id = @userId
            WHERE m.id = @mailboxId 
              AND m.is_active = true 
              AND (um.user_id = @userId OR gmem.user_id = @userId);";

        return await conn.QuerySingleOrDefaultAsync<MailboxRecord>(sql, new { mailboxId, userId });
    }

    public string GenerateJwtToken(UserRecord user)
    {
        var secretKey = _config["JWT_SECRET"]
            ?? Environment.GetEnvironmentVariable("JWT_SECRET")
            ?? "teamarchon_super_secret_jwt_key_minimum_32_characters!";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, !string.IsNullOrWhiteSpace(user.DisplayName) ? user.DisplayName : (!string.IsNullOrWhiteSpace(user.DiscordUsername) ? user.DiscordUsername : user.Email.Split('@')[0])),
            new(ClaimTypes.Email, user.Email)
        };

        foreach (var role in user.Roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var token = new JwtSecurityToken(
            issuer: "TeamArchonMailApi",
            audience: "TeamArchonWeb",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task EnsureAdminAccountAsync()
    {
        try
        {
            await using var conn = _db.GetConnection();
            await conn.OpenAsync();

            // 1. Auto-apply migrations for Users, Groups, and Group Relational Tables
            await conn.ExecuteAsync(@"
                ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
                ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
                ALTER TABLE public.users ALTER COLUMN discord_id DROP NOT NULL;

                CREATE TABLE IF NOT EXISTS public.groups (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(100) NOT NULL UNIQUE,
                    description TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS public.group_members (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
                    role VARCHAR(50) NOT NULL DEFAULT 'member',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(group_id, user_id)
                );

                CREATE TABLE IF NOT EXISTS public.group_mailboxes (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
                    mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(group_id, mailbox_id)
                );");

            var adminHash = PasswordHasher.HashPassword("ArchonAdmin2026!");

            // 2. Check if primary admin account exists
            var existingId = await conn.QuerySingleOrDefaultAsync<Guid?>(
                "SELECT id FROM public.users WHERE LOWER(email) = 'admin@teamarchon.in' LIMIT 1;");

            if (existingId == null)
            {
                const string insertAdminSql = @"
                    INSERT INTO public.users (discord_id, discord_username, display_name, email, password_hash, roles, is_active, created_at, updated_at)
                    VALUES (NULL, 'Administrator', 'Team Archon Administrator', 'admin@teamarchon.in', @adminHash, @roles, true, NOW(), NOW());";

                await conn.ExecuteAsync(insertAdminSql, new { adminHash, roles = new[] { "admin" } });
            }
            else
            {
                const string updateAdminSql = @"
                    UPDATE public.users 
                    SET password_hash = @adminHash, roles = @roles, is_active = true, display_name = 'Team Archon Administrator', updated_at = NOW() 
                    WHERE id = @existingId;";

                await conn.ExecuteAsync(updateAdminSql, new { existingId, adminHash, roles = new[] { "admin" } });
            }

            // 3. Ensure admin@teamarchon.in mailbox exists with loopback settings
            const string ensureBoxSql = @"
                INSERT INTO public.mailboxes (email, display_name, imap_host, imap_port, imap_ssl, smtp_host, smtp_port, smtp_ssl, encrypted_password, is_active)
                VALUES ('admin@teamarchon.in', 'Team Archon Admin', '127.0.0.1', 993, true, '127.0.0.1', 465, true, 'ArchonAdmin2026!', true)
                ON CONFLICT (email) DO UPDATE SET encrypted_password = 'ArchonAdmin2026!';";

            await conn.ExecuteAsync(ensureBoxSql);
        }
        catch (Exception ex)
        {
            _discordLogger.LogError("Failed to seed admin account / apply auto-migrations", ex);
        }
    }

    // ─── User Management (Admin Provisioning) ───────────────────────────────

    public async Task<List<UserRecord>> GetAllUsersAsync()
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            SELECT id, discord_id AS DiscordId, discord_username AS DiscordUsername, 
                   discord_avatar AS DiscordAvatar, display_name AS DisplayName, 
                   email AS Email, roles AS Roles, 
                   is_active AS IsActive, last_login_at AS LastLoginAt, 
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM public.users
            ORDER BY created_at DESC;";

        return (await conn.QueryAsync<UserRecord>(sql)).ToList();
    }

    public async Task<UserRecord> CreateUserByAdminAsync(string email, string passwordHash, string? displayName, string role)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var username = string.IsNullOrWhiteSpace(displayName) ? email.Split('@')[0] : displayName;
        var roles = role.Equals("admin", StringComparison.OrdinalIgnoreCase) ? new[] { "admin" } : new[] { "member" };

        const string sql = @"
            INSERT INTO public.users (discord_id, discord_username, display_name, email, password_hash, roles, is_active, last_login_at, created_at, updated_at)
            VALUES (NULL, @username, @displayName, @email, @passwordHash, @roles, true, NULL, NOW(), NOW())
            RETURNING id, discord_id AS DiscordId, discord_username AS DiscordUsername, 
                      display_name AS DisplayName, email AS Email, roles AS Roles, 
                      is_active AS IsActive, last_login_at AS LastLoginAt, 
                      created_at AS CreatedAt, updated_at AS UpdatedAt;";

        return await conn.QuerySingleAsync<UserRecord>(sql, new
        {
            username,
            displayName,
            email,
            passwordHash,
            roles
        });
    }

    public async Task<bool> UpdateUserPasswordAsync(Guid userId, string passwordHash)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            UPDATE public.users 
            SET password_hash = @passwordHash, updated_at = NOW() 
            WHERE id = @userId;";

        var affected = await conn.ExecuteAsync(sql, new { userId, passwordHash });
        return affected > 0;
    }

    public async Task<bool> DeleteUserAsync(Guid userId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync("DELETE FROM public.users WHERE id = @userId;", new { userId });
        return affected > 0;
    }

    // ─── Mailbox Management ──────────────────────────────────────────────────

    public async Task<List<MailboxRecord>> GetAllMailboxesAsync()
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            SELECT id, email, display_name AS DisplayName, 
                   imap_host AS ImapHost, imap_port AS ImapPort, imap_ssl AS ImapSsl, 
                   smtp_host AS SmtpHost, smtp_port AS SmtpPort, smtp_ssl AS SmtpSsl, 
                   encrypted_password AS EncryptedPassword, is_active AS IsActive, created_at AS CreatedAt
            FROM public.mailboxes
            ORDER BY email ASC;";

        return (await conn.QueryAsync<MailboxRecord>(sql)).ToList();
    }

    public async Task<MailboxRecord> CreateOrUpdateMailboxAsync(MailboxRecord box)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            INSERT INTO public.mailboxes (email, display_name, imap_host, imap_port, imap_ssl, smtp_host, smtp_port, smtp_ssl, encrypted_password, is_active)
            VALUES (@Email, @DisplayName, @ImapHost, @ImapPort, @ImapSsl, @SmtpHost, @SmtpPort, @SmtpSsl, @EncryptedPassword, true)
            ON CONFLICT (email) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                encrypted_password = EXCLUDED.encrypted_password,
                is_active = true
            RETURNING id, email, display_name AS DisplayName, 
                      imap_host AS ImapHost, imap_port AS ImapPort, imap_ssl AS ImapSsl, 
                      smtp_host AS SmtpHost, smtp_port AS SmtpPort, smtp_ssl AS SmtpSsl, 
                      encrypted_password AS EncryptedPassword, is_active AS IsActive, created_at AS CreatedAt;";

        return await conn.QuerySingleAsync<MailboxRecord>(sql, box);
    }

    public async Task<bool> DeleteMailboxAsync(Guid id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync("DELETE FROM public.mailboxes WHERE id = @id;", new { id });
        return affected > 0;
    }

    public async Task<bool> AssignUserMailboxAsync(Guid userId, Guid mailboxId, string role)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            INSERT INTO public.user_mailboxes (user_id, mailbox_id, role)
            VALUES (@userId, @mailboxId, @role)
            ON CONFLICT (user_id, mailbox_id) DO UPDATE SET role = EXCLUDED.role;";

        var affected = await conn.ExecuteAsync(sql, new { userId, mailboxId, role });
        return affected > 0;
    }

    public async Task<bool> RemoveUserMailboxAsync(Guid userId, Guid mailboxId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync(
            "DELETE FROM public.user_mailboxes WHERE user_id = @userId AND mailbox_id = @mailboxId;",
            new { userId, mailboxId });

        return affected > 0;
    }

    // ─── Group Management ────────────────────────────────────────────────────

    public async Task<List<GroupRecord>> GetAllGroupsAsync()
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            SELECT g.id, g.name, g.description, g.created_at AS CreatedAt,
                   COALESCE((SELECT COUNT(*)::int FROM public.group_members gm WHERE gm.group_id = g.id), 0) AS MemberCount,
                   COALESCE((SELECT COUNT(*)::int FROM public.group_mailboxes gmb WHERE gmb.group_id = g.id), 0) AS MailboxCount
            FROM public.groups g
            ORDER BY g.name ASC;";

        return (await conn.QueryAsync<GroupRecord>(sql)).ToList();
    }

    public async Task<GroupRecord> CreateGroupAsync(string name, string? description)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            INSERT INTO public.groups (name, description, created_at)
            VALUES (@name, @description, NOW())
            RETURNING id, name, description, 0 AS MemberCount, 0 AS MailboxCount, created_at AS CreatedAt;";

        return await conn.QuerySingleAsync<GroupRecord>(sql, new { name, description });
    }

    public async Task<bool> DeleteGroupAsync(Guid groupId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync("DELETE FROM public.groups WHERE id = @groupId;", new { groupId });
        return affected > 0;
    }

    public async Task<GroupDetailDto?> GetGroupDetailsAsync(Guid groupId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string groupSql = @"
            SELECT g.id, g.name, g.description, g.created_at AS CreatedAt,
                   COALESCE((SELECT COUNT(*)::int FROM public.group_members gm WHERE gm.group_id = g.id), 0) AS MemberCount,
                   COALESCE((SELECT COUNT(*)::int FROM public.group_mailboxes gmb WHERE gmb.group_id = g.id), 0) AS MailboxCount
            FROM public.groups g
            WHERE g.id = @groupId;";

        var group = await conn.QuerySingleOrDefaultAsync<GroupRecord>(groupSql, new { groupId });
        if (group == null) return null;

        const string membersSql = @"
            SELECT u.id, u.discord_id AS DiscordId, u.discord_username AS DiscordUsername, 
                   u.display_name AS DisplayName, u.email AS Email, u.roles AS Roles, 
                   u.is_active AS IsActive, u.last_login_at AS LastLoginAt, 
                   u.created_at AS CreatedAt, u.updated_at AS UpdatedAt
            FROM public.users u
            JOIN public.group_members gm ON u.id = gm.user_id
            WHERE gm.group_id = @groupId
            ORDER BY u.email ASC;";

        const string mailboxesSql = @"
            SELECT m.id, m.email, m.display_name AS DisplayName, 
                   m.imap_host AS ImapHost, m.imap_port AS ImapPort, m.imap_ssl AS ImapSsl, 
                   m.smtp_host AS SmtpHost, m.smtp_port AS SmtpPort, m.smtp_ssl AS SmtpSsl, 
                   m.encrypted_password AS EncryptedPassword, m.is_active AS IsActive, m.created_at AS CreatedAt
            FROM public.mailboxes m
            JOIN public.group_mailboxes gmb ON m.id = gmb.mailbox_id
            WHERE gmb.group_id = @groupId
            ORDER BY m.email ASC;";

        var members = (await conn.QueryAsync<UserRecord>(membersSql, new { groupId })).ToList();
        var mailboxes = (await conn.QueryAsync<MailboxRecord>(mailboxesSql, new { groupId })).ToList();

        return new GroupDetailDto
        {
            Group = group,
            Members = members,
            Mailboxes = mailboxes
        };
    }

    public async Task<bool> AddUserToGroupAsync(Guid groupId, Guid userId, string role = "member")
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            INSERT INTO public.group_members (group_id, user_id, role, created_at)
            VALUES (@groupId, @userId, @role, NOW())
            ON CONFLICT (group_id, user_id) DO NOTHING;";

        var affected = await conn.ExecuteAsync(sql, new { groupId, userId, role });
        return affected > 0;
    }

    public async Task<bool> RemoveUserFromGroupAsync(Guid groupId, Guid userId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync(
            "DELETE FROM public.group_members WHERE group_id = @groupId AND user_id = @userId;",
            new { groupId, userId });

        return affected > 0;
    }

    public async Task<bool> AddMailboxToGroupAsync(Guid groupId, Guid mailboxId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            INSERT INTO public.group_mailboxes (group_id, mailbox_id, created_at)
            VALUES (@groupId, @mailboxId, NOW())
            ON CONFLICT (group_id, mailbox_id) DO NOTHING;";

        var affected = await conn.ExecuteAsync(sql, new { groupId, mailboxId });
        return affected > 0;
    }

    public async Task<bool> RemoveMailboxFromGroupAsync(Guid groupId, Guid mailboxId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync(
            "DELETE FROM public.group_mailboxes WHERE group_id = @groupId AND mailbox_id = @mailboxId;",
            new { groupId, mailboxId });

        return affected > 0;
    }
}
