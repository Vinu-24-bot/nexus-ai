import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { getEvaluations, deleteEvaluation } from "@/lib/api";
import { EvaluationResult } from "@/types/evaluation";
import Navbar from "@/components/Navbar";
import RecommendationBadge from "@/components/RecommendationBadge";
import { Link } from "react-router-dom";
import {
  ArrowRight, Calendar, User, Loader2, RefreshCw, Search,
  Filter, Download, SortAsc, SortDesc, Hash, Trash2, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const REFRESH_INTERVAL = 15000;

type SortField = "date" | "score" | "name";
type FilterStatus = "all" | "pending" | "selected" | "rejected" | "hold" | "doubtful";
type FilterRec = "all" | "Strong Hire" | "Lean Hire" | "Reject";

// 🛡️ THE FIX: Enterprise Status Styles (Added Hold & Doubtful) for History list
const getStatusStyles = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s.includes("strong hire") || s.includes("selected") || s === "hire") {
    return "bg-green-500/10 text-green-500 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.15)]";
  } else if (s.includes("lean hire")) {
    return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
  } else if (s.includes("reject")) {
    return "bg-destructive/10 text-destructive border-destructive/30";
  } else if (s.includes("hold")) {
    return "bg-blue-500/10 text-blue-500 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.15)]";
  } else if (s.includes("doubtful")) {
    return "bg-orange-500/10 text-orange-500 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.15)]";
  }
  return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
};

export default function HistoryPage() {
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterRec, setFilterRec] = useState<FilterRec>("all");

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const data = await getEvaluations();
      setResults(data || []);
    } catch {
      // Backend not running — local data returned automatically
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

  const filtered = useMemo(() => {
    let list = [...results];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.candidateName.toLowerCase().includes(q) ||
          r.position.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== "all") {
      list = list.filter((r) => (r.selection_status || "pending") === filterStatus);
    }

    if (filterRec !== "all") {
      list = list.filter((r) => r.hiring_recommendation === filterRec);
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "score") cmp = (a.scores?.overall_score || 0) - (b.scores?.overall_score || 0);
      else if (sortField === "name") cmp = a.candidateName.localeCompare(b.candidateName);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [results, searchQuery, sortField, sortAsc, filterStatus, filterRec]);

  const handleExportAll = () => {
    if (filtered.length === 0) { toast.error("No results to export"); return; }
    const data = JSON.stringify(filtered, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BATS_evaluations_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} evaluation(s)`);
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) { toast.error("No results to export"); return; }
    const headers = ["ID", "Name", "Position", "Date", "Overall Score", "Technical", "Relevance", "Communication", "Confidence", "Recommendation", "Status"];
    const rows = filtered.map((r) => [
      r.id, r.candidateName, r.position, r.date,
      r.scores?.overall_score || 0, r.scores?.technical_proficiency || 0,
      r.scores?.relevance_to_jd || 0, r.scores?.communication || 0,
      r.scores?.confidence_level || 0, r.hiring_recommendation, r.selection_status || "pending",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BATS_evaluations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} evaluation(s) as CSV`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete evaluation for ${name}?`)) return;
    try {
      await deleteEvaluation(id);
      setResults((prev) => prev.filter((r) => r.id !== id));
      toast.success(`Deleted evaluation for ${name}`);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const SortIcon = sortAsc ? SortAsc : SortDesc;

  return (
    <div className="min-h-screen bg-background nexus-grid">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-5xl">
        <motion.div initial="hidden" animate="visible" className="space-y-6">
          <motion.div variants={fadeUp} custom={0} className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Evaluation History</h1>
              <p className="text-muted-foreground mt-1">
                {results.length} total evaluation{results.length !== 1 ? "s" : ""} · {filtered.length} shown
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs text-muted-foreground hover:text-foreground">
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportAll} className="text-xs text-muted-foreground hover:text-foreground">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="text-xs text-muted-foreground hover:text-foreground">
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </motion.div>

          {/* Search & Filters */}
          <motion.div variants={fadeUp} custom={0.5} className="glass rounded-xl p-4 space-y-3 shadow-sm border border-primary/10">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, position, or ID (e.g. BATS-Alex_React...)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background border-border focus-visible:ring-primary"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              {/* 🛡️ THE FIX: Added 'hold' and 'doubtful' to the filter options */}
              {(["all", "pending", "selected", "rejected", "hold", "doubtful"] as FilterStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 rounded-full border transition-colors ${
                    filterStatus === s
                      ? "border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(0,240,255,0.15)]"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <span className="text-muted-foreground">|</span>
              {(["all", "Strong Hire", "Lean Hire", "Reject"] as FilterRec[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRec(r)}
                  className={`px-2.5 py-1 rounded-full border transition-colors ${
                    filterRec === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {r === "all" ? "All Recs" : r}
                </button>
              ))}
              <span className="text-muted-foreground">|</span>
              {(["date", "score", "name"] as SortField[]).map((f) => (
                <button
                  key={f}
                  onClick={() => toggleSort(f)}
                  className={`px-2.5 py-1 rounded-full border flex items-center gap-1 transition-colors ${
                    sortField === f
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {sortField === f && <SortIcon className="w-3 h-3" />}
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </motion.div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center border border-dashed border-border/50">
              <p className="text-muted-foreground">
                {results.length === 0
                  ? "No evaluations yet. Complete an interview to see history."
                  : "No results match your filters."}
              </p>
              {results.length === 0 && (
                <div className="flex gap-3 justify-center mt-3">
                  <Link to="/evaluate" className="text-primary text-sm hover:underline font-medium">Start an Interview →</Link>
                  <Link to="/upload-analysis" className="text-accent text-sm hover:underline font-medium">Upload & Analyze →</Link>
                </div>
              )}
            </div>
          ) : (
            <motion.div variants={fadeUp} custom={1} className="space-y-3">
              {filtered.map((result, i) => (
                <motion.div key={result.id} variants={fadeUp} custom={2 + i * 0.1}>
                  <div className="glass rounded-xl p-5 flex items-center justify-between gap-4 hover:border-primary/40 transition-all group shadow-sm">
                    <Link
                      to={`/result/${result.id}`}
                      className="flex items-center gap-4 min-w-0 flex-1"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{result.candidateName}</h3>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">{result.position}</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {result.date}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70 font-mono border border-border/50 px-1.5 py-0.5 rounded">
                            <Hash className="w-2.5 h-2.5" />
                            {result.id}
                          </span>
                          {/* 🛡️ THE FIX: Render dynamic status colors in History list */}
                          {result.selection_status && result.selection_status !== "pending" && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusStyles(result.selection_status)}`}>
                              {result.selection_status}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      <RecommendationBadge recommendation={result.hiring_recommendation} />
                      <span className="font-mono text-lg font-bold text-foreground">{result.scores?.overall_score || 0}</span>
                      <button
                        onClick={() => handleDelete(result.id, result.candidateName)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete evaluation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <Link to={`/result/${result.id}`}>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}