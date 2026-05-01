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
        raise ValueError("AI generated invalid or truncated JSON.")

def _validate_result(result: dict) -> dict:
    required = [
        "candidate_overview", "scores", "strengths",
        "red_flags_or_weaknesses", "dynamic_follow_up_questions",
        "hiring_recommendation", "justification"
    ]
    for field in required:
        if field not in result:
            raise ValueError(f"Missing required field: {field}")
    return result

EVALUATION_PROMPT = """You are "BATS ForgePro", an elite AI Executive Recruiter System used by Tier-1 tech companies.
You are running a deep-dive evaluation. You have the Job Description, the Candidate's Resume, the Interview Transcript, and the Behavioral Telemetry.

*** ENTERPRISE EVALUATION PROTOCOL ***
1. L1 TECH ROUND (PRE-RECORDED): If the [INTERVIEW_TRANSCRIPT] explicitly contains exactly "(Pre-recorded interview video uploaded", rely heavily on the [CANDIDATE_RESUME] for scoring.
2. LIVE INTERVIEW (STRICT SCORING): If this is a live interview, the [INTERVIEW_TRANSCRIPT] is the ultimate source of truth. 
   - ZERO TOLERANCE FOR SILENCE/SKIPS: If the candidate stays silent ("<SILENCE>"), skips questions, fails to introduce themselves, or gives extremely short non-answers, you MUST severely penalize their scores. Do NOT score them highly based on their resume if they failed to speak well in the interview. A completely silent or skipped interview MUST score below 20/100 and result in a Reject.
3. SCORING: Provide a highly accurate, fair, and justified score out of 100 based strictly on the evidence in the transcript. 

Synthesize the findings reliably. Output ONLY valid JSON matching this exact structure:
{
  "candidate_overview": "A highly detailed 4-sentence executive summary of their technical depth and semantic reasoning skills.",
  "scores": {
    "technical_proficiency": 0,
    "relevance_to_jd": 0,
    "communication": 0,
    "confidence_level": 0,
    "overall_score": 0
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
  "justification": "A highly reliable, accurate, and detailed 2-paragraph explanation explicitly citing the candidate's resume, interview transcript evidence, and response latency to justify the verdict."
}

[JOB_DESCRIPTION]
{job_description}

[CANDIDATE_RESUME]
{resume}

[INTERVIEW_TRANSCRIPT]
{transcript}
"""

