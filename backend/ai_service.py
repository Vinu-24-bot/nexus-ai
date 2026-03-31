"""
BATS AI Evaluation Service - True Hybrid Enterprise Grade
1. Groq (Whisper) -> Audio Extraction
2. Google Gemini 2.0 Flash (1M Context) -> Deep Semantic Resume Parsing (Super Extractor)
3. Groq (Llama 3.3) -> Real-time Interview Generation
4. MoE Cascade -> Final Master Evaluation (Cross-Verification Detective)
"""

import os
import json
import asyncio
import httpx
import re
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ─── UTILITY FUNCTIONS ──────────────────────────────────────

def format_prompt(template: str, **kwargs) -> str:
    """Bulletproof prompt formatter to prevent crashes from technical characters."""
    prompt = template
    for key, value in kwargs.items():
        prompt = prompt.replace(f"{{{key}}}", str(value))
    return prompt

def _parse_json_response(text: str) -> dict:
    """Highly resilient JSON parser that ignores all markdown and conversational fluff."""
    try:
        match = re.search(r'\{.*\}', text.strip(), re.DOTALL)
        if match:
            clean_json = match.group(0)
            clean_json = re.sub(r',\s*}', '}', clean_json)
            clean_json = re.sub(r',\s*]', ']', clean_json)
            return json.loads(clean_json)
        else:
            raise ValueError("No JSON brackets found in AI response.")
    except Exception as e:
        print(f"[BATS] Critical JSON Parsing Error: {e}\nRaw Text snippet: {text[:300]}...")
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

# ─── ENTERPRISE PROMPTS ──────────────────────────────────────

EVALUATION_PROMPT = """You are "BATS", an elite AI Executive Recruiter System used by Tier-1 tech companies.
You are running a deep-dive evaluation. You have the Job Description, the Candidate's Deeply Parsed Resume, and the actual Live Interview Transcript.

*** ZERO-TOLERANCE KILL SWITCH (CRITICAL) ***
If the [INTERVIEW_TRANSCRIPT] contains the phrase "[SYSTEM LOG]" (indicating a security breach/cheat) OR if the candidate spoke less than 15 words total:
1. You MUST set ALL scores (technical_proficiency, relevance_to_jd, communication, confidence_level, overall_score) to EXACTLY 0.
2. You MUST set hiring_recommendation to "Reject".
3. You MUST state the security breach or failure to complete the interview in the justification. 
DO NOT evaluate the candidate's resume if this kill switch is triggered.

CRITICAL ENTERPRISE RULES:
1. FAIRNESS DOCTRINE: You MUST NOT penalize the candidate's "Technical Proficiency" or "Overall Score" for broken English, grammatical errors, or fumbling. Judge them PURELY on the technical accuracy and logic of their answers. 
2. CONFIDENCE SCORE (0-100): Analyze the transcript for filler words ("um", "uh", "like"), sudden pauses, or incomplete sentences. Generate a separate Confidence Score based purely on these speech patterns.

You MUST use the following "Mixture of Experts" framework to grade the candidate (UNLESS the Kill Switch is activated):

Step 1: THE ADVOCATE (Alignment & Strengths)
Find every piece of evidence in the transcript that proves the candidate possesses the skills listed in the JD and their Resume. Do they sound like an expert?

Step 2: THE DETECTIVE (Cross-Verification - CRITICAL)
Compare what they *said* in the transcript against the exact metrics and massive projects they *claimed* on their resume. Identify any discrepancies.

Step 3: THE SKEPTIC (Weaknesses & Red Flags)
Where did they struggle? Were their technical explanations shallow? 

Step 4: THE JUDGE (Your Output)
Synthesize the findings. Grade strictly but fairly based on actual evidence.
- 90-100: Exceptional, undeniable proof of expertise. Strong Hire.
- 75-89: Solid, capable, minor gaps. Lean Hire / Strong Hire.
- 60-74: Average, lacks deep architecture knowledge. Lean Hire / Reject.
- Below 60: Major discrepancies or lack of knowledge. Reject.

You MUST output ONLY valid JSON with this exact structure:
{
  "candidate_overview": "A highly detailed 4-sentence executive summary of their technical depth.",
  "scores": {
    "technical_proficiency": 0,
    "relevance_to_jd": 0,
    "communication": 0,
    "confidence_level": 0,
    "overall_score": 0
  },
  "sentiment": {
    "rating": "Positive | Neutral | Negative",
    "explanation": "Deep analysis of the candidate's tone."
  },
  "candidate_status": {
    "level": "Strong Confidence | Moderate Confidence | Low Confidence | Needs Improvement",
    "description": "Brief description of candidate's readiness."
  },
  "strengths": ["Specific strength 1 matching transcript to resume", "Specific strength 2"],
  "red_flags_or_weaknesses": ["Specific technical gap or discrepancy 1", "Specific weakness 2"],
  "dynamic_follow_up_questions": ["Hard follow-up question based on a vague answer"],
  "hiring_recommendation": "Strong Hire | Lean Hire | Reject",
  "justification": "A highly detailed 2-paragraph explanation explicitly citing moments from the interview transcript to justify the score."
}

[JOB_DESCRIPTION]
{job_description}

[CANDIDATE_RESUME]
{resume}

[INTERVIEW_TRANSCRIPT]
{transcript}
"""

