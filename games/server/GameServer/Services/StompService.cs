using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using GameServer.Domain.Entities;
using GameServer.Models;

namespace GameServer.Services
{
    public class StompService
    {
        private readonly ILogger<StompService> _logger;
        private readonly RoomService _roomService;
        private readonly ConcurrentDictionary<Guid, WebSocketSession> _sessions = new();
        // Destination -> (SessionId:OriginalSubId) -> (SessionId, OriginalSubId)
        // La clé composite évite que deux sessions avec le même subId (@stomp/stompjs
        // génère toujours sub-0, sub-1… par connexion) ne s'écrasent mutuellement.
        private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, (Guid SessionId, string SubId)>> _subscriptions = new();

        public StompService(ILogger<StompService> logger, RoomService roomService)
        {
            _logger = logger;
            _roomService = roomService;

            // Subscribe to room lifecycle events to broadcast to connected sessions
            _roomService.ControllerJoined += OnControllerJoinedAsync;
            _roomService.ControllerDisconnected += OnControllerDisconnectedAsync;
            _roomService.ControllerGhosted += OnControllerGhostedAsync;
            _roomService.RoomClosed += OnRoomClosedAsync;
        }

        // ── Lifecycle event handlers ────────────────────────────────────────────

        private async Task OnControllerJoinedAsync(string roomId, ControllerInfo info, bool isReconnect)
        {
            var room = _roomService.Get(roomId);
            if (room is null) return;
            var controllers = room.Controllers.Values.Select(c => new { c.Id, c.Pseudo, c.IsConnected });
            var payload = JsonSerializer.Serialize(new
            {
                type = isReconnect ? "controller_reconnected" : "controller_joined",
                controllerId = info.Id,
                pseudo = info.Pseudo,
                isReconnect,
                count = room.ConnectedCount,
                controllers
            });
            await BroadcastAsync($"/topic/room/{roomId}", payload);
        }

        private async Task OnControllerDisconnectedAsync(string roomId, ControllerInfo info)
        {
            var room = _roomService.Get(roomId);
            if (room is null) return;
            var controllers = room.Controllers.Values.Select(c => new { c.Id, c.Pseudo, c.IsConnected });
            var payload = JsonSerializer.Serialize(new
            {
                type = "controller_disconnected",
                controllerId = info.Id,
                pseudo = info.Pseudo,
                count = room.ConnectedCount,
                controllers
            });
            await BroadcastAsync($"/topic/room/{roomId}", payload);
        }

        private async Task OnControllerGhostedAsync(string roomId, string controllerId)
        {
            var room = _roomService.Get(roomId);
            var payload = JsonSerializer.Serialize(new
            {
                type = "controller_ghosted",
                controllerId,
                count = room?.ConnectedCount ?? 0
            });
            await BroadcastAsync($"/topic/room/{roomId}", payload);
        }

        private async Task OnRoomClosedAsync(string roomId)
        {
            var payload = JsonSerializer.Serialize(new { type = "room_closed" });
            await BroadcastAsync($"/topic/room/{roomId}", payload);
        }

        // ── WebSocket handling ──────────────────────────────────────────────────

        public async Task HandleWebSocketAsync(WebSocket webSocket)
        {
            var sessionId = Guid.NewGuid();
            var session = new WebSocketSession(webSocket);
            _sessions[sessionId] = session;

            // Buffer supports messages up to 32KB; inputs are small, registry frames are larger
            var buffer = new byte[1024 * 32];
            var messageBuffer = new List<byte>();
            _logger.LogInformation("Session {SessionId} entering receive loop (state={State})", sessionId, webSocket.State);
            try
            {
                while (webSocket.State == WebSocketState.Open)
                {
                    var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        _logger.LogInformation("Session {SessionId} received Close frame", sessionId);
                        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                    }
                    else
                    {
                        messageBuffer.AddRange(new ArraySegment<byte>(buffer, 0, result.Count));
                        if (result.EndOfMessage)
                        {
                            var message = Encoding.UTF8.GetString(messageBuffer.ToArray());
                            messageBuffer.Clear();
                            var frame = StompFrame.Parse(message);
                            if (frame != null)
                                await HandleFrameAsync(sessionId, frame);
                            else
                                _logger.LogWarning("Session {SessionId} failed to parse STOMP frame", sessionId);
                        }
                    }
                }
                _logger.LogInformation("Session {SessionId} left receive loop (state={State})", sessionId, webSocket.State);
            }
            catch (WebSocketException ex) when (
                ex.WebSocketErrorCode == WebSocketError.ConnectionClosedPrematurely ||
                ex.WebSocketErrorCode == WebSocketError.InvalidState)
            {
                _logger.LogInformation("Session {SessionId} closed prematurely: {ErrorCode}", sessionId, ex.WebSocketErrorCode);
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WebSocket error for session {SessionId}", sessionId);
            }
            finally
            {
                await CleanupSessionAsync(sessionId);
            }
        }

