import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../src/lib/sdk';

export const socket: Socket = io(API_BASE_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

socket.on('connect', () => {
  const userId = (socket.auth as any)?.userId;
  if (userId) {
    console.log(`⚡ [Socket] Connected to server, joining room: ${userId}`);
    socket.emit('join:room', userId);
  }
});

export const connectSocket = (userId: string, token?: string | null) => {
  if (!userId) return;
  socket.auth = { token: token || '', userId };
  if (!socket.connected) {
    socket.connect();
  } else {
    socket.emit('join:room', userId);
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
