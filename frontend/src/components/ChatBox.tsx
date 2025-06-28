import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatBoxProps {
  onSend: (msg: string) => void;
  messages: { text: string; fromMe: boolean; id: number }[];
  dataChannelOpen?: boolean;
}

const ChatBox: React.FC<ChatBoxProps> = ({ onSend, messages, dataChannelOpen }) => {
  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && dataChannelOpen) {
      console.log("[ChatBox] Sending message:", input.trim());
      onSend(input.trim());
      setInput("");
    } else if (!dataChannelOpen) {
      console.warn("[ChatBox] Cannot send message - data channel not open");
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when data channel opens
  useEffect(() => {
    if (dataChannelOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [dataChannelOpen, isMinimized]);

  // Show only the last 10 messages
  const visibleMessages = messages.slice(-10);

  const getConnectionStatusText = () => {
    if (dataChannelOpen) return "Chat connected";
    return "Chat connecting...";
  };

  const getConnectionStatusColor = () => {
    if (dataChannelOpen) return "text-green-400";
    return "text-yellow-400";
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
            <div className={`w-2 h-2 rounded-full ${dataChannelOpen ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
            <span className={`text-sm font-medium ${getConnectionStatusColor()}`}>
              {getConnectionStatusText()}
            </span>
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
                      {dataChannelOpen ? "No messages yet. Start the conversation!" : "Waiting for connection..."}
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
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-lg text-sm break-words ${
                            msg.fromMe
                              ? "bg-blue-600 text-white rounded-br-sm"
                              : "bg-gray-700 text-gray-100 rounded-bl-sm"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </motion.div>
                    ))
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
                      dataChannelOpen 
                        ? "Type a message..." 
                        : "Waiting for connection..."
                    }
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    maxLength={500}
                    disabled={!dataChannelOpen}
                  />
                  <button
                    type="submit"
                    className={`px-4 py-3 font-semibold transition-colors ${
                      dataChannelOpen && input.trim()
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                    }`}
                    disabled={!dataChannelOpen || !input.trim()}
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
          <div>Data Channel: {dataChannelOpen ? "Open" : "Closed"}</div>
          <div>Messages: {messages.length}</div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;