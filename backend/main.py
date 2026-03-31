"""
BATS GeniusHub Interview Evaluator - Enterprise FastAPI Backend
"""

import os
import re
import json
import shutil
import hashlib
import subprocess
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Evaluation, InterviewSession, CandidateFeedback
from schemas import (
    EvaluationRequest, EvaluationResponse, QuestionGenerationRequest,
    JDGenerationRequest, AcknowledgmentRequest, SelectionStatusRequest,
    ResumeUploadResponse, SessionCreateRequest, SessionStatusUpdateRequest, FeedbackRequest
)
from ai_service import (
    evaluate_candidate, generate_interview_questions,
    generate_jd, get_answer_acknowledgment, transcribe_audio, parse_resume_to_json
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
    title="BATS GeniusHub Backend",
    description="Enterprise AI-powered candidate evaluation backend",
    version="3.0.0",
)

# 🛑 ULTIMATE CORS KILL SWITCH 🛑
# This completely disables CORS blocking between Vercel and Render.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False, 
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


def generate_candidate_id(name: str, position: str) -> str:
    first_name = re.sub(r'[^a-zA-Z]', '', name.split()[0] if name.strip() else "Unknown")
    role_short = re.sub(r'[^a-zA-Z]', '', position.replace(" ", ""))[:20]
    unique_hash = hashlib.md5(f"{name}{position}{datetime.now().isoformat()}".encode()).hexdigest()[:6]
    return f"BATS-{first_name}_{role_short}-{unique_hash}"


def db_to_response(ev: Evaluation) -> dict:
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
        "remarks": ev.remarks
    }


def save_result_file(eval_id: str, candidate_name: str, result_data: dict):
    safe_name = candidate_name.replace(" ", "_").replace("/", "_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{eval_id}_{safe_name}_{timestamp}.json"
    filepath = RESULTS_DIR / filename
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=2, ensure_ascii=False)
    
    return str(filepath)


def extract_audio(video_path: str, audio_path: str) -> bool:
    """Extracts audio from video using FFmpeg for highly accurate transcription."""
    try:
        command = [
            "ffmpeg", "-i", video_path, 
            "-q:a", "0", "-map", "a", 
            audio_path, "-y"
        ]
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError as e:
        print(f"[BATS] FFmpeg error: {e}")
        return False
    except FileNotFoundError:
        print("[BATS] FFmpeg not found. Please ensure FFmpeg is installed and added to PATH.")
        return False


# --- ENTERPRISE EMAIL ENGINE ---
def send_system_email(to_email: str, subject: str, body: str):
    sender_email = os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("SENDER_PASSWORD")
    if not sender_email or not sender_password:
        print(f"[BATS] Email credentials missing. Cannot send email to {to_email}.")
        return
    
    msg = MIMEMultipart()
    msg['From'] = f"BATS GeniusHub Recruitment <{sender_email}>"
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        # UPGRADE: Using SMTP_SSL on Port 465 to bypass Cloud provider blocks
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, to_email, msg.as_string())
        server.quit()
        print(f"[BATS EMAIL SUCCESS] Successfully delivered tracking email to: {to_email}")
    except Exception as e:
        print(f"[BATS EMAIL ERROR] FATAL EMAIL FAILURE to {to_email}: {e}")


@app.get("/")
async def root():
    return {"message": "BATS GeniusHub Enterprise Backend is awake and running!"}

# ─── ENTERPRISE ROUTES: SESSION LINK & EMAIL GENERATION ───

