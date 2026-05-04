"""
BATS ForgePro AI Evaluation Service - Enterprise LLM RAG Engine
1. Groq (Whisper) -> Audio Extraction
2. Google Gemini 2.0 Flash (1M Context) -> Deep Semantic Resume Parsing 
3. Groq (Llama 3.1 & 3.3) -> Real-time Interview Generation & Elite RAG Scoring
"""

import os
import json
import asyncio
import httpx
import re
from dotenv import load_dotenv

try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

def format_prompt(template: str, **kwargs) -> str:
    prompt = template
    for key, value in kwargs.items():
        prompt = prompt.replace(f"{{{key}}}", str(value))
    return prompt

def _parse_json_response(text: str) -> dict:
    try:
        start_idx = text.find('{')
        end_idx = text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            clean_json = text[start_idx:end_idx+1]
            clean_json = re.sub(r',\s*}', '}', clean_json)
            clean_json = re.sub(r',\s*]', ']', clean_json)
            return json.loads(clean_json)
        else:
            raise ValueError("No JSON brackets found in AI response.")
    except Exception as e:
        print(f"[BATS ForgePro] Critical JSON Parsing Error: {e}\nRaw Text snippet: {text[:300]}...")
        return {
            "candidate_overview": "Evaluation completed but AI failed to format response.",
            "scores": { "technical_proficiency": 50, "relevance_to_jd": 50, "communication": 50, "confidence_level": 50, "overall_score": 50 },
            "sentiment": {"rating": "Neutral", "explanation": "Fallback triggered due to parser error."},
            "candidate_status": {"level": "Moderate Confidence", "description": "System error during parsing."},
            "strengths": ["Data captured successfully."],
            "red_flags_or_weaknesses": ["AI syntax formatting error."],
            "dynamic_follow_up_questions": [],
            "hiring_recommendation": "Lean Hire",
            "justification": "The interview was completed, but the AI module encountered a strict formatting error during output generation."
        }

def _validate_result(result: dict) -> dict:
    required = [
        "candidate_overview", "scores", "strengths",
        "red_flags_or_weaknesses", "dynamic_follow_up_questions",
        "hiring_recommendation", "justification"
    ]
    for field in required:
        if field not in result:
            result[field] = "Data unavailable." if field != "scores" else { "technical_proficiency": 50, "relevance_to_jd": 50, "communication": 50, "confidence_level": 50, "overall_score": 50 }
    return result

# 🚀 UPGRADE: Perfectly balanced, highly reliable evaluation protocol enforcing relevancy and 0-100 scaling.
EVALUATION_PROMPT = """You are "BATS ForgePro", an elite AI Executive Recruiter System used by Tier-1 tech companies.
You are running a deep-dive evaluation. You have the Target Role, the Job Description, the Candidate's Resume, the Interview Transcript, and the Behavioral Telemetry.

*** ENTERPRISE EVALUATION PROTOCOL ***
1. RELEVANCY & ACCURACY: Deeply analyze the [INTERVIEW_TRANSCRIPT]. Evaluate how accurately and relevantly the candidate answered the specific questions. Did they address the core technical concepts, or did they waffle and dodge?
2. BALANCED GRADING (0-100 SCALE): Provide a fair, objective, and justified score strictly between 0 and 100 for all metrics. 
   - 85-100: Exceptional, highly relevant, deep technical understanding.
   - 70-84: Solid, relevant answers, good fundamentals.
   - 50-69: Vague or partially correct answers, lacks depth.
   - 0-49: Irrelevant answers, severe technical gaps, or waffling.
3. HOTS & WAFFLE RULES: Reward candidates who clearly explain Hard/HOTS (Higher Order Thinking Skills) concepts. Penalize excessively long, rambling answers that lack technical substance.
4. L1 TECH ROUND: If this is an uploaded video transcript, evaluate their monologue or presentation for clarity, technical depth, and JD alignment without expecting interactive Q&A.

Synthesize the findings reliably. Output ONLY valid JSON matching this exact structure:
{
  "candidate_overview": "A highly detailed 4-sentence executive summary of their technical depth and semantic reasoning skills.",
  "scores": {
    "technical_proficiency": 85,
    "relevance_to_jd": 85,
    "communication": 85,
    "confidence_level": 85,
    "overall_score": 85
  },
  "sentiment": {
    "rating": "Positive | Neutral | Negative",
    "explanation": "Deep analysis of the candidate's tone, pacing, hesitation, and emotional confidence."
  },
  "candidate_status": {
    "level": "Strong Confidence | Moderate Confidence | Low Confidence | Needs Improvement",
    "description": "Brief description of candidate's readiness."
  },
  "strengths": ["Specific strength 1 matching resume/transcript", "Specific strength 2"],
  "red_flags_or_weaknesses": ["Specific technical gap or discrepancy 1", "Specific weakness 2"],
  "dynamic_follow_up_questions": ["Hard follow-up question based on their profile"],
  "hiring_recommendation": "Strong Hire | Lean Hire | Reject",
  "justification": "A highly reliable, accurate, and detailed 2-paragraph explanation explicitly citing the candidate's resume, interview transcript evidence, and response relevancy to justify the verdict."
}

[TARGET_ROLE]
{position}

[JOB_DESCRIPTION]
{job_description}

[CANDIDATE_RESUME]
{resume}

[INTERVIEW_TRANSCRIPT]
{transcript}
"""

