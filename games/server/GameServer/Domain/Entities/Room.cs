namespace GameServer.Domain.Entities
{
    public enum ControllerAddResult { Added, Reconnected, PseudoTaken, RoomNotFound }

    public class Room
    {
        public string Id { get; }
        public string Slug { get; }

        private readonly Dictionary<string, ControllerInfo> _controllers = new();
        public IReadOnlyDictionary<string, ControllerInfo> Controllers => _controllers;

        public bool Started { get; private set; }
        public DateTimeOffset CreatedAt { get; } = DateTimeOffset.UtcNow;
        public DateTimeOffset LastActivity { get; private set; } = DateTimeOffset.UtcNow;
        public Guid? ConsoleSessionId { get; set; }

        private readonly object _lock = new();

        public Room(string id, string slug) { Id = id; Slug = slug; }

        public (ControllerAddResult Result, ControllerInfo Controller) AddOrReconnect(
            string controllerId, string pseudo, Guid? sessionId)
        {
            lock (_lock)
            {
                LastActivity = DateTimeOffset.UtcNow;

                // Reconnect: same controller ID, regardless of ghost timer state
                if (_controllers.TryGetValue(controllerId, out var existing))
                {
                    existing.Pseudo = pseudo;
                    existing.IsConnected = true;
                    existing.DisconnectedAt = null;
                    existing.LastSeen = DateTimeOffset.UtcNow;
                    existing.SessionId = sessionId;
                    return (ControllerAddResult.Reconnected, existing);
                }

                // Pseudo uniqueness among currently connected controllers
                if (_controllers.Values.Any(c =>
                    c.IsConnected && c.Pseudo.Equals(pseudo, StringComparison.OrdinalIgnoreCase)))
                {
                    return (ControllerAddResult.PseudoTaken, new ControllerInfo(controllerId, pseudo));
                }

                var info = new ControllerInfo(controllerId, pseudo) { SessionId = sessionId };
                _controllers[controllerId] = info;
                return (ControllerAddResult.Added, info);
            }
        }

        public void MarkDisconnected(string controllerId)
        {
            lock (_lock)
            {
                if (_controllers.TryGetValue(controllerId, out var info))
                {
                    info.IsConnected = false;
                    info.DisconnectedAt = DateTimeOffset.UtcNow;
                    info.SessionId = null;
                }
                LastActivity = DateTimeOffset.UtcNow;
            }
        }

        public void RemoveController(string controllerId)
        {
            lock (_lock) { _controllers.Remove(controllerId); }
        }

        public void UpdateLastSeen(string controllerId)
        {
            lock (_lock)
            {
                if (_controllers.TryGetValue(controllerId, out var info))
                    info.LastSeen = DateTimeOffset.UtcNow;
                LastActivity = DateTimeOffset.UtcNow;
            }
        }

        public void SetSession(string controllerId, Guid sessionId)
        {
            lock (_lock)
            {
                if (_controllers.TryGetValue(controllerId, out var info))
                    info.SessionId = sessionId;
            }
        }

        public int ConnectedCount
        {
            get { lock (_lock) return _controllers.Values.Count(c => c.IsConnected); }
        }

        public bool HasAnyConnected()
        {
            lock (_lock) return _controllers.Values.Any(c => c.IsConnected);
        }

        public void Start() { lock (_lock) { Started = true; LastActivity = DateTimeOffset.UtcNow; } }
        public void Touch() { lock (_lock) LastActivity = DateTimeOffset.UtcNow; }
    }
}
