import { useState, useRef, useCallback, useEffect } from "react";

/* REAL CAPTURE
 *
 * The prototype simulated recording. This does it for real, using the
 * browser's own MediaRecorder, and hands back a File ready to upload to
 * storage alongside a lesson.
 *
 * Two things worth knowing, both learned the hard way on Safari:
 *   - the MIME type has to be negotiated, not assumed; Safari does not
 *     support webm, Chrome does not always support mp4.
 *   - the stream must be stopped explicitly or the camera light stays
 *     on after the component unmounts.
 */

const pickMime = (kinds) => {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of kinds) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* older browsers throw */ }
  }
  return null;                      // let the browser choose its default
};

const VIDEO_TYPES = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
const AUDIO_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

export function useCapture() {
  const [state, setState] = useState("idle");     // idle | ready | recording | error
  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const tickRef = useRef(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());   // releases the camera light
      streamRef.current = null;
    }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const supported = typeof navigator !== "undefined"
    && navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === "function"
    && typeof MediaRecorder !== "undefined";

  /* Ask for the camera or microphone. Returns the stream so a preview
     element can attach to it. */
  const start = useCallback(async (mode = "video") => {
    setError(null);
    if (!supported) {
      setError("This browser can't record. You can still upload a file.");
      setState("error");
      return null;
    }
    try {
      const constraints = mode === "audio"
        ? { audio: true }
        : { video: { facingMode: "environment", width: { ideal: 1280 } }, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setState("ready");
      return stream;
    } catch (e) {
      /* The message matters here — "denied" and "no camera found" need
         different advice, and a generic failure helps nobody. */
      const msg = e && e.name === "NotAllowedError"
        ? "Permission was declined. Allow camera access in your browser settings, or upload a file instead."
        : e && e.name === "NotFoundError"
        ? "No camera or microphone found on this device."
        : "Couldn't start recording. You can still upload a file.";
      setError(msg);
      setState("error");
      return null;
    }
  }, [supported]);

  const record = useCallback((mode = "video") => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = pickMime(mode === "audio" ? AUDIO_TYPES : VIDEO_TYPES);
    let rec;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (e) {
      rec = new MediaRecorder(stream);          // fall back to the browser default
    }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    rec.start();
    recorderRef.current = rec;
    setSeconds(0);
    tickRef.current = setInterval(() => setSeconds((n) => n + 1), 1000);
    setState("recording");
  }, []);

  /* Resolves with a File, so it can go straight into storage without
     any further conversion. */
  const stop = useCallback((mode = "video") => new Promise((resolve) => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") { resolve(null); return; }
    rec.onstop = () => {
      const type = rec.mimeType || (mode === "audio" ? "audio/webm" : "video/webm");
      const ext = type.includes("mp4") ? (mode === "audio" ? "m4a" : "mp4")
                : type.includes("ogg") ? "ogg" : "webm";
      const blob = new Blob(chunksRef.current, { type });
      const file = new File([blob], `${mode}-${Date.now()}.${ext}`, { type });
      chunksRef.current = [];
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      setState("ready");
      resolve(file);
    };
    rec.stop();
  }), []);

  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") { rec.onstop = null; rec.stop(); }
    chunksRef.current = [];
    stopStream();
    setState("idle");
    setSeconds(0);
  }, [stopStream]);

  return { supported, state, error, seconds, start, record, stop, cancel, stopStream,
           stream: () => streamRef.current };
}

/* Speech to text lives in Nosca.jsx itself, alongside the microphone
   button it's wired to — this file only handles the camera. */
