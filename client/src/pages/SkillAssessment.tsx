import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import FileUpload from "@/components/FileUpload";
import CostNote from "@/components/CostNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Check,
  X,
  AlertTriangle,
  FileQuestion,
  Loader2,
  Cpu,
  BookOpen,
  ArrowRight,
  Download,
  Plus,
  Target,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { invalidateReadiness } from "@/lib/readiness";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

enum Stage {
  Upload = 0,
  Skills = 1,
  Difficulty = 2,
  Test = 3,
  Results = 4,
  Path = 5,
}

const MAX_SKILLS = 8;

interface Question {
  id: number;
  question: string;
  code: string | null;
  options: Record<string, string>;
  // Only present after the server grades the submission.
  answer?: string;
  explanation?: string;
  topic: string;
  skill: string;
}

interface TechStack {
  name: string;
  selected: boolean;
}

interface Resource {
  title: string;
  type: string;
  provider: string;
  link: string;
  description: string;
  focus_area: string;
  estimated_hours: number;
  free: boolean;
  link_verified: boolean;
}

interface LearningPath {
  title: string;
  summary: string;
  strengths: string[];
  focusAreas: { topic: string; why: string; priority: string }[];
  learningPath: Resource[];
  weeklyPlan: { week: number; goal: string; activities: string[] }[];
  capstoneProject: string;
}

const STAGES = [
  { stage: Stage.Upload, label: "Upload", icon: <FileQuestion className="h-4 w-4" /> },
  { stage: Stage.Skills, label: "Skills", icon: <Cpu className="h-4 w-4" /> },
  { stage: Stage.Difficulty, label: "Level", icon: <AlertTriangle className="h-4 w-4" /> },
  { stage: Stage.Test, label: "Test", icon: <BookOpen className="h-4 w-4" /> },
  { stage: Stage.Results, label: "Results", icon: <Check className="h-4 w-4" /> },
  { stage: Stage.Path, label: "Path", icon: <ArrowRight className="h-4 w-4" /> },
];

