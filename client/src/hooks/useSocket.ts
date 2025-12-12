import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/lib/auth';

interface SocketHookReturn {
  socket: Socket | null;
  connected: boolean;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
}

export const useSocket = (): SocketHookReturn => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    // Initialize socket connection
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: {
        token: localStorage.getItem('auth_token')
      }
    });

    newSocket.on('connect', () => {
      console.log('Connected to Socket.IO');
      setConnected(true);
      
      // Join user's personal room for notifications
      newSocket.emit('join-user-room', user.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO');
      setConnected(false);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  const joinRoom = (roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join-chat-room', roomId);
    }
  };

  const leaveRoom = (roomId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-chat-room', roomId);
    }
  };

  return {
    socket: socketRef.current,
    connected,
    joinRoom,
    leaveRoom,
  };
};
