"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSocket } from "@/lib/socket";
import {
  AUDIO_CONSTRAINTS,
  RTC_CONFIG,
  SPEAKING_HOLD_MS,
  SPEAKING_THRESHOLD,
} from "@/lib/webrtc";
import type { CallParticipant, IceCandidatePayload, Sdp } from "@/types/call";

interface AnalyserCtx {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  lastActive: number;
}

export interface AudioCallApi {
  inCall: boolean;
  muted: boolean;
  participants: CallParticipant[];
  speaking: Record<string, boolean>;
  /** Smoothed audio level (0..1) per participant, for live bars. */
  levels: Record<string, number>;
  /** Timestamp (ms) when the local user joined the call, or null. */
  startedAt: number | null;
  error: string | null;
  joinCall: () => Promise<void>;
  leaveCall: () => void;
  toggleMute: () => void;
}

/**
 * Manages a peer-to-peer (mesh) audio call over WebRTC, using the socket.io
 * connection purely as the signaling channel (SDP offer/answer + ICE trickle).
 *
 * Glare-free negotiation: the peer whose `playerId` is lexicographically lower
 * creates the offer; the higher-id peer only answers. This guarantees exactly
 * one offer per pair with no renegotiation.
 */
export function useAudioCall(socket: AppSocket | null, myPlayerId: string): AudioCallApi {
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analysersRef = useRef<Map<string, AnalyserCtx>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const speakingRef = useRef<Record<string, boolean>>({});
  const levelsRef = useRef<Record<string, number>>({});

  const mutedRef = useRef(false);
  const inCallRef = useRef(false);
  const myIdRef = useRef(myPlayerId);

  useEffect(() => {
    myIdRef.current = myPlayerId;
  }, [myPlayerId]);

  /** Remove the analyser tap for a peer (does not stop the underlying stream). */
  const removeAnalyser = useCallback((peerId: string) => {
    const ctx = analysersRef.current.get(peerId);
    if (ctx) {
      try {
        ctx.source.disconnect();
        ctx.analyser.disconnect();
      } catch {
        /* ignore */
      }
      analysersRef.current.delete(peerId);
    }
    setSpeaking((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      speakingRef.current = next;
      return next;
    });
  }, []);

  /** Tear down a single peer connection + its audio element + analyser. */
  const teardownPeer = useCallback(
    (peerId: string) => {
      const pc = pcsRef.current.get(peerId);
      if (pc) {
        try {
          pc.ontrack = null;
          pc.onicecandidate = null;
          pc.onconnectionstatechange = null;
          pc.close();
        } catch {
          /* ignore */
        }
        pcsRef.current.delete(peerId);
      }
      const el = audioElsRef.current.get(peerId);
      if (el) {
        el.srcObject = null;
        el.remove();
        audioElsRef.current.delete(peerId);
      }
      removeAnalyser(peerId);
    },
    [removeAnalyser],
  );

  /** Tear down all peer connections (keeps the local mic stream alive). */
  const teardownPeers = useCallback(() => {
    for (const id of [...pcsRef.current.keys()]) teardownPeer(id);
  }, [teardownPeer]);

  /** Attach an analyser to a stream so the speaking loop can measure volume. */
  const startSpeakingDetection = useCallback((peerId: string, stream: MediaStream) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (analysersRef.current.has(peerId)) return;
    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analysersRef.current.set(peerId, { source, analyser, lastActive: 0 });
    } catch {
      /* AudioContext may be closed during teardown — ignore. */
    }
  }, []);

  /** Create (or fetch) the RTCPeerConnection for a remote peer. */
  const ensurePC = useCallback(
    (peerId: string): RTCPeerConnection | null => {
      if (peerId === myIdRef.current) return null;
      const existing = pcsRef.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcsRef.current.set(peerId, pc);

      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket?.emit("call:ice", {
            to: peerId,
            candidate: {
              candidate: e.candidate.candidate,
              sdpMid: e.candidate.sdpMid,
              sdpMLineIndex: e.candidate.sdpMLineIndex,
              usernameFragment: e.candidate.usernameFragment ?? null,
            },
          });
        }
      };

      pc.ontrack = (e) => {
        const remoteStream = e.streams[0];
        if (!remoteStream) return;
        let el = audioElsRef.current.get(peerId);
        if (!el) {
          el = document.createElement("audio");
          el.autoplay = true;
          el.setAttribute("playsinline", "");
          el.style.display = "none";
          document.body.appendChild(el);
          audioElsRef.current.set(peerId, el);
        }
        el.srcObject = remoteStream;
        startSpeakingDetection(peerId, remoteStream);
      };

      pc.onconnectionstatechange = () => {
        // On hard failure, drop the peer; the roster state will re-establish it
        // if the remote is still around (e.g. after a transient ICE failure).
        if (pc.connectionState === "failed") teardownPeer(peerId);
      };

      return pc;
    },
    [socket, startSpeakingDetection, teardownPeer],
  );

  /** Lower-id side initiates the offer (glare-free). */
  const createOffer = useCallback(
    async (peerId: string) => {
      const pc = ensurePC(peerId);
      if (!pc) return;
      if (pc.signalingState !== "stable") return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit("call:offer", { to: peerId, sdp: offer.sdp as Sdp });
      } catch {
        /* ignore — will retry on next roster refresh */
      }
    },
    [ensurePC, socket],
  );

  const handleState = useCallback(
    (roster: CallParticipant[]) => {
      setParticipants(roster);
      const myId = myIdRef.current;
      const peerIds = roster.filter((p) => p.playerId !== myId).map((p) => p.playerId);

      // New peers: only the lower-id side creates an offer.
      for (const pid of peerIds) {
        if (!pcsRef.current.has(pid) && myId < pid) createOffer(pid);
      }
      // Departed peers: tear down.
      for (const pid of [...pcsRef.current.keys()]) {
        if (!peerIds.includes(pid)) teardownPeer(pid);
      }
    },
    [createOffer, teardownPeer],
  );

  const handleOffer = useCallback(
    async (data: { from: string; sdp: Sdp }) => {
      const pc = ensurePC(data.from);
      if (!pc) return;
      try {
        if (pc.signalingState !== "stable") {
          // Glare: drop the incoming offer; our outbound offer wins (we're lower id).
          return;
        }
        await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit("call:answer", { to: data.from, sdp: answer.sdp as Sdp });
      } catch {
        /* ignore */
      }
    },
    [ensurePC, socket],
  );

  const handleAnswer = useCallback(async (data: { from: string; sdp: Sdp }) => {
    const pc = pcsRef.current.get(data.from);
    if (!pc) return;
    try {
      if (pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
    } catch {
      /* ignore */
    }
  }, []);

  const handleIce = useCallback(async (data: { from: string; candidate: IceCandidatePayload }) => {
    const pc = pcsRef.current.get(data.from);
    if (!pc) return;
    try {
      await pc.addIceCandidate(data.candidate);
    } catch {
      /* ignore — late candidates are common during teardown */
    }
  }, []);

  // ---- Socket event registration ----
  useEffect(() => {
    if (!socket) return;
    socket.on("call:state", handleState);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice", handleIce);
    return () => {
      socket.off("call:state", handleState);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice", handleIce);
    };
  }, [socket, handleState, handleOffer, handleAnswer, handleIce]);

  // ---- Speaking + level detection rAF loop (runs only while in a call) ----
  useEffect(() => {
    if (!inCall) return;
    const loop = () => {
      const now = performance.now();
      const prev = speakingRef.current;
      const nextSpeaking: Record<string, boolean> = {};
      const nextLevels: Record<string, number> = {};
      let speakChanged = false;
      let levelChanged = false;
      const prevLevels = levelsRef.current;
      for (const [peerId, ctx] of analysersRef.current) {
        const data = new Uint8Array(ctx.analyser.frequencyBinCount);
        ctx.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const active = rms > SPEAKING_THRESHOLD;
        if (active) ctx.lastActive = now;
        const still = active || now - ctx.lastActive < SPEAKING_HOLD_MS;
        nextSpeaking[peerId] = still;
        if (still !== (prev[peerId] ?? false)) speakChanged = true;

        // Smooth the level toward the current RMS for organic bar motion.
        const target = Math.min(1, rms * 2.5);
        const prevLevel = prevLevels[peerId] ?? 0;
        const smoothed = prevLevel + (target - prevLevel) * 0.35;
        nextLevels[peerId] = smoothed;
        if (Math.abs(smoothed - prevLevel) > 0.01) levelChanged = true;
      }
      if (speakChanged) {
        speakingRef.current = nextSpeaking;
        setSpeaking(nextSpeaking);
      }
      if (levelChanged) {
        levelsRef.current = nextLevels;
        setLevels(nextLevels);
      } else {
        // Keep ref in sync even when deltas are tiny.
        levelsRef.current = nextLevels;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [inCall]);

  // ---- Media cleanup when leaving the call ----
  useEffect(() => {
    if (!inCall) return;
    return () => {
      teardownPeers();
      removeAnalyser(myIdRef.current);
      if (localStreamRef.current) {
        for (const t of localStreamRef.current.getTracks()) t.stop();
        localStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setSpeaking({});
      speakingRef.current = {};
      setLevels({});
      levelsRef.current = {};
      setStartedAt(null);
    };
  }, [inCall, teardownPeers, removeAnalyser]);

  // ---- Reconnect: re-announce + rebuild peer connections ----
  useEffect(() => {
    if (!socket || !inCall) return;
    const onConnect = () => {
      if (!inCallRef.current) return;
      teardownPeers();
      socket.emit("call:join", () => {});
    };
    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, [socket, inCall, teardownPeers]);

  // ---- Unmount safety: stop all media ----
  useEffect(() => {
    return () => {
      teardownPeers();
      if (localStreamRef.current) {
        for (const t of localStreamRef.current.getTracks()) t.stop();
        localStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [teardownPeers]);

  const joinCall = useCallback(async () => {
    if (inCallRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((t) => (t.enabled = !mutedRef.current));

      // AudioContext must be created during a user gesture for autoplay.
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume().catch(() => {});
      }
      startSpeakingDetection(myIdRef.current, stream);

      inCallRef.current = true;
      setInCall(true);
      setStartedAt(Date.now());
      socket?.emit("call:join", () => {});
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        setError("Microphone permission denied. Allow mic access in your browser and try again.");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setError("No microphone found. Connect a mic and try again.");
      } else {
        setError(err?.message ?? "Failed to access microphone");
      }
      if (localStreamRef.current) {
        for (const t of localStreamRef.current.getTracks()) t.stop();
        localStreamRef.current = null;
      }
    }
  }, [socket, startSpeakingDetection]);

  const leaveCall = useCallback(() => {
    socket?.emit("call:leave");
    // Media teardown happens via the [inCall] cleanup effect below.
    inCallRef.current = false;
    setInCall(false);
    setParticipants([]);
    setMuted(false);
    mutedRef.current = false;
    setStartedAt(null);
  }, [socket]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !mutedRef.current;
    mutedRef.current = next;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
    socket?.emit("call:toggle-mute");
  }, [socket]);

  return {
    inCall,
    muted,
    participants,
    speaking,
    levels,
    startedAt,
    error,
    joinCall,
    leaveCall,
    toggleMute,
  };
}
