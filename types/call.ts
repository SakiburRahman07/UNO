// Audio call types — shared by client and server.

export interface CallParticipant {
  playerId: string;
  name: string;
  muted: boolean;
}

/** Serializable ICE candidate (mirrors RTCIceCandidateInit). */
export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
}

/** SDP offer/answer body. */
export type Sdp = string;

/**
 * Soft warning threshold for mesh topology. Beyond this many simultaneous
 * callers, audio quality may degrade on low-bandwidth/mobile peers. No hard
 * cap is enforced — this is used only for a UI hint.
 */
export const CALL_WARN_THRESHOLD = 8;
