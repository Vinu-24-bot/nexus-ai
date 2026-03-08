"""
BATS AI Evaluation Service
Uses multiple FREE AI providers with automatic fallback:
1. Groq (Llama 3.3 70B) - PRIMARY, FREE, 30 req/min
2. Cerebras (Llama 3.3 70B) - FREE, ultra-fast inference
3. Together AI (free tier) - FREE trial credits
4. Google Gemini (gemini-2.0-flash) - FREE tier available
"""

import os
import json
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

EVALUATION_PROMPT = """You are "BATS", an elite, unbiased, and highly technical AI Executive Recruiter.
Your task is to evaluate a candidate's interview performance against a specific Job Description and their submitted Resume.

Context & Rules:
- Evaluate strictly on technical accuracy, problem-solving methodology, and communication clarity.
- Ignore all demographic markers, filler words ("um", "uh"), and minor transcription errors.
- You are a strict but fair grader. A score of 100 means world-class expertise. A score of 50 means average competence.
- Cross-reference answers with the resume claims - check if the candidate actually has the skills they claim.
- Evaluate depth of knowledge, not just surface-level answers.

Evaluation Criteria:
1. Technical Proficiency (0-100): How well did they answer technical questions? Architecture understanding? Depth of knowledge?
2. Relevance to JD (0-100): Does their experience and answers map to the JD requirements?
3. Communication & Clarity (0-100): Were answers concise, structured, easy to follow? Did they use examples?
4. Confidence Level (0-100): Did the candidate sound confident, decisive, and articulate?
5. Overall Score: Weighted average (Technical 35%, Relevance 25%, Communication 25%, Confidence 15%)

Sentiment Analysis:
- Analyze the overall tone and sentiment of the candidate's responses
- Rate as: "Positive" | "Neutral" | "Negative"
- Provide a brief explanation

Candidate Status Assessment:
- Based on your evaluation provide a status: "Strong Confidence" | "Moderate Confidence" | "Low Confidence" | "Needs Improvement"
- Provide a brief description of what makes you assess this status

You MUST output ONLY valid JSON with this exact structure:
{{
  "candidate_overview": "A 2-3 sentence executive summary of the candidate's performance.",
  "scores": {{
    "technical_proficiency": 0,
    "relevance_to_jd": 0,
    "communication": 0,
    "confidence_level": 0,
    "overall_score": 0
  }},
  "sentiment": {{
    "rating": "Positive | Neutral | Negative",
    "explanation": "Brief explanation of the candidate's overall sentiment and tone."
  }},
  "candidate_status": {{
    "level": "Strong Confidence | Moderate Confidence | Low Confidence | Needs Improvement",
    "description": "Brief description of candidate's readiness and areas to improve."
  }},
  "strengths": ["string", "string", "string"],
  "red_flags_or_weaknesses": ["string", "string"],
  "dynamic_follow_up_questions": ["string", "string"],
  "hiring_recommendation": "Strong Hire | Lean Hire | Reject",
  "justification": "A detailed 2-3 paragraph explanation for the hiring recommendation with specific examples from the interview."
}}

Do NOT include markdown, code fences, or any text outside the JSON.

---

[JOB_DESCRIPTION]
{job_description}

[CANDIDATE_RESUME]
{resume}

[INTERVIEW_TRANSCRIPT]
{transcript}
"""

