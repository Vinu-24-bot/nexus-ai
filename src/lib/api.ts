import {
  evaluateLocally,
  saveLocalEvaluation,
  getLocalEvaluations,
  getLocalEvaluation,
  updateLocalEvaluationStatus,
  deleteLocalEvaluation,
} from "./local-evaluator";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Track backend status
let backendOnline: boolean | null = null;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30s

export async function checkBackendHealth(): Promise<boolean> {
  const now = Date.now();
  if (backendOnline !== null && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return backendOnline;
  }
  try {
    const res = await fetch(`${API_BASE}/`, { signal: AbortSignal.timeout(3000) });
    backendOnline = res.ok;
  } catch {
    backendOnline = false;
  }
  lastHealthCheck = now;
  return backendOnline;
}

export function getBackendStatus(): boolean | null {
  return backendOnline;
}

export interface EvaluationPayload {
  candidate_name: string;
  position: string;
  job_description: string;
  resume: string;
  transcript: string;
  video_filename?: string;
}

export interface InterviewQuestion {
  id: number;
  question: string;
  category: string;
  difficulty: string;
}

export async function generateQuestions(
  job_description: string,
  resume: string,
  num_questions: number = 6
): Promise<InterviewQuestion[]> {
  const res = await fetch(`${API_BASE}/api/generate-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_description, resume, num_questions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "Failed to generate questions");
  }
  const data = await res.json();
  return data.questions;
}

export async function generateJD(position: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/generate-jd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ position }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "Failed to generate JD");
  }
  const data = await res.json();
  return data.job_description;
}

export async function getAcknowledgment(question: string, answer: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/acknowledge-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer }),
    });
    if (!res.ok) return "Thank you. Let's continue.";
    const data = await res.json();
    return data.acknowledgment;
  } catch {
    return "Thank you for your answer. Let's move on.";
  }
}

export async function submitEvaluation(payload: EvaluationPayload) {
  try {
    const online = await checkBackendHealth();
    if (!online) throw new Error("Backend offline");

    const res = await fetch(`${API_BASE}/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000), // 2 min timeout for AI deep analysis
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Server error" }));
      console.warn(`[BATS] Backend evaluate returned ${res.status}: ${err.detail}`);
      throw new Error(err.detail || "Evaluation failed");
    }
    backendOnline = true;
    return res.json();
  } catch (err: any) {
    // Fallback to local evaluation
    console.log("[BATS] Backend unavailable or failed, running local evaluation...", err.message);
    const localResult = evaluateLocally(payload);
    saveLocalEvaluation(localResult);
    return localResult;
  }
}

export async function uploadVideo(file: Blob, filename: string) {
  const formData = new FormData();
  formData.append("video", file, filename);
  const res = await fetch(`${API_BASE}/api/upload-video`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Video upload failed");
  return res.json();
}

export async function uploadResume(file: File): Promise<{ filename: string; extracted_text: string; size: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload-resume`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Resume upload failed" }));
    throw new Error(err.detail || "Resume upload failed");
  }
  return res.json();
}

export async function getEvaluations() {
  try {
    const res = await fetch(`${API_BASE}/api/evaluations`);
    if (!res.ok) throw new Error("Failed to fetch evaluations");
    const serverData = await res.json();
    backendOnline = true;
    // Merge with local evaluations
    const localData = getLocalEvaluations();
    const serverIds = new Set(serverData.map((e: any) => e.id));
    const merged = [...serverData, ...localData.filter((e) => !serverIds.has(e.id))];
    return merged;
  } catch {
    backendOnline = false;
    // Return local evaluations only
    return getLocalEvaluations();
  }
}

export async function getEvaluation(id: string) {
  try {
    const res = await fetch(`${API_BASE}/api/evaluations/${id}`);
    if (!res.ok) throw new Error("Evaluation not found");
    return res.json();
  } catch {
    // Try local storage
    const local = getLocalEvaluation(id);
    if (local) return local;
    throw new Error("Evaluation not found");
  }
}

export async function updateSelectionStatus(id: string, status: "pending" | "selected" | "rejected") {
  try {
    const res = await fetch(`${API_BASE}/api/evaluations/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Status update failed");
    return res.json();
  } catch {
    // Try local
    const updated = updateLocalEvaluationStatus(id, status);
    if (updated) return updated;
    throw new Error("Status update failed");
  }
}

export async function deleteEvaluation(id: string) {
  try {
    const res = await fetch(`${API_BASE}/api/evaluations/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    return res.json();
  } catch {
    deleteLocalEvaluation(id);
    return { message: "Deleted locally" };
  }
}

// ─── ENTERPRISE UPGRADES ──────────────────────────────────────

export async function getStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  } catch {
    // Compute from local data (Upgraded with new enterprise metrics)
    const evals = getLocalEvaluations() as any[];
    const total = evals.length;
    
    if (total === 0) return { 
      total: 0, avg_score: 0, strong_hires: 0, lean_hires: 0, 
      rejects: 0, selected: 0, rejected: 0, pending: 0,
      pipeline_health: "No Data", top_scorer: null, positions: []
    };
    
    const scores = evals.map((e) => e.scores?.overall_score || 0);
    const strong_hires = evals.filter((e) => e.hiring_recommendation === "Strong Hire").length;
    const lean_hires = evals.filter((e) => e.hiring_recommendation === "Lean Hire").length;
    
    const hire_rate = (strong_hires + lean_hires) / total;
    let pipeline_health = "Healthy";
    if (hire_rate >= 0.4) pipeline_health = "Excellent";
    if (hire_rate < 0.15) pipeline_health = "Needs Adjustment";

    return {
      total,
      avg_score: Math.round(scores.reduce((a, b) => a + b, 0) / total),
      strong_hires,
      lean_hires,
      rejects: evals.filter((e) => e.hiring_recommendation === "Reject").length,
      selected: evals.filter((e) => e.selection_status === "selected").length,
      rejected: evals.filter((e) => e.selection_status === "rejected").length,
      pending: evals.filter((e) => e.selection_status === "pending").length,
      pipeline_health,
      top_scorer: evals.length > 0 ? [...evals].sort((a,b) => (b.scores?.overall_score || 0) - (a.scores?.overall_score || 0))[0].candidate_name : null,
      positions: Array.from(new Set(evals.map(e => e.position)))
    };
  }
}

export async function compareCandidates(candidateIds: string[]) {
  try {
    const res = await fetch(`${API_BASE}/api/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candidateIds),
    });
    if (!res.ok) throw new Error("Failed to generate Debrief Matrix");
    return res.json();
  } catch (err: any) {
    throw new Error(err.message || "Failed to compare candidates");
  }
}