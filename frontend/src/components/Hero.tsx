import React, { useState, useEffect } from 'react'; 
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CreateRoomModal from './modals/CreateRoomModal';
import JoinRoomModal from './modals/JoinRoomModal';
import Notification from "../components/notification";
import light from '../assets/light.png';
import Navbar from './Navbar';



const Hero: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(false); // Add this state
  const navigate = useNavigate();

  // Now expects (roomId: string, userName: string)
  const handleCreateRoom = (roomId: string, userName: string) => {
    navigate(`/room/${roomId}?user=${encodeURIComponent(userName)}`);
  };

  const handleJoinRoom = (roomId: string, userName: string) => {
    navigate(`/room/${roomId}?user=${encodeURIComponent(userName)}`);
  };

  // Debug effect
  useEffect(() => {
    console.log('Notification state changed:', showNotification);
  }, [showNotification]);

  return (
    <div
      className="w-full min-h-screen flex flex-col items-center jjustify-start px-4 lg:pt-52 pt-48 relative"
      style={{
        backgroundImage: `url(${light})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center bottom',
        backgroundSize: '1000px 950px', // changed from 'contain' to 'cover'
      }}
    >
      <Navbar />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-5xl md:text-7xl font-extrabold mb-8 bg-gradient-to-r from-gray-400 via-white to-gray-600 bg-clip-text text-transparent tracking-tight">
          Next-Gen Podcast Rooms
        </h1>
        <p className="text-gray-200 max-w-md mx-auto mb-10 text-xl">
          Create, join, and record podcasts with high-quality video, real-time chat, and cloud storage.


        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsCreateModalOpen(true)}
            className="px-8 py-3 rounded-xl border-2 border-indigo-400 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300"
          >
            Create Room
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsJoinModalOpen(true)}
            className="px-8 py-3 rounded-xl border-2 border-white/40 bg-gray-900 backdrop-blur-md text-white font-medium border border-gray-700 hover:bg-gray-800 transition-all duration-300"
          >
            Join Room
          </motion.button>
        </div>
      </motion.div>

      {isCreateModalOpen && (
        <CreateRoomModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreateRoom={handleCreateRoom}
          onError={() => setShowNotification(true)} 
        />
      )}
      {isJoinModalOpen && (
        <JoinRoomModal
          onClose={() => setIsJoinModalOpen(false)}
          onJoinRoom={handleJoinRoom}
        />
      )}
      <Notification 
        show={showNotification} 
        onClose={() => setShowNotification(false)} 
      />
    </div>

  );
};

export default Hero;