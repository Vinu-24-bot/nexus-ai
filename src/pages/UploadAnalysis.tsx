import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Upload, FileText, Briefcase, User, Loader2, Brain, Sparkles, X,
  CheckCircle2, Video, AlertCircle, Wifi, WifiOff, MessageSquare, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { generateJD, submitEvaluation, uploadVideo, uploadResume, checkBackendHealth } from "@/lib/api";
import { extractTextFromFile } from "@/lib/resume-parser";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

// Clean, standard API resolution
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_URL = `${API_BASE.replace(/\/$/, "")}/api`;

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const RANDOM_ROLES = [
  "Cloud Security Architect",
  "Blockchain Smart Contract Developer",
  "Senior DevOps Engineer",
  "Data Scientist (NLP)",
  "Full Stack React Native Engineer",
  "Cybersecurity Analyst",
  "Product Manager (AI Tools)",
  "Backend Golang Developer",
  "Site Reliability Engineer",
  "Machine Learning Engineer"
];

const JD_TEMPLATES: Record<string, string> = {
  "react developer": `Job Title: React Developer\n\nJob Summary:\nWe are looking for a skilled React Developer to build and maintain high-performance web applications.\n\nKey Responsibilities:\n- Build responsive UI components using React.js and modern JavaScript\n- Implement state management with Redux/Context API/Zustand\n- Write clean, maintainable, and well-tested code\n- Collaborate with backend engineers on RESTful APIs and GraphQL\n- Optimize applications for maximum performance\n- Participate in code reviews and mentor junior developers\n\nRequired Skills:\n- 2+ years of React.js experience\n- Proficiency in JavaScript/TypeScript, HTML5, CSS3\n- Experience with React hooks, Context API, and component lifecycle\n- Familiarity with build tools (Webpack, Vite)\n- Understanding of RESTful APIs\n- Git version control\n\nPreferred Skills:\n- Next.js/Remix experience\n- Testing (Jest, React Testing Library)\n- CI/CD pipelines\n- Tailwind CSS or styled-components`,
  "full stack developer": `Job Title: Full Stack Developer\n\nJob Summary:\nSeeking a versatile Full Stack Developer proficient in both frontend and backend technologies.\n\nKey Responsibilities:\n- Design and develop full-stack web applications\n- Build RESTful APIs and microservices\n- Develop responsive frontend interfaces\n- Manage databases (SQL and NoSQL)\n- Deploy and maintain cloud infrastructure\n- Ensure application security and performance\n\nRequired Skills:\n- 3+ years full-stack development experience\n- Frontend: React/Vue/Angular, HTML5, CSS3, JavaScript/TypeScript\n- Backend: Node.js/Python/Java\n- Database: PostgreSQL, MongoDB\n- RESTful API design\n- Git, Docker basics\n\nPreferred Skills:\n- Cloud platforms (AWS/GCP/Azure)\n- Kubernetes, CI/CD\n- GraphQL\n- System design knowledge`,
  "data scientist": `Job Title: Data Scientist\n\nJob Summary:\nLooking for a Data Scientist to derive insights from complex datasets and build predictive models.\n\nKey Responsibilities:\n- Analyze large datasets to identify patterns and insights\n- Build and deploy machine learning models\n- Create data visualizations and dashboards\n- Collaborate with product teams on data-driven decisions\n- Design A/B tests and analyze results\n\nRequired Skills:\n- Python (NumPy, Pandas, Scikit-learn)\n- SQL and database management\n- Statistical analysis and hypothesis testing\n- Machine learning algorithms\n- Data visualization (Matplotlib, Seaborn, Tableau)\n\nPreferred Skills:\n- Deep learning (TensorFlow/PyTorch)\n- Big data tools (Spark, Hadoop)\n- Cloud ML services\n- NLP or Computer Vision experience`,
  "python developer": `Job Title: Python Developer\n\nJob Summary:\nSeeking an experienced Python Developer to build scalable backend services.\n\nKey Responsibilities:\n- Design and implement Python backend services\n- Build RESTful APIs using Django/FastAPI/Flask\n- Write efficient data processing scripts\n- Implement testing and CI/CD\n- Optimize for performance and scalability\n\nRequired Skills:\n- 2+ years Python development\n- Django, FastAPI, or Flask\n- OOP and design patterns\n- PostgreSQL, MySQL, MongoDB\n- Git, Linux\n\nPreferred Skills:\n- Data processing (Pandas, NumPy)\n- Docker, CI/CD\n- AWS/GCP cloud services`,
  "devops engineer": `Job Title: DevOps Engineer\n\nJob Summary:\nSeeking a DevOps Engineer to build and maintain CI/CD pipelines and cloud infrastructure.\n\nKey Responsibilities:\n- Design and maintain CI/CD pipelines\n- Manage cloud infrastructure (AWS/GCP/Azure)\n- Implement containerization and orchestration\n- Monitor system performance and reliability\n- Automate infrastructure provisioning\n- Ensure security compliance\n\nRequired Skills:\n- Linux administration\n- Docker, Kubernetes\n- CI/CD tools (Jenkins, GitHub Actions, GitLab CI)\n- Cloud platforms (AWS/GCP/Azure)\n- Infrastructure as Code (Terraform/CloudFormation)\n- Scripting (Bash, Python)\n\nPreferred Skills:\n- Service mesh (Istio)\n- Monitoring (Prometheus, Grafana)\n- Security tools and practices\n- Incident management`,
};

