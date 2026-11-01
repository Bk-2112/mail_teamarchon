using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using TeamArchon.Mail.Api.Middleware;
using TeamArchon.Mail.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Add Configuration Sources
void LoadEnvFile(string path)
{
    if (!File.Exists(path)) return;
    foreach (var line in File.ReadAllLines(path))
    {
        var trimmed = line.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#")) continue;
        var idx = trimmed.IndexOf('=');
        if (idx > 0)
        {
            var key = trimmed[..idx].Trim();
            var val = trimmed[(idx + 1)..].Trim();
            if ((val.StartsWith("\"") && val.EndsWith("\"")) || (val.StartsWith("'") && val.EndsWith("'")))
            {
                val = val[1..^1];
            }
            Environment.SetEnvironmentVariable(key, val);
        }
    }
}

LoadEnvFile("/etc/teamarchon-api/teamarchon-api.env");
LoadEnvFile(".env");

builder.Configuration
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

// 2. HTTP Client for Discord API and Webhooks
builder.Services.AddHttpClient();
builder.Services.AddHttpClient("DiscordWebhooks", client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

// 3. Register Core Services
builder.Services.AddSingleton<DatabaseService>();
builder.Services.AddSingleton<EncryptionService>();
builder.Services.AddSingleton<UserRepository>();
builder.Services.AddSingleton<StalwartMailService>();

// 4. Categorized Discord Webhook Logging Engine (Hosted Background Service)
builder.Services.AddSingleton<DiscordWebhookLogger>();
builder.Services.AddSingleton<IDiscordLogService>(sp => sp.GetRequiredService<DiscordWebhookLogger>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<DiscordWebhookLogger>());

// 5. JWT Authentication
var jwtSecret = builder.Configuration["JWT_SECRET"]
    ?? Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? "teamarchon_super_secret_jwt_key_minimum_32_characters!";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = true,
        ValidIssuer = "TeamArchonMailApi",
        ValidateAudience = true,
        ValidAudience = "TeamArchonWeb",
        ClockSkew = TimeSpan.FromMinutes(5)
    };
});

builder.Services.AddAuthorization();
builder.Services.AddControllers();

// 6. CORS Configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowWebClient", policy =>
    {
        policy.WithOrigins(
                "https://mail.teamarchon.in",
                "https://portal.teamarchon.in",
                "http://localhost:5173",
                "http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// 7. Middleware Pipeline
app.UseMiddleware<GlobalErrorHandlingMiddleware>();
app.UseCors("AllowWebClient");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// 8. Seed Administrator Account (admin@teamarchon.in)
try
{
    using var scope = app.Services.CreateScope();
    var userRepo = scope.ServiceProvider.GetRequiredService<UserRepository>();
    await userRepo.EnsureAdminAccountAsync();
}
catch (Exception ex)
{
    Console.WriteLine($"[Startup] Admin seeding notice: {ex.Message}");
}

// 9. Log System Startup to #system-logs Webhook
var discordLogger = app.Services.GetRequiredService<IDiscordLogService>();
discordLogger.LogSystem(
    "Team Archon Mail API Started",
    "API backend initialized successfully on port 8787 in Ground Zero mode.",
    new[]
    {
        ("Environment", app.Environment.EnvironmentName),
        ("Version", "3.1.0"),
        ("Auth Gateway", "Direct PBKDF2 Hashed Credentials & Enterprise Groups"),
        ("Database", "Supabase PostgreSQL")
    });

app.Run();
