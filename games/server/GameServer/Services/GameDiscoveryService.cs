using GameServer.Models;
using System.Text.Json;

namespace GameServer.Services
{
    public class GameDiscoveryService
    {
        private readonly ILogger<GameDiscoveryService> _logger;
        private List<GameInfo> _games = new();

        public GameDiscoveryService(ILogger<GameDiscoveryService> logger, IConfiguration configuration)
        {
            _logger = logger;
            var configPath = configuration["GAMES_CONFIG_PATH"] ?? "Resources/GamesData/games.json";
            LoadConfig(configPath);
        }

        private void LoadConfig(string path)
        {
            try
            {
                if (File.Exists(path))
                {
                    var json = File.ReadAllText(path);
                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    var config = JsonSerializer.Deserialize<GameConfig>(json, options);
                    
                    _games = config?.Games ?? new List<GameInfo>();
                    _logger.LogInformation("Loaded {Count} games from JSON at {Path}", _games.Count, path);
                }
                else
                {
                    _logger.LogWarning("Games JSON config file not found at {Path}", path);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading games JSON config from {Path}", path);
            }
        }

        public List<GameInfo> GetGames() => _games;
    }
}
