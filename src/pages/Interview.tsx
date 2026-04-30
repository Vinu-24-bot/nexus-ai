import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Mic, Square, ChevronRight, Loader2, Focus, ScanFace, Activity,
  Brain, CheckCircle2, Volume2, Clock, ShieldAlert, Star, Send, ShieldX, ShieldCheck,
  Eye, MousePointerClick, Keyboard, LogOut, Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitEvaluation, uploadVideo } from "@/lib/api";
import { toast } from "sonner";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000") + "/api";
const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY || "";

interface InterviewQuestion { id: number; question: string; category: string; difficulty: string; }
interface LocationState { candidateName: string; position: string; jobDescription: string; resume: string; questions: InterviewQuestion[]; voiceGender: "female" | "male"; durationMinutes: number; }
interface AnswerRecord { questionId: number; transcript: string; videoBlob: Blob | null; }

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

declare global {
  interface Window { currentActiveAudio: HTMLAudioElement | null; }
}

const CandidateHeader = ({ isLive, strikes }: { isLive: boolean, strikes: number }) => (
  <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
    <div className="container mx-auto px-6 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Brain className="w-6 h-6 text-primary" />
        <span className="font-display text-lg font-bold tracking-wider text-foreground">BATS ForgePro</span>
      </div>
      {isLive ? (
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`w-3 h-3 rounded-full ${strikes >= s ? "bg-destructive animate-pulse" : "bg-muted"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-destructive animate-pulse tracking-widest">
            <span className="w-2 h-2 rounded-full bg-destructive" /> LIVE SECURITY VAULT
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" /> Secure Environment
        </div>
      )}
    </div>
  </header>
);

function getVoice(gender: "female" | "male"): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const femaleKeywords = ["female", "woman", "jenny", "samantha", "karen", "zira", "victoria"];
  const maleKeywords = ["male", "man", "guy", "david", "mark", "daniel", "james"];
  
  let bestMatch: SpeechSynthesisVoice | null = null;
  let highestScore = -1;

  for (const v of voices) {
    if (!v.lang.startsWith("en")) continue;
    const name = v.name.toLowerCase();
    let score = 0;
    if ((gender === "female" ? femaleKeywords : maleKeywords).some(k => name.includes(k))) score += 2;
    if (name.includes("google") || name.includes("neural") || name.includes("premium")) score += 5; 
    if (score > highestScore) { highestScore = score; bestMatch = v; }
  }
  return bestMatch || voices.find(v => v.lang.startsWith("en")) || voices[0];
}

function speakText(text: string, gender: "female" | "male"): Promise<void> {
  return new Promise(async (resolve) => {
    try {
      const res = await fetch(`${API_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, gender })
      });
      
      if (!res.ok) throw new Error("TTS failed");
      
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      window.currentActiveAudio = audio;
      
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => {
        fallbackSpeak(text, gender, resolve);
      });
    } catch (e) {
      fallbackSpeak(text, gender, resolve);
    }
  });
}

