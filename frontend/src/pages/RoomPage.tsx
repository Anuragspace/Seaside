import React, { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, Video, VideoOff, Phone, Users, MessageSquare, Share2, Settings } from 'lucide-react';
import Layout from '../components/Layout';
import { useWebRTC } from '../hooks/useWebRTC';
import { useChat } from '../hooks/useChat';
import ChatBox from '../components/ChatBox';
import ConnectionStatus from '../components/ConnectionStatus';
import { setupAudio, startRecording, stopRecording } from '../hooks/audioRecord';
import { setupVideo, startVideoRecording, stopVideoRecording } from '../hooks/videoRecord';

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
  const [showStats, setShowStats] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Determine if user is host (first to create room)
  const isHost = userName === 'You';

  // WebRTC hook for video/audio
  const { 
    sendMessage: sendWebRTCMessage, 
    onMessage, 
    dataChannelOpen,
    connectionState,
    iceConnectionState,
    isReconnecting,
    connectionStats,
    reconnect
  } = useWebRTC(
    roomId!,
    userName,
    localVideoRef,
    remoteVideoRef,
    micActive,
    videoActive,
    isHost
  );

  // Enhanced chat hook
  const {
    messages,
    isTyping,
    chatStats,
    isConnected: chatConnected,
    sendMessage: sendChatMessage,
    handleTyping,
    clearMessages,
    connectChat,
  } = useChat(
    roomId!,
    userName,
    dataChannelOpen,
    sendWebRTCMessage
  );

  useEffect(() => {
    if (!roomId || roomId.length < 6) {
      navigate('/');
    }

    document.title = `SeaSide | Room ${roomId}`;

    // Prevent page refresh/close without warning
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.title = 'SeaSide';
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomId, navigate]);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.key.toLowerCase()) {
        case 'm':
          setMicActive(!micActive);
          break;
        case 'v':
          setVideoActive(!videoActive);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'c':
          setShowChat(!showChat);
          break;
        case 'escape':
          if (isFullscreen) {
            document.exitFullscreen();
            setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [micActive, videoActive, isFullscreen, showChat]);

  // Enhanced chat send handler
  const handleSendChat = (msg: string) => {
    sendChatMessage(msg);
  };

  // Copy room ID to clipboard
  const copyRoomId = async () => {
    if (roomId) {
      await navigator.clipboard.writeText(roomId);
      // You could add a toast notification here
    }
  };

  // Leave room with confirmation
  const leaveRoom = () => {
    if (window.confirm('Are you sure you want to leave the room?')) {
      navigate('/');
    }
  };

  return (
    <Layout showNavbar={false}>
      <div className="w-full h-screen bg-black text-white flex flex-col relative">
        {/* Header */}
        <div className="p-4 flex items-center bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm relative z-30">
          <button
            onClick={leaveRoom}
            className="mr-4 rounded-full p-2 bg-gray-800/50 hover:bg-gray-700/60 transition-colors"
            title="Leave room"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex-1">
            <h2 className="text-xl font-medium">Room: {roomId}</h2>
            <p className="text-sm text-gray-400">
              {isHost ? 'Host' : 'Guest'} • {userName}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowStats(!showStats)}
              className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/60 transition-colors"
              title="Toggle stats"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={copyRoomId}
              className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/60 transition-colors"
              title="Copy room ID"
            >
              <Share2 size={20} />
            </button>
            <button className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/60 transition-colors">
              <Users size={20} />
            </button>
            <button 
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-full transition-colors ${
                showChat 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-800/50 hover:bg-gray-700/60'
              }`}
              title="Toggle chat (C)"
            >
              <MessageSquare size={20} />
            </button>
          </div>
        </div>

        {/* Connection Status */}
        {showStats && (
          <ConnectionStatus
            connectionState={connectionState}
            iceConnectionState={iceConnectionState}
            isReconnecting={isReconnecting}
            connectionStats={connectionStats}
            reconnect={reconnect}
          />
        )}

        {/* Video Container */}
        <div className="flex-1 flex flex-row items-center justify-center bg-black relative gap-x-4">
          {/* Remote Video */}
          <div className="flex-1 flex items-center justify-center">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!remoteVideoRef.current?.srcObject && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center">
                  <div className="text-6xl mb-4">👋</div>
                  <h3 className="text-xl font-medium mb-2">Waiting for others to join...</h3>
                  <p className="text-gray-400">Share the room ID with someone to start chatting</p>
                </div>
              </div>
            )}
          </div>

          {/* Local Video */}
          <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600 relative flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs">
              You
            </div>
          </div>
        </div>

        {/* Controls Overlay */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 bg-black/50 backdrop-blur-sm rounded-full px-6 py-3">
          <button
            onClick={() => setMicActive(!micActive)}
            className={`p-3 rounded-full transition-colors ${
              micActive ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'
            }`}
            title={`${micActive ? 'Mute' : 'Unmute'} microphone (M)`}
          >
            {micActive ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <button
            onClick={() => setVideoActive(!videoActive)}
            className={`p-3 rounded-full transition-colors ${
              videoActive ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'
            }`}
            title={`${videoActive ? 'Turn off' : 'Turn on'} camera (V)`}
          >
            {videoActive ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button
            onClick={leaveRoom}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
            title="Leave room"
          >
            <Phone size={20} className="rotate-90" />
          </button>
        </div>

        {/* Enhanced Chat Box */}
        {showChat && (
          <ChatBox
            onSend={handleSendChat}
            onTyping={handleTyping}
            messages={messages}
            isTyping={isTyping}
            chatStats={chatStats}
            isConnected={chatConnected}
            dataChannelOpen={dataChannelOpen}
          />
        )}

        {/* Recording Controls */}
        <div className="absolute top-20 right-4 flex flex-col space-y-2">
          <RecordingAudioButton />
          <RecordingVideoButton />
        </div>
      </div>
    </Layout>
  );
};

const RecordingAudioButton: React.FC = () => {
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    setupAudio();
  }, []);

  useEffect(() => {
    let timer: number;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      setCountdown(null);
      setRecording(true);
      startRecording();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  const handleStartRecording = () => {
    setCountdown(3);
  };

  const handleStopRecording = () => {
    setRecording(false);
    stopRecording();
    setTimeout(() => {
      const playback = document.querySelector('.playback') as HTMLAudioElement | null;
      if (playback && playback.src) {
        const a = document.createElement('a');
        a.href = playback.src;
        a.download = 'recording.wav';
        a.click();
      }
    }, 500);
  };

  return (
    <div className="flex space-x-3">
      {!recording && countdown === null && (
        <button
          onClick={handleStartRecording}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-sm backdrop-blur-sm"
        >
          Record Audio
        </button>
      )}
      {countdown !== null && (
        <button
          disabled
          className="px-4 py-2 rounded bg-gray-500 text-sm cursor-not-allowed backdrop-blur-sm"
        >
          Starting in {countdown}...
        </button>
      )}
      {recording && (
        <button
          onClick={handleStopRecording}
          className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-sm backdrop-blur-sm"
        >
          Stop Recording Audio
        </button>
      )}
    </div>
  );
};

const RecordingVideoButton: React.FC = () => {
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [countdownVideo, setCountdownVideo] = useState<number | null>(null);
  const [timer, setTimer] = useState('00:00');
  const timerRef = useRef<number | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    setupVideo();
  }, []);

  useEffect(() => {
    let interval: number;
    if (countdownVideo !== null && countdownVideo > 0) {
      interval = setTimeout(() => setCountdownVideo(countdownVideo - 1), 1000);
    } else if (countdownVideo === 0) {
      setCountdownVideo(null);
      setRecordingVideo(true);
      secondsRef.current = 0;
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        const min = String(Math.floor(secondsRef.current / 60)).padStart(2, '0');
        const sec = String(secondsRef.current % 60).padStart(2, '0');
        setTimer(`${min}:${sec}`);
      }, 1000);
      startVideoRecording();
    }
    return () => {
      if (interval) clearTimeout(interval);
    };
  }, [countdownVideo]);

  const handleStartRecordingVideo = () => {
    setCountdownVideo(3);
  };

  const handleStopRecordingVideo = () => {
    setRecordingVideo(false);
    stopVideoRecording();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimer('00:00');
  };

  return (
    <div className="flex space-x-3 items-center">
      {!recordingVideo && countdownVideo === null && (
        <button
          onClick={handleStartRecordingVideo}
          className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-sm backdrop-blur-sm"
        >
          Record Video
        </button>
      )}
      {countdownVideo !== null && (
        <button
          disabled
          className="px-4 py-2 rounded bg-gray-500 text-sm cursor-not-allowed backdrop-blur-sm"
        >
          Starting in {countdownVideo}...
        </button>
      )}
      {recordingVideo && (
        <>
          <button
            onClick={handleStopRecordingVideo}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-sm backdrop-blur-sm"
          >
            Stop Recording Video
          </button>
          <div className="video-timer text-white text-sm bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
            {timer}
          </div>
        </>
      )}
    </div>
  );
};

export default RoomPage;