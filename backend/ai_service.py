"""
BATS ForgePro AI Evaluation Service - True Hybrid Enterprise Grade
1. Groq (Whisper) -> Audio Extraction
2. Google Gemini 2.0 Flash (1M Context) -> Deep Semantic Resume Parsing (Super Extractor)
3. Groq (Llama 3.1 & 3.3) -> Real-time Interview Generation & MoE Cascade
"""

import os
import json
import asyncio
import httpx
import re
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ─── UTILITY FUNCTIONS ──────────────────────────────────────

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

EVALUATION_PROMPT = """You are "BATS ForgePro", an elite AI Executive Recruiter System used by Tier-1 tech companies.
You are running a deep-dive evaluation. You have the Job Description, the Candidate's Deeply Parsed Resume, and the actual Live Interview Transcript.

*** ZERO-TOLERANCE KILL SWITCH (CRITICAL) ***
If the [INTERVIEW_TRANSCRIPT] contains the phrase "[SYSTEM LOG]" (indicating a security breach/cheat):
1. You MUST set ALL scores (technical_proficiency, relevance_to_jd, communication, confidence_level, overall_score) to EXACTLY 0.
2. You MUST set hiring_recommendation to "Reject".
3. You MUST state the security breach in the justification. 
DO NOT evaluate the candidate's resume if this kill switch is triggered.

CRITICAL ENTERPRISE RULES:
1. FAIRNESS DOCTRINE: You MUST NOT penalize the candidate's "Technical Proficiency" or "Overall Score" for broken English, grammatical errors, or fumbling. Judge them PURELY on the technical accuracy and logic of their answers. 
2. CONFIDENCE SCORE (0-100): Analyze the transcript for filler words ("um", "uh", "like"), sudden pauses, or incomplete sentences. Generate a separate Confidence Score based purely on these speech patterns.
3. RUTHLESS TECHNICAL STANDARD: If the candidate provides generic, high-level, or superficial answers without specific technical implementation details, you MUST assign a Technical Score below 50. Do not inflate scores out of politeness.

You MUST use the following "Mixture of Experts" framework to grade the candidate (UNLESS the Kill Switch is activated):

Step 1: THE ADVOCATE (Alignment & Strengths)
Find every piece of evidence in the transcript that proves the candidate possesses the skills listed in the JD.

Step 2: THE DETECTIVE (Cross-Verification - CRITICAL)
Compare what they *said* in the transcript against the exact metrics and massive projects they *claimed* on their resume. Identify any discrepancies or exaggerations.

Step 3: THE SKEPTIC (Weaknesses & Red Flags)
Where did they struggle? Were their technical explanations shallow? Did they dodge the core of the question?

Step 4: THE JUDGE (Your Output)
Synthesize the findings. Grade strictly based on actual evidence.
- 90-100: Exceptional, undeniable proof of expertise. Strong Hire.
- 75-89: Solid, capable, minor gaps. Lean Hire / Strong Hire.
- 60-74: Average, superficial answers, lacks deep architecture knowledge. Reject.
- Below 60: Major discrepancies, BS answers, or lack of knowledge. Reject.

You MUST output ONLY valid JSON matching this exact structure perfectly:
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

QUESTION_GENERATION_PROMPT = """You are "BATS ForgePro", an elite AI technical interviewer.
Analyze BOTH the Job Description AND the Candidate's Resume to generate EXACTLY {num_questions} highly unique, targeted questions.

The target difficulty level is: {interview_level}.

RULES:
1. If the level is L1 (Junior), focus on fundamentals and basic resume projects.
2. If the level is L3/L4 (Senior/Architect), ask brutal system design, scalability, and deep architectural questions.
3. At least 40% MUST directly challenge specific projects, architectures, or metrics from their resume.
4. At least 25% must be JD-specific technical questions.
5. Force the candidate to explain the "HOW" and "WHY" behind their exact resume claims.
6. Ensure no questions repeat for this candidate.
7. 🛡️ CRITICAL TIME CONSTRAINT: This is a fast-paced interview. Questions MUST be direct, highly relevant, and designed so the candidate can provide crisp, concise answers within 60-90 seconds. Do not ask overly broad questions that require 5 minutes to answer.

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