const SkillAssessment: React.FC = () => {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>(Stage.Upload);
  const [extracting, setExtracting] = useState(false);
  const [category, setCategory] = useState("");
  const [primaryRole, setPrimaryRole] = useState("");
  const [techStacks, setTechStacks] = useState<TechStack[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [path, setPath] = useState<LearningPath | null>(null);

  const selectedSkills = techStacks.filter((t) => t.selected).map((t) => t.name);

  // Deep link from the readiness dashboard: /skill-assessment?skills=React,TypeScript
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const prefill = (searchParams.get("skills") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_SKILLS);
    if (prefill.length) {
      setTechStacks(prefill.map((name) => ({ name, selected: true })));
      setStage(Stage.Skills);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fail = (title: string, err: unknown) => {
    if (isInsufficientCredits(err)) return; // handled globally with a "Buy credits" toast
    toast({ title, description: apiErrorMessage(err), variant: "destructive" });
  };

  const handleResume = async (files: File[]) => {
    if (files.length === 0) return;
    setExtracting(true);
    try {
      const form = new FormData();
      form.append("resume", files[0]);
      const { data } = await api.post("/api/resume/skills", form);
      const skills: string[] = data.techStack ?? [];
      setTechStacks(skills.map((name, i) => ({ name, selected: i < 5 })));
      setCategory(data.category);
      setPrimaryRole(data.primaryRole);
      setStage(Stage.Skills);
      toast({ title: "Resume analysed", description: `Found ${skills.length} skills.` });
    } catch (err) {
      fail("Could not read your resume", err);
    } finally {
      setExtracting(false);
    }
  };

  const toggleSkill = (index: number) => {
    setTechStacks((prev) => {
      const next = prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t));
      if (next.filter((t) => t.selected).length > MAX_SKILLS) {
        toast({ title: `Select up to ${MAX_SKILLS} skills`, variant: "destructive" });
        return prev;
      }
      return next;
    });
  };

  const addSkill = () => {
    const name = newSkill.trim();
    if (!name) return;
    if (techStacks.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setNewSkill("");
      return;
    }
    setTechStacks((prev) => [...prev, { name, selected: selectedSkills.length < MAX_SKILLS }]);
    setNewSkill("");
  };

  const startTest = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.post<{ sessionId: number; questions: Question[] }>("/api/assessment/questions", {
        skills: selectedSkills,
        difficulty,
        count: 10,
      });
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setCurrent(0);
      setAnswers({});
      setScore(null);
      setPath(null);
      setStage(Stage.Test);
    } catch (err) {
      fail("Could not generate your assessment", err);
    } finally {
      setIsLoading(false);
    }
  };

  const finishTest = async () => {
    if (sessionId === null) return;
    setIsLoading(true);
    try {
      // Grading happens on the server; the answer key is only revealed after submission.
      const { data } = await api.post<{ score: number; questions: Question[] }>(`/api/assessment/${sessionId}/submit`, {
        answers,
      });
      setQuestions(data.questions);
      setScore(data.score);
      setStage(Stage.Results);
      invalidateReadiness();
    } catch (err) {
      fail("Could not submit your answers", err);
    } finally {
      setIsLoading(false);
    }
  };

  const unanswered = questions.filter((q) => !answers[q.id]).length;

  const generatePath = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.post<LearningPath>("/api/assessment/learning-path", { session_id: sessionId });
      setPath(data);
      setStage(Stage.Path);
    } catch (err) {
      fail("Could not generate your learning path", err);
    } finally {
      setIsLoading(false);
    }
  };

  const restart = () => {
    setStage(Stage.Upload);
    setTechStacks([]);
    setCategory("");
    setPrimaryRole("");
    setDifficulty("");
    setSessionId(null);
    setQuestions([]);
    setAnswers({});
    setScore(null);
    setPath(null);
  };

  const skillBreakdown = () => {
    const by: Record<string, { correct: number; total: number }> = {};
    questions.forEach((q) => {
      const key = q.skill || "General";
      by[key] ??= { correct: 0, total: 0 };
      by[key].total += 1;
      if (answers[q.id] === q.answer) by[key].correct += 1;
    });
    return Object.entries(by);
  };

  const downloadReport = () => {
    if (!path) return;
    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;
    const paragraph = (text: string, size = 11) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(text, width - margin * 2);
      if (y + lines.length * 6 > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, margin, y);
      y += lines.length * 6 + 4;
    };
    const heading = (text: string) => {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(text, margin, y);
      y += 8;
    };

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(path.title, width / 2, y, { align: "center", maxWidth: width - margin * 2 });
    y += 14;
    autoTable(doc, {
      startY: y,
      theme: "plain",
      body: [
        ["Score", `${score}%`],
        ["Level", difficulty],
        ["Skills", selectedSkills.join(", ")],
      ],
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 30 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    heading("Summary");
    paragraph(path.summary);
    if (path.focusAreas.length) {
      heading("Focus areas");
      path.focusAreas.forEach((f) => paragraph(`• [${f.priority}] ${f.topic}: ${f.why}`));
    }
    heading("Resources");
    autoTable(doc, {
      startY: y,
      head: [["Resource", "Type", "Hours", "Link"]],
      body: path.learningPath.map((r) => [`${r.title} (${r.provider})\n${r.description}`, r.type, String(r.estimated_hours), r.link]),
      styles: { fontSize: 9, overflow: "linebreak", cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 22 }, 2: { cellWidth: 14 }, 3: { cellWidth: 64, textColor: [0, 0, 200] } },
      headStyles: { fillColor: [41, 128, 185] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    heading("Weekly plan");
    path.weeklyPlan.forEach((w) => paragraph(`Week ${w.week}: ${w.goal}\n  - ${w.activities.join("\n  - ")}`, 10));
    heading("Capstone project");
    paragraph(path.capstoneProject);
    doc.save(`skill-sphere-learning-path-${Date.now()}.pdf`);
  };

  const q = questions[current];

  return (
    <Layout>
      <div className="w-full max-w-4xl mx-auto px-2 sm:px-6 py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6">Skill Assessment</h1>

        <div className="mb-8">
          <Progress value={(stage + 1) * (100 / 6)} className="h-2" />
          <div className="flex justify-between items-center mt-4">
            {STAGES.map((item) => (
              <div key={item.label} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${stage >= item.stage ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}
                >
                  {item.icon}
                </div>
                <span className="text-xs mt-2 text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {stage === Stage.Upload && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl sm:text-2xl">Upload your resume</CardTitle>
              <CardDescription>We will detect your tech stack and build an assessment around it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUpload onFilesChange={handleResume} busy={extracting} busyLabel="Reading your resume..." />
              <div className="flex justify-center">
                <CostNote action="resume_skills" />
              </div>
            </CardContent>
            <CardFooter className="justify-center">
              <Button variant="link" onClick={() => setStage(Stage.Skills)}>
                No resume handy? Enter your skills manually
              </Button>
            </CardFooter>
          </Card>
        )}

        {stage === Stage.Skills && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl sm:text-2xl">Choose skills to assess</CardTitle>
              <CardDescription>Select up to {MAX_SKILLS} skills. Fewer skills means deeper questions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {category && (
                <Alert className="bg-blue-50">
                  <AlertTitle className="text-blue-700 flex items-center gap-2">
                    <Check className="h-4 w-4" /> Profile detected
                  </AlertTitle>
                  <AlertDescription className="text-blue-600">
                    {primaryRole ? (
                      <>
                        Looks like a <strong>{primaryRole}</strong> profile ({category}).
                      </>
                    ) : (
                      <>
                        Primary category: <strong>{category}</strong>.
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a skill, e.g. TypeScript"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSkill()}
                  maxLength={60}
                />
                <Button variant="outline" onClick={addSkill}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {techStacks.map((tech, index) => (
                  <label
                    key={tech.name}
                    htmlFor={`tech-${index}`}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <Checkbox id={`tech-${index}`} checked={tech.selected} onCheckedChange={() => toggleSkill(index)} />
                    <Cpu className="h-4 w-4 text-gray-500" />
                    <span>{tech.name}</span>
                  </label>
                ))}
              </div>
              {techStacks.length === 0 && <p className="text-center text-sm text-gray-500">Add at least one skill to continue.</p>}
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="outline" onClick={restart}>
                Back
              </Button>
              <Button onClick={() => setStage(Stage.Difficulty)} disabled={selectedSkills.length === 0}>
                Continue with {selectedSkills.length} skill{selectedSkills.length === 1 ? "" : "s"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {stage === Stage.Difficulty && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl sm:text-2xl">Select difficulty</CardTitle>
              <CardDescription>10 questions on {selectedSkills.join(", ")}.</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup className="grid grid-cols-1 sm:grid-cols-3 gap-4" value={difficulty} onValueChange={setDifficulty}>
                {[
                  ["beginner", "Beginner", "0-2 years: core concepts"],
                  ["intermediate", "Intermediate", "2-5 years: trade-offs & practice"],
                  ["advanced", "Advanced", "5+ years: internals & architecture"],
                ].map(([value, label, hint]) => (
                  <label key={value} htmlFor={value} className="flex items-start space-x-2 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                    <RadioGroupItem value={value} id={value} className="mt-1" />
                    <span>
                      <span className="font-medium block">{label}</span>
                      <span className="text-xs text-gray-500">{hint}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-3">
              <Button variant="outline" onClick={() => setStage(Stage.Skills)} disabled={isLoading}>
                Back
              </Button>
              <div className="flex items-center gap-3">
                <CostNote action="assessment_questions" />
                <Button onClick={startTest} disabled={!difficulty || isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Writing your questions...
                    </>
                  ) : (
                    "Start assessment"
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}

        {stage === Stage.Test && q && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg sm:text-xl">
                  Question {current + 1} of {questions.length}
                </CardTitle>
                <Badge variant="secondary">{q.skill}</Badge>
              </div>
              <Progress value={((current + 1) / questions.length) * 100} className="h-1" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-lg font-medium whitespace-pre-wrap">{q.question}</div>
              {q.code && (
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{q.code}</code>
                </pre>
              )}
              <RadioGroup
                value={answers[q.id] || ""}
                onValueChange={(value) => setAnswers({ ...answers, [q.id]: value })}
                className="space-y-3"
              >
                {Object.entries(q.options).map(([key, value]) => (
                  <label
                    key={key}
                    htmlFor={`q${q.id}-${key}`}
                    className="flex items-start space-x-3 border p-3 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <RadioGroupItem value={key} id={`q${q.id}-${key}`} className="mt-0.5" />
                    <span>
                      <strong className="mr-2">{key}.</strong>
                      {value}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-4">
              <Button variant="outline" onClick={() => setCurrent(current - 1)} disabled={current === 0}>
                Previous
              </Button>
              {current < questions.length - 1 ? (
                <Button onClick={() => setCurrent(current + 1)}>Next</Button>
              ) : (
                <Button onClick={finishTest} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {unanswered > 0 ? `Finish (${unanswered} unanswered)` : "Finish"}
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {stage === Stage.Results && score !== null && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-xl sm:text-2xl">Assessment results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className={`text-5xl sm:text-6xl font-bold ${score >= 70 ? "text-green-600" : score >= 40 ? "text-amber-500" : "text-red-500"}`}>
                    {score}%
                  </div>
                  <p className="text-gray-600 mt-2">
                    {questions.filter((x) => answers[x.id] === x.answer).length} of {questions.length} correct at{" "}
                    {difficulty} level
                  </p>
                </div>
                <div className="space-y-3">
                  {skillBreakdown().map(([skill, s]) => (
                    <div key={skill}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{skill}</span>
                        <span>
                          {s.correct}/{s.total}
                        </span>
                      </div>
                      <Progress value={(s.correct / s.total) * 100} className="h-2" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button onClick={restart} variant="outline">
                    Take another assessment
                  </Button>
                  <Button onClick={generatePath} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
                    {isLoading ? "Building your plan..." : "Get my learning path"}
                  </Button>
                </div>
                <div className="text-right">
                  <CostNote action="learning_path" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review your answers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((item, i) => {
                  const ok = answers[item.id] === item.answer;
                  return (
                    <div key={item.id} className={`border-l-4 pl-4 py-2 ${ok ? "border-green-500" : "border-red-500"}`}>
                      <p className="font-medium flex items-start gap-2">
                        {ok ? <Check className="h-4 w-4 text-green-600 mt-1 shrink-0" /> : <X className="h-4 w-4 text-red-600 mt-1 shrink-0" />}
                        <span>
                          {i + 1}. {item.question}
                        </span>
                      </p>
                      {!ok && (
                        <p className="text-sm text-red-700 mt-1">
                          Your answer: {answers[item.id] ? `${answers[item.id]}. ${item.options[answers[item.id]]}` : "not answered"}
                        </p>
                      )}
                      <p className="text-sm text-green-700">
                        Correct: {item.answer}. {item.options[item.answer]}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{item.explanation}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {stage === Stage.Path && path && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl">{path.title}</CardTitle>
                <CardDescription className="text-base text-gray-700">{path.summary}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Focus areas</h3>
                  <ul className="space-y-2">
                    {path.focusAreas.map((f) => (
                      <li key={f.topic} className="text-sm">
                        <Badge variant={f.priority === "high" ? "destructive" : "secondary"} className="mr-2">
                          {f.priority}
                        </Badge>
                        <strong>{f.topic}</strong>: {f.why}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Strengths</h3>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {path.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {path.learningPath.map((r, i) => (
                <Card key={i} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap gap-2 mb-1">
                      <Badge variant="secondary">{r.type}</Badge>
                      <Badge variant="outline">{r.free ? "Free" : "Paid"}</Badge>
                      <Badge variant="outline">~{r.estimated_hours}h</Badge>
                    </div>
                    <CardTitle className="text-base">{r.title}</CardTitle>
                    <CardDescription>{r.provider}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow text-sm text-gray-600">{r.description}</CardContent>
                  <CardFooter>
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                      {r.link_verified ? <ArrowRight className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                      {r.link_verified ? "Open resource" : "Find this resource"}
                    </a>
                  </CardFooter>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your week-by-week plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {path.weeklyPlan.map((w) => (
                  <div key={w.week}>
                    <h4 className="font-medium">
                      Week {w.week}: {w.goal}
                    </h4>
                    <ul className="list-disc pl-5 text-sm text-gray-600">
                      {w.activities.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <Alert>
                  <Target className="h-4 w-4" />
                  <AlertTitle>Capstone project</AlertTitle>
                  <AlertDescription>{path.capstoneProject}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button onClick={downloadReport} variant="outline">
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
              <Button onClick={() => setStage(Stage.Results)} variant="outline">
                Back to results
              </Button>
              <Button onClick={restart}>Start new assessment</Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SkillAssessment;
