import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Brain, FileText, Briefcase, User, Loader2, Mic, Volume2, Sparkles, Clock, Upload, X, CheckCircle2,
  Wifi, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { generateQuestions, generateJD, uploadResume, checkBackendHealth } from "@/lib/api";
import { extractTextFromFile } from "@/lib/resume-parser";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const DURATION_OPTIONS = [
  { label: "10 min", value: 10, questions: 6 },
  { label: "15 min", value: 15, questions: 8 },
  { label: "20 min", value: 20, questions: 12 },
  { label: "25 min", value: 25, questions: 15 },
];

const JD_TEMPLATES: Record<string, string> = {
  "react developer": `Job Title: React Developer\n\nJob Summary:\nWe are looking for a skilled React Developer to build and maintain high-performance web applications using React.js and modern JavaScript ecosystem.\n\nKey Responsibilities:\n- Build responsive, reusable UI components using React.js\n- Implement state management solutions (Redux, Context API, Zustand)\n- Write clean, maintainable, and well-tested code with Jest/RTL\n- Collaborate with backend engineers on RESTful APIs and GraphQL\n- Optimize applications for maximum speed and scalability\n- Participate in code reviews and mentor junior developers\n- Translate UI/UX designs into high-quality code\n\nRequired Skills & Qualifications:\n- 2+ years of hands-on React.js development experience\n- Strong proficiency in JavaScript/TypeScript, HTML5, CSS3\n- Deep understanding of React hooks, component lifecycle, virtual DOM\n- Experience with build tools (Webpack, Vite, Babel)\n- Familiarity with RESTful APIs and async programming\n- Git version control proficiency\n- Understanding of responsive design and cross-browser compatibility\n\nPreferred Skills:\n- Next.js or Remix framework experience\n- Testing experience (Jest, React Testing Library, Cypress)\n- CI/CD pipeline experience\n- Tailwind CSS or CSS-in-JS solutions\n\nExperience Level: Mid-Level (2-4 years)`,
  "full stack developer": `Job Title: Full Stack Developer\n\nJob Summary:\nSeeking a versatile Full Stack Developer proficient in both frontend and backend technologies to build end-to-end web applications.\n\nKey Responsibilities:\n- Design and develop full-stack web applications\n- Build scalable RESTful APIs and microservices\n- Develop responsive frontend interfaces with modern frameworks\n- Manage relational and NoSQL databases\n- Deploy and maintain cloud infrastructure\n- Write unit/integration tests\n- Ensure application security and performance\n\nRequired Skills:\n- 3+ years full-stack development experience\n- Frontend: React/Vue/Angular, HTML5, CSS3, JavaScript/TypeScript\n- Backend: Node.js/Python/Java with Express/FastAPI/Spring\n- Database: PostgreSQL, MongoDB, Redis\n- RESTful API design and implementation\n- Git, Docker basics, Linux command line\n\nPreferred Skills:\n- Cloud platforms (AWS/GCP/Azure)\n- Kubernetes, CI/CD pipelines\n- GraphQL\n- System design fundamentals\n\nExperience Level: Mid to Senior (3-6 years)`,
  "python developer": `Job Title: Python Developer\n\nJob Summary:\nWe are looking for an experienced Python Developer to build scalable backend services and data processing systems.\n\nKey Responsibilities:\n- Design and implement Python-based backend services\n- Build RESTful APIs using Django/FastAPI/Flask\n- Write efficient data processing scripts and ETL pipelines\n- Implement unit testing and integration testing\n- Optimize code for performance and scalability\n- Collaborate with frontend and data teams\n\nRequired Skills:\n- 2+ years Python development experience\n- Proficiency in Django, FastAPI, or Flask\n- Strong understanding of OOP and design patterns\n- Database experience (PostgreSQL, MySQL, MongoDB)\n- Git version control\n- Linux/Unix environment\n\nPreferred Skills:\n- Data processing (Pandas, NumPy)\n- Celery/async task processing\n- Docker, CI/CD\n- AWS/GCP cloud services\n\nExperience Level: Mid-Level (2-4 years)`,
  "data scientist": `Job Title: Data Scientist\n\nJob Summary:\nLooking for a Data Scientist to derive actionable insights from complex datasets and build predictive models.\n\nKey Responsibilities:\n- Analyze large datasets to identify patterns, trends, and insights\n- Build, train, and deploy machine learning models\n- Create data visualizations and dashboards\n- Design and analyze A/B tests\n- Collaborate with product and engineering teams\n- Present findings to stakeholders\n\nRequired Skills:\n- Python (NumPy, Pandas, Scikit-learn)\n- SQL and database management\n- Statistical analysis and hypothesis testing\n- Machine learning algorithms (supervised, unsupervised)\n- Data visualization (Matplotlib, Seaborn, Tableau/PowerBI)\n- Feature engineering and model evaluation\n\nPreferred Skills:\n- Deep learning (TensorFlow/PyTorch)\n- Big data tools (Spark, Hadoop)\n- Cloud ML services (SageMaker, Vertex AI)\n- NLP or Computer Vision experience\n\nExperience Level: Mid to Senior (2-5 years)`,
  "devops engineer": `Job Title: DevOps Engineer\n\nJob Summary:\nSeeking a DevOps Engineer to design, implement, and maintain CI/CD pipelines and cloud infrastructure.\n\nKey Responsibilities:\n- Design and maintain CI/CD pipelines\n- Manage cloud infrastructure (AWS/GCP/Azure)\n- Implement containerization with Docker and orchestration with Kubernetes\n- Monitor system performance, reliability, and security\n- Automate infrastructure provisioning with IaC tools\n- Implement logging, monitoring, and alerting\n\nRequired Skills:\n- Linux system administration\n- Docker and Kubernetes\n- CI/CD tools (Jenkins, GitHub Actions, GitLab CI)\n- Cloud platforms (AWS/GCP/Azure)\n- Infrastructure as Code (Terraform/Pulumi/CloudFormation)\n- Scripting (Bash, Python)\n\nPreferred Skills:\n- Service mesh (Istio, Linkerd)\n- Monitoring stack (Prometheus, Grafana, ELK)\n- Security scanning and compliance\n- Cost optimization\n\nExperience Level: Mid to Senior (3-5 years)`,
  "java developer": `Job Title: Java Developer\n\nJob Summary:\nWe are seeking an experienced Java Developer to design and build enterprise-grade applications.\n\nKey Responsibilities:\n- Develop scalable Java applications using Spring Boot\n- Design and implement RESTful APIs and microservices\n- Write unit and integration tests\n- Optimize application performance\n- Participate in code reviews and architectural discussions\n\nRequired Skills:\n- 3+ years Java development (Java 11+)\n- Spring Boot, Spring MVC, Spring Data\n- Hibernate/JPA ORM\n- RESTful API design\n- SQL databases (PostgreSQL, MySQL)\n- Maven/Gradle build tools\n- Git version control\n\nPreferred Skills:\n- Microservices architecture\n- Kafka/RabbitMQ\n- Docker, Kubernetes\n- Cloud platforms\n\nExperience Level: Mid to Senior (3-6 years)`,
  "machine learning engineer": `Job Title: Machine Learning Engineer\n\nJob Summary:\nLooking for an ML Engineer to design, build, and deploy production machine learning systems.\n\nKey Responsibilities:\n- Design and implement ML pipelines end-to-end\n- Train, evaluate, and deploy ML models at scale\n- Build feature engineering pipelines\n- Monitor model performance and implement retraining strategies\n- Optimize model inference latency and throughput\n\nRequired Skills:\n- Python, TensorFlow/PyTorch\n- ML algorithms and deep learning\n- MLOps tools (MLflow, Kubeflow, Airflow)\n- Docker, Kubernetes\n- SQL and NoSQL databases\n- Cloud ML platforms\n\nPreferred Skills:\n- Distributed training\n- Model optimization (quantization, pruning)\n- Real-time inference systems\n- NLP/CV specialization\n\nExperience Level: Mid to Senior (3-5 years)`,
};

