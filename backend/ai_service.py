"""
BATS ForgePro AI Evaluation Service - True Hybrid Enterprise Grade
1. Groq (Whisper) -> Audio Extraction
2. Google Gemini 2.0 Flash (1M Context) -> Deep Semantic Resume Parsing (Super Extractor)
3. Groq (Llama 3.1 & 3.3) -> Real-time Interview Generation & Semantic MoE Cascade
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

# ─── ENTERPRISE PROMPTS (THE ZERO-TOLERANCE ENGINE) ───────────

EVALUATION_PROMPT = """You are "BATS ForgePro", an elite AI Executive Recruiter System used by Tier-1 tech companies.
You are running a deep-dive evaluation. You have the Job Description, the Candidate's Resume, and the actual Live Interview Transcript.

*** ENTERPRISE EVALUATION PROTOCOL ***
1. JD + RESUME + TRANSCRIPT TRIANGLE: The evaluation MUST be accurate, reliable, and entirely justified by what the candidate ACTUALLY SPOKE in the [INTERVIEW_TRANSCRIPT]. The [CANDIDATE_RESUME] provides context to verify if their spoken claims match their written claims.
2. ZERO-TOLERANCE BIAS: If the candidate worked at Google on their resume but said nothing, skipped questions, or gave shallow answers during the interview, their `technical_proficiency` MUST drop to Zero. Do NOT give them "free points" for a good resume.
3. VOCAL SENTIMENT & CONFIDENCE: Deeply analyze the transcript for behavioral cues. Look for "<SILENCE>", filler words ("um", "uh", "like"), frequent pauses, or asking to skip questions repeatedly. Use this to determine `confidence_level` and `sentiment`.

Synthesize the findings reliably.
- 90-100: Exceptional, undeniable proof of expertise spoken in transcript. Strong Hire.
- 75-89: Solid, capable, minor gaps. Lean Hire.
- 60-74: Average, superficial answers, lacks deep knowledge. Reject.
- Below 60: Major discrepancies, extreme brevity, lack of confidence, or silence. Reject.

You MUST output ONLY valid JSON matching this exact structure:
{
  "candidate_overview": "A highly detailed 4-sentence executive summary of their spoken technical depth and semantic reasoning skills.",
  "scores": {
    "technical_proficiency": 0,
    "relevance_to_jd": 0,
    "communication": 0,
    "confidence_level": 0,
    "overall_score": 0
  },
  "sentiment": {
    "rating": "Positive | Neutral | Negative",
    "explanation": "Deep analysis of the candidate's vocal sentiment, pacing, hesitation, and emotional confidence based on transcript markers."
  },
  "candidate_status": {
    "level": "Strong Confidence | Moderate Confidence | Low Confidence | Needs Improvement",
    "description": "Brief description of candidate's readiness."
  },
  "strengths": ["Specific strength 1 matching transcript", "Specific strength 2"],
  "red_flags_or_weaknesses": ["Specific technical gap or discrepancy 1", "Specific weakness 2"],
  "dynamic_follow_up_questions": ["Hard follow-up question based on a vague answer"],
  "hiring_recommendation": "Strong Hire | Lean Hire | Reject",
  "justification": "A highly reliable, accurate, and detailed 2-paragraph explanation explicitly citing the candidate's spoken logic from the interview to justify the verdict."
}

[JOB_DESCRIPTION]
{job_description}

[CANDIDATE_RESUME]
{resume}

[INTERVIEW_TRANSCRIPT]
{transcript}
"""

QUESTION_GENERATION_PROMPT = """You are "BATS ForgePro", an elite, human-like AI technical interviewer.
Analyze BOTH the Job Description AND the Candidate's Resume to generate EXACTLY {num_questions} highly unique, targeted questions.

The target difficulty level is: {interview_level}.

