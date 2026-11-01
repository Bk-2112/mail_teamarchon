using MailKit;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Search;
using MailKit.Security;
using MimeKit;
using TeamArchon.Mail.Api.Models;

namespace TeamArchon.Mail.Api.Services;

public class StalwartMailService
{
    private readonly EncryptionService _encryption;
    private readonly IDiscordLogService _discordLogger;
    private readonly ILogger<StalwartMailService> _logger;

    public StalwartMailService(
        EncryptionService encryption,
        IDiscordLogService discordLogger,
        ILogger<StalwartMailService> logger)
    {
        _encryption = encryption;
        _discordLogger = discordLogger;
        _logger = logger;
    }

    public async Task<List<EmailSummaryDto>> GetFolderMessagesAsync(MailboxRecord mailbox, string folderName = "INBOX", int limit = 50)
    {
        using var client = new ImapClient();
        client.ServerCertificateValidationCallback = (s, c, h, e) => true;

        var plainPassword = _encryption.Decrypt(mailbox.EncryptedPassword);
        var options = mailbox.ImapSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;

        await client.ConnectAsync(mailbox.ImapHost, mailbox.ImapPort, options);
        try
        {
            await client.AuthenticateAsync(mailbox.Email, plainPassword);
        }
        catch
        {
            var userOnly = mailbox.Email.Split('@')[0];
            await client.AuthenticateAsync(userOnly, plainPassword);
        }

        IMailFolder? folder = null;
        if (string.Equals(folderName, "INBOX", StringComparison.OrdinalIgnoreCase))
        {
            folder = client.Inbox;
        }
        else
        {
            try
            {
                folder = await client.GetFolderAsync(folderName);
            }
            catch (FolderNotFoundException)
            {
                // Fall back to MailKit special-use folders
                var specialFolder = folderName.ToLowerInvariant() switch
                {
                    "sent" or "sent messages" or "sent items" => SpecialFolder.Sent,
                    "drafts" => SpecialFolder.Drafts,
                    "trash" => SpecialFolder.Trash,
                    "junk" or "spam" => SpecialFolder.Junk,
                    "archive" => SpecialFolder.Archive,
                    _ => (SpecialFolder?)null
                };

                if (specialFolder.HasValue)
                {
                    try
                    {
                        folder = client.GetFolder(specialFolder.Value);
                    }
                    catch
                    {
                        folder = null;
                    }
                }
            }
        }

        // If folder doesn't exist yet on Stalwart, return an empty list gracefully
        if (folder == null)
        {
            await client.DisconnectAsync(true);
            return new List<EmailSummaryDto>();
        }

        await folder.OpenAsync(FolderAccess.ReadOnly);

        var count = folder.Count;
        var results = new List<EmailSummaryDto>();

        if (count == 0)
        {
            await client.DisconnectAsync(true);
            return results;
        }

        var startIndex = Math.Max(0, count - limit);
        var uids = await folder.SearchAsync(SearchQuery.All);
        var targetUids = uids.Skip(startIndex).Take(limit).Reverse().ToList();

        var summaries = await folder.FetchAsync(targetUids, MessageSummaryItems.UniqueId | MessageSummaryItems.Envelope | MessageSummaryItems.Flags | MessageSummaryItems.BodyStructure);

        foreach (var s in summaries)
        {
            var from = s.Envelope.From.Mailboxes.FirstOrDefault();
            results.Add(new EmailSummaryDto
            {
                Id = s.UniqueId.ToString(),
                Uid = s.UniqueId.Id,
                Subject = s.Envelope.Subject ?? "(No Subject)",
                From = from?.Address ?? "(Unknown)",
                FromName = from?.Name ?? from?.Address ?? "(Unknown)",
                To = string.Join(", ", s.Envelope.To.Mailboxes.Select(x => x.Address)),
                Date = s.Envelope.Date?.UtcDateTime ?? DateTime.UtcNow,
                IsRead = s.Flags?.HasFlag(MessageFlags.Seen) ?? false,
                IsStarred = s.Flags?.HasFlag(MessageFlags.Flagged) ?? false,
                HasAttachments = s.Attachments.Any(),
                Snippet = s.Envelope.Subject ?? string.Empty
            });
        }

        await client.DisconnectAsync(true);
        return results;
    }