function generateLocalJD(position: string): string {
  return `Job Title: ${position}\n\nJob Summary:\nWe are looking for an experienced ${position} to join our growing team. The ideal candidate will have strong technical skills, excellent problem-solving abilities, and a proven track record of delivering high-quality work.\n\nKey Responsibilities:\n- Design, develop, and maintain solutions relevant to the ${position} role\n- Collaborate with cross-functional teams to define and implement features\n- Write clean, maintainable, and well-documented code/deliverables\n- Participate in reviews and provide constructive feedback\n- Troubleshoot and resolve complex issues\n- Stay current with industry trends and best practices\n- Mentor and guide junior team members\n\nRequired Skills & Qualifications:\n- 2+ years of relevant experience in the ${position} domain\n- Strong problem-solving and analytical skills\n- Excellent written and verbal communication\n- Proficiency in industry-standard tools and technologies\n- Bachelor's degree in a related field or equivalent experience\n- Ability to work independently and in a team\n\nPreferred Skills:\n- Experience with agile/scrum methodologies\n- Leadership or mentoring experience\n- Relevant industry certifications\n- Open source or community contributions\n\nExperience Level: Mid to Senior (2-5+ years)`;
}

function generateLocalQuestions(jd: string, resumeText: string, numQuestions: number) {
  const categories = ["technical", "behavioral", "situational"];
  const difficulties = ["easy", "easy", "medium", "medium", "hard", "hard"];
  const technicalQs = [
    "Can you walk me through a recent project you've worked on and the technical decisions you made?",
    "How do you approach debugging a complex issue in production?",
    "Explain a design pattern you've used recently and why it was appropriate.",
    "What's your experience with version control workflows in a team setting?",
    "How do you ensure code quality and maintainability in your projects?",
    "Describe your approach to writing testable code.",
    "What tools and technologies are you most proficient with?",
    "How do you stay updated with the latest trends in your field?",
    "Explain a time you had to optimize performance in an application.",
    "What's the most technically challenging problem you've solved?",
    "How do you approach system design for scalable applications?",
    "Describe your experience with CI/CD pipelines.",
    "What security best practices do you follow in development?",
    "How do you handle technical debt in a project?",
    "Explain your approach to API design and documentation.",
  ];
  const behavioralQs = [
    "Tell me about a time you disagreed with a teammate. How did you resolve it?",
    "Describe a situation where you had to learn something quickly under pressure.",
    "How do you handle receiving critical feedback on your work?",
    "Tell me about a time you went above and beyond for a project.",
    "How do you prioritize tasks when you have multiple deadlines?",
    "Describe a situation where you had to mentor or help a colleague.",
    "Tell me about a failure you experienced and what you learned from it.",
    "How do you handle ambiguity in project requirements?",
  ];
  const situationalQs = [
    "If you joined our team and found the codebase poorly documented, what would you do?",
    "How would you handle a situation where a critical feature deadline conflicts with code quality?",
    "If a stakeholder requested a feature that you believe is technically flawed, how would you handle it?",
    "Imagine you're leading a project and a key team member leaves mid-sprint. What's your plan?",
    "How would you approach migrating a legacy system to modern technologies?",
  ];
  const allQs = { technical: technicalQs, behavioral: behavioralQs, situational: situationalQs };
  const questions = [];
  for (let i = 0; i < numQuestions; i++) {
    const cat = categories[i % categories.length];
    const diff = difficulties[Math.min(i, difficulties.length - 1)];
    const pool = allQs[cat as keyof typeof allQs];
    questions.push({
      id: i + 1,
      question: pool[i % pool.length],
      category: cat,
      difficulty: diff,
    });
  }
  return questions;
}

