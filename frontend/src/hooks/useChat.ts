import { useEffect, useRef, useState, useCallback } from "react";

export interface ChatMessage {
  id: string;
  text: string;
  from: string;
  fromMe: boolean;
  timestamp: Date;
  type: 'chat' | 'system' | 'join' | 'leave';
}

export interface ChatStats {
  totalMessages: number;
  participants: string[];
  isConnected: boolean;
}

export function useChat(roomId: string, userName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState<string[]>([]);
  const [chatStats, setChatStats] = useState<ChatStats>({
    totalMessages: 0,
    participants: [],
    isConnected: false,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());

  const connectChat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsBase = import.meta.env.PROD
      ? "wss://seaside-backend-pw1v.onrender.com"
      : `${wsProtocol}://${window.location.hostname}:8080`;

    const ws = new WebSocket(`${wsBase}/chat?roomID=${roomId}&username=${encodeURIComponent(userName)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setChatStats(prev => ({ ...prev, isConnected: true }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    ws.onclose = (event) => {
      setChatStats(prev => ({ ...prev, isConnected: false }));
      
      // Auto-reconnect (simple version)
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(connectChat, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [roomId, userName]);

  const handleMessage = useCallback((data: any) => {
    const messageId = data.id || `${Date.now()}-${Math.random()}`;
    
    // Simple duplicate prevention
    if (messageIdsRef.current.has(messageId)) return;
    messageIdsRef.current.add(messageId);

    if (data.type === 'typing') {
      // Simple typing indicators
      if (data.isTyping && data.from !== userName) {
        setIsTyping(prev => [...prev.filter(p => p !== data.from), data.from]);
        setTimeout(() => {
          setIsTyping(prev => prev.filter(p => p !== data.from));
        }, 3000);
      } else {
        setIsTyping(prev => prev.filter(p => p !== data.from));
      }
      return;
    }

    const message: ChatMessage = {
      id: messageId,
      text: data.text || "",
      from: data.from || "system",
      fromMe: data.from === userName,
      timestamp: new Date(data.timestamp || Date.now()),
      type: data.type || "chat",
    };

    setMessages(prev => [...prev, message]);
    setChatStats(prev => ({ ...prev, totalMessages: prev.totalMessages + 1 }));

    // Simple participant tracking
    if (data.type === 'join') {
      setChatStats(prev => ({
        ...prev,
        participants: [...new Set([...prev.participants, data.from])]
      }));
    } else if (data.type === 'leave') {
      setChatStats(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p !== data.from)
      }));
    } else if (data.participants) {
      setChatStats(prev => ({ ...prev, participants: data.participants }));
    }
  }, [userName]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      text: text.trim(),
      from: userName,
      fromMe: true,
      timestamp: new Date(),
      type: "chat",
    };

    setMessages(prev => [...prev, message]);
    setChatStats(prev => ({ ...prev, totalMessages: prev.totalMessages + 1 }));

    wsRef.current.send(JSON.stringify({
      type: "chat",
      text: text.trim(),
    }));
  }, [userName]);

  // Simple typing indicator
  const handleTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", isTyping: true }));
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "typing", isTyping: false }));
        }
      }, 1000);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setChatStats(prev => ({ ...prev, totalMessages: 0 }));
    messageIdsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!roomId || !userName) return;
    
    connectChat();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [roomId, userName, connectChat]);

  return {
    messages,
    isTyping,
    chatStats,
    isConnected: chatStats.isConnected,
    sendMessage,
    handleTyping,
    clearMessages,
    connectChat,
  };
}