# 🛡️ THE FIX: Redesigned the generation prompt to ban definitions and force JD + Resume scenario questions
QUESTION_GENERATION_PROMPT = """You are "BATS ForgePro", an elite, human-like AI technical interviewer.
Analyze BOTH the Job Description AND the Candidate's Resume to generate EXACTLY {num_questions} highly unique, targeted questions.

The target difficulty level is: {interview_level}.

RULES:
1. NO DEFINITIONS: NEVER ask basic definition questions (e.g., DO NOT ask "What is Django?" or "What is React?"). 
2. SCENARIO BASED: Ask architectural and problem-solving questions that explicitly blend a project mentioned in their [CANDIDATE_RESUME] with a requirement from the [JOB_DESCRIPTION]. (e.g., "How did you scale the PostgreSQL database in your E-commerce project to handle high-traffic?").
3. CONCISE LENGTH: Keep questions perfectly balanced, between 15 to 30 words. Not too short, not too long.

Output ONLY valid JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "A concise, scenario-based 15-30 word question linking their resume to the JD.",
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

YOUR GOAL: Keep the interview flowing rapidly.

RULES:
1. IF THEY SKIP OR DON'T KNOW: If the candidate says "I don't know", "not sure", "skip", or "move ahead", you MUST set "is_sufficient": true. DO NOT twist or rephrase the same question. Acknowledge gracefully (e.g., "Got it, let's move on.") and IMMEDIATELY ask the exact {next_question}.
2. IF SILENCE: If the answer is exactly "<SILENCE>", you MUST set "is_sufficient": true. Say "Let's move ahead to the next topic." and ask the {next_question}.
3. IF DETAILED AND VALID: Set "is_sufficient": true. Acknowledge a specific technical detail they just said (under 10 words), and seamlessly pivot into asking the {next_question}.
4. IF EXTREMELY VAGUE (but not a skip): If the answer is under 5 words and completely misses the point (like "um", "well"), set "is_sufficient": false. Ask them to clarify briefly. Do NOT ask the next planned topic.

Output ONLY valid JSON:
{
  "response_text": "Your highly conversational, short response.",
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
        
    voice = "en-US-JennyNeural" if gender == "female" else "en-US-GuyNeural"
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
            data = {"model": "whisper-large-v3", "response_format": "text"}
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

async def evaluate_candidate(job_description: str, resume: str, transcript: str, behavior_data: dict = None) -> dict:
    behavior_data = behavior_data or {}
    clean_transcript = transcript.replace("(No speech detected)", "").strip()
    is_breach = "[SYSTEM LOG]: SECURITY BREACH" in transcript

    if is_breach:
        return {
            "candidate_overview": "Session automatically rejected. Candidate triggered the Anti-Cheat Security Vault.",
            "scores": { "technical_proficiency": 0, "relevance_to_jd": 0, "communication": 0, "confidence_level": 0, "overall_score": 0 },
            "sentiment": {"rating": "Negative", "explanation": "Session failed or terminated prematurely."},
            "candidate_status": {"level": "Needs Improvement", "description": "Terminated"},
            "strengths": ["None identified due to security breach."],
            "red_flags_or_weaknesses": ["CRITICAL: SECURITY BREACH"],
            "dynamic_follow_up_questions": [],
            "hiring_recommendation": "Reject",
            "justification": "Zero-Tolerance Engine Activated: Security Protocol violated. Score locked to 0."
        }

    avg_latency = behavior_data.get("avg_latency", 0)
    if avg_latency > 0:
        clean_transcript += f"\n\n[BEHAVIORAL METADATA]: The candidate took an average of {avg_latency} seconds to start speaking after being asked a question. Factor this hesitation into their confidence score."

    safe_resume = resume[:5000]
    safe_jd = job_description[:4000]
    prompt = format_prompt(EVALUATION_PROMPT, job_description=safe_jd, resume=safe_resume, transcript=clean_transcript)
    result = await _call_ai_cascade(prompt, force_json=True, max_tokens=2000, groq_model="llama-3.3-70b-versatile")
    result = _validate_result(result)

    tab_switches = behavior_data.get("tab_switches", 0)
    esc_presses = behavior_data.get("esc_presses", 0)
    liveness = behavior_data.get("liveness_score", 99)
    faces = behavior_data.get("faces_detected", 1)

    cv_penalty = (tab_switches * 3) + (esc_presses * 5)
    if faces > 1: cv_penalty += 10
    if liveness < 70: cv_penalty += 10

    # 🛡️ THE FIX: Hard Programmatic Penalty for Silent/Empty Interviews
    word_count = len(clean_transcript.split())
    silence_count = clean_transcript.count("<SILENCE>")
    
    if silence_count >= 2 or word_count < 40:
        result["scores"]["technical_proficiency"] = min(result["scores"].get("technical_proficiency", 0), 20)
        result["scores"]["communication"] = min(result["scores"].get("communication", 0), 10)
        cv_penalty += 50
        result["justification"] = "CRITICAL PENALTY: Candidate provided little to no vocal responses during the interview. Scores have been manually clamped. " + result.get("justification", "")
        result["hiring_recommendation"] = "Reject"
        result["candidate_status"]["level"] = "Needs Improvement"

    base_conf = result["scores"].get("confidence_level", 85)
    result["scores"]["confidence_level"] = max(base_conf - cv_penalty, 0)
    
    if cv_penalty > 0 and "CRITICAL PENALTY" not in result.get("justification", ""):
        result["justification"] += f"\n\n[SECURITY METRICS]: Candidate incurred a telemetry penalty. Esc presses: {esc_presses}, Tab switches: {tab_switches}."

    t = result["scores"]["technical_proficiency"]
    r = result["scores"]["relevance_to_jd"]
    c = result["scores"]["communication"]
    cf = result["scores"]["confidence_level"]
    result["scores"]["overall_score"] = round((t * 0.4) + (r * 0.3) + (c * 0.15) + (cf * 0.15))

    return result

async def generate_interview_questions(job_description: str, resume: str, num_questions: int = 10, interview_level: str = "L2"):
    prompt = format_prompt(QUESTION_GENERATION_PROMPT, job_description=job_description[:3000], resume=resume[:4000], num_questions=num_questions, interview_level=interview_level)
    try:
        result = await _call_ai_cascade(prompt, force_json=True, max_tokens=1500, groq_model="llama-3.3-70b-versatile")
        return result.get("questions", [])
    except Exception:
        return [{"id": 1, "question": "Could you briefly outline your most relevant project?", "category": "technical", "difficulty": "medium"}]

async def generate_jd(position: str) -> str:
    prompt = format_prompt(JD_GENERATION_PROMPT, position=position)
    return await _call_groq_text(prompt)

async def get_answer_acknowledgment(question: str, answer: str, next_question: str = None) -> dict:
    next_q_text = next_question if next_question else "Thank the candidate and conclude this section."
    prompt = format_prompt(DYNAMIC_INTERVIEW_TURN_PROMPT, question=question, answer=answer, next_question=next_q_text)
    try:
        return await _call_ai_cascade(prompt, force_json=True, max_tokens=150, groq_model="llama-3.1-8b-instant")
    except Exception as e:
        return {"response_text": f"Got it. {next_q_text}", "is_sufficient": True}