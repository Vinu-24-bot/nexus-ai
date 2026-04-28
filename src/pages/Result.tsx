import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, MessageSquare,
  HelpCircle, FileText, Sparkles, Loader2, Play, Pause,
  Smile, Meh, Frown, Shield, Download, Copy, UserCheck, UserX, ShieldAlert,
  Clock, Maximize, Minimize, Rewind, FastForward, Volume2, VolumeX, Settings
} from "lucide-react";
import { getEvaluation, updateSelectionStatus } from "@/lib/api";
import { EvaluationResult } from "@/types/evaluation";
import Navbar from "@/components/Navbar";
import RadarChart from "@/components/RadarChart";
import ScoreRing from "@/components/ScoreRing";
import RecommendationBadge from "@/components/RecommendationBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5 },
  }),
};

const sentimentIcon = {
  Positive: Smile,
  Neutral: Meh,
  Negative: Frown,
};

const sentimentColor = {
  Positive: "text-nexus-green bg-nexus-green/10",
  Neutral: "text-nexus-amber bg-nexus-amber/10",
  Negative: "text-nexus-red bg-nexus-red/10",
};

const statusStyles: Record<string, string> = {
  pending: "text-nexus-amber bg-nexus-amber/10 border-nexus-amber/20",
  selected: "text-nexus-green bg-nexus-green/10 border-nexus-green/20",
  rejected: "text-nexus-red bg-nexus-red/10 border-nexus-red/20",
};

