using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeamArchon.Mail.Api.Models;
using TeamArchon.Mail.Api.Services;

namespace TeamArchon.Mail.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserRepository _userRepo;
    private readonly IDiscordLogService _discordLogger;

    public AuthController(
        UserRepository userRepo,
        IDiscordLogService discordLogger)
    {
        _userRepo = userRepo;
        _discordLogger = discordLogger;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> EmailLogin([FromBody] EmailLoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Email and password are required." });

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

        // Auto-seed admin account on startup or initial login attempt
        if (req.Email.Trim().Equals("admin@teamarchon.in", StringComparison.OrdinalIgnoreCase))
        {
            await _userRepo.EnsureAdminAccountAsync();
        }

        var user = await _userRepo.GetUserByEmailWithPasswordAsync(req.Email.Trim());
        if (user == null || string.IsNullOrEmpty(user.PasswordHash))
        {
            _discordLogger.LogAuth("Failed Login Attempt", $"Failed email/password login for `{req.Email}` (User not found or no password set).", false);
            return Unauthorized(new { message = "Invalid email or password." });
        }

        // Verify PBKDF2 salted hash in constant time
        var isPasswordValid = PasswordHasher.VerifyPassword(req.Password, user.PasswordHash);
        if (!isPasswordValid)
        {
            _discordLogger.LogAuth("Failed Login Attempt", $"Invalid password entered for `{req.Email}`.", false, new[] { ("IP", ip ?? "Unknown") });
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var mailboxes = await _userRepo.GetAssignedMailboxesAsync(user.Id);
        var token = _userRepo.GenerateJwtToken(user);

        _discordLogger.LogAuth("User Authenticated", $"User **{user.Email}** successfully logged in with credentials.", true, new[]
        {
            ("Email", user.Email),
            ("IP", ip ?? "Unknown")
        });

        return Ok(new AuthResponse
        {
            Token = token,
            User = user,
            Mailboxes = mailboxes
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var user = await _userRepo.GetUserByIdAsync(userId);
        if (user == null)
            return Unauthorized();

        var mailboxes = await _userRepo.GetAssignedMailboxesAsync(userId);

        return Ok(new
        {
            user,
            mailboxes
        });
    }
}
