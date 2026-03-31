import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, MessageSquare,
  HelpCircle, FileText, Sparkles, Loader2, Play, 
  Smile, Meh, Frown, Shield, Download, Copy, UserCheck, UserX, ShieldAlert
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

const statusStyles = {
  pending: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
  selected: "text-green-500 bg-green-500/10 border-green-500/20",
  rejected: "text-red-500 bg-red-500/10 border-red-500/20",
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
  
  const videoUrl = result.video_filename ? `${API_BASE}/uploads/recordings/${encodeURIComponent(result.video_filename)}` : null;

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
                  <p className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground font-mono">
                    ID: {result.id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Evaluated on {result.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RecommendationBadge recommendation={result.hiring_recommendation} />
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider ${statusStyles[result.selection_status || "pending"]}`}>
                  {result.selection_status || "pending"}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={0.5} className="flex flex-wrap items-center justify-between gap-4 p-4 glass rounded-xl border border-primary/10">
            <div className="flex gap-2">
              <Button
                variant={result.selection_status === "selected" ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange("selected")}
                className={result.selection_status === "selected" ? "bg-green-600 hover:bg-green-700 text-white" : "hover:text-green-500 hover:border-green-500"}
              >
                <UserCheck className="w-4 h-4 mr-2" /> Select
              </Button>
              <Button
                variant={result.selection_status === "rejected" ? "destructive" : "outline"}
                size="sm"
                onClick={() => handleStatusChange("rejected")}
                className={result.selection_status === "rejected" ? "" : "hover:text-red-500 hover:border-red-500"}
              >
                <UserX className="w-4 h-4 mr-2" /> Reject
              </Button>
              {result.selection_status !== "pending" && (
                <Button variant="ghost" size="sm" onClick={() => handleStatusChange("pending")} className="text-muted-foreground">
                  Reset
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} className="text-muted-foreground">
                <Download className="w-4 h-4 mr-2" /> Export JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(result.id); toast.success("ID copied!"); }} className="text-muted-foreground">
                <Copy className="w-4 h-4 mr-2" /> Copy ID
              </Button>
            </div>
          </motion.div>

          {/* UPGRADE: Security Remarks Banner */}
          {/* @ts-ignore - Bypass TS error if remarks is not yet in EvaluationResult types */}
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

          <motion.div variants={fadeUp} custom={1} className="glass rounded-xl p-6 border-l-4 border-l-primary">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Executive Summary</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed text-base">{result.candidate_overview}</p>
          </motion.div>

          <motion.div variants={fadeUp} custom={1.5} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6 border border-border/50">
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

            <div className="glass rounded-xl p-6 border border-border/50">
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
            <div className="glass rounded-xl p-6 flex flex-col items-center border border-border/50">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-6 self-start">
                Performance Radar
              </h2>
              <RadarChart scores={result.scores} size={280} />
            </div>
            <div className="glass rounded-xl p-6 border border-border/50">
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
            <motion.div variants={fadeUp} custom={2.5} className="glass rounded-xl p-6 border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary" /> Session Recording
                </h2>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">Analyzed via Deep Audio Extraction</span>
              </div>
              <div className="rounded-lg overflow-hidden bg-black/50 border border-border/50 max-w-3xl mx-auto">
                <video controls className="w-full aspect-video" src={videoUrl}>
                  Your browser does not support video playback.
                </video>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div variants={fadeUp} custom={3} className="glass rounded-xl p-6 border border-green-500/20 bg-gradient-to-b from-green-500/5 to-transparent">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Identified Strengths</h2>
              </div>
              <ul className="space-y-4">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </motion.div>
            
            <motion.div variants={fadeUp} custom={4} className="glass rounded-xl p-6 border border-red-500/20 bg-gradient-to-b from-red-500/5 to-transparent">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Red Flags & Gaps</h2>
              </div>
              <ul className="space-y-4">
                {result.red_flags_or_weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <motion.div variants={fadeUp} custom={5} className="glass rounded-xl p-6 border-l-4 border-l-accent">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Suggested Follow-Up Questions</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Auto-generated by the AI Skeptic agent based on vague answers in the transcript.</p>
            <div className="space-y-3">
              {result.dynamic_follow_up_questions.map((q, i) => (
                <div key={i} className="flex gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                  <MessageSquare className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <span className="text-sm font-medium text-foreground/90">{q}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={6} className="glass rounded-xl p-6 border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Hiring Manager Justification</h2>
            </div>
            <div className="p-4 rounded-lg bg-muted/20 text-foreground/90 leading-relaxed text-sm md:text-base whitespace-pre-wrap">
              {result.justification}
            </div>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}