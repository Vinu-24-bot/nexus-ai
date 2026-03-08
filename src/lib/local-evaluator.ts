/**
 * BATS Local Evaluation Engine
 * Provides intelligent offline evaluation when backend is unavailable.
 * Uses keyword analysis, pattern matching, and heuristic scoring.
 */

interface LocalEvalInput {
  candidate_name: string;
  position: string;
  job_description: string;
  resume: string;
  transcript: string;
  video_filename?: string;
}

interface LocalEvalResult {
  id: string;
  candidateName: string;
  position: string;
  date: string;
  candidate_overview: string;
  scores: {
    technical_proficiency: number;
    relevance_to_jd: number;
    communication: number;
    confidence_level: number;
    overall_score: number;
  };
  sentiment: { rating: "Positive" | "Neutral" | "Negative"; explanation: string };
  candidate_status: { level: string; description: string };
  selection_status: "pending" | "selected" | "rejected";
  strengths: string[];
  red_flags_or_weaknesses: string[];
  dynamic_follow_up_questions: string[];
  hiring_recommendation: "Strong Hire" | "Lean Hire" | "Reject";
  justification: string;
  video_filename?: string;
}

function generateId(name: string, position: string): string {
  const first = name.split(" ")[0]?.replace(/[^a-zA-Z]/g, "") || "Unknown";
  const role = position.replace(/\s+/g, "").replace(/[^a-zA-Z]/g, "").slice(0, 20);
  const hash = Math.random().toString(36).slice(2, 8);
  return `BATS-${first}_${role}-${hash}`;
}

function extractKeywords(text: string): string[] {
  const techKeywords = [
    // Frontend
    "react", "angular", "vue", "svelte", "next.js", "nuxt", "remix", "gatsby",
    "html", "css", "sass", "less", "tailwind", "bootstrap", "material ui", "chakra",
    "webpack", "vite", "rollup", "babel", "esbuild", "parcel",
    "redux", "zustand", "mobx", "recoil", "context api", "state management",
    "responsive design", "accessibility", "a11y", "seo", "pwa",
    // Languages
    "javascript", "typescript", "python", "java", "c++", "c#", "go", "golang",
    "rust", "ruby", "php", "swift", "kotlin", "scala", "r lang", "dart", "flutter",
    // Backend
    "node", "express", "fastapi", "django", "flask", "spring", "spring boot",
    ".net", "asp.net", "rails", "laravel", "gin", "fiber", "nest.js", "hapi",
    // Database
    "sql", "nosql", "mongodb", "postgresql", "mysql", "redis", "cassandra",
    "dynamodb", "firebase", "supabase", "sqlite", "mariadb", "couchdb", "neo4j",
    "orm", "prisma", "sequelize", "hibernate", "sqlalchemy", "typeorm",
    // Cloud & DevOps
    "aws", "gcp", "azure", "docker", "kubernetes", "k8s", "terraform", "ansible",
    "jenkins", "github actions", "gitlab ci", "ci/cd", "circleci",
    "lambda", "serverless", "cloudformation", "pulumi", "helm", "istio",
    "nginx", "apache", "load balancer", "cdn", "cloudflare",
    // Data & ML/AI
    "machine learning", "deep learning", "tensorflow", "pytorch", "scikit-learn",
    "nlp", "computer vision", "ai", "neural network", "transformer", "bert", "gpt",
    "pandas", "numpy", "spark", "hadoop", "airflow", "dbt", "etl", "data pipeline",
    "power bi", "tableau", "looker", "data warehouse", "snowflake", "bigquery",
    // Architecture & Patterns
    "microservices", "monolith", "event driven", "cqrs", "saga pattern",
    "rest", "graphql", "grpc", "websocket", "api", "api gateway",
    "design patterns", "solid", "clean architecture", "domain driven",
    "data structures", "algorithms", "system design", "architecture",
    "distributed systems", "scalability", "high availability", "fault tolerance",
    // DevOps & Tools
    "git", "linux", "unix", "bash", "shell", "powershell",
    "monitoring", "prometheus", "grafana", "elk", "datadog", "new relic",
    "kafka", "rabbitmq", "celery", "sqs", "pub/sub", "message queue",
    "elasticsearch", "opensearch", "solr",
    // Security
    "security", "oauth", "jwt", "authentication", "authorization", "rbac",
    "encryption", "ssl", "tls", "owasp", "penetration testing", "sso", "saml",
    // Testing
    "tdd", "bdd", "testing", "jest", "cypress", "selenium", "playwright",
    "unit test", "integration test", "e2e", "pytest", "junit", "mocha",
    // Agile & Management
    "agile", "scrum", "kanban", "jira", "confluence", "sprint", "backlog",
    "project management", "team lead", "tech lead", "mentoring",
    // Mobile
    "react native", "ios", "android", "mobile development", "xamarin", "ionic",
    // Other
    "figma", "ui/ux", "wireframe", "prototype", "storybook",
    "performance", "optimization", "caching", "lazy loading",
    "blockchain", "web3", "smart contract", "solidity",
  ];
  const lower = text.toLowerCase();
  return [...new Set(techKeywords.filter((kw) => lower.includes(kw)))];
}