function generateLocalJD(position: string): string {
  return `Job Title: ${position}

Job Summary:
We are looking for an experienced ${position} to join our team. The ideal candidate will have strong technical skills and a proven track record.

Key Responsibilities:
- Design, develop, and maintain solutions relevant to the ${position} role
- Collaborate with cross-functional teams
- Write clean, maintainable, and well-documented work
- Participate in reviews and provide constructive feedback
- Troubleshoot and resolve complex issues
- Stay updated with industry trends and best practices
- Mentor junior team members

Required Skills & Qualifications:
- 2+ years of relevant experience in the ${position} domain
- Strong problem-solving and analytical skills
- Excellent communication and teamwork abilities
- Proficiency in industry-standard tools and technologies
- Bachelor's degree in a related field or equivalent experience

Preferred Skills:
- Experience with agile methodologies
- Leadership or mentoring experience
- Industry certifications

Experience Level: Mid to Senior (2-5+ years)`;
}

export default function UploadAnalysisPage() {
  const navigate = useNavigate();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const [candidateName, setCandidateName] = useState("");
  const [position, setPosition] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resume, setResume] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingJD, setIsGeneratingJD] = useState(false);
  const [isExtractingResume, setIsExtractingResume] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [backendStatus, setBackendStatus] = useState<boolean | null>(null);

  useEffect(() => {
    checkBackendHealth().then(setBackendStatus);
  }, []);

  const handleGenerateJD = async () => {
    let targetPosition = position.trim();
    
    if (!targetPosition) {
      targetPosition = RANDOM_ROLES[Math.floor(Math.random() * RANDOM_ROLES.length)];
      setPosition(targetPosition);
      toast.success(`No role entered. Randomly selected: ${targetPosition}`);
    }

    setIsGeneratingJD(true);

    const posLower = targetPosition.toLowerCase();
    const templateKey = Object.keys(JD_TEMPLATES).find(
      (k) => posLower.includes(k) || k.includes(posLower)
    );
    if (templateKey) {
      setJobDescription(JD_TEMPLATES[templateKey]);
      toast.success(`JD generated for "${targetPosition}"!`);
      setIsGeneratingJD(false);
      return;
    }

    try {
      const jd = await generateJD(targetPosition);
      setJobDescription(jd);
      toast.success("JD generated by ForgePro!");
    } catch {
      const localJD = generateLocalJD(targetPosition);
      setJobDescription(localJD);
      toast.success("JD generated locally (backend unavailable)");
    } finally {
      setIsGeneratingJD(false);
    }
  };

  const handleGenerateTranscript = () => {
    const targetRole = position.trim() || "Software Engineer";
    setIsGeneratingQuestions(true);
    
    setTimeout(() => {
      setTranscript(`1. Can you walk me through your most complex project as a ${targetRole}?\n2. What is the most challenging technical bug you've solved recently, and how did you approach it?\n3. How do you ensure code quality and maintainability in your deployments?\n4. Describe a time you disagreed with a senior engineer on an architectural decision.\n5. Where do you see your technical skills adding the most immediate value to our team?`);
      setIsGeneratingQuestions(false);
      toast.success("Transcript questions generated!");
    }, 800);
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
      if (ext === ".doc" || ext === ".docx") {
        toast.info("Sending DOCX to ForgePro Engine for extraction...");
        const response: any = await uploadResume(file); 
        if (response && response.extracted_text) {
          setResume(response.extracted_text);
          setResumeFileName(file.name);
          toast.success(`Resume "${file.name}" extracted via Backend!`);
        } else {
          toast.error("Failed to extract DOCX text. Please paste manually.");
        }
      } else {
        const text = await extractTextFromFile(file);
        if (text.trim()) {
          setResume(text);
          setResumeFileName(file.name);
          toast.success(`Resume "${file.name}" text extracted successfully!`);
        } else {
          toast.error("Could not extract text. Please paste content manually.");
        }
        uploadResume(file).catch(() => {});
      }
    } catch (error) {
      toast.error("Failed to parse resume. Please ensure the backend is running for DOCX files.");
    } finally {
      setIsExtractingResume(false);
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    }
  };

  const clearUploadedResume = () => {
    setResumeFileName("");
    setResume("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearJD = () => {
    setJobDescription("");
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Video file too large. Max 500MB.");
      return;
    }
    setVideoFile(file);
    toast.success(`Video "${file.name}" selected (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  };

  const handleSubmit = async () => {
    if (!candidateName || !position || !jobDescription || !resume) {
      toast.error("Please fill all required fields");
      return;
    }
    if (!videoFile && !transcript) {
      toast.error("Please upload a video or paste a transcript");
      return;
    }

    setIsSubmitting(true);
    try {
      let videoFilename: string | undefined;

      if (videoFile) {
        const timestamp = Date.now();
        const safeName = candidateName.replace(/\s+/g, "_");
        const filename = `UPLOADED_${safeName}_${timestamp}.${videoFile.name.split(".").pop()}`;
        try {
          const blob = new Blob([await videoFile.arrayBuffer()], { type: videoFile.type });
          const result = await uploadVideo(blob, filename);
          videoFilename = `[UPLOADED] ${result.filename}`;
          toast.success("Video uploaded to backend!");
        } catch {
          toast.warning("Video upload skipped (backend offline). Evaluation will still proceed.");
        }
      }

      const finalTranscript = transcript ||
        "(Pre-recorded interview video uploaded. Analyze based on resume and JD match assessment.)";

      const evalResult = await submitEvaluation({
        candidate_name: candidateName,
        position,
        job_description: jobDescription,
        resume,
        transcript: finalTranscript,
        video_filename: videoFilename,
        remarks: "[TYPE:L1_TECH_ROUND] Uploaded video evaluation."
      });

      toast.success("BATS ForgePro Evaluation complete!");
      navigate(`/result/${evalResult.id}`);
    } catch (err: any) {
      toast.error(err.message || "Evaluation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = candidateName && position && jobDescription && resume && (videoFile || transcript);

  return (
    <div className="min-h-screen bg-background nexus-grid">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          
          <motion.div variants={fadeUp} custom={0} className="text-center space-y-3">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground leading-tight">
              Analyze Pre-Recorded Interviews With <br />
              <span className="text-primary">BATS ForgePro</span>
            </h1>
          </motion.div>

          <motion.div variants={fadeUp} custom={0.2} className="glass rounded-xl p-6 border-primary/20 relative overflow-hidden mb-6 shadow-sm">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
            <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-6 text-center flex items-center justify-center gap-2">
              <motion.img 
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                src="/comp-logo.PNG" 
                alt="ForgePro" 
                className="w-3.5 h-3.5 object-contain drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]"
              /> 
              How It Works
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 sm:gap-4 relative">
              <div className="hidden sm:block absolute top-4 left-[10%] right-[10%] h-[1px] bg-border/50 -z-10" />
              {[
                { step: "1", title: "Target Profile", desc: "Upload resume & set JD" },
                { step: "2", title: "Upload Video", desc: "Provide recorded videos" },
                { step: "3", title: "Transcript", desc: "Add ForgePro Transcript" },
                { step: "4", title: "ForgePro Check", desc: "Deep semantic analysis" },
                { step: "5", title: "Deep Debrief", desc: "Full analytics & scoring" },
              ].map((s) => (
                <div key={s.step} className="flex flex-col items-center text-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-background border border-primary/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
                    <span className="text-xs font-bold text-primary">{s.step}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 px-2">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={0.3}>
            {backendStatus === false && (
              <div className="rounded-xl p-3 bg-destructive/10 border border-destructive/20 flex items-center gap-3">
                <WifiOff className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">
                  <strong>Backend offline</strong> — ForgePro will evaluate locally. Start backend for deep analysis and DOCX extraction.
                </p>
              </div>
            )}
          </motion.div>

          <div className="space-y-6">
            <motion.div variants={fadeUp} custom={1} className="glass p-6 rounded-xl border border-primary/10 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <User className="w-4 h-4 text-primary" /> Candidate Name
                </label>
                <Input
                  placeholder="e.g., Alex Chen"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="bg-background border-border focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Briefcase className="w-4 h-4 text-accent" /> Position / Role
                </label>
                <Input
                  placeholder="e.g., React Developer, Data Scientist"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="bg-background border-border focus-visible:ring-primary"
                />
              </div>
            </motion.div>

            <motion.div variants={fadeUp} custom={2} className="glass p-6 rounded-xl border border-primary/10 shadow-sm space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="w-4 h-4 text-primary" /> Job Description *
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => setJobDescription("")}
                      className="text-xs h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={handleGenerateJD}
                      disabled={isGeneratingJD}
                      className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      {isGeneratingJD ? (
                        <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Generating...</span>
                      ) : (
                        <span className="flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> let ForgePro write one</span>
                      )}
                    </Button>
                  </div>
                </div>
                <Textarea
                  placeholder="Paste the job description here, or click 'let ForgePro write one' to let ForgePro write one for you..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="bg-background border-border min-h-[140px] resize-none focus-visible:ring-primary"
                />
              </div>

              <div className="h-[1px] w-full bg-border/50" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="w-4 h-4 text-primary" /> Candidate Resume *
                  </label>
                  <input ref={resumeInputRef} type="file" accept=".pdf,.txt,.doc,.docx,.md" onChange={handleResumeUpload} className="hidden" />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => { setResumeFileName(""); setResume(""); if(resumeInputRef.current) resumeInputRef.current.value = ""; }}
                      className="text-xs h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={() => resumeInputRef.current?.click()}
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
                </div>
                {resumeFileName && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs text-primary font-medium truncate">{resumeFileName}</span>
                  </div>
                )}
                <Textarea
                  placeholder="Paste resume content here, or upload a file above..."
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  className="bg-background border-border min-h-[120px] resize-none focus-visible:ring-primary"
                />
              </div>
            </motion.div>

            <motion.div variants={fadeUp} custom={3} className="glass p-6 rounded-xl border border-primary/10 shadow-sm space-y-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Video className="w-4 h-4 text-accent" /> Pre-Recorded Interview Video <span className="text-[10px] text-muted-foreground font-normal ml-1">(Optional if transcript provided)</span>
                </label>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*,.mp4,.webm,.avi,.mov,.mkv,.flv,.wmv"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                <div
                  onClick={() => videoInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
                >
                  {videoFile ? (
                    <div className="space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
                      <p className="text-sm font-medium text-foreground">{videoFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(videoFile.size / 1024 / 1024).toFixed(1)} MB · Click to change
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setVideoFile(null); }}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove video
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">Click to upload interview video</p>
                      <p className="text-xs text-muted-foreground/70">
                        Supports MP4, WebM, AVI, MOV, MKV (max 500MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-[1px] w-full bg-border/50" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <MessageSquare className="w-4 h-4 text-accent" /> 
                    ForgePro Transcript <span className="text-[10px] text-muted-foreground font-normal ml-1">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => setTranscript("")}
                      className="text-xs h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={handleGenerateTranscript}
                      disabled={isGeneratingQuestions}
                      className="text-xs h-8 border-accent/30 text-accent hover:bg-accent/10"
                    >
                      {isGeneratingQuestions ? (
                        <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Generating...</span>
                      ) : (
                        <span className="flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Auto-Generate Questions</span>
                      )}
                    </Button>
                  </div>
                </div>
                <Textarea
                  placeholder="Paste the interview transcript here, or click 'Auto-Generate Questions'..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="bg-background border-border min-h-[160px] resize-none focus-visible:ring-accent"
                />
              </div>
            </motion.div>

            <motion.div variants={fadeUp} custom={4}>
              <Button
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
                className="w-full h-14 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan disabled:opacity-40"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading & Evaluating...
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <motion.img 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      src="/comp-logo.PNG" 
                      alt="ForgePro" 
                      className="w-5 h-5 object-contain drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]"
                    />
                    Run ForgePro Evaluation
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