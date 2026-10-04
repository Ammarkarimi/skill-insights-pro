import React from "react";
import { Badge } from "@/components/ui/badge";
import { barColor, RequirementScore } from "@/lib/readiness";

const RequirementList: React.FC<{ requirements: RequirementScore[]; sourceLabels: Record<string, string> }> = ({
  requirements,
  sourceLabels,
}) => (
  <ul className="space-y-4">
    {requirements.map((r) => (
      <li key={r.key}>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{r.name}</span>
            {r.must_have && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">must-have</Badge>}
            {r.kind !== "skill" && <span className="text-xs text-gray-400">{r.kind}</span>}
          </span>
          <span className="shrink-0 font-semibold">{r.score === null ? <span className="text-gray-400 font-normal">not yet measured</span> : r.score}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 mt-1 overflow-hidden">
          {r.score !== null && <div className={`h-full ${barColor(r.score)}`} style={{ width: `${Math.max(3, r.score)}%` }} />}
        </div>
        {Object.keys(r.sources).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(r.sources).map(([source, score]) => (
              <span key={source} className="text-[11px] text-gray-500 bg-gray-50 border rounded px-1.5">
                {sourceLabels[source] ?? source}: {score}
              </span>
            ))}
          </div>
        )}
      </li>
    ))}
  </ul>
);

export default RequirementList;
