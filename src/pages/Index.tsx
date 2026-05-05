import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  Lock, User, Key, ArrowRight, ShieldCheck, 
  Brain, Activity, Video, Globe 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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

export default function AuthPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated, push them straight to the dashboard
  useEffect(() => {
    if (localStorage.getItem("forgepro_auth") === "true") {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      if (userId === VALID_ID && password === VALID_PASSWORD) {
        localStorage.setItem("forgepro_auth", "true");
        toast.success("Authentication Successful. Welcome to ForgePro.");
        navigate("/dashboard");
      } else {
        toast.error("Access Denied: Invalid ID or Password.");
        setIsLoading(false);
      }
    }, 800); // Small artificial delay for an "Enterprise" scanning feel
  };

  return (
    <div className="min-h-screen bg-background nexus-grid relative overflow-hidden flex items-center justify-center">
      
      {/* Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Rotating Background Logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0">
        <motion.img 
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          src="/comp-logo.PNG" 
          alt="Background Logo" 
          className="w-[800px] h-[800px] object-contain"
        />
      </div>

      <div className="container mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24 py-12">
        
        {/* Left Side: System Details & Branding */}
        <motion.div 
          initial="hidden" animate="visible" 
          className="flex-1 w-full max-w-lg lg:max-w-xl flex flex-col items-center lg:items-start text-center lg:text-left"
        >
          <motion.div variants={fadeUp} custom={0} className="mb-6 flex items-center gap-4">
            <motion.img 
              animate={{ rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              src="/comp-logo.PNG" 
              alt="ForgePro Logo" 
              className="w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(0,240,255,0.3)]"
            />
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight">
              BATS <span className="text-primary">ForgePro</span>
            </h1>
          </motion.div>

          <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground mb-10 max-w-md">
            The enterprise-grade AI technical screening vault. Authenticate to access predictive hiring analytics and live interview processing.
          </motion.p>

          <motion.div variants={fadeUp} custom={2} className="space-y-6 w-full max-w-md">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Deep Semantic Analysis</h3>
                <p className="text-xs text-muted-foreground mt-1">Evaluates candidates using HOTS (Higher Order Thinking Skills) detection and strict JD relevancy.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Live Security Vault</h3>
                <p className="text-xs text-muted-foreground mt-1">Real-time anti-cheat telemetry tracking tab-switches, keyboard usage, and facial liveness.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                <Video className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Asynchronous Processing</h3>
                <p className="text-xs text-muted-foreground mt-1">Supports both live interactive screenings and L1 pre-recorded video evaluations flawlessly.</p>
              </div>
            </div>
          </motion.div>

          {/* 🔗 ACTIVE COMPANY LINK */}
          <motion.div variants={fadeUp} custom={3} className="mt-12 pt-8 border-t border-border/50 w-full max-w-md flex flex-col items-center lg:items-start gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Engineered & Maintained By</p>
            <a 
              href="https://bayareatecsol.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group"
            >
              <Globe className="w-4 h-4 text-primary group-hover:animate-pulse" />
              <span className="font-bold text-lg tracking-wide border-b border-transparent group-hover:border-primary">Bay Area Tech Sol</span>
            </a>
          </motion.div>

        </motion.div>

        {/* Right Side: The Secure Login Form */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ delay: 0.2, duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="glass rounded-2xl p-8 border border-primary/20 shadow-[0_0_50px_rgba(0,240,255,0.05)] relative overflow-hidden">
            
            {/* Top Scanning Laser Effect */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 animate-[scan_2s_linear_infinite]" />

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-background border border-border flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Lock className="w-7 h-7 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">System Login</h2>
              <p className="text-sm text-muted-foreground mt-2">Enter credentials to unlock the dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2 relative">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Admin ID</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    type="text" 
                    placeholder="Enter assigned ID" 
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="pl-10 h-12 bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary text-foreground"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 relative">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Master Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    type="password" 
                    placeholder="••••••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12 bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary text-foreground"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-12 mt-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base glow-cyan transition-all relative overflow-hidden group"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Activity className="w-5 h-5 animate-pulse" /> Verifying Credentials...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Authenticate & Enter <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border/30 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                Unauthorized access is strictly monitored.
              </p>
            </div>

          </div>
        </motion.div>

      </div>
    </div>
  );
}