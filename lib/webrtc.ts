// WebRTC configuration for the audio call feature.
// Client-only — never imported by the server.

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  // Optional TURN relay (for symmetric NAT / strict firewalls). Configure via
  // env vars when cross-network calls fail with STUN alone.
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USER ?? "",
      credential: process.env.NEXT_PUBLIC_TURN_PASS ?? "",
    });
  }
  return servers;
}

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: buildIceServers(),
  iceTransportPolicy: "all",
  bundlePolicy: "max-bundle",
};

export const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

/** RMS volume (0..1) above which a participant counts as speaking. */
export const SPEAKING_THRESHOLD = 0.04;
/** Keep the "speaking" indicator lit briefly to avoid flicker on pauses. */
export const SPEAKING_HOLD_MS = 250;
