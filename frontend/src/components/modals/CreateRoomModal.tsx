import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface CreateRoomModalProps {
  onClose: () => void;
  onCreateRoom: (roomId: string, userName: string, isHost: boolean) => void;
  onError: () => void;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onClose, onCreateRoom, onError }) => {
  const { user, isAuthenticated } = useAuth();
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Initialize username based on authentication status
  useEffect(() => {
    if (isAuthenticated && user) {
      setUserName(user.username);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
  const fetchRoomId = async () => {
    try {
      const backendBase = import.meta.env.PROD
        ? 'https://seaside-backend-pw1v.onrender.com'
        : '';

      const response = await fetch(`${backendBase}/create-room`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch room ID');
      }
      
      const data = await response.json();
      
      if (!data.roomID) {
        throw new Error('No room ID received');
      }
      
      setRoomId(data.roomID);
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to generate room. Try again.');
      if (onError) {
        console.log('Calling onError callback');
        onError(); // This should trigger the notification
      }
    }
  };
  
  fetchRoomId();

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  },[onClose, onError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim() === '' || roomId === '') return;
    setIsCreating(true);
    setError('');
    onCreateRoom(roomId, userName, true); // Pass isHost=true
  };

  const handleCopy = async () => {
    if (roomId) {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
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
        onClick={(e: React.MouseEvent<HTMLDivElement, MouseEvent>) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Create a new room</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="roomId" className="block text-sm font-medium text-gray-400 mb-1">
              Room ID
            </label>
            <div className="flex items-center">
              <input
                type="text"
                id="roomId"
                value={roomId}
                readOnly
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
              />
              <button
                type="button"
                onClick={handleCopy}
                disabled={!roomId}
                className="ml-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                tabIndex={-1}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">This is your unique room identifier</p>
          </div>
          <div className="mb-4">
            <label htmlFor="userName" className="block text-sm font-medium text-gray-400 mb-1">
              Your Name
            </label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
              disabled={!!(isAuthenticated && user)}
            />
            {isAuthenticated && user && (
              <p className="mt-1 text-xs text-green-400">✓ Signed in as {user.username}</p>
            )}
            {!isAuthenticated && (
              <p className="mt-1 text-xs text-yellow-400">⚠ You'll join as a guest. Sign in for recording features.</p>
            )}
          </div>
          {error && <div className="text-red-500 mb-2">{error}</div>}
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
              disabled={isCreating || userName.trim() === ''}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors ${
                isCreating ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default CreateRoomModal;