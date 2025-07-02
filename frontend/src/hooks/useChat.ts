import { useEffect, useRef, useState, useCallback } from "react";

// Define the structure of chat messages
export interface ChatMessage {
  id: string;
  text: string;
  from: string;
  fromMe: boolean;
  timestamp: Date;
  type: 'chat' | 'system' | 'join' | 'leave' | 'typing' | 'participants';
}

// Define chat statistics
export interface ChatStats {
  totalMessages: number;
  participants: string[];
  isConnected: boolean;
}

// Main chat hook that handles both WebRTC and WebSocket chat
export function useChat(
  roomId: string,
  userName: string,
  dataChannelOpen: boolean,
  sendWebRTCMessage?: (msg: string) => void
) {
  // State management
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState<string[]>([]);
  const [chatStats, setChatStats] = useState<ChatStats>({
    totalMessages: 0,
    participants: [],
    isConnected: false,
  });
  const [isConnected, setIsConnected] = useState(false);
  
  // Refs for managing timeouts and connections
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Connect to chat WebSocket server
  const connectChat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Determine WebSocket URL based on environment
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsBase = (import.meta as any).env?.PROD
      ? "wss://seaside-backend-pw1v.onrender.com"
      : `${wsProtocol}://${window.location.hostname}:8080`;

    // Create WebSocket connection with room and user info
    const ws = new WebSocket(`${wsBase}/chat?roomID=${roomId}&username=${encodeURIComponent(userName)}`);
    wsRef.current = ws;

    // Handle connection open
    ws.onopen = () => {
      console.log("[Chat] WebSocket connected");
      setIsConnected(true);
      setChatStats((prev: ChatStats) => ({ ...prev, isConnected: true }));
    };

    // Handle incoming messages
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleChatMessage(data);
      } catch (error) {
        console.error("[Chat] Error parsing message:", error);
      }
    };

    // Handle connection close
    ws.onclose = (event) => {
      console.log("[Chat] WebSocket disconnected:", event.code, event.reason);
      setIsConnected(false);
      setChatStats((prev: ChatStats) => ({ ...prev, isConnected: false }));
      
      // Attempt reconnection if not intentional close
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectChat();
        }, 3000);
      }
    };

    // Handle connection errors
    ws.onerror = (error) => {
      console.error("[Chat] WebSocket error:", error);
    };
  }, [roomId, userName]);

  // Process incoming chat messages
  const handleChatMessage = useCallback((data: any) => {
    // Create a standardized message object
    const message: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: data.text || "",
      from: data.from || "system",
      fromMe: data.from === userName,
      timestamp: new Date(data.timestamp || Date.now()),
      type: data.type || "chat",
    };

    // Only add to messages if not a typing indicator
    if (["chat", "system", "join", "leave", "participants"].includes(message.type)) {
      setMessages((prev: ChatMessage[]) => {
        // Prevent duplicate: if a message with same text, from, and timestamp exists, don't add
        const exists = prev.some(
          m =>
            m.text === message.text &&
            m.from === message.from &&
            m.timestamp.getTime() === message.timestamp.getTime()
        );
        if (!exists) {
          return [...prev, message];
        }
        return prev;
      });
      setChatStats((prev: ChatStats) => ({ ...prev, totalMessages: prev.totalMessages + 1 }));
    }

    // Handle different message types
    switch (data.type) {
      case "join":
        // Add new participant to the list
        setChatStats((prev: ChatStats) => ({
          ...prev,
          participants: [...prev.participants, data.from].filter((v, i, a) => a.indexOf(v) === i)
        }));
        break;
      case "leave":
        // Remove participant from the list
        setChatStats((prev: ChatStats) => ({
          ...prev,
          participants: prev.participants.filter(p => p !== data.from)
        }));
        break;
      case "participants":
        // Extract participants from system message
        const participantsText = data.text.replace("Current participants: ", "");
        const participants = participantsText === "None" ? [] : participantsText.split(", ");
        setChatStats((prev: ChatStats) => ({ ...prev, participants }));
        break;
      case "typing":
        // Handle typing indicators
        if (data.text) {
          setIsTyping((prev: string[]) => [...prev.filter(p => p !== data.from), data.from]);
          setTimeout(() => {
            setIsTyping((prev: string[]) => prev.filter(p => p !== data.from));
          }, 3000);
        } else {
          setIsTyping((prev: string[]) => prev.filter(p => p !== data.from));
        }
        break;
    }
  }, [userName]);

  // Send message through WebRTC data channel (primary) or WebSocket (fallback)
  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    // Create message object
    const message: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: text.trim(),
      from: userName,
      fromMe: true,
      timestamp: new Date(),
      type: "chat",
    };

    // Add message to local state immediately for instant feedback
    setMessages((prev: ChatMessage[]) => [...prev, message]);
    setChatStats((prev: ChatStats) => ({ ...prev, totalMessages: prev.totalMessages + 1 }));

    // Try WebRTC first (faster, peer-to-peer), then WebSocket as fallback
    if (dataChannelOpen && sendWebRTCMessage) {
      console.log("[Chat] Sending via WebRTC data channel");
      sendWebRTCMessage(text);
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[Chat] Sending via WebSocket");
      wsRef.current.send(JSON.stringify({
        type: "chat",
        text: text.trim(),
      }));
    } else {
      console.warn("[Chat] No connection available to send message");
    }
  }, [userName, dataChannelOpen, sendWebRTCMessage]);

  // Send typing indicator to other participants
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "typing",
        isTyping,
      }));
    }
  }, []);

  // Handle typing with debounce (prevents spam)
  const handleTyping = useCallback(() => {
    sendTypingIndicator(true);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = window.setTimeout(() => {
      sendTypingIndicator(false);
    }, 1000);
  }, [sendTypingIndicator]);

  // Clear all messages (useful for room changes)
  const clearMessages = useCallback(() => {
    setMessages([]);
    setChatStats((prev: ChatStats) => ({ ...prev, totalMessages: 0 }));
  }, []);

  // Connect to chat when component mounts or room/user changes
  useEffect(() => {
    if (roomId && userName) {
      connectChat();
    }

    // Cleanup function
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [roomId, userName, connectChat]);

  // Handle WebRTC messages (for when WebSocket is not available)
  useEffect(() => {
    if (dataChannelOpen && sendWebRTCMessage) {
      console.log("[Chat] WebRTC data channel available for chat");
    }
  }, [dataChannelOpen, sendWebRTCMessage]);

  // Return all the functions and state that components need
  return {
    messages,
    isTyping,
    chatStats,
    isConnected,
    sendMessage,
    handleTyping,
    clearMessages,
    connectChat,
  };
} 