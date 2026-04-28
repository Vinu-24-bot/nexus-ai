import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Brain, Shield, Zap, BarChart3, Target, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description: "Leverages advanced AI to evaluate candidates against job requirements with zero bias.",
    color: "text-primary",
  },
  {
    icon: Target,
    title: "JD Relevance Matching",
    description: "Maps candidate experience directly to job description requirements with precision scoring.",
    color: "text-nexus-purple",
  },
  {
    icon: BarChart3,
    title: "Data-Driven Scoring",
    description: "Multi-dimensional scoring across technical, communication, and relevance criteria.",
    color: "text-nexus-blue",
  },
  {
    icon: Shield,
    title: "Unbiased Evaluation",
    description: "Ignores demographics, filler words, and focuses purely on technical competence.",
    color: "text-nexus-green",
  },
  {
    icon: Zap,
    title: "Instant Results",
    description: "Get comprehensive evaluation reports in seconds, not hours.",
    color: "text-nexus-amber",
  },
  {
    icon: Lock,
    title: "Enterprise Ready",
    description: "Built for scale with secure data handling and audit trails.",
    color: "text-nexus-red",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6 },
  }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />

      {/* Hero Section with Split Layout */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        
        {/* Ambient Background Glows */}
        <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-nexus-blue/10 rounded-full blur-[150px] pointer-events-none" />

        <div className="relative z-10 container mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-16">
          
          {/* Left Content - Text & CTAs */}
          <motion.div
            initial="hidden"
            animate="visible"
            className="flex-1 space-y-8 text-center lg:text-left pt-10 lg:pt-0"
          >
            {/* The Badge was removed here as requested */}

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight glow-text-cyan"
            >
              Accelerate Tech Hiring
              <br />
              <span className="text-primary">With BATS ForgePro</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0"
            >
              Shape Top Tech Talent With Predictive Insights
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
              <Link to="/evaluate">
                <Button className="h-14 px-8 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan">
                  Start Evaluating
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="outline" className="h-14 px-8 text-base font-semibold border-border text-foreground hover:bg-muted">
                  View Dashboard
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right Content - Fascinating Logo Animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="flex-1 relative w-full max-w-[400px] lg:max-w-[550px] aspect-square flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              className="absolute inset-4 rounded-full border-[1.5px] border-primary/20 border-dashed opacity-50"
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="absolute inset-16 rounded-full border border-nexus-green/30 border-dotted opacity-50"
            />
            <motion.div
              animate={{ y: [-15, 15, -15] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-3/4 h-3/4 flex items-center justify-center"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/20 via-orange-500/20 to-green-500/20 blur-[60px]" />
              <motion.img
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                src="/comp-logo.PNG"
                alt="ForgePro Logo"
                className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_25px_rgba(0,240,255,0.4)]"
              />
            </motion.div>
          </motion.div>

        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Features */}
      <section className="py-24 nexus-grid">
        <div className="container mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeUp}
              custom={0}
              className="text-3xl md:text-4xl font-display font-bold text-foreground"
            >
              Built for Precision
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              className="text-muted-foreground mt-3 max-w-lg mx-auto"
            >
              Every feature designed to eliminate bias and maximize hiring accuracy.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                custom={i}
                className="glass rounded-xl p-6 hover:border-primary/20 transition-all duration-300 group"
              >
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

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="max-w-2xl mx-auto space-y-6"
          >
            <motion.h2
              variants={fadeUp}
              custom={0}
              className="text-3xl md:text-4xl font-display font-bold text-foreground"
            >
              Ready to Transform Hiring?
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground">
              Start making data-driven hiring decisions today.
            </motion.p>
            <motion.div variants={fadeUp} custom={2}>
              <Link to="/evaluate">
                <Button className="h-12 px-10 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan">
                  Get Started Free
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-background transition-colors duration-300">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.img 
              animate={{ rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              src="/comp-logo.PNG" 
              alt="Logo" 
              className="w-5 h-5 object-contain"
            />
            <span className="font-display text-sm font-bold tracking-wider text-foreground">ForgePro</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 BATS ForgePro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}