        private async Task HandleFrameAsync(Guid sessionId, StompFrame frame)
        {
            if (!_sessions.TryGetValue(sessionId, out var session)) return;

            switch (frame.Command)
            {
                case "CONNECT":
                case "STOMP":
                    _logger.LogInformation("STOMP CONNECT from session {SessionId}", sessionId);
                    await session.SendAsync(StompFrame.Connected());
                    break;

                case "SUBSCRIBE":
                    if (frame.Headers.TryGetValue("destination", out var dest) &&
                        frame.Headers.TryGetValue("id", out var subId))
                    {
                        // Clé stable par manette : survit à la reconnexion WebSocket
                        // (x-controller-id envoyé par le front si disponible, sinon fallback sessionId)
                        frame.Headers.TryGetValue("x-controller-id", out var xCtrlId);
                        var compositeKey = !string.IsNullOrEmpty(xCtrlId)
                            ? $"{xCtrlId}:{subId}"
                            : $"{sessionId}:{subId}";
                        session.Subscriptions[subId] = (dest, compositeKey);
                        var destSubs = _subscriptions.GetOrAdd(dest, _ => new ConcurrentDictionary<string, (Guid, string)>());
                        destSubs[compositeKey] = (sessionId, subId);
                        _logger.LogInformation("SUBSCRIBE session={SessionId} dest={Destination} subId={SubId} key={Key}", sessionId, dest, subId, compositeKey);
                    }
                    break;

                case "UNSUBSCRIBE":
                    if (frame.Headers.TryGetValue("id", out var unsubId))
                    {
                        if (session.Subscriptions.TryRemove(unsubId, out var unsubEntry))
                        {
                            if (_subscriptions.TryGetValue(unsubEntry.Dest, out var destSubs2))
                                destSubs2.TryRemove(unsubEntry.CompositeKey, out _);
                        }
                    }
                    break;

                case "SEND":
                    if (!frame.Headers.TryGetValue("destination", out var sendDest)) break;

                    // Application-level: register session linked to controller
                    if (sendDest == "/app/register")
                    {
                        await HandleRegisterAsync(sessionId, session, frame.Body);
                        break;
                    }

                    // Application-level: ping → pong
                    if (sendDest == "/app/ping")
                    {
                        await HandlePingAsync(sessionId, session, frame.Body);
                        break;
                    }

                    _logger.LogInformation("SEND from {SessionId} (Ctrl={ControllerId}) to {Dest}: {Body}", 
                        sessionId, session.ControllerId ?? "none", sendDest, frame.Body);

                    // Intercept game_started to persist room state
                    if (sendDest.StartsWith("/topic/room/"))
                    {
                        try
                        {
                            using var doc = JsonDocument.Parse(frame.Body);
                            if (doc.RootElement.TryGetProperty("type", out var typeProp) &&
                                typeProp.GetString() == "game_started")
                            {
                                var roomId = sendDest["/topic/room/".Length..];
                                _roomService.StartRoom(roomId);
                            }
                        }
                        catch { /* ignore parse errors */ }
                    }

                    // BROADCAST TO ALL SESSIONS SUBSCRIBED TO THIS DESTINATION
                    // We don't check if the sender is subscribed; STOMP allows SEND without SUBSCRIBE.
                    await BroadcastToDestinationAsync(sendDest, frame.Body);
                    break;

                case "DISCONNECT":
                    if (frame.Headers.TryGetValue("receipt", out var receiptId))
                    {
                        await session.SendAsync(new StompFrame
                        {
                            Command = "RECEIPT",
                            Headers = new Dictionary<string, string> { { "receipt-id", receiptId } }
                        });
                    }
                    break;
            }
        }

