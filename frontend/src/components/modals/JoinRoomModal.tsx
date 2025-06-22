import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface JoinRoomModalProps {
  onClose: () => void;
  onJoinRoom: (roomId: string, userName: string) => void;
}

const JoinRoomModal: React.FC<JoinRoomModalProps> = ({ onClose, onJoinRoom }) => {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Close on escape key
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const validateRoomId = (id: string) => /^[a-zA-Z0-9]{6,}$/.test(id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim() === '') return;

    if (!validateRoomId(roomId)) {
      setError('Room ID must be at least 6 alphanumeric characters');
      return;
    }

    setIsJoining(true);
    setError('');
    onJoinRoom(roomId, userName);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Join a room</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="roomId" className="block text-sm font-medium text-gray-400 mb-1">
              Room ID
            </label>
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setError('');
              }}
              placeholder="Enter 6+ character room ID"
              minLength={6}
              className={`w-full bg-gray-800 border ${
                error ? 'border-red-500' : 'border-gray-700'
              } rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`}
              required
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>
          <div className="mb-6">
            <label htmlFor="joinUserName" className="block text-sm font-medium text-gray-400 mb-1">
              Your Name
            </label>
            <input
              type="text"
              id="joinUserName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isJoining || roomId.length < 6 || userName.trim() === ''}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors ${
                isJoining || roomId.length < 6 || userName.trim() === '' ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default JoinRoomModal;