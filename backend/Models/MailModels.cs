using System.Text.Json.Serialization;

namespace TeamArchon.Mail.Api.Models;

public class UserRecord
{
    public Guid Id { get; set; }
    public string? DiscordId { get; set; }
    public string DiscordUsername { get; set; } = string.Empty;
    public string? DiscordAvatar { get; set; }
    public string? DisplayName { get; set; }
    public string Email { get; set; } = string.Empty;

    [JsonIgnore]
    public string? PasswordHash { get; set; }

    public string[] Roles { get; set; } = Array.Empty<string>();
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class MailboxRecord
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string ImapHost { get; set; } = "127.0.0.1";
    public int ImapPort { get; set; } = 993;
    public bool ImapSsl { get; set; } = true;
    public string SmtpHost { get; set; } = "127.0.0.1";
    public int SmtpPort { get; set; } = 465;
    public bool SmtpSsl { get; set; } = true;
    public string EncryptedPassword { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class UserMailboxAccess
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid MailboxId { get; set; }
    public string Role { get; set; } = "member"; // "owner", "member", "read_only"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class GroupRecord
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MemberCount { get; set; }
    public int MailboxCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class CreateGroupRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class AssignGroupMemberRequest
{
    public Guid UserId { get; set; }
    public string Role { get; set; } = "member";
}

public class AssignGroupMailboxRequest
{
    public Guid MailboxId { get; set; }
}

public class GroupDetailDto
{
    public GroupRecord Group { get; set; } = new();
    public List<UserRecord> Members { get; set; } = new();
    public List<MailboxRecord> Mailboxes { get; set; } = new();
}

public class CreateUserAdminRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string Role { get; set; } = "member"; // "admin", "member"
}

public class ResetUserPasswordRequest
{
    public string Password { get; set; } = string.Empty;
}

public class AssignMailboxRequest
{
    public Guid UserId { get; set; }
    public Guid MailboxId { get; set; }
    public string Role { get; set; } = "member"; // "owner", "member", "read_only"
}

public class EmailSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public uint Uid { get; set; }
    public string Subject { get; set; } = "(No Subject)";
    public string From { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
    public string To { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public bool IsRead { get; set; }
    public bool IsStarred { get; set; }
    public bool HasAttachments { get; set; }
    public string Snippet { get; set; } = string.Empty;
}

public class EmailDetailDto : EmailSummaryDto
{
    public string? HtmlBody { get; set; }
    public string? TextBody { get; set; }
    public List<EmailAttachmentDto> Attachments { get; set; } = new();
}

public class EmailAttachmentDto
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public string PartSpecifier { get; set; } = string.Empty;
}

public class SendEmailRequest
{
    public Guid MailboxId { get; set; }
    public string To { get; set; } = string.Empty;
    public string? Cc { get; set; }
    public string? Bcc { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string BodyHtml { get; set; } = string.Empty;
    public string? BodyText { get; set; }
}

public class EmailLoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class EmailRegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public UserRecord User { get; set; } = new();
    public List<MailboxRecord> Mailboxes { get; set; } = new();
}
