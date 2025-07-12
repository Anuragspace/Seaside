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
  
  // Generate a unique username to prevent conflicts
  const uniqueUserName = useRef<string>(`${userName}_${Math.random().toString(36).substr(2, 6)}`);

  const connectChat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsBase = import.meta.env.PROD
      ? "wss://seaside-backend-pw1v.onrender.com"
      : `${wsProtocol}://${window.location.hostname}:8080`;

    const wsUrl = `${wsBase}/chat?roomID=${roomId}&username=${encodeURIComponent(uniqueUserName.current)}`;
    console.log("[Chat] Connecting to WebSocket:", wsUrl);
    console.log("[Chat] Using unique username:", uniqueUserName.current);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Chat] WebSocket connected successfully");
      setChatStats(prev => ({ ...prev, isConnected: true }));
    };

    ws.onmessage = (event) => {
      console.log("[Chat] Received message:", event.data);
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (error) {
        console.error("[Chat] Error parsing message:", error);
      }
    };

    ws.onclose = (event) => {
      console.log("[Chat] WebSocket closed:", event.code, event.reason);
      setChatStats(prev => ({ ...prev, isConnected: false }));
      
      // Auto-reconnect (simple version)
      if (event.code !== 1000) {
        console.log("[Chat] Attempting to reconnect in 3 seconds...");
        reconnectTimeoutRef.current = setTimeout(connectChat, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error("[Chat] WebSocket error:", error);
    };
  }, [roomId, userName]);

  const handleMessage = useCallback((data: any) => {
    console.log("[Chat] Processing message:", data);
    
    const messageId = data.id || `${Date.now()}-${Math.random()}`;
    
    // Simple duplicate prevention
    if (messageIdsRef.current.has(messageId)) {
      console.log("[Chat] Duplicate message ignored:", messageId);
      return;
    }
    messageIdsRef.current.add(messageId);

    if (data.type === 'typing') {
      console.log("[Chat] Handling typing message:", data);
      // Simple typing indicators
      if (data.text && data.from !== uniqueUserName.current) {
        setIsTyping(prev => [...prev.filter(p => p !== data.from), data.from]);
        setTimeout(() => {
          setIsTyping(prev => prev.filter(p => p !== data.from));
        }, 3000);
      } else {
        setIsTyping(prev => prev.filter(p => p !== data.from));
      }
      return;
    }

    // Handle system messages (like clear)
    if (data.type === 'system') {
      console.log("[Chat] Handling system message:", data);
      if (data.text === 'Chat cleared') {
        console.log("[Chat] Clearing messages");
        setMessages([]);
        messageIdsRef.current.clear();
        setChatStats(prev => ({ ...prev, totalMessages: 0 }));
        return;
      }
    }

    const message: ChatMessage = {
      id: messageId,
      text: data.text || "",
      from: data.from || "system",
      fromMe: data.from === uniqueUserName.current,
      timestamp: new Date(data.timestamp || Date.now()),
      type: data.type || "chat",
    };

    console.log("[Chat] Adding message to state:", message);
    console.log("[Chat] Current userName:", userName, "Unique userName:", uniqueUserName.current, "Message from:", data.from, "fromMe:", data.from === uniqueUserName.current);
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
    if (!text.trim() || wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn("[Chat] Cannot send message - WebSocket not ready. State:", wsRef.current?.readyState);
      return;
    }

    console.log("[Chat] Sending message:", text);
    
    const messageData = JSON.stringify({
      type: "chat",
      text: text.trim(),
    });
    console.log("[Chat] Sending to WebSocket:", messageData);
    wsRef.current.send(messageData);
  }, []);

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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[Chat] Sending clear command");
      wsRef.current.send(JSON.stringify({ type: "chat", text: "clear" }));
    } else {
      console.log("[Chat] Clearing messages locally");
      setMessages([]);
      setChatStats(prev => ({ ...prev, totalMessages: 0 }));
      messageIdsRef.current.clear();
    }
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