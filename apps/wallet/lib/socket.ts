import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../src/lib/sdk';

export const socket: Socket = io(API_BASE_URL, {

  autoConnect: false,
  transports: ['websocket', 'polling']
});

export const connectSocket = (userId: string, token?: string | null) => {
  if (!userId) return;
  socket.auth = { token: token || '', userId };
  if (!socket.connected) {
    socket.connect();
    socket.emit('join:room', userId);
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