QUESTION_GENERATION_PROMPT = """You are "BATS", an elite AI interviewer conducting a comprehensive {num_questions}-question interview lasting approximately 20-25 minutes.

You MUST deeply analyze BOTH the Job Description AND the Candidate's Resume before generating questions.

## CRITICAL: RESUME-FIRST ANALYSIS
Before generating questions, mentally extract from the resume:
1. Every PROJECT mentioned — ask about architecture, challenges, tech choices, scale, impact
2. Every COMPANY and ROLE — ask about responsibilities, achievements, team size, what they built
3. Every SKILL/TECHNOLOGY claimed — verify depth by asking implementation-level questions
4. Every METRIC or ACHIEVEMENT — probe for specifics (how they measured, what was the baseline)
5. Any GAPS or INCONSISTENCIES — politely probe these areas

## CRITICAL: JD-ALIGNMENT ANALYSIS
Cross-reference resume with JD to find:
1. Skills the JD REQUIRES that the resume CLAIMS — verify these deeply
2. Skills the JD REQUIRES that the resume DOESN'T mention — test if candidate knows them
3. Domain-specific knowledge the role needs — test real understanding, not textbook answers

## QUESTION GENERATION RULES
- **At least 40% of questions MUST directly reference specific projects, companies, or achievements from the resume**
- **At least 25% must be JD-specific technical questions**
- **At least 2 questions must be PROJECT DEEP-DIVES**
- **At least 2 questions must test CLAIMED SKILLS at depth**
- **At least 1 question must present a REAL SCENARIO from the JD**
- **At least 1 question about a FAILURE or CHALLENGE**
- **At least 1 question about HOW they'd IMPROVE something**
- Questions should feel like a senior interviewer who has READ their resume thoroughly
- NEVER ask generic questions like "Tell me about yourself"
- Each question should require a 1-2 minute detailed answer

## DIFFICULTY DISTRIBUTION for {num_questions} questions:
- First 30%: **Easy** — Warm-up about their background, verify basic resume claims
- Middle 40%: **Medium** — Project deep-dives, applied knowledge, real scenarios
- Final 30%: **Hard** — System design, expert-level technical, architecture trade-offs

## QUESTION CATEGORY RULES:
- **technical** (65%+): Architecture, system design, coding patterns, debugging, performance
- **behavioral** (20%): Leadership, teamwork — ALWAYS tied to specific resume experiences
- **situational** (15%): Hypothetical scenarios from the JD's responsibilities

You MUST output ONLY valid JSON with this exact structure:
{{
  "questions": [
    {{
      "id": 1,
      "question": "The interview question text",
      "category": "technical | behavioral | situational",
      "difficulty": "easy | medium | hard"
    }}
  ]
}}

Do NOT include markdown, code fences, or any text outside the JSON.

---

[JOB_DESCRIPTION]
{job_description}

[CANDIDATE_RESUME]
{resume}
"""

JD_GENERATION_PROMPT = """You are an expert HR professional. Generate a detailed, professional Job Description for the following role:

Role: {position}

Create a comprehensive JD that includes:
1. Job Title
2. Job Summary (2-3 sentences)
3. Key Responsibilities (5-7 bullet points)
4. Required Skills & Qualifications (5-8 items)
5. Preferred/Nice-to-have Skills (3-4 items)
6. Experience Level Required

Output ONLY the Job Description as plain text (no JSON, no markdown fences). Make it realistic and detailed.
"""

ANSWER_ACKNOWLEDGMENT_PROMPT = """You are "BATS", an AI interviewer conducting a live interview. The candidate just answered a question. 
Give a very brief (1-2 sentence) natural acknowledgment of their answer before transitioning to the next question.
Be professional, warm, and encouraging. Reference something specific from their answer.
Do NOT evaluate or score - just acknowledge naturally like a real interviewer would.

Question asked: {question}
Candidate's answer: {answer}

Output ONLY the acknowledgment text (1-2 sentences, no JSON, no quotes).
"""


def _parse_json_response(text: str) -> dict:
    """Parse JSON from AI response, handling markdown fences."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    if text.startswith("json"):
        text = text[4:]
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        raise ValueError(f"Failed to parse JSON: {text[:200]}")


def _validate_result(result: dict) -> dict:
    """Validate all required fields exist."""
    required = [
        "candidate_overview", "scores", "strengths",
        "red_flags_or_weaknesses", "dynamic_follow_up_questions",
        "hiring_recommendation", "justification"
    ]
    for field in required:
        if field not in result:
            raise ValueError(f"Missing required field: {field}")
    
    if "sentiment" not in result:
        result["sentiment"] = {"rating": "Neutral", "explanation": "Not analyzed"}
    if "candidate_status" not in result:
        result["candidate_status"] = {"level": "Moderate Confidence", "description": "Standard assessment"}
    if "confidence_level" not in result.get("scores", {}):
        result["scores"]["confidence_level"] = result["scores"].get("communication", 50)
    
    return result


# ─── AI Provider: Groq (PRIMARY - FREE) ─────────────────────
async def _call_groq(prompt: str) -> dict:
    """Call Groq API with Llama 3.3 70B (FREE - 30 req/min)."""
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 4000,
            },
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
        return _parse_json_response(text)


async def _call_groq_text(prompt: str) -> str:
    """Call Groq for plain text response."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.5,
                "max_tokens": 2000,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()


# ─── AI Provider: Cerebras (FREE - ultra-fast) ──────────────
async def _call_cerebras(prompt: str) -> dict:
    """Call Cerebras API with Llama 3.3 70B (FREE - extremely fast inference)."""
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            "https://api.cerebras.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {CEREBRAS_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 4000,
            },
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
        return _parse_json_response(text)


async def _call_cerebras_text(prompt: str) -> str:
    """Call Cerebras for plain text."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.cerebras.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {CEREBRAS_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.5,
                "max_tokens": 2000,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()


# ─── AI Provider: Together AI (FREE trial) ──────────────────
async def _call_together(prompt: str) -> dict:
    """Call Together AI API (FREE trial credits included)."""
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            "https://api.together.xyz/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {TOGETHER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 4000,
            },
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
        return _parse_json_response(text)


async def _call_together_text(prompt: str) -> str:
    """Call Together AI for plain text."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.together.xyz/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {TOGETHER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.5,
                "max_tokens": 2000,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()