QUESTION_GENERATION_PROMPT = """You are "BATS", an elite AI technical interviewer.
Analyze BOTH the Job Description AND the Candidate's Resume to generate {num_questions} highly unique, targeted questions.

The target difficulty level is: {interview_level}.

RULES:
1. If the level is L1 (Junior), focus on fundamentals and basic resume projects.
2. If the level is L3/L4 (Senior/Architect), ask brutal system design, scalability, and deep architectural questions.
3. At least 40% MUST directly challenge specific projects, architectures, or metrics from their resume.
4. At least 25% must be JD-specific technical questions.
5. Force the candidate to explain the "HOW" and "WHY" behind their exact resume claims.
6. Ensure no questions repeat for this candidate.

Output ONLY valid JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "The highly specific interview question text",
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

JD_GENERATION_PROMPT = """Generate a detailed, professional Job Description for: {position}. Output plain text only."""

DYNAMIC_INTERVIEW_TURN_PROMPT = """You are an elite AI technical interviewer. 
Question: {question}
Candidate's Answer: {answer}

Task: If the answer is vague or lacks technical depth, generate a probing follow-up question to test their actual knowledge. If strong, briefly acknowledge and move on. Output ONLY the exact text you would speak. Max 2 sentences."""

RESUME_PARSER_PROMPT = """You are an elite AI Data Extraction Engine used by Tier-1 companies (like Eightfold or Workday). 
Your job is to read unstructured, messy resume text (which may include tables, weird fonts, or bad formatting) and meticulously extract EVERYTHING into a "Liquid JSON Schema".

CRITICAL EXTRACTION RULES (STRICT COMPLIANCE REQUIRED):
1. NEVER output `null`. If data is missing (like a phone number), use "Not Provided" or an empty array `[]`.
2. NO GENERIC SUMMARIES. For 'key_achievements', you MUST extract the candidate's EXACT numbers, metrics, scale, and highly specific technical outcomes (e.g., extract "Reduced latency by 45% using Redis" — DO NOT write "Improved performance").
3. Extract ALL contact info, including GitHub, LinkedIn, or Portfolio URLs.
4. Extract EVERY SINGLE Project and Company. Do not skip any. Extract the EXACT technologies used for that specific project. Do not hallucinate tools that weren't mentioned for that project.

You MUST output ONLY valid JSON matching this exact structure:
{
  "candidate_info": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "links": ["url 1", "url 2"]
  },
  "executive_summary": "Deep 3-sentence summary of their exact technical depth, years of experience, and primary domain.",
  "core_skills": {
    "languages_and_frameworks": ["skill 1", "skill 2"],
    "cloud_and_infrastructure": ["skill 1", "skill 2"],
    "databases_and_tools": ["skill 1", "skill 2"]
  },
  "experience_and_projects": [
    {
      "name": "Company OR Project Name",
      "role": "string",
      "duration": "string",
      "technologies_used": ["tech 1", "tech 2"],
      "key_achievements": ["Exact quantifiable metric/technical achievement 1", "Exact metric 2"]
    }
  ],
  "education_and_certifications": [
    "Degree/Cert 1 details",
    "Degree/Cert 2 details"
  ]
}

