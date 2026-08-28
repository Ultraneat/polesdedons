import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    // Dans notre environnement, le socket est sur le même hôte et port (3000)
    socket = io();
    
    socket.on("connect", () => {
      console.log("Connecté au serveur de temps réel");
    });
    
    socket.on("disconnect", () => {
      console.log("Déconnecté du serveur de temps réel");
    });
  }
  return socket;
};

export const registerUser = (userData: { name: string, is_admin: boolean, is_auth: boolean, email?: string }) => {
  const s = getSocket();
  s.emit("user:register", userData);
};

export const joinConversation = (userId: string) => {
  const s = getSocket();
  s.emit("conversation:join", userId);
};

export const sendMessage = (payload: { 
  donation_id: string, 
  sender: 'user' | 'agent', 
  content: string, 
  user_name: string, 
  attachment?: any,
  is_auth: boolean
}) => {
  const s = getSocket();
  s.emit("message:send", payload);
};