export default function EvaluatePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingJD, setIsGeneratingJD] = useState(false);
  const [isExtractingResume, setIsExtractingResume] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [position, setPosition] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resume, setResume] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [selectedDuration, setSelectedDuration] = useState(DURATION_OPTIONS[2]);
  const [backendStatus, setBackendStatus] = useState<boolean | null>(null);

  useState(() => {
    checkBackendHealth().then(setBackendStatus);
  });

  const handleGenerateJD = async () => {
    if (!position) { toast.error("Enter the position title first"); return; }
    setIsGeneratingJD(true);

    const posLower = position.toLowerCase().trim();
    const templateKey = Object.keys(JD_TEMPLATES).find(
      (k) => posLower.includes(k) || k.includes(posLower)
    );
    if (templateKey) {
      setJobDescription(JD_TEMPLATES[templateKey]);
      toast.success(`JD generated for "${position}"!`);
      setIsGeneratingJD(false);
      return;
    }

    try {
      const jd = await generateJD(position);
      setJobDescription(jd);
      toast.success("JD generated by AI!");
    } catch {
      const localJD = generateLocalJD(position);
      setJobDescription(localJD);
      toast.success("JD generated locally (backend unavailable — using template)");
    } finally {
      setIsGeneratingJD(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [".pdf", ".txt", ".doc", ".docx", ".md"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedTypes.includes(ext)) {
      toast.error(`Unsupported file type. Allowed: ${allowedTypes.join(", ")}`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Max 10MB.");
      return;
    }

    setIsExtractingResume(true);
    try {
      const text = await extractTextFromFile(file);
      if (text.trim()) {
        setResume(text);
        setResumeFileName(file.name);
        toast.success(`Resume "${file.name}" text extracted successfully!`);
      } else if (ext === ".doc" || ext === ".docx") {
        toast.error("DOC/DOCX requires the backend for extraction. Please paste content manually or convert to PDF.");
      } else {
        toast.error("Could not extract text. Please paste content manually.");
      }

      uploadResume(file).then(() => {
        console.log(`Resume "${file.name}" saved to backend/uploads/resumes`);
      }).catch(() => {
        console.log("Backend resume save skipped (backend may be offline)");
      });
    } catch {
      toast.error("Failed to parse resume. Please paste content manually.");
    } finally {
      setIsExtractingResume(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearUploadedResume = () => {
    setResumeFileName("");
    setResume("");
  };

  const handleStartInterview = async () => {
    if (!candidateName || !position || !jobDescription || !resume) return;
    setIsGenerating(true);
    try {
      const questions = await generateQuestions(jobDescription, resume, selectedDuration.questions);
      toast.success(`${questions.length} AI questions generated for ~${selectedDuration.value} min interview!`);
      navigate("/interview", {
        state: { candidateName, position, jobDescription, resume, questions, voiceGender, durationMinutes: selectedDuration.value },
      });
    } catch {
      const localQuestions = generateLocalQuestions(jobDescription, resume, selectedDuration.questions);
      toast.success(`${localQuestions.length} questions generated locally for ~${selectedDuration.value} min interview!`);
      navigate("/interview", {
        state: { candidateName, position, jobDescription, resume, questions: localQuestions, voiceGender, durationMinutes: selectedDuration.value },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const isValid = candidateName && position && jobDescription && resume;

  return (
    <div className="min-h-screen bg-background nexus-grid">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          {/* Header */}
          <motion.div variants={fadeUp} custom={0} className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
              <Brain className="w-3.5 h-3.5" />
              BATS ForgePro-Powered Interview
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
              Start AI Interview
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Enter candidate info, JD, and resume. BATS ForgePro will conduct a full {selectedDuration.value}-minute interview
              with {selectedDuration.questions} questions (easy → hard), record everything, and provide detailed evaluation.
            </p>
          </motion.div>

          {/* Backend Status */}
          <motion.div variants={fadeUp} custom={0.3}>
            {backendStatus === false && (
              <div className="rounded-xl p-3 bg-destructive/10 border border-destructive/20 flex items-center gap-3">
                <WifiOff className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">
                  <strong>Backend offline</strong> — Interview will use local questions & local evaluation. Start backend for AI-powered experience.
                </p>
              </div>
            )}
            {backendStatus === true && (
              <div className="rounded-xl p-3 bg-primary/5 border border-primary/20 flex items-center gap-3">
                <Wifi className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs text-primary">
                  <strong>Backend connected</strong> — AI question generation & evaluation active.
                </p>
              </div>
            )}
          </motion.div>

          {/* How it works */}
          <motion.div variants={fadeUp} custom={0.5} className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">How It Works</h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {[
                { step: "1", title: "Fill Details", desc: "Name, position & resume" },
                { step: "2", title: "AI Creates JD", desc: "Auto-generate or paste JD" },
                { step: "3", title: "AI Interviews", desc: `${selectedDuration.questions} Qs: easy → hard` },
                { step: "4", title: "Records All", desc: "Video + live transcript" },
                { step: "5", title: "ForgePro Evaluates", desc: "Scores, sentiment & verdict" },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{s.step}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Form */}
          <div className="space-y-6">
            {/* Candidate Name & Position */}
            <motion.div variants={fadeUp} custom={1} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <User className="w-4 h-4 text-primary" /> Candidate Name *
                </label>
                <Input
                  placeholder="e.g., Alex Chen"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Briefcase className="w-4 h-4 text-accent" /> Position / Role *
                </label>
                <Input
                  placeholder="e.g., React Developer, Data Scientist"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="bg-card border-border"
                />
              </div>
            </motion.div>

            {/* JD */}
            <motion.div variants={fadeUp} custom={2} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileText className="w-4 h-4 text-primary" /> Job Description *
                </label>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={handleGenerateJD}
                  disabled={isGeneratingJD || !position}
                  className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
                >
                  {isGeneratingJD ? (
                    <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Generating...</span>
                  ) : (
                    <span className="flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Auto-Generate JD</span>
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Paste the job description here, or click 'Auto-Generate JD' above..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="bg-card border-border min-h-[140px] resize-none"
              />
            </motion.div>

            {/* Resume */}
            <motion.div variants={fadeUp} custom={3} className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileText className="w-4 h-4 text-primary" /> Candidate Resume *
                </label>
                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx,.md" onChange={handleResumeUpload} className="hidden" />
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExtractingResume}
                  className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
                >
                  {isExtractingResume ? (
                    <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Extracting...</span>
                  ) : (
                    <span className="flex items-center gap-1.5"><Upload className="w-3 h-3" /> Upload Resume (PDF/TXT/DOCX)</span>
                  )}
                </Button>
              </div>

              {resumeFileName && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs text-primary font-medium truncate">{resumeFileName}</span>
                  <button onClick={clearUploadedResume} className="ml-auto shrink-0">
                    <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              )}
              <Textarea
                placeholder="Paste resume content here, or upload a file above..."
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                className="bg-card border-border min-h-[120px] resize-none"
              />
            </motion.div>

            {/* Interview Duration */}
            <motion.div variants={fadeUp} custom={4} className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="w-4 h-4 text-primary" /> Interview Duration
              </label>
              <div className="flex gap-3">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedDuration(opt)}
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${
                      selectedDuration.value === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="block text-[10px] mt-0.5 opacity-70">{opt.questions} Qs</span>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Voice Selector */}
            <motion.div variants={fadeUp} custom={5} className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Volume2 className="w-4 h-4 text-primary" /> AI Voice
              </label>
              <div className="flex gap-3">
                {(["female", "male"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setVoiceGender(g)}
                    className={`flex-1 py-3 rounded-xl border text-center transition-all ${
                      voiceGender === g
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <Mic className="w-4 h-4 mx-auto mb-1" />
                    <span className="block text-sm font-medium capitalize">{g}</span>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Start Button */}
            <motion.div variants={fadeUp} custom={6}>
              <Button
                onClick={handleStartInterview}
                disabled={!isValid || isGenerating}
                className="w-full h-14 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan disabled:opacity-40"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating questions...
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <Brain className="w-5 h-5" />
                    Start {selectedDuration.value}-Min Interview ({selectedDuration.questions} Questions)
                  </span>
                )}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}