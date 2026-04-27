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
  Positive: "text-green-500 bg-green-500/10 border-green-500/20",
  Neutral: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  Negative: "text-red-500 bg-red-500/10 border-red-500/20",
};

const statusStyles: Record<string, string> = {
  pending: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  selected: "text-green-500 bg-green-500/10 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.15)]",
  rejected: "text-red-500 bg-red-500/10 border-red-500/30",
  hold: "text-blue-500 bg-blue-500/10 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.15)]",
  doubtful: "text-orange-500 bg-orange-500/10 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.15)]",
};

// 🛡️ THE FIX: Custom YouTube-Style Enterprise Video Player
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

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = (Number(e.target.value) / 100) * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress(Number(e.target.value));
    }
  };

  const skip = (amount: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += amount;
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
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div ref={containerRef} className="relative group bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center shadow-inner border border-border/50">
      <video 
        ref={videoRef} 
        src={src} 
        className="w-full max-h-[600px] cursor-pointer" 
        onClick={togglePlay} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata} 
      />
      
      {/* Big Play Button Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20" onClick={togglePlay}>
          <div className="w-16 h-16 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.4)] pointer-events-auto cursor-pointer hover:scale-110 transition-transform">
            <Play className="w-8 h-8 ml-1" />
          </div>
        </div>
      )}

      {/* YouTube-Style Controls Bar */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-12 transition-opacity duration-300 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
        
        {/* Progress Bar Scrubbing */}
        <div className="relative w-full h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group/progress">
          <input 
            type="range" min="0" max="100" 
            value={progress || 0} onChange={handleSeek} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
          />
          <div className="absolute top-0 left-0 h-full bg-primary rounded-full pointer-events-none" style={{ width: `${progress}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full scale-0 group-hover/progress:scale-100 transition-transform" />
          </div>
        </div>

        {/* Buttons Row */}
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
              {formatTime(currentTime)} / {formatTime(duration)}
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

  const handleStatusChange = async (status: "selected" | "rejected" | "hold" | "doubtful" | "pending") => {
    if (!id || !result) return;
    try {
      const updated = await updateSelectionStatus(id, status as any);
      setResult(updated);
      toast.success(`Candidate marked as ${status.toUpperCase()}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleExport = () => {
    if (!result) return;
    const data = JSON.stringify(result, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.id}_${result.candidateName.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Evaluation exported successfully!");
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
  
  // 🛡️ THE FIX: Safely strip the [UPLOADED] tag before hitting the frontend video player
  const cleanVideoFilename = result.video_filename ? result.video_filename.replace("[UPLOADED] ", "").replace("[UPLOADED]", "").trim() : null;
  const videoUrl = cleanVideoFilename ? `${API_BASE}/uploads/recordings/${encodeURIComponent(cleanVideoFilename)}` : null;

  return (
    <div className="min-h-screen bg-background nexus-grid pb-20">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 max-w-5xl">
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          
          <motion.div variants={fadeUp} custom={0} className="space-y-4">
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                  {result.candidateName}
                </h1>
                <p className="text-muted-foreground mt-1 text-lg">
                  {result.position}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground font-mono border border-border/50">
                    ID: {result.id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Evaluated on {result.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RecommendationBadge recommendation={result.hiring_recommendation} />
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider ${statusStyles[result.selection_status?.toLowerCase() || "pending"]}`}>
                  {result.selection_status || "pending"}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={0.5} className="flex flex-wrap items-center justify-between gap-4 p-4 glass rounded-xl border border-primary/10 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={result.selection_status === "selected" ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange("selected")}
                className={result.selection_status === "selected" ? "bg-green-600 hover:bg-green-700 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "hover:text-green-500 hover:border-green-500 hover:bg-green-500/10"}
              >
                <UserCheck className="w-4 h-4 mr-2" /> Select
              </Button>
              <Button
                variant={result.selection_status === "rejected" ? "destructive" : "outline"}
                size="sm"
                onClick={() => handleStatusChange("rejected")}
                className={result.selection_status === "rejected" ? "shadow-[0_0_10px_rgba(239,68,68,0.3)]" : "hover:text-red-500 hover:border-red-500 hover:bg-red-500/10"}
              >
                <UserX className="w-4 h-4 mr-2" /> Reject
              </Button>
              <Button
                variant={result.selection_status === "hold" ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange("hold")}
                className={result.selection_status === "hold" ? "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]" : "hover:text-blue-500 hover:border-blue-500 hover:bg-blue-500/10"}
              >
                <Clock className="w-4 h-4 mr-2" /> Hold
              </Button>
              <Button
                variant={result.selection_status === "doubtful" ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange("doubtful")}
                className={result.selection_status === "doubtful" ? "bg-orange-600 hover:bg-orange-700 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]" : "hover:text-orange-500 hover:border-orange-500 hover:bg-orange-500/10"}
              >
                <HelpCircle className="w-4 h-4 mr-2" /> Doubtful
              </Button>

              {result.selection_status !== "pending" && (
                <Button variant="ghost" size="sm" onClick={() => handleStatusChange("pending")} className="text-muted-foreground ml-2">
                  Reset
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} className="text-muted-foreground hover:text-primary">
                <Download className="w-4 h-4 mr-2" /> Export JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(result.id); toast.success("ID copied!"); }} className="text-muted-foreground hover:text-primary">
                <Copy className="w-4 h-4 mr-2" /> Copy ID
              </Button>
            </div>
          </motion.div>

          {/* @ts-ignore */}
          {(result as any).remarks && (result as any).remarks !== "Completed normally without interruptions." && (result as any).remarks !== "Completed normally." && (
            <motion.div variants={fadeUp} custom={0.8} className="w-full bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-6 flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-destructive uppercase tracking-wider">System Alert / Security Breach</h3>
                {/* @ts-ignore */}
                <p className="text-sm text-foreground">{(result as any).remarks}</p>
              </div>
            </motion.div>
          )}

          <motion.div variants={fadeUp} custom={1} className="glass rounded-xl p-6 border-l-4 border-l-primary shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Executive Summary</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed text-base">{result.candidate_overview}</p>
          </motion.div>

          <motion.div variants={fadeUp} custom={1.5} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6 border border-border/50 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Smile className="w-4 h-4 text-muted-foreground" /> Vocal Sentiment
                </h2>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${sentClr}`}>
                  <SentimentIconComp className="w-3.5 h-3.5" />
                  {result.sentiment?.rating || "Neutral"}
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result.sentiment?.explanation || "Vocal sentiment analysis was not able to extract definitive confidence markers from this transcript."}
              </p>
            </div>

            <div className="glass rounded-xl p-6 border border-border/50 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" /> Readiness Level
                </h2>
                <div className="px-3 py-1 rounded-full text-xs font-bold border bg-accent/10 text-accent border-accent/20">
                  {result.candidate_status?.level || "Pending"}
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result.candidate_status?.description || "No detailed readiness description provided by the evaluator."}
              </p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={2} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6 flex flex-col items-center border border-border/50 shadow-sm">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-6 self-start">
                Performance Radar
              </h2>
              <RadarChart scores={result.scores} size={280} />
            </div>
            <div className="glass rounded-xl p-6 border border-border/50 shadow-sm">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-6">
                Score Breakdown
              </h2>
              <div className="grid grid-cols-2 gap-6 place-items-center">
                <ScoreRing score={result.scores.technical_proficiency} label="Technical" color="hsl(173 80% 50%)" size={110} />
                <ScoreRing score={result.scores.relevance_to_jd} label="Relevance" color="hsl(260 70% 60%)" size={110} />
                <ScoreRing score={result.scores.communication} label="Communication" color="hsl(220 80% 55%)" size={110} />
                <ScoreRing score={result.scores.confidence_level || 0} label="Confidence" color="hsl(38 92% 55%)" size={110} />
              </div>
            </div>
          </motion.div>

          {videoUrl && (
            <motion.div variants={fadeUp} custom={2.5} className="glass rounded-xl p-6 border border-border/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary" /> Session Recording
                </h2>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded border border-border/50">ForgePro Video Engine</span>
              </div>
              
              <ForgeProVideoPlayer src={videoUrl} />
              
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div variants={fadeUp} custom={3} className="glass rounded-xl p-6 border border-green-500/20 bg-gradient-to-b from-green-500/5 to-transparent shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Identified Strengths</h2>
              </div>
              <ul className="space-y-4">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                    {s}
                  </li>
                ))}
              </ul>
            </motion.div>
            
            <motion.div variants={fadeUp} custom={4} className="glass rounded-xl p-6 border border-red-500/20 bg-gradient-to-b from-red-500/5 to-transparent shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Red Flags & Gaps</h2>
              </div>
              <ul className="space-y-4">
                {result.red_flags_or_weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                    {w}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <motion.div variants={fadeUp} custom={5} className="glass rounded-xl p-6 border-l-4 border-l-accent shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Suggested Follow-Up Questions</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Auto-generated by the ForgePro agent based on vague answers in the transcript.</p>
            <div className="space-y-3">
              {result.dynamic_follow_up_questions.map((q, i) => (
                <div key={i} className="flex gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                  <MessageSquare className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <span className="text-sm font-medium text-foreground/90">{q}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={6} className="glass rounded-xl p-6 border border-border/50 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Hiring Manager Justification</h2>
            </div>
            <div className="p-4 rounded-lg bg-muted/20 text-foreground/90 leading-relaxed text-sm md:text-base whitespace-pre-wrap border border-border/50">
              {result.justification}
            </div>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}