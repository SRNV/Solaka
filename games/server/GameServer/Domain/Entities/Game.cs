namespace GameServer.Domain.Entities
{
    public class Game
    {
        public string Title { get; private set; }
        public string Description { get; private set; }
        public string Slug { get; private set; }
        public string? Image { get; private set; }

        public Game(string title, string description, string slug, string? image = null)
        {
            Title = title;
            Description = description;
            Slug = slug;
            Image = image;
        }
    }
}
