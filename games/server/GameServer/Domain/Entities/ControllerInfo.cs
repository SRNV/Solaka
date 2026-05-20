namespace GameServer.Domain.Entities
{
    public class ControllerInfo
    {
        public string Id { get; }
        public string Pseudo { get; set; }
        public bool IsConnected { get; set; }
        public DateTimeOffset LastSeen { get; set; }
        public DateTimeOffset? DisconnectedAt { get; set; }
        public Guid? SessionId { get; set; }

        public ControllerInfo(string id, string pseudo)
        {
            Id = id;
            Pseudo = pseudo;
            IsConnected = true;
            LastSeen = DateTimeOffset.UtcNow;
        }
    }
}