RULES:
1. HUMAN-LIKE PRE-SCREENING: Questions must be conversational, punchy, and sound like they are coming from a real Senior Engineer. Strictly keep questions under 2 sentences. 
2. HYPER-PERSONALIZATION: Do not ask robotic trivia ("What is Kubernetes?"). Instead, ask contextual questions based on their resume ("I noticed you used Kubernetes on the Nexus project. What was the hardest part of scaling that?").
3. At least 40% MUST directly challenge specific projects, architectures, or metrics from their resume.

Output ONLY valid JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "The conversational, highly specific interview question text",
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

DYNAMIC_INTERVIEW_TURN_PROMPT = """You are BATS ForgePro, an elite, highly realistic AI technical interviewer.
You are conducting a live voice interview, mimicking a real Senior Engineer perfectly.

Question you just asked: {question}
Candidate's Answer: {answer}
Next Question queued: {next_question}

Your job is to analyze their answer and decide EXACTLY what to say next, based on these Strict Behavioral Edge Cases:

🟢 A. Normal/Good Answer (Clear, 2-5 sec pauses):
Acknowledge naturally ("Makes sense," "Got it.") and ask the [Next Question queued]. Set is_sufficient = true.

🟡 B. Thinking / Pause Scenarios:
- If answer contains "give me 2 minutes to think": Respond: "I can give you 30 seconds due to time constraints. Please proceed when ready." Set is_sufficient = false.
- If answer contains "<SILENCE>": Respond: "Take your time, let me know when you're ready." Set is_sufficient = false. If they do it again, say "Let's move to the next question." and ask [Next Question queued], set is_sufficient = true.

🔴 C. No Response / Technical Silence:
- If answer contains "[SYSTEM: MIC_ERROR]": Respond: "I'm unable to hear you. Could you please check your microphone?" Set is_sufficient = false.

🤯 D. Confused Candidate ("I didn't understand", "Can you repeat?"):
Rephrase or simplify the current question. Set is_sufficient = false. If repeated, say "Let's try a different question" and ask [Next Question queued], setting is_sufficient = true.

😵 E. Nervous / Hesitant (Uses "uhh", "umm", "like"):
Encourage them: "Take your time, you're doing fine. Whenever you're ready..." Set is_sufficient = false.

😶 F. One-Word / Weak Answers ("Yes", "No", "Maybe"):
Trigger follow-up: "Could you elaborate on that?" or "Can you walk me through the 'why'?" Set is_sufficient = false.

🧠 G. Overly Long Answers:
- If answer contains "[SYSTEM: OVER_TIME_LIMIT]": Respond: "Thanks, I'll stop you here due to time constraints. Let's move on." Ask the [Next Question queued]. Set is_sufficient = true.

🧪 H. Wrong / Irrelevant / Off-Topic Story:
Respond: "That's not exactly what I was asking. Let me clarify, we are looking for..." and steer them back. Set is_sufficient = false.

🧾 I. Copy-Paste / Cheating Detection (Robotic/Textbook answers):
Ask follow-up: "Interesting. Can you explain that in your own words, perhaps with a real-world example from your past projects?" Set is_sufficient = false.

😡 J. Rude / Aggressive Candidate ("This is stupid"):
Respond: "Let's keep the conversation professional." Set is_sufficient = false.

😂 K. Casual / Overfriendly ("Bro", "Dude"):
Maintain strict professionalism. Do NOT mirror their tone. Proceed with evaluation.

🛑 L. Candidate Refuses / Wants to Skip ("I don't know", "skip", "no idea", "next"):
Respond: "That's completely fine, we'll pivot to something else." and ask the [Next Question queued]. Set is_sufficient = true.

🎯 M. Counter Questions ("Is this remote?"):
Respond: "We'll definitely cover role-related details at the end. For now, let's focus on..." and repeat your question. Set is_sufficient = false.

🧑‍💻 N. Technical Partial Answers (Correct approach, wrong syntax):
Give a hint: "You're on the right track. Think about the time complexity here..." Set is_sufficient = false.

🧠 O. Smart Candidate (Deep answers):
Ask a deeper follow-up. Probe an edge case. "That works, but what happens if we scale this to 1M users?" Set is_sufficient = false.

📍 P. Asks for a Hint:
Give a minimal hint, not the full answer. Set is_sufficient = false.

CRITICAL RULES:
1. NEVER say "Thank you for your answer." Act like a real, conversational Senior Engineer.
2. If is_sufficient is TRUE, you MUST append the [Next Question queued] to your response_text.
3. If is_sufficient is FALSE, you are digging deeper, waiting, or giving hints, so DO NOT ask the [Next Question queued].

Output ONLY valid JSON matching this exact structure:
{
  "response_text": "The exact conversational words you will speak.",
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

# ─── API CALLS ──────────────────────────────────────

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
        payload = {"model": groq_model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2, "max_tokens": max_tokens}
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
    if force_json: payload["generationConfig"] = {"responseMimeType": "application/json"}
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
        resp = await client.post(url, headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}, json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": prompt}], "temperature": 0.3, "max_tokens": 1000})
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

# ─── PUBLIC EXPORTS ──────────────────────────────────────

async def parse_resume_to_json(raw_text: str) -> dict:
    safe_text = re.sub(r'[^\x20-\x7E\n\r\t\|]', ' ', raw_text)[:6000]
    prompt = format_prompt(RESUME_PARSER_PROMPT, raw_text=safe_text)
    try: return await _call_ai_cascade(prompt, force_json=True, max_tokens=1500, groq_model="llama-3.1-8b-instant", prioritize_gemini=True)
    except: return {"candidate_info": {"name": "Extraction Error", "email": "Error", "phone": "Error", "links": []}, "executive_summary": "Parsing failed.", "core_skills": {"languages_and_frameworks": [], "cloud_and_infrastructure": [], "databases_and_tools": []}, "experience_and_projects": [], "education_and_certifications": []}

async def evaluate_candidate(job_description: str, resume: str, transcript: str) -> dict:
    clean_transcript = transcript.replace("(No speech detected)", "").strip()
    word_count = len(clean_transcript.split())
    is_breach = "[SYSTEM LOG]: SECURITY BREACH" in transcript
    
    # 🛡️ ZERO-TOLERANCE CHECK
    if is_breach or word_count < 15:
        reason = "Candidate triggered the Anti-Cheat Security Vault." if is_breach else "Candidate remained largely silent, skipped questions, or failed to provide any technical depth in the spoken interview."
        return {
            "candidate_overview": f"Session automatically rejected. {reason}",
            "scores": { "technical_proficiency": 0, "relevance_to_jd": 0, "communication": 0, "confidence_level": 0, "overall_score": 0 },
            "sentiment": {"rating": "Negative", "explanation": "Session failed or terminated prematurely."},
            "candidate_status": {"level": "Needs Improvement", "description": "Terminated/Incomplete"},
            "strengths": ["None identified due to lack of technical interaction."],
            "red_flags_or_weaknesses": [f"CRITICAL: {reason}"],
            "dynamic_follow_up_questions": [],
            "hiring_recommendation": "Reject",
            "justification": f"Zero-Tolerance Engine Activated: {reason} No technical points were awarded regardless of resume strength. The candidate's technical score is 0 due to an inability or refusal to verbally prove competence."
        }

    safe_resume = resume[:5000]
    safe_jd = job_description[:4000]
    prompt = format_prompt(EVALUATION_PROMPT, job_description=safe_jd, resume=safe_resume, transcript=transcript)
    result = await _call_ai_cascade(prompt, force_json=True, max_tokens=2000, groq_model="llama-3.3-70b-versatile")
    return _validate_result(result)

async def generate_interview_questions(job_description: str, resume: str, num_questions: int = 10, interview_level: str = "L2"):
    prompt = format_prompt(QUESTION_GENERATION_PROMPT, job_description=job_description[:3000], resume=resume[:4000], num_questions=num_questions, interview_level=interview_level)
    try:
        result = await _call_ai_cascade(prompt, force_json=True, max_tokens=1500, groq_model="llama-3.3-70b-versatile")
        return result.get("questions", [])
    except Exception:
        return [{"id": 1, "question": "Could you describe your most impactful project?", "category": "technical", "difficulty": "medium"}]

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