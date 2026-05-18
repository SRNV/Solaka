using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using GameServer.Models;

namespace GameServer.Services
{
    public class StompService
    {
        private readonly ILogger<StompService> _logger;
        private readonly ConcurrentDictionary<Guid, WebSocketSession> _sessions = new();
        // Destination -> SubscriptionId -> SessionId
        private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, Guid>> _subscriptions = new();

        public StompService(ILogger<StompService> logger)
        {
            _logger = logger;
        }

        public async Task HandleWebSocketAsync(WebSocket webSocket)
        {
            var sessionId = Guid.NewGuid();
            var session = new WebSocketSession(webSocket);
            _sessions[sessionId] = session;

            var buffer = new byte[1024 * 4];
            try
            {
                while (webSocket.State == WebSocketState.Open)
                {
                    var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                    }
                    else
                    {
                        var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        var frame = StompFrame.Parse(message);
                        if (frame != null)
                        {
                            await HandleFrameAsync(sessionId, frame);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WebSocket error for session {SessionId}", sessionId);
            }
            finally
            {
                CleanupSession(sessionId);
            }
        }

        private async Task HandleFrameAsync(Guid sessionId, StompFrame frame)
        {
            if (!_sessions.TryGetValue(sessionId, out var session)) return;

            switch (frame.Command)
            {
                case "CONNECT":
                case "STOMP":
                    await session.SendAsync(StompFrame.Connected());
                    break;

                case "SUBSCRIBE":
                    if (frame.Headers.TryGetValue("destination", out var dest) &&
                        frame.Headers.TryGetValue("id", out var subId))
                    {
                        session.Subscriptions[subId] = dest;
                        var destSubs = _subscriptions.GetOrAdd(dest, _ => new ConcurrentDictionary<string, Guid>());
                        destSubs[subId] = sessionId;
                        _logger.LogDebug("Session {SessionId} subscribed to {Destination}", sessionId, dest);
                    }
                    break;

                case "UNSUBSCRIBE":
                    if (frame.Headers.TryGetValue("id", out var unsubId))
                    {
                        if (session.Subscriptions.TryRemove(unsubId, out var unsubDest))
                        {
                            if (_subscriptions.TryGetValue(unsubDest, out var destSubs))
                            {
                                destSubs.TryRemove(unsubId, out _);
                            }
                        }
                    }
                    break;

                case "SEND":
                    if (frame.Headers.TryGetValue("destination", out var sendDest))
                    {
                        await BroadcastToDestinationAsync(sendDest, frame.Body);
                    }
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

        private async Task BroadcastToDestinationAsync(string destination, string body)
        {
            if (!_subscriptions.TryGetValue(destination, out var destSubs)) return;

            var msgId = Guid.NewGuid().ToString();
            var tasks = new List<Task>();

            foreach (var sub in destSubs)
            {
                if (_sessions.TryGetValue(sub.Value, out var session))
                {
                    var frame = StompFrame.Message(destination, sub.Key, body, msgId);
                    tasks.Add(session.SendAsync(frame));
                }
            }

            await Task.WhenAll(tasks);
        }

        private void CleanupSession(Guid sessionId)
        {
            if (_sessions.TryRemove(sessionId, out var session))
            {
                foreach (var sub in session.Subscriptions)
                {
                    if (_subscriptions.TryGetValue(sub.Value, out var destSubs))
                    {
                        destSubs.TryRemove(sub.Key, out _);
                    }
                }
            }
            _logger.LogInformation("Session {SessionId} cleaned up", sessionId);
        }
    }

    public class WebSocketSession
    {
        public WebSocket WebSocket { get; }
        public ConcurrentDictionary<string, string> Subscriptions { get; } = new();

        public WebSocketSession(WebSocket webSocket)
        {
            WebSocket = webSocket;
        }

        public async Task SendAsync(StompFrame frame)
        {
            if (WebSocket.State != WebSocketState.Open) return;
            var raw = frame.ToRaw();
            var bytes = Encoding.UTF8.GetBytes(raw);
            await WebSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }
}
