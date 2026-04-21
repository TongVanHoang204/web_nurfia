import { io, type Socket } from 'socket.io-client';

type ServerToClientEvents = {
  'socket-connected': (payload: { ok: boolean; timestamp: string; role: string }) => void;
  'customer-status-changed': (payload: {
    customerId: number;
    isActive: boolean;
    updatedBy?: number | null;
    updatedAt?: string;
  }) => void;
  'account-status-changed': (payload: {
    customerId: number;
    isActive: boolean;
    updatedAt?: string;
  }) => void;
};

let socket: Socket<ServerToClientEvents> | null = null;

const getSocketBaseUrl = () => {
  const apiUrl = String(import.meta.env.VITE_API_URL || 'http://localhost:4000/api').trim();
  return apiUrl.replace(/\/api\/?$/, '');
};

export const connectSocket = () => {
  if (!socket) {
    socket = io(getSocketBaseUrl(), {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    }) as Socket<ServerToClientEvents>;
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
};
