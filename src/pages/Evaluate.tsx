import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Brain, FileText, Briefcase, User, Loader2, Sparkles, Upload, X, CheckCircle2,
  Wifi, WifiOff, Mail, Copy, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { generateJD, uploadResume, checkBackendHealth } from "@/lib/api";
import { extractTextFromFile } from "@/lib/resume-parser";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

// Dynamically fetch from backend API
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const LEVEL_OPTIONS = [
  { label: "L1 (Junior)", value: "L1" },
  { label: "L2 (Mid-Level)", value: "L2" },
  { label: "L3 (Senior)", value: "L3" },
  { label: "L4 (Lead/Architect)", value: "L4" },
];

const JD_TEMPLATES: Record<string, string> = {
  "react developer": `Job Title: React Developer\n\nJob Summary:\nWe are looking for a skilled React Developer to build and maintain high-performance web applications using React.js and modern JavaScript ecosystem.\n\nKey Responsibilities:\n- Build responsive, reusable UI components using React.js\n- Implement state management solutions (Redux, Context API, Zustand)\n- Write clean, maintainable, and well-tested code with Jest/RTL\n- Collaborate with backend engineers on RESTful APIs and GraphQL\n- Optimize applications for maximum speed and scalability\n- Participate in code reviews and mentor junior developers\n- Translate UI/UX designs into high-quality code\n\nRequired Skills & Qualifications:\n- 2+ years of hands-on React.js development experience\n- Strong proficiency in JavaScript/TypeScript, HTML5, CSS3\n- Deep understanding of React hooks, component lifecycle, virtual DOM\n- Experience with build tools (Webpack, Vite, Babel)\n- Familiarity with RESTful APIs and async programming\n- Git version control proficiency\n- Understanding of responsive design and cross-browser compatibility\n\nPreferred Skills:\n- Next.js or Remix framework experience\n- Testing experience (Jest, React Testing Library, Cypress)\n- CI/CD pipeline experience\n- Tailwind CSS or CSS-in-JS solutions\n\nExperience Level: Mid-Level (2-4 years)`,
  "full stack developer": `Job Title: Full Stack Developer\n\nJob Summary:\nSeeking a versatile Full Stack Developer proficient in both frontend and backend technologies to build end-to-end web applications.\n\nKey Responsibilities:\n- Design and develop full-stack web applications\n- Build scalable RESTful APIs and microservices\n- Develop responsive frontend interfaces with modern frameworks\n- Manage relational and NoSQL databases\n- Deploy and maintain cloud infrastructure\n- Write unit/integration tests\n- Ensure application security and performance\n\nRequired Skills:\n- 3+ years full-stack development experience\n- Frontend: React/Vue/Angular, HTML5, CSS3, JavaScript/TypeScript\n- Backend: Node.js/Python/Java with Express/FastAPI/Spring\n- Database: PostgreSQL, MongoDB, Redis\n- RESTful API design and implementation\n- Git, Docker basics, Linux command line\n\nPreferred Skills:\n- Cloud platforms (AWS/GCP/Azure)\n- Kubernetes, CI/CD pipelines\n- GraphQL\n- System design fundamentals\n\nExperience Level: Mid to Senior (3-6 years)`,
  "python developer": `Job Title: Python Developer\n\nJob Summary:\nWe are looking for an experienced Python Developer to build scalable backend services and data processing systems.\n\nKey Responsibilities:\n- Design and implement Python-based backend services\n- Build RESTful APIs using Django/FastAPI/Flask\n- Write efficient data processing scripts and ETL pipelines\n- Implement unit testing and integration testing\n- Optimize code for performance and scalability\n- Collaborate with frontend and data teams\n\nRequired Skills:\n- 2+ years Python development experience\n- Proficiency in Django, FastAPI, or Flask\n- Strong understanding of OOP and design patterns\n- Database experience (PostgreSQL, MySQL, MongoDB)\n- Git version control\n- Linux/Unix environment\n\nPreferred Skills:\n- Data processing (Pandas, NumPy)\n- Celery/async task processing\n- Docker, CI/CD\n- AWS/GCP cloud services\n\nExperience Level: Mid-Level (2-4 years)`,
};

function generateLocalJD(position: string): string {
  return `Job Title: ${position}\n\nJob Summary:\nWe are looking for an experienced ${position} to join our growing team. The ideal candidate will have strong technical skills, excellent problem-solving abilities, and a proven track record of delivering high-quality work.\n\nKey Responsibilities:\n- Design, develop, and maintain solutions relevant to the ${position} role\n- Collaborate with cross-functional teams to define and implement features\n- Write clean, maintainable, and well-documented code/deliverables\n- Participate in reviews and provide constructive feedback\n- Troubleshoot and resolve complex issues\n- Stay current with industry trends and best practices\n- Mentor and guide junior team members\n\nRequired Skills & Qualifications:\n- 2+ years of relevant experience in the ${position} domain\n- Strong problem-solving and analytical skills\n- Excellent written and verbal communication\n- Proficiency in industry-standard tools and technologies\n- Bachelor's degree in a related field or equivalent experience\n- Ability to work independently and in a team\n\nPreferred Skills:\n- Experience with agile/scrum methodologies\n- Leadership or mentoring experience\n- Relevant industry certifications\n- Open source or community contributions\n\nExperience Level: Mid to Senior (2-5+ years)`;
}