QUESTION_GENERATION_PROMPT = """You are "BATS ForgePro", an elite, human-like AI technical interviewer.
Analyze BOTH the Job Description AND the Candidate's Resume to generate EXACTLY 30 highly unique, targeted questions.

The target interview level is: {interview_level}. Modify the depth based on this level, but you MUST provide all 30 questions broken down exactly like this:
- 10 'easy' questions: Basic fundamentals, syntax, and smooth background intros.
- 10 'medium' questions: Complex project experience, debugging, framework internals mapped directly to the [JOB_DESCRIPTION].
- 10 'hard' questions: HOTS (Higher Order Thinking Skills), advanced architecture, scaling tradeoffs, and complex system design.

RULES:
1. RELEVANCY OVERRIDE: Every single question MUST be specifically mapped against BOTH the [CANDIDATE_RESUME] and [JOB_DESCRIPTION]. Do not ask generic textbook questions.
2. CONCISE LENGTH (CRITICAL): You must ask extremely short, direct questions. MAXIMUM OF 20 WORDS PER QUESTION. Do not compound questions. 

Output ONLY valid JSON containing EXACTLY 30 questions:
{
  "questions": [
    {
      "id": 1,
      "question": "A concise, 15-20 word question.",
      "category": "technical | behavioral | situational",
      "difficulty": "easy | medium | hard"
    }
  ]
}

[JOB_DESCRIPTION]
{job_description}

[CANDIDATE_RESUME]
{resume}
"""

DYNAMIC_INTERVIEW_TURN_PROMPT = """You are BATS ForgePro, an elite AI technical interviewer.
You are having a live conversation. You must act like a highly intelligent, empathetic human engineering manager.

Context of the conversation:
- The question you just asked: {question}
- The Candidate's exact answer: {answer}
- The next planned topic on your list: {next_question}

YOUR GOAL: Keep the interview flowing rapidly and dynamically adapt to their skill level.

RULES:
1. DYNAMIC ADAPTATION: Acknowledge a specific technical detail they just said (under 10 words). THEN, slightly adapt/increase the complexity of the {next_question} before asking it to test their limits.
2. BE BRIEF: Your total response MUST be under 30 words. 

Output ONLY valid JSON:
{
  "response_text": "Your short conversational acknowledgment, immediately followed by the adapted next question.",
  "is_sufficient": true
}
"""

RESUME_PARSER_PROMPT = """You are an elite AI Data Extraction Engine.
Extract unstructured text into this JSON format accurately.
{
  "candidate_info": {"name": "string", "email": "string", "phone": "string", "links": []},
  "executive_summary": "Deep 3-sentence summary.",
  "core_skills": {"languages_and_frameworks": [], "cloud_and_infrastructure": [], "databases_and_tools": []},
  "experience_and_projects": [{"name": "string", "role": "string", "duration": "string", "technologies_used": [], "key_achievements": []}],
  "education_and_certifications": []
}
Raw Text:
{raw_text}
"""

async def generate_speech_audio(text: str, gender: str = "female") -> bytes:
    if not EDGE_TTS_AVAILABLE:
        raise RuntimeError("edge_tts is not installed. To use neural voices, run: pip install edge-tts")
        
    if gender == "male":
        voice = "en-US-GuyNeural"
    elif gender == "indian_female":
        voice = "en-IN-NeerjaNeural"
    else:
        voice = "en-US-JennyNeural"

    communicate = edge_tts.Communicate(text, voice=voice, rate="+5%")
    
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
            
    return audio_data

async def transcribe_audio(file_path: str) -> str:
    if not GROQ_API_KEY: raise ValueError("GROQ_API_KEY is required.")
    async with httpx.AsyncClient(timeout=120) as client:
        with open(file_path, "rb") as audio_file:
            files = {"file": (os.path.basename(file_path), audio_file, "audio/mpeg")}
            data = {
                "model": "whisper-large-v3", 
                "response_format": "text",
                "language": "en",
                "temperature": "0.0",
                "prompt": "Technical software engineering interview transcript discussing coding, system design, scalable architecture, frameworks, algorithms, and logical problem solving. Ensure exact, word-for-word accuracy and capture all technical jargon perfectly."
            }
            url = "https://api.groq.com/openai/v1/audio/transcriptions"
            resp = await client.post(url, headers={"Authorization": f"Bearer {GROQ_API_KEY}"}, files=files, data=data)
            resp.raise_for_status()
            return resp.text

