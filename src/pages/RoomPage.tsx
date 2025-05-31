import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, Video, VideoOff, Phone, Users, MessageSquare, Share2 } from 'lucide-react';
import Layout from '../components/Layout';

const RoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [participants, setParticipants] = useState([
    { id: '1', name: 'You', isLocal: true },
    { id: '2', name: 'User 2', isLocal: false },
  ]);

  useEffect(() => {
    // Validate room ID format (simulated)
    if (!roomId || roomId.length !== 6) {
      navigate('/');
    }
    
    document.title = `SeaSide | Room ${roomId}`;
    
    // Cleanup on unmount
    return () => {
      document.title = 'SeaSide';
    };
  }, [roomId, navigate]);

  return (
    <Layout hideCreateJoin>
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
          {participants.map(participant => (
            <div 
              key={participant.id}
              className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                {videoActive || !participant.isLocal ? (
                  <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                    <div className="h-24 w-24 rounded-full bg-indigo-500 flex items-center justify-center text-3xl font-bold">
                      {participant.name.charAt(0)}
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="h-24 w-24 mx-auto rounded-full bg-indigo-500 flex items-center justify-center text-3xl font-bold">
                      {participant.name.charAt(0)}
                    </div>
                    <p className="mt-2 text-gray-300">Camera is off</p>
                  </div>
                )}
              </div>
              
              <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded-lg text-sm">
                {participant.name} {participant.isLocal && "(You)"}
              </div>
              
              {!participant.isLocal && (
                <div className="absolute top-4 right-4 flex space-x-2">
                  {!micActive && <MicOff size={16} className="text-red-500" />}
                </div>
              )}
            </div>
          ))}
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
      </div>
    </Layout>
  );
};

export default RoomPage;