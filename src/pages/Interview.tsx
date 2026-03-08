import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Mic, Video, Square, ChevronRight, Loader2,
  Brain, CheckCircle2, AlertCircle, Volume2, Clock, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitEvaluation, uploadVideo, getAcknowledgment } from "@/lib/api";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

interface InterviewQuestion {
  id: number;
  question: string;
  category: string;
  difficulty: string;
}

interface LocationState {
  candidateName: string;
  position: string;
  jobDescription: string;
  resume: string;
  questions: InterviewQuestion[];
  voiceGender: "female" | "male";
  durationMinutes: number;
}

interface AnswerRecord {
  questionId: number;
  transcript: string;
  videoBlob: Blob | null;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const difficultyColor: Record<string, string> = {
  easy: "text-green-400 bg-green-400/10 border-green-400/20",
  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  hard: "text-red-400 bg-red-400/10 border-red-400/20",
};

const categoryColor: Record<string, string> = {
  technical: "text-primary bg-primary/10",
  behavioral: "text-nexus-purple bg-nexus-purple/10",
  situational: "text-nexus-amber bg-nexus-amber/10",
};

function getVoice(gender: "female" | "male"): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Prioritized keyword lists — order matters, first match wins
  const femaleKeywords = [
    "google uk english female", "google us english female",
    "samantha", "karen", "fiona", "victoria", "zira",
    "female", "woman",
  ];
  const maleKeywords = [
    "google uk english male", "google us english male",
    "david", "daniel", "james", "mark", "alex",
    "male", "man",
  ];

  const keywords = gender === "female" ? femaleKeywords : maleKeywords;
  const antiKeywords = gender === "female" ? maleKeywords : femaleKeywords;

  // Try to find a voice matching gender keywords that does NOT match the opposite gender
  for (const kw of keywords) {
    const match = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        v.name.toLowerCase().includes(kw) &&
        !antiKeywords.some((ak) => v.name.toLowerCase().includes(ak))
    );
    if (match) return match;
  }

  // Fallback: pick any English voice, prefer higher pitch for female / lower for male
  const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
  if (englishVoices.length > 1) {
    // Sort by name and pick first half for female, second half for male (heuristic)
    const sorted = [...englishVoices].sort((a, b) => a.name.localeCompare(b.name));
    const idx = gender === "female" ? 0 : sorted.length - 1;
    return sorted[idx];
  }
  return englishVoices[0] || voices[0];
}

