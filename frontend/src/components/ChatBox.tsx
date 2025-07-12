import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, ChatStats } from "../hooks/useChat";

interface ChatBoxProps {
  onSend: (msg: string) => void;
  onTyping: () => void;
  messages: ChatMessage[];
  isTyping: string[];
  chatStats: ChatStats;
  isConnected: boolean;
  dataChannelOpen?: boolean;
}

const ChatBox: React.FC<ChatBoxProps> = ({ 
  onSend, 
  onTyping,
  messages, 
  isTyping,
  chatStats,
  isConnected,
  dataChannelOpen 
}) => {
  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && (dataChannelOpen || isConnected)) {
      console.log("[ChatBox] Sending message:", input.trim());
      onSend(input.trim());
      setInput("");
    } else if (!dataChannelOpen && !isConnected) {
      console.warn("[ChatBox] Cannot send message - no connection available");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    onTyping(); // Trigger typing indicator
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when connection opens
  useEffect(() => {
    if ((dataChannelOpen || isConnected) && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [dataChannelOpen, isConnected, isMinimized]);

  // Show only the last 15 messages for better performance
  const visibleMessages = messages.slice(-15);

  const getConnectionStatusText = () => {
    if (dataChannelOpen) return "WebRTC Chat";
    if (isConnected) return "WebSocket Chat";
    return "Connecting...";
  };

  const getConnectionStatusColor = () => {
    if (dataChannelOpen || isConnected) return "text-green-400";
    return "text-yellow-400";
  };

  const getConnectionStatusDot = () => {
    if (dataChannelOpen || isConnected) return 'bg-green-400';
    return 'bg-yellow-400';
  };

  // Format timestamp for display
  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 max-w-full z-50 pointer-events-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/95 backdrop-blur-md rounded-lg shadow-2xl border border-gray-700 overflow-hidden"
      >
        {/* Chat Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getConnectionStatusDot()} animate-pulse`} />
            <div className="flex flex-col">
              <span className={`text-sm font-medium ${getConnectionStatusColor()}`}>
                {getConnectionStatusText()}
              </span>
              <span className="text-xs text-gray-400">
                {chatStats.participants.length} participant{chatStats.participants.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className={`transform transition-transform ${isMinimized ? 'rotate-180' : ''}`}
            >
              <path
                d="M18 15L12 9L6 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Messages Container */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                <AnimatePresence initial={false}>
                  {visibleMessages.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-4">
                      {(dataChannelOpen || isConnected) ? "No messages yet. Start the conversation!" : "Waiting for connection..."}
                    </div>
                  ) : (
                    visibleMessages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] ${msg.fromMe ? 'items-end' : 'items-start'}`}>
                          {/* Message bubble */}
                          <div
                            className={`px-3 py-2 rounded-lg text-sm break-words ${
                              msg.type === 'system'
                                ? "bg-gray-800 text-gray-300 text-center italic"
                                : msg.fromMe
                                ? "bg-blue-600 text-white rounded-br-sm"
                                : "bg-gray-700 text-gray-100 rounded-bl-sm"
                            }`}
                          >
                            {msg.text}
                          </div>
                          
                          {/* Message metadata */}
                          {msg.type === 'chat' && (
                            <div className={`text-xs text-gray-500 mt-1 ${msg.fromMe ? 'text-right' : 'text-left'}`}>
                              {msg.fromMe ? 'You' : msg.from} • {formatTime(msg.timestamp)}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                  
                  {/* Typing indicators */}
                  {isTyping.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm italic">
                        {isTyping.join(', ')} {isTyping.length === 1 ? 'is' : 'are'} typing...
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <form onSubmit={handleSend} className="border-t border-gray-700">
                <div className="flex">
                  <input
                    ref={inputRef}
                    type="text"
                    className="flex-1 px-3 py-3 bg-transparent text-white placeholder-gray-400 outline-none"
                    placeholder={
                      (dataChannelOpen || isConnected)
                        ? "Type a message..." 
                        : "Waiting for connection..."
                    }
                    value={input}
                    onChange={handleInputChange}
                    maxLength={500}
                    disabled={!dataChannelOpen && !isConnected}
                  />
                  <button
                    type="submit"
                    className={`px-4 py-3 font-semibold transition-colors ${
                      (dataChannelOpen || isConnected) && input.trim()
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    }`}
                    disabled={!dataChannelOpen && !isConnected || !input.trim()}
                  >
                    Send
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Debug Info (only in development) */}
      {import.meta.env.DEV && (
        <div className="mt-2 p-2 bg-gray-800/90 rounded text-xs text-gray-400">
          <div>WebRTC: {dataChannelOpen ? "Open" : "Closed"}</div>
          <div>WebSocket: {isConnected ? "Connected" : "Disconnected"}</div>
          <div>Messages: {messages.length}</div>
          <div>Participants: {chatStats.participants.length}</div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;