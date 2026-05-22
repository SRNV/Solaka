using System.Collections.Concurrent;
using GameServer.Domain.Entities;

namespace GameServer.Services
{
    public class RoomService
    {
        private readonly ConcurrentDictionary<string, Room> _rooms = new();
        private readonly ConcurrentDictionary<string, CancellationTokenSource> _controllerTimers = new();
        private readonly ConcurrentDictionary<string, CancellationTokenSource> _roomTimers = new();
        private readonly ILogger<RoomService> _logger;

        private static readonly TimeSpan GhostDelay = TimeSpan.FromMinutes(3);

        // Events raised so StompService can broadcast without circular dependency
        public event Func<string, ControllerInfo, bool, Task>? ControllerJoined;   // roomId, info, isReconnect
        public event Func<string, ControllerInfo, Task>? ControllerDisconnected;    // roomId, info
        public event Func<string, string, Task>? ControllerGhosted;                 // roomId, controllerId
        public event Func<string, Task>? RoomClosed;                                // roomId

        public RoomService(ILogger<RoomService> logger) { _logger = logger; }

        public Room Create(string roomId, string slug)
        {
            var room = new Room(roomId, slug);
            _rooms[roomId] = room;
            // Room has 3 min to get its first controller before being collected
            StartRoomTimer(roomId);
            return room;
        }

        public Room? Get(string roomId) =>
            _rooms.TryGetValue(roomId, out var room) ? room : null;

        public (ControllerAddResult Result, ControllerInfo? Controller) AddOrReconnect(
            string roomId, string controllerId, string pseudo, Guid? sessionId = null)
        {
            if (!_rooms.TryGetValue(roomId, out var room))
                return (ControllerAddResult.RoomNotFound, null);

            var (result, info, replacedControllerId) = room.AddOrReconnect(controllerId, pseudo, sessionId);
            if (result == ControllerAddResult.PseudoTaken)
                return (ControllerAddResult.PseudoTaken, info);

            // Cancel controller ghost timer if this was a reconnect
            CancelControllerTimer(roomId, controllerId);
            if (replacedControllerId != null)
                CancelControllerTimer(roomId, replacedControllerId);

            // Someone is active: cancel room ghost timer
            CancelRoomTimer(roomId);

            _ = ControllerJoined?.Invoke(roomId, info, result == ControllerAddResult.Reconnected);
            return (result, info);
        }

        public void AssociateSession(string roomId, string controllerId, Guid sessionId)
        {
            if (_rooms.TryGetValue(roomId, out var room))
                room.SetSession(controllerId, sessionId);
        }

        public void MarkControllerDisconnected(string roomId, string controllerId)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return;
            if (!room.Controllers.TryGetValue(controllerId, out var info)) return;

            room.MarkDisconnected(controllerId);
            _ = ControllerDisconnected?.Invoke(roomId, info);

            // Start 3-min ghost timer — if no reconnect, remove controller
            var key = $"{roomId}:{controllerId}";
            CancelControllerTimer(roomId, controllerId);
            var cts = new CancellationTokenSource();
            _controllerTimers[key] = cts;

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(GhostDelay, cts.Token);
                    room.RemoveController(controllerId);
                    _controllerTimers.TryRemove(key, out _);
                    _logger.LogInformation("Controller {ControllerId} ghosted from room {RoomId}", controllerId, roomId);
                    _ = ControllerGhosted?.Invoke(roomId, controllerId);
                    // Never auto-close a room that has already started
                    if (!room.Started && !room.HasAnyConnected())
                        StartRoomTimer(roomId);
                }
                catch (OperationCanceledException) { }
            });
        }

        public void StartRoom(string roomId)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return;
            room.Start();
            CancelRoomTimer(roomId); // never auto-close a started room
            _logger.LogInformation("Room {RoomId} marked as started", roomId);
        }

        public void UpdateControllerSeen(string roomId, string controllerId)
        {
            if (_rooms.TryGetValue(roomId, out var room))
                room.UpdateLastSeen(controllerId);
        }

        private void StartRoomTimer(string roomId)
        {
            CancelRoomTimer(roomId);
            var cts = new CancellationTokenSource();
            _roomTimers[roomId] = cts;

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(GhostDelay, cts.Token);
                    if (_rooms.TryRemove(roomId, out _))
                    {
                        _roomTimers.TryRemove(roomId, out _);
                        _logger.LogInformation("Room {RoomId} closed (ghost timeout)", roomId);
                        _ = RoomClosed?.Invoke(roomId);
                    }
                }
                catch (OperationCanceledException) { }
            });
        }

        private void CancelRoomTimer(string roomId)
        {
            if (_roomTimers.TryRemove(roomId, out var cts)) cts.Cancel();
        }

        private void CancelControllerTimer(string roomId, string controllerId)
        {
            var key = $"{roomId}:{controllerId}";
            if (_controllerTimers.TryRemove(key, out var cts)) cts.Cancel();
        }
    }
}