# ─── AI Provider: Google Gemini (FREE tier) ──────────────────
def _call_gemini_sync(prompt: str) -> str:
    """Synchronous Gemini call (will be run in thread)."""
    from google import genai
    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    return response.text


async def _call_gemini(prompt: str) -> dict:
    """Call Google Gemini API."""
    text = await asyncio.to_thread(_call_gemini_sync, prompt)
    return _parse_json_response(text)


# ─── Unified AI caller with cascading fallback ──────────────
async def _call_ai(prompt: str) -> dict:
    """Try all AI providers in order: Groq → Cerebras → Together → Gemini."""
    errors = []
    providers = []

    if GROQ_API_KEY:
        providers.append(("Groq (Llama 3.3 70B)", _call_groq))
    if CEREBRAS_API_KEY:
        providers.append(("Cerebras (Llama 3.3 70B)", _call_cerebras))
    if TOGETHER_API_KEY:
        providers.append(("Together AI (Llama 3.3 70B)", _call_together))
    if GEMINI_API_KEY:
        providers.append(("Google Gemini", _call_gemini))

    if not providers:
        raise ValueError(
            "No AI API keys configured! Add at least one to your .env file:\n"
            "  GROQ_API_KEY    — FREE: https://console.groq.com\n"
            "  CEREBRAS_API_KEY — FREE: https://cloud.cerebras.ai\n"
            "  TOGETHER_API_KEY — FREE trial: https://api.together.xyz\n"
            "  GEMINI_API_KEY  — FREE: https://aistudio.google.com/apikey"
        )

    for name, fn in providers:
        try:
            print(f"[BATS] Using {name}...")
            return await fn(prompt)
        except Exception as e:
            errors.append(f"{name}: {e}")
            print(f"[BATS] {name} failed: {e}")

    raise ValueError(f"All AI providers failed: {'; '.join(errors)}")


async def _call_ai_text(prompt: str) -> str:
    """Try all providers for plain text response."""
    errors = []
    providers = []

    if GROQ_API_KEY:
        providers.append(("Groq", _call_groq_text))
    if CEREBRAS_API_KEY:
        providers.append(("Cerebras", _call_cerebras_text))
    if TOGETHER_API_KEY:
        providers.append(("Together AI", _call_together_text))
    if GEMINI_API_KEY:
        providers.append(("Gemini", lambda p: asyncio.to_thread(_call_gemini_sync, p)))

    if not providers:
        raise ValueError("No AI providers available for text generation")

    for name, fn in providers:
        try:
            result = await fn(prompt)
            if isinstance(result, str):
                return result.strip()
            return str(result).strip()
        except Exception as e:
            errors.append(f"{name}: {e}")
            print(f"[BATS] {name} text failed: {e}")

    raise ValueError(f"All AI text providers failed: {'; '.join(errors)}")


# ─── Public API functions ────────────────────────────────────
async def evaluate_candidate(
    job_description: str,
    resume: str,
    transcript: str,
) -> dict:
    """Call AI to evaluate a candidate."""
    prompt = EVALUATION_PROMPT.format(
        job_description=job_description,
        resume=resume,
        transcript=transcript,
    )
    result = await _call_ai(prompt)
    return _validate_result(result)


async def generate_interview_questions(
    job_description: str,
    resume: str,
    num_questions: int = 6,
) -> list:
    """Generate interview questions based on JD and resume."""
    prompt = QUESTION_GENERATION_PROMPT.format(
        job_description=job_description,
        resume=resume,
        num_questions=num_questions,
    )
    result = await _call_ai(prompt)
    if "questions" not in result:
        raise ValueError("AI did not return questions")
    
    difficulty_order = {"easy": 0, "medium": 1, "hard": 2}
    questions = sorted(
        result["questions"],
        key=lambda q: difficulty_order.get(q.get("difficulty", "medium"), 1)
    )
    for i, q in enumerate(questions):
        q["id"] = i + 1
    
    return questions


async def generate_jd(position: str) -> str:
    """Auto-generate a Job Description from a position title."""
    prompt = JD_GENERATION_PROMPT.format(position=position)
    return await _call_ai_text(prompt)


async def get_answer_acknowledgment(question: str, answer: str) -> str:
    """Get a brief AI acknowledgment of the candidate's answer."""
    prompt = ANSWER_ACKNOWLEDGMENT_PROMPT.format(question=question, answer=answer)
    try:
        return await _call_ai_text(prompt)
    except Exception:
        return "Thank you for your answer. Let's move on."
