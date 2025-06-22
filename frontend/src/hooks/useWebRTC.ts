import { useEffect, useRef } from "react";

/**
 * Robust, minimal useWebRTC hook for 1-to-1 rooms.
 *
 * Features:
 * - Only one peer connection per room
 * - Tracks only added once
 * - ICE candidates are queued and added after setRemoteDescription
 * - Proper rollback if signaling state is not stable
 * - Handles negotiationneeded and remote/answer events
 */
export function useWebRTC(
    roomId: string,
    userName: string,
    localVideoRef: React.RefObject<HTMLVideoElement>,
    remoteVideoRef: React.RefObject<HTMLVideoElement>,
    micActive: boolean,
    videoActive: boolean,
    isHost: boolean // <-- Add this parameter
) {
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
    const tracksAddedRef = useRef(false);
    const isNegotiatingRef = useRef(false);
    const isPoliteRef = useRef(false);
    const makingOfferRef = useRef(false);
    const lastOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

    useEffect(() => {
        if (!roomId || !userName) return;

        let ws: WebSocket;
        let peer: RTCPeerConnection;
        let localStream: MediaStream;

        async function start() {
            // 1. Get local media
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: videoActive,
                    audio: micActive,
                });
                if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
                localStreamRef.current = localStream;
            } catch (e) {
                alert('Unable to access camera/mic');
                return;
            }

            // 2. WebSocket signaling connection
            ws = new WebSocket(
                `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8080/join-room?roomID=${roomId}`
            );
            wsRef.current = ws;

            ws.onopen = () => {
                ws.send(JSON.stringify({ join: true, userName }));
            };

            ws.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                const pc = peerRef.current;
                if (!pc) return;

                if (message.type === "offer" && !isHost) {
                    await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    ws.send(JSON.stringify({ type: "answer", answer }));
                } else if (message.type === "answer" && isHost) {
                    await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
                }
                // ...handle ICE candidates...
            };

            function createPeer() {
                if (peerRef.current) return peerRef.current;
                const p = new RTCPeerConnection({
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        { urls: "stun:stun1.l.google.com:19302" },
                        { urls: "stun:stun2.l.google.com:19302" },
                        { urls: "stun:stun3.l.google.com:19302" },
                        { urls: "stun:stun4.l.google.com:19302" },
                        {
                            urls: "turn:openrelay.metered.ca:80",
                            username: "openrelayproject",
                            credential: "openrelayproject"
                        },
                        {
                            urls: "turn:openrelay.metered.ca:443",
                            username: "openrelayproject",
                            credential: "openrelayproject"
                        }
                    ],
                    iceCandidatePoolSize: 10,
                });

                p.onnegotiationneeded = async () => {
                    try {
                        if (isNegotiatingRef.current) return;
                        isNegotiatingRef.current = true;
                        makingOfferRef.current = true;

                        if (p.signalingState === "stable") {
                            const offer = await p.createOffer();
                            lastOfferRef.current = offer;
                            await p.setLocalDescription(offer);
                            ws.send(JSON.stringify({ offer: p.localDescription }));
                        }
                    } catch (err) {
                        console.error('Negotiation needed error:', err);
                    } finally {
                        isNegotiatingRef.current = false;
                        makingOfferRef.current = false;
                    }
                };

                p.onicecandidate = (event) => {
                    if (event.candidate) {
                        ws.send(JSON.stringify({ iceCandidate: event.candidate }));
                    }
                };

                p.ontrack = (event) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                    }
                };

                p.oniceconnectionstatechange = () => {
                    const DEBUG = true;
                    function log(...args: any[]) {
                        if (DEBUG) {
                            console.log("[WebRTC]", ...args);
                        }
                    }
                    log("ICE connection state:", p.iceConnectionState);
                };

                p.onicegatheringstatechange = () => {
                    console.log("ICE gathering state:", p.iceGatheringState);
                };

                p.onsignalingstatechange = () => {
                    console.log("Signaling state:", p.signalingState);
                };

                let connectionTimeout: ReturnType<typeof setTimeout>;
                
                function resetConnectionTimeout() {
                    if (connectionTimeout) clearTimeout(connectionTimeout);
                    connectionTimeout = setTimeout(() => {
                        if (peerRef.current?.connectionState !== 'connected') {
                            console.log("Connection timeout, resetting connection...");
                            peerRef.current?.close();
                            peerRef.current = null;
                            tracksAddedRef.current = false;
                            iceQueueRef.current = [];
                            ws.send(JSON.stringify({ join: true, userName }));
                        }
                    }, 15000);
                }
                
                p.onconnectionstatechange = () => {
                    console.log("Connection state:", p.connectionState);
                    if (p.connectionState === 'connecting') {
                        resetConnectionTimeout();
                    } else if (p.connectionState === 'connected') {
                        if (connectionTimeout) clearTimeout(connectionTimeout);
                    } else if (p.connectionState === 'failed') {
                        // Try to recover from failed state
                        if (peerRef.current) {
                            peerRef.current.restartIce();
                        }
                    }
                };

                peerRef.current = p;
                return p;
            }

            function addTracksIfNeeded(peer: RTCPeerConnection) {
                if (!tracksAddedRef.current && localStreamRef.current) {
                    console.log("Adding tracks to peer connection");
                    localStreamRef.current.getTracks().forEach((track) => {
                        if (localStreamRef.current) {
                            console.log("Adding track:", track.kind, track.id);
                            peer.addTrack(track, localStreamRef.current);
                        }
                    });
                    tracksAddedRef.current = true;
                }
            }

            async function callUser() {
                peer = createPeer();
                addTracksIfNeeded(peer);
            }

            async function handleOffer(offer: RTCSessionDescriptionInit) {
                const peer = createPeer();
                try {
                    const offerCollision = makingOfferRef.current || peer.signalingState !== "stable";
                    const ignoreOffer = !isPoliteRef.current && offerCollision;
                    
                    if (ignoreOffer) {
                        console.log("Ignoring offer due to collision");
                        return;
                    }

                    if (offerCollision) {
                        console.log("Rolling back local offer before accepting remote offer");
                        await peer.setLocalDescription({type: "rollback"});
                    }

                    await peer.setRemoteDescription(new RTCSessionDescription(offer));
                    
                    while (iceQueueRef.current.length > 0) {
                        const candidate = iceQueueRef.current.shift();
                        if (candidate) await peer.addIceCandidate(candidate);
                    }
                    
                    addTracksIfNeeded(peer);
                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);
                    wsRef.current?.send(JSON.stringify({ answer }));
                } catch (err) {
                    console.error("Error handling offer:", err);
                    // If we failed to handle the offer, try to recover
                    if (peer.signalingState === "stable") {
                        try {
                            await peer.setLocalDescription({type: "rollback"});
                            if (lastOfferRef.current) {
                                await peer.setLocalDescription(lastOfferRef.current);
                                wsRef.current?.send(JSON.stringify({ offer: lastOfferRef.current }));
                            }
                        } catch (recoveryErr) {
                            console.error("Failed to recover from offer handling error:", recoveryErr);
                        }
                    }
                }
            }
        }

        start();

        return () => {
            wsRef.current?.close();
            peerRef.current?.close();
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            peerRef.current = null;
            wsRef.current = null;
            localStreamRef.current = null;
            tracksAddedRef.current = false;
            iceQueueRef.current = [];
            isNegotiatingRef.current = false;
            isPoliteRef.current = false;
            makingOfferRef.current = false;
            lastOfferRef.current = null;
        };
    }, [roomId, userName, micActive, videoActive, localVideoRef, remoteVideoRef, isHost]);
}