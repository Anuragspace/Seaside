import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SiRender } from "react-icons/si";
import { X } from "lucide-react";

const Notification: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 12 }}
          className="fixed bottom-6 left-1/6 sm:left-[32%] z-50 w-[96vw] max-w-xs sm:max-w-md md:max-w-md lg:max-w-lg px-3 py-2 sm:px-4 sm:py-2 rounded-full flex items-center gap-2 sm:gap-4 shadow-2xl"
          style={{
            transform: "translateX(-50%)",
            background: "rgba(30, 41, 59, 0.90)",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500">
            <SiRender className="w-4 h-4 text-white" />
          </span>
          <span className="text-gray-400 text-xs sm:text-base flex-1 text-center break-words whitespace-normal">
            If Room ID is not generated, please run:&nbsp;
            <a
              href="https://seaside-backend-pw1v.onrender.com/"
              className="font-semibold text-pink-400 hover:text-yellow-500 transition"
              target="_blank"
              rel="noopener noreferrer"
            >
              Render App
            </a>
          </span>
          <button
            onClick={() => setShow(false)}
            className="p-1 rounded-full hover:bg-gray-700/60 transition-colors"
            aria-label="Close notification"
          >
            <X size={18} className="text-gray-300 hover:text-white transition" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Notification;