export default function EvaluatePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingJD, setIsGeneratingJD] = useState(false);
  const [isExtractingResume, setIsExtractingResume] = useState(false);
  
  // State Fields
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [position, setPosition] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resume, setResume] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [selectedLevel, setSelectedLevel] = useState(LEVEL_OPTIONS[1]);
  
  const [backendStatus, setBackendStatus] = useState<boolean | null>(null);
  const [generatedLink, setGeneratedLink] = useState("");

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

  const handleGenerateLink = async () => {
    if (!candidateName || !candidateEmail || !position || !jobDescription || !resume) {
      toast.error("Please fill all required fields");
      return;
    }
    
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_URL}/sessions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_name: candidateName,
          candidate_email: candidateEmail,
          recruiter_email: recruiterEmail,
          position,
          job_description: jobDescription,
          resume_text: resume,
          interview_level: selectedLevel.label
        })
      });

      if (!res.ok) {
         const err = await res.json();
         throw new Error(err.detail || "Failed to create session");
      }

      const data = await res.json();
      
      // Determine the correct frontend URL for the copyable link
      const frontendUrl = window.location.origin;
      setGeneratedLink(`${frontendUrl}/interview/${data.session_id}`);
      
      toast.success("Interview link generated and emails queued via Webhook!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate interview link. Ensure backend is running.");
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setGeneratedLink("");
    setCandidateName("");
    setCandidateEmail("");
    clearUploadedResume();
  };

  const isValid = candidateName && candidateEmail && position && jobDescription && resume;

  return (
    <div className="min-h-screen bg-background nexus-grid">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          
          {/* Header */}
          <motion.div variants={fadeUp} custom={0} className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
              <Brain className="w-3.5 h-3.5" />
              BATS ForgePro Async Interview
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
              Generate Interview Link
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Generate a unique, secure link for your candidate. BATS ForgePro will conduct the interview asynchronously and email you the results.
            </p>
          </motion.div>

          {/* Backend Status (Only shows errors now) */}
          <motion.div variants={fadeUp} custom={0.3}>
            {backendStatus === false && (
              <div className="rounded-xl p-3 bg-destructive/10 border border-destructive/20 flex items-center gap-3">
                <WifiOff className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">
                  <strong>Backend offline</strong> — Cannot generate links or send emails. Please start the backend server.
                </p>
              </div>
            )}
          </motion.div>

          {/* Success State / Generated Link UI */}
          {generatedLink ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 rounded-2xl border border-primary/30 bg-primary/5 space-y-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground">Link Generated Successfully!</h3>
                <p className="text-muted-foreground mt-2">
                  The automated BATS ForgePro interview invitation has been emailed to <strong>{candidateEmail}</strong>.
                </p>
              </div>
              
              <div className="max-w-lg mx-auto bg-card border border-border p-3 rounded-xl flex items-center gap-3 shadow-inner">
                <Input readOnly value={generatedLink} className="bg-transparent border-none focus-visible:ring-0 font-mono text-xs md:text-sm text-foreground" />
                <Button onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success("Copied to clipboard!"); }} variant="outline" className="shrink-0">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>

              <Button onClick={resetForm} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
                Create Another Session
              </Button>
            </motion.div>
          ) : (
            
            /* Form UI */
            <div className="space-y-6">
              
              {/* Row 1: Candidate Name & Position */}
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

              {/* Row 2: Emails */}
              <motion.div variants={fadeUp} custom={1.5} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Mail className="w-4 h-4 text-primary" /> Candidate Email *
                  </label>
                  <Input
                    type="email"
                    placeholder="candidate@example.com"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    className="bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Mail className="w-4 h-4 text-accent" /> Recruiter Email (Optional)
                  </label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={recruiterEmail}
                    onChange={(e) => setRecruiterEmail(e.target.value)}
                    className="bg-card border-border"
                  />
                  <p className="text-[10px] text-muted-foreground ml-1">Receive an alert when they finish.</p>
                </div>
              </motion.div>

              {/* Interview Level */}
              <motion.div variants={fadeUp} custom={2} className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Brain className="w-4 h-4 text-primary" /> Target Interview Level
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedLevel(opt)}
                      className={`py-2 rounded-xl border text-center transition-all ${
                        selectedLevel.value === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <span className="block text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* JD */}
              <motion.div variants={fadeUp} custom={3} className="space-y-2">
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
              <motion.div variants={fadeUp} custom={4} className="space-y-3">
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
                      <span className="flex items-center gap-1.5"><Upload className="w-3 h-3" /> Upload Resume (PDF/TXT)</span>
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

              {/* Submit Button */}
              <motion.div variants={fadeUp} custom={5}>
                <Button
                  onClick={handleGenerateLink}
                  disabled={!isValid || isGenerating || backendStatus === false}
                  className="w-full h-14 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan disabled:opacity-40"
                >
                  {isGenerating ? (
                    <span className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating Session Vault...
                    </span>
                  ) : (
                    <span className="flex items-center gap-3">
                      <Send className="w-5 h-5" />
                      Generate & Send Secure Link
                    </span>
                  )}
                </Button>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}