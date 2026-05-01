import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Search, Download, RefreshCcw, Trash2, ArrowRight, 
  Filter, ChevronDown, Loader2, User, Calendar, AlertTriangle 
} from "lucide-react";
import { getEvaluations, deleteEvaluation } from "@/lib/api";
import { EvaluationResult } from "@/types/evaluation";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import RecommendationBadge from "@/components/RecommendationBadge";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.4 },
  }),
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All Evaluations");
  const [sortBy, setSortBy] = useState("Date");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [recFilter, setRecFilter] = useState("All Recommendations");

  const [showExportMenu, setShowExportMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const data = await getEvaluations();
      setEvaluations(data);
    } catch (error) {
      toast.error("Failed to load evaluations");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    if (!window.confirm("Are you sure you want to permanently delete this evaluation?")) return;
    try {
      await deleteEvaluation(id);
      setEvaluations(evaluations.filter((ev) => ev.id !== id));
      toast.success("Evaluation deleted securely");
    } catch (error) {
      toast.error("Failed to delete evaluation");
    }
  };

  const filteredEvals = useMemo(() => {
    let filtered = [...evaluations];

    if (activeTab === "Initial Screening (Live)") {
      filtered = filtered.filter(ev => {
        const v = ev.video_filename || "";
        return v === "LIVE_SCREENING" || v === "NO_VIDEO" || v === "";
      });
    } else if (activeTab === "L1 Tech Round (Uploaded)") {
      filtered = filtered.filter(ev => {
        const v = ev.video_filename || "";
        return v !== "LIVE_SCREENING" && v !== "NO_VIDEO" && v !== "";
      });
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(ev => 
        ev.candidateName.toLowerCase().includes(q) || 
        ev.position.toLowerCase().includes(q) || 
        ev.id.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "All Statuses") {
      filtered = filtered.filter(ev => ev.selection_status?.toLowerCase() === statusFilter.toLowerCase());
    }

    if (recFilter !== "All Recommendations") {
      filtered = filtered.filter(ev => ev.hiring_recommendation === recFilter);
    }

    filtered.sort((a, b) => {
      if (sortBy === "Score") {
        return (b.scores?.overall_score || 0) - (a.scores?.overall_score || 0);
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return filtered;
  }, [evaluations, search, activeTab, sortBy, statusFilter, recFilter]);

  const generateCohortHTML = () => {
    const baseUrl = window.location.origin;
    return `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>ForgePro Cohort Report</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background: #ffffff; padding: 40px; margin: 0 auto; max-width: 1000px; }
          .header { text-align: center; border-bottom: 2px solid #00b4d8; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: 1.5px; }
          .logo-accent { color: #00b4d8; }
          h1 { color: #0f172a; font-size: 24px; margin-top: 10px; text-transform: uppercase; }
          .meta { color: #64748b; font-size: 14px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #e2e8f0; padding: 14px 16px; text-align: left; vertical-align: middle; }
          th { background: #f8fafc; color: #0f172a; font-weight: 700; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
          tr:nth-child(even) { background: #fcfcfc; }
          .score { font-weight: bold; color: #00b4d8; font-size: 18px; }
          .link-btn { display: inline-block; padding: 8px 14px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">BATS FORGE<span class="logo-accent">PRO</span></div>
          <h1>Cohort Evaluation Report</h1>
          <div class="meta">Exported: ${new Date().toLocaleDateString()} | Active View: ${activeTab} | Total Candidates: ${filteredEvals.length}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Candidate Details</th>
              <th>Role & Date</th>
              <th>Recommendation</th>
              <th>Overall Score</th>
              <th>Action Link</th>
            </tr>
          </thead>
          <tbody>
            ${filteredEvals.map(ev => `
              <tr>
                <td><strong>${ev.candidateName}</strong><br><span style="color: #64748b; font-size: 11px;">ID: ${ev.id}</span></td>
                <td>${ev.position}<br><span style="color: #64748b; font-size: 12px;">${ev.date}</span></td>
                <td><strong>${ev.hiring_recommendation}</strong><br><span style="color: #64748b; font-size: 11px;">Status: ${ev.selection_status?.toUpperCase() || 'PENDING'}</span></td>
                <td class="score">${ev.scores?.overall_score || 0}/100</td>
                <td><a href="${baseUrl}/result/${ev.id}" class="link-btn">View Session ▶</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
  };

  const exportJSON = () => {
    if (filteredEvals.length === 0) return toast.error("No data to export");
    const dataWithLinks = filteredEvals.map(ev => ({ ...ev, secure_session_link: `${window.location.origin}/result/${ev.id}` }));
    const blob = new Blob([JSON.stringify(dataWithLinks, null, 2)], { type: "application/json" });
    downloadBlob(blob, "json");
  };

  const exportCSV = () => {
    if (filteredEvals.length === 0) return toast.error("No data to export");
    const headers = ["ID", "Name", "Position", "Date", "Recommendation", "Status", "Score", "Session Link"];
    const rows = filteredEvals.map(ev => [
      ev.id, `"${ev.candidateName}"`, `"${ev.position}"`, ev.date, 
      ev.hiring_recommendation, ev.selection_status || "pending", 
      ev.scores?.overall_score || 0, `${window.location.origin}/result/${ev.id}`
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, "csv");
  };

  const exportHTML = () => {
    if (filteredEvals.length === 0) return toast.error("No data to export");
    const blob = new Blob([generateCohortHTML()], { type: "text/html" });
    downloadBlob(blob, "html");
  };

  const exportDOCX = () => {
    if (filteredEvals.length === 0) return toast.error("No data to export");
    const blob = new Blob(['\ufeff', generateCohortHTML()], { type: "application/msword" });
    downloadBlob(blob, "doc");
  };

  const exportTXT = () => {
    if (filteredEvals.length === 0) return toast.error("No data to export");
    let text = `BATS FORGEPRO COHORT REPORT\nExported: ${new Date().toLocaleDateString()} | View: ${activeTab}\nTotal Candidates: ${filteredEvals.length}\n\n`;
    text += "--------------------------------------------------\n";
    filteredEvals.forEach((ev, i) => {
      text += `${i + 1}. Candidate: ${ev.candidateName} (ID: ${ev.id})\n`;
      text += `   Role: ${ev.position} | Date: ${ev.date}\n`;
      text += `   Recommendation: ${ev.hiring_recommendation} (${ev.selection_status?.toUpperCase() || 'PENDING'})\n`;
      text += `   Overall Score: ${ev.scores?.overall_score || 0}/100\n`;
      text += `   ▶ SECURE LINK: ${window.location.origin}/result/${ev.id}\n`;
      text += "--------------------------------------------------\n";
    });
    const blob = new Blob([text], { type: "text/plain" });
    downloadBlob(blob, "txt");
  };

  const exportPDF = () => {
    if (filteredEvals.length === 0) return toast.error("No data to export");
    toast.info("Generating PDF Cohort Report...");
    const element = document.createElement('div');
    element.innerHTML = generateCohortHTML();
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      // @ts-ignore
      window.html2pdf().set({
        margin: [15, 15, 15, 15], 
        filename: `ForgePro_Cohort_Report_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } 
      }).from(element).save().then(() => toast.success("PDF Downloaded successfully!"));
    };
    document.body.appendChild(script);
  };

  const downloadBlob = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ForgePro_Cohort_Report_${new Date().getTime()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    toast.success(`Exported ${filteredEvals.length} candidates as ${ext.toUpperCase()}`);
  };

  return (
    <div className="min-h-screen bg-background nexus-grid pb-20">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-6xl">
        <motion.div initial="hidden" animate="visible" className="space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Evaluation History</h1>
              <p className="text-muted-foreground mt-1">
                {evaluations.length} total evaluation{evaluations.length !== 1 && "s"} · {filteredEvals.length} shown in current view
              </p>
            </div>
            
            <div className="flex items-center gap-3 relative z-50">
              <div className="relative" ref={dropdownRef}>
                <Button 
                  variant="outline" 
                  onClick={() => setShowExportMenu(!showExportMenu)} 
                  className="bg-card text-muted-foreground hover:text-primary transition-all shadow-sm"
                >
                  <Download className="w-4 h-4 mr-2" /> Export View <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
                
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-border/50 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <button onClick={exportPDF} className="w-full text-left px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors border-b border-border/30">
                      PDF Report
                    </button>
                    <button onClick={exportDOCX} className="w-full text-left px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors border-b border-border/30">
                      Word (DOCX)
                    </button>
                    <button onClick={exportHTML} className="w-full text-left px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors border-b border-border/30">
                      HTML Webpage
                    </button>
                    <button onClick={exportCSV} className="w-full text-left px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors border-b border-border/30">
                      CSV Spreadsheet
                    </button>
                    <button onClick={exportTXT} className="w-full text-left px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors border-b border-border/30">
                      Plain Text
                    </button>
                    <button onClick={exportJSON} className="w-full text-left px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors">
                      Raw JSON
                    </button>
                  </div>
                )}
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => { setIsRefreshing(true); fetchData(); }} 
                className="bg-card text-muted-foreground hover:text-foreground shadow-sm px-3"
                title="Refresh Data"
              >
                <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-b border-border/50 pb-4">
            {["All Evaluations", "Initial Screening (Live)", "L1 Tech Round (Uploaded)"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="glass p-4 rounded-xl border border-border/50 shadow-sm flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search all candidates by name, position, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              />
            </div>
            
            <div className="flex flex-wrap lg:flex-nowrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"><Filter className="w-3 h-3 inline mr-1" /> Sort By</span>
                <select 
                  value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
                >
                  <option value="Date">Date</option>
                  <option value="Score">Score</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"><Filter className="w-3 h-3 inline mr-1" /> Status</span>
                <select 
                  value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
                >
                  <option value="All Statuses">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="selected">Selected</option>
                  <option value="rejected">Rejected</option>
                  <option value="hold">Hold</option>
                  <option value="doubtful">Doubtful</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"><Filter className="w-3 h-3 inline mr-1" /> ForgePro Verdict</span>
                <select 
                  value={recFilter} onChange={(e) => setRecFilter(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
                >
                  <option value="All Recommendations">All Recommendations</option>
                  <option value="Strong Hire">Strong Hire</option>
                  <option value="Lean Hire">Lean Hire</option>
                  <option value="Reject">Reject</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredEvals.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center border border-border/50 border-dashed">
              <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-foreground">No evaluations found</h3>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter settings.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvals.map((ev, i) => (
                <motion.div 
                  key={ev.id} variants={fadeUp} custom={i}
                  onClick={() => navigate(`/result/${ev.id}`)}
                  className="cursor-pointer glass p-5 rounded-xl border border-border/50 hover:border-primary/50 transition-all shadow-sm flex flex-col md:flex-row items-center gap-6 group"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{ev.candidateName}</h3>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-sm text-muted-foreground mt-1">
                      <span>{ev.position}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {ev.date}</span>
                      {ev.video_filename && ev.video_filename !== "LIVE_SCREENING" && ev.video_filename !== "NO_VIDEO" && (
                        <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-accent/10 text-accent border border-accent/20 tracking-wider">
                          L1 TECH ROUND
                        </span>
                      )}
                    </div>
                    <div className="mt-2 font-mono text-xs text-muted-foreground/70 bg-muted/50 inline-block px-2 py-1 rounded border border-border/50">
                      # {ev.id}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <RecommendationBadge recommendation={ev.hiring_recommendation} />
                    
                    <div className="text-center shrink-0 w-16">
                      <div className="text-2xl font-black text-foreground group-hover:text-primary transition-colors">{ev.scores?.overall_score || 0}</div>
                    </div>

                    <div className="flex items-center gap-2 border-l border-border/50 pl-6">
                      <button 
                        onClick={(e) => handleDelete(e, ev.id)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Delete Evaluation"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <div 
                        className="p-2 text-muted-foreground rounded-lg transition-colors group-hover:text-primary group-hover:translate-x-1"
                        title="View Full Report"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}