async def _call_groq(prompt: str, force_json: bool = False, max_tokens: int = 4000, groq_model: str = "llama-3.3-70b-versatile") -> dict:
    async with httpx.AsyncClient(timeout=60) as client:
        payload = {"model": groq_model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.0, "max_tokens": max_tokens}
        if force_json: payload["response_format"] = {"type": "json_object"}
        url = "https://api.groq.com/openai/v1/chat/completions"
        for attempt in range(3):
            resp = await client.post(url, headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}, json=payload)
            if resp.status_code == 429 and attempt < 2:
                await asyncio.sleep((attempt + 1) * 5)
                continue
            resp.raise_for_status()
            if force_json: return json.loads(resp.json()["choices"][0]["message"]["content"])
            return _parse_json_response(resp.json()["choices"][0]["message"]["content"])

async def _call_gemini(prompt: str, force_json: bool = False) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    payload["generationConfig"] = {"temperature": 0.0}
    if force_json: payload["generationConfig"]["responseMimeType"] = "application/json"
    
    async with httpx.AsyncClient(timeout=60) as client:
        for attempt in range(3):
            resp = await client.post(url, headers={"Content-Type": "application/json"}, json=payload)
            if resp.status_code == 429 and attempt < 2:
                await asyncio.sleep((attempt + 1) * 5)
                continue
            resp.raise_for_status()
            content = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            if force_json: return json.loads(content)
            return _parse_json_response(content)