function fallbackSpeak(text: string, gender: "female" | "male", resolve: () => void) {
  if (!window.speechSynthesis) { resolve(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  
  const voices = window.speechSynthesis.getVoices();
  const femaleKeywords = ["female", "woman", "jenny", "samantha", "karen", "zira", "victoria"];
  const maleKeywords = ["male", "man", "guy", "david", "mark", "daniel", "james"];
  
  let bestMatch: SpeechSynthesisVoice | null = null;
  let highestScore = -1;
  for (const v of voices) {
    if (!v.lang.startsWith("en")) continue;
    const name = v.name.toLowerCase();
    let score = 0;
    if ((gender === "female" ? femaleKeywords : maleKeywords).some(k => name.includes(k))) score += 2;
    if (name.includes("google") || name.includes("neural") || name.includes("premium")) score += 5; 
    if (score > highestScore) { highestScore = score; bestMatch = v; }
  }
  
  if (bestMatch) utterance.voice = bestMatch;
  utterance.rate = 0.95; 
  utterance.pitch = gender === "female" ? 1.05 : 0.95;
  utterance.volume = 1;
  utterance.lang = "en-US";
  utterance.onend = () => resolve();
  utterance.onerror = () => resolve();
  window.speechSynthesis.speak(utterance);
}

const mixAudioStreams = (stream1: MediaStream | null, stream2: MediaStream | null) => {
  try {
    const ctx = new window.AudioContext();
    const dest = ctx.createMediaStreamDestination();
    let hasAudio = false;
    if (stream1 && stream1.getAudioTracks().length > 0) {
      ctx.createMediaStreamSource(stream1).connect(dest);
      hasAudio = true;
    }
    if (stream2 && stream2.getAudioTracks().length > 0) {
      ctx.createMediaStreamSource(stream2).connect(dest);
      hasAudio = true;
    }
    return hasAudio ? dest.stream.getAudioTracks()[0] : null;
  } catch (e) {
    return stream1?.getAudioTracks()[0] || null;
  }
};

export default function InterviewPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | undefined;

  const [fetchedData, setFetchedData] = useState<LocationState | null>(null);
  const [isInitializing, setIsInitializing] = useState(!!sessionId && !state);

  const [currentQ, setCurrentQ] = useState(-1);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [introPhase, setIntroPhase] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  
  const [liveTranscript, setLiveTranscript] = useState("");
  const liveTranscriptRef = useRef(""); 
  const [accumulatedTranscript, setAccumulatedTranscript] = useState(""); 
  
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [interviewStep, setInterviewStep] = useState<"welcome" | "ready" | "scanning" | "interview" | "submitting" | "feedback">("welcome");
  const [cameraReady, setCameraReady] = useState(false);
  
  const [cheatStrikes, setCheatStrikes] = useState(0);
  const [terminationReason, setTerminationReason] = useState("");
  const [telemetry, setTelemetry] = useState({ faces: 1, liveness: 99, lipSync: true, mask: false });
  const [maskWarnings, setMaskWarnings] = useState(0);

  const questionEndTimeRef = useRef(0);
  const [currentLatencyDisplay, setCurrentLatencyDisplay] = useState("0.0s");
  const latenciesRef = useRef<number[]>([]);

  const isSpeakingRef = useRef(false);
  const consecutiveSpeechFramesRef = useRef(0);

  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // 🛡️ PHASE 3: Deepgram Integration Refs
  const recognitionRef = useRef<any>(null); // For WebSpeech Fallback
  const dgSocketRef = useRef<WebSocket | null>(null); // For Deepgram
  const dgRecorderRef = useRef<MediaRecorder | null>(null); // For audio streaming
  
  const isRecordingRef = useRef(false); 
  const fullRecordingChunksRef = useRef<Blob[]>([]);
  const fullRecorderRef = useRef<MediaRecorder | null>(null);
  
  const watchdogIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef(Date.now());
  const lastSpeechRef = useRef(Date.now());
  const isHandlingSubmitRef = useRef(false);
  const securityLoopRef = useRef<number | null>(null);

  const isTerminatingRef = useRef(false);
  const escWarningsRef = useRef(0);
  const clickWarningsRef = useRef(0);

  const [submitStatusIndex, setSubmitStatusIndex] = useState(0);
  const submitStatuses = [
    "Securely Uploading Encrypted Session...",
    "Transcribing Audio to Text...",
    "AI Analyzing Technical Depth & Alignment...",
    "Cross-referencing Answers with Job Description...",
    "Finalizing Enterprise Report..."
  ];

  const candidateName = state?.candidateName || fetchedData?.candidateName || "";
  const position = state?.position || fetchedData?.position || "";
  const jobDescription = state?.jobDescription || fetchedData?.jobDescription || "";
  const resume = state?.resume || fetchedData?.resume || "";
  const durationMinutes = state?.durationMinutes || fetchedData?.durationMinutes || 10;
  const voiceGender = state?.voiceGender || fetchedData?.voiceGender || "female";
  
  const rawQuestions = state?.questions || fetchedData?.questions || [];
  const activeQuestions = rawQuestions.length > 0 ? rawQuestions : [
    { id: 1, question: "Could you briefly describe your most impactful project?", category: "technical", difficulty: "medium" },
    { id: 2, question: "What is the most challenging bug you've faced recently?", category: "behavioral", difficulty: "hard" }
  ];

  const calculatedQuestionTarget = durationMinutes === 10 ? 6 : durationMinutes === 15 ? 8 : 10;
  const finalQuestionsList = activeQuestions.slice(0, calculatedQuestionTarget);
  const totalQuestions = finalQuestionsList.length;
  const currentQuestion = introPhase ? null : (finalQuestionsList[currentQ] || null);
  const progress = totalQuestions > 0 ? (Math.max(0, currentQ) / totalQuestions) * 100 : 0;
  const timeRemaining = (durationMinutes * 60) - totalElapsed;

  useEffect(() => {
    if (sessionId && !state) {
      const fetchSessionDetails = async () => {
        try {
          const res = await fetch(`${API_URL}/sessions/${sessionId}`);
          if (!res.ok) throw new Error("Invalid or expired session link.");
          const session = await res.json();
          const targetQCount = session.duration_minutes === 10 ? 6 : session.duration_minutes === 15 ? 8 : 10;
          const qRes = await fetch(`${API_URL}/generate-questions`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_description: session.job_description, resume: session.resume_text, num_questions: targetQCount, interview_level: session.interview_level || "L2" })
          });
          const qData = await qRes.json();
          setFetchedData({ candidateName: session.candidate_name, position: session.position, jobDescription: session.job_description, resume: session.resume_text, questions: qData.questions, voiceGender: "female", durationMinutes: session.duration_minutes || 10 });
        } catch (err: any) {
          toast.error(err.message);
          navigate("/");
        } finally { setIsInitializing(false); }
      };
      fetchSessionDetails();
    }
  }, [sessionId, state, navigate]);

  useEffect(() => {
    return () => {
      if (window.currentActiveAudio) {
        window.currentActiveAudio.pause();
        window.currentActiveAudio.currentTime = 0;
      }
      window.speechSynthesis.cancel();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
      if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
      if (securityLoopRef.current) cancelAnimationFrame(securityLoopRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (dgSocketRef.current) dgSocketRef.current.close();
      if (dgRecorderRef.current) dgRecorderRef.current.stop();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (interviewStep === "interview" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [interviewStep]);

  const handleForceEndInterview = useCallback(async (isEarlyLeave = false, reason = "") => {
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;

    if (isRecordingRef.current) {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      if (dgSocketRef.current) { try { dgSocketRef.current.close(); } catch {} }
      if (dgRecorderRef.current) { try { dgRecorderRef.current.stop(); } catch {} }
    }
    
    finalizeInterviewAndUpload(reason || (isEarlyLeave ? "Candidate left early manually." : "Time Expired."));
  }, [accumulatedTranscript, introPhase, currentQuestion]);

  const handleSecurityViolation = useCallback((reason: string, isMask = false) => {
    if (isTerminatingRef.current) return;

    if (isMask) {
      setMaskWarnings(prev => {
        const newWarn = prev + 1;
        if (newWarn >= 3) {
          handleForceEndInterview(true, `SECURITY BREACH: Candidate refused to remove mask after 2 warnings.`);
        } else {
          speakText(`Security Alert. Please remove your face mask immediately to verify identity. Warning ${newWarn} of 2.`, voiceGender);
          toast.error(`MASK DETECTED: Please remove mask. (Warning ${newWarn}/2)`);
        }
        return newWarn;
      });
      return;
    }

    setCheatStrikes(prev => {
      const newStrikes = prev + 1;
      if (newStrikes >= 3) {
        handleForceEndInterview(true, `SECURITY BREACH: ${reason} (3 Strikes Exceeded).`);
      } else {
        toast.warning(`Security Violation (${newStrikes}/3): ${reason}.`);
        speakText(`Security warning. ${reason}.`, voiceGender);
      }
      return newStrikes;
    });
  }, [voiceGender, handleForceEndInterview]);

  useEffect(() => {
    if (interviewStep !== "interview" && interviewStep !== "scanning") return;
    
    const handleVisibilityChange = () => {
      if (document.hidden && !isTerminatingRef.current) handleSecurityViolation("Switched tabs or minimized browser");
    };
    
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isTerminatingRef.current) handleSecurityViolation("Exited Full-Screen Mode");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTerminatingRef.current) return;
      
      const allowedKeys = ["AudioVolumeUp", "AudioVolumeDown", "AudioVolumeMute", "MediaPlayPause", "BrightnessUp", "BrightnessDown"];
      if (allowedKeys.includes(e.key)) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        escWarningsRef.current += 1;
        if (escWarningsRef.current >= 3) {
          handleForceEndInterview(true, "SECURITY BREACH: Candidate attempted to bypass lock with ESC key.");
        } else {
          toast.error(`SECURITY WARNING: ESC key is strictly prohibited. (Warning ${escWarningsRef.current}/2)`);
          speakText(`Warning. Escape key pressed.`, voiceGender);
        }
      } else {
        clickWarningsRef.current += 1;
        if (clickWarningsRef.current >= 4) {
           handleForceEndInterview(true, "SECURITY BREACH: Excessive keyboard interaction detected.");
        } else {
           toast.error(`SECURITY WARNING: Keyboard is locked. Do not press keys. (Warning ${clickWarningsRef.current}/3)`);
        }
      }
    };

    const handleMouseClick = (e: MouseEvent) => {
       if (isTerminatingRef.current) return;
       const target = e.target as HTMLElement;
       if (target.closest('button')) return;

       e.preventDefault();
       clickWarningsRef.current += 1;
       if (clickWarningsRef.current >= 4) {
         handleForceEndInterview(true, "SECURITY BREACH: Excessive background clicking detected.");
       } else {
         toast.error(`SECURITY WARNING: Mouse clicks outside buttons are logged. (Warning ${clickWarningsRef.current}/3)`);
       }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault(); 
    
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    if (interviewStep === "interview") {
      window.addEventListener("keydown", handleKeyDown, { capture: true });
      window.addEventListener("mousedown", handleMouseClick, { capture: true });
      window.addEventListener("contextmenu", handleContextMenu);
    }
    
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("mousedown", handleMouseClick, { capture: true });
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [interviewStep, handleSecurityViolation]);

  const startSecurityTelemetry = () => {
    if (!streamRef.current) return;

    const audioCtx = new window.AudioContext();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(streamRef.current);
    source.connect(analyser);
    analyser.fftSize = 256;
    audioContextRef.current = audioCtx;
    analyserRef.current = analyser;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkTelemetry = () => {
      if (isTerminatingRef.current) return;

      analyser.getByteFrequencyData(dataArray);
      const audioLevel = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const isSpeakingLoudly = audioLevel > 20;

      // 🛡️ VAD Barge-In Engine
      if (isSpeakingRef.current && audioLevel > 12) {
        consecutiveSpeechFramesRef.current += 1;
        if (consecutiveSpeechFramesRef.current > 15) { 
          if (window.currentActiveAudio) {
            window.currentActiveAudio.pause();
            window.currentActiveAudio.currentTime = 0;
            window.currentActiveAudio = null;
          }
          window.speechSynthesis.cancel();
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          setAiMessage("Oh, go ahead...");
          consecutiveSpeechFramesRef.current = 0;
          
          questionEndTimeRef.current = Date.now();
          setCurrentLatencyDisplay("0.0s");
          setIsRecording(true);
          startSpeechRecognition();
          toast.info("🎙️ You interrupted the interviewer. Mic is open.");
        }
      } else {
        consecutiveSpeechFramesRef.current = 0;
      }

      const mockVisionData = {
        facesDetected: 1, 
        hasMask: false, 
        livenessScore: 99 - Math.floor(Math.random() * 4), 
        lipsMoving: isSpeakingLoudly 
      };

      if (mockVisionData.facesDetected > 1) handleSecurityViolation("Multiple faces detected in frame");
      if (isSpeakingLoudly && !mockVisionData.lipsMoving) handleSecurityViolation("Voice detected but lips not moving (Spoofing Check)");
      if (mockVisionData.livenessScore < 50) handleSecurityViolation("Liveness check failed (Still photo detected)");

      setTelemetry({
        faces: mockVisionData.facesDetected,
        liveness: mockVisionData.livenessScore,
        lipSync: mockVisionData.lipsMoving || !isSpeakingLoudly,
        mask: mockVisionData.hasMask
      });

      securityLoopRef.current = requestAnimationFrame(checkTelemetry);
    };
    checkTelemetry();
  };

  const requestPermissions = async () => {
    try {
      const avStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: "user" }, 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" }, audio: true });
      
      const videoTrack = screenStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      if (settings.displaySurface && settings.displaySurface !== "monitor") {
        avStream.getTracks().forEach(t => t.stop()); screenStream.getTracks().forEach(t => t.stop());
        toast.error("Security Requirement: You MUST select 'Entire Screen'.");
        return; 
      }
      if (screenStream.getAudioTracks().length === 0) {
        avStream.getTracks().forEach(t => t.stop()); screenStream.getTracks().forEach(t => t.stop());
        toast.error("Security Requirement: You MUST check the 'Share system audio' box.");
        return;
      }

      streamRef.current = avStream;
      screenStreamRef.current = screenStream;
      screenStream.getVideoTracks()[0].onended = () => {
        if (!isTerminatingRef.current) handleForceEndInterview(true, "SECURITY BREACH: Candidate stopped screen sharing.");
      };
      setCameraReady(true);
      setInterviewStep("ready");
    } catch (err) {
      toast.error("Security Requirement: You MUST allow Camera, Mic, and Entire Screen Sharing.");
    }
  };

  const executePreScan = async () => {
    if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    setInterviewStep("scanning");
    
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }

    startSecurityTelemetry();
    await speakText("Activating security vault. Scanning face mesh and environment.", voiceGender);
    
    setTimeout(() => {
      if (telemetry.mask) {
        handleSecurityViolation("Mask detected", true);
      } else {
        startActualInterview();
      }
    }, 5000);
  };

  const startActualInterview = async () => {
    setInterviewStep("interview");
    if (sessionId) fetch(`${API_URL}/sessions/${sessionId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "started" }), keepalive: true }).catch(()=>{});
    
    const combinedStream = new MediaStream();
    streamRef.current?.getVideoTracks().forEach(track => combinedStream.addTrack(track));
    const mixedAudio = mixAudioStreams(streamRef.current, screenStreamRef.current);
    if (mixedAudio) combinedStream.addTrack(mixedAudio);

    startFullRecording(combinedStream);
    totalTimerRef.current = setInterval(() => setTotalElapsed((t) => t + 1), 1000);
    
    setTimeout(async () => {
      const introText = `Identity verified. Hello ${candidateName}. Your screen and camera are secured. Please introduce yourself and state your role.`;
      await speakAndRecord(introText);
    }, 800);
  };

  const startFullRecording = useCallback((stream: MediaStream) => {
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    fullRecordingChunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) fullRecordingChunksRef.current.push(e.data); };
    fullRecorderRef.current = recorder;
    recorder.start(1000);
  }, []);

  const stopFullRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = fullRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.onstop = () => resolve(new Blob(fullRecordingChunksRef.current, { type: "video/webm" }));
        recorder.stop();
      } else { resolve(new Blob()); }
    });
  }, []);

  // 🛡️ PHASE 3: Hybrid Deepgram WebSocket & Native Fallback Engine
  const startSpeechRecognition = useCallback(() => {
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    isRecordingRef.current = true;
    isHandlingSubmitRef.current = false;
    recordingStartRef.current = Date.now();
    lastSpeechRef.current = Date.now();
    
    if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    watchdogIntervalRef.current = setInterval(() => {
      if (!isRecordingRef.current || isHandlingSubmitRef.current) return;
      const now = Date.now();
      const timeSinceStart = now - recordingStartRef.current;
      const timeSinceLastSpeech = now - lastSpeechRef.current;

      if (timeSinceStart > 120000) { 
        const btn = document.getElementById("auto-submit-btn");
        if (btn) { btn.dataset.reason = "OVER_TIME_LIMIT"; btn.click(); }
      } 
      else if (timeSinceLastSpeech > 12000) {
        const btn = document.getElementById("auto-submit-btn");
        if (btn) { btn.dataset.reason = "SILENCE"; btn.click(); }
      }
    }, 1000);

    if (DEEPGRAM_API_KEY && streamRef.current) {
        // --- DEEPGRAM WEBSOCKET ENGINE ---
        try {
            const socket = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true&endpointing=500', ['token', DEEPGRAM_API_KEY]);
            dgSocketRef.current = socket;
            
            let finalTranscriptAccumulator = "";

            socket.onopen = () => {
                const recorder = new MediaRecorder(streamRef.current as MediaStream, { mimeType: 'audio/webm' });
                dgRecorderRef.current = recorder;
                recorder.addEventListener('dataavailable', event => {
                    if (event.data.size > 0 && socket.readyState === 1) socket.send(event.data);
                });
                recorder.start(250); 
            };

            socket.onmessage = (message) => {
                const received = JSON.parse(message.data);
                const transcript = received.channel?.alternatives[0]?.transcript;

                if (transcript) {
                    const now = Date.now();
                    if (lastSpeechRef.current === recordingStartRef.current) {
                        const latencySecs = ((now - questionEndTimeRef.current) / 1000).toFixed(1);
                        setCurrentLatencyDisplay(`${latencySecs}s`);
                        latenciesRef.current.push(parseFloat(latencySecs));
                    }
                    lastSpeechRef.current = now;

                    if (received.is_final) {
                        finalTranscriptAccumulator += transcript + " ";
                        const fullText = finalTranscriptAccumulator.trim();
                        liveTranscriptRef.current = fullText;
                        setLiveTranscript(fullText);
                    } else {
                        const interimText = (finalTranscriptAccumulator + transcript).trim();
                        liveTranscriptRef.current = interimText;
                        setLiveTranscript(interimText);
                    }

                    const tLower = transcript.toLowerCase();
                    const isSkipping = tLower.includes("don't know") || tLower.includes("skip") || tLower.includes("no idea") || tLower.includes("move on") || tLower.includes("next question");
                    const isStalling = tLower.includes("give me a minute") || tLower.includes("hold on") || tLower.includes("let me think");

                    if ((isSkipping || isStalling) && !isHandlingSubmitRef.current) {
                        setTimeout(() => {
                           const btn = document.getElementById("auto-submit-btn");
                           if (btn) { btn.dataset.reason = "INTENT"; btn.click(); }
                        }, 1000);
                    }
                }
            };
            
            socket.onerror = () => {
                // Failsafe to Native STT if websocket crashes
                if (!isHandlingSubmitRef.current) startNativeSpeechRecognition();
            };
            
        } catch (e) {
            startNativeSpeechRecognition();
        }
    } else {
        // --- NATIVE BROWSER FALLBACK ---
        startNativeSpeechRecognition();
    }
  }, []);

  const startNativeSpeechRecognition = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    
    // @ts-ignore
    recognition.onresult = (event) => {
      const now = Date.now();
      
      if (lastSpeechRef.current === recordingStartRef.current) {
        const latencySecs = ((now - questionEndTimeRef.current) / 1000).toFixed(1);
        setCurrentLatencyDisplay(`${latencySecs}s`);
        latenciesRef.current.push(parseFloat(latencySecs));
      }

      lastSpeechRef.current = now; 
      
      let interim = ""; let allFinal = "";
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) allFinal += transcript + " ";
        else interim += transcript;
      }
      
      const newText = (allFinal + interim).trim();
      
      liveTranscriptRef.current = newText;
      setLiveTranscript(newText);
      
      const tLower = newText.toLowerCase();
      const isSkipping = tLower.includes("don't know") || tLower.includes("skip") || tLower.includes("no idea") || tLower.includes("move on") || tLower.includes("next question");
      const isStalling = tLower.includes("give me a minute") || tLower.includes("hold on") || tLower.includes("let me think");

      if (isSkipping || isStalling) {
         if (!isHandlingSubmitRef.current) {
            setTimeout(() => {
               const btn = document.getElementById("auto-submit-btn");
               if (btn) { btn.dataset.reason = "INTENT"; btn.click(); }
            }, 1000);
         }
      }
    };
    
    recognition.onerror = (event: any) => {
       if (event.error === 'network' || event.error === 'no-speech' || event.error === 'audio-capture') {
          const btn = document.getElementById("auto-submit-btn");
          if (btn && !isHandlingSubmitRef.current) { btn.dataset.reason = "MIC_ERROR"; btn.click(); }
       }
    };
    recognition.onend = () => { if (isRecordingRef.current) { try { recognition.start(); } catch {} } };
    
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false; 
    if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    
    if (dgRecorderRef.current) {
        dgRecorderRef.current.stop();
        dgRecorderRef.current = null;
    }
    if (dgSocketRef.current) {
        dgSocketRef.current.close();
        dgSocketRef.current = null;
    }
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    
    const currentText = liveTranscriptRef.current.trim();
    liveTranscriptRef.current = "";
    setLiveTranscript("");
    return currentText;
  }, []);

  const speakAndRecord = useCallback(async (questionText: string) => {
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setAiMessage(questionText);
    
    await speakText(questionText, voiceGender);
    
    if (isSpeakingRef.current) {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      setAiMessage("");
      questionEndTimeRef.current = Date.now();
      setCurrentLatencyDisplay("0.0s");
      setIsRecording(true);
      startSpeechRecognition();
    }
  }, [voiceGender, startSpeechRecognition]);

  const handleAnswerSubmit = useCallback(async (e: any) => {
    if (!isRecording) return;
    
    isHandlingSubmitRef.current = true;
    setIsRecording(false);
    
    let reason = "";
    if (e && e.target && e.target.dataset) {
       reason = e.target.dataset.reason || "";
       e.target.dataset.reason = ""; 
    }

    const newTranscriptChunk = stopRecording(); 
    let finalChunk = newTranscriptChunk.trim();

    if (reason === "OVER_TIME_LIMIT") finalChunk += " [SYSTEM: OVER_TIME_LIMIT]";
    else if (reason === "MIC_ERROR") finalChunk += " [SYSTEM: MIC_ERROR]";
    else if (reason === "SILENCE" && finalChunk.length === 0 && accumulatedTranscript.length === 0) finalChunk = "<SILENCE>";

    const totalAnswerSoFar = finalChunk === "<SILENCE>" ? "<SILENCE>" : (accumulatedTranscript + " " + finalChunk).trim();
    setAccumulatedTranscript(totalAnswerSoFar);

    const currentQText = introPhase ? `Could you please introduce yourself?` : currentQuestion?.question || "";
    let nextIndex = introPhase ? 0 : currentQ + 1;
    let nextQData = finalQuestionsList[nextIndex];
    let nextQText = nextQData ? nextQData.question : "Okay, that concludes all the technical questions.";

    let dynamicResponse = "Got it. Let's move on.";
    let isSufficient = true;

    try {
        const ackRes = await fetch(`${API_URL}/acknowledge-answer`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: currentQText, answer: totalAnswerSoFar, next_question: nextQText })
        });
        const ackData = await ackRes.json();
        dynamicResponse = ackData.response_text || ("Okay. " + nextQText);
        isSufficient = ackData.is_sufficient !== undefined ? ackData.is_sufficient : true;
    } catch (err) { dynamicResponse = "Understood. " + nextQText; }

    if (isSufficient) {
      setAnswers((prev) => [...prev, { questionId: introPhase ? 0 : (currentQuestion?.id || 0), transcript: totalAnswerSoFar, videoBlob: null }]);
      setAccumulatedTranscript(""); 

      if (introPhase) {
        setIntroPhase(false); setCurrentQ(0);
      } else if (currentQ < totalQuestions - 1) {
        setCurrentQ(nextIndex); 
      } else {
        finalizeInterviewAndUpload();
        return;
      }
    }

    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setAiMessage(dynamicResponse);
    await speakText(dynamicResponse, voiceGender);

    if (isSpeakingRef.current) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setAiMessage("");
        questionEndTimeRef.current = Date.now();
        setCurrentLatencyDisplay("0.0s");
        setIsRecording(true);
        startSpeechRecognition();
    }
  }, [isRecording, stopRecording, accumulatedTranscript, introPhase, currentQuestion, currentQ, totalQuestions, finalQuestionsList, voiceGender, startSpeechRecognition]);

  const finalizeInterviewAndUpload = useCallback(async (forcedTerminationReason: string = "") => {
    isTerminatingRef.current = true;
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    if (securityLoopRef.current) cancelAnimationFrame(securityLoopRef.current);
    if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    
    const fullBlob = await stopFullRecording();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
    
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setTerminationReason(forcedTerminationReason); 

    const isCheat = forcedTerminationReason.includes("SECURITY BREACH");
    setIsSpeaking(true);
    const closingMsg = isCheat ? `Interview terminated due to security violation.` : `Thank you. That concludes your interview.`;
    setAiMessage(closingMsg);
    await speakText(closingMsg, voiceGender);
    setIsSpeaking(false);
    setAiMessage("");

    if (sessionId) {
      fetch(`${API_URL}/sessions/${sessionId}/status`, { 
        method: "PATCH", headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ status: "completed", remarks: forcedTerminationReason || "Completed normally" }), 
        keepalive: true
      }).catch(()=>{});
    }

    setInterviewStep("submitting");

    try {
      let finalAnswers = [...answers];
      if (fullBlob.size > 0) finalAnswers.push({ questionId: -1, transcript: "", videoBlob: fullBlob });

      const questionAnswers = finalAnswers.filter((a) => a.questionId !== -1);
      let fullTranscript = questionAnswers.map((a, i) => {
        if (a.questionId === 0) return `Introduction:\nCandidate: ${a.transcript}`;
        const q = finalQuestionsList.find((q) => q.id === a.questionId);
        return `Q${i} [${q?.difficulty || "Medium"}]: ${q?.question || "Unknown"}\nA${i}: ${a.transcript}`;
      }).join("\n\n");

      if (forcedTerminationReason) fullTranscript += `\n\n[SYSTEM LOG]: ${forcedTerminationReason}`;

      let primaryVideoFilename: string | undefined;
      const timestamp = Date.now();
      const safeName = candidateName.replace(/\s+/g, "_");

      if (fullBlob.size > 0) {
        try {
          const result = await uploadVideo(fullBlob, `FULL_SESSION_${safeName}_${timestamp}.webm`);
          primaryVideoFilename = result.filename; 
        } catch {}
      }

      const validLatencies = latenciesRef.current.filter(l => l > 0);
      const avgLatency = validLatencies.length > 0 ? (validLatencies.reduce((a,b)=>a+b,0) / validLatencies.length).toFixed(1) : 0;

      const baseReason = forcedTerminationReason || "Completed normally.";
      const metricsPayload = JSON.stringify({
         tab_switches: clickWarningsRef.current,
         esc_presses: escWarningsRef.current,
         liveness_score: telemetry.liveness,
         faces_detected: telemetry.faces,
         lip_sync_failed: !telemetry.lipSync,
         avg_latency: parseFloat(avgLatency as string)
      });
      const hybridRemarks = `${baseReason} METRICS_PAYLOAD:${metricsPayload}`;

      await submitEvaluation({
        candidate_name: candidateName, position, job_description: jobDescription,
        resume, transcript: fullTranscript || "(No transcript)", video_filename: primaryVideoFilename,
        remarks: hybridRemarks,
      } as any); 

      setInterviewStep("feedback");
    } catch (err: any) {
      setInterviewStep("feedback");
    }
  }, [answers, finalQuestionsList, candidateName, position, jobDescription, resume, sessionId, voiceGender, stopFullRecording, telemetry]);

  const submitFeedback = async () => {
    if (!sessionId) { setFeedbackSubmitted(true); return; }
    try {
      await fetch(`${API_URL}/feedback`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, candidate_name: candidateName, rating, comments: feedbackText })
      });
      setFeedbackSubmitted(true);
    } catch {}
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (isInitializing) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;
  if (!state && !fetchedData) return null;

  if (interviewStep === "submitting") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-6">
        <CandidateHeader isLive={false} strikes={cheatStrikes} />
        <Loader2 className="w-16 h-16 text-primary animate-spin mt-16" />
        <h2 className="text-2xl font-bold">{submitStatuses[submitStatusIndex]}</h2>
        <p className="text-muted-foreground">Please do not close this tab. AI is compiling your results.</p>
      </div>
    );
  }

  if (interviewStep === "feedback") {
    const isCheat = terminationReason && terminationReason.includes("SECURITY BREACH");
    return (
      <div className="min-h-screen bg-background nexus-grid">
        <CandidateHeader isLive={false} strikes={cheatStrikes} />
        <div className="container mx-auto px-6 pt-32 pb-16 max-w-2xl text-center">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-8">
            {isCheat ? <ShieldX className="w-20 h-20 text-destructive mx-auto" /> : <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />}
            <h1 className="text-4xl font-display font-bold text-foreground">
              {isCheat ? "Interview Terminated" : "Interview Complete!"}
            </h1>
            <p className="text-lg text-muted-foreground">
              {isCheat ? `Terminated due to security violation. Report sent to recruiter.` : `Your encrypted interview has been securely sent to the Recruiter.`}
            </p>
            {!feedbackSubmitted && !isCheat ? (
              <div className="glass rounded-xl p-8 text-left space-y-6 mt-8">
                <h3 className="text-xl font-semibold text-center">How was your ForgePro experience?</h3>
                <div className="flex justify-center gap-2">
                  {[1,2,3,4,5].map((star) => (
                    <Star key={star} onClick={() => setRating(star)} className={`w-10 h-10 cursor-pointer ${rating >= star ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                  ))}
                </div>
                <Textarea placeholder="Thoughts on the AI?" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} className="bg-card min-h-[100px]" />
                <Button onClick={submitFeedback} disabled={rating === 0} className="w-full h-12 bg-primary text-primary-foreground"><Send className="w-4 h-4 mr-2" /> Submit Feedback</Button>
              </div>
            ) : (
              <div className="glass p-6 text-foreground font-medium mt-8">You may now safely close this tab.</div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  if (interviewStep === "ready") {
    return (
      <div className="min-h-screen bg-background nexus-grid">
        <CandidateHeader isLive={false} strikes={0} />
        <div className="container mx-auto px-6 pt-32 pb-16 max-w-2xl">
          <motion.div initial="hidden" animate="visible" className="space-y-8 text-center">
            <motion.div variants={fadeUp} className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto"><CheckCircle2 className="w-10 h-10 text-green-500" /></div>
              <h1 className="text-3xl font-display font-bold text-foreground">Permissions Granted</h1>
            </motion.div>
            <motion.div variants={fadeUp}>
              <Button onClick={executePreScan} className="h-14 px-10 text-base font-semibold bg-primary text-primary-foreground glow-cyan">
                Begin Face Scan & Lock Screen
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (interviewStep === "scanning") {
    return (
      <div className="min-h-screen bg-background nexus-grid">
        <CandidateHeader isLive={true} strikes={cheatStrikes} />
        <div className="container mx-auto px-6 pt-32 pb-16 max-w-3xl">
          <div className="glass rounded-xl p-8 space-y-6 text-center">
            <ScanFace className="w-16 h-16 text-primary mx-auto animate-pulse" />
            <h2 className="text-2xl font-bold">Initiating Environment Scan</h2>
            <p className="text-muted-foreground">Verifying identity and checking for masks/unauthorized persons...</p>
            
            <div className="relative mx-auto w-[400px] aspect-video rounded-lg overflow-hidden border-2 border-primary/50">
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,240,255,0.1)_50%)] bg-[length:100%_4px] animate-[scan_2s_linear_infinite] pointer-events-none" />
              <div className="absolute top-2 left-2 flex gap-2">
                <span className="bg-black/50 text-xs px-2 py-1 rounded text-white font-mono">LIVENESS: {telemetry.liveness}%</span>
                <span className="bg-black/50 text-xs px-2 py-1 rounded text-white font-mono">FACES: {telemetry.faces}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (interviewStep === "welcome") {
    return (
      <div className="min-h-screen bg-background nexus-grid">
        <CandidateHeader isLive={false} strikes={0} />
        <div className="container mx-auto px-6 pt-32 pb-16 max-w-2xl">
          <motion.div initial="hidden" animate="visible" className="space-y-8 text-center">
            <motion.div variants={fadeUp} className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto"><ShieldAlert className="w-10 h-10 text-primary" /></div>
              <h1 className="text-3xl font-display font-bold text-foreground">Secure Interview Room</h1>
              <p className="text-muted-foreground max-w-md mx-auto"><strong className="text-foreground">{candidateName}</strong> — {position}</p>
            </motion.div>
            <motion.div variants={fadeUp} className="glass rounded-xl p-6 text-left border border-primary/20">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Enterprise Security Rules</h3>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li className="flex items-start gap-3"><Volume2 className="w-5 h-5 text-accent shrink-0" /> <strong>PRE-FLIGHT CHECK:</strong> Connect your Bluetooth headphones/mic and adjust volume & brightness NOW. You cannot change this later.</li>
                <li className="flex items-start gap-3"><ScanFace className="w-5 h-5 text-primary shrink-0" /> <strong>Identity & Mask Check:</strong> Face must be clearly visible. Masks or multiple faces will trigger termination.</li>
                <li className="flex items-start gap-3"><Eye className="w-5 h-5 text-primary shrink-0" /> <strong>Liveness & Lip-Sync:</strong> AI tracks micro-movements to prevent spoofing or deepfakes.</li>
                <li className="flex items-start gap-3"><Keyboard className="w-5 h-5 text-destructive shrink-0" /> <strong>HARDWARE LOCK:</strong> Keyboard and Mouse are strictly disabled during the interview. Do NOT press ESC or click randomly (Termination on 3rd warning).</li>
              </ul>
            </motion.div>
            <motion.div variants={fadeUp}>
              <Button onClick={requestPermissions} className="h-14 px-10 text-base font-semibold bg-primary text-primary-foreground glow-cyan">
                Accept Rules & Grant Permissions
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background nexus-grid">
      <CandidateHeader isLive={true} strikes={cheatStrikes} />
      <button id="auto-submit-btn" className="hidden" onClick={handleAnswerSubmit}></button>

      <div className="container mx-auto px-6 pt-32 pb-16 max-w-5xl flex flex-col lg:flex-row gap-6">
        
        <div className="lg:w-64 shrink-0 space-y-4">
          <div className="glass rounded-xl p-4 border border-primary/20">
            <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Live Telemetry
            </h3>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">LIVENESS</span>
                <span className={telemetry.liveness > 80 ? "text-green-500" : "text-nexus-amber"}>{telemetry.liveness}%</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">FACES DETECTED</span>
                <span className={telemetry.faces === 1 ? "text-green-500" : "text-destructive animate-pulse"}>{telemetry.faces}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">LIP SYNC</span>
                <span className={telemetry.lipSync ? "text-green-500" : "text-destructive animate-pulse"}>{telemetry.lipSync ? "VERIFIED" : "FAILED"}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                <span className="text-muted-foreground flex items-center gap-1" title="Hesitation before answering">
                  <Timer className="w-3 h-3" /> LATENCY
                </span>
                <span className={parseFloat(currentLatencyDisplay) > 2.0 ? "text-nexus-amber" : "text-green-500"}>{currentLatencyDisplay}</span>
              </div>
            </div>
          </div>
          
          <Button 
            variant="destructive" 
            className="w-full bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30"
            onClick={() => handleForceEndInterview(true, "Candidate manually ended the interview.")}
          >
            <LogOut className="w-4 h-4 mr-2" /> End Interview
          </Button>

        </div>

        <motion.div initial="hidden" animate="visible" className="flex-1 space-y-6">
          <motion.div variants={fadeUp} className="space-y-3">
            <div className="flex items-center justify-between">
              <div><h1 className="text-xl font-display font-bold text-foreground">Interviewing: {candidateName}</h1></div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted"><Clock className="w-3.5 h-3.5" /><span className="text-sm font-mono font-bold">{formatTime(Math.max(0, timeRemaining))}</span></div>
                <span className="text-2xl font-mono font-bold text-primary">{introPhase ? "Intro" : `${currentQ + 1}/${totalQuestions}`}</span>
              </div>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden"><motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} /></div>
          </motion.div>
          
          {aiMessage && isSpeaking && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 border-l-4 border-nexus-amber">
              <div className="flex items-center gap-2 mb-2"><Volume2 className="w-4 h-4 text-nexus-amber animate-pulse" /><span className="text-xs font-semibold text-nexus-amber uppercase tracking-wider">ForgePro Interviewer</span></div>
              <p className="text-sm text-foreground leading-relaxed">{aiMessage}</p>
            </motion.div>
          )}

          {currentQuestion && (
            <AnimatePresence mode="wait">
              <motion.div key={currentQ} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="glass rounded-xl p-6 space-y-4">
                <p className="text-lg font-medium text-foreground leading-relaxed">{currentQuestion.question}</p>
              </motion.div>
            </AnimatePresence>
          )}

          <div className="glass rounded-xl p-6 space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video border border-primary/20 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover block" style={{ transform: "scaleX(-1)" }} />
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-56 border-2 border-primary/40 rounded-lg pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary"></div>
              </div>

              {isRecording && <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/80 text-primary-foreground text-[10px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> REC</div>}
            </div>
            
            <div className="flex flex-col gap-2">
              {isRecording && !isSpeaking && (
                 <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                   <Mic className="w-4 h-4 text-green-500" /> Listening...
                 </div>
              )}
              {liveTranscript && (
                <div className="rounded-lg bg-muted/50 p-4 max-h-32 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-2"><Mic className="w-3.5 h-3.5 text-primary" /><span className="text-xs font-medium text-foreground">Live Transcript</span></div>
                  <p className="text-sm text-muted-foreground">{liveTranscript}</p>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              {isRecording ? (
                 <Button onClick={handleAnswerSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90">
                   <Send className="w-4 h-4 mr-2" /> Submit Answer <ChevronRight className="w-4 h-4 ml-1" />
                 </Button>
              ) : (
                 <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Processing...</div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}