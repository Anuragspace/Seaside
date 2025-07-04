import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CreateRoomModal from './modals/CreateRoomModal';
import JoinRoomModal from './modals/JoinRoomModal';
import Notification from "../components/notification";

const Hero: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const navigate = useNavigate();

  // Now expects (roomId: string, userName: string)
  const handleCreateRoom = (roomId: string, userName: string) => {
    navigate(`/room/${roomId}?user=${encodeURIComponent(userName)}`);
  };

  const handleJoinRoom = (roomId: string, userName: string) => {
    navigate(`/room/${roomId}?user=${encodeURIComponent(userName)}`);
  };

  return (
    <div className="pt-32 w-full flex flex-col items-center justify-center px-4 mt-0">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-5xl md:text-7xl font-extrabold mb-8 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent tracking-tight">
          Next Podcast Platform
        </h1>
        <p className="text-gray-400 max-w-md mx-auto mb-10 text-lg">
          Connect with others through seamless video and audio conversations in virtual rooms with cloud support
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsCreateModalOpen(true)}
            className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300"
          >
            Create Room
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsJoinModalOpen(true)}
            className="px-8 py-3 rounded-lg bg-gray-800/70 backdrop-blur-md text-white font-medium border border-gray-700 hover:bg-gray-700/80 transition-all duration-300"
          >
            Join Room
          </motion.button>
        </div>
      </motion.div>

      {isCreateModalOpen && (
        <CreateRoomModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreateRoom={handleCreateRoom}
        />
      )}
      {isJoinModalOpen && (
        <JoinRoomModal
          onClose={() => setIsJoinModalOpen(false)}
          onJoinRoom={handleJoinRoom}
        />
      )}
      <Notification />
    </div>
    
  );
};

export default Hero;