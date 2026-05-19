using System.Text.Json;
using GameServer.Domain.Entities;
using GameServer.Domain.Repositories;
using Microsoft.Extensions.Logging;

namespace GameServer.Infrastructure.Repositories
{
    public class JsonGameRepository : IGameRepository
    {
        private readonly string _configPath;
        private readonly ILogger<JsonGameRepository> _logger;

        public JsonGameRepository(IConfiguration configuration, ILogger<JsonGameRepository> logger)
        {
            _configPath = configuration["GAMES_CONFIG_PATH"] ?? "Resources/GamesData/games.json";
            _logger = logger;
        }

        public async Task<IEnumerable<Game>> GetAllAsync()
        {
            try
            {
                if (!File.Exists(_configPath))
                {
                    _logger.LogWarning("Games config file not found at {Path}", _configPath);
                    return Enumerable.Empty<Game>();
                }

                var json = await File.ReadAllTextAsync(_configPath);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var games = JsonSerializer.Deserialize<List<GameInfoDto>>(json, options);

                if (games == null) return Enumerable.Empty<Game>();

                return games.Select(g => new Game(g.Title, g.Description, g.Slug, g.Image));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading games repository");
                return Enumerable.Empty<Game>();
            }
        }

        private class GameInfoDto
        {
            public string Title { get; set; } = string.Empty;
            public string Description { get; set; } = string.Empty;
            public string Slug { get; set; } = string.Empty;
            public string? Image { get; set; }
        }
    }
}
