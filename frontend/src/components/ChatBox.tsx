// ChatBox.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatBoxProps {
  onSend: (msg: string) => void;
  messages: { text: string; fromMe: boolean; id: number }[];
  dataChannelOpen?: boolean; // <-- add this
}

const ChatBox: React.FC<ChatBoxProps> = ({ onSend, messages, dataChannelOpen }) => {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input.trim());
      setInput("");
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Show only the last 5 messages, newest at the bottom
  const visibleMessages = messages.slice(-5);

  return (
    <div className="fixed bottom-4 right-4 w-80 max-w-full z-50 pointer-events-auto">
      <div className="bg-gray-900 bg-opacity-90 rounded-t-lg shadow-lg p-2 max-h-72 overflow-y-auto flex flex-col">
        <AnimatePresence initial={false}>
          {visibleMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={`mb-2 px-3 py-2 rounded-lg text-sm ${
                msg.fromMe
                  ? "bg-blue-600 text-white self-end" // Solid blue for sent messages
                  : "bg-gray-700 text-gray-100 self-start"
              }`}
              style={{ backgroundColor: msg.fromMe ? undefined : "rgba(55,65,81,0.95)" }} // fallback for bg
            >
              {msg.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <form
        onSubmit={handleSend}
        className="flex bg-gray-800 rounded-b-lg overflow-hidden"
      >
        <input
          ref={inputRef}
          type="text"
          className="flex-1 px-3 py-2 bg-transparent text-white outline-none"
          placeholder={dataChannelOpen ? "Type a message..." : "Connecting chat..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={200}
          disabled={!dataChannelOpen}
        />
        <button
          type="submit"
          className="px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          disabled={!dataChannelOpen}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatBox;