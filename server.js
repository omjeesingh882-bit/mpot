const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

// Rooms state (Active memory since SQLite will only be used for users)
const rooms = {};
/*
  rooms = {
    "roomId": {
      hostId: "socketId",
      members: [{id: "socketId", name: "Guest1"}],
      videoState: {
        videoId: "",
        currentTime: 0,
        isPlaying: false
      }
    }
  }
*/

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join Room
    socket.on('joinRoom', ({ roomId, username }) => {
        socket.join(roomId);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                hostId: socket.id,
                members: [],
                videoState: { videoId: '', currentTime: 0, isPlaying: false }
            };
        }

        rooms[roomId].members.push({ id: socket.id, name: username || 'Anonymous' });

        // Notify room of new member
        io.to(roomId).emit('roomUpdate', { members: rooms[roomId].members, hostId: rooms[roomId].hostId });
        io.to(roomId).emit('chatMessage', { sender: 'System', text: `${username || 'Someone'} joined.` });

        // Send current video state to the new user
        socket.emit('videoStateSync', rooms[roomId].videoState);
    });

    // Chat Messaging
    socket.on('sendMessage', ({ roomId, message, username }) => {
        io.to(roomId).emit('chatMessage', { sender: username, text: message });
    });

    // Video State (Host actions)
    socket.on('videoAction', ({ roomId, action, payload }) => {
        const room = rooms[roomId];
        if (room && room.hostId === socket.id) {
            if (action === 'NEW_VIDEO') {
                room.videoState.videoId = payload.videoId;
                room.videoState.currentTime = 0;
                room.videoState.isPlaying = true;
            } else if (action === 'PLAY') {
                room.videoState.isPlaying = true;
                room.videoState.currentTime = payload.currentTime;
            } else if (action === 'PAUSE') {
                room.videoState.isPlaying = false;
                room.videoState.currentTime = payload.currentTime;
            } else if (action === 'SEEK') {
                room.videoState.currentTime = payload.currentTime;
            }

            // Broadcast action to all guests (excluding host)
            socket.to(roomId).emit('videoStateUpdate', { action, payload });
        }
    });

    // Host removes a member
    socket.on('removeMember', ({ roomId, targetSocketId }) => {
        const room = rooms[roomId];
        if (room && room.hostId === socket.id) {
            io.to(targetSocketId).emit('kicked');
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) {
                targetSocket.leave(roomId);
            }
            room.members = room.members.filter(m => m.id !== targetSocketId);
            io.to(roomId).emit('roomUpdate', { members: room.members, hostId: room.hostId });
            io.to(roomId).emit('chatMessage', { sender: 'System', text: `A user was removed by host.` });
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const memberIndex = room.members.findIndex(m => m.id === socket.id);

            if (memberIndex !== -1) {
                const username = room.members[memberIndex].name;
                room.members.splice(memberIndex, 1);

                io.to(roomId).emit('roomUpdate', { members: room.members, hostId: room.hostId });
                io.to(roomId).emit('chatMessage', { sender: 'System', text: `${username} left the room.` });

                if (room.members.length === 0) {
                    delete rooms[roomId]; // Clean up empty room
                } else if (room.hostId === socket.id) {
                    // Assign next member as host
                    room.hostId = room.members[0].id;
                    io.to(roomId).emit('roomUpdate', { members: room.members, hostId: room.hostId });
                    io.to(roomId).emit('chatMessage', { sender: 'System', text: `${room.members[0].name} is the new host.` });
                }
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
