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
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
    
    const [dataChannelOpen, setDataChannelOpen] = useState(false);
    const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
    const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState>('new');
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null);

    // Host = impolite, Guest = polite
    const isPolite = !isHost;

    // Enhanced ICE servers with multiple STUN/TURN servers
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

    // Enhanced peer connection creation
    const createPeer = useCallback(() => {
        if (peerRef.current) {
            console.log("[WebRTC] Peer connection already exists");
            return peerRef.current;
        }

        console.log("[WebRTC] Creating new peer connection");
        const pc = new RTCPeerConnection({
            iceServers,
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        });

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

        // Enhanced negotiation handling
        pc.onnegotiationneeded = async () => {
            try {
                console.log("[WebRTC] Negotiation needed");
                makingOfferRef.current = true;
                
                if (pc.signalingState === "stable") {
                    const offer = await pc.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: true
                    });
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
            }
        };

        peerRef.current = pc;
        return pc;
    }, [isHost, safeWSSend, remoteVideoRef, setupDataChannel]);

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
                    const answer = await pc.createAnswer();
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
    }, [isPolite, safeWSSend]);

    // Heartbeat mechanism to detect connection issues
    const startHeartbeat = useCallback(() => {
        stopHeartbeat();
        heartbeatIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                safeWSSend({ type: 'ping' });
            }
        }, 30000); // Send ping every 30 seconds
    }, [safeWSSend]);

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
        const delay = Math.min(1000 * Math.pow(2, Math.random()), 10000); // Max 10 seconds
        
        reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[WebSocket] Attempting reconnection...");
            connectWebSocket();
        }, delay);
    }, [connectWebSocket, isReconnecting]);

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

        // Restart connection after delay
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
        }, 2000);
    }, [createPeer, isPolite]);

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
        }, 5000);
    }, []);

    const stopStatsMonitoring = useCallback(() => {
        if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
            statsIntervalRef.current = null;
        }
    }, []);

    // Main effect
    useEffect(() => {
        if (!roomId || !userName) return;

        let localStream: MediaStream;

        async function start() {
            try {
                console.log("[Setup] Starting WebRTC setup");
                
                // Get local media with enhanced constraints
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: videoActive ? {
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 },
                        frameRate: { ideal: 30, max: 60 }
                    } : false,
                    audio: micActive ? {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 48000
                    } : false
                });

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream;
                }
                localStreamRef.current = localStream;
                console.log("[Setup] Local media acquired");

                // Create peer connection first
                const peer = createPeer();
                
                // Add tracks to peer connection
                await addTracksIfNeeded(peer);
                
                // Connect WebSocket after peer is ready
                connectWebSocket();

            } catch (error) {
                console.error("[Setup] Error:", error);
                alert('Unable to access camera/microphone. Please check permissions.');
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
            
            // Reset state
            setDataChannelOpen(false);
            setConnectionState('new');
            setIceConnectionState('new');
            setIsReconnecting(false);
        };
    }, [roomId, userName, localVideoRef, connectWebSocket, createPeer, addTracksIfNeeded, stopHeartbeat, stopStatsMonitoring]);

    // Track state changes effect
    useEffect(() => {
        if (!localStreamRef.current) return;

        localStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = micActive;
        });

        localStreamRef.current.getVideoTracks().forEach(track => {
            track.enabled = videoActive;
        });
    }, [micActive, videoActive]);

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