function computeOverlap(jdKeywords: string[], resumeKeywords: string[]): number {
  if (jdKeywords.length === 0) return 50;
  const overlap = jdKeywords.filter((kw) => resumeKeywords.includes(kw));
  return Math.min(100, Math.round((overlap.length / jdKeywords.length) * 100));
}

function analyzeTranscriptQuality(transcript: string): {
  wordCount: number;
  avgSentenceLength: number;
  specificity: number;
  confidence: number;
  depth: number;
  structureScore: number;
} {
  const words = transcript.split(/\s+/).filter(Boolean);
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;

  // Specificity: presence of numbers, project names, metrics, action verbs
  const specificIndicators = [
    { pattern: /\d+%/g, weight: 8 },
    { pattern: /\d+ years/gi, weight: 6 },
    { pattern: /\d+ months/gi, weight: 5 },
    { pattern: /\d+ team|\d+ members|\d+ people/gi, weight: 7 },
    { pattern: /\$[\d,]+|\d+k|\d+M/gi, weight: 10 },
    { pattern: /built|implemented|designed|architected|led|managed|created|developed|deployed|launched|shipped/gi, weight: 6 },
    { pattern: /reduced|increased|improved|optimized|scaled|automated|streamlined|refactored/gi, weight: 7 },
    { pattern: /for example|specifically|in particular|such as|for instance|to illustrate/gi, weight: 5 },
    { pattern: /production|staging|ci\/cd|pipeline|deployment|monitoring/gi, weight: 6 },
    { pattern: /million|thousand|hundred|billion|users|requests|transactions/gi, weight: 8 },
  ];
  let specificityScore = 0;
  for (const { pattern, weight } of specificIndicators) {
    const matches = transcript.match(pattern);
    if (matches) specificityScore += matches.length * weight;
  }
  specificityScore = Math.min(100, Math.max(10, specificityScore));

  // Confidence indicators (expanded)
  const confidentPhrases = /I believe|I'm confident|definitely|absolutely|clearly|I led|I built|I designed|my approach|I'm proud|successfully|I took the initiative|I was responsible|I drove|I spearheaded/gi;
  const uncertainPhrases = /I think maybe|I'm not sure|I guess|probably|might|kind of|sort of|I don't know|not really|I haven't|never tried/gi;
  const confidentMatches = (transcript.match(confidentPhrases) || []).length;
  const uncertainMatches = (transcript.match(uncertainPhrases) || []).length;
  const confidence = Math.min(100, Math.max(10, 50 + confidentMatches * 7 - uncertainMatches * 12));

  // Depth: how deeply they explain things (STAR method indicators, cause-effect, technical detail)
  const depthIndicators = [
    { pattern: /because|therefore|as a result|which led to|consequently|this meant/gi, weight: 6 },
    { pattern: /the challenge was|the problem was|we needed to|the requirement was/gi, weight: 7 },
    { pattern: /my approach was|I decided to|the solution was|we chose to/gi, weight: 7 },
    { pattern: /the outcome was|the result was|this resulted in|we achieved/gi, weight: 8 },
    { pattern: /trade-?off|pros and cons|compared to|alternatively|on the other hand/gi, weight: 8 },
    { pattern: /under the hood|internally|at a lower level|the way it works/gi, weight: 9 },
  ];
  let depthScore = 0;
  for (const { pattern, weight } of depthIndicators) {
    const matches = transcript.match(pattern);
    if (matches) depthScore += matches.length * weight;
  }
  const depth = Math.min(100, Math.max(10, depthScore));

  // Structure: does the answer follow a logical format?
  const hasIntro = /^(so|well|sure|yes|thank|great|absolutely)/i.test(transcript.trim());
  const hasConclusion = /(overall|in summary|to summarize|that's why|so that's)/i.test(transcript);
  const hasBulletPoints = (transcript.match(/first|second|third|finally|additionally|moreover|also/gi) || []).length;
  const structureScore = Math.min(100, Math.max(10, 
    (hasIntro ? 20 : 0) + (hasConclusion ? 25 : 0) + hasBulletPoints * 10 + Math.min(25, sentences.length * 3)
  ));

  return { wordCount: words.length, avgSentenceLength, specificity: specificityScore, confidence, depth, structureScore };
}

