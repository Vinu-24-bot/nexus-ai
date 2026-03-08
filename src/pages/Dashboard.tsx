import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { getEvaluations, getStats, checkBackendHealth } from "@/lib/api";
import { EvaluationResult } from "@/types/evaluation";
import Navbar from "@/components/Navbar";
import ScoreRing from "@/components/ScoreRing";
import RecommendationBadge from "@/components/RecommendationBadge";
import {
  ArrowRight, Users, TrendingUp, Brain, Loader2, RefreshCw,
  Wifi, WifiOff, BarChart3, Target, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const REFRESH_INTERVAL = 15000;

export default function DashboardPage() {
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [statsData, setStatsData] = useState<any>(null);

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
    } catch {
      setBackendOnline(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const avgScore = results.length
    ? Math.round(results.reduce((s, r) => s + (r.scores?.overall_score || 0), 0) / results.length)
    : 0;
  const strongHires = results.filter((r) => r.hiring_recommendation === "Strong Hire").length;
  const leanHires = results.filter((r) => r.hiring_recommendation === "Lean Hire").length;
  const rejects = results.filter((r) => r.hiring_recommendation === "Reject").length;
  const selected = results.filter((r) => r.selection_status === "selected").length;
  const rejected = results.filter((r) => r.selection_status === "rejected").length;
  const pending = results.filter((r) => r.selection_status === "pending").length;

  const stats = [
    { label: "Total Evaluations", value: String(results.length), icon: Users, color: "text-primary" },
    { label: "Avg Score", value: String(avgScore), icon: TrendingUp, color: "text-accent" },
    { label: "Strong Hires", value: String(strongHires), icon: Brain, color: "text-primary" },
    { label: "Lean Hires", value: String(leanHires), icon: Target, color: "text-muted-foreground" },
    { label: "Selected", value: String(selected), icon: CheckCircle2, color: "text-primary" },
    { label: "Pending", value: String(pending), icon: Clock, color: "text-muted-foreground" },
  ];

  return (
    <div className="min-h-screen bg-background nexus-grid">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-6xl">
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          <motion.div variants={fadeUp} custom={0} className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Overview of all candidate evaluations</p>
            </div>
            <div className="flex items-center gap-3">
              {backendOnline !== null && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  backendOnline ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                }`}>
                  {backendOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {backendOnline ? "Backend Online" : "Offline Mode"}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="text-xs">
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div variants={fadeUp} custom={1} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="glass rounded-xl p-4 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-2">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-mono font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Score Distribution */}
          {results.length > 0 && (
            <motion.div variants={fadeUp} custom={1.5} className="glass rounded-xl p-6">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Score Distribution
              </h2>
              <div className="flex items-end gap-1 h-24">
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((range) => {
                  const count = results.filter(
                    (r) => (r.scores?.overall_score || 0) >= range && (r.scores?.overall_score || 0) < range + 10
                  ).length;
                  const maxCount = Math.max(1, ...([0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((r) =>
                    results.filter((e) => (e.scores?.overall_score || 0) >= r && (e.scores?.overall_score || 0) < r + 10).length
                  )));
                  const height = (count / maxCount) * 100;
                  return (
                    <div key={range} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-muted-foreground">{count > 0 ? count : ""}</span>
                      <div
                        className={`w-full rounded-t transition-all ${count > 0 ? "bg-primary/60" : "bg-muted/30"}`}
                        style={{ height: `${Math.max(2, height)}%` }}
                      />
                      <span className="text-[8px] text-muted-foreground">{range}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Candidates List */}
          <motion.div variants={fadeUp} custom={2} className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Recent Evaluations</h2>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : results.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center">
                <p className="text-muted-foreground">No evaluations yet. Start an interview to see results here.</p>
                <div className="flex gap-3 justify-center mt-4">
                  <Link to="/evaluate" className="text-primary text-sm hover:underline">
                    Start an Interview →
                  </Link>
                  <Link to="/upload-analysis" className="text-accent text-sm hover:underline">
                    Upload & Analyze →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {results.slice(0, 10).map((result, i) => (
                  <motion.div key={result.id} variants={fadeUp} custom={3 + i}>
                    <Link
                      to={`/result/${result.id}`}
                      className="glass rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4 hover:border-primary/30 transition-all duration-200 group block"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-foreground truncate">{result.candidateName}</h3>
                          <RecommendationBadge recommendation={result.hiring_recommendation} />
                          {result.selection_status && result.selection_status !== "pending" && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              result.selection_status === "selected" ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10"
                            }`}>
                              {result.selection_status.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{result.position} · {result.date}</p>
                        <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">{result.id}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <ScoreRing score={result.scores?.overall_score || 0} label="Overall" size={60} />
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  </motion.div>
                ))}
                {results.length > 10 && (
                  <Link to="/history" className="block text-center text-sm text-primary hover:underline py-3">
                    View all {results.length} evaluations →
                  </Link>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
