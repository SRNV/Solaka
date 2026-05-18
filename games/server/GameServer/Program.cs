using GameServer.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddSingleton<BibleService>();
builder.Services.AddSingleton<StompService>();
builder.Services.AddSingleton<GameDiscoveryService>();

var allowedOrigins = (builder.Configuration["ALLOWED_ORIGINS"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries)
    .Select(o => o.Trim())
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors();

// Configure the HTTP request pipeline.
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(120),
});

app.Map("/stomp", async (HttpContext context, StompService stompService) =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        // Simple origin check for WebSockets
        var origin = context.Request.Headers["Origin"].ToString();
        if (!string.IsNullOrEmpty(origin) && !allowedOrigins.Contains(origin))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        await stompService.HandleWebSocketAsync(webSocket);
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
    }
});

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/games", (GameDiscoveryService gameService) => 
{
    return Results.Ok(gameService.GetGames());
});

// Pre-load Bible service
app.Services.GetRequiredService<BibleService>();

app.Run();
