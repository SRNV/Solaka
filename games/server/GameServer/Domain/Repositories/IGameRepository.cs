using GameServer.Domain.Entities;

namespace GameServer.Domain.Repositories
{
    public interface IGameRepository
    {
        Task<IEnumerable<Game>> GetAllAsync();
    }
}
