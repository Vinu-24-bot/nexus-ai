import { useMemo } from "react";
import { motion } from "framer-motion";

interface RadarChartProps {
  scores: {
    technical_proficiency: number;
    relevance_to_jd: number;
    communication: number;
    confidence_level?: number;
    overall_score?: number;
  };
  size?: number;
}

export default function RadarChart({ scores, size = 240 }: RadarChartProps) {
  const center = size / 2;
  const radius = size * 0.35;
  const labels = [
    { key: "technical_proficiency" as const, label: "Technical", angle: -90 },
    { key: "relevance_to_jd" as const, label: "Relevance", angle: 0 },
    { key: "communication" as const, label: "Communication", angle: 90 },
    { key: "confidence_level" as const, label: "Confidence", angle: 180 },
  ];

  const gridLevels = [0.25, 0.5, 0.75, 1];

  const getPoint = (angle: number, value: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + radius * value * Math.cos(rad),
      y: center + radius * value * Math.sin(rad),
    };
  };

  const dataPoints = useMemo(() => {
    return labels.map((l) => {
      const value = ((scores as any)[l.key] || 0) / 100;
      return getPoint(l.angle, value);
    });
  }, [scores]);

  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {gridLevels.map((level) => {
          const points = labels
            .map((l) => getPoint(l.angle, level))
            .map((p) => `${p.x},${p.y}`)
            .join(" ");
          return (
            <polygon
              key={level}
              points={points}
              fill="none"
              stroke="hsl(220 16% 20%)"
              strokeWidth="1"
            />
          );
        })}

        {labels.map((l) => {
          const end = getPoint(l.angle, 1);
          return (
            <line
              key={l.key}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke="hsl(220 16% 18%)"
              strokeWidth="1"
            />
          );
        })}

        <motion.path
          d={dataPath}
          fill="hsl(173 80% 50% / 0.15)"
          stroke="hsl(173 80% 50%)"
          strokeWidth="2"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{ transformOrigin: `${center}px ${center}px` }}
        />

        {dataPoints.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="hsl(173 80% 50%)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.15 }}
          />
        ))}
      </svg>

      {labels.map((l) => {
        const pos = getPoint(l.angle, 1.35);
        return (
          <div
            key={l.key}
            className="absolute text-xs font-medium text-muted-foreground"
            style={{
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            <span className="block text-center">{l.label}</span>
            <span className="block text-center text-primary font-mono font-bold">
              {(scores as any)[l.key] || 0}
            </span>
          </div>
        );
      })}
    </div>
  );
}
