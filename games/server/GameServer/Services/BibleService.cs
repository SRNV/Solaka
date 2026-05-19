using System.Text.Json;

namespace GameServer.Services
{
    public class BibleService
    {
        private readonly ILogger<BibleService> _logger;
        private JsonDocument? _bibleData;

        public BibleService(ILogger<BibleService> logger, IConfiguration configuration)
        {
            _logger = logger;
            var biblePath = configuration["BIBLE_PATH"] ?? "../../../scrapp/output/bible.json";
            LoadBible(biblePath);
        }

        private void LoadBible(string path)
        {
            try
            {
                if (File.Exists(path))
                {
                    var json = File.ReadAllText(path);
                    _bibleData = JsonDocument.Parse(json);
                    _logger.LogInformation("Bible data loaded from {Path}", path);
                }
                else
                {
                    _logger.LogWarning("Bible file not found at {Path}", path);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading bible data from {Path}", path);
            }
        }

        public JsonDocument? GetBibleData() => _bibleData;
    }
}
