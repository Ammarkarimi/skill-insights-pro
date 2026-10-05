import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import AptitudeTab from "@/components/practice/AptitudeTab";
import CodingTab from "@/components/practice/CodingTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";

const SECTION_LABEL: Record<string, string> = { quant: "Quantitative", logical: "Logical", verbal: "Verbal", mixed: "Mixed" };
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

interface History {
  tests: { id: number; section: string; difficulty: string; status: string; score: number | null; total: number; startedAt: string }[];
  sessions: { id: number; level: string; status: string; score: number | null; startedAt: string }[];
  attempts: { id: number; title: string; language: string; passed: number; total: number; score: number | null; createdAt: string }[];
}

const HistoryTab: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [data, setData] = useState<History | null>(null);
  useEffect(() => {
    Promise.all([
      api.get<{ tests: History["tests"] }>("/api/aptitude"),
      api.get<{ sessions: History["sessions"] }>("/api/coding/oa"),
      api.get<{ attempts: History["attempts"] }>("/api/coding/attempts"),
    ])
      .then(([a, o, c]) => setData({ tests: a.data.tests, sessions: o.data.sessions, attempts: c.data.attempts }))
      .catch(() => undefined);
  }, [refreshKey]);

  if (!data) return null;
  const row = "flex justify-between gap-3 border-b py-2 text-sm last:border-0";
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aptitude tests</CardTitle>
        </CardHeader>
        <CardContent>
          {data.tests.length === 0 && <p className="text-sm text-gray-500">No tests yet.</p>}
          {data.tests.map((t) => (
            <div key={t.id} className={row}>
              <span>
                {SECTION_LABEL[t.section]} · <span className="capitalize">{t.difficulty}</span>
              </span>
              <span className="text-gray-600">
                {t.score === null ? "in progress" : `${t.score}%`} · {when(t.startedAt)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coding</CardTitle>
        </CardHeader>
        <CardContent>
          {data.sessions.map((s) => (
            <div key={`oa-${s.id}`} className={row}>
              <span>Mock assessment ({s.level === "hard" ? "medium + hard" : "easy + medium"})</span>
              <span className="text-gray-600">
                {s.score === null ? "in progress" : `${s.score}%`} · {when(s.startedAt)}
              </span>
            </div>
          ))}
          {data.attempts.slice(0, 15).map((a) => (
            <div key={a.id} className={row}>
              <span>
                {a.title} <span className="text-gray-500">({a.language === "python" ? "Python" : "JS"})</span>
              </span>
              <span className="text-gray-600">
                {a.passed}/{a.total} tests{a.score !== null && ` · review ${a.score}`} · {when(a.createdAt)}
              </span>
            </div>
          ))}
          {data.sessions.length + data.attempts.length === 0 && <p className="text-sm text-gray-500">No coding runs yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

const PracticeTests: React.FC = () => {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "coding" ? "coding" : params.get("tab") === "history" ? "history" : "aptitude");
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <h1 className="page-header">Practice Tests</h1>
        <p className="text-gray-600 -mt-4 mb-6">Rehearse the online assessment round: timed aptitude tests and coding problems that run in your browser.</p>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="aptitude">Aptitude</TabsTrigger>
            <TabsTrigger value="coding">Coding</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="aptitude" className="max-w-4xl">
            <AptitudeTab onFinished={bump} />
          </TabsContent>
          <TabsContent value="coding">
            <CodingTab startInOA={params.get("mode") === "oa"} onFinished={bump} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab refreshKey={refreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default PracticeTests;
