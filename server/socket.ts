import { Server } from "socket.io";
import { createServer } from "http";

let io: Server;

export const initializeSocket = (httpServer: any) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:5173"],
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected to socket:', socket.id);

    // Join user to their personal room for notifications
    socket.on('join-user-room', (userId: string) => {
      socket.data.userId = userId; // Store userId for later exclusion
      socket.join(`user-${userId}`);
      console.log(`User ${userId} joined their room`);
    });

    // Join user to chat rooms for real-time messages
    socket.on('join-chat-room', (roomId: string) => {
      socket.join(`room-${roomId}`);
      console.log(`User joined chat room: ${roomId}`);
    });

    // Leave chat room
    socket.on('leave-chat-room', (roomId: string) => {
      socket.leave(`room-${roomId}`);
      console.log(`User left chat room: ${roomId}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected from socket:', socket.id);
    });
  });

  return io;
};

export const getSocketIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Helper functions for emitting events
export const emitToUser = (userId: string, event: string, data: any) => {
  const io = getSocketIO();
  io.to(`user-${userId}`).emit(event, data);
};

export const emitToRoomExcludingUser = (roomId: string, excludeUserId: string, event: string, data: any) => {
  const io = getSocketIO();
  
  // Get all sockets and filter by room and exclude sender
  const sockets = Array.from(io.sockets.sockets.values());
  const roomSockets = sockets.filter(socket => 
    socket.rooms.has(`room-${roomId}`) && socket.data.userId !== excludeUserId
  );
  
  // Emit to filtered sockets
  roomSockets.forEach(socket => {
    socket.emit(event, data);
  });
};

export const emitToRoom = (roomId: string, event: string, data: any) => {
  const io = getSocketIO();
  io.to(`room-${roomId}`).emit(event, data);
};

export const emitToAll = (event: string, data: any) => {
  const io = getSocketIO();
  io.emit(event, data);
};
