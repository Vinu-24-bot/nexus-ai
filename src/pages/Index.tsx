import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Lock, User, Key, ArrowRight, ShieldCheck, 
  Brain, Activity, Video, Globe, Zap, BarChart3, Target, LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

// 🔐 CHANGE YOUR ID AND PASSWORD HERE =====================
const VALID_ID = "admin";
const VALID_PASSWORD = "forgepro2026";
// ========================================================

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6 },
  }),
};

const features = [
  { icon: Brain, title: "AI-Powered Analysis", description: "Leverages advanced AI to evaluate candidates against job requirements with zero bias.", color: "text-primary" },
  { icon: Target, title: "JD Relevance Matching", description: "Maps candidate experience directly to job description requirements with precision scoring.", color: "text-nexus-purple" },
  { icon: BarChart3, title: "Data-Driven Scoring", description: "Multi-dimensional scoring across technical, communication, and relevance criteria.", color: "text-nexus-blue" },
  { icon: ShieldCheck, title: "Unbiased Evaluation", description: "Ignores demographics, filler words, and focuses purely on technical competence.", color: "text-nexus-green" },
  { icon: Zap, title: "Instant Results", description: "Get comprehensive evaluation reports in seconds, not hours.", color: "text-nexus-amber" },
  { icon: Lock, title: "Enterprise Ready", description: "Built for scale with secure data handling and audit trails.", color: "text-nexus-red" },
];