export function evaluateLocally(input: LocalEvalInput): LocalEvalResult {
  const jdKeywords = extractKeywords(input.job_description);
  const resumeKeywords = extractKeywords(input.resume);
  const transcriptKeywords = extractKeywords(input.transcript);
  const transcriptAnalysis = analyzeTranscriptQuality(input.transcript);

  // Score calculations - more nuanced and accurate
  const relevanceScore = computeOverlap(jdKeywords, resumeKeywords);
  const transcriptRelevance = computeOverlap(jdKeywords, transcriptKeywords);
  const combinedRelevance = Math.round(relevanceScore * 0.5 + transcriptRelevance * 0.5);

  const technicalFromResume = Math.min(100, resumeKeywords.length * 4 + 15);
  const technicalFromTranscript = Math.min(100, transcriptKeywords.length * 5 + 10);
  const technicalDepthBonus = Math.min(20, transcriptAnalysis.depth * 0.2);
  const technicalScore = Math.round(
    technicalFromResume * 0.3 + technicalFromTranscript * 0.25 + 
    transcriptAnalysis.specificity * 0.25 + technicalDepthBonus + 
    transcriptAnalysis.depth * 0.2
  );

  // Communication: word count, structure, clarity, specificity
  const wordCountScore = Math.min(100, Math.max(10, transcriptAnalysis.wordCount / 4));
  const sentenceLengthScore = Math.max(10, 100 - Math.abs(transcriptAnalysis.avgSentenceLength - 18) * 4);
  const communicationScore = Math.round(
    wordCountScore * 0.2 + transcriptAnalysis.specificity * 0.25 + 
    sentenceLengthScore * 0.2 + transcriptAnalysis.structureScore * 0.35
  );

  const confidenceScore = transcriptAnalysis.confidence;

  const overallScore = Math.round(
    Math.max(10, Math.min(100, technicalScore)) * 0.30 + 
    Math.max(10, Math.min(100, combinedRelevance)) * 0.25 + 
    Math.max(10, Math.min(100, communicationScore)) * 0.25 + 
    Math.max(10, Math.min(100, confidenceScore)) * 0.20
  );

  // Generate insights
  const matchedSkills = jdKeywords.filter((kw) => resumeKeywords.includes(kw));
  const missingSkills = jdKeywords.filter((kw) => !resumeKeywords.includes(kw));
  const extraSkills = resumeKeywords.filter((kw) => !jdKeywords.includes(kw));

  const strengths: string[] = [];
  if (matchedSkills.length > 5) strengths.push(`Excellent JD alignment — proficient in ${matchedSkills.slice(0, 6).join(", ")}`);
  else if (matchedSkills.length > 2) strengths.push(`Good JD alignment with experience in ${matchedSkills.slice(0, 4).join(", ")}`);
  if (transcriptAnalysis.depth > 50) strengths.push("Demonstrates deep technical understanding with detailed explanations and reasoning");
  if (transcriptAnalysis.specificity > 50) strengths.push("Provides concrete examples with quantifiable metrics and real-world results");
  if (transcriptAnalysis.confidence > 65) strengths.push("Projects strong confidence and decisiveness in responses");
  if (transcriptAnalysis.structureScore > 60) strengths.push("Answers are well-structured and logically organized");
  if (extraSkills.length > 3) strengths.push(`Brings additional valuable skills beyond JD: ${extraSkills.slice(0, 5).join(", ")}`);
  if (transcriptAnalysis.wordCount > 300) strengths.push("Provides thorough, comprehensive responses showing genuine engagement");
  if (strengths.length === 0) strengths.push("Completed the interview process", "Demonstrates willingness to engage");

  const weaknesses: string[] = [];
  if (missingSkills.length > 5) weaknesses.push(`Multiple critical JD skills not demonstrated: ${missingSkills.slice(0, 5).join(", ")}`);
  else if (missingSkills.length > 2) weaknesses.push(`Some JD requirements not evidenced: ${missingSkills.slice(0, 3).join(", ")}`);
  if (transcriptAnalysis.wordCount < 80) weaknesses.push("Responses were notably brief — suggests limited depth, disengagement, or nervousness");
  else if (transcriptAnalysis.wordCount < 150) weaknesses.push("Answers could benefit from more detail and concrete examples");
  if (transcriptAnalysis.confidence < 35) weaknesses.push("Displayed significant uncertainty — multiple hedging phrases detected");
  else if (transcriptAnalysis.confidence < 50) weaknesses.push("Could project more confidence and conviction in technical responses");
  if (transcriptAnalysis.depth < 30) weaknesses.push("Answers remained surface-level without explaining reasoning or trade-offs");
  if (transcriptAnalysis.structureScore < 30) weaknesses.push("Responses lack clear structure — would benefit from using frameworks like STAR");
  if (combinedRelevance < 35) weaknesses.push("Significant gap between candidate experience and job requirements");
  if (weaknesses.length === 0) weaknesses.push("Could provide more project-specific examples to strengthen responses");

  const followUpQs: string[] = [];
  if (missingSkills.length > 0) followUpQs.push(`Can you describe your hands-on experience with ${missingSkills.slice(0, 2).join(" and ")}? How have you applied ${missingSkills[0] || "these skills"} in a production setting?`);
  if (matchedSkills.length > 0) followUpQs.push(`Walk me through a specific project where you used ${matchedSkills[0]} — what were the key technical challenges and how did you solve them?`);
  followUpQs.push(`If you were to design the architecture for a ${input.position}-related system from scratch, what technology choices would you make and why?`);
  if (transcriptAnalysis.depth < 50) followUpQs.push(`Can you give a concrete example of a time you had to debug a complex production issue? Walk me through your process step by step.`);

  const recommendation: "Strong Hire" | "Lean Hire" | "Reject" =
    overallScore >= 72 ? "Strong Hire" : overallScore >= 45 ? "Lean Hire" : "Reject";

  const sentimentRating: "Positive" | "Neutral" | "Negative" =
    confidenceScore >= 60 ? "Positive" : confidenceScore >= 38 ? "Neutral" : "Negative";

  const statusLevel =
    overallScore >= 72 ? "Strong Confidence" : overallScore >= 45 ? "Moderate Confidence" : overallScore >= 30 ? "Low Confidence" : "Needs Improvement";

  return {
    id: generateId(input.candidate_name, input.position),
    candidateName: input.candidate_name,
    position: input.position,
    date: new Date().toISOString().slice(0, 10),
    candidate_overview: `${input.candidate_name} was evaluated for the ${input.position} role. ${
      matchedSkills.length > 3
        ? `Strong alignment detected with ${matchedSkills.length} matching skills including ${matchedSkills.slice(0, 3).join(", ")}.`
        : matchedSkills.length > 0
        ? `Partial alignment with some relevant experience in ${matchedSkills.join(", ")}.`
        : "Limited direct skill overlap with the job requirements was identified."
    } ${
      transcriptAnalysis.depth > 50
        ? "Interview responses demonstrated genuine depth and technical reasoning."
        : transcriptAnalysis.wordCount > 150
        ? "Responses were adequate but could benefit from deeper technical explanations."
        : "Interview responses were relatively brief with limited technical depth."
    } ${
      overallScore >= 72
        ? "Overall performance strongly indicates readiness for this position."
        : overallScore >= 45
        ? "Performance shows potential with identifiable areas for growth."
        : "Significant gaps were identified that would require substantial development."
    }`,
    scores: {
      technical_proficiency: Math.max(10, Math.min(100, technicalScore)),
      relevance_to_jd: Math.max(10, Math.min(100, combinedRelevance)),
      communication: Math.max(10, Math.min(100, communicationScore)),
      confidence_level: Math.max(10, Math.min(100, confidenceScore)),
      overall_score: Math.max(10, Math.min(100, overallScore)),
    },
    sentiment: {
      rating: sentimentRating,
      explanation: sentimentRating === "Positive"
        ? `${input.candidate_name} demonstrated enthusiasm and confidence throughout the interview, using assertive language and showing genuine passion for the role.`
        : sentimentRating === "Neutral"
        ? `${input.candidate_name} maintained a measured and professional tone. While responses were adequate, they could show more enthusiasm and conviction.`
        : `${input.candidate_name} appeared uncertain in several areas with multiple hedging phrases detected, which may indicate nervousness or knowledge gaps.`,
    },
    candidate_status: {
      level: statusLevel,
      description: statusLevel === "Strong Confidence"
        ? `The candidate demonstrates strong alignment with the ${input.position} role, with depth of knowledge and confident delivery.`
        : statusLevel === "Moderate Confidence"
        ? `The candidate has a solid foundation but needs to demonstrate deeper expertise in key areas required for ${input.position}.`
        : statusLevel === "Low Confidence"
        ? `The candidate shows some relevant background but significant gaps need to be addressed before they're ready for this role.`
        : `The candidate would benefit from substantial preparation and skill development before being considered for ${input.position}.`,
    },
    selection_status: "pending",
    strengths,
    red_flags_or_weaknesses: weaknesses,
    dynamic_follow_up_questions: followUpQs,
    hiring_recommendation: recommendation,
    justification: `Comprehensive evaluation of ${input.candidate_name} for the ${input.position} role:\n\n` +
      `SCORES: Overall ${overallScore}/100 | Technical ${technicalScore}/100 | JD Relevance ${combinedRelevance}/100 | Communication ${communicationScore}/100 | Confidence ${confidenceScore}/100\n\n` +
      `SKILL ANALYSIS: ${matchedSkills.length} skills matched with JD (${matchedSkills.slice(0, 5).join(", ")}). ${missingSkills.length} JD requirements not evidenced${missingSkills.length > 0 ? ` (${missingSkills.slice(0, 3).join(", ")})` : ""}. ${extraSkills.length} additional skills identified from resume.\n\n` +
      `INTERVIEW QUALITY: ${transcriptAnalysis.wordCount} words across responses. Specificity score: ${transcriptAnalysis.specificity}/100. Depth score: ${transcriptAnalysis.depth}/100. Structure score: ${transcriptAnalysis.structureScore}/100.\n\n` +
      `${
        recommendation === "Strong Hire"
          ? "RECOMMENDATION: Strong Hire — The candidate demonstrates strong capabilities across all evaluation dimensions. They show both breadth and depth of knowledge relevant to this role. Recommended for advancement to the next stage."
          : recommendation === "Lean Hire"
          ? "RECOMMENDATION: Lean Hire — The candidate shows promise but has identifiable gaps. Consider a focused follow-up interview covering the weak areas. A conditional offer may be appropriate with a development plan."
          : "RECOMMENDATION: Reject — The candidate does not currently meet the core requirements for this role. Significant skill and experience gaps were identified that would require extensive training investment."
      }` +
      `\n\nNote: This evaluation was performed using the BATS local analysis engine (keyword matching, NLP heuristics, pattern analysis). For AI-powered deep semantic analysis with LLM reasoning, ensure the backend server is running with an API key configured.`,
    video_filename: input.video_filename,
  };
}

// Local storage for evaluations when backend is offline
const LOCAL_STORAGE_KEY = "bats_local_evaluations";

export function saveLocalEvaluation(result: LocalEvalResult): void {
  const existing = getLocalEvaluations();
  existing.unshift(result);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
}

export function getLocalEvaluations(): LocalEvalResult[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getLocalEvaluation(id: string): LocalEvalResult | null {
  const evals = getLocalEvaluations();
  return evals.find((e) => e.id === id) || null;
}

export function deleteLocalEvaluation(id: string): void {
  const evals = getLocalEvaluations().filter((e) => e.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(evals));
}

export function updateLocalEvaluationStatus(id: string, status: "pending" | "selected" | "rejected"): LocalEvalResult | null {
  const evals = getLocalEvaluations();
  const idx = evals.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  evals[idx].selection_status = status;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(evals));
  return evals[idx];
}
