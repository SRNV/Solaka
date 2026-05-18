using GameServer.Domain.Entities;
using GameServer.Domain.Repositories;

namespace GameServer.Application.UseCases
{
    public class GetAvailableGamesUseCase
    {
        private readonly IGameRepository _gameRepository;

        public GetAvailableGamesUseCase(IGameRepository gameRepository)
        {
            _gameRepository = gameRepository;
        }

        public async Task<IEnumerable<Game>> ExecuteAsync()
        {
            return await _gameRepository.GetAllAsync();
        }
    }
}
