import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { getEvaluations, getStats, checkBackendHealth, compareCandidates } from "@/lib/api";
import { EvaluationResult } from "@/types/evaluation";
import Navbar from "@/components/Navbar";
import ScoreRing from "@/components/ScoreRing";
import RecommendationBadge from "@/components/RecommendationBadge";
import {
  ArrowRight, Users, TrendingUp, Brain, Loader2, RefreshCw,
  Wifi, WifiOff, BarChart3, Target, CheckCircle2, AlertTriangle, Medal, GitPullRequest,
  MessageSquare, Trash2, Pin, Star, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // Added for feedback notifications

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
  id: number;
  candidate: string;
  rating: number;
  comments: string;
}

export default function DashboardPage() {
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [debriefMatrix, setDebriefMatrix] = useState<any>(null);

  // ─── NEW STATE FOR FEEDBACK CONTROL CENTER ───
  const [activeTab, setActiveTab] = useState<"overview" | "feedback">("overview");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [pinnedFeedbacks, setPinnedFeedbacks] = useState<number[]>([]);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [data, online, stats] = await Promise.all([
        getEvaluations(),
        checkBackendHealth(),
        getStats().catch(() => null),
      ]);
      setResults(data || []);
      setBackendOnline(online);
      setStatsData(stats);

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

  // ─── NEW FUNCTION: Fetch Feedbacks independently ───
  const fetchFeedbacks = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/feedback`);
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data);
      }
    } catch (err) {
      console.error("Failed to fetch feedback", err);
    }
  }, []);

  useEffect(() => {
    // Load pinned statuses from browser memory
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

  // ─── FEEDBACK CONTROL ACTIONS ───
  const togglePin = (id: number) => {
    setPinnedFeedbacks(prev => {
      const newPins = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      localStorage.setItem("bats_pinned_feedbacks", JSON.stringify(newPins));
      return newPins;
    });
  };

  const deleteFeedback = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/feedback/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFeedbacks(prev => prev.filter(f => f.id !== id));
        toast.success("Feedback permanently deleted.");
      }
    } catch (err) {
      toast.error("Failed to delete feedback.");
    }
  };

  // Sort feedbacks: Pinned items always float to the top
  const sortedFeedbacks = [...feedbacks].sort((a, b) => {
    const aPinned = pinnedFeedbacks.includes(a.id);
    const bPinned = pinnedFeedbacks.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return b.id - a.id; 
  });

  const displayStats = statsData || {
    total: results.length,
    avg_score: Math.round(results.reduce((s, r) => s + (r.scores?.overall_score || 0), 0) / (results.length || 1)),
    strong_hires: results.filter((r) => r.hiring_recommendation === "Strong Hire").length,
    pipeline_health: "Analyzing...",
    top_scorer: "N/A"
  };

  return (
    <div className="min-h-screen bg-background nexus-grid pb-20">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 max-w-6xl">
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          
          {/* Header Section */}
          <motion.div variants={fadeUp} custom={0} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Enterprise Dashboard</h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">Real-time AI pipeline analytics and hiring metrics.</p>
            </div>
            <div className="flex items-center gap-3">
              {backendOnline !== null && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                  backendOnline ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"
                }`}>
                  {backendOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  {backendOnline ? "System Online" : "Local Mode"}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => { fetchData(true); fetchFeedbacks(); }} disabled={refreshing} className="h-8">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Sync
              </Button>
            </div>
          </motion.div>

          {/* ─── ENTERPRISE TAB NAVIGATION ─── */}
          <div className="flex items-center gap-4 border-b border-border/50 pb-4 mt-6">
            <button 
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "overview" ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,240,255,0.3)]" : "text-muted-foreground hover:bg-muted"}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Overview & Analytics
            </button>
            <button 
              onClick={() => setActiveTab("feedback")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "feedback" ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,240,255,0.3)]" : "text-muted-foreground hover:bg-muted"}`}
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
            {/* ─── TAB 1: OVERVIEW & ANALYTICS (Your Original Code) ─── */}
            {activeTab === "overview" && (
              <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass rounded-xl p-5 border-l-4 border-l-primary/50">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Total Evaluated</p>
                      <Users className="w-4 h-4 text-primary opacity-70" />
                    </div>
                    <p className="text-3xl font-mono font-bold text-foreground">{displayStats.total}</p>
                  </div>

                  <div className="glass rounded-xl p-5 border-l-4 border-l-accent/50">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                      <TrendingUp className="w-4 h-4 text-accent opacity-70" />
                    </div>
                    <p className="text-3xl font-mono font-bold text-foreground">{displayStats.avg_score}</p>
                  </div>

                  <div className="glass rounded-xl p-5 border-l-4 border-l-green-500/50">
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

                  <div className="glass rounded-xl p-5 border-l-4 border-l-yellow-500/50">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-muted-foreground">Top Scorer</p>
                      <Medal className="w-4 h-4 text-yellow-500 opacity-70" />
                    </div>
                    <p className="text-lg font-bold text-foreground truncate mt-2">
                      {displayStats.top_scorer || "Awaiting Data"}
                    </p>
                  </div>
                </div>

                {debriefMatrix && debriefMatrix.enterprise_debrief_matrix && (
                   <div className="glass rounded-xl overflow-hidden border border-primary/20">
                     <div className="bg-muted/30 px-6 py-4 border-b border-border flex justify-between items-center">
                       <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                         <Target className="w-4 h-4 text-primary" />
                         Executive Debrief Matrix (Top 5)
                       </h2>
                       <span className="text-xs font-mono text-muted-foreground">{debriefMatrix.recommended_action}</span>
                     </div>
                     <div className="overflow-x-auto">
                       <table className="w-full text-sm text-left">
                         <thead className="text-xs text-muted-foreground uppercase bg-muted/10">
                           <tr>
                             <th className="px-6 py-3">Rank</th>
                             <th className="px-6 py-3">Candidate</th>
                             <th className="px-6 py-3">Verdict</th>
                             <th className="px-6 py-3">Tech Score</th>
                             <th className="px-6 py-3">Top Strength</th>
                             <th className="px-6 py-3">Risk Level</th>
                           </tr>
                         </thead>
                         <tbody>
                           {debriefMatrix.enterprise_debrief_matrix.map((row: any, idx: number) => (
                             <tr key={idx} className="border-b border-border/50 hover:bg-muted/5 transition-colors">
                               <td className="px-6 py-4 font-mono">#{row.rank}</td>
                               <td className="px-6 py-4 font-medium text-foreground">{row.candidate}</td>
                               <td className="px-6 py-4">
                                 <RecommendationBadge recommendation={row.verdict} />
                               </td>
                               <td className="px-6 py-4 font-mono">{row.technical_score}/100</td>
                               <td className="px-6 py-4 text-xs text-muted-foreground truncate max-w-[200px]">{row.top_strength}</td>
                               <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                    row.risk_level === 'Low' ? 'bg-green-500/10 text-green-500' :
                                    row.risk_level === 'High' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
                                  }`}>
                                    {row.risk_level} Risk
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
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">All Recent Evaluations</h2>
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : results.length === 0 ? (
                    <div className="glass rounded-xl p-8 text-center border border-dashed border-border/50">
                      <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">No evaluations yet. Start an interview to populate the matrix.</p>
                      <div className="flex gap-4 justify-center mt-6">
                        <Link to="/evaluate">
                          <Button size="sm">Start Interview</Button>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {results.slice(0, 10).map((result, i) => (
                        <div key={result.id}>
                          <Link
                            to={`/result/${result.id}`}
                            className="glass rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4 hover:border-primary/40 transition-all duration-200 group block relative overflow-hidden"
                          >
                            <div className="flex-1 min-w-0 z-10">
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-semibold text-foreground truncate text-lg">{result.candidateName}</h3>
                                <RecommendationBadge recommendation={result.hiring_recommendation} />
                              </div>
                              <p className="text-sm text-muted-foreground">{result.position} · Evaluated on {result.date}</p>
                              <p className="text-[10px] text-muted-foreground/40 font-mono mt-1">{result.id}</p>
                            </div>
                            <div className="flex items-center gap-6 z-10">
                              <div className="text-right hidden sm:block">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Confidence</p>
                                <p className="text-sm font-medium">{result.scores?.confidence_level || 0}%</p>
                              </div>
                              <ScoreRing score={result.scores?.overall_score || 0} label="Overall" size={64} />
                              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ─── TAB 2: CANDIDATE FEEDBACK CENTER ─── */}
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
                      <motion.div layout key={feedback.id} className={`glass rounded-xl p-6 transition-all ${isPinned ? 'border border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : 'border border-border/50'}`}>
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
                          
                          {/* Control Buttons */}
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => togglePin(feedback.id)} 
                              title="Pin this feedback"
                              className={`p-2 rounded-md transition-colors ${isPinned ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                            >
                              <Pin className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteFeedback(feedback.id)} 
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