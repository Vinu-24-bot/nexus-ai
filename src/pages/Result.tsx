import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, MessageSquare,
  HelpCircle, FileText, Sparkles, Loader2, Play, Pause,
  Smile, Meh, Frown, Shield, Download, Copy, UserCheck, UserX, ShieldAlert,
  Clock, Maximize, Minimize, Rewind, FastForward, Volume2, VolumeX, Settings,
  VideoOff, ChevronDown
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
  Positive: "text-nexus-green bg-nexus-green/10 border-nexus-green/20",
  Neutral: "text-nexus-amber bg-nexus-amber/10 border-nexus-amber/20",
  Negative: "text-nexus-red bg-nexus-red/10 border-nexus-red/20",
};

const statusStyles: Record<string, string> = {
  pending: "text-nexus-amber bg-nexus-amber/10 border-nexus-amber/30",
  selected: "text-nexus-green bg-nexus-green/10 border-nexus-green/30 shadow-[0_0_10px_rgba(34,197,94,0.15)]",
  rejected: "text-nexus-red bg-nexus-red/10 border-nexus-red/30",
  hold: "text-blue-500 bg-blue-500/10 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.15)]",
  doubtful: "text-orange-500 bg-orange-500/10 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.15)]",
};

const ForgeProVideoPlayer = ({ src, fallbackDuration }: { src: string, fallbackDuration: number }) => {
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
  const [hasError, setHasError] = useState(false);

  const togglePlay = () => {
    if (hasError || !videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => setHasError(true));
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (hasError || !videoRef.current || isScrubbing) return;
    
    const vid = videoRef.current;
    setCurrentTime(vid.currentTime);
    
    let d = vid.duration;
    // 🛡️ THE FIX: Hard math check. If native duration fails, inject the backend's recorded duration.
    if (isNaN(d) || !isFinite(d) || d <= 0) {
      d = fallbackDuration > 0 ? fallbackDuration : (vid.buffered && vid.buffered.length > 0 ? vid.buffered.end(vid.buffered.length - 1) : 0);
    }

    if (d > 0 && isFinite(d)) {
      setDuration(d);
      setProgress((vid.currentTime / d) * 100);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = Number(e.target.value);
    setProgress(newProgress);
    if (videoRef.current && duration > 0) {
      const newTime = (newProgress / 100) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const skip = (amount: number) => {
    if (hasError || !videoRef.current) return;
    const newTime = Math.max(0, videoRef.current.currentTime + amount);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
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
    if (isNaN(time) || !isFinite(time) || time < 0) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (hasError) {
    return (
      <div className="relative group w-full aspect-video bg-muted/30 rounded-lg overflow-hidden flex flex-col items-center justify-center shadow-inner border border-destructive/30 border-dashed">
        <VideoOff className="w-10 h-10 text-destructive/50 mb-3" />
        <p className="text-sm font-semibold text-foreground tracking-wide">Video Unavailable</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center px-4">
          This recording was deleted from the server storage (likely due to a backend redeployment on a free tier host). Please configure Cloud Storage in your backend.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative group w-full bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center shadow-inner border border-border/50">
      
      <video 
        ref={videoRef} 
        src={src} 
        className="w-full max-h-[600px] cursor-pointer outline-none" 
        onClick={togglePlay} 
        onTimeUpdate={handleTimeUpdate} 
        onError={() => setHasError(true)} 
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
  
  const [showExportMenu, setShowExportMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getEvaluation(id)
      .then(setResult)
      .catch(() => {
        toast.error("Could not load evaluation. Is the backend running?");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const getRingSVG = (score: number, label: string, color: string) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    return `
      <div style="text-align: center; display: flex; flex-direction: column; align-items: center; padding: 10px;">
        <svg width="90" height="90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="${radius}" stroke="#e2e8f0" stroke-width="8" fill="none" />
          <circle cx="50" cy="50" r="${radius}" stroke="${color}" stroke-width="8" fill="none"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90 50 50)" />
          <text x="50" y="57" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0f172a" text-anchor="middle">${score}</text>
        </svg>
        <div style="font-size: 13px; color: #475569; font-weight: 700; margin-top: 8px;">${label}</div>
      </div>
    `;
  };

  const getRadarSVG = (scores: any) => {
    const t = scores.technical_proficiency || 0;
    const r = scores.relevance_to_jd || 0;
    const c = scores.communication || 0;
    const cf = scores.confidence_level || 0;

    const ptT = `120,${120 - t * 0.8}`;
    const ptR = `${120 + r * 0.8},120`;
    const ptC = `120,${120 + c * 0.8}`;
    const ptCf = `${120 - cf * 0.8},120`;

    return `
      <div style="text-align: center; width: 100%; display: flex; justify-content: center; align-items: center;">
        <svg width="250" height="250" viewBox="0 0 240 240" style="display: block;">
          <!-- Radar Web -->
          <polygon points="120,40 200,120 120,200 40,120" fill="none" stroke="#cbd5e1" stroke-width="1"/>
          <polygon points="120,60 180,120 120,180 60,120" fill="none" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2 2"/>
          <polygon points="120,80 160,120 120,160 80,120" fill="none" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2 2"/>
          <polygon points="120,100 140,120 120,140 100,120" fill="none" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2 2"/>
          <!-- Axes -->
          <line x1="120" y1="40" x2="120" y2="200" stroke="#cbd5e1" stroke-width="1"/>
          <line x1="40" y1="120" x2="200" y2="120" stroke="#cbd5e1" stroke-width="1"/>
          <!-- Data Polygon -->
          <polygon points="${ptT} ${ptR} ${ptC} ${ptCf}" fill="rgba(0, 180, 216, 0.25)" stroke="#00b4d8" stroke-width="2.5"/>
          <!-- Dots -->
          <circle cx="120" cy="${120 - t * 0.8}" r="4.5" fill="#00b4d8" />
          <circle cx="${120 + r * 0.8}" cy="120" r="4.5" fill="#00b4d8" />
          <circle cx="120" cy="${120 + c * 0.8}" r="4.5" fill="#00b4d8" />
          <circle cx="${120 - cf * 0.8}" cy="120" r="4.5" fill="#00b4d8" />
          <!-- Labels -->
          <text x="120" y="30" font-family="sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">Technical</text>
          <text x="205" y="124" font-family="sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="start">Relevance</text>
          <text x="120" y="218" font-family="sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">Communication</text>
          <text x="35" y="124" font-family="sans-serif" font-size="11" font-weight="bold" fill="#334155" text-anchor="end">Confidence</text>
        </svg>
      </div>
    `;
  };

  const generateProfessionalHTML = () => {
    if (!result) return "";
    const sessionUrl = window.location.href;
    
    return `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${result.candidateName} - ForgePro Evaluation</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.6; min-width: 800px; max-width: 850px; margin: 0 auto; padding: 40px; background: #ffffff; }
          .header { text-align: center; border-bottom: 2px solid #00b4d8; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: 1.5px; }
          .logo-accent { color: #00b4d8; }
          h1 { color: #0f172a; margin-bottom: 5px; font-size: 32px; }
          .meta { color: #64748b; font-size: 14px; font-weight: 500; }
          h2 { color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 30px; font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px;}
          .section-block { page-break-inside: avoid; break-inside: avoid; margin-bottom: 25px; }
          .verdict-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 6px solid #00b4d8; padding: 25px; border-radius: 8px; }
          .verdict-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 5px; }
          .verdict-value { font-size: 26px; font-weight: 800; color: #0f172a; }
          .dashboard-container { display: flex; flex-direction: row; justify-content: space-evenly; align-items: center; background: #f8fafc; padding: 25px; border-radius: 8px; border: 1px solid #e2e8f0; gap: 20px;}
          .rings-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: 350px; justify-items: center; align-items: center;}
          ul.list { padding-left: 20px; color: #334155; margin-top: 10px; }
          ul.list li { margin-bottom: 8px; }
          .justification { background: #f8fafc; padding: 25px; border-radius: 8px; font-style: italic; color: #475569; border: 1px solid #e2e8f0; }
          .cta-box { text-align: center; margin-top: 50px; padding: 35px; background: #0f172a; border-radius: 12px; }
          .cta-text { color: #cbd5e1; margin-bottom: 20px; font-size: 15px; }
          .cta-btn { display: inline-block; background: #00b4d8; color: #0f172a; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">BATS FORGE<span class="logo-accent">PRO</span></div>
          <h1>${result.candidateName}</h1>
          <div class="meta">Role: ${result.position} | ID: ${result.id} | Date: ${result.date}</div>
        </div>

        <div class="section-block">
          <div class="verdict-box">
            <div class="verdict-title">Final Recommendation</div>
            <div class="verdict-value">${result.hiring_recommendation} <span style="font-size: 18px; font-weight: 600; color: #64748b;">(${result.selection_status.toUpperCase()})</span></div>
          </div>
        </div>

        <div class="section-block">
          <h2>Executive Summary</h2>
          <p style="color: #334155; font-size: 15px;">${result.candidate_overview}</p>
        </div>

        <div class="section-block">
          <h2>Performance Dashboard</h2>
          <div class="dashboard-container">
            <!-- Radar Chart -->
            <div style="width: 260px;">
              ${getRadarSVG(result.scores)}
            </div>
            
            <!-- Exact 2x2 Grid for Score Rings -->
            <div class="rings-container">
              ${getRingSVG(result.scores.technical_proficiency, "Technical", "#14b8a6")}
              ${getRingSVG(result.scores.relevance_to_jd, "Relevance", "#8b5cf6")}
              ${getRingSVG(result.scores.communication, "Communication", "#3b82f6")}
              ${getRingSVG(result.scores.confidence_level || 0, "Confidence", "#f59e0b")}
            </div>
          </div>
          <div style="text-align: center; margin-top: 15px; font-size: 16px; font-weight: bold; color: #334155;">
            Overall Score: <span style="color: #00b4d8;">${result.scores.overall_score}/100</span>
          </div>
        </div>

        <!-- 🛡️ INJECTED: Analysis Details (Vocal Sentiment & Readiness Level) -->
        <div class="section-block">
          <h2>Analysis Details</h2>
          <div style="display: flex; gap: 20px;">
            <div style="flex: 1; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 5px;">Vocal Sentiment</div>
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">${result.sentiment?.rating || "Neutral"}</div>
              <div style="font-size: 14px; color: #475569;">${result.sentiment?.explanation || "No explanation provided."}</div>
            </div>
            <div style="flex: 1; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 5px;">Readiness Level</div>
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">${result.candidate_status?.level || "Pending"}</div>
              <div style="font-size: 14px; color: #475569;">${result.candidate_status?.description || "No description provided."}</div>
            </div>
          </div>
        </div>

        <div class="section-block">
          <h2>Identified Strengths</h2>
          <ul class="list">
            ${result.strengths.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>

        <div class="section-block">
          <h2>Red Flags & Gaps</h2>
          <ul class="list">
            ${result.red_flags_or_weaknesses.map(w => `<li>${w}</li>`).join('')}
          </ul>
        </div>

        <!-- 🛡️ INJECTED: Suggested Follow-Up Questions -->
        <div class="section-block">
          <h2>Suggested Follow-Up Questions</h2>
          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 15px;">
            ${result.dynamic_follow_up_questions.map(q => `<div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; color: #334155; font-size: 14px;"><strong>Q:</strong> ${q}</div>`).join('')}
          </div>
        </div>

        <div class="section-block">
          <h2>Manager Justification</h2>
          <div class="justification">
            ${result.justification}
          </div>
        </div>

        <div class="section-block cta-box">
          <div class="cta-text">Review the full AI telemetry, raw data, and candidate video securely on the ForgePro dashboard.</div>
          <a href="${sessionUrl}" class="cta-btn">▶ Access Secure Session Recording</a>
        </div>
      </body>
      </html>
    `;
  };

  const exportJSON = () => {
    if (!result) return;
    const dataToExport = { ...result, secure_session_link: window.location.href };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    downloadBlob(blob, "json");
  };

  const exportHTML = () => {
    const blob = new Blob([generateProfessionalHTML()], { type: "text/html" });
    downloadBlob(blob, "html");
  };

  const exportDOCX = () => {
    const blob = new Blob(['\ufeff', generateProfessionalHTML()], { type: "application/msword" });
    downloadBlob(blob, "doc");
  };

  const exportTXT = () => {
    if (!result) return;
    const text = `
BATS FORGEPRO EVALUATION REPORT
--------------------------------------------------
Candidate: ${result.candidateName}
Role: ${result.position}
Date: ${result.date}
Candidate ID: ${result.id}

RECOMMENDATION: ${result.hiring_recommendation} (${result.selection_status.toUpperCase()})
OVERALL SCORE: ${result.scores.overall_score}/100

▶ VIEW SECURE SESSION RECORDING: ${window.location.href}
--------------------------------------------------

EXECUTIVE SUMMARY:
${result.candidate_overview}

SCORES:
- Technical Proficiency: ${result.scores.technical_proficiency}/100
- Relevance to JD: ${result.scores.relevance_to_jd}/100
- Communication: ${result.scores.communication}/100
- Confidence Level: ${result.scores.confidence_level}/100

ANALYSIS DETAILS:
- Vocal Sentiment: ${result.sentiment?.rating || "Neutral"}
  ${result.sentiment?.explanation || ""}
- Readiness Level: ${result.candidate_status?.level || "Pending"}
  ${result.candidate_status?.description || ""}

STRENGTHS:
${result.strengths.map(s => `- ${s}`).join('\n')}

RED FLAGS:
${result.red_flags_or_weaknesses.map(w => `- ${w}`).join('\n')}

SUGGESTED FOLLOW-UP QUESTIONS:
${result.dynamic_follow_up_questions.map(q => `- ${q}`).join('\n')}

JUSTIFICATION:
${result.justification}
    `.trim();
    
    const blob = new Blob([text], { type: "text/plain" });
    downloadBlob(blob, "txt");
  };

  const exportPDF = () => {
    toast.info("Generating beautiful PDF Document...");
    const element = document.createElement('div');
    element.innerHTML = generateProfessionalHTML();
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      // @ts-ignore
      window.html2pdf().set({
        margin: [15, 10, 15, 10], 
        filename: `${result?.candidateName.replace(/\s+/g, "_")}_ForgePro_Report.pdf`,
        image: { type: 'jpeg', quality: 1.0 }, 
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(element).save().then(() => toast.success("PDF Downloaded successfully!"));
    };
    document.body.appendChild(script);
  };

  const downloadBlob = (blob: Blob, ext: string) => {
    if (!result) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.candidateName.replace(/\s+/g, "_")}_ForgePro_Report.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  let fallbackVideoDuration = 0;
  try {
    if (result && (result as any).remarks && String((result as any).remarks).includes("METRICS_PAYLOAD:")) {
       const parts = String((result as any).remarks).split("METRICS_PAYLOAD:");
       const payload = JSON.parse(parts[1]);
       if (payload && payload.interview_duration_seconds) fallbackVideoDuration = payload.interview_duration_seconds;
    }
  } catch(e) {}

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
  
  const rawVideoFiles = result.video_filename && result.video_filename !== "LIVE_SCREENING" && result.video_filename !== "NO_VIDEO" ? result.video_filename.split(", ").filter(Boolean) : [];
  const videoFiles = rawVideoFiles.map((f) => {
    const cleanName = f.replace(/^\[.*?\]\s*/, "");
    const url = cleanName.startsWith("http") ? cleanName : `${API_BASE}/api/stream/${encodeURIComponent(cleanName)}`;
    return { name: cleanName.split("/").pop() || cleanName, url };
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
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                  {result.candidateName}
                </h1>
                <p className="text-muted-foreground mt-1 text-lg">
                  {result.position}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <button 
                    onClick={() => { navigator.clipboard.writeText(result.id); toast.success("Candidate ID copied!"); }}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground font-mono border border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all cursor-pointer group"
                    title="Copy ID to Clipboard"
                  >
                    ID: {result.id}
                    <Copy className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
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

          <motion.div variants={fadeUp} custom={0.5} className="relative z-50 flex flex-wrap items-center justify-between gap-4 p-4 glass rounded-xl border border-primary/10 shadow-sm">
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
            
            <div className="relative ml-auto" ref={dropdownRef}>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowExportMenu(!showExportMenu)} 
                className="text-muted-foreground hover:text-primary transition-all"
              >
                <Download className="w-4 h-4 mr-1.5" /> Export <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
              
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-card border border-border/50 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                  <button onClick={exportPDF} className="w-full text-left px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors border-b border-border/30">
                    PDF Document
                  </button>
                  <button onClick={exportDOCX} className="w-full text-left px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors border-b border-border/30">
                    Word (DOCX)
                  </button>
                  <button onClick={exportHTML} className="w-full text-left px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors border-b border-border/30">
                    HTML Webpage
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
          </motion.div>

          {/* @ts-ignore */}
          {(result as any).remarks && (result as any).remarks !== "Completed normally without interruptions." && (result as any).remarks !== "Completed normally." && !(result as any).remarks.includes("METRICS_PAYLOAD:") && (
            <motion.div variants={fadeUp} custom={0.8} className="w-full bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-6 flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-destructive uppercase tracking-wider">System Alert / Security Breach</h3>
                {/* @ts-ignore */}
                <p className="text-sm text-foreground">{(result as any).remarks.split("METRICS_PAYLOAD:")[0]}</p>
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
                <div className="px-3 py-1 rounded-full text-xs font-bold border bg-primary/10 text-primary border-primary/20 inline-block">
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

          {videoFiles.length > 0 && (
            <motion.div variants={fadeUp} custom={2.5} className="glass rounded-xl p-6 border border-border/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Session Recording</h2>
                </div>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded border border-border/50">ForgePro Video Engine</span>
              </div>
              <div className="w-full">
                {videoFiles.map((vf, i) => (
                  <ForgeProVideoPlayer key={i} src={vf.url} fallbackDuration={fallbackVideoDuration} />
                ))}
              </div>
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