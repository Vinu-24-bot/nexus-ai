import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getEvaluations, deleteEvaluation } from "@/lib/api";
import { EvaluationResult } from "@/types/evaluation";
import Navbar from "@/components/Navbar";
import RecommendationBadge from "@/components/RecommendationBadge";
import { Link } from "react-router-dom";
import {
  ArrowRight, Calendar, User, Loader2, RefreshCw, Search,
  Filter, Download, SortAsc, SortDesc, Hash, Trash2, FileText, Sparkles,
  Mic, Upload, Database
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
type ActiveTab = "all" | "initial" | "l1";

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
  
  // Tab & Filters
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
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

    // 1. Filter by Round Type (Tab)
    if (activeTab === "initial") {
      list = list.filter(r => !r.video_filename || !String(r.video_filename).includes("[UPLOADED]"));
    } else if (activeTab === "l1") {
      list = list.filter(r => r.video_filename && String(r.video_filename).includes("[UPLOADED]"));
    }

    // 2. Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.candidateName.toLowerCase().includes(q) ||
          r.position.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
      );
    }

    // 3. Status Filters
    if (filterStatus !== "all") {
      list = list.filter((r) => (r.selection_status || "pending") === filterStatus);
    }
    if (filterRec !== "all") {
      list = list.filter((r) => r.hiring_recommendation === filterRec);
    }

    // 4. Sorting
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "score") cmp = (a.scores?.overall_score || 0) - (b.scores?.overall_score || 0);
      else if (sortField === "name") cmp = a.candidateName.localeCompare(b.candidateName);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [results, activeTab, searchQuery, sortField, sortAsc, filterStatus, filterRec]);

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
    const headers = ["ID", "Name", "Position", "Round Type", "Date", "Overall Score", "Technical", "Relevance", "Communication", "Confidence", "Recommendation", "Status"];
    const rows = filtered.map((r) => {
      const roundType = r.video_filename && String(r.video_filename).includes("[UPLOADED]") ? "L1 Tech Round" : "Initial Screening";
      return [
        r.id, r.candidateName, r.position, roundType, r.date,
        r.scores?.overall_score || 0, r.scores?.technical_proficiency || 0,
        r.scores?.relevance_to_jd || 0, r.scores?.communication || 0,
        r.scores?.confidence_level || 0, r.hiring_recommendation, r.selection_status || "pending",
      ];
    });
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
          
          <motion.div variants={fadeUp} custom={0} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Evaluation History</h1>
              <p className="text-muted-foreground mt-1">
                {results.length} total evaluation{results.length !== 1 ? "s" : ""} · {filtered.length} shown in current view
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

          {/* Split Navigation Menus */}
          <motion.div variants={fadeUp} custom={0.2} className="flex items-center gap-2 border-b border-border/50 pb-4 mt-6 overflow-x-auto hide-scrollbar">
            <button 
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "all" ? "bg-foreground/10 text-foreground border border-foreground/20 shadow-sm" : "text-muted-foreground hover:bg-muted border border-transparent"}`}
            >
              <Database className="w-4 h-4" /> All Evaluations
            </button>
            <button 
              onClick={() => setActiveTab("initial")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "initial" ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,240,255,0.3)]" : "text-muted-foreground hover:bg-muted border border-transparent"}`}
            >
              <Mic className="w-4 h-4" /> Initial Screening (Live)
            </button>
            <button 
              onClick={() => setActiveTab("l1")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "l1" ? "bg-accent text-accent-foreground shadow-[0_0_15px_rgba(139,92,246,0.3)]" : "text-muted-foreground hover:bg-muted border border-transparent"}`}
            >
              <Upload className="w-4 h-4" /> L1 Tech Round (Uploaded)
            </button>
          </motion.div>

          {/* Search & Filters */}
          <motion.div variants={fadeUp} custom={0.4} className="glass rounded-xl p-5 space-y-5 shadow-sm border border-primary/10">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab === "all" ? "all" : activeTab === "initial" ? "live" : "uploaded"} candidates by name, position, or ID...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border focus-visible:ring-primary h-11"
              />
            </div>

            {/* Filter Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-border/50">
              
              {/* Column 1: Recruiter Status */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" /> Recruiter Status
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(["all", "pending", "selected", "rejected", "hold", "doubtful"] as FilterStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-3 py-1.5 rounded-md border transition-colors ${
                        filterStatus === s
                          ? "border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(0,240,255,0.15)] font-medium"
                          : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      {s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column 2: ForgePro Recommendation */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI Recommendation
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(["all", "Strong Hire", "Lean Hire", "Reject"] as FilterRec[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setFilterRec(r)}
                      className={`px-3 py-1.5 rounded-md border transition-colors ${
                        filterRec === r
                          ? "border-accent bg-accent/10 text-accent shadow-[0_0_10px_rgba(139,92,246,0.15)] font-medium"
                          : "border-border bg-background text-muted-foreground hover:border-accent/30 hover:bg-muted/50"
                      }`}
                    >
                      {r === "all" ? "All Recs" : r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column 3: Sort Order */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <SortAsc className="w-3.5 h-3.5" /> Sort Results By
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(["date", "score", "name"] as SortField[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => toggleSort(f)}
                      className={`px-3 py-1.5 rounded-md border flex items-center gap-1.5 transition-colors ${
                        sortField === f
                          ? "border-foreground bg-foreground/10 text-foreground font-medium"
                          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:bg-muted/50"
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                      {sortField === f && <SortIcon className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>

          {/* Results List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center border border-dashed border-border/50">
              <p className="text-muted-foreground">
                {results.length === 0
                  ? "No evaluations yet. Complete an interview to see history."
                  : "No results match your filters in this category."}
              </p>
              {results.length === 0 && (
                <div className="flex gap-3 justify-center mt-3">
                  <Link to="/evaluate" className="text-primary text-sm hover:underline font-medium">Start an Interview →</Link>
                  <Link to="/upload-analysis" className="text-accent text-sm hover:underline font-medium">Upload & Analyze →</Link>
                </div>
              )}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                {filtered.map((result, i) => {
                  const isL1 = result.video_filename && String(result.video_filename).includes("[UPLOADED]");
                  
                  return (
                    <motion.div key={result.id} variants={fadeUp} custom={i * 0.05}>
                      <div className="glass rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/40 transition-all group shadow-sm">
                        <Link
                          to={`/result/${result.id}`}
                          className="flex items-center gap-4 min-w-0 flex-1"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${isL1 ? 'bg-accent/10 border-accent/20' : 'bg-primary/10 border-primary/20'}`}>
                            <User className={`w-5 h-5 ${isL1 ? 'text-accent' : 'text-primary'}`} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-foreground truncate">{result.candidateName}</h3>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-xs text-muted-foreground font-medium">{result.position}</span>
                              <span className="text-muted-foreground/30">•</span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                {result.date}
                              </span>
                              
                              {/* Round Type Badge */}
                              <span className={`flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${isL1 ? 'text-accent border-accent/30 bg-accent/5' : 'text-primary border-primary/30 bg-primary/5'}`}>
                                {isL1 ? <Upload className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                                {isL1 ? "L1 Tech Round" : "Initial Screening"}
                              </span>
                              
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70 font-mono border border-border/50 px-1.5 py-0.5 rounded">
                                <Hash className="w-2.5 h-2.5" />
                                {result.id}
                              </span>
                              {result.selection_status && result.selection_status !== "pending" && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusStyles(result.selection_status)}`}>
                                  {result.selection_status}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                        <div className="flex items-center gap-4 shrink-0">
                          <RecommendationBadge recommendation={result.hiring_recommendation} />
                          <span className="font-mono text-xl font-bold text-foreground w-10 text-right">{result.scores?.overall_score || 0}</span>
                          <div className="h-8 w-px bg-border/50 mx-1 hidden md:block"></div>
                          <button
                            onClick={() => handleDelete(result.id, result.candidateName)}
                            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete evaluation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <Link to={`/result/${result.id}`} className="p-2">
                            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      </div>
    </div>
  );
}