Raw Resume Text:
{raw_text}
"""

# ─── HYBRID AI PROVIDER CALLS ───────────────────────────────

async def transcribe_audio(file_path: str) -> str:
    """HYBRID ROUTE: Groq Whisper (Best for Audio)"""
    if not GROQ_API_KEY: raise ValueError("GROQ_API_KEY is required.")
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            with open(file_path, "rb") as audio_file:
                files = {"file": (os.path.basename(file_path), audio_file, "audio/mpeg")}
                data = {"model": "whisper-large-v3", "response_format": "text"}
                url = "https://" + "api.groq.com/openai/v1/audio/transcriptions"
                resp = await client.post(url, headers={"Authorization": f"Bearer {GROQ_API_KEY}"}, files=files, data=data)
                resp.raise_for_status()
                return resp.text
    except Exception as e:
        print(f"[BATS] Transcription failed: {e}")
        raise

async def _call_groq(prompt: str, force_json: bool = False, max_tokens: int = 4000) -> dict:
    """HYBRID ROUTE: Groq Llama 3.3 (Fastest Reasoning)"""
    async with httpx.AsyncClient(timeout=90) as client:
        payload = {
            "model": "llama-3.3-70b-versatile", 
            "messages": [{"role": "user", "content": prompt}], 
            "temperature": 0.1, 
            "max_tokens": max_tokens
        }
        if force_json: payload["response_format"] = {"type": "json_object"}
        url = "https://" + "api.groq.com/openai/v1/chat/completions"
        resp = await client.post(url, headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}, json=payload)
        resp.raise_for_status()
        
        if force_json: return json.loads(resp.json()["choices"][0]["message"]["content"])
        return _parse_json_response(resp.json()["choices"][0]["message"]["content"])

def _call_gemini_sync(prompt: str) -> str:
    """HYBRID ROUTE: Gemini 2.0 Flash (1-Million Token Memory)"""
    from google import genai
    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
    return response.text

async def _call_gemini(prompt: str) -> dict:
    text = await asyncio.to_thread(_call_gemini_sync, prompt)
    return _parse_json_response(text)

async def _call_groq_text(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        url = "https://" + "api.groq.com/openai/v1/chat/completions"
        resp = await client.post(url, headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}, json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": prompt}], "temperature": 0.3, "max_tokens": 1000})
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()

# ─── THE MOE CASCADE ROUTER ─────────────────────────────────

async def _call_ai_cascade(prompt: str, force_json: bool = False) -> dict:
    errors = []
    
    if GROQ_API_KEY:
        try:
            print("[BATS] Evaluator routing to Groq...")
            return await _call_groq(prompt, force_json, max_tokens=6000)
        except Exception as e:
            errors.append(f"Groq: {e}")
            print(f"[BATS] Groq failed, cascading... {e}")

    if GEMINI_API_KEY:
        try:
            print("[BATS] Evaluator cascading to Gemini...")
            return await _call_gemini(prompt)
        except Exception as e:
            errors.append(f"Gemini: {e}")
            print(f"[BATS] Gemini failed... {e}")

    raise ValueError(f"All AI Cascade providers failed: {'; '.join(errors)}")

# ─── PUBLIC API EXPORTS (THE HYBRID CONDUCTOR) ──────────────

async def parse_resume_to_json(raw_text: str) -> dict:
    prompt = format_prompt(RESUME_PARSER_PROMPT, raw_text=raw_text)
    
    if GEMINI_API_KEY:
        try:
            print("[BATS] Super Extractor: Hard-routing to Gemini (1M Context Window)...")
            return await _call_gemini(prompt)
        except Exception as e:
            print(f"[BATS] Gemini parsing failed, falling back to Groq: {e}")
    
    try:
        print("[BATS] Super Extractor: Routing to Groq (Truncating input to prevent crash)...")
        safe_text = raw_text[:15000]
        return await _call_groq(format_prompt(RESUME_PARSER_PROMPT, raw_text=safe_text), force_json=True, max_tokens=6000)
    except Exception as e:
        print(f"[BATS] FATAL Parsing Error: {e}")
        return {
            "candidate_info": {"name": "Extraction Failed", "email": "Not Provided", "phone": "Not Provided", "links": []},
            "executive_summary": "System exceeded memory limits or encountered unreadable formatting.",
            "core_skills": {"languages_and_frameworks": [], "cloud_and_infrastructure": [], "databases_and_tools": []},
            "experience_and_projects": [{"name": "System Error", "role": "Not Provided", "duration": "Not Provided", "technologies_used": [], "key_achievements": []}],
            "education_and_certifications": []
        }

async def evaluate_candidate(job_description: str, resume: str, transcript: str) -> dict:
    prompt = format_prompt(EVALUATION_PROMPT, job_description=job_description, resume=resume, transcript=transcript)
    result = await _call_ai_cascade(prompt, force_json=True)
    return _validate_result(result)

async def generate_interview_questions(job_description: str, resume: str, num_questions: int = 10, interview_level: str = "L2"):
    prompt = format_prompt(QUESTION_GENERATION_PROMPT, job_description=job_description, resume=resume, num_questions=num_questions, interview_level=interview_level)
    result = await _call_ai_cascade(prompt, force_json=True)
    return result.get("questions", [])

async def generate_jd(position: str) -> str:
    prompt = format_prompt(JD_GENERATION_PROMPT, position=position)
    return await _call_groq_text(prompt)

async def get_answer_acknowledgment(question: str, answer: str) -> str:
    prompt = format_prompt(DYNAMIC_INTERVIEW_TURN_PROMPT, question=question, answer=answer)
    try:
        return await _call_groq_text(prompt)
    except Exception as e:
        print(f"[BATS] Dynamic response failed: {e}")
        return "Thank you for sharing that context. Let's move on to the next question."