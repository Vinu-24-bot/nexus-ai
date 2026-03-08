import { motion } from "framer-motion";
import { EvaluationResult } from "@/types/evaluation";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface RecommendationBadgeProps {
  recommendation: EvaluationResult["hiring_recommendation"];
}

const config = {
  "Strong Hire": {
    icon: CheckCircle2,
    bg: "bg-nexus-green/10",
    border: "border-nexus-green/30",
    text: "text-nexus-green",
    glow: "shadow-[0_0_20px_hsl(150_70%_50%/0.2)]",
  },
  "Lean Hire": {
    icon: AlertTriangle,
    bg: "bg-nexus-amber/10",
    border: "border-nexus-amber/30",
    text: "text-nexus-amber",
    glow: "shadow-[0_0_20px_hsl(38_92%_55%/0.2)]",
  },
  Reject: {
    icon: XCircle,
    bg: "bg-nexus-red/10",
    border: "border-nexus-red/30",
    text: "text-nexus-red",
    glow: "shadow-[0_0_20px_hsl(0_72%_55%/0.2)]",
  },
};

export default function RecommendationBadge({ recommendation }: RecommendationBadgeProps) {
  const c = config[recommendation];
  const Icon = c.icon;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, delay: 0.4 }}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${c.bg} ${c.border} ${c.glow}`}
    >
      <Icon className={`w-4 h-4 ${c.text}`} />
      <span className={`text-sm font-semibold ${c.text}`}>{recommendation}</span>
    </motion.div>
  );
}
