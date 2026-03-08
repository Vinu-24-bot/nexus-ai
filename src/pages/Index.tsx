import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Brain, Shield, Zap, BarChart3, Target, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroScene from "@/components/HeroScene";
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
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <HeroScene />
        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            className="max-w-3xl mx-auto space-y-6"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
              <Zap className="w-3.5 h-3.5" />
              AI Executive Recruiter
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-foreground leading-tight glow-text-cyan"
            >
              Hire Smarter
              <br />
              <span className="text-primary">With BATS</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-lg text-muted-foreground max-w-xl mx-auto"
            >
              The elite AI-powered interview evaluator that delivers unbiased, data-driven hiring decisions in seconds.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link to="/evaluate">
                <Button className="h-12 px-8 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan">
                  Start Evaluating
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="outline" className="h-12 px-8 text-base font-semibold border-border text-foreground hover:bg-muted">
                  View Dashboard
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Gradient fade at bottom */}
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
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-display text-sm font-bold tracking-wider text-foreground">BATS</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 BATS AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
