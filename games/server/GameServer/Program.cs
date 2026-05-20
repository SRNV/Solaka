using System.Text.Json;
using GameServer.Services;
using GameServer.Domain.Entities;
using GameServer.Domain.Repositories;
using GameServer.Infrastructure.Repositories;
using GameServer.Application.UseCases;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<BibleService>();
builder.Services.AddSingleton<RoomService>();
// StompService depends on RoomService — register after
builder.Services.AddSingleton<StompService>();

builder.Services.AddSingleton<IGameRepository, JsonGameRepository>();
builder.Services.AddScoped<GetAvailableGamesUseCase>();

var allowedOrigins = (builder.Configuration["ALLOWED_ORIGINS"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries)
    .Select(o => o.Trim().TrimEnd('/'))
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

app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(20),
});

// WebSocket middleware for STOMP connections
app.Use(async (context, next) =>
{
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();

    if (context.Request.Path == "/stomp" || context.Request.Path == "/games-stomp")
    {
        logger.LogInformation("WS request on {Path} | IsWS={IsWS} | Origin={Origin}",
            context.Request.Path,
            context.WebSockets.IsWebSocketRequest,
            context.Request.Headers["Origin"].ToString());

        if (context.WebSockets.IsWebSocketRequest)
        {
            var stompService = context.RequestServices.GetRequiredService<StompService>();
            var requestedProtocols = context.WebSockets.WebSocketRequestedProtocols;
            var subprotocol = requestedProtocols.FirstOrDefault(p => p is "v12.stomp" or "v11.stomp" or "v10.stomp");
            using var webSocket = subprotocol != null
                ? await context.WebSockets.AcceptWebSocketAsync(subprotocol)
                : await context.WebSockets.AcceptWebSocketAsync();
            logger.LogInformation("WS accepted subprotocol={Subprotocol}", subprotocol ?? "(none)");
            await stompService.HandleWebSocketAsync(webSocket);
        }
        else
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
        }
        return;
    }

    await next(context);
});

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/games", async (GetAvailableGamesUseCase useCase) =>
{
    var games = await useCase.ExecuteAsync();
    return Results.Ok(games);
});

app.MapPost("/api/rooms", (RoomService rooms, CreateRoomRequest req) =>
{
    var room = rooms.Create(req.RoomId, req.Slug);
    return Results.Ok(new { room.Id, room.Slug, room.Started, room.ConnectedCount });
});

app.MapGet("/api/rooms/{roomId}", (RoomService rooms, string roomId) =>
{
    var room = rooms.Get(roomId);
    if (room is null) return Results.NotFound();
    return Results.Ok(new
    {
        room.Id,
        room.Slug,
        room.Started,
        room.ConnectedCount,
        Controllers = room.Controllers.Values.Select(c => new { c.Id, c.Pseudo, c.IsConnected })
    });
});

app.MapPost("/api/rooms/{roomId}/controllers", (RoomService rooms, string roomId, AddControllerRequest req) =>
{
    var (result, info) = rooms.AddOrReconnect(roomId, req.ControllerId, req.Pseudo);

    if (result == ControllerAddResult.RoomNotFound) return Results.NotFound();
    if (result == ControllerAddResult.PseudoTaken)
        return Results.Conflict(new { error = "pseudo_taken", message = $"Le pseudo \"{req.Pseudo}\" est déjà utilisé dans cette partie." });

    var room = rooms.Get(roomId)!;
    return Results.Ok(new
    {
        ControllerId = info!.Id,
        Pseudo = info.Pseudo,
        IsReconnect = result == ControllerAddResult.Reconnected,
        Phase = room.Started ? "playing" : "waiting",
        Count = room.ConnectedCount,
        Controllers = room.Controllers.Values.Select(c => new { c.Id, c.Pseudo, c.IsConnected })
    });
});

// Eager-load BibleService and StompService singletons on startup
app.Services.GetRequiredService<BibleService>();
app.Services.GetRequiredService<StompService>();

app.Run();

record CreateRoomRequest(string RoomId, string Slug);
record AddControllerRequest(string ControllerId, string Pseudo);
