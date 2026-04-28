import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, MessageSquare,
  HelpCircle, FileText, Sparkles, Loader2, ThumbsUp, ThumbsDown,
  Clock, UserCheck, UserX, Play, Smile, Meh, Frown, Shield, Download, Copy,
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

const statusStyles = {
  pending: "text-nexus-amber bg-nexus-amber/10 border-nexus-amber/20",
  selected: "text-nexus-green bg-nexus-green/10 border-nexus-green/20",
  rejected: "text-nexus-red bg-nexus-red/10 border-nexus-red/20",
};

// 🛡️ THE ULTIMATE FIX: Indestructible Native HTML5 Player with 4s Timeout Fallback
const NativeForgePlayer = ({ src }: { src: string }) => {
  const [activeSrc, setActiveSrc] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let objectUrl = "";

    const fetchWithTimeout = async () => {
      try {
        // Attempt to fetch as a Blob to fix Chrome WebM seeking bugs,
        // BUT enforce a strict 4-second timeout so it never hangs infinitely.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const response = await fetch(src, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const blob = await response.blob();
        if (!isMounted) return;
        
        objectUrl = URL.createObjectURL(blob);
        setActiveSrc(objectUrl);
      } catch (e) {
        // If fetch fails, times out, or hits CORS, immediately fallback to raw network streaming
        if (isMounted) {
          console.warn("Video blob optimization bypassed, falling back to raw stream.");
          setActiveSrc(src);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchWithTimeout();

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    // Fix Chrome's Infinity duration bug silently
    if (video.duration === Infinity || isNaN(video.duration)) {
      video.currentTime = 1e99;
      video.onseeked = () => {
        video.onseeked = null;
        video.currentTime = 0;
      };
    }
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border/50 shadow-inner flex items-center justify-center">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-primary">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-xs font-mono font-bold tracking-widest animate-pulse">SECURING VIDEO STREAM...</p>
        </div>
      )}
      
      {activeSrc && (
        <video
          controls
          controlsList="nodownload"
          className={`w-full h-full transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          src={activeSrc}
          onLoadedMetadata={handleLoadedMetadata}
          preload="auto"
        >
          Your browser does not support video playback.
        </video>
      )}
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
  
  // Parse video filenames and build correct URLs  
  const rawVideoFiles = result.video_filename?.split(", ").filter(Boolean) || [];
  const videoFiles = rawVideoFiles.map((f) => {
    // Strip all bracket prefixes: [FULL], [UPLOADED], etc.
    const cleanName = f.replace(/^\[.*?\]\s*/, "");
    const isFullSession = f.startsWith("[FULL]");
    return { name: cleanName, isFullSession, url: `${API_BASE}/uploads/recordings/${encodeURIComponent(cleanName)}` };
  });

  return (
    <div className="min-h-screen bg-background nexus-grid pb-20">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-5xl">
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          {/* Back + Header */}
          <motion.div variants={fadeUp} custom={0} className="space-y-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
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

          {/* Selection Actions */}
          <motion.div variants={fadeUp} custom={0.5} className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("selected")}
              className={`border-nexus-green/30 hover:bg-nexus-green/10 ${result.selection_status === "selected" ? "bg-nexus-green/10 text-nexus-green" : "text-muted-foreground"}`}
            >
              <UserCheck className="w-4 h-4 mr-1.5" />
              Select Candidate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("rejected")}
              className={`border-nexus-red/30 hover:bg-nexus-red/10 ${result.selection_status === "rejected" ? "bg-nexus-red/10 text-nexus-red" : "text-muted-foreground"}`}
            >
              <UserX className="w-4 h-4 mr-1.5" />
              Reject Candidate
            </Button>
            {result.selection_status !== "pending" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusChange("pending")}
                className="text-muted-foreground"
              >
                Reset to Pending
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const data = JSON.stringify(result, null, 2);
                  const blob = new Blob([data], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${result.id}_${result.candidateName.replace(/\s+/g, "_")}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Evaluation exported!");
                }}
                className="text-muted-foreground"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(result.id);
                  toast.success("Candidate ID copied!");
                }}
                className="text-muted-foreground"
              >
                <Copy className="w-4 h-4 mr-1.5" />
                Copy ID
              </Button>
            </div>
          </motion.div>

          {/* Overview */}
          <motion.div variants={fadeUp} custom={1} className="glass rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Executive Summary</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">{result.candidate_overview}</p>
          </motion.div>

          {/* Sentiment + Candidate Status */}
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

          {/* Scores Grid */}
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

          {/* Interview Recordings */}
          {videoFiles.length > 0 && (
            <motion.div variants={fadeUp} custom={2.5} className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Interview Recordings</h2>
                </div>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded border border-border/50">Native Web Engine</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videoFiles.map((vf, i) => (
                  <div key={i} className="rounded-lg overflow-hidden bg-muted border border-border/50 shadow-inner">
                    <NativeForgePlayer src={vf.url} />
                    <div className="p-3 text-center bg-card border-t border-border/50">
                      <span className="text-xs font-semibold text-foreground tracking-wide">
                        {vf.isFullSession ? "📹 FULL SESSION RECORDING" : `QUESTION ${i + 1}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Strengths & Weaknesses */}
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

          {/* Follow-up Questions */}
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

          {/* Justification */}
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