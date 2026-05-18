namespace GameServer.Models
{
    public class GameInfo
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Image { get; set; }
    }

    public class GameConfig
    {
        public List<GameInfo> Games { get; set; } = new();
    }
}