    public async Task<EmailDetailDto?> GetMessageDetailAsync(MailboxRecord mailbox, string folderName, uint uid)
    {
        using var client = new ImapClient();
        client.ServerCertificateValidationCallback = (s, c, h, e) => true;

        var plainPassword = _encryption.Decrypt(mailbox.EncryptedPassword);
        var options = mailbox.ImapSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;

        await client.ConnectAsync(mailbox.ImapHost, mailbox.ImapPort, options);
        try
        {
            await client.AuthenticateAsync(mailbox.Email, plainPassword);
        }
        catch
        {
            var userOnly = mailbox.Email.Split('@')[0];
            await client.AuthenticateAsync(userOnly, plainPassword);
        }

        IMailFolder? folder = null;
        if (string.Equals(folderName, "INBOX", StringComparison.OrdinalIgnoreCase))
        {
            folder = client.Inbox;
        }
        else
        {
            try
            {
                folder = await client.GetFolderAsync(folderName);
            }
            catch (FolderNotFoundException)
            {
                var specialFolder = folderName.ToLowerInvariant() switch
                {
                    "sent" or "sent messages" or "sent items" => SpecialFolder.Sent,
                    "drafts" => SpecialFolder.Drafts,
                    "trash" => SpecialFolder.Trash,
                    _ => (SpecialFolder?)null
                };

                if (specialFolder.HasValue)
                {
                    try { folder = client.GetFolder(specialFolder.Value); } catch { folder = null; }
                }
            }
        }

        if (folder == null)
        {
            await client.DisconnectAsync(true);
            return null;
        }

        await folder.OpenAsync(FolderAccess.ReadWrite);

        var mimeMessage = await folder.GetMessageAsync(new UniqueId(uid));
        if (mimeMessage == null)
        {
            await client.DisconnectAsync(true);
            return null;
        }

        // Mark as seen
        await folder.AddFlagsAsync(new UniqueId(uid), MessageFlags.Seen, true);

        var from = mimeMessage.From.Mailboxes.FirstOrDefault();
        var detail = new EmailDetailDto
        {
            Id = uid.ToString(),
            Uid = uid,
            Subject = mimeMessage.Subject ?? "(No Subject)",
            From = from?.Address ?? "(Unknown)",
            FromName = from?.Name ?? from?.Address ?? "(Unknown)",
            To = string.Join(", ", mimeMessage.To.Mailboxes.Select(x => x.Address)),
            Date = mimeMessage.Date.UtcDateTime,
            IsRead = true,
            HtmlBody = mimeMessage.HtmlBody ?? mimeMessage.TextBody,
            TextBody = mimeMessage.TextBody,
            HasAttachments = mimeMessage.Attachments.Any()
        };

        foreach (var att in mimeMessage.Attachments)
        {
            detail.Attachments.Add(new EmailAttachmentDto
            {
                FileName = att.ContentDisposition?.FileName ?? "attachment",
                ContentType = att.ContentType.MimeType,
                Size = att switch
                {
                    MimePart part => part.Content?.Stream.Length ?? 0,
                    _ => 0
                }
            });
        }

        await client.DisconnectAsync(true);
        return detail;
    }

    public async Task<bool> SendEmailAsync(MailboxRecord mailbox, SendEmailRequest req, string senderDiscordUsername)
    {
        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(mailbox.DisplayName ?? mailbox.Email, mailbox.Email));

            foreach (var to in req.To.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
            {
                message.To.Add(MailboxAddress.Parse(to.Trim()));
            }

            if (!string.IsNullOrEmpty(req.Cc))
            {
                foreach (var cc in req.Cc.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
                    message.Cc.Add(MailboxAddress.Parse(cc.Trim()));
            }

            message.Subject = req.Subject;

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = req.BodyHtml,
                TextBody = req.BodyText ?? req.BodyHtml
            };
            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            client.ServerCertificateValidationCallback = (s, c, h, e) => true;

            // Remove challenge mechanisms that fail on Stalwart internal TLS
            client.AuthenticationMechanisms.Remove("XOAUTH2");
            client.AuthenticationMechanisms.Remove("CRAM-MD5");
            client.AuthenticationMechanisms.Remove("DIGEST-MD5");

            var plainPassword = _encryption.Decrypt(mailbox.EncryptedPassword);
            var options = mailbox.SmtpSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;

            await client.ConnectAsync(mailbox.SmtpHost, mailbox.SmtpPort, options);
            try
            {
                await client.AuthenticateAsync(mailbox.Email, plainPassword);
            }
            catch
            {
                var userOnly = mailbox.Email.Split('@')[0];
                await client.AuthenticateAsync(userOnly, plainPassword);
            }

            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            // Best effort: Append sent email to the Sent folder so it appears in /sent
            try
            {
                using var imapClient = new ImapClient();
                imapClient.ServerCertificateValidationCallback = (s, c, h, e) => true;
                var imapOptions = mailbox.ImapSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;
                await imapClient.ConnectAsync(mailbox.ImapHost, mailbox.ImapPort, imapOptions);
                try
                {
                    await imapClient.AuthenticateAsync(mailbox.Email, plainPassword);
                }
                catch
                {
                    var userOnly = mailbox.Email.Split('@')[0];
                    await imapClient.AuthenticateAsync(userOnly, plainPassword);
                }

                IMailFolder? sentFolder = null;
                try
                {
                    sentFolder = imapClient.GetFolder(SpecialFolder.Sent);
                }
                catch
                {
                    try { sentFolder = await imapClient.GetFolderAsync("Sent"); } catch { }
                }

                if (sentFolder != null)
                {
                    await sentFolder.OpenAsync(FolderAccess.ReadWrite);
                    await sentFolder.AppendAsync(message, MessageFlags.Seen);
                }
                await imapClient.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to append sent message to Sent folder for {Email}", mailbox.Email);
            }

            // 100% Categorized Logging to #mail-logs Webhook
            _discordLogger.LogMail(
                "Email Dispatched",
                mailbox.Email,
                req.To,
                req.Subject,
                $"Sent by {senderDiscordUsername}");

            return true;
        }
        catch (Exception ex)
        {
            _discordLogger.LogError($"SMTP Send Failure from {mailbox.Email}", ex, user: senderDiscordUsername);
            throw;
        }
    }
}