function AuthScreen({ onLogin }: { onLogin: () => void }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      if (userId === VALID_ID && password === VALID_PASSWORD) {
        sessionStorage.setItem("forgepro_auth", "true");
        toast.success("Authentication Successful. Welcome to ForgePro.");
        onLogin();
      } else {
        toast.error("Access Denied: Invalid ID or Password.");
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background nexus-grid relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0">
        <motion.img animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: "linear" }} src="/comp-logo.PNG" alt="Background Logo" className="w-[800px] h-[800px] object-contain" />
      </div>

      <div className="container mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24 py-12">
        <motion.div initial="hidden" animate="visible" className="flex-1 w-full max-w-lg lg:max-w-xl flex flex-col items-center lg:items-start text-center lg:text-left">
          <motion.div variants={fadeUp} custom={0} className="mb-6 flex items-center gap-4">
            <motion.img animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} src="/comp-logo.PNG" alt="ForgePro Logo" className="w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(0,240,255,0.3)]" />
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight">BATS <span className="text-primary">ForgePro</span></h1>
          </motion.div>
          <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground mb-10 max-w-md">The enterprise-grade AI technical screening vault. Authenticate to access predictive hiring analytics and live interview processing.</motion.p>
          <motion.div variants={fadeUp} custom={2} className="space-y-6 w-full max-w-md">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0"><Brain className="w-5 h-5 text-primary" /></div>
              <div><h3 className="text-sm font-bold text-foreground">Deep Semantic Analysis</h3><p className="text-xs text-muted-foreground mt-1">Evaluates candidates using HOTS detection and strict JD relevancy.</p></div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 text-accent" /></div>
              <div><h3 className="text-sm font-bold text-foreground">Live Security Vault</h3><p className="text-xs text-muted-foreground mt-1">Real-time anti-cheat telemetry tracking tab-switches, keyboard usage, and facial liveness.</p></div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0"><Video className="w-5 h-5 text-green-500" /></div>
              <div><h3 className="text-sm font-bold text-foreground">Asynchronous Processing</h3><p className="text-xs text-muted-foreground mt-1">Supports both live interactive screenings and L1 pre-recorded video evaluations flawlessly.</p></div>
            </div>
          </motion.div>
          <motion.div variants={fadeUp} custom={3} className="mt-12 pt-8 border-t border-border/50 w-full max-w-md flex flex-col items-center lg:items-start gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Engineered & Maintained By</p>
            <a href="https://bayareatecsol.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group">
              <Globe className="w-4 h-4 text-primary group-hover:animate-pulse" />
              <span className="font-bold text-lg tracking-wide border-b border-transparent group-hover:border-primary">Bay Area Tech Sol</span>
            </a>
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="w-full max-w-md">
          <div className="glass rounded-2xl p-8 border border-primary/20 shadow-[0_0_50px_rgba(0,240,255,0.05)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 animate-[scan_2s_linear_infinite]" />
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-background border border-border flex items-center justify-center mx-auto mb-4 shadow-inner"><Lock className="w-7 h-7 text-muted-foreground" /></div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">System Login</h2>
              <p className="text-sm text-muted-foreground mt-2">Enter credentials to unlock the dashboard</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2 relative">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Admin ID</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="text" placeholder="Enter assigned ID" value={userId} onChange={(e) => setUserId(e.target.value)} className="pl-10 h-12 bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary text-foreground" required />
                </div>
              </div>
              <div className="space-y-2 relative">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Master Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12 bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary text-foreground" required />
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 mt-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base glow-cyan transition-all relative overflow-hidden group">
                {isLoading ? <span className="flex items-center gap-2"><Activity className="w-5 h-5 animate-pulse" /> Verifying Credentials...</span> : <span className="flex items-center gap-2">Authenticate & Enter <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>}
              </Button>
            </form>
            <div className="mt-6 pt-6 border-t border-border/30 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Unauthorized access is strictly monitored.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function HomeScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-nexus-blue/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="relative z-10 container mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-16">
          <motion.div initial="hidden" animate="visible" className="flex-1 space-y-8 text-center lg:text-left pt-10 lg:pt-0">
            <motion.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight glow-text-cyan">
              Accelerate Tech Hiring<br /><span className="text-primary">With BATS ForgePro</span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
              Shape Top Tech Talent With Predictive Insights
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
              <Link to="/evaluate">
                <Button className="h-14 px-8 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan">
                  Start Evaluating <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="outline" className="h-14 px-8 text-base font-semibold border-border text-foreground hover:bg-muted">
                  View Dashboard
                </Button>
              </Link>
              <Button variant="destructive" onClick={onLogout} className="h-14 px-8 text-base font-semibold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20">
                <LogOut className="mr-2 w-5 h-5" /> Secure Logout
              </Button>
            </motion.div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} className="flex-1 relative w-full max-w-[400px] lg:max-w-[550px] aspect-square flex items-center justify-center">
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} className="absolute inset-4 rounded-full border-[1.5px] border-primary/20 border-dashed opacity-50" />
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute inset-16 rounded-full border border-nexus-green/30 border-dotted opacity-50" />
            <motion.div animate={{ y: [-15, 15, -15] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="relative w-3/4 h-3/4 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/20 via-orange-500/20 to-green-500/20 blur-[60px]" />
              <motion.img animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} src="/comp-logo.PNG" alt="ForgePro Logo" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_25px_rgba(0,240,255,0.4)]" />
            </motion.div>
          </motion.div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      <section className="py-24 nexus-grid">
        <div className="container mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} className="text-center mb-16">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-display font-bold text-foreground">Built for Precision</motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground mt-3 max-w-lg mx-auto">Every feature designed to eliminate bias and maximize hiring accuracy.</motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <motion.div key={feature.title} variants={fadeUp} custom={i} className="glass rounded-xl p-6 hover:border-primary/20 transition-all duration-300 group">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border py-8 bg-background transition-colors duration-300">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.img animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} src="/comp-logo.PNG" alt="Logo" className="w-5 h-5 object-contain" />
            <span className="font-display text-sm font-bold tracking-wider text-foreground">ForgePro</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 BATS ForgePro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default function IndexPage() {
  const [isAuth, setIsAuth] = useState(sessionStorage.getItem("forgepro_auth") === "true");

  if (!isAuth) {
    return <AuthScreen onLogin={() => setIsAuth(true)} />;
  }

  return (
    <HomeScreen 
      onLogout={() => {
        sessionStorage.removeItem("forgepro_auth");
        setIsAuth(false);
        toast.success("Successfully logged out.");
      }} 
    />
  );
}