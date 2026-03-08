"""
BATS AI Interview Evaluator - FastAPI Backend
"""

import os
import re
import json
import shutil
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Evaluation
from schemas import (
    EvaluationRequest, EvaluationResponse, QuestionGenerationRequest,
    JDGenerationRequest, AcknowledgmentRequest, SelectionStatusRequest,
    ResumeUploadResponse,
)
from ai_service import (
    evaluate_candidate, generate_interview_questions,
    generate_jd, get_answer_acknowledgment,
)

load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)

# Create directories
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)

RECORDINGS_DIR = UPLOAD_DIR / "recordings"
RECORDINGS_DIR.mkdir(exist_ok=True)

RESULTS_DIR = UPLOAD_DIR / "results"
RESULTS_DIR.mkdir(exist_ok=True)

RESUMES_DIR = UPLOAD_DIR / "resumes"
RESUMES_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="BATS AI Interview Evaluator",
    description="AI-powered candidate evaluation backend",
    version="2.0.0",
)

# CORS - allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


def generate_candidate_id(name: str, position: str) -> str:
    """Generate unique candidate ID: BATS-FirstName_Role-hash."""
    first_name = re.sub(r'[^a-zA-Z]', '', name.split()[0] if name.strip() else "Unknown")
    role_short = re.sub(r'[^a-zA-Z]', '', position.replace(" ", ""))[:20]
    unique_hash = hashlib.md5(f"{name}{position}{datetime.now().isoformat()}".encode()).hexdigest()[:6]
    return f"BATS-{first_name}_{role_short}-{unique_hash}"


def db_to_response(ev: Evaluation) -> dict:
    """Convert DB model to frontend-compatible response."""
    return {
        "id": ev.id,
        "candidateName": ev.candidate_name,
        "position": ev.position,
        "date": ev.date,
        "candidate_overview": ev.candidate_overview or "",
        "scores": ev.scores or {"technical_proficiency": 0, "relevance_to_jd": 0, "communication": 0, "confidence_level": 0, "overall_score": 0},
        "sentiment": ev.sentiment or {"rating": "Neutral", "explanation": ""},
        "candidate_status": ev.candidate_status or {"level": "Moderate Confidence", "description": ""},
        "selection_status": ev.selection_status or "pending",
        "strengths": ev.strengths or [],
        "red_flags_or_weaknesses": ev.red_flags_or_weaknesses or [],
        "dynamic_follow_up_questions": ev.dynamic_follow_up_questions or [],
        "hiring_recommendation": ev.hiring_recommendation or "Reject",
        "justification": ev.justification or "",
        "video_filename": ev.video_filename,
    }


def save_result_file(eval_id: str, candidate_name: str, result_data: dict):
    """Save evaluation result as a JSON file in the results folder."""
    safe_name = candidate_name.replace(" ", "_").replace("/", "_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{eval_id}_{safe_name}_{timestamp}.json"
    filepath = RESULTS_DIR / filename
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=2, ensure_ascii=False)
    return str(filepath)


@app.get("/")
async def root():
    return {"message": "BATS AI Backend v2.0 is running", "docs": "/docs"}


@app.post("/api/upload-video")
async def upload_video(video: UploadFile = File(...)):
    """Upload an interview recording video with unique ID and timestamp."""
    if not video.filename:
        raise HTTPException(400, "No filename provided")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{timestamp}_{video.filename}"
    file_path = RECORDINGS_DIR / safe_name

    with open(file_path, "wb") as f:
        shutil.copyfileobj(video.file, f)

    size = file_path.stat().st_size
    return {
        "filename": safe_name,
        "path": f"recordings/{safe_name}",
        "size": size,
        "timestamp": timestamp,
    }


