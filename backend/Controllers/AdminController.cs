using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeamArchon.Mail.Api.Models;
using TeamArchon.Mail.Api.Services;

namespace TeamArchon.Mail.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController : ControllerBase
{
    private readonly UserRepository _userRepo;
    private readonly IDiscordLogService _discordLogger;

    public AdminController(UserRepository userRepo, IDiscordLogService discordLogger)
    {
        _userRepo = userRepo;
        _discordLogger = discordLogger;
    }

    // ─── Mailboxes ───────────────────────────────────────────────────────────

    [HttpGet("mailboxes")]
    public async Task<IActionResult> GetMailboxes()
    {
        var mailboxes = await _userRepo.GetAllMailboxesAsync();
        return Ok(mailboxes);
    }

    [HttpPost("mailboxes")]
    public async Task<IActionResult> CreateOrUpdateMailbox([FromBody] MailboxRecord req)
    {
        if (string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { message = "Email is required." });

        var mailbox = await _userRepo.CreateOrUpdateMailboxAsync(req);
        _discordLogger.LogSystem("Mailbox Configured", $"Admin configured mailbox **{mailbox.Email}**.");
        return Ok(mailbox);
    }

    [HttpDelete("mailboxes/{id:guid}")]
    public async Task<IActionResult> DeleteMailbox(Guid id)
    {
        var ok = await _userRepo.DeleteMailboxAsync(id);
        if (ok)
        {
            _discordLogger.LogSystem("Mailbox Deleted", $"Admin deleted mailbox ID `{id}`.");
            return Ok(new { success = true });
        }
        return NotFound();
    }

    // ─── Users (Admin Provisioning & Passwords) ──────────────────────────────

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _userRepo.GetAllUsersAsync();
        return Ok(users);
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserAdminRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Email and initial password are required." });

        if (req.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

        var existing = await _userRepo.GetUserByEmailWithPasswordAsync(req.Email.Trim());
        if (existing != null)
            return Conflict(new { message = $"An account with email '{req.Email}' already exists." });

        // Hash and salt password with PBKDF2
        var passwordHash = PasswordHasher.HashPassword(req.Password);
        var user = await _userRepo.CreateUserByAdminAsync(req.Email.Trim(), passwordHash, req.DisplayName?.Trim(), req.Role);

        _discordLogger.LogAuth("User Provisioned by Admin", $"Admin provisioned new account **{user.Email}** with role `{string.Join(", ", user.Roles)}`.", true);

        return Ok(user);
    }

    [HttpPost("users/{id:guid}/password")]
    public async Task<IActionResult> ResetUserPassword(Guid id, [FromBody] ResetUserPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
            return BadRequest(new { message = "New password must be at least 6 characters." });

        var user = await _userRepo.GetUserByIdAsync(id);
        if (user == null)
            return NotFound(new { message = "User not found." });

        var passwordHash = PasswordHasher.HashPassword(req.Password);
        var ok = await _userRepo.UpdateUserPasswordAsync(id, passwordHash);

        if (ok)
        {
            _discordLogger.LogAuth("Password Reset", $"Admin reset credentials for account **{user.Email}**.", true);
            return Ok(new { success = true, message = "Password updated successfully." });
        }

        return BadRequest(new { message = "Failed to update password." });
    }

    [HttpDelete("users/{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var user = await _userRepo.GetUserByIdAsync(id);
        if (user == null)
            return NotFound(new { message = "User not found." });

        if (user.Email.Equals("admin@teamarchon.in", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Cannot delete the primary administrator account." });

        var ok = await _userRepo.DeleteUserAsync(id);
        if (ok)
        {
            _discordLogger.LogAuth("User Deleted", $"Admin deleted account **{user.Email}**.", false);
            return Ok(new { success = true });
        }

        return BadRequest(new { message = "Failed to delete user." });
    }

    // ─── Direct Mailbox Assignment ───────────────────────────────────────────

    [HttpPost("assign")]
    public async Task<IActionResult> AssignMailbox([FromBody] AssignMailboxRequest req)
    {
        var ok = await _userRepo.AssignUserMailboxAsync(req.UserId, req.MailboxId, req.Role);
        return ok ? Ok(new { success = true }) : BadRequest();
    }

    [HttpDelete("assign/{userId:guid}/{mailboxId:guid}")]
    public async Task<IActionResult> RemoveMailboxAssignment(Guid userId, Guid mailboxId)
    {
        var ok = await _userRepo.RemoveUserMailboxAsync(userId, mailboxId);
        return ok ? Ok(new { success = true }) : NotFound();
    }

    // ─── Groups & Distribution Lists ─────────────────────────────────────────

    [HttpGet("groups")]
    public async Task<IActionResult> GetGroups()
    {
        var groups = await _userRepo.GetAllGroupsAsync();
        return Ok(groups);
    }

    [HttpPost("groups")]
    public async Task<IActionResult> CreateGroup([FromBody] CreateGroupRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Group name is required." });

        try
        {
            var group = await _userRepo.CreateGroupAsync(req.Name.Trim(), req.Description?.Trim());
            _discordLogger.LogSystem("Group Created", $"Admin created mail group **{group.Name}**.");
            return Ok(group);
        }
        catch (Exception ex)
        {
            return Conflict(new { message = "A group with this name may already exist.", error = ex.Message });
        }
    }

    [HttpDelete("groups/{id:guid}")]
    public async Task<IActionResult> DeleteGroup(Guid id)
    {
        var ok = await _userRepo.DeleteGroupAsync(id);
        if (ok)
        {
            _discordLogger.LogSystem("Group Deleted", $"Admin deleted group ID `{id}`.");
            return Ok(new { success = true });
        }
        return NotFound();
    }

    [HttpGet("groups/{id:guid}")]
    public async Task<IActionResult> GetGroupDetails(Guid id)
    {
        var details = await _userRepo.GetGroupDetailsAsync(id);
        if (details == null)
            return NotFound(new { message = "Group not found." });

        return Ok(details);
    }

    [HttpPost("groups/{id:guid}/members")]
    public async Task<IActionResult> AddGroupMember(Guid id, [FromBody] AssignGroupMemberRequest req)
    {
        var ok = await _userRepo.AddUserToGroupAsync(id, req.UserId, req.Role);
        return ok ? Ok(new { success = true }) : BadRequest(new { message = "Failed to add member to group." });
    }

    [HttpDelete("groups/{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveGroupMember(Guid id, Guid userId)
    {
        var ok = await _userRepo.RemoveUserFromGroupAsync(id, userId);
        return ok ? Ok(new { success = true }) : NotFound();
    }

    [HttpPost("groups/{id:guid}/mailboxes")]
    public async Task<IActionResult> AddGroupMailbox(Guid id, [FromBody] AssignGroupMailboxRequest req)
    {
        var ok = await _userRepo.AddMailboxToGroupAsync(id, req.MailboxId);
        return ok ? Ok(new { success = true }) : BadRequest(new { message = "Failed to add mailbox to group." });
    }

    [HttpDelete("groups/{id:guid}/mailboxes/{mailboxId:guid}")]
    public async Task<IActionResult> RemoveGroupMailbox(Guid id, Guid mailboxId)
    {
        var ok = await _userRepo.RemoveMailboxFromGroupAsync(id, mailboxId);
        return ok ? Ok(new { success = true }) : NotFound();
    }
}
