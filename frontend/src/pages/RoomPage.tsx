import React, { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, Video, VideoOff, Phone, Users, MessageSquare, Share2 } from 'lucide-react';
import Layout from '../components/Layout';
import { useWebRTC } from '../hooks/useWebRTC'; // Import the hook
import ChatBox from '../components/ChatBox'; // Adjust path as needed

// --- Helper for getting query params ---
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const RoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const query = useQuery();
  const userName = query.get('user') || 'You';

  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [messages, setMessages] = useState<{ text: string; fromMe: boolean; id: number }[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // For now, assume the first user is the host if their name is 'You'
  const isHost = userName === 'You';

  const { sendMessage, onMessage, dataChannelOpen } = useWebRTC(
    roomId!,
    userName,
    localVideoRef,
    remoteVideoRef,
    micActive,
    videoActive,
    isHost
  );

  useEffect(() => {
    if (!roomId || roomId.length < 6) {
      navigate('/');
    }

    document.title = `SeaSide | Room ${roomId}`;

    return () => {
      document.title = 'SeaSide';
    };
  }, [roomId, navigate]);

  // Send chat to peer
  const handleSend = (msg: string) => {
    sendMessage(msg); // Send to peer
    setMessages((prev) => [
      ...prev,
      { text: msg, fromMe: true, id: Date.now() },
    ]);
  };

  // Listen for incoming messages from peer
  useEffect(() => {
    if (!onMessage) return;
    const handler = (msg: string) => {
      setMessages((prev) => [
        ...prev,
        { text: msg, fromMe: false, id: Date.now() },
      ]);
    };
    onMessage(handler);
    return () => onMessage(undefined);
  }, [onMessage]);

  return (
    <Layout showNavbar={false}>
      <div className="w-full h-screen bg-black text-white flex flex-col">
        <div className="p-4 flex items-center">
          <button
            onClick={() => navigate('/')}
            className="mr-4 rounded-full p-2 bg-gray-800/50 hover:bg-gray-700/60 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-medium flex-1">Room: {roomId}</h2>
          <div className="flex items-center space-x-2">
            <button className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/60">
              <Users size={20} />
            </button>
            <button className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/60">
              <MessageSquare size={20} />
            </button>
            <button className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/60">
              <Share2 size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded-lg text-sm">
              You ({userName})
            </div>
          </div>
          <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded-lg text-sm">
              Remote
            </div>
          </div>
        </div>

        <div className="p-6 flex justify-center items-center space-x-4">
          <button
            onClick={() => setMicActive(!micActive)}
            className={`p-4 rounded-full ${micActive ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'} transition-colors`}
          >
            {micActive ? <Mic size={24} /> : <MicOff size={24} />}
          </button>

          <button
            onClick={() => setVideoActive(!videoActive)}
            className={`p-4 rounded-full ${videoActive ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'} transition-colors`}
          >
            {videoActive ? <Video size={24} /> : <VideoOff size={24} />}
          </button>

          <button className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors" onClick={() => navigate('/')}>
            <Phone size={24} />
          </button>
        </div>

        <ChatBox onSend={handleSend} messages={messages} dataChannelOpen={dataChannelOpen} />
      </div>
    </Layout>
  );
};

export default RoomPage;