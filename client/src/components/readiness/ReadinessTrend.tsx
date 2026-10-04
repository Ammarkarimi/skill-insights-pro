import React from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const ReadinessTrend: React.FC<{ trend: { date: string; score: number }[] }> = ({ trend }) => {
  if (trend.length < 2) {
    return <p className="text-sm text-gray-500">Your progress chart appears once you have results on more than one day.</p>;
  }
  const data = trend.map((t) => ({ ...t, label: new Date(t.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -20, right: 10, top: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => [`${v}/100`, "Readiness"]} />
          <Line type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ReadinessTrend;
