import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, JSON

from database import Base

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(String, primary_key=True)  # Set dynamically in main.py as BATS-Name_Role-hash
    candidate_name = Column(String(200), nullable=False)
    position = Column(String(200), nullable=False)
    date = Column(String(20), default=lambda: datetime.now().strftime("%Y-%m-%d"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Input data
    job_description = Column(Text, nullable=False)
    resume = Column(Text, nullable=False)
    transcript = Column(Text, nullable=False)
    video_filename = Column(String(500), nullable=True)

    # AI evaluation results (stored as JSON)
    candidate_overview = Column(Text, default="")
    scores = Column(JSON, default=dict)
    strengths = Column(JSON, default=list)
    red_flags_or_weaknesses = Column(JSON, default=list)
    dynamic_follow_up_questions = Column(JSON, default=list)
    hiring_recommendation = Column(String(50), default="")
    justification = Column(Text, default="")
    remarks = Column(Text, default="")

    # New fields from video reference
    sentiment = Column(JSON, default=lambda: {"rating": "Neutral", "explanation": ""})
    candidate_status = Column(JSON, default=lambda: {"level": "Moderate Confidence", "description": ""})
    selection_status = Column(String(50), default="pending")  # pending | selected | rejected

class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    
    # This ID will be the unique link the candidate clicks
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    candidate_name = Column(String, index=True)
    candidate_email = Column(String)
    
    # NEW ENTERPRISE FIELDS
    recruiter_email = Column(String, nullable=True) 
    interview_level = Column(String, default="L2 (Mid-Level)") 
    
    position = Column(String)
    job_description = Column(Text)
    resume_text = Column(Text)
    
    status = Column(String, default="pending") # pending, started, completed, terminated
    created_at = Column(DateTime, default=datetime.utcnow)

class CandidateFeedback(Base):
    __tablename__ = "candidate_feedback"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, index=True)
    candidate_name = Column(String)
    rating = Column(Integer)
    comments = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)