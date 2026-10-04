import React from "react";
import { scoreColor } from "@/lib/readiness";

/** Circular score gauge (SVG, no chart library needed). */
const ReadinessScore: React.FC<{ score: number; coverage: number }> = ({ score, coverage }) => {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="12" />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${scoreColor(score)} transition-all duration-700`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${scoreColor(score)}`}>{score}</span>
          <span className="text-xs text-gray-500">readiness</span>
        </div>
      </div>
      <p className="text-sm text-gray-600 mt-2">
        {coverage}% of requirements measured
      </p>
    </div>
  );
};

export default ReadinessScore;
