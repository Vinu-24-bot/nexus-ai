import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Mic, Video, Square, ChevronRight, Loader2,
  Brain, CheckCircle2, Volume2, Clock, ShieldAlert, Star, Send, ShieldX, ShieldCheck, MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitEvaluation, uploadVideo } from "@/lib/api";
import { toast } from "sonner";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000") + "/api";

interface InterviewQuestion { id: number; question: string; category: string; difficulty: string; }
interface LocationState { candidateName: string; position: string; jobDescription: string; resume: string; questions: InterviewQuestion[]; voiceGender: "female" | "male"; durationMinutes: number; }
interface AnswerRecord { questionId: number; transcript: string; videoBlob: Blob | null; }

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const CandidateHeader = ({ isLive }: { isLive: boolean }) => (
  <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
    <div className="container mx-auto px-6 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Brain className="w-6 h-6 text-primary" />
        <span className="font-display text-lg font-bold tracking-wider text-foreground">BATS GeniusHub</span>
      </div>
      {isLive ? (
        <div className="flex items-center gap-2 text-xs font-bold text-destructive animate-pulse tracking-widest">
          <span className="w-2 h-2 rounded-full bg-destructive" /> LIVE SESSION
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
  const premiumKeywords = ["neural", "premium", "google", "microsoft"];
  const femaleKeywords = ["female", "woman", "jenny", "samantha", "karen", "zira", "victoria"];
  const maleKeywords = ["male", "man", "guy", "david", "mark", "daniel", "james"];
  
  const targetKws = gender === "female" ? femaleKeywords : maleKeywords;
  const antiKws = gender === "female" ? maleKeywords : femaleKeywords;
  
  let bestMatch: SpeechSynthesisVoice | null = null;
  let highestScore = -1;

  for (const v of voices) {
    if (!v.lang.startsWith("en")) continue;
    const name = v.name.toLowerCase();
    if (antiKws.some(k => name.includes(k))) continue;
    let score = 0;
    if (targetKws.some(k => name.includes(k))) score += 2;
    if (premiumKeywords.some(k => name.includes(k))) score += 5; 
    if (score > highestScore) { highestScore = score; bestMatch = v; }
  }
  return bestMatch || voices.find(v => v.lang.startsWith("en")) || voices[0];
}

function speakText(text: string, gender: "female" | "male"): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getVoice(gender);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95; 
    utterance.pitch = gender === "female" ? 1.05 : 0.95;
    utterance.volume = 1;
    utterance.lang = "en-US";
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

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
  const [totalElapsed, setTotalElapsed] = useState(0);
  
  const [interviewStep, setInterviewStep] = useState<"welcome" | "ready" | "interview" | "submitting" | "feedback">("welcome");
  const [cameraReady, setCameraReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false); // UI State for "Candidate is thinking"
  
  const [cheatStrikes, setCheatStrikes] = useState(0);
  const [terminationReason, setTerminationReason] = useState("");
  
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const fullTranscriptRef = useRef("");
  const fullRecordingChunksRef = useRef<Blob[]>([]);
  const fullRecorderRef = useRef<MediaRecorder | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isTerminatingRef = useRef(false);

  const candidateName = state?.candidateName || fetchedData?.candidateName || "";
  const position = state?.position || fetchedData?.position || "";
  const jobDescription = state?.jobDescription || fetchedData?.jobDescription || "";
  const resume = state?.resume || fetchedData?.resume || "";
  const questions = state?.questions || fetchedData?.questions || [];
  const voiceGender = state?.voiceGender || fetchedData?.voiceGender || "female";
  const durationMinutes = state?.durationMinutes || fetchedData?.durationMinutes || 20;
  
  const totalQuestions = questions.length;
  const currentQuestion = introPhase ? null : (questions[currentQ] || null);
  const progress = totalQuestions > 0 ? (Math.max(0, currentQ) / totalQuestions) * 100 : 0;
  const timeRemaining = (durationMinutes * 60) - totalElapsed;

  useEffect(() => {
    if (sessionId && !state) {
      const fetchSessionDetails = async () => {
        try {
          const res = await fetch(`${API_URL}/sessions/${sessionId}`);
          if (!res.ok) throw new Error("Link expired");
          const session = await res.json();
          const qRes = await fetch(`${API_URL}/generate-questions`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_description: session.job_description, resume: session.resume_text, num_questions: 8, interview_level: session.interview_level || "L2 (Mid-Level)" })
          });
          const qData = await qRes.json();
          setFetchedData({ candidateName: session.candidate_name, position: session.position, jobDescription: session.job_description, resume: session.resume_text, questions: qData.questions, voiceGender: "female", durationMinutes: 20 });
        } catch (err) {
          toast.error("Invalid or expired session link.");
          navigate("/");
        } finally { setIsInitializing(false); }
      };
      fetchSessionDetails();
    }
  }, [sessionId, state, navigate]);

  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  useEffect(() => {
    if (timeRemaining <= 0 && interviewStep === "interview" && totalElapsed > 0) {
      handleForceEndInterview(false, "Time Expired.");
    }
  }, [timeRemaining, interviewStep, totalElapsed]);

  useEffect(() => {
    if (interviewStep === "interview" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [interviewStep, cameraReady]);

  useEffect(() => {
    if (interviewStep !== "interview") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || isTerminatingRef.current) return; 
      e.preventDefault(); 
      setCheatStrikes(prev => {
        const newStrikes = prev + 1;
        if (newStrikes >= 3) {
          handleForceEndInterview(true, "SECURITY BREACH: Candidate exceeded 3 keyboard warnings. Probable use of external AI typing tool.");
        } else {
          toast.warning(`Security Warning (${newStrikes}/3): Keyboard disabled. Use ONLY your mouse and voice.`);
        }
        return newStrikes;
      });
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isTerminatingRef.current) {
        handleForceEndInterview(true, "SECURITY BREACH: Candidate exited full-screen mode to access other applications.");
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden && !isTerminatingRef.current) {
        handleForceEndInterview(true, "SECURITY BREACH: Candidate minimized the window or switched tabs.");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [interviewStep]);

  const requestPermissions = async () => {
    try {
      const avStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" }, audio: true });
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" }, audio: false });
      const videoTrack = screenStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      if (settings.displaySurface && settings.displaySurface !== "monitor") {
        avStream.getTracks().forEach(t => t.stop());
        screenStream.getTracks().forEach(t => t.stop());
        toast.error("Security Requirement: You MUST select 'Entire Screen'. Tabs or Windows are not allowed.");
        return; 
      }
      streamRef.current = avStream;
      screenStreamRef.current = screenStream;
      screenStream.getVideoTracks()[0].onended = () => {
        if (interviewStep === "interview" && !isTerminatingRef.current) {
          handleForceEndInterview(true, "SECURITY BREACH: Candidate stopped sharing their screen mid-interview.");
        }
      };
      setCameraReady(true);
      setInterviewStep("ready");
    } catch (err) {
      toast.error("Security Requirement: You MUST allow Camera, Mic, and Entire Screen Sharing to proceed.");
    }
  };

  const lockAndStart = async () => {
    try {
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      setInterviewStep("interview");
      if (sessionId) {
        fetch(`${API_URL}/sessions/${sessionId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "started" }), keepalive: true }).catch(()=>{});
      }
      startFullRecording(streamRef.current!);
      totalTimerRef.current = setInterval(() => setTotalElapsed((t) => t + 1), 1000);
      setTimeout(async () => {
        const introText = `Hello ${candidateName}, welcome to your interview for the ${position} role. I'm your GeniusHub interviewer. Your screen and camera are now securely shared. Could you please introduce yourself?`;
        await speakAndRecord(introText);
      }, 800);
    } catch (err) { toast.error("Failed to enter Full Screen. Please click again."); }
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

  const startMediaRecorder = useCallback((stream: MediaStream) => {
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    chunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);
    setIsRecording(true);
  }, []);

  const startSpeechRecognition = useCallback(() => {
    fullTranscriptRef.current = "";
    setLiveTranscript("");
    setIsThinking(false);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    
    recognition.onresult = (event: any) => {
      setIsThinking(true);
      let interim = ""; let allFinal = "";
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) allFinal += transcript + " ";
        else interim += transcript;
      }
      fullTranscriptRef.current = allFinal.trim();
      setLiveTranscript((allFinal + interim).trim());
      
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      
      // UPGRADE: "Patience Engine" & Smart Intercepts
      const tLower = allFinal.toLowerCase();
      const isSkipping = tLower.includes("i don't know") || tLower.includes("skip") || tLower.includes("can't recall") || tLower.includes("don't want to");
      
      // If they explicitly give up, submit fast (1.5s). Otherwise, give them 12 seconds to think!
      const waitTime = isSkipping ? 1500 : 12000; 

      silenceTimerRef.current = setTimeout(() => {
        setIsThinking(false);
        const btn = document.getElementById("auto-submit-btn");
        if (btn) btn.click();
      }, waitTime); 
    };
    
    recognition.onerror = () => {};
    recognition.onend = () => { if (mediaRecorderRef.current?.state === "recording") { try { recognition.start(); } catch {} } };
    recognition.start();
    recognitionRef.current = recognition;
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise<{ blob: Blob; transcript: string }>((resolve) => {
      setIsThinking(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.onstop = () => { resolve({ blob: new Blob(chunksRef.current, { type: "video/webm" }), transcript: fullTranscriptRef.current.trim() || liveTranscript.trim() }); };
        recorder.stop();
      } else { resolve({ blob: new Blob(), transcript: fullTranscriptRef.current.trim() }); }
      setIsRecording(false);
    });
  }, [liveTranscript]);

  const speakAndRecord = useCallback(async (questionText: string) => {
    setIsSpeaking(true);
    setAiMessage(questionText);
    await speakText(questionText, voiceGender);
    setIsSpeaking(false);
    setAiMessage("");
    if (streamRef.current) {
      startMediaRecorder(streamRef.current);
      startSpeechRecognition();
      
      // UPGRADE: Wait up to 45 seconds for the candidate to speak their first word before timing out.
      silenceTimerRef.current = setTimeout(() => { 
        const btn = document.getElementById("auto-submit-btn"); 
        if (btn) btn.click(); 
      }, 45000); 
    }
  }, [voiceGender, startMediaRecorder, startSpeechRecognition]);

  const handleNextQuestion = useCallback(async () => {
    if (!isRecording) return;
    const { transcript } = await stopRecording(); 
    setLiveTranscript("");
    
    const hasAnswered = transcript.trim().length > 2;
    const tLower = transcript.toLowerCase();
    const wantsRepeat = tLower.includes("repeat") || tLower.includes("pardon") || (tLower.length < 25 && tLower.includes("sorry"));

    if (wantsRepeat && !introPhase && currentQuestion) {
      setIsSpeaking(true);
      const ackText = "Of course, let me repeat that for you. " + currentQuestion.question;
      setAiMessage(ackText);
      await speakText(ackText, voiceGender);
      setIsSpeaking(false);
      setAiMessage("");
      setTimeout(() => { speakAndRecord(currentQuestion.question); }, 300);
      return; 
    }

    setIsSpeaking(true);
    setAiMessage("Thinking..."); 
    const currentQText = introPhase ? `Could you please introduce yourself?` : currentQuestion?.question || "";
    
    let dynamicAck = "Got it. Let's move on.";
    if (hasAnswered) {
        try {
            const ackRes = await fetch(`${API_URL}/acknowledge-answer`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: currentQText, answer: transcript })
            });
            const ackData = await ackRes.json();
            dynamicAck = ackData.acknowledgment;
        } catch (err) {
            dynamicAck = "Thank you. Let's move on to the next one.";
        }
    } else {
        dynamicAck = "I didn't hear anything, but that's alright. Let's move ahead.";
    }

    if (introPhase) {
      setAnswers((prev) => [...prev, { questionId: 0, transcript: transcript || "(No speech detected)", videoBlob: null }]);
      setIntroPhase(false);
      setCurrentQ(0);

      setAiMessage(dynamicAck);
      await speakText(dynamicAck, voiceGender);
      setIsSpeaking(false);
      setAiMessage("");

      const nextQData = questions[0];
      if (nextQData) {
        setTimeout(() => { speakAndRecord(nextQData.question); }, 300);
      } else {
        finalizeInterviewAndUpload("Error: Questions array failed to load.");
      }
      return;
    }

    if (!currentQuestion) return;
    setAnswers((prev) => [...prev, { questionId: currentQuestion.id, transcript: transcript || "(No speech detected)", videoBlob: null }]);

    if (currentQ < totalQuestions - 1) {
      const nextIndex = currentQ + 1;
      setCurrentQ(nextIndex);

      setAiMessage(dynamicAck);
      await speakText(dynamicAck, voiceGender);
      setIsSpeaking(false);
      setAiMessage("");

      setTimeout(() => { speakAndRecord(questions[nextIndex].question); }, 300);
    } else {
      setAiMessage(dynamicAck);
      await speakText(dynamicAck, voiceGender);
      setIsSpeaking(false);
      setAiMessage("");
      finalizeInterviewAndUpload();
    }
  }, [isRecording, stopRecording, introPhase, currentQuestion, currentQ, totalQuestions, questions, speakAndRecord, candidateName, voiceGender]);

  const finalizeInterviewAndUpload = useCallback(async (forcedTerminationReason: string = "") => {
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    const fullBlob = await stopFullRecording();

    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);

    setTerminationReason(forcedTerminationReason); 

    const isCheat = forcedTerminationReason.includes("SECURITY BREACH");
    const isLeave = forcedTerminationReason.includes("Candidate left early");

    setIsSpeaking(true);
    const closingMsg = isCheat 
      ? `This interview has been terminated due to a security violation.` 
      : isLeave 
        ? `You have chosen to leave the interview early. Thank you for your time.`
        : `Thank you so much ${candidateName}. That concludes your interview. You may now leave feedback on the next screen.`;
    
    setAiMessage(closingMsg);
    await speakText(closingMsg, voiceGender);
    setIsSpeaking(false);
    setAiMessage("");

    if (sessionId) {
      fetch(`${API_URL}/sessions/${sessionId}/status`, { 
        method: "PATCH", headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ status: "completed" }), keepalive: true
      }).catch(()=>{});
    }

    setInterviewStep("submitting");

    try {
      let finalAnswers = [...answers];
      if (fullBlob.size > 0) finalAnswers.push({ questionId: -1, transcript: "", videoBlob: fullBlob });

      const questionAnswers = finalAnswers.filter((a) => a.questionId !== -1);
      const fullRecordingAnswer = finalAnswers.find((a) => a.questionId === -1);

      let fullTranscript = questionAnswers.map((a, i) => {
        if (a.questionId === 0) return `Introduction:\nCandidate: ${a.transcript}`;
        const q = questions.find((q) => q.id === a.questionId);
        return `Q${i} [${q?.difficulty}]: ${q?.question || "Unknown"}\nA${i}: ${a.transcript}`;
      }).join("\n\n");

      if (forcedTerminationReason) {
        fullTranscript += `\n\n[SYSTEM LOG]: ${forcedTerminationReason}`;
      }

      const timestamp = Date.now();
      const safeName = candidateName.replace(/\s+/g, "_");
      let primaryVideoFilename: string | undefined;

      if (fullRecordingAnswer?.videoBlob) {
        const fullFilename = `FULL_SESSION_${safeName}_${timestamp}.webm`;
        try {
          const result = await uploadVideo(fullRecordingAnswer.videoBlob, fullFilename);
          primaryVideoFilename = result.filename; 
        } catch {}
      }

      await submitEvaluation({
        candidate_name: candidateName, position, job_description: jobDescription,
        resume, transcript: fullTranscript || "(No transcript)", video_filename: primaryVideoFilename,
        remarks: forcedTerminationReason || "Completed normally without interruptions.",
      } as any); 

      setInterviewStep("feedback");
    } catch (err: any) {
      toast.error("An error occurred during background processing, but your interview is complete.");
      setInterviewStep("feedback");
    }
  }, [answers, questions, candidateName, position, jobDescription, resume, sessionId, voiceGender, stopFullRecording]);

  const handleForceEndInterview = async (isEarlyLeave = false, reason = "") => {
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;

    if (isRecording) {
      const { transcript } = await stopRecording();
      setAnswers(prev => [...prev, { questionId: introPhase ? 0 : (currentQuestion?.id || 0), transcript: transcript || "(Left early)", videoBlob: null }]);
    }
    finalizeInterviewAndUpload(reason || (isEarlyLeave ? "Candidate left early manually." : "Time Expired."));
  };

  const submitFeedback = async () => {
    if (!sessionId) {
      toast.success("Feedback recorded locally!");
      setFeedbackSubmitted(true);
      return;
    }
    try {
      await fetch(`${API_URL}/feedback`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, candidate_name: candidateName, rating, comments: feedbackText })
      });
      toast.success("Feedback submitted to Recruiter!");
      setFeedbackSubmitted(true);
    } catch {
      toast.error("Failed to submit feedback.");
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (isInitializing) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>;
  if (!state && !fetchedData) return null;

  if (interviewStep === "submitting") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-6">
        <CandidateHeader isLive={false} />
        <Loader2 className="w-16 h-16 text-primary animate-spin mt-16" />
        <h2 className="text-2xl font-bold">Securely Uploading Session</h2>
        <p className="text-muted-foreground">Please do not close this tab. The system is transmitting your encrypted session.</p>
      </div>
    );
  }

  if (interviewStep === "feedback") {
    const isCheat = terminationReason && terminationReason.includes("SECURITY BREACH");
    const isLeave = terminationReason && terminationReason.includes("Candidate left early");

    return (
      <div className="min-h-screen bg-background nexus-grid">
        <CandidateHeader isLive={false} />
        <div className="container mx-auto px-6 pt-32 pb-16 max-w-2xl text-center">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-8">
            
            {isCheat ? (
              <ShieldX className="w-20 h-20 text-destructive mx-auto" />
            ) : (
              <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
            )}
            
            <h1 className="text-4xl font-display font-bold text-foreground">
              {isCheat ? "Interview Terminated" : isLeave ? "Interview Ended Early" : "Interview Complete!"}
            </h1>
            
            <p className="text-lg text-muted-foreground">
              {isCheat 
                ? "This session was automatically terminated due to a security violation. A full incident report has been sent to the recruiter."
                : `Thank you for your time, ${candidateName}. Your encrypted interview has been securely sent directly to the Recruiter's Dashboard.`}
            </p>
            
            {!feedbackSubmitted && !isCheat ? (
              <div className="glass rounded-xl p-8 text-left space-y-6 mt-8">
                <h3 className="text-xl font-semibold text-center">How was your GeniusHub interview experience?</h3>
                <div className="flex justify-center gap-2">
                  {[1,2,3,4,5].map((star) => (
                    <Star key={star} onClick={() => setRating(star)} className={`w-10 h-10 cursor-pointer transition-colors ${rating >= star ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                  ))}
                </div>
                <Textarea placeholder="Any thoughts on the questions or behavior?" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} className="bg-card min-h-[100px]" />
                <Button onClick={submitFeedback} disabled={rating === 0} className="w-full h-12 bg-primary text-primary-foreground glow-cyan"><Send className="w-4 h-4 mr-2" /> Submit Feedback</Button>
              </div>
            ) : (
              <div className="glass p-6 text-foreground font-medium mt-8">
                {isCheat ? "You may now safely close this tab." : "Thank you for your feedback! You may now close this tab."}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  if (interviewStep === "ready") {
    return (
      <div className="min-h-screen bg-background nexus-grid">
        <CandidateHeader isLive={false} />
        <div className="container mx-auto px-6 pt-32 pb-16 max-w-2xl">
          <motion.div initial="hidden" animate="visible" className="space-y-8 text-center">
            <motion.div variants={fadeUp} className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto"><CheckCircle2 className="w-10 h-10 text-green-500" /></div>
              <h1 className="text-3xl font-display font-bold text-foreground">Permissions Granted</h1>
              <p className="text-muted-foreground max-w-md mx-auto">Your camera and screen share are successfully connected.</p>
            </motion.div>
            <motion.div variants={fadeUp} className="glass rounded-xl p-6 text-left border border-primary/20">
              <p className="text-sm text-muted-foreground text-center">
                Clicking the button below will securely lock your browser into Full Screen mode and immediately begin the interview. 
              </p>
            </motion.div>
            <motion.div variants={fadeUp}>
              <Button onClick={lockAndStart} className="h-14 px-10 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan">
                Lock Screen & Begin Interview
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (interviewStep === "welcome") {
    return (
      <div className="min-h-screen bg-background nexus-grid">
        <CandidateHeader isLive={false} />
        <div className="container mx-auto px-6 pt-32 pb-16 max-w-2xl">
          <motion.div initial="hidden" animate="visible" className="space-y-8 text-center">
            <motion.div variants={fadeUp} className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto"><ShieldAlert className="w-10 h-10 text-primary" /></div>
              <h1 className="text-3xl font-display font-bold text-foreground">Secure Interview Room</h1>
              <p className="text-muted-foreground max-w-md mx-auto"><strong className="text-foreground">{candidateName}</strong> — {position}</p>
            </motion.div>
            <motion.div variants={fadeUp} className="glass rounded-xl p-6 text-left border border-primary/20">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Enterprise Security Rules</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> <strong>Full Screen Lock:</strong> You will be forced into Full Screen. Exiting full screen terminates the interview instantly.</li>
                <li className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> <strong>Screen & Camera Enforced:</strong> You must share your entire screen. If you switch tabs, the interview terminates.</li>
                <li className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> <strong>Keyboard Disabled (3-Strikes):</strong> Do not touch your keyboard to access AI tools. 3 strikes and you are terminated.</li>
                <li className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> <strong>Hands-Free Flow:</strong> The AI will listen and wait for you to finish answering naturally.</li>
              </ul>
            </motion.div>
            <motion.div variants={fadeUp}>
              <Button onClick={requestPermissions} className="h-14 px-10 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan">
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
      <CandidateHeader isLive={true} />
      <button id="auto-submit-btn" className="hidden" onClick={handleNextQuestion}></button>

      <div className="container mx-auto px-6 pt-32 pb-16 max-w-4xl">
        <motion.div initial="hidden" animate="visible" className="space-y-6">
          <motion.div variants={fadeUp} className="space-y-3">
            <div className="flex items-center justify-between">
              <div><h1 className="text-xl font-display font-bold text-foreground">Interviewing: {candidateName}</h1><p className="text-sm text-muted-foreground">{position}</p></div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted"><Clock className="w-3.5 h-3.5" /><span className="text-sm font-mono font-bold">{formatTime(Math.max(0, timeRemaining))}</span><span className="text-[10px] opacity-60">left</span></div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted"><span className="text-sm font-mono font-bold">{formatTime(totalElapsed)}</span></div>
                <span className="text-2xl font-mono font-bold text-primary">{introPhase ? "Intro" : `${currentQ + 1}/${totalQuestions}`}</span>
              </div>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden"><motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} /></div>
          </motion.div>
          
          {aiMessage && isSpeaking && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 border-l-4 border-nexus-amber">
              <div className="flex items-center gap-2 mb-2"><Volume2 className="w-4 h-4 text-nexus-amber animate-pulse" /><span className="text-xs font-semibold text-nexus-amber uppercase tracking-wider">GeniusHub Interviewer</span></div>
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
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
              <video ref={videoRef} muted playsInline className={`w-full h-full object-cover ${cameraReady ? "block" : "hidden"}`} style={{ transform: "scaleX(-1)" }} />
              {isRecording && <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/80 text-primary-foreground text-[10px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> SESSION & SCREEN RECORDING</div>}
            </div>
            
            {/* UPGRADE: Clearer UI Feedback for "Thinking" vs "Listening" */}
            <div className="flex flex-col gap-2">
              {isRecording && !isSpeaking && (
                 <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                   {isThinking ? <MoreHorizontal className="w-4 h-4 text-primary" /> : <Mic className="w-4 h-4 text-green-500" />}
                   {isThinking ? "Thinking... (AI waiting to ensure you are done)" : "AI is listening. Speak your answer naturally..."}
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
              {isRecording ? <Button onClick={handleNextQuestion} className="bg-primary text-primary-foreground"><Square className="w-4 h-4 mr-2 fill-current" /> Manual Submit <ChevronRight className="w-4 h-4 ml-1" /></Button> : <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Preparing...</div>}
              <Button variant="outline" size="sm" onClick={() => handleForceEndInterview(true, "Candidate left early manually.")} className="text-xs border-destructive/30 text-destructive">Leave Interview</Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}