function speakText(text: string, gender: "female" | "male"): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getVoice(gender);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.92;
    utterance.pitch = gender === "female" ? 1.1 : 0.9;
    utterance.volume = 1;
    utterance.lang = "en-US";
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export default function InterviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | undefined;

  const [currentQ, setCurrentQ] = useState(-1);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [introPhase, setIntroPhase] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [timeWarningShown, setTimeWarningShown] = useState(false);
  const [isWindingUp, setIsWindingUp] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const fullTranscriptRef = useRef("");
  const fullRecordingChunksRef = useRef<Blob[]>([]);
  const fullRecorderRef = useRef<MediaRecorder | null>(null);

  const questions = state?.questions || [];
  const candidateName = state?.candidateName || "";
  const position = state?.position || "";
  const jobDescription = state?.jobDescription || "";
  const resume = state?.resume || "";
  const voiceGender = state?.voiceGender || "female";
  const durationMinutes = state?.durationMinutes || 20;
  const totalQuestions = questions.length;
  const currentQuestion = introPhase ? null : (questions[currentQ] || null);
  const progress = totalQuestions > 0 ? ((Math.max(0, currentQ) + (interviewComplete ? 1 : 0)) / totalQuestions) * 100 : 0;

  // Time remaining
  const totalSeconds = durationMinutes * 60;
  const timeRemaining = totalSeconds - totalElapsed;
  const timeWarningThreshold = 120; // 2 minutes warning

  useEffect(() => {
    if (!state) navigate("/evaluate");
  }, [state, navigate]);

  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Time warning check
  useEffect(() => {
    if (timeRemaining <= timeWarningThreshold && timeRemaining > 0 && !timeWarningShown && interviewStarted && !interviewComplete) {
      setTimeWarningShown(true);
      setIsWindingUp(true);
    }
  }, [timeRemaining, timeWarningShown, interviewStarted, interviewComplete]);

  // Auto-end when time runs out
  useEffect(() => {
    if (timeRemaining <= 0 && interviewStarted && !interviewComplete && totalElapsed > 0 && !isSubmitting) {
      handleForceEndInterview(false);
    }
  }, [timeRemaining, interviewStarted, interviewComplete, totalElapsed, isSubmitting]);

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      setCameraReady(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
      return stream;
    } catch (err) {
      toast.error("Please allow camera & microphone access to record.");
      throw err;
    }
  }, []);

  const startFullRecording = useCallback((stream: MediaStream) => {
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm",
    });
    fullRecordingChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) fullRecordingChunksRef.current.push(e.data);
    };
    fullRecorderRef.current = recorder;
    recorder.start(1000);
  }, []);

  const stopFullRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = fullRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.onstop = () => {
          const blob = new Blob(fullRecordingChunksRef.current, { type: "video/webm" });
          resolve(blob);
        };
        recorder.stop();
      } else {
        resolve(new Blob());
      }
    });
  }, []);

  const startMediaRecorder = useCallback((stream: MediaStream) => {
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm",
    });
    chunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);
    setIsRecording(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, []);

  const startSpeechRecognition = useCallback(() => {
    fullTranscriptRef.current = "";
    setLiveTranscript("");
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      let interim = "";
      let allFinal = "";
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          allFinal += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      // Accumulate: SpeechRecognition results array includes ALL results since start
      fullTranscriptRef.current = allFinal.trim();
      setLiveTranscript((allFinal + interim).trim());
      setIsTranscribing(true);
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      if (mediaRecorderRef.current?.state === "recording") {
        try { recognition.start(); } catch {}
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise<{ blob: Blob; transcript: string }>((resolve) => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      setIsTranscribing(false);
      if (timerRef.current) clearInterval(timerRef.current);
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          resolve({ blob, transcript: fullTranscriptRef.current.trim() || liveTranscript.trim() });
        };
        recorder.stop();
      } else {
        resolve({ blob: new Blob(), transcript: fullTranscriptRef.current.trim() });
      }
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
    }
  }, [voiceGender, startMediaRecorder, startSpeechRecognition]);

  const handleBeginInterview = useCallback(async () => {
    try {
      const stream = await openCamera();
      setInterviewStarted(true);

      // Start full session recording
      startFullRecording(stream);

      totalTimerRef.current = setInterval(() => setTotalElapsed((t) => t + 1), 1000);

      setTimeout(async () => {
        const introText = `Hello ${candidateName}, welcome to your interview for the ${position} role. I'm your AI interviewer today, and I'll be conducting a comprehensive interview with ${totalQuestions} questions that will progressively increase in difficulty. But first, I'd love to hear about you. Could you please introduce yourself? Tell me about your background, your experience, and what excites you about this ${position} role.`;
        await speakAndRecord(introText);
      }, 800);
    } catch {}
  }, [openCamera, candidateName, position, totalQuestions, speakAndRecord, startFullRecording]);

  const handleForceEndInterview = useCallback(async (isEarlyLeave = false) => {
    // Time's up or candidate left early - stop everything, upload, and auto-submit
    let partialAnswers = [...answers];

    if (isRecording) {
      const { blob, transcript } = await stopRecording();
      const newAnswer: AnswerRecord = {
        questionId: introPhase ? 0 : (currentQuestion?.id || 0),
        transcript: transcript || (isEarlyLeave ? "(Candidate left early - partial answer)" : "(Time expired - partial answer)"),
        videoBlob: blob.size > 0 ? blob : null,
      };
      partialAnswers = [...partialAnswers, newAnswer];
      setAnswers(partialAnswers);
    }

    if (totalTimerRef.current) clearInterval(totalTimerRef.current);

    // Stop full recording and get blob
    const fullBlob = await stopFullRecording();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraReady(false);
    }

    setIsSpeaking(true);
    const endMsg = isEarlyLeave
      ? `${candidateName}, it seems you need to leave early. No worries! We'll evaluate your responses up to this point. Thank you for your time!`
      : `${candidateName}, our interview time has come to an end. Thank you so much for your time and thoughtful answers. We'll now process your evaluation. Have a great day!`;
    setAiMessage(endMsg);
    await speakText(endMsg, voiceGender);
    setIsSpeaking(false);
    setAiMessage("");

    // Auto-upload recordings and submit evaluation
    setIsSubmitting(true);
    try {
      const questionAnswers = partialAnswers.filter((a) => a.questionId !== -1);
      const fullTranscript = questionAnswers
        .map((a, i) => {
          if (a.questionId === 0) return `Introduction:\nCandidate: ${a.transcript}`;
          const q = questions.find((q) => q.id === a.questionId);
          return `Q${i} [${q?.difficulty}/${q?.category}]: ${q?.question || "Unknown"}\nA${i}: ${a.transcript}`;
        })
        .join("\n\n");

      const timestamp = Date.now();
      const safeName = candidateName.replace(/\s+/g, "_");
      let videoFilenames: string[] = [];

      // Upload full session recording
      if (fullBlob.size > 0) {
        const fullFilename = `FULL_SESSION_${safeName}_${timestamp}.webm`;
        try {
          const result = await uploadVideo(fullBlob, fullFilename);
          videoFilenames.push(`[FULL] ${result.filename}`);
        } catch {}
      }

      // Upload per-question clips
      for (let i = 0; i < questionAnswers.length; i++) {
        if (questionAnswers[i].videoBlob) {
          const filename = `${safeName}_Q${i}_${timestamp}.webm`;
          try {
            const result = await uploadVideo(questionAnswers[i].videoBlob!, filename);
            videoFilenames.push(result.filename);
          } catch {}
        }
      }

      const evalResult = await submitEvaluation({
        candidate_name: candidateName,
        position,
        job_description: jobDescription,
        resume,
        transcript: fullTranscript || "(Interview ended early with minimal responses)",
        video_filename: videoFilenames.join(", ") || undefined,
      });

      toast.success("Partial interview evaluated & recordings saved!");
      navigate(`/result/${evalResult.id}`);
    } catch (err: any) {
      toast.error(err.message || "Auto-evaluation failed");
      setInterviewComplete(true);
      setIsSubmitting(false);
    }
  }, [answers, isRecording, stopRecording, introPhase, currentQuestion, candidateName, voiceGender, stopFullRecording, questions, position, jobDescription, resume, navigate]);

  const handleNextQuestion = useCallback(async () => {
    if (!isRecording) return;
    const { blob, transcript } = await stopRecording();
    setLiveTranscript("");
    setDuration(0);

    // Handle intro phase
    if (introPhase) {
      const introAnswer: AnswerRecord = {
        questionId: 0,
        transcript: transcript || "(No speech detected)",
        videoBlob: blob.size > 0 ? blob : null,
      };
      setAnswers((prev) => [...prev, introAnswer]);
      setIntroPhase(false);
      setCurrentQ(0);

      setIsSpeaking(true);
      let ackText = `Thank you for that wonderful introduction, ${candidateName}. It's great to learn about your background. Now let's dive into the interview questions. We'll start with some warm-up questions first.`;
      try {
        ackText = await getAcknowledgment("Please introduce yourself, your background, and what excites you about this role.", transcript);
        ackText += ` Great, now let's move on to the interview questions. We'll start with some warm-up questions.`;
      } catch {}

      setAiMessage(ackText);
      await speakText(ackText, voiceGender);
      setIsSpeaking(false);
      setAiMessage("");

      setTimeout(() => {
        if (questions[0]) speakAndRecord(questions[0].question);
      }, 300);
      return;
    }

    if (!currentQuestion) return;
    const newAnswer: AnswerRecord = {
      questionId: currentQuestion.id,
      transcript: transcript || "(No speech detected)",
      videoBlob: blob.size > 0 ? blob : null,
    };
    setAnswers((prev) => [...prev, newAnswer]);

    // Check if we should wind up due to time
    const shouldWindUp = isWindingUp && currentQ >= totalQuestions - 3;

    if (currentQ < totalQuestions - 1) {
      const nextQ = currentQ + 1;
      setCurrentQ(nextQ);

      setIsSpeaking(true);
      let ackText = "Thank you for that answer. Let's continue.";
      try {
        ackText = await getAcknowledgment(currentQuestion.question, transcript);
      } catch {}

      // Time warning message
      if (isWindingUp && !shouldWindUp) {
        const minsLeft = Math.ceil(timeRemaining / 60);
        ackText += ` I should mention that we have about ${minsLeft} minute${minsLeft !== 1 ? "s" : ""} remaining. Let me ask you a few more quick questions to wrap up.`;
      }

      const nextDifficulty = questions[nextQ]?.difficulty;
      const currentDifficulty = currentQuestion.difficulty;
      if (!isWindingUp) {
        if (nextDifficulty !== currentDifficulty && nextDifficulty === "medium") {
          ackText += " Now let's move to some moderately challenging questions.";
        } else if (nextDifficulty !== currentDifficulty && nextDifficulty === "hard") {
          ackText += " Great progress so far. Now let's dive into some more challenging questions.";
        }
      }

      setAiMessage(ackText);
      await speakText(ackText, voiceGender);
      setIsSpeaking(false);
      setAiMessage("");

      setTimeout(() => {
        speakAndRecord(questions[nextQ].question);
      }, 300);
    } else {
      // Interview finished
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);

      // Stop full recording
      const fullBlob = await stopFullRecording();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraReady(false);
      }

      setIsSpeaking(true);
      const closingMsg = `Thank you so much ${candidateName}. That concludes your interview for the ${position} role. You answered all ${totalQuestions} questions very well. We will now process your evaluation and you'll receive your results shortly. Have a wonderful day!`;
      setAiMessage(closingMsg);
      await speakText(closingMsg, voiceGender);
      setIsSpeaking(false);
      setAiMessage("");

      // Store full recording blob for upload
      if (fullBlob.size > 0) {
        setAnswers((prev) => {
          const updated = [...prev];
          // Add full recording as a special entry
          updated.push({
            questionId: -1, // Special ID for full recording
            transcript: "",
            videoBlob: fullBlob,
          });
          return updated;
        });
      }

      setInterviewComplete(true);
    }
  }, [isRecording, stopRecording, introPhase, currentQuestion, currentQ, totalQuestions, questions, speakAndRecord, candidateName, position, voiceGender, isWindingUp, timeRemaining, stopFullRecording]);

  const handleSubmitInterview = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // Separate full recording from per-question answers
      const questionAnswers = answers.filter((a) => a.questionId !== -1);
      const fullRecordingAnswer = answers.find((a) => a.questionId === -1);

      const fullTranscript = questionAnswers
        .map((a, i) => {
          if (a.questionId === 0) {
            return `Introduction:\nCandidate: ${a.transcript}`;
          }
          const q = questions.find((q) => q.id === a.questionId);
          return `Q${i} [${q?.difficulty}/${q?.category}]: ${q?.question || "Unknown"}\nA${i}: ${a.transcript}`;
        })
        .join("\n\n");

      const timestamp = Date.now();
      const safeName = candidateName.replace(/\s+/g, "_");
      let videoFilenames: string[] = [];

      // Upload full session recording
      if (fullRecordingAnswer?.videoBlob) {
        const fullFilename = `FULL_SESSION_${safeName}_${timestamp}.webm`;
        try {
          const result = await uploadVideo(fullRecordingAnswer.videoBlob, fullFilename);
          videoFilenames.push(`[FULL] ${result.filename}`);
          toast.success("Full session recording saved!");
        } catch {
          console.log("Full recording upload failed, continuing...");
        }
      }

      // Upload per-question clips
      for (let i = 0; i < questionAnswers.length; i++) {
        if (questionAnswers[i].videoBlob) {
          const filename = `${safeName}_Q${i}_${timestamp}.webm`;
          try {
            const result = await uploadVideo(questionAnswers[i].videoBlob!, filename);
            videoFilenames.push(result.filename);
          } catch {
            console.log(`Video upload for Q${i + 1} failed, continuing...`);
          }
        }
      }

      if (videoFilenames.length > 0) {
        toast.success(`${videoFilenames.length} recording(s) saved to backend`);
      }

      const result = await submitEvaluation({
        candidate_name: candidateName,
        position,
        job_description: jobDescription,
        resume,
        transcript: fullTranscript,
        video_filename: videoFilenames.join(", ") || undefined,
      });

      toast.success("Interview evaluated successfully!");
      navigate(`/result/${result.id}`);
    } catch (err: any) {
      toast.error(err.message || "Evaluation failed. Is the backend running?");
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, questions, candidateName, position, jobDescription, resume, navigate]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (!state) return null;

  // ─── Interview complete screen ─────────────────────────────
  if (interviewComplete) {
    const questionAnswers = answers.filter((a) => a.questionId !== -1);
    return (
      <div className="min-h-screen bg-background nexus-grid">
        <Navbar />
        <div className="container mx-auto px-6 pt-24 pb-16 max-w-3xl">
          <motion.div initial="hidden" animate="visible" className="space-y-8 text-center">
            <motion.div variants={fadeUp} className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                Interview Complete!
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                {candidateName} answered {questionAnswers.length} questions in {formatTime(totalElapsed)}.
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="glass rounded-xl p-6 text-left space-y-4 max-h-[50vh] overflow-y-auto">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider sticky top-0 bg-card/80 backdrop-blur py-2">
                Interview Summary — {questionAnswers.length} Questions
              </h2>
              {questionAnswers.map((a, i) => {
                const q = questions.find((q) => q.id === a.questionId);
                return (
                  <div key={i} className="space-y-1 pb-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">
                        {a.questionId === 0 ? "Introduction" : `Q${i}: ${q?.question}`}
                      </p>
                      {q && (
                        <>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${difficultyColor[q?.difficulty || "medium"]}`}>
                            {q?.difficulty}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryColor[q?.category || "technical"]}`}>
                            {q?.category}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{a.transcript}</p>
                    {a.videoBlob && <span className="text-xs text-primary">📹 Video recorded ({(a.videoBlob.size / 1024 / 1024).toFixed(1)} MB)</span>}
                  </div>
                );
              })}
            </motion.div>

            <motion.div variants={fadeUp}>
              <Button
                onClick={handleSubmitInterview}
                disabled={isSubmitting}
                className="h-14 px-10 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading recordings & evaluating...
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <Brain className="w-5 h-5" />
                    Run AI Evaluation
                  </span>
                )}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── Pre-interview start screen ────────────────────────────
  if (!interviewStarted) {
    return (
      <div className="min-h-screen bg-background nexus-grid">
        <Navbar />
        <div className="container mx-auto px-6 pt-24 pb-16 max-w-2xl">
          <motion.div initial="hidden" animate="visible" className="space-y-8 text-center">
            <motion.div variants={fadeUp} className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mic className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                Ready to Interview
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                <strong className="text-foreground">{candidateName}</strong> — {position}
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" />
                  ~{durationMinutes} minutes
                </span>
                <span className="text-border">|</span>
                <span>{totalQuestions} questions (easy → hard)</span>
                <span className="text-border">|</span>
                <span className="capitalize">{voiceGender} voice</span>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="glass rounded-xl p-5 text-left">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Before You Start</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-nexus-green mt-0.5 shrink-0" />
                  Ensure your camera & microphone are working
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-nexus-green mt-0.5 shrink-0" />
                  Find a quiet place with good lighting
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-nexus-green mt-0.5 shrink-0" />
                  Turn on speakers — AI will speak each question aloud
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-nexus-green mt-0.5 shrink-0" />
                  Full session + per-question recordings will be saved
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-nexus-green mt-0.5 shrink-0" />
                  AI will warn you when time is almost up
                </li>
              </ul>
            </motion.div>

            <motion.div variants={fadeUp}>
              <Button
                onClick={handleBeginInterview}
                className="h-14 px-10 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan"
              >
                <Video className="w-5 h-5 mr-2" />
                Begin {durationMinutes}-Min Interview
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── Active interview ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-background nexus-grid">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
        <motion.div initial="hidden" animate="visible" className="space-y-6">
          {/* Header with progress + timers */}
          <motion.div variants={fadeUp} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-display font-bold text-foreground">
                  Interviewing: {candidateName}
                </h1>
                <p className="text-sm text-muted-foreground">{position}</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Time remaining */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                  timeRemaining <= timeWarningThreshold
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-foreground"
                }`}>
                  {timeRemaining <= timeWarningThreshold && (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-sm font-mono font-bold">
                    {formatTime(Math.max(0, timeRemaining))}
                  </span>
                  <span className="text-[10px] opacity-60">left</span>
                </div>
                {/* Elapsed */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-foreground">
                  <span className="text-sm font-mono font-bold">{formatTime(totalElapsed)}</span>
                </div>
                <span className="text-2xl font-mono font-bold text-primary">
                  {introPhase ? "Intro" : `${currentQ + 1}/${totalQuestions}`}
                </span>
              </div>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex items-center gap-2">
              {["intro", "easy", "medium", "hard"].map((d) => (
                <span
                  key={d}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                    (introPhase && d === "intro") || (!introPhase && currentQuestion?.difficulty === d)
                      ? d === "intro" ? "text-primary bg-primary/10 border-primary/20" : difficultyColor[d]
                      : "text-muted-foreground/30 bg-transparent border-transparent"
                  }`}
                >
                  {d.toUpperCase()}
                </span>
              ))}
              {isWindingUp && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/20 ml-auto animate-pulse">
                  ⏱ WINDING UP
                </span>
              )}
            </div>
          </motion.div>

          {/* Time warning banner */}
          {isWindingUp && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-3 bg-destructive/10 border border-destructive/20 flex items-center gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">
                <strong>Time is almost up!</strong> AI is wrapping up with quick final questions.
              </p>
            </motion.div>
          )}

          {/* AI Message / Acknowledgment */}
          {aiMessage && isSpeaking && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-4 border-l-4 border-nexus-amber"
            >
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 text-nexus-amber animate-pulse" />
                <span className="text-xs font-semibold text-nexus-amber uppercase tracking-wider">AI Interviewer</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{aiMessage}</p>
            </motion.div>
          )}

          {/* Intro question card */}
          {introPhase && !isSpeaking && isRecording && (
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium text-primary bg-primary/10">introduction</span>
                <span className="text-xs text-muted-foreground ml-auto">Getting to know you</span>
              </div>
              <p className="text-lg font-medium text-foreground leading-relaxed">
                Please introduce yourself — your background, experience, and what excites you about the {position} role.
              </p>
            </motion.div>
          )}

          {currentQuestion && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="glass rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColor[currentQuestion.category] || "text-foreground bg-muted"}`}>
                    {currentQuestion.category}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${difficultyColor[currentQuestion.difficulty] || ""}`}>
                    {currentQuestion.difficulty}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Question {currentQ + 1} of {totalQuestions}
                  </span>
                </div>
                <p className="text-lg font-medium text-foreground leading-relaxed">
                  {currentQuestion.question}
                </p>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Video + Recording */}
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
              <video
                ref={videoRef}
                muted
                playsInline
                className={`w-full h-full object-cover ${cameraReady ? "block" : "hidden"}`}
                style={{ transform: "scaleX(-1)" }}
              />

              {isSpeaking && cameraReady && (
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-nexus-amber/90 text-black text-xs font-semibold">
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  AI Speaking...
                </div>
              )}

              {isRecording && (
                <>
                  <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/90 text-destructive-foreground text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    REC {formatTime(duration)}
                  </div>
                  {/* Full session recording indicator */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/80 text-primary-foreground text-[10px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    SESSION REC
                  </div>
                  {isTranscribing && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/60">
                      <div className="flex items-center gap-2">
                        <Mic className="w-3.5 h-3.5 text-primary animate-pulse" />
                        <p className="text-xs text-white/90 line-clamp-2">{liveTranscript || "Listening..."}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!cameraReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <Video className="w-10 h-10" />
                  <span className="text-sm">Camera initializing...</span>
                </div>
              )}
            </div>

            {liveTranscript && (
              <div className="rounded-lg bg-muted/50 p-4 max-h-32 overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-foreground">Live Transcript</span>
                </div>
                <p className="text-sm text-muted-foreground">{liveTranscript}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              {isRecording ? (
                <Button onClick={handleNextQuestion} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Square className="w-4 h-4 mr-2 fill-current" />
                  {introPhase ? "Submit Introduction & Continue" : currentQ < totalQuestions - 1 ? "Submit Answer & Next" : "Submit Answer & Finish"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : isSpeaking ? (
                <div className="flex items-center gap-2 text-sm text-nexus-amber">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  AI is speaking... Recording starts after.
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing...
                </div>
              )}

              <div className="flex items-center gap-3">
                {answers.length > 0 && (
                  <span className="text-xs text-muted-foreground">{answers.filter(a => a.questionId !== -1).length}/{totalQuestions} answered</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleForceEndInterview(true)}
                  disabled={isSubmitting}
                  className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Leave Interview"
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/10">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">~{durationMinutes} min interview:</strong> Full session + per-question recordings saved. AI warns at 2 min remaining.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
