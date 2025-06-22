import { useEffect, useRef } from "react";

/**
 * Robust WebRTC 1-to-1 hook with Perfect Negotiation.
 * - Handles polite/impolite logic
 * - Prevents double answering/offering
 * - Cleans up all resources
 * - Buffers signaling until WebSocket is open
 */
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

    // Host = impolite, Guest = polite
    const isPolite = !isHost;

    // Buffer messages until WS is open
    const wsSendBuffer = useRef<any[]>([]);
    function safeWSSend(data: any) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        } else {
            wsSendBuffer.current.push(data);
        }
    }

    useEffect(() => {
        if (!roomId || !userName) return;

        let ws: WebSocket;
        let peer: RTCPeerConnection;
        let localStream: MediaStream;
        let remoteStream = new MediaStream();

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

            // 2. WebSocket signaling
            const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
            ws = new WebSocket(
                `${wsProtocol}://${window.location.hostname}:8080/join-room?roomID=${roomId}`
            );
            wsRef.current = ws;

            ws.onopen = () => {
                ws.send(JSON.stringify({ join: true, userName }));
                while (wsSendBuffer.current.length > 0) {
                    ws.send(JSON.stringify(wsSendBuffer.current.shift()));
                }
            };

            ws.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                const pc = peerRef.current;
                if (!pc) return;

                if (message.offer) {
                    // Offer collision
                    const offerCollision = makingOfferRef.current || pc.signalingState !== "stable";
                    ignoreOfferRef.current = !isPolite && offerCollision;
                    if (ignoreOfferRef.current) {
                        console.log("Ignoring offer due to collision (impolite peer).");
                        return;
                    }
                    try {
                        if (offerCollision) {
                            await pc.setLocalDescription({ type: "rollback" });
                        }
                        await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
                        // ICE queue
                        while (iceQueueRef.current.length > 0) {
                            const candidate = iceQueueRef.current.shift();
                            if (candidate) await pc.addIceCandidate(candidate);
                        }
                        addTracksIfNeeded(pc);
                        // Only answer if in have-remote-offer state!
                        if (pc.signalingState === "have-remote-offer") {
                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);
                            safeWSSend({ answer });
                        } else {
                            // This can happen in rare race conditions, just log
                            console.warn(
                                "Not in have-remote-offer after setRemoteDescription, not creating answer. State:",
                                pc.signalingState
                            );
                        }
                    } catch (err) {
                        console.error("Error handling offer:", err);
                    }
                } else if (message.answer) {
                    if (pc.signalingState === "have-local-offer") {
                        try {
                            await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
                        } catch (err) {
                            console.error("Error handling answer:", err);
                        }
                    } else {
                        // Silently ignore (or log if you like)
                        // console.warn("Ignoring remote answer: not in have-local-offer state. Current state:", pc.signalingState);
                    }
                } else if (message.iceCandidate) {
                    try {
                        if (pc.remoteDescription && pc.remoteDescription.type) {
                            await pc.addIceCandidate(new RTCIceCandidate(message.iceCandidate));
                        } else {
                            iceQueueRef.current.push(message.iceCandidate);
                        }
                    } catch (e) {
                        console.error("Error adding received ICE candidate", e);
                    }
                } else if (message.join && isPolite) {
                    // Only polite (guest) peer initiates
                    callUser();
                } else if (message.leave) {
                    // Peer left, cleanup remote stream
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = null;
                    }
                }
            };

            peer = createPeer();
            if (!isPolite) addTracksIfNeeded(peer); // Host only adds tracks, doesn't call
        }

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
                ]
            });

            p.onnegotiationneeded = async () => {
                try {
                    makingOfferRef.current = true;
                    if (p.signalingState === "stable") {
                        const offer = await p.createOffer();
                        await p.setLocalDescription(offer);
                        safeWSSend({ offer });
                    }
                } catch (err) {
                    console.error('Negotiation needed error:', err);
                } finally {
                    makingOfferRef.current = false;
                }
            };

            p.onicecandidate = (event) => {
                if (event.candidate) {
                    safeWSSend({ iceCandidate: event.candidate });
                }
            };

            p.ontrack = (event) => {
                event.streams[0].getTracks().forEach((track) => {
                    remoteStream.addTrack(track);
                });
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
            };

            p.oniceconnectionstatechange = () => {
                console.log("[WebRTC] ICE connection state:", p.iceConnectionState);
            };

            p.onicegatheringstatechange = () => {
                console.log("[WebRTC] ICE gathering state:", p.iceGatheringState);
            };

            p.onsignalingstatechange = () => {
                console.log("[WebRTC] Signaling state:", p.signalingState);
            };

            peerRef.current = p;
            return p;
        }

        function addTracksIfNeeded(peer: RTCPeerConnection) {
            if (!tracksAddedRef.current && localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    peer.addTrack(track, localStreamRef.current!);
                });
                tracksAddedRef.current = true;
            }
        }

        async function callUser() {
            const peer = createPeer();
            addTracksIfNeeded(peer);
            // Offer will be created by onnegotiationneeded
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
            makingOfferRef.current = false;
            ignoreOfferRef.current = false;
            wsSendBuffer.current = [];
        };
    // eslint-disable-next-line
    }, [roomId, userName, micActive, videoActive, localVideoRef, remoteVideoRef, isHost]);
}