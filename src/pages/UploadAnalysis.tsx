import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Upload, FileText, Briefcase, User, Loader2, Brain, Sparkles, X,
  CheckCircle2, Video, AlertCircle, Wifi, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { generateJD, submitEvaluation, uploadVideo, uploadResume, checkBackendHealth } from "@/lib/api";
import { extractTextFromFile } from "@/lib/resume-parser";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

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
  const [transcript, setTranscript] = useState("");
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
      toast.success("JD generated locally (backend unavailable)");
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

    setIsExtractingResume(true);
    try {
      const text = await extractTextFromFile(file);
      if (text.trim()) {
        setResume(text);
        setResumeFileName(file.name);
        toast.success(`Resume "${file.name}" text extracted!`);
      } else if (ext === ".doc" || ext === ".docx") {
        toast.error("DOC/DOCX requires the backend. Please paste content manually or use PDF/TXT.");
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
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    }
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
          {/* Header */}
          <motion.div variants={fadeUp} custom={0} className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-4">
              <Upload className="w-3.5 h-3.5" />
              Upload & Analyze
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
              Analyze Pre-Recorded Interviews
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Upload pre-recorded interview videos or paste transcripts. BATS ForgePro will analyze them against the JD and resume.
            </p>
          </motion.div>

          {/* Backend Status Banner (Only shows errors now) */}
          <motion.div variants={fadeUp} custom={0.3}>
            {backendStatus === false && (
              <div className="rounded-xl p-3 bg-destructive/10 border border-destructive/20 flex items-center gap-3">
                <WifiOff className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">
                  <strong>Backend offline</strong> — BATS will evaluate locally using smart keyword analysis. Start backend for AI-powered deep analysis.
                </p>
              </div>
            )}
          </motion.div>

          {/* Info Banner */}
          <motion.div variants={fadeUp} custom={0.5} className="glass rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Upload a recorded interview video (MP4, WebM, AVI, MOV) along with the candidate's resume and job description. BATS evaluates performance based on transcript and documents. <strong>Works offline too!</strong>
            </div>
          </motion.div>

          {/* Form */}
          <div className="space-y-6">
            {/* Candidate Info */}
            <motion.div variants={fadeUp} custom={1} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <User className="w-4 h-4 text-primary" /> Candidate Name
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
                  <Briefcase className="w-4 h-4 text-accent" /> Position / Role
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
                  <FileText className="w-4 h-4 text-primary" /> Job Description
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
                  <FileText className="w-4 h-4 text-primary" /> Candidate Resume
                </label>
                <input ref={resumeInputRef} type="file" accept=".pdf,.txt,.doc,.docx,.md" onChange={handleResumeUpload} className="hidden" />
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => resumeInputRef.current?.click()}
                  disabled={isExtractingResume}
                  className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
                >
                  {isExtractingResume ? (
                    <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Extracting...</span>
                  ) : (
                    <span className="flex items-center gap-1.5"><Upload className="w-3 h-3" /> Upload Resume (PDF/TXT)</span>
                  )}
                </Button>
              </div>
              {resumeFileName && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs text-primary font-medium truncate">{resumeFileName}</span>
                  <button onClick={() => { setResumeFileName(""); setResume(""); }} className="ml-auto shrink-0">
                    <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              )}
              <Textarea
                placeholder="Paste resume content here, or upload a PDF/TXT file above..."
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                className="bg-card border-border min-h-[120px] resize-none"
              />
            </motion.div>

            {/* Video Upload */}
            <motion.div variants={fadeUp} custom={4} className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Video className="w-4 h-4 text-accent" /> Pre-Recorded Interview Video
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
            </motion.div>

            {/* Transcript */}
            <motion.div variants={fadeUp} custom={5} className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="w-4 h-4 text-primary" />
                Interview Transcript
                <span className="text-xs text-muted-foreground">(paste if available, or describe candidate responses)</span>
              </label>
              <Textarea
                placeholder={`Paste the interview transcript here...\n\nFormat:\nQ1: What is your experience with React?\nA1: I have 3 years of experience building...\n\nQ2: Describe a challenging project.\nA2: At my previous company, I led...`}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="bg-card border-border min-h-[160px] resize-none"
              />
            </motion.div>

            {/* Submit */}
            <motion.div variants={fadeUp} custom={6}>
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
                    <Brain className="w-5 h-5" />
                    Run AI Evaluation
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