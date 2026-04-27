from pydantic import BaseModel, Field
from typing import Optional, List

class EvaluationRequest(BaseModel):
    candidate_name: str = Field(..., min_length=1, max_length=200)
    position: str = Field(..., min_length=1, max_length=200)
    job_description: str = Field(..., min_length=10)
    resume: str = Field(..., min_length=10)
    transcript: str = Field(..., min_length=10)
    video_filename: Optional[str] = None
    remarks: Optional[str] = None 

class QuestionGenerationRequest(BaseModel):
    job_description: str = Field(..., min_length=10)
    resume: str = Field(..., min_length=10)
    num_questions: int = Field(default=12, ge=3, le=20)
    interview_level: Optional[str] = "L2 (Mid-Level)" 

class JDGenerationRequest(BaseModel):
    position: str = Field(..., min_length=2, max_length=200)

class AcknowledgmentRequest(BaseModel):
    question: str = Field(..., min_length=5)
    answer: str = Field(..., min_length=1) # FIX: Allows short 1-word answers without crashing
    next_question: Optional[str] = None  

class SelectionStatusRequest(BaseModel):
    # 🛡️ THE FIX: Expanded regex pattern to accept the new Enterprise statuses
    status: str = Field(..., pattern="^(pending|selected|rejected|hold|doubtful)$")

class ResumeUploadResponse(BaseModel):
    filename: str
    path: str
    extracted_text: str
    size: int

class InterviewQuestion(BaseModel):
    id: int
    question: str
    category: str
    difficulty: str

class QuestionGenerationResponse(BaseModel):
    questions: List[InterviewQuestion]

class ScoresResponse(BaseModel):
    technical_proficiency: int
    relevance_to_jd: int
    communication: int
    confidence_level: int = 0
    overall_score: int

class SentimentResponse(BaseModel):
    rating: str
    explanation: str

class CandidateStatusResponse(BaseModel):
    level: str
    description: str

class EvaluationResponse(BaseModel):
    id: str
    candidateName: str
    position: str
    date: str
    candidate_overview: str
    scores: ScoresResponse
    sentiment: SentimentResponse
    candidate_status: CandidateStatusResponse
    selection_status: str
    strengths: list[str]
    red_flags_or_weaknesses: list[str]
    dynamic_follow_up_questions: list[str]
    hiring_recommendation: str
    justification: str
    video_filename: Optional[str] = None
    remarks: Optional[str] = None

    class Config:
        from_attributes = True


class SessionCreateRequest(BaseModel):
    candidate_name: str
    candidate_email: str
    recruiter_email: str
    interview_level: str
    position: str
    job_description: str
    resume_text: str
    talent_associate_name: Optional[str] = None

class SessionStatusUpdateRequest(BaseModel):
    status: str 

class FeedbackRequest(BaseModel):
    session_id: str
    candidate_name: str
    rating: int
    comments: str