import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { getEvaluations, getStats, checkBackendHealth, compareCandidates } from "@/lib/api";
import { EvaluationResult } from "@/types/evaluation";
import Navbar from "@/components/Navbar";
import ScoreRing from "@/components/ScoreRing";
import {
  ArrowRight, Users, TrendingUp, Loader2, RefreshCw,
  WifiOff, BarChart3, Target, CheckCircle2, Medal, GitPullRequest,
  MessageSquare, Trash2, Pin, Star, Mic, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000") + "/api";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const REFRESH_INTERVAL = 15000;

interface Feedback {
  id: number | string;
  candidate: string;
  rating: number;
  comments: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  let colorClass = "bg-muted text-muted-foreground border-border";
  
  const s = (status || "").toLowerCase();
  if (s.includes("strong hire") || s.includes("selected") || s === "hire") {
    colorClass = "bg-green-500/10 text-green-500 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.15)]";
  } else if (s.includes("lean hire")) {
    colorClass = "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
  } else if (s.includes("reject")) {
    colorClass = "bg-destructive/10 text-destructive border-destructive/30";
  } else if (s.includes("hold")) {
    colorClass = "bg-blue-500/10 text-blue-500 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.15)]";
  } else if (s.includes("doubtful")) {
    colorClass = "bg-orange-500/10 text-orange-500 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.15)]";
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
      {status || "Pending"}
    </span>
  );
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [debriefMatrix, setDebriefMatrix] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<"initial" | "l1" | "selected" | "feedback">("initial");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [pinnedFeedbacks, setPinnedFeedbacks] = useState<(number|string)[]>([]);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [data, online] = await Promise.all([
        getEvaluations(),
        checkBackendHealth()
      ]);
      setResults(data || []);
      setBackendOnline(online);

      if (data && data.length >= 2) {
        const candidateIds = data.slice(0, 5).map((r: any) => r.id);
        const matrixData = await compareCandidates(candidateIds).catch(() => null);
        setDebriefMatrix(matrixData);
      } else {
        setDebriefMatrix(null);
      }
    } catch {
      setBackendOnline(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchFeedbacks = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/feedback`);
      if (res.ok) setFeedbacks(await res.json());
    } catch (err) {
      console.error("Failed to fetch feedback", err);
    }
  }, []);

  useEffect(() => {
    const savedPins = localStorage.getItem("bats_pinned_feedbacks");
    if (savedPins) setPinnedFeedbacks(JSON.parse(savedPins));

    fetchData();
    fetchFeedbacks();
    
    const interval = setInterval(() => {
      fetchData();
      fetchFeedbacks();
    }, REFRESH_INTERVAL);
    
    return () => clearInterval(interval);
  }, [fetchData, fetchFeedbacks]);

  const togglePin = (id: number | string) => {
    setPinnedFeedbacks(prev => {
      const newPins = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      localStorage.setItem("bats_pinned_feedbacks", JSON.stringify(newPins));
      return newPins;
    });
  };

  const deleteFeedback = async (id: number | string) => {
    setFeedbacks(prev => prev.filter(f => f.id !== id));
    try {
      const res = await fetch(`${API_URL}/feedback/${id}`, { method: "DELETE" });
      if (res.ok) toast.success("Feedback permanently deleted.");
      else toast.error(`Server Error ${res.status}: ${await res.text()}`);
    } catch (err: any) {
      fetchFeedbacks();
      toast.error(`Network Crash: ${err.message}`);
    }
  };

  const sortedFeedbacks = [...feedbacks].sort((a, b) => {
    const aPinned = pinnedFeedbacks.includes(a.id);
    const bPinned = pinnedFeedbacks.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    const aId = typeof a.id === 'number' ? a.id : 0;
    const bId = typeof b.id === 'number' ? b.id : 0;
    return bId - aId; 
  });

  // 🛡️ THE FIX: Bulletproof sync with History.tsx using explicit video_filename checking
  const initialScreeningData = results.filter(r => !r.video_filename || !String(r.video_filename).includes("[UPLOADED]"));
  const l1TechRoundData = results.filter(r => r.video_filename && String(r.video_filename).includes("[UPLOADED]"));
  const selectedData = results.filter(r => r.selection_status?.toLowerCase() === "selected");

  const calculateStats = (data: EvaluationResult[]) => {
    const total = data.length;
    const avg_score = total > 0 ? Math.round(data.reduce((s, r) => s + (r.scores?.overall_score || 0), 0) / total) : 0;
    const strong_hires = data.filter((r) => ["Strong Hire", "Lean Hire"].includes(r.hiring_recommendation || "")).length;
    
    let pipeline_health = "Awaiting Data";
    if (total > 0) {
      const hireRatio = strong_hires / total;
      if (hireRatio > 0.4) pipeline_health = "Excellent";
      else if (hireRatio > 0.15) pipeline_health = "Healthy";
      else pipeline_health = "Needs Adjustment";
    }

    const top_scorer = total > 0 ? [...data].sort((a,b) => (b.scores?.overall_score||0) - (a.scores?.overall_score||0))[0].candidateName : "N/A";

    return { total, avg_score, strong_hires, pipeline_health, top_scorer };
  };

  let activeData: EvaluationResult[] = [];
  if (activeTab === "initial") activeData = initialScreeningData;
  else if (activeTab === "l1") activeData = l1TechRoundData;
  else if (activeTab === "selected") activeData = selectedData;

  const displayStats = calculateStats(activeData);

  return (
    <div className="min-h-screen bg-background nexus-grid pb-20">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 max-w-6xl">
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          
          <motion.div variants={fadeUp} custom={0} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">ForgePro Dashboard</h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">Real-time ForgePro pipeline analytics and hiring metrics.</p>
            </div>
            <div className="flex items-center gap-3">
              {backendOnline === false && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-destructive/10 text-destructive border-destructive/20 shadow-sm">
                  <WifiOff className="w-3.5 h-3.5" />
                  Local Mode
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => { fetchData(true); fetchFeedbacks(); }} disabled={refreshing} className="h-8">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Sync
              </Button>
            </div>
          </motion.div>

          <div className="flex items-center gap-2 border-b border-border/50 pb-4 mt-6 overflow-x-auto hide-scrollbar">
            <button 
              onClick={() => setActiveTab("initial")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "initial" ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,240,255,0.3)]" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Mic className="w-4 h-4" /> Initial Screening Report
            </button>
            <button 
              onClick={() => setActiveTab("l1")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "l1" ? "bg-accent text-accent-foreground shadow-[0_0_15px_rgba(139,92,246,0.3)]" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Upload className="w-4 h-4" /> L1 Tech Round Report
            </button>
            <button 
              onClick={() => setActiveTab("selected")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "selected" ? "bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]" : "text-muted-foreground hover:bg-muted"}`}
            >
              <CheckCircle2 className="w-4 h-4" /> Selected Candidates
            </button>
            <button 
              onClick={() => setActiveTab("feedback")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ml-auto ${activeTab === "feedback" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:bg-muted border border-transparent"}`}
            >
              <MessageSquare className="w-4 h-4" /> Candidate Feedback
              {feedbacks.length > 0 && (
                <span className="ml-1 bg-background text-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                  {feedbacks.length}
                </span>
              )}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {(activeTab === "initial" || activeTab === "l1" || activeTab === "selected") && (
              <motion.div key="overview-tabs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass rounded-xl p-5 border-l-4 border-l-primary/50 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Total in View</p>
                      <Users className="w-4 h-4 text-primary opacity-70" />
                    </div>
                    <p className="text-3xl font-mono font-bold text-foreground">{displayStats.total}</p>
                  </div>

                  <div className="glass rounded-xl p-5 border-l-4 border-l-accent/50 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                      <TrendingUp className="w-4 h-4 text-accent opacity-70" />
                    </div>
                    <p className="text-3xl font-mono font-bold text-foreground">{displayStats.avg_score}</p>
                  </div>

                  <div className="glass rounded-xl p-5 border-l-4 border-l-green-500/50 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Pipeline Health</p>
                      <GitPullRequest className="w-4 h-4 text-green-500 opacity-70" />
                    </div>
                    <p className={`text-xl font-bold mt-1 ${
                      displayStats.pipeline_health === "Excellent" ? "text-green-500" :
                      displayStats.pipeline_health === "Needs Adjustment" ? "text-destructive" : "text-primary"
                    }`}>
                      {displayStats.pipeline_health}
                    </p>
                  </div>

                  <div className="glass rounded-xl p-5 border-l-4 border-l-yellow-500/50 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Top Scorer</p>
                      <Medal className="w-4 h-4 text-yellow-500 opacity-70" />
                    </div>
                    <p className="text-lg font-bold text-foreground truncate mt-2">
                      {displayStats.top_scorer}
                    </p>
                  </div>
                </div>

                {/* 🛡️ THE FIX: Hard-locked to only show strictly when L1 Tech Round tab is selected */}
                {debriefMatrix && debriefMatrix.enterprise_debrief_matrix && activeTab === "l1" && (
                   <div className="glass rounded-xl overflow-hidden border border-primary/20 shadow-sm">
                     <div className="bg-muted/50 px-6 py-5 border-b border-border flex justify-between items-center">
                       <h2 className="text-base md:text-lg font-bold text-foreground tracking-wide flex items-center gap-3">
                         <Target className="w-5 h-5 text-primary" /> 
                         Executive Debrief Matrix (Top 5 Overall)
                       </h2>
                       <span className="hidden sm:inline-block text-xs font-mono text-muted-foreground bg-background px-3 py-1 rounded-md border border-border shadow-sm">
                         {debriefMatrix.recommended_action}
                       </span>
                     </div>
                     <div className="overflow-x-auto">
                       <table className="w-full text-sm text-left">
                         <thead className="text-xs text-muted-foreground uppercase bg-background">
                           <tr>
                             <th className="px-6 py-4 border-b border-border">Rank</th>
                             <th className="px-6 py-4 border-b border-border">Candidate</th>
                             <th className="px-6 py-4 border-b border-border">Verdict</th>
                             <th className="px-6 py-4 border-b border-border">Tech Score</th>
                             <th className="px-6 py-4 border-b border-border">Top Strength</th>
                             <th className="px-6 py-4 border-b border-border">Risk Level</th>
                           </tr>
                         </thead>
                         <tbody>
                           {debriefMatrix.enterprise_debrief_matrix.map((row: any, idx: number) => (
                             <tr key={idx} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                               <td className="px-6 py-4 font-mono font-medium text-muted-foreground">#{row.rank}</td>
                               <td className="px-6 py-4 font-semibold text-foreground">{row.candidate}</td>
                               <td className="px-6 py-4">
                                 <StatusBadge status={row.verdict} />
                               </td>
                               <td className="px-6 py-4 font-mono font-medium text-foreground">{row.technical_score}/100</td>
                               <td className="px-6 py-4 text-xs text-muted-foreground truncate max-w-[200px]">{row.top_strength}</td>
                               <td className="px-6 py-4">
                                  <span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-widest uppercase border ${
                                    row.risk_level === 'Low' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                    row.risk_level === 'High' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                  }`}>
                                    {row.risk_level}
                                  </span>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                   </div>
                )}

                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    {activeTab === "initial" ? "Recent Initial Screenings" : activeTab === "l1" ? "Recent L1 Tech Rounds" : "Selected Candidates Roster"}
                  </h2>
                  
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : activeData.length === 0 ? (
                    <div className="glass rounded-xl p-8 text-center border border-dashed border-border/50">
                      <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">No evaluations found for this category.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {activeData.slice(0, 15).map((result) => (
                        <div 
                          key={result.id}
                          onClick={() => navigate(`/result/${result.id}`)}
                          className="cursor-pointer glass rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4 hover:border-primary/40 transition-all duration-200 group block relative overflow-hidden shadow-sm"
                        >
                          <div className="flex-1 min-w-0 z-10">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-foreground truncate text-lg group-hover:text-primary transition-colors">{result.candidateName}</h3>
                              <StatusBadge status={result.hiring_recommendation || "Pending"} />
                            </div>
                            <p className="text-sm text-muted-foreground">{result.position} · Evaluated on {result.date}</p>
                            <p className="text-[10px] text-muted-foreground/40 font-mono mt-1">ID: {result.id}</p>
                          </div>
                          <div className="flex items-center gap-6 z-10">
                            <div className="text-right hidden sm:block">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Confidence</p>
                              <p className="text-sm font-medium text-foreground">{result.scores?.confidence_level || 0}%</p>
                            </div>
                            <ScoreRing score={result.scores?.overall_score || 0} label="Overall" size={64} />
                            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "feedback" && (
              <motion.div key="feedback" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                {sortedFeedbacks.length === 0 ? (
                  <div className="glass rounded-xl p-12 text-center text-muted-foreground">
                    <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    No candidate feedback has been recorded yet.
                  </div>
                ) : (
                  sortedFeedbacks.map((feedback) => {
                    const isPinned = pinnedFeedbacks.includes(feedback.id);
                    return (
                      <motion.div layout key={feedback.id} className={`glass rounded-xl p-6 transition-all ${isPinned ? 'border border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : 'border border-border/50 shadow-sm'}`}>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-bold text-foreground flex items-center gap-2">
                              {feedback.candidate}
                              {isPinned && <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 text-[10px] uppercase tracking-wider font-bold">Pinned Priority</span>}
                            </h3>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-4 h-4 ${i < feedback.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                togglePin(feedback.id);
                              }} 
                              title="Pin this feedback"
                              className={`p-2 rounded-md transition-colors ${isPinned ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                            >
                              <Pin className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteFeedback(feedback.id);
                              }} 
                              title="Delete permanently"
                              className="p-2 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {feedback.comments && (
                          <div className="mt-4 p-4 rounded-lg bg-card border border-border/50 text-sm text-muted-foreground italic leading-relaxed">
                            "{feedback.comments}"
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>
    </div>
  );
}