DYNAMIC_INTERVIEW_TURN_PROMPT = """You are BATS ForgePro, an elite, empathetic AI technical interviewer. 
You are conducting a live voice interview.

Question you just asked: {question}
Candidate's Answer: {answer}
Next Question you need to ask: {next_question}

Task: Analyze the candidate's answer and generate ONE fluid, conversational response.
1. If they ask a clarifying question: Answer it, set is_sufficient to false, and prompt them to answer the original question.
2. If their answer is very short or lacks depth: Set is_sufficient to false. Acknowledge what they said, then ask a probing follow-up question. Do NOT ask the Next Question yet.
3. If they give a strong answer: Set is_sufficient to true. Acknowledge a specific point they made, AND THEN seamlessly transition into asking the Next Question.

CRITICAL RULES FOR REALISM:
- NEVER say "Thank you", "Thanks for your answer", or "Great". It sounds robotic and repetitive.
- Use natural, casual human transitions like: "Got it.", "Understood.", "Interesting approach.", "Okay, moving on.", or just ask the next question directly.
- If the candidate's answer implies they don't know (e.g., "I don't know", "skip", "not sure"), YOU MUST SET "is_sufficient": true. Do not ask follow-ups. Just say "No problem, let's pivot," and ask the Next Question.

Output ONLY valid JSON matching this exact structure:
{
  "response_text": "The exact conversational words you will speak.",
  "is_sufficient": true
}
"""