@app.post("/api/upload-resume", response_model=ResumeUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    """Upload a resume file (PDF/TXT/DOC) and extract text content."""
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    allowed_extensions = {".pdf", ".txt", ".doc", ".docx", ".md"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_extensions)}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{timestamp}_{file.filename}"
    file_path = RESUMES_DIR / safe_name

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Extract text based on file type
    extracted_text = ""
    if ext == ".txt" or ext == ".md":
        extracted_text = content.decode("utf-8", errors="ignore")
    elif ext == ".pdf":
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=content, filetype="pdf")
            for page in doc:
                extracted_text += page.get_text() + "\n"
            doc.close()
        except ImportError:
            # Fallback: basic PDF text extraction
            try:
                text_parts = []
                text = content.decode("latin-1", errors="ignore")
                # Very basic extraction - recommend installing PyMuPDF
                import re
                # Extract text between BT and ET markers
                streams = re.findall(r'\((.*?)\)', text)
                extracted_text = " ".join(streams[:500]) if streams else ""
                if not extracted_text:
                    extracted_text = "[PDF uploaded but text extraction requires PyMuPDF. Install: pip install PyMuPDF]"
            except:
                extracted_text = "[PDF uploaded but could not extract text. Install PyMuPDF: pip install PyMuPDF]"
    elif ext in (".doc", ".docx"):
        try:
            import docx
            import io
            doc = docx.Document(io.BytesIO(content))
            extracted_text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
        except ImportError:
            extracted_text = "[DOCX uploaded but text extraction requires python-docx. Install: pip install python-docx]"

    return ResumeUploadResponse(
        filename=safe_name,
        path=str(file_path),
        extracted_text=extracted_text.strip(),
        size=len(content),
    )


@app.post("/api/generate-questions")
async def generate_questions(req: QuestionGenerationRequest):
    """Generate AI interview questions based on JD and resume."""
    try:
        questions = await generate_interview_questions(
            job_description=req.job_description,
            resume=req.resume,
            num_questions=req.num_questions,
        )
        return {"questions": questions}
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        raise HTTPException(500, detail=f"Question generation failed: {str(e)}")


@app.post("/api/generate-jd")
async def generate_job_description(req: JDGenerationRequest):
    """Auto-generate a Job Description from position title using AI."""
    try:
        jd = await generate_jd(req.position)
        return {"job_description": jd}
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        raise HTTPException(500, detail=f"JD generation failed: {str(e)}")


@app.post("/api/acknowledge-answer")
async def acknowledge_answer(req: AcknowledgmentRequest):
    """Get AI acknowledgment of a candidate's answer for conversational flow."""
    try:
        ack = await get_answer_acknowledgment(req.question, req.answer)
        return {"acknowledgment": ack}
    except Exception as e:
        return {"acknowledgment": "Thank you for your answer. Let's move on."}


@app.post("/api/evaluate")
async def create_evaluation(req: EvaluationRequest, db: Session = Depends(get_db)):
    """Run AI evaluation on candidate data."""
    try:
        ai_result = await evaluate_candidate(
            job_description=req.job_description,
            resume=req.resume,
            transcript=req.transcript,
        )

        candidate_id = generate_candidate_id(req.candidate_name, req.position)

        evaluation = Evaluation(
            id=candidate_id,
            candidate_name=req.candidate_name,
            position=req.position,
            job_description=req.job_description,
            resume=req.resume,
            transcript=req.transcript,
            video_filename=req.video_filename,
            candidate_overview=ai_result.get("candidate_overview", ""),
            scores=ai_result.get("scores", {}),
            sentiment=ai_result.get("sentiment", {"rating": "Neutral", "explanation": ""}),
            candidate_status=ai_result.get("candidate_status", {"level": "Moderate Confidence", "description": ""}),
            strengths=ai_result.get("strengths", []),
            red_flags_or_weaknesses=ai_result.get("red_flags_or_weaknesses", []),
            dynamic_follow_up_questions=ai_result.get("dynamic_follow_up_questions", []),
            hiring_recommendation=ai_result.get("hiring_recommendation", ""),
            justification=ai_result.get("justification", ""),
        )
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)

        # Save result JSON file to results folder
        response_data = db_to_response(evaluation)
        save_result_file(evaluation.id, evaluation.candidate_name, response_data)

        return response_data

    except ValueError as e:
        error_msg = str(e)
        print(f"[BATS] Evaluation ValueError: {error_msg}")
        # If no API keys, return 503 so frontend knows to use local fallback
        if "No AI API keys" in error_msg or "All AI providers failed" in error_msg:
            raise HTTPException(503, detail=f"AI service unavailable: {error_msg}")
        raise HTTPException(400, detail=error_msg)
    except Exception as e:
        print(f"[BATS] Evaluation error: {str(e)}")
        raise HTTPException(500, detail=f"AI evaluation failed: {str(e)}")


@app.get("/api/evaluations")
async def list_evaluations(db: Session = Depends(get_db)):
    """Get all evaluations, newest first."""
    evaluations = db.query(Evaluation).order_by(Evaluation.created_at.desc()).all()
    return [db_to_response(ev) for ev in evaluations]


@app.get("/api/evaluations/{eval_id}")
async def get_evaluation(eval_id: str, db: Session = Depends(get_db)):
    """Get a single evaluation by ID."""
    ev = db.query(Evaluation).filter(Evaluation.id == eval_id).first()
    if not ev:
        raise HTTPException(404, "Evaluation not found")
    return db_to_response(ev)


@app.patch("/api/evaluations/{eval_id}/status")
async def update_selection_status(eval_id: str, req: SelectionStatusRequest, db: Session = Depends(get_db)):
    """Update candidate selection status (selected/rejected/pending)."""
    ev = db.query(Evaluation).filter(Evaluation.id == eval_id).first()
    if not ev:
        raise HTTPException(404, "Evaluation not found")
    ev.selection_status = req.status
    db.commit()
    db.refresh(ev)
    return db_to_response(ev)


@app.delete("/api/evaluations/{eval_id}")
async def delete_evaluation(eval_id: str, db: Session = Depends(get_db)):
    """Delete an evaluation."""
    ev = db.query(Evaluation).filter(Evaluation.id == eval_id).first()
    if not ev:
        raise HTTPException(404, "Evaluation not found")
    db.delete(ev)
    db.commit()
    return {"message": "Deleted successfully"}


@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get overall statistics summary."""
    evaluations = db.query(Evaluation).all()
    total = len(evaluations)
    if total == 0:
        return {"total": 0, "avg_score": 0, "strong_hires": 0, "lean_hires": 0, "rejects": 0, "selected": 0, "rejected": 0, "pending": 0}

    scores = [ev.scores.get("overall_score", 0) if ev.scores else 0 for ev in evaluations]
    return {
        "total": total,
        "avg_score": round(sum(scores) / total, 1),
        "strong_hires": sum(1 for ev in evaluations if ev.hiring_recommendation == "Strong Hire"),
        "lean_hires": sum(1 for ev in evaluations if ev.hiring_recommendation == "Lean Hire"),
        "rejects": sum(1 for ev in evaluations if ev.hiring_recommendation == "Reject"),
        "selected": sum(1 for ev in evaluations if ev.selection_status == "selected"),
        "rejected": sum(1 for ev in evaluations if ev.selection_status == "rejected"),
        "pending": sum(1 for ev in evaluations if ev.selection_status == "pending"),
        "top_scorer": max(evaluations, key=lambda e: (e.scores or {}).get("overall_score", 0)).candidate_name if evaluations else None,
        "positions": list(set(ev.position for ev in evaluations)),
    }


@app.post("/api/compare")
async def compare_candidates(candidate_ids: List[str], db: Session = Depends(get_db)):
    """Compare multiple candidates side-by-side."""
    evaluations = db.query(Evaluation).filter(Evaluation.id.in_(candidate_ids)).all()
    if len(evaluations) < 2:
        raise HTTPException(400, "Need at least 2 valid candidate IDs to compare")

    results = [db_to_response(ev) for ev in evaluations]
    # Rank by overall score
    ranked = sorted(results, key=lambda r: r["scores"].get("overall_score", 0), reverse=True)
    for i, r in enumerate(ranked):
        r["rank"] = i + 1

    return {"candidates": ranked, "total_compared": len(ranked)}
