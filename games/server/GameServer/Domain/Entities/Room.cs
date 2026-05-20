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

        // replacedControllerId: ancien controllerId supprimé lors d'une reconnexion par pseudo
        public (ControllerAddResult Result, ControllerInfo Controller, string? ReplacedControllerId) AddOrReconnect(
            string controllerId, string pseudo, Guid? sessionId)
        {
            lock (_lock)
            {
                LastActivity = DateTimeOffset.UtcNow;

                // 1. Même controllerId → reconnexion directe
                if (_controllers.TryGetValue(controllerId, out var existing))
                {
                    existing.Pseudo = pseudo;
                    existing.IsConnected = true;
                    existing.DisconnectedAt = null;
                    existing.LastSeen = DateTimeOffset.UtcNow;
                    existing.SessionId = sessionId;
                    return (ControllerAddResult.Reconnected, existing, null);
                }

                // 2. Même pseudo sur un contrôleur déconnecté → reconnexion par pseudo
                //    (téléphone redémarré, nouvel onglet, session perdue)
                var ghost = _controllers.Values.FirstOrDefault(c =>
                    !c.IsConnected &&
                    c.Pseudo.Equals(pseudo, StringComparison.OrdinalIgnoreCase));
                if (ghost != null)
                {
                    var oldId = ghost.Id;
                    _controllers.Remove(oldId);
                    var migrated = new ControllerInfo(controllerId, pseudo) { SessionId = sessionId };
                    _controllers[controllerId] = migrated;
                    return (ControllerAddResult.Reconnected, migrated, oldId);
                }

                // 3. Pseudo déjà pris par un contrôleur connecté
                if (_controllers.Values.Any(c =>
                    c.IsConnected && c.Pseudo.Equals(pseudo, StringComparison.OrdinalIgnoreCase)))
                {
                    return (ControllerAddResult.PseudoTaken, new ControllerInfo(controllerId, pseudo), null);
                }

                // 4. Nouveau contrôleur
                var info = new ControllerInfo(controllerId, pseudo) { SessionId = sessionId };
                _controllers[controllerId] = info;
                return (ControllerAddResult.Added, info, null);
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