// 🛡️ THE FIX: Restored Custom YouTube UI connected to the new Streaming Endpoint
const ForgeProVideoPlayer = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isScrubbing) {
      const vid = videoRef.current;
      setCurrentTime(vid.currentTime);
      
      // Dynamic fallback if browser struggles with initial WebM metadata
      let currentDuration = vid.duration;
      if (isNaN(currentDuration) || currentDuration === Infinity || currentDuration === 0) {
        if (vid.buffered && vid.buffered.length > 0) {
          currentDuration = vid.buffered.end(vid.buffered.length - 1);
        }
      }

      if (currentDuration > 0 && currentDuration !== Infinity) {
        setDuration(currentDuration);
        setProgress((vid.currentTime / currentDuration) * 100);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = Number(e.target.value);
    setProgress(newProgress);
    if (videoRef.current && duration > 0) {
      videoRef.current.currentTime = (newProgress / 100) * duration;
    }
  };

  const skip = (amount: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime + amount);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const handleSpeed = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = Number(e.target.value);
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => toast.error("Fullscreen not supported"));
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const formatTime = (time: number) => {
    if (isNaN(time) || time === Infinity || time < 0) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div ref={containerRef} className="relative group w-full bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center shadow-inner border border-border/50">
      
      <video 
        ref={videoRef} 
        src={src} 
        className="w-full max-h-[600px] cursor-pointer outline-none" 
        onClick={togglePlay} 
        onTimeUpdate={handleTimeUpdate} 
        preload="metadata"
      />
      
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20" onClick={togglePlay}>
          <div className="w-16 h-16 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.4)] pointer-events-auto cursor-pointer hover:scale-110 transition-transform">
            <Play className="w-8 h-8 ml-1" />
          </div>
        </div>
      )}

      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-12 transition-opacity duration-300 ${isPlaying && !isScrubbing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
        
        {/* Playback Scrubber */}
        <div className="relative w-full h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group/progress">
          <input 
            type="range" min="0" max="100" step="0.1"
            value={progress || 0} 
            onChange={handleSeek} 
            onMouseDown={() => setIsScrubbing(true)}
            onMouseUp={() => setIsScrubbing(false)}
            onTouchStart={() => setIsScrubbing(true)}
            onTouchEnd={() => setIsScrubbing(false)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
          />
          <div className="absolute top-0 left-0 h-full bg-primary rounded-full pointer-events-none transition-all duration-75" style={{ width: `${progress}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full scale-0 group-hover/progress:scale-100 transition-transform" />
          </div>
        </div>

        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="hover:text-primary transition-colors">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            
            <button onClick={() => skip(-10)} className="hover:text-primary transition-colors" title="Rewind 10s">
              <Rewind className="w-4 h-4" />
            </button>
            <button onClick={() => skip(10)} className="hover:text-primary transition-colors" title="Forward 10s">
              <FastForward className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-2 group/volume relative">
              <button onClick={toggleMute} className="hover:text-primary transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input 
                type="range" min="0" max="1" step="0.05" 
                value={isMuted ? 0 : volume} 
                onChange={handleVolume} 
                className="w-0 opacity-0 group-hover/volume:w-20 group-hover/volume:opacity-100 transition-all duration-300 accent-primary cursor-pointer origin-left" 
              />
            </div>

            <span className="text-xs font-mono text-white/80">
              {formatTime(currentTime)} {duration > 0 ? `/ ${formatTime(duration)}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-white/10 rounded px-2 py-1 hover:bg-white/20 transition-colors">
              <Settings className="w-3.5 h-3.5 text-white/70" />
              <select 
                className="bg-transparent text-white text-xs outline-none cursor-pointer font-medium appearance-none" 
                value={playbackRate} 
                onChange={handleSpeed}
              >
                <option value="0.5" className="text-black">0.5x Speed</option>
                <option value="1" className="text-black">1.0x Speed</option>
                <option value="1.5" className="text-black">1.5x Speed</option>
                <option value="2" className="text-black">2.0x Speed</option>
              </select>
            </div>
            
            <button onClick={toggleFullscreen} className="hover:text-primary transition-colors">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ResultPage() {
  const { id } = useParams();
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getEvaluation(id)
      .then(setResult)
      .catch(() => {
        toast.error("Could not load evaluation. Is the backend running?");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (status: "selected" | "rejected" | "pending") => {
    if (!id || !result) return;
    try {
      const updated = await updateSelectionStatus(id, status);
      setResult(updated);
      toast.success(`Candidate marked as ${status}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!result) return null;

  const SentimentIconComp = sentimentIcon[result.sentiment?.rating as keyof typeof sentimentIcon] || Meh;
  const sentClr = sentimentColor[result.sentiment?.rating as keyof typeof sentimentColor] || sentimentColor.Neutral;
  
  // 🛡️ THE FIX: Pointing the player specifically to the new FastAPI backend streaming endpoint
  const rawVideoFiles = result.video_filename?.split(", ").filter(Boolean) || [];
  const videoFiles = rawVideoFiles.map((f) => {
    const cleanName = f.replace(/^\[.*?\]\s*/, "");
    return { name: cleanName, url: `${API_BASE}/api/stream/${encodeURIComponent(cleanName)}` };
  });

  return (
    <div className="min-h-screen bg-background nexus-grid pb-20">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-5xl">
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          
          <motion.div variants={fadeUp} custom={0} className="space-y-4">
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                  {result.candidateName}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {result.position} · Evaluated {result.date}
                </p>
                <p className="text-xs text-muted-foreground/60 font-mono mt-0.5">
                  ID: {result.id}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <RecommendationBadge recommendation={result.hiring_recommendation} />
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusStyles[result.selection_status || "pending"]}`}>
                  {(result.selection_status || "pending").toUpperCase()}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={0.5} className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => handleStatusChange("selected")} className={`border-nexus-green/30 hover:bg-nexus-green/10 ${result.selection_status === "selected" ? "bg-nexus-green/10 text-nexus-green" : "text-muted-foreground"}`}>
              <UserCheck className="w-4 h-4 mr-1.5" /> Select Candidate
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStatusChange("rejected")} className={`border-nexus-red/30 hover:bg-nexus-red/10 ${result.selection_status === "rejected" ? "bg-nexus-red/10 text-nexus-red" : "text-muted-foreground"}`}>
              <UserX className="w-4 h-4 mr-1.5" /> Reject Candidate
            </Button>
            {result.selection_status !== "pending" && (
              <Button variant="ghost" size="sm" onClick={() => handleStatusChange("pending")} className="text-muted-foreground">
                Reset to Pending
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const data = JSON.stringify(result, null, 2);
                const blob = new Blob([data], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${result.id}_${result.candidateName.replace(/\s+/g, "_")}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Evaluation exported!");
              }} className="text-muted-foreground">
                <Download className="w-4 h-4 mr-1.5" /> Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(result.id); toast.success("Candidate ID copied!"); }} className="text-muted-foreground">
                <Copy className="w-4 h-4 mr-1.5" /> Copy ID
              </Button>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={1} className="glass rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Executive Summary</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">{result.candidate_overview}</p>
          </motion.div>

          <motion.div variants={fadeUp} custom={1.5} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <SentimentIconComp className={`w-4 h-4 ${sentClr.split(" ")[0]}`} />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Candidate Sentiment</h2>
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${sentClr} mb-3`}>
                <SentimentIconComp className="w-4 h-4" />
                {result.sentiment?.rating || "Neutral"}
              </div>
              <p className="text-sm text-muted-foreground">{result.sentiment?.explanation || "No analysis available"}</p>
            </div>
            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-nexus-purple" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Candidate Status</h2>
              </div>
              <p className="text-sm font-semibold text-foreground mb-2">{result.candidate_status?.level || "Not assessed"}</p>
              <p className="text-sm text-muted-foreground">{result.candidate_status?.description || ""}</p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={2} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6 flex flex-col items-center">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-6 self-start">
                Performance Radar
              </h2>
              <RadarChart scores={result.scores} size={260} />
            </div>
            <div className="glass rounded-xl p-6">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-6">
                Score Breakdown
              </h2>
              <div className="grid grid-cols-2 gap-6 place-items-center">
                <ScoreRing score={result.scores.technical_proficiency} label="Technical" color="hsl(173 80% 50%)" size={100} />
                <ScoreRing score={result.scores.relevance_to_jd} label="Relevance" color="hsl(260 70% 60%)" size={100} />
                <ScoreRing score={result.scores.communication} label="Communication" color="hsl(220 80% 55%)" size={100} />
                <ScoreRing score={result.scores.confidence_level || 0} label="Confidence" color="hsl(38 92% 55%)" size={100} />
                <div className="col-span-2">
                  <ScoreRing score={result.scores.overall_score} label="Overall" color="hsl(150 70% 50%)" size={120} />
                </div>
              </div>
            </div>
          </motion.div>

          {/* 🛡️ Full-Width Session Recording UI - No "Question 1" Text */}
          {videoFiles.length > 0 && (
            <motion.div variants={fadeUp} custom={2.5} className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Session Recording</h2>
                </div>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded border border-border/50">ForgePro Video Engine</span>
              </div>
              <div className="w-full">
                {videoFiles.map((vf, i) => (
                  <ForgeProVideoPlayer key={i} src={vf.url} />
                ))}
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div variants={fadeUp} custom={3} className="glass rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-nexus-green" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Strengths</h2>
              </div>
              <ul className="space-y-3">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-nexus-green mt-1.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} custom={4} className="glass rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-nexus-amber" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Red Flags</h2>
              </div>
              <ul className="space-y-3">
                {result.red_flags_or_weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-nexus-amber mt-1.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <motion.div variants={fadeUp} custom={5} className="glass rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-4 h-4 text-nexus-purple" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Follow-Up Questions</h2>
            </div>
            <div className="space-y-3">
              {result.dynamic_follow_up_questions.map((q, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                  <MessageSquare className="w-4 h-4 text-nexus-purple mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">{q}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={6} className="glass rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Justification</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">{result.justification}</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}