        private async Task HandleRegisterAsync(Guid sessionId, WebSocketSession session, string body)
        {
            try
            {
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                if (!root.TryGetProperty("roomId", out var roomIdProp) ||
                    !root.TryGetProperty("controllerId", out var controllerIdProp)) return;

                var roomId = roomIdProp.GetString()!;
                var controllerId = controllerIdProp.GetString()!;

                session.RoomId = roomId;
                session.ControllerId = controllerId;

                _roomService.AssociateSession(roomId, controllerId, sessionId);

                // Remap any sessionId-based subscription keys → controllerId:subId
                // so the same physical controller can reconnect and reclaim its broadcast slot
                foreach (var kvp in session.Subscriptions.ToArray())
                {
                    var subId = kvp.Key;
                    var (dest, oldKey) = kvp.Value;
                    var newKey = $"{controllerId}:{subId}";
                    
                    if (_subscriptions.TryGetValue(dest, out var destSubs))
                    {
                        // TAKEOVER: If this sub key was owned by another session, we evict it
                        if (destSubs.TryGetValue(newKey, out var existing) && existing.Item1 != sessionId)
                        {
                            _logger.LogInformation("Evicting old session {OldSessionId} for controller {ControllerId}", existing.Item1, controllerId);
                            if (_sessions.TryGetValue(existing.Item1, out var oldSess))
                            {
                                // We don't await CloseAsync to avoid blocking the current registration
                                _ = oldSess.WebSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Replaced by new session", CancellationToken.None);
                            }
                        }

                        if (oldKey != newKey) destSubs.TryRemove(oldKey, out _);
                        destSubs[newKey] = (sessionId, subId);
                    }
                    session.Subscriptions[subId] = (dest, newKey);
                }

                _logger.LogInformation("Session {SessionId} registered as controller={ControllerId} room={RoomId}",
                    sessionId, controllerId, roomId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to handle /app/register for session {SessionId}", sessionId);
            }

            await Task.CompletedTask;
        }

        private async Task HandlePingAsync(Guid sessionId, WebSocketSession session, string body)
        {
            try
            {
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                if (root.TryGetProperty("roomId", out var roomIdProp) &&
                    root.TryGetProperty("controllerId", out var controllerIdProp))
                {
                    _roomService.UpdateControllerSeen(roomIdProp.GetString()!, controllerIdProp.GetString()!);
                }
            }
            catch { /* ignore malformed ping */ }

            // Reply pong directly to this session only
            var pong = StompFrame.Message("/user/queue/pong", "pong-sub", "{\"type\":\"pong\"}", Guid.NewGuid().ToString());
            await session.SendAsync(pong);
        }

        // ── Broadcast helpers ───────────────────────────────────────────────────

        public async Task BroadcastAsync(string destination, string body) =>
            await BroadcastToDestinationAsync(destination, body);

        private async Task BroadcastToDestinationAsync(string destination, string body)
        {
            if (!_subscriptions.TryGetValue(destination, out var destSubs)) 
            {
                _logger.LogInformation("No subscribers for {Dest}", destination);
                return;
            }

            var msgId = Guid.NewGuid().ToString();
            var tasks = new List<Task>();
            int count = 0;
            foreach (var sub in destSubs)
            {
                var (sid, originalSubId) = sub.Value;
                if (_sessions.TryGetValue(sid, out var sess))
                {
                    tasks.Add(sess.SendAsync(StompFrame.Message(destination, originalSubId, body, msgId)));
                    count++;
                }
            }
            _logger.LogInformation("Broadcasted to {Count} sessions on {Dest}", count, destination);
            await Task.WhenAll(tasks);
        }

        // ── Session cleanup ─────────────────────────────────────────────────────

        private async Task CleanupSessionAsync(Guid sessionId)
        {
            if (!_sessions.TryRemove(sessionId, out var session)) return;

            foreach (var sub in session.Subscriptions)
            {
                if (_subscriptions.TryGetValue(sub.Value.Dest, out var destSubs))
                {
                    // Only remove if it's still our session (don't kill a reconnected session's sub)
                    if (destSubs.TryGetValue(sub.Value.CompositeKey, out var current) && current.SessionId == sessionId)
                    {
                        destSubs.TryRemove(sub.Value.CompositeKey, out _);
                    }
                }
            }

            // Notify lifecycle if this session was a registered controller
            if (session.RoomId != null && session.ControllerId != null)
                _roomService.MarkControllerDisconnected(session.RoomId, session.ControllerId);

            _logger.LogInformation("Session {SessionId} cleaned up (room={RoomId}, ctrl={ControllerId})",
                sessionId, session.RoomId ?? "-", session.ControllerId ?? "-");

            await Task.CompletedTask;
        }
    }

    public class WebSocketSession
    {
        public WebSocket WebSocket { get; }
        // subId → (destination, compositeKey used in _subscriptions)
        public ConcurrentDictionary<string, (string Dest, string CompositeKey)> Subscriptions { get; } = new();
        public string? RoomId { get; set; }
        public string? ControllerId { get; set; }

        private readonly SemaphoreSlim _sendLock = new(1, 1);

        public WebSocketSession(WebSocket webSocket) { WebSocket = webSocket; }

        public async Task SendAsync(StompFrame frame)
        {
            if (WebSocket.State != WebSocketState.Open) return;
            var bytes = Encoding.UTF8.GetBytes(frame.ToRaw());
            await _sendLock.WaitAsync();
            try
            {
                if (WebSocket.State == WebSocketState.Open)
                    await WebSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            finally
            {
                _sendLock.Release();
            }
        }
    }
}