@app.post("/api/sessions/create")
async def create_interview_session(req: SessionCreateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Creates the session and emails both Candidate and Recruiter."""
    new_session = InterviewSession(
        candidate_name=req.candidate_name,
        candidate_email=req.candidate_email,
        recruiter_email=req.recruiter_email,
        interview_level=req.interview_level,
        position=req.position,
        job_description=req.job_description,
        resume_text=req.resume_text,
        status="pending"
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    frontend_url = os.getenv("FRONTEND_URL", "https://nexus-ai-platform-omega.vercel.app")
    interview_link = f"{frontend_url}/interview/{new_session.id}"

    # 1. Email Candidate
    candidate_body = f"Hello {req.candidate_name},\n\nYou have been invited to a GeniusHub Video Interview for the {req.position} role ({req.interview_level}).\n\nPlease ensure you are on a laptop/desktop, as you will be required to share your screen and camera to proceed.\n\nStart Interview: {interview_link}\n\nBest,\nTalent Acquisition"
    background_tasks.add_task(send_system_email, req.candidate_email, f"Interview Invitation: {req.position}", candidate_body)

    # 2. Email Recruiter
    if req.recruiter_email:
        recruiter_body = f"Session Created for {req.candidate_name}.\n\nRole: {req.position} ({req.interview_level})\nCandidate Email: {req.candidate_email}\n\nYou will receive another alert the moment they begin, and when results are ready."
        background_tasks.add_task(send_system_email, req.recruiter_email, f"GeniusHub Tracking: Session Created for {req.candidate_name}", recruiter_body)
    
    return {"message": "Session created and emails queued", "session_id": new_session.id}

@app.get("/api/sessions/{session_id}")
async def get_interview_session(session_id: str, db: Session = Depends(get_db)):
    """Candidate clicks the link; this fetches their specific interview details."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview link not found or expired.")
    
    return {
        "id": session.id,
        "candidate_name": session.candidate_name,
        "position": session.position,
        "job_description": session.job_description,
        "resume_text": session.resume_text,
        "interview_level": session.interview_level,
        "status": session.status
    }

