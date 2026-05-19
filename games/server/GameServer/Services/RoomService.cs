using System.Collections.Concurrent;
using GameServer.Domain.Entities;

namespace GameServer.Services
{
    public class RoomService
    {
        private readonly ConcurrentDictionary<string, Room> _rooms = new();

        public Room Create(string roomId, string slug)
        {
            var room = new Room(roomId, slug);
            _rooms[roomId] = room;
            return room;
        }

        public Room? Get(string roomId) =>
            _rooms.TryGetValue(roomId, out var room) ? room : null;

        public bool AddController(string roomId, string controllerId)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return false;
            room.AddController(controllerId);
            return true;
        }
    }
}
