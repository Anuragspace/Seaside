import { useEffect, useRef, useState, useCallback } from "react";

interface ConnectionStats {
    bytesReceived: number;
    bytesSent: number;
    packetsLost: number;
    roundTripTime: number;
}

export function useWebRTC(
    roomId: string,
    userName: string,
    localVideoRef: React.RefObject<HTMLVideoElement>,
    remoteVideoRef: React.RefObject<HTMLVideoElement>,
    micActive: boolean,
    videoActive: boolean,
    isHost: boolean
) {
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
    const tracksAddedRef = useRef(false);
    const makingOfferRef = useRef(false);
    const ignoreOfferRef = useRef(false);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const onMessageRef = useRef<((msg: string) => void) | undefined>();
    const reconnectTimeoutRef = useRef<number | null>(null);
    const heartbeatIntervalRef = useRef<number | null>(null);
    const statsIntervalRef = useRef<number | null>(null);
    const initialSetupRef = useRef(false);
    
    const [dataChannelOpen, setDataChannelOpen] = useState(false);
    const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
    const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState>('new');
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null);

    // Host = impolite, Guest = polite
    const isPolite = !isHost;

    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Enhanced ICE servers with mobile-optimized configuration
    const iceServers = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ];

    // Buffer messages until WS is open
    const wsSendBuffer = useRef<any[]>([]);
    
    const safeWSSend = useCallback((data: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        } else {
            wsSendBuffer.current.push(data);
        }
    }, []);

    // Get initial media constraints (always request both audio and video)
    const getInitialConstraints = useCallback(() => {
        if (isMobile) {
            return {
                video: {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 15, max: 30 },
                    facingMode: "user"
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };
        } else {
            // Desktop constraints
            return {
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000
                }
            };
        }
    }, [isMobile]);

    // Fallback constraints for mobile devices
    const getFallbackConstraints = useCallback(() => {
        if (isMobile) {
            return {
                video: {
                    width: { ideal: 320, max: 640 },
                    height: { ideal: 240, max: 480 },
                    frameRate: { ideal: 15, max: 24 }
                },
                audio: true
            };
        }
        return {
            video: true,
            audio: true
        };
    }, [isMobile]);

    // Enhanced getUserMedia with mobile fallbacks
    const getUserMediaWithFallback = useCallback(async () => {
        try {
            console.log("[Media] Attempting to get user media with optimized constraints");
            const constraints = getInitialConstraints();
            console.log("[Media] Using constraints:", constraints);
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log("[Media] Successfully acquired media stream");
            return stream;
        } catch (error) {
            console.warn("[Media] Primary constraints failed, trying fallback:", error);
            
            try {
                const fallbackConstraints = getFallbackConstraints();
                console.log("[Media] Using fallback constraints:", fallbackConstraints);
                
                const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                console.log("[Media] Successfully acquired media stream with fallback");
                return stream;
            } catch (fallbackError) {
                console.error("[Media] Fallback also failed:", fallbackError);
                
                // Last resort: try basic constraints
                try {
                    console.log("[Media] Trying basic constraints as last resort");
                    const basicStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true
                    });
                    console.log("[Media] Successfully acquired media stream with basic constraints");
                    return basicStream;
                } catch (basicError) {
                    console.error("[Media] All getUserMedia attempts failed:", basicError);
                    throw basicError;
                }
            }
        }
    }, [getInitialConstraints, getFallbackConstraints]);

    // Enhanced data channel setup with proper error handling
    const setupDataChannel = useCallback((dc: RTCDataChannel) => {
        console.log("[DataChannel] Setting up data channel:", dc.label);
        
        dc.onopen = () => {
            console.log("[DataChannel] Opened successfully");
            setDataChannelOpen(true);
        };

        dc.onclose = () => {
            console.log("[DataChannel] Closed");
            setDataChannelOpen(false);
        };

        dc.onerror = (error) => {
            console.error("[DataChannel] Error:", error);
            setDataChannelOpen(false);
        };
        
        dc.onmessage = (event) => {
            console.log("[DataChannel] Message received:", event.data);
            if (typeof event.data === "string" && onMessageRef.current) {
                try {
                    onMessageRef.current(event.data);
                } catch (error) {
                    console.error("[DataChannel] Error processing message:", error);
                }
            }
        };

        // Monitor data channel state
        const checkState = () => {
            console.log("[DataChannel] State:", dc.readyState);
            if (dc.readyState === 'open') {
                setDataChannelOpen(true);
            } else {
                setDataChannelOpen(false);
            }
        };

        // Check state periodically until open
        const stateInterval = setInterval(() => {
            checkState();
            if (dc.readyState === 'open' || dc.readyState === 'closed') {
                clearInterval(stateInterval);
            }
        }, 100);

        return dc;
    }, []);

    // Enhanced peer connection creation with mobile optimizations
    const createPeer = useCallback(() => {
        if (peerRef.current) {
            console.log("[WebRTC] Peer connection already exists");
            return peerRef.current;
        }

        console.log("[WebRTC] Creating new peer connection");
        
        // Mobile-optimized peer connection configuration
        const pcConfig = {
            iceServers,
            iceCandidatePoolSize: isMobile ? 5 : 10,
            bundlePolicy: 'max-bundle' as RTCBundlePolicy,
            rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
            ...(isMobile && {
                iceTransportPolicy: 'all' as RTCIceTransportPolicy
            })
        };

        const pc = new RTCPeerConnection(pcConfig);

        // Enhanced connection state monitoring
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            setConnectionState(state);
            console.log("[WebRTC] Connection state:", state);

            if (state === 'failed' || state === 'disconnected') {
                handleConnectionFailure();
            } else if (state === 'connected') {
                setIsReconnecting(false);
                startStatsMonitoring();
                console.log("[WebRTC] Connection established successfully");
            }
        };

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            setIceConnectionState(state);
            console.log("[WebRTC] ICE connection state:", state);

            if (state === 'failed' || state === 'disconnected') {
                handleConnectionFailure();
            } else if (state === 'connected') {
                console.log("[WebRTC] ICE connection established");
            }
        };

        // Data channel setup - CRITICAL FIX
        if (isHost) {
            console.log("[WebRTC] Host creating data channel");
            // Create data channel AFTER peer connection is created but BEFORE adding tracks
            const dc = pc.createDataChannel("chat", {
                ordered: true,
                maxRetransmits: 3,
                maxPacketLifeTime: 3000
            });
            dataChannelRef.current = setupDataChannel(dc);
        } else {
            console.log("[WebRTC] Guest waiting for data channel");
            pc.ondatachannel = (event) => {
                console.log("[WebRTC] Guest received data channel");
                dataChannelRef.current = setupDataChannel(event.channel);
            };
        }

        // Enhanced negotiation handling with mobile considerations
        pc.onnegotiationneeded = async () => {
            try {
                console.log("[WebRTC] Negotiation needed");
                makingOfferRef.current = true;
                
                if (pc.signalingState === "stable") {
                    const offerOptions = {
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: true,
                        ...(isMobile && {
                            voiceActivityDetection: false
                        })
                    };
                    
                    const offer = await pc.createOffer(offerOptions);
                    await pc.setLocalDescription(offer);
                    console.log("[WebRTC] Sending offer");
                    safeWSSend({ offer });
                }
            } catch (error) {
                console.error("[WebRTC] Negotiation error:", error);
            } finally {
                makingOfferRef.current = false;
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("[WebRTC] Sending ICE candidate");
                safeWSSend({ iceCandidate: event.candidate });
            } else {
                console.log("[WebRTC] ICE gathering complete");
            }
        };

        pc.ontrack = (event) => {
            console.log("[WebRTC] Remote track received");
            const remoteStream = new MediaStream();
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
                
                // Mobile-specific: Ensure video plays
                if (isMobile) {
                    remoteVideoRef.current.play().catch(e => {
                        console.warn("[Video] Auto-play failed, user interaction required:", e);
                    });
                }
            }
        };

        peerRef.current = pc;
        return pc;
    }, [isHost, safeWSSend, remoteVideoRef, setupDataChannel, isMobile]);

    // Enhanced WebSocket connection with retry logic
    const connectWebSocket = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
        const wsBase = import.meta.env.PROD
            ? "wss://seaside-backend-pw1v.onrender.com"
            : `${wsProtocol}://${window.location.hostname}:8080`;

        const ws = new WebSocket(`${wsBase}/join-room?roomID=${roomId}`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("[WebSocket] Connected");
            setIsReconnecting(false);
            ws.send(JSON.stringify({ join: true, userName }));
            
            // Send buffered messages
            while (wsSendBuffer.current.length > 0) {
                ws.send(JSON.stringify(wsSendBuffer.current.shift()));
            }

            // Start heartbeat
            startHeartbeat();
        };

        ws.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);
                await handleSignalingMessage(message);
            } catch (error) {
                console.error("[WebSocket] Error parsing message:", error);
            }
        };

        ws.onclose = (event) => {
            console.log("[WebSocket] Disconnected:", event.code, event.reason);
            stopHeartbeat();
            
            // Attempt reconnection if not intentional
            if (event.code !== 1000 && !isReconnecting) {
                scheduleReconnection();
            }
        };

        ws.onerror = (error) => {
            console.error("[WebSocket] Error:", error);
        };
    }, [roomId, userName, isReconnecting]);

    // Enhanced signaling message handler
    const handleSignalingMessage = useCallback(async (message: any) => {
        const pc = peerRef.current;
        if (!pc) {
            console.warn("[WebRTC] No peer connection available for message:", message);
            return;
        }

        try {
            if (message.type === 'pong') {
                // Heartbeat response
                return;
            }

            if (message.offer) {
                console.log("[WebRTC] Received offer");
                const offerCollision = makingOfferRef.current || pc.signalingState !== "stable";
                ignoreOfferRef.current = !isPolite && offerCollision;
                
                if (ignoreOfferRef.current) {
                    console.log("[WebRTC] Ignoring offer due to collision (impolite peer)");
                    return;
                }

                if (offerCollision) {
                    console.log("[WebRTC] Offer collision, rolling back");
                    await pc.setLocalDescription({ type: "rollback" });
                }

                await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
                console.log("[WebRTC] Remote description set");
                
                // Process queued ICE candidates
                while (iceQueueRef.current.length > 0) {
                    const candidate = iceQueueRef.current.shift();
                    if (candidate) {
                        await pc.addIceCandidate(candidate);
                    }
                }

                if (pc.signalingState === "have-remote-offer") {
                    const answerOptions = isMobile ? {
                        voiceActivityDetection: false
                    } : {};
                    
                    const answer = await pc.createAnswer(answerOptions);
                    await pc.setLocalDescription(answer);
                    console.log("[WebRTC] Sending answer");
                    safeWSSend({ answer });
                }
            } else if (message.answer) {
                console.log("[WebRTC] Received answer");
                if (pc.signalingState === "have-local-offer") {
                    await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
                    console.log("[WebRTC] Answer processed");
                }
            } else if (message.iceCandidate) {
                console.log("[WebRTC] Received ICE candidate");
                if (pc.remoteDescription && pc.remoteDescription.type) {
                    await pc.addIceCandidate(new RTCIceCandidate(message.iceCandidate));
                } else {
                    console.log("[WebRTC] Queueing ICE candidate");
                    iceQueueRef.current.push(message.iceCandidate);
                }
            } else if (message.join && isPolite) {
                console.log("[WebRTC] Join message received, initiating call");
                // Only polite (guest) peer initiates
                await callUser();
            } else if (message.leave) {
                console.log("[WebRTC] Peer left");
                handlePeerDisconnection();
            }
        } catch (error) {
            console.error("[WebRTC] Error handling signaling message:", error);
        }
    }, [isPolite, safeWSSend, isMobile]);

    // Heartbeat mechanism to detect connection issues
    const startHeartbeat = useCallback(() => {
        stopHeartbeat();
        const heartbeatInterval = isMobile ? 45000 : 30000; // Longer interval for mobile
        heartbeatIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                safeWSSend({ type: 'ping' });
            }
        }, heartbeatInterval);
    }, [safeWSSend, isMobile]);

    const stopHeartbeat = useCallback(() => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
    }, []);

    // Reconnection logic with exponential backoff
    const scheduleReconnection = useCallback(() => {
        if (isReconnecting) return;
        
        setIsReconnecting(true);
        const baseDelay = isMobile ? 2000 : 1000;
        const delay = Math.min(baseDelay * Math.pow(2, Math.random()), 10000);
        
        reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[WebSocket] Attempting reconnection...");
            connectWebSocket();
        }, delay);
    }, [connectWebSocket, isReconnecting, isMobile]);

    // Connection failure handler with restart capability
    const handleConnectionFailure = useCallback(async () => {
        console.log("[WebRTC] Connection failure detected, attempting restart");
        setIsReconnecting(true);
        setDataChannelOpen(false);

        // Close existing connection
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }

        // Reset state
        tracksAddedRef.current = false;
        iceQueueRef.current = [];
        dataChannelRef.current = null;

        // Restart connection after delay (longer for mobile)
        const restartDelay = isMobile ? 3000 : 2000;
        setTimeout(async () => {
            try {
                const newPeer = createPeer();
                await addTracksIfNeeded(newPeer);
                if (isPolite) {
                    await callUser();
                }
            } catch (error) {
                console.error("[WebRTC] Restart failed:", error);
            }
        }, restartDelay);
    }, [createPeer, isPolite, isMobile]);

    // Peer disconnection handler
    const handlePeerDisconnection = useCallback(() => {
        console.log("[WebRTC] Peer disconnected");
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        setDataChannelOpen(false);
    }, [remoteVideoRef]);

    // Enhanced track management
    const addTracksIfNeeded = useCallback(async (peer: RTCPeerConnection) => {
        if (!tracksAddedRef.current && localStreamRef.current) {
            console.log("[WebRTC] Adding local tracks");
            localStreamRef.current.getTracks().forEach((track) => {
                peer.addTrack(track, localStreamRef.current!);
            });
            tracksAddedRef.current = true;
            console.log("[WebRTC] Local tracks added successfully");
        }
    }, []);

    // Call initiation
    const callUser = useCallback(async () => {
        console.log("[WebRTC] Initiating call");
        const peer = createPeer();
        await addTracksIfNeeded(peer);
    }, [createPeer, addTracksIfNeeded]);

    // Connection statistics monitoring
    const startStatsMonitoring = useCallback(() => {
        if (statsIntervalRef.current) return;

        const statsInterval = isMobile ? 10000 : 5000; // Less frequent on mobile
        statsIntervalRef.current = setInterval(async () => {
            const pc = peerRef.current;
            if (!pc) return;

            try {
                const stats = await pc.getStats();
                let bytesReceived = 0;
                let bytesSent = 0;
                let packetsLost = 0;
                let roundTripTime = 0;

                stats.forEach((report) => {
                    if (report.type === 'inbound-rtp') {
                        bytesReceived += report.bytesReceived || 0;
                        packetsLost += report.packetsLost || 0;
                    } else if (report.type === 'outbound-rtp') {
                        bytesSent += report.bytesSent || 0;
                    } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                        roundTripTime = report.currentRoundTripTime || 0;
                    }
                });

                setConnectionStats({
                    bytesReceived,
                    bytesSent,
                    packetsLost,
                    roundTripTime
                });
            } catch (error) {
                console.error("[Stats] Error getting connection stats:", error);
            }
        }, statsInterval);
    }, [isMobile]);

    const stopStatsMonitoring = useCallback(() => {
        if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
            statsIntervalRef.current = null;
        }
    }, []);

    // MAIN EFFECT - Only runs once for initial setup
    useEffect(() => {
        if (!roomId || !userName || initialSetupRef.current) return;

        let localStream: MediaStream;

        async function start() {
            try {
                console.log("[Setup] Starting WebRTC setup for", isMobile ? "mobile" : "desktop");
                
                // Get local media with mobile-optimized constraints and fallbacks
                localStream = await getUserMediaWithFallback();

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream;
                    
                    // Mobile-specific: Ensure local video plays
                    if (isMobile) {
                        localVideoRef.current.muted = true; // Ensure muted for autoplay
                        localVideoRef.current.play().catch(e => {
                            console.warn("[Video] Local video auto-play failed:", e);
                        });
                    }
                }
                localStreamRef.current = localStream;
                console.log("[Setup] Local media acquired successfully");

                // Create peer connection first
                const peer = createPeer();
                
                // Add tracks to peer connection
                await addTracksIfNeeded(peer);
                
                // Connect WebSocket after peer is ready (with delay for mobile)
                if (isMobile) {
                    setTimeout(() => connectWebSocket(), 500);
                } else {
                    connectWebSocket();
                }

                initialSetupRef.current = true;

            } catch (error) {
                console.error("[Setup] Error:", error);
                
                // More specific error messages for mobile
                let errorMessage = 'Unable to access camera/microphone. ';
                if (isMobile) {
                    errorMessage += 'Please ensure:\n' +
                        '• Camera/microphone permissions are granted\n' +
                        '• No other apps are using the camera\n' +
                        '• You\'re using HTTPS or localhost\n' +
                        '• Try refreshing the page';
                } else {
                    errorMessage += 'Please check permissions and try again.';
                }
                
                alert(errorMessage);
            }
        }

        start();

        return () => {
            console.log("[Cleanup] Cleaning up WebRTC resources");
            
            // Cleanup
            stopHeartbeat();
            stopStatsMonitoring();
            
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }

            wsRef.current?.close();
            peerRef.current?.close();
            localStreamRef.current?.getTracks().forEach((track) => track.stop());

            // Reset refs
            peerRef.current = null;
            wsRef.current = null;
            localStreamRef.current = null;
            dataChannelRef.current = null;
            tracksAddedRef.current = false;
            iceQueueRef.current = [];
            makingOfferRef.current = false;
            ignoreOfferRef.current = false;
            wsSendBuffer.current = [];
            initialSetupRef.current = false;
            
            // Reset state
            setDataChannelOpen(false);
            setConnectionState('new');
            setIceConnectionState('new');
            setIsReconnecting(false);
        };
    }, [roomId, userName]); // Removed micActive and videoActive from dependencies

    // SEPARATE EFFECT - Only handles track enable/disable without reconnecting
    useEffect(() => {
        if (!localStreamRef.current) return;

        console.log("[Track Control] Updating track states - mic:", micActive, "video:", videoActive);

        // Update audio tracks
        localStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = micActive;
            console.log("[Track Control] Audio track enabled:", track.enabled);
        });

        // Update video tracks
        localStreamRef.current.getVideoTracks().forEach(track => {
            track.enabled = videoActive;
            console.log("[Track Control] Video track enabled:", track.enabled);
        });

        // Mobile-specific: Handle video element visibility
        if (isMobile && localVideoRef.current) {
            if (videoActive) {
                localVideoRef.current.style.display = 'block';
            } else {
                localVideoRef.current.style.display = 'none';
            }
        }
    }, [micActive, videoActive, isMobile, localVideoRef]);

    // Send chat message with enhanced error handling
    const sendMessage = useCallback((msg: string) => {
        const dc = dataChannelRef.current;
        console.log("[DataChannel] Attempting to send message:", msg);
        console.log("[DataChannel] Channel state:", dc?.readyState);
        
        if (dc && dc.readyState === "open") {
            try {
                dc.send(msg);
                console.log("[DataChannel] Message sent successfully");
            } catch (error) {
                console.error("[DataChannel] Error sending message:", error);
            }
        } else {
            console.warn("[DataChannel] Cannot send message - channel not open. State:", dc?.readyState);
        }
    }, []);

    // Message handler subscription
    const onMessage = useCallback((cb?: (msg: string) => void) => {
        onMessageRef.current = cb;
    }, []);

    // Manual reconnection trigger
    const reconnect = useCallback(() => {
        if (!isReconnecting) {
            handleConnectionFailure();
        }
    }, [handleConnectionFailure, isReconnecting]);

    return {
        sendMessage,
        onMessage,
        dataChannelOpen,
        connectionState,
        iceConnectionState,
        isReconnecting,
        connectionStats,
        reconnect
    };
}