async def _call_groq_text(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        url = "https://api.groq.com/openai/v1/chat/completions"
        resp = await client.post(url, headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}, json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": prompt}], "temperature": 0.0, "max_tokens": 1000})
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()

async def _call_ai_cascade(prompt: str, force_json: bool = False, max_tokens: int = 6000, groq_model: str = "llama-3.3-70b-versatile", prioritize_gemini: bool = False) -> dict:
    errors = []
    if prioritize_gemini and GEMINI_API_KEY:
        try: return await _call_gemini(prompt, force_json=force_json)
        except Exception as e: errors.append(f"Gemini Error: {e}")
    if GROQ_API_KEY:
        try: return await _call_groq(prompt, force_json, max_tokens=max_tokens, groq_model=groq_model)
        except Exception as e: errors.append(f"Groq Error: {e}")
    if not prioritize_gemini and GEMINI_API_KEY:
        try: return await _call_gemini(prompt, force_json=force_json)
        except Exception as e: errors.append(f"Gemini Error: {e}")
    raise ValueError(f"All AI Cascade providers failed: {'; '.join(errors)}")

async def parse_resume_to_json(raw_text: str) -> dict:
    safe_text = re.sub(r'[^\x20-\x7E\n\r\t\|]', ' ', raw_text)[:6000]
    prompt = format_prompt(RESUME_PARSER_PROMPT, raw_text=safe_text)
    try: return await _call_ai_cascade(prompt, force_json=True, max_tokens=1500, groq_model="llama-3.1-8b-instant", prioritize_gemini=True)
    except: return {"candidate_info": {"name": "Extraction Error", "email": "Error", "phone": "Error", "links": []}, "executive_summary": "Parsing failed.", "core_skills": {"languages_and_frameworks": [], "cloud_and_infrastructure": [], "databases_and_tools": []}, "experience_and_projects": [], "education_and_certifications": []}

async def evaluate_candidate(job_description: str, resume: str, transcript: str, position: str, remarks: str, behavior_data: dict = None) -> dict:
    behavior_data = behavior_data or {}
    jd_safe = job_description or "Standard IT Role"
    resume_safe = resume or "No Resume Provided"
    pos_safe = position or "Technical Role"
    remarks_safe = remarks or ""
    transcript_safe = (transcript or "(No transcript generated)").replace("(No speech detected)", "").strip()

    is_breach = "SECURITY BREACH" in transcript_safe.upper() or "SECURITY BREACH" in remarks_safe.upper()
    is_l1_round = "[TYPE:L1_TECH_ROUND]" in remarks_safe.upper()

    answers_given = len(re.findall(r'A\d+:', transcript_safe, re.IGNORECASE))
    total_spoken_words = len(transcript_safe.split())

    if is_breach:
        return {
            "candidate_overview": "Session automatically rejected due to Security Vault breach.",
            "scores": { "technical_proficiency": 0, "relevance_to_jd": 0, "communication": 0, "confidence_level": 0, "overall_score": 0 },
            "sentiment": {"rating": "Negative", "explanation": "Security protocol triggered."},
            "candidate_status": {"level": "Needs Improvement", "description": "Terminated / Breach"},
            "strengths": ["None identified due to security breach."],
            "red_flags_or_weaknesses": ["CRITICAL: Candidate triggered a security protocol."],
            "dynamic_follow_up_questions": [],
            "hiring_recommendation": "Reject",
            "justification": "CRITICAL PENALTY: Zero-Tolerance Engine Activated. Candidate violated testing conditions. Score locked to 0/100."
        }

    prompt = format_prompt(EVALUATION_PROMPT, position=pos_safe[:200], job_description=jd_safe[:4000], resume=resume_safe[:5000], transcript=transcript_safe)
    
    try:
        result = await _call_ai_cascade(prompt, force_json=True, max_tokens=2000, groq_model="llama-3.3-70b-versatile")
        result = _validate_result(result)
    except Exception as e:
        return _validate_result({})

    # 🚀 UPGRADE: The "Emergency Brake" now ONLY triggers on Live Interviews. 
    # Uploaded L1 Videos are completely immune to this penalty, allowing perfect AI grading!
    if not is_l1_round and answers_given < 2 and total_spoken_words < 40 and not "(Pre-recorded" in transcript_safe:
        result["scores"]["technical_proficiency"] = min(result["scores"].get("technical_proficiency", 0), 10)
        result["scores"]["relevance_to_jd"] = min(result["scores"].get("relevance_to_jd", 0), 10)
        result["scores"]["communication"] = min(result["scores"].get("communication", 0), 10)
        result["scores"]["confidence_level"] = min(result["scores"].get("confidence_level", 0), 10)
        result["hiring_recommendation"] = "Reject"
        result["candidate_status"]["level"] = "Needs Improvement"
        result["sentiment"]["rating"] = "Negative"
        result["justification"] = f"[SYSTEM OVERRIDE DEDUCTION]: Candidate aborted the interview and only provided {answers_given} technical answers. AI score has been forcefully capped to prevent false-positives. " + result.get("justification", "")

    tab_switches = behavior_data.get("tab_switches", 0)
    esc_presses = behavior_data.get("esc_presses", 0)
    liveness = behavior_data.get("liveness_score", 99)
    faces = behavior_data.get("faces_detected", 1)

    cv_penalty = (tab_switches * 3) + (esc_presses * 5)
    if faces > 1: cv_penalty += 10
    if liveness < 70: cv_penalty += 10

    base_conf = result["scores"].get("confidence_level", 85)
    result["scores"]["confidence_level"] = max(base_conf - cv_penalty, 0)
    
    if cv_penalty > 0:
        result["justification"] += f"\n\n[SECURITY METRICS]: Candidate incurred a telemetry penalty. Esc presses: {esc_presses}, Tab switches: {tab_switches}."

    t = result["scores"].get("technical_proficiency", 0)
    r = result["scores"].get("relevance_to_jd", 0)
    c = result["scores"].get("communication", 0)
    cf = result["scores"].get("confidence_level", 0)
    result["scores"]["overall_score"] = round((t * 0.4) + (r * 0.3) + (c * 0.15) + (cf * 0.15))

    return result

async def generate_interview_questions(job_description: str, resume: str, num_questions: int = 30, interview_level: str = "L2"):
    jd_safe = job_description or "Standard Tech Role"
    resume_safe = resume or "Candidate Resume"
    prompt = format_prompt(QUESTION_GENERATION_PROMPT, job_description=jd_safe[:3000], resume=resume_safe[:4000], num_questions=30, interview_level=interview_level)
    try:
        result = await _call_ai_cascade(prompt, force_json=True, max_tokens=3000, groq_model="llama-3.3-70b-versatile")
        return result.get("questions", [])
    except Exception:
        return [{"id": 1, "question": "Could you briefly outline your most relevant project?", "category": "technical", "difficulty": "easy"}]

async def generate_jd(position: str) -> str:
    prompt = format_prompt(JD_GENERATION_PROMPT, position=position)
    return await _call_groq_text(prompt)

async def get_answer_acknowledgment(question: str, answer: str, next_question: str = None) -> dict:
    skip_phrases = ["don't know", "dont know", "no idea", "pass", "skip", "move on", "not sure", "no clue", "haven't heard", "havent heard"]
    answer_lower = answer.lower()
    
    if any(phrase in answer_lower for phrase in skip_phrases) or len(answer.split()) < 4:
        return {
            "response_text": f"Understood. Let's move on. {next_question}", 
            "is_sufficient": True
        }

    prompt = format_prompt(DYNAMIC_INTERVIEW_TURN_PROMPT, question=question, answer=answer, next_question=next_question)
    try:
        result = await _call_ai_cascade(prompt, force_json=True, max_tokens=200, groq_model="llama-3.1-8b-instant")
        if result.get("is_sufficient", True):
            pass
        return result
    except Exception as e:
        return {"response_text": f"Got it. {next_question}", "is_sufficient": True}