# 🛡️ THE FIX: Upgraded parser prompt to act as an OCR-Reconstructor for messy files
RESUME_PARSER_PROMPT = """You are an elite AI Data Extraction Engine used by Tier-1 companies (BATS ForgePro). 
Your job is to read unstructured, messy resume text and meticulously extract EVERYTHING into a "Liquid JSON Schema".

*** GOD MODE PARSING ACTIVATED ***
The text provided may be fragmented, missing spaces, or contain OCR/binary artifacts (e.g., column layouts smashed together or separated by '|'). 
You must use spatial reasoning to reconstruct broken words, align columns, and piece together fractured sentences before extraction.

CRITICAL EXTRACTION RULES:
1. NEVER output `null`. If data is missing, use "Not Provided" or an empty array `[]`.
2. NO GENERIC SUMMARIES. For 'key_achievements', you MUST extract the candidate's EXACT numbers, metrics, scale, and highly specific technical outcomes. Reconstruct fragmented metric sentences.
3. Extract ALL contact info, including GitHub, LinkedIn, or Portfolio URLs.
4. Extract EVERY SINGLE Project and Company. Extract the EXACT technologies used.

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

# ─── BULLETPROOF REST API CALLS (SMART TOKEN ROUTING) ───

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
        payload = {
            "model": groq_model, 
            "messages": [{"role": "user", "content": prompt}], 
            "temperature": 0.2, 
            "max_tokens": max_tokens
        }
        if force_json: payload["response_format"] = {"type": "json_object"}
            
        url = "https://api.groq.com/openai/v1/chat/completions"
        for attempt in range(3):
            resp = await client.post(url, headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}, json=payload)
            if resp.status_code == 429 and attempt < 2:
                wait_time = (attempt + 1) * 5
                print(f"[BATS] Groq 429 Limit hit on {groq_model}. Holding breath for {wait_time} seconds...")
                await asyncio.sleep(wait_time)
                continue
            resp.raise_for_status()
            if force_json: return json.loads(resp.json()["choices"][0]["message"]["content"])
            return _parse_json_response(resp.json()["choices"][0]["message"]["content"])

async def _call_gemini(prompt: str, force_json: bool = False) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    if force_json:
        payload["generationConfig"] = {"responseMimeType": "application/json"}
        
    async with httpx.AsyncClient(timeout=60) as client:
        for attempt in range(3):
            resp = await client.post(url, headers={"Content-Type": "application/json"}, json=payload)
            if resp.status_code == 429 and attempt < 2:
                wait_time = (attempt + 1) * 5
                print(f"[BATS] Gemini 429 Limit hit. Holding breath for {wait_time} seconds...")
                await asyncio.sleep(wait_time)
                continue
            resp.raise_for_status()
            content = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            if force_json: return json.loads(content)
            return _parse_json_response(content)

async def _call_groq_text(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        url = "https://api.groq.com/openai/v1/chat/completions"
        for attempt in range(3):
            resp = await client.post(
                url, 
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}, 
                json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": prompt}], "temperature": 0.3, "max_tokens": 1000}
            )
            if resp.status_code == 429 and attempt < 2:
                await asyncio.sleep(5)
                continue
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()

async def _call_ai_cascade(prompt: str, force_json: bool = False, max_tokens: int = 6000, groq_model: str = "llama-3.3-70b-versatile", prioritize_gemini: bool = False) -> dict:
    errors = []
    if prioritize_gemini and GEMINI_API_KEY:
        try:
            return await _call_gemini(prompt, force_json=force_json)
        except Exception as e:
            errors.append(f"Gemini Error: {e}")

    if GROQ_API_KEY:
        try:
            return await _call_groq(prompt, force_json, max_tokens=max_tokens, groq_model=groq_model)
        except Exception as e:
            errors.append(f"Groq Error: {e}")
            
    if not prioritize_gemini and GEMINI_API_KEY:
        try:
            return await _call_gemini(prompt, force_json=force_json)
        except Exception as e:
            errors.append(f"Gemini Error: {e}")
            
    raise ValueError(f"All AI Cascade providers failed: {'; '.join(errors)}")

# ─── PUBLIC API EXPORTS ───────────────────────────────

async def parse_resume_to_json(raw_text: str) -> dict:
    if len(raw_text.strip()) < 50:
        print("[BATS ForgePro] WARNING: The extracted text is suspiciously short. PDF extraction may have failed.")
        
    # 🛡️ THE FIX: God-Mode Binary Cleaner Fallback
    # Strips out completely unreadable binary characters that crash LLMs, while preserving standard text and structural spaces.
    safe_text = re.sub(r'[^\x20-\x7E\n\r\t\|]', ' ', raw_text) 
    safe_text = re.sub(r'\s{3,}', ' | ', safe_text) # Preserve massive gaps as column delimiters
    safe_text = safe_text[:6000] # Increased context window to ensure we grab everything
    
    prompt = format_prompt(RESUME_PARSER_PROMPT, raw_text=safe_text)

    try:
        print("[BATS ForgePro] Parsing Resume with Smart Token Routing...")
        return await _call_ai_cascade(prompt, force_json=True, max_tokens=1500, groq_model="llama-3.1-8b-instant", prioritize_gemini=True)
        
    except Exception as e:
        error_msg = str(e).replace('"', "'")
        print(f"[BATS ForgePro] FATAL Parsing Error: {error_msg}")
        
        if "429" in error_msg:
            return {
                "candidate_info": {"name": "Candidate (API Busy)", "email": "api-rate-limit@system", "phone": "N/A", "links": []},
                "executive_summary": "The AI APIs (Groq/Gemini) are temporarily rate-limited due to rapid testing. The system has automatically bypassed the lock so you can proceed to the interview room.",
                "core_skills": {"languages_and_frameworks": ["System Override Activated"], "cloud_and_infrastructure": [], "databases_and_tools": []},
                "experience_and_projects": [{"name": "BATS API Bypass", "role": "System Fallback", "duration": "Current", "technologies_used": ["Retry Engine"], "key_achievements": ["Successfully bypassed API lock to allow candidate to continue."]}],
                "education_and_certifications": []
            }
            
        return {
            "candidate_info": {"name": "Extraction Failed", "email": "Error", "phone": "Error", "links": []},
            "executive_summary": f"AI API ERROR: {error_msg}. Please check the server logs.",
            "core_skills": {"languages_and_frameworks": [], "cloud_and_infrastructure": [], "databases_and_tools": []},
            "experience_and_projects": [{"name": "System Error", "role": "Not Provided", "duration": "Not Provided", "technologies_used": [], "key_achievements": []}],
            "education_and_certifications": []
        }

async def evaluate_candidate(job_description: str, resume: str, transcript: str) -> dict:
    clean_transcript = transcript.replace("(No speech detected)", "").strip()
    word_count = len(clean_transcript.split())
    is_breach = "[SYSTEM LOG]: SECURITY BREACH" in transcript

    if is_breach or word_count < 2:
        reason = "Candidate triggered the Anti-Cheat Security Vault." if is_breach else "Candidate remained completely silent or ended the interview immediately."
        return {
            "candidate_overview": f"Session automatically rejected. {reason}",
            "scores": { "technical_proficiency": 0, "relevance_to_jd": 0, "communication": 0, "confidence_level": 0, "overall_score": 0 },
            "sentiment": {"rating": "Negative", "explanation": "Session failed or terminated prematurely."},
            "candidate_status": {"level": "Needs Improvement", "description": "Terminated/Incomplete"},
            "strengths": ["None identified due to early termination."],
            "red_flags_or_weaknesses": [f"CRITICAL: {reason}"],
            "dynamic_follow_up_questions": [],
            "hiring_recommendation": "Reject",
            "justification": f"The platform's automatic kill switch was triggered. {reason} No technical evaluation was performed."
        }

    safe_resume = resume[:5000]
    safe_jd = job_description[:4000]

    prompt = format_prompt(EVALUATION_PROMPT, job_description=safe_jd, resume=safe_resume, transcript=transcript)
    result = await _call_ai_cascade(prompt, force_json=True, max_tokens=2000, groq_model="llama-3.3-70b-versatile")
    return _validate_result(result)

async def generate_interview_questions(job_description: str, resume: str, num_questions: int = 10, interview_level: str = "L2"):
    safe_resume = resume[:4000]
    safe_jd = job_description[:3000]
    prompt = format_prompt(QUESTION_GENERATION_PROMPT, job_description=safe_jd, resume=safe_resume, num_questions=num_questions, interview_level=interview_level)
    
    try:
        result = await _call_ai_cascade(prompt, force_json=True, max_tokens=1500, groq_model="llama-3.3-70b-versatile")
        questions = result.get("questions", [])
        if not questions:
            raise ValueError("AI returned an empty array.")
        return questions
    except Exception as e:
        print(f"[BATS ForgePro] Failed to generate custom questions, returning defaults: {e}")
        return [
            {"id": 1, "question": "Could you briefly describe your most impactful project and the core technologies used?", "category": "technical", "difficulty": "medium"},
            {"id": 2, "question": "What is the most challenging bug you've faced recently, and how did you resolve it?", "category": "behavioral", "difficulty": "hard"},
            {"id": 3, "question": "How does your specific experience align with the core requirements of this role?", "category": "behavioral", "difficulty": "medium"},
            {"id": 4, "question": "Can you explain a time you had to optimize a system or process for better performance?", "category": "technical", "difficulty": "hard"},
            {"id": 5, "question": "How do you handle disagreements on technical decisions within a team?", "category": "behavioral", "difficulty": "medium"},
            {"id": 6, "question": "Where do you see your technical skills adding the most immediate value to our team?", "category": "situational", "difficulty": "medium"},
            {"id": 7, "question": "Tell me about a time you had to learn a new technology quickly to deliver a project.", "category": "situational", "difficulty": "hard"},
            {"id": 8, "question": "How do you ensure the code you write is maintainable and scalable?", "category": "technical", "difficulty": "medium"}
        ]

async def generate_jd(position: str) -> str:
    prompt = format_prompt(JD_GENERATION_PROMPT, position=position)
    return await _call_groq_text(prompt)

async def get_answer_acknowledgment(question: str, answer: str, next_question: str = None) -> dict:
    next_q_text = next_question if next_question else "Thank the candidate and conclude this section."
    prompt = format_prompt(DYNAMIC_INTERVIEW_TURN_PROMPT, question=question, answer=answer, next_question=next_q_text)
    try:
        return await _call_ai_cascade(prompt, force_json=True, max_tokens=800, groq_model="llama-3.1-8b-instant")
    except Exception as e:
        return {"response_text": f"Got it. Let's move on. {next_q_text}", "is_sufficient": True}