@app.patch("/api/sessions/{session_id}/status")
async def update_session_status(session_id: str, req: SessionStatusUpdateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Updates status and alerts Recruiter when candidate starts/finishes."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.status = req.status
    db.commit()

    # Recruiter Alerts
    if session.recruiter_email:
        if req.status == "started":
            body = f"Alert: {session.candidate_name} has just joined the interview room and started their camera/screen-share."
            background_tasks.add_task(send_system_email, session.recruiter_email, f"🟢 Started: {session.candidate_name}", body)
        elif req.status == "completed":
            body = f"Success: {session.candidate_name} has finished the interview.\n\nThe AI is currently processing the video, anti-cheat logs, and technical evaluation. You can view the results on your dashboard shortly."
            background_tasks.add_task(send_system_email, session.recruiter_email, f"✅ Completed: {session.candidate_name}", body)

    return {"message": f"Status updated to {req.status}", "candidate": session.candidate_name}

@app.post("/api/feedback")
async def submit_feedback(req: FeedbackRequest, db: Session = Depends(get_db)):
    """Stores candidate feedback after the interview."""
    feedback = CandidateFeedback(
        session_id=req.session_id,
        candidate_name=req.candidate_name,
        rating=req.rating,
        comments=req.comments
    )
    db.add(feedback)
    db.commit()
    return {"message": "Feedback saved successfully"}

# ─── CORE EVALUATION ROUTES ───

@app.post("/api/upload-video")
async def upload_video(video: UploadFile = File(...)):
    if not video.filename:
        raise HTTPException(400, "No filename provided")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{timestamp}_{video.filename}"
    file_path = RECORDINGS_DIR / safe_name

    with open(file_path, "wb") as f:
        shutil.copyfileobj(video.file, f)

    return {
        "filename": safe_name,
        "path": f"recordings/{safe_name}",
        "size": file_path.stat().st_size,
        "timestamp": timestamp,
    }

@app.post("/api/upload-resume", response_model=ResumeUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    allowed_extensions = {".pdf", ".txt", ".doc", ".docx", ".md"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{timestamp}_{file.filename}"
    file_path = RESUMES_DIR / safe_name

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    extracted_text = ""
    if ext in [".txt", ".md"]:
        extracted_text = content.decode("utf-8", errors="ignore")
    elif ext == ".pdf":
        try:
            import fitz
            doc = fitz.open(stream=content, filetype="pdf")
            extracted_text = "\n".join([page.get_text() for page in doc])
            doc.close()
        except ImportError:
            extracted_text = "[PDF text extraction requires PyMuPDF. Install: pip install PyMuPDF]"
    elif ext in [".doc", ".docx"]:
        try:
            import docx
            import io
            doc = docx.Document(io.BytesIO(content))
            extracted_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        except ImportError:
            extracted_text = "[DOCX extraction requires python-docx. Install: pip install python-docx]"

    print(f"[BATS] Running AI Semantic Parsing on {file.filename}...")
    structured_resume = await parse_resume_to_json(extracted_text)

    return ResumeUploadResponse(
        filename=safe_name,
        path=str(file_path),
        extracted_text=json.dumps(structured_resume, indent=2),
        size=len(content),
    )

@app.post("/api/generate-questions")
async def generate_questions(req: QuestionGenerationRequest):
    try:
        questions = await generate_interview_questions(
            job_description=req.job_description, 
            resume=req.resume, 
            num_questions=req.num_questions,
            interview_level=req.interview_level 
        )
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(500, detail=f"Question generation failed: {str(e)}")

@app.post("/api/generate-jd")
async def generate_job_description(req: JDGenerationRequest):
    try:
        jd = await generate_jd(req.position)
        return {"job_description": jd}
    except Exception as e:
        raise HTTPException(500, detail=f"JD generation failed: {str(e)}")

@app.post("/api/acknowledge-answer")
async def acknowledge_answer(req: AcknowledgmentRequest):
    try:
        ack = await get_answer_acknowledgment(req.question, req.answer)
        return {"acknowledgment": ack}
    except Exception as e:
        return {"acknowledgment": "Thank you for that context. Let's move on."}

@app.post("/api/evaluate")
async def create_evaluation(req: EvaluationRequest, db: Session = Depends(get_db)):
    try:
        final_transcript = req.transcript
        
        if req.video_filename:
            video_path = RECORDINGS_DIR / req.video_filename
            if video_path.exists():
                audio_path = RECORDINGS_DIR / f"{req.video_filename}.mp3"
                if extract_audio(str(video_path), str(audio_path)):
                    try:
                        final_transcript = await transcribe_audio(str(audio_path))
                    except Exception as e:
                        print(f"[BATS] Whisper transcription failed, falling back to frontend text: {e}")

        if len(final_transcript.strip()) < 10:
            raise ValueError("Transcript is too short or audio extraction failed to find speech.")

        ai_result = await evaluate_candidate(
            job_description=req.job_description,
            resume=req.resume,
            transcript=final_transcript,
        )

        candidate_id = generate_candidate_id(req.candidate_name, req.position)

        evaluation = Evaluation(
            id=candidate_id,
            candidate_name=req.candidate_name,
            position=req.position,
            job_description=req.job_description,
            resume=req.resume,
            transcript=final_transcript,
            video_filename=req.video_filename,
            remarks=req.remarks or "Completed normally.", 
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

        response_data = db_to_response(evaluation)
        save_result_file(evaluation.id, evaluation.candidate_name, response_data)

        return response_data

    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        raise HTTPException(500, detail=f"AI evaluation failed: {str(e)}")

@app.get("/api/evaluations")
async def list_evaluations(db: Session = Depends(get_db)):
    evaluations = db.query(Evaluation).order_by(Evaluation.created_at.desc()).all()
    return [db_to_response(ev) for ev in evaluations]

@app.get("/api/evaluations/{eval_id}")
async def get_evaluation(eval_id: str, db: Session = Depends(get_db)):
    ev = db.query(Evaluation).filter(Evaluation.id == eval_id).first()
    if not ev:
        raise HTTPException(404, "Evaluation not found")
    return db_to_response(ev)

@app.patch("/api/evaluations/{eval_id}/status")
async def update_selection_status(eval_id: str, req: SelectionStatusRequest, db: Session = Depends(get_db)):
    ev = db.query(Evaluation).filter(Evaluation.id == eval_id).first()
    if not ev:
        raise HTTPException(404, "Evaluation not found")
    
    ev.selection_status = req.status
    db.commit()
    db.refresh(ev)
    return db_to_response(ev)

@app.delete("/api/evaluations/{eval_id}")
async def delete_evaluation(eval_id: str, db: Session = Depends(get_db)):
    ev = db.query(Evaluation).filter(Evaluation.id == eval_id).first()
    if not ev:
        raise HTTPException(404, "Evaluation not found")
    
    db.delete(ev)
    db.commit()
    return {"message": "Deleted successfully"}

@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db)):
    evaluations = db.query(Evaluation).all()
    total = len(evaluations)
    
    if total == 0:
        return {
            "total": 0, "avg_score": 0, "strong_hires": 0, "lean_hires": 0, 
            "rejects": 0, "selected": 0, "rejected": 0, "pending": 0,
            "pipeline_health": "No Data", "top_scorer": None, "positions": []
        }

    scores = [ev.scores.get("overall_score", 0) if ev.scores else 0 for ev in evaluations]
    avg_score = round(sum(scores) / total, 1)
    
    strong_hires = sum(1 for ev in evaluations if ev.hiring_recommendation == "Strong Hire")
    lean_hires = sum(1 for ev in evaluations if ev.hiring_recommendation == "Lean Hire")
    rejects = sum(1 for ev in evaluations if ev.hiring_recommendation == "Reject")
    
    if total > 0:
        hire_rate = (strong_hires + lean_hires) / total
        pipeline_health = "Excellent" if hire_rate >= 0.4 else "Needs Adjustment" if hire_rate < 0.15 else "Healthy"
    else:
        pipeline_health = "No Data"

    top_eval = max(evaluations, key=lambda e: (e.scores or {}).get("overall_score", 0))

    return {
        "total": total,
        "avg_score": avg_score,
        "strong_hires": strong_hires,
        "lean_hires": lean_hires,
        "rejects": rejects,
        "selected": sum(1 for ev in evaluations if ev.selection_status == "selected"),
        "rejected": sum(1 for ev in evaluations if ev.selection_status == "rejected"),
        "pending": sum(1 for ev in evaluations if ev.selection_status == "pending"),
        "pipeline_health": pipeline_health,
        "top_scorer": top_eval.candidate_name,
        "positions": list(set(ev.position for ev in evaluations)),
    }

@app.post("/api/compare")
async def compare_candidates(candidate_ids: List[str], db: Session = Depends(get_db)):
    evaluations = db.query(Evaluation).filter(Evaluation.id.in_(candidate_ids)).all()
    if len(evaluations) < 2:
        raise HTTPException(400, "Need at least 2 valid candidate IDs to compare")

    results = [db_to_response(ev) for ev in evaluations]
    ranked = sorted(results, key=lambda r: r["scores"].get("overall_score", 0), reverse=True)
    
    debrief_matrix = []
    for i, r in enumerate(ranked):
        r["rank"] = i + 1
        matrix_entry = {
            "rank": i + 1,
            "candidate": r["candidateName"],
            "verdict": r["hiring_recommendation"],
            "technical_score": r["scores"].get("technical_proficiency", 0),
            "communication_score": r["scores"].get("communication", 0),
            "top_strength": r["strengths"][0] if r["strengths"] else "N/A",
            "biggest_red_flag": r["red_flags_or_weaknesses"][0] if r["red_flags_or_weaknesses"] else "None",
            "risk_level": "Low" if r["hiring_recommendation"] == "Strong Hire" else "High" if r["hiring_recommendation"] == "Reject" else "Medium"
        }
        debrief_matrix.append(matrix_entry)

    recommended_action = "No Strong Hires found in this cohort."
    if debrief_matrix and debrief_matrix[0]["verdict"] == "Strong Hire":
        recommended_action = f"Make an offer to {ranked[0]['candidateName']} based on superior technical alignment."

    return {
        "candidates": ranked, 
        "total_compared": len(ranked),
        "enterprise_debrief_matrix": debrief_matrix,
        "recommended_action": recommended_action
    }