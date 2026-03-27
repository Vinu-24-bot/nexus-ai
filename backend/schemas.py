from pydantic import BaseModel, Field
from typing import Optional, List

class EvaluationRequest(BaseModel):
    candidate_name: str = Field(..., min_length=1, max_length=200)
    position: str = Field(..., min_length=1, max_length=200)
    job_description: str = Field(..., min_length=10)
    resume: str = Field(..., min_length=10)
    transcript: str = Field(..., min_length=10)
    video_filename: Optional[str] = None

class QuestionGenerationRequest(BaseModel):
    job_description: str = Field(..., min_length=10)
    resume: str = Field(..., min_length=10)
    num_questions: int = Field(default=12, ge=3, le=20)

class JDGenerationRequest(BaseModel):
    position: str = Field(..., min_length=2, max_length=200)

class AcknowledgmentRequest(BaseModel):
    question: str = Field(..., min_length=5)
    answer: str = Field(..., min_length=3)

class SelectionStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(pending|selected|rejected)$")

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

    class Config:
        from_attributes = True