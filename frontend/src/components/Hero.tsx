import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CreateRoomModal from './modals/CreateRoomModal';
import JoinRoomModal from './modals/JoinRoomModal';
import Notification from "./Notification";
import light from '../assets/light.webp';
import Navbar from './Navbar';

const FloatingParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full opacity-40"
          initial={{
            x: Math.random() * window.innerWidth,
            y: window.innerHeight + 100,
          }}
          animate={{
            y: -100,
            x: Math.random() * window.innerWidth,
          }}
          transition={{
            duration: Math.random() * 10 + 15,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};


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
      className="w-full min-h-screen flex flex-col items-center justify-start px-4 lg:pt-52 pt-48 relative -z-20"
      style={{
        backgroundImage: `url(${light})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center bottom',
        backgroundSize: '1250px 950px', // changed from 'contain' to 'cover'
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
        <motion.div 
          className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
        >
          {/* Create Room Button */}
          <motion.div
            className="relative h-[52px] w-full sm:w-[210px] rounded-full bg-[#3e34ff] overflow-hidden cursor-pointer max-w-sm"
            whileHover={{ scale: 1.05, boxShadow: "0px 8px 40px rgba(62,52,255,0.8)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsCreateModalOpen(true)}
          >
            <div className="flex flex-row items-center justify-center gap-2.5 h-full w-full px-4 py-1.5">
              <p className="font-semibold text-[16px] text-white whitespace-pre leading-normal">
                Create Room
              </p>
            </div>
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0px_4px_4px_rgba(255,255,255,0.25)] rounded-full" />
            <div className="absolute inset-0 pointer-events-none rounded-full border border-[#3e34ff] shadow-[0px_4px_30px_rgba(62,52,255,0.6),0px_0px_0px_4px_rgba(62,52,255,0.1)]" />
          </motion.div>

          {/* Join Room Button */}
          <motion.button
            className="bg-gray-800 h-[52px] w-full sm:w-[210px] relative rounded-full overflow-hidden cursor-pointer max-w-sm"
            whileHover={{ scale: 1.05, boxShadow: "0px 8px 30px rgba(255,255,255,0.3)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsJoinModalOpen(true)}
          >
            <div className="flex flex-row items-center justify-center gap-2.5 h-full w-full px-4 py-1.5">
              <p className="font-semibold text-[16px] text-white whitespace-pre leading-normal">
                Join Room
              </p>
            </div>
            <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-gray-500 shadow-[0px_4px_20px_rgba(255,255,255,0.1),0px_0px_0px_4px_rgba(255,255,255,0.1)]" />
          </motion.button>
        </motion.div>

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

      <FloatingParticles />

      {showNotification && (
        <Notification
          id="error-notification"
          message="An error occurred while creating the room"
          type="error"
          onClose={() => setShowNotification(false)}
        />
      )}
    </div>

  );
};

export default Hero;