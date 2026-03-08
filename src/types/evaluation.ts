export interface EvaluationInput {
  jobDescription: string;
  candidateResume: string;
  interviewTranscript: string;
  candidateName: string;
  position: string;
}

export interface EvaluationResult {
  id: string;
  candidateName: string;
  position: string;
  date: string;
  candidate_overview: string;
  scores: {
    technical_proficiency: number;
    relevance_to_jd: number;
    communication: number;
    confidence_level: number;
    overall_score: number;
  };
  sentiment: {
    rating: "Positive" | "Neutral" | "Negative";
    explanation: string;
  };
  candidate_status: {
    level: string;
    description: string;
  };
  selection_status: "pending" | "selected" | "rejected";
  strengths: string[];
  red_flags_or_weaknesses: string[];
  dynamic_follow_up_questions: string[];
  hiring_recommendation: "Strong Hire" | "Lean Hire" | "Reject";
  justification: string;
  video_filename?: string;
}
