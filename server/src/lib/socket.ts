import { Server } from 'socket.io';

let io: Server | null = null;

export const setSocketIO = (socketInstance: Server) => {
  io = socketInstance;
};

export const getSocketIO = (): Server | null => {
  return io;
};

export const emitToAll = (event: string, data: any) => {
  if (io) {
    io.emit(event, data);
  }
};