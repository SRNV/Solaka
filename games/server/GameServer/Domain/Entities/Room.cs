namespace GameServer.Domain.Entities
{
    public class Room
    {
        public string Id { get; }
        public string Slug { get; }
        public List<string> Controllers { get; } = new();
        public bool Started { get; private set; }

        public Room(string id, string slug)
        {
            Id = id;
            Slug = slug;
        }

        public void AddController(string controllerId)
        {
            if (!Controllers.Contains(controllerId))
                Controllers.Add(controllerId);
        }

        public void Start() => Started = true;
    }
}
