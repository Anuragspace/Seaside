import React, { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, Video, VideoOff, Phone, Users, MessageSquare, Share2, Settings } from 'lucide-react';
import Layout from '../components/Layout';
import { useWebRTC } from '../hooks/useWebRTC';
import { useChat } from '../hooks/useChat';
import ChatBox from '../components/ChatBox';
import ConnectionStatus from '../components/ConnectionStatus';
import { setupAudio, startRecording, stopRecording, cleanupAudioRecording } from '../hooks/audioRecord';
import { setupVideo, startVideoRecording, stopVideoRecording, cleanupVideoRecording } from '../hooks/videoRecord';
import { useRecordingAuth } from '../hooks/useAuthMiddleware';
import { AuthRequestModal } from '../components/modals/AuthRequestModal';
import { useAuth } from '../contexts/AuthContext';
import { getUserDisplayName } from '../utils/guestUtils';
import light from '../assets/light.webp';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const RoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const query = useQuery();
  const { user, isAuthenticated } = useAuth();
  
  // Determine username: authenticated user's name, URL param, or generated guest name
  const userName = getUserDisplayName(user, query.get('user') || undefined);

  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Determine if user is host (first to create room)
  const isHost = userName === 'You';

  // Detect mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Authentication middleware for recording features
  const recordingAuth = useRecordingAuth();

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

  // Enhanced chat hook for WebSocket-based chat
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
    userName
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

    // Mobile-specific: Prevent zoom on double tap
    if (isMobile) {
      document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });

      let lastTouchEnd = 0;
      document.addEventListener('touchend', (e) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      }, false);
    }

    return () => {
      document.title = 'SeaSide';
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomId, navigate, isMobile]);
  

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

  // Handle keyboard shortcuts (disabled on mobile for better UX)
  useEffect(() => {
    if (isMobile) return; // Disable keyboard shortcuts on mobile

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
  }, [micActive, videoActive, isFullscreen, isMobile]);

  // Mobile-specific: Handle orientation change
  useEffect(() => {
    if (!isMobile) return;

    const handleOrientationChange = () => {
      // Force layout recalculation after orientation change
      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.style.height = 'auto';
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.style.height = 'auto';
        }
      }, 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, [isMobile]);

  // Send chat message via WebSocket
  const handleSend = (msg: string) => {
    if (chatConnected) {
      sendChatMessage(msg);
    } else {
      console.warn("[Chat] WebSocket not connected, cannot send message");
    }
  };

  // Remove the old WebRTC message handling since we're using WebSocket chat now
  // useEffect(() => {
  //   if (!onMessage) return;
  //   const handler = (msg: string) => {
  //     // The useChat hook will manage the messages state
  //   };
  //   onMessage(handler);
  //   return () => onMessage(undefined);
  // }, [onMessage]);

  // Copy room ID to clipboard
  const copyRoomId = async () => {
    if (roomId) {
      try {
        await navigator.clipboard.writeText(roomId);
        // You could add a toast notification here
      } catch (err) {
        // Fallback for mobile browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = roomId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    }
  };

  // Leave room with confirmation
  const leaveRoom = () => {
    if (window.confirm('Are you sure you want to leave the room?')) {
      navigate('/');
    }
  };

  // Mobile-optimized video click handler
  const handleVideoClick = (videoRef: React.RefObject<HTMLVideoElement>) => {
    if (isMobile && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(e => {
          console.warn("[Video] Play failed:", e);
        });
      }
    }
  };

  return (
    <Layout showNavbar={false}>
      <div
      className="fixed inset-0 w-full h-full z-0"
      style={{
        backgroundImage: `url(${light})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center bottom',
        backgroundSize: '1000px 950px',
        opacity: 1 // Added opacity to make it subtle
      }}
      
    />
    
      
      <div className={`w-full h-screen bg-black/60  text-white flex flex-col relative ${isMobile ? 'touch-manipulation' : ''}z-10`}>
        {/* Header */}
        <div className={`p-4 flex items-center bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm relative z-30 ${isMobile ? 'p-2' : ''}`}>
          <button
            onClick={leaveRoom}
            className={`mr-4 rounded-full p-2 bg-gray-800/50 hover:bg-gray-700/60 transition-colors ${isMobile ? 'p-3 mr-2' : ''}`}
            title="Leave room"
          >
            <ArrowLeft size={isMobile ? 24 : 20} />
          </button>
          
          <div className="flex-1">
            <h2 className={`font-medium ${isMobile ? 'text-lg' : 'text-xl'}`}>Room: {roomId}</h2>
            <p className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {isHost ? 'Host' : 'Guest'} • {userName}
            </p>
          </div>
          
          <div className={`flex items-center ${isMobile ? 'space-x-1' : 'space-x-2'}`}>
            {!isMobile && (
              <button 
                onClick={() => setShowStats(!showStats)}
                className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/60 transition-colors"
                title="Toggle stats"
              >
                <Settings size={20} />
              </button>
            )}
            <button 
              onClick={copyRoomId}
              className={`rounded-full bg-gray-800/50 hover:bg-gray-700/60 transition-colors ${isMobile ? 'p-3' : 'p-2'}`}
              title="Copy room ID"
            >
              <Share2 size={isMobile ? 24 : 20} />
            </button>
            {!isMobile && (
              <>
                <button className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/60 transition-colors">
                  <Users size={20} />
                </button>
                <button className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/60 transition-colors">
                  <MessageSquare size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Connection Status */}
        {showStats && !isMobile && (
          <ConnectionStatus
            connectionState={connectionState}
            iceConnectionState={iceConnectionState}
            isReconnecting={isReconnecting}
            dataChannelOpen={dataChannelOpen}
            onReconnect={reconnect}
            connectionStats={connectionStats}
          />
        )}

        {/* Video Grid */}
        <div className={`flex-1 grid gap-4 p-4 relative ${isMobile ? 'grid-cols-1 gap-2 p-2' : 'grid-cols-1 md:grid-cols-2'}`}>
          {/* Local Video */}
          <div 
            className={`relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center group ${isMobile ? 'aspect-video' : 'aspect-video'}`}
            onClick={() => handleVideoClick(localVideoRef)}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ 
                transform: isMobile ? 'scaleX(-1)' : 'none' // Mirror local video on mobile
              }}
            />
            <div className={`absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded-lg backdrop-blur-sm ${isMobile ? 'text-xs' : 'text-sm'}`}>
              You ({userName})
            </div>
            {!videoActive && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <VideoOff size={isMobile ? 64 : 48} className="text-gray-400" />
              </div>
            )}
            {!micActive && (
              <div className={`absolute top-4 left-4 bg-red-500/80 rounded-full ${isMobile ? 'p-3' : 'p-2'}`}>
                <MicOff size={isMobile ? 20 : 16} />
              </div>
            )}
          </div>

          {/* Remote Video */}
          <div 
            className={`relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center group ${isMobile ? 'aspect-video' : 'aspect-video'}`}
            onClick={() => handleVideoClick(remoteVideoRef)}
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className={`absolute bottom-4 left-4 px-3 py-1 bg-black/60 rounded-lg backdrop-blur-sm ${isMobile ? 'text-xs' : 'text-sm'}`}>
              Remote
            </div>
            {connectionState !== 'connected' && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <div className="text-center">
                  <Users size={isMobile ? 64 : 48} className="text-gray-400 mx-auto mb-2" />
                  <p className={`text-gray-400 ${isMobile ? 'text-sm' : ''}`}>
                    {isReconnecting ? 'Reconnecting...' : 'Waiting for peer...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className={`flex justify-center items-center bg-gradient-to-t from-black/80 to-transparent backdrop-blur-sm ${isMobile ? 'p-4 space-x-6' : 'p-6 space-x-4'}`}>
          <button
            onClick={() => setMicActive(!micActive)}
            className={`rounded-full transition-all duration-200 ${isMobile ? 'p-5' : 'p-4'} ${
              micActive 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={`${micActive ? 'Mute' : 'Unmute'} microphone${!isMobile ? ' (M)' : ''}`}
          >
            {micActive ? <Mic size={isMobile ? 28 : 24} /> : <MicOff size={isMobile ? 28 : 24} />}
          </button>

          <button
            onClick={() => setVideoActive(!videoActive)}
            className={`rounded-full transition-all duration-200 ${isMobile ? 'p-5' : 'p-4'} ${
              videoActive 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={`${videoActive ? 'Turn off' : 'Turn on'} camera${!isMobile ? ' (V)' : ''}`}
          >
            {videoActive ? <Video size={isMobile ? 28 : 24} /> : <VideoOff size={isMobile ? 28 : 24} />}
          </button>

          <button 
            onClick={leaveRoom}
            className={`rounded-full bg-red-600 hover:bg-red-700 transition-colors text-white ${isMobile ? 'p-5' : 'p-4'}`}
            title="Leave room"
          >
            <Phone size={isMobile ? 28 : 24} />
          </button>

          {!isMobile && (
            <button
              onClick={toggleFullscreen}
              className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors text-white"
              title="Toggle fullscreen (F)"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3H5C3.89543 3 3 3.89543 3 5V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 8V5C21 3.89543 20.1046 3 19 3H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 21H19C20.1046 21 21 20.1046 21 19V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 16V19C3 20.1046 3.89543 21 5 21H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Recording Controls - Hidden on mobile for better UX */}
        {!isMobile && (
          <div className="absolute bottom-24 left-4 flex flex-col space-y-2">
            <RecordingAudioButton recordingAuth={recordingAuth} />
            <RecordingVideoButton recordingAuth={recordingAuth} />
          </div>
        )}

        {/* Authentication Modal for Recording */}
        <AuthRequestModal
          isOpen={recordingAuth.isAuthModalOpen}
          onClose={recordingAuth.closeAuthModal}
          feature={recordingAuth.authRequiredFeature}
          redirectAfterAuth={recordingAuth.redirectAfterAuth}
        />

        {/* Chat */}
        <ChatBox 
          onSend={handleSend} 
          onTyping={handleTyping}
          messages={messages} 
          isTyping={isTyping}
          chatStats={chatStats}
          isConnected={chatConnected}
          dataChannelOpen={dataChannelOpen} 
        />

        {/* Keyboard Shortcuts Help - Desktop only */}
        {!isMobile && (
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 text-center">
            Press M to toggle mic • V for video • F for fullscreen
          </div>
        )}

        {/* Mobile connection indicator */}
        {isMobile && (
          <div className="absolute top-20 right-4 z-40">
            <div className={`w-3 h-3 rounded-full ${
              connectionState === 'connected' ? 'bg-green-400' : 
              isReconnecting ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
            }`} />
          </div>
        )}
      </div>
    </Layout>
  );
};

interface RecordingAudioButtonProps {
  recordingAuth: any; // UseAuthMiddlewareReturn type
}

const RecordingAudioButton: React.FC<RecordingAudioButtonProps> = ({ recordingAuth }) => {
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    setupAudio();

    // Listen for session expiration during recording
    const handleSessionExpired = (event: CustomEvent) => {
      console.warn('Session expired during audio recording');
      setRecording(false);
      setCountdown(null);
      // Show auth modal to re-authenticate
      recordingAuth.requestAuth();
    };

    const handleAuthRequired = (event: CustomEvent) => {
      console.warn('Authentication required for audio recording');
      recordingAuth.requestAuth();
    };

    window.addEventListener('recording-session-expired', handleSessionExpired as EventListener);
    window.addEventListener('recording-auth-required', handleAuthRequired as EventListener);

    return () => {
      cleanupAudioRecording();
      window.removeEventListener('recording-session-expired', handleSessionExpired as EventListener);
      window.removeEventListener('recording-auth-required', handleAuthRequired as EventListener);
    };
  }, [recordingAuth]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
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
    // Check authentication before starting recording
    if (!recordingAuth.canAccess) {
      recordingAuth.requestAuth();
      return;
    }
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

interface RecordingVideoButtonProps {
  recordingAuth: any; // UseAuthMiddlewareReturn type
}

const RecordingVideoButton: React.FC<RecordingVideoButtonProps> = ({ recordingAuth }) => {
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [countdownVideo, setCountdownVideo] = useState<number | null>(null);
  const [timer, setTimer] = useState('00:00');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    setupVideo();

    // Listen for session expiration during video recording
    const handleSessionExpired = (event: CustomEvent) => {
      console.warn('Session expired during video recording');
      setRecordingVideo(false);
      setCountdownVideo(null);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimer('00:00');
      // Show auth modal to re-authenticate
      recordingAuth.requestAuth();
    };

    const handleAuthRequired = (event: CustomEvent) => {
      console.warn('Authentication required for video recording');
      recordingAuth.requestAuth();
    };

    window.addEventListener('recording-session-expired', handleSessionExpired as EventListener);
    window.addEventListener('recording-auth-required', handleAuthRequired as EventListener);

    return () => {
      cleanupVideoRecording();
      window.removeEventListener('recording-session-expired', handleSessionExpired as EventListener);
      window.removeEventListener('recording-auth-required', handleAuthRequired as EventListener);
    };
  }, [recordingAuth]);

  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
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
    // Check authentication before starting recording
    if (!recordingAuth.canAccess) {
      recordingAuth.requestAuth();
      return;
    }
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