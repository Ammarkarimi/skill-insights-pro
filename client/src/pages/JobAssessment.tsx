import React, { useState } from "react";
import Layout from "@/components/Layout";
import FileUpload from "@/components/FileUpload";
import CostNote from "@/components/CostNote";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, BookOpen, CheckCircle2, CircleDashed, XCircle, Search, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";

interface Resource {
  title: string;
  type: string;
  provider: string;
  link: string;
  description: string;
  link_verified?: boolean;
}

interface MatchResult {
  resume: string;
  candidate_name: string;
  email: string;
  match_percentage: number;
  verdict: "strong_fit" | "good_fit" | "potential_fit" | "weak_fit";
  summary: string;
  requirements: { requirement: string; status: "met" | "partial" | "missing"; evidence: string }[];
  strengths: string[];
  weaknesses: string[];
  missing_keywords: string[];
  interview_questions: string[];
  learning_path: { title: string; description: string; resources: Resource[] };
}

const VERDICT: Record<MatchResult["verdict"], { label: string; className: string }> = {
  strong_fit: { label: "Strong fit", className: "bg-green-600" },
  good_fit: { label: "Good fit", className: "bg-green-500" },
  potential_fit: { label: "Potential fit", className: "bg-yellow-500" },
  weak_fit: { label: "Gap to fill", className: "bg-red-500" },
};

const REQ_ICON = {
  met: <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />,
  partial: <CircleDashed className="h-4 w-4 text-amber-500 shrink-0" />,
  missing: <XCircle className="h-4 w-4 text-red-500 shrink-0" />,
};

const JobAssessment: React.FC = () => {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [selected, setSelected] = useState<MatchResult | null>(null);

  const analyze = async () => {
    if (files.length === 0) {
      toast({ title: "Upload at least one resume", variant: "destructive" });
      setActiveTab("upload");
      return;
    }
    if (jobDescription.trim().length < 50) {
      toast({ title: "Job description too short", description: "Paste the full job posting (at least 50 characters).", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("resumes", f));
      form.append("job_description", jobDescription);
      const { data } = await api.post<{ results: MatchResult[]; failed: string[] }>("/api/job-match/analyze", form);
      setResults(data.results);
      setSelected(null);
      setActiveTab("results");
      if (data.failed.length) {
        toast({
          title: "Some resumes could not be analysed",
          description: `${data.failed.join(", ")}. You were not charged for these.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      if (!isInsufficientCredits(err)) {
        toast({ title: "Analysis failed", description: apiErrorMessage(err), variant: "destructive" });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Resumes are never stored on the server; view the local copy instead.
  const viewResume = (name: string) => {
    const file = files.find((f) => f.name === name);
    if (!file) return;
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <h1 className="page-header">Job Match</h1>
        <p className="text-gray-600 -mt-4 mb-6">
          See how well one or more resumes fit a job: requirement by requirement, with gaps and a plan to close them.
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="upload" className="flex-1">1. Resumes</TabsTrigger>
            <TabsTrigger value="job" className="flex-1">2. Job description</TabsTrigger>
            <TabsTrigger value="results" className="flex-1" disabled={results.length === 0}>3. Results</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload resumes</CardTitle>
                <CardDescription>
                  Compare versions of your own resume, or rank candidates. Files are analysed in memory and never stored.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload onFilesChange={setFiles} multiple maxFiles={10} />
              </CardContent>
              <CardFooter>
                <Button onClick={() => setActiveTab("job")} disabled={files.length === 0}>
                  Continue to job description
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="job">
            <Card>
              <CardHeader>
                <CardTitle>Paste the job description</CardTitle>
                <CardDescription>Include responsibilities and requirements for the most accurate match.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Paste the complete job description here..."
                  value={jobDescription}
                  maxLength={12000}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="min-h-[300px]"
                />
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row justify-between gap-3">
                <Button variant="outline" onClick={() => setActiveTab("upload")}>
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  <CostNote action="job_match_per_resume" quantity={Math.max(1, files.length)} />
                  <Button onClick={analyze} disabled={isAnalyzing}>
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analysing {files.length} resume{files.length === 1 ? "" : "s"}...
                      </>
                    ) : (
                      "Analyse match"
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            {!selected ? (
              <Card>
                <CardHeader>
                  <CardTitle>Ranked results</CardTitle>
                  <CardDescription>Ranked by overall fit with the job's must-have requirements.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Resume</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r, i) => (
                        <TableRow key={r.resume}>
                          <TableCell className="font-medium">{i + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{r.candidate_name || r.resume}</div>
                            <div className="text-xs text-gray-500">{r.candidate_name ? r.resume : ""} {r.email}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[220px]">
                              <Progress value={r.match_percentage} className="h-2 w-24" />
                              <span className="text-sm w-10">{r.match_percentage}%</span>
                              <Badge className={VERDICT[r.verdict].className}>{VERDICT[r.verdict].label}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => viewResume(r.resume)}>
                                <FileText className="h-4 w-4 mr-1" /> View
                              </Button>
                              <Button size="sm" onClick={() => setSelected(r)}>
                                <BookOpen className="h-4 w-4 mr-1" /> Details
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => setActiveTab("job")}>
                    Edit job description
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div>
                        <CardTitle>{selected.candidate_name || selected.resume}</CardTitle>
                        <CardDescription className="text-base text-gray-700 mt-2">{selected.summary}</CardDescription>
                      </div>
                      <div className="text-center shrink-0">
                        <div className="text-4xl font-bold text-primary">{selected.match_percentage}%</div>
                        <Badge className={VERDICT[selected.verdict].className}>{VERDICT[selected.verdict].label}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-3">Requirements check</h3>
                      <ul className="space-y-2">
                        {selected.requirements.map((req) => (
                          <li key={req.requirement} className="flex gap-2 text-sm">
                            {REQ_ICON[req.status]}
                            <span>
                              <strong>{req.requirement}</strong>: <span className="text-gray-600">{req.evidence}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Strengths</h4>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {selected.strengths.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Gaps</h4>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {selected.weaknesses.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {selected.missing_keywords.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Missing keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {selected.missing_keywords.map((k) => (
                            <Badge key={k} variant="outline">
                              {k}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Questions to prepare for</h4>
                      <ol className="list-decimal pl-5 text-sm space-y-1">
                        {selected.interview_questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ol>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{selected.learning_path.title}</CardTitle>
                    <CardDescription>{selected.learning_path.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selected.learning_path.resources.map((r) => (
                      <div key={r.title} className="border rounded-lg p-4 flex flex-col sm:flex-row justify-between gap-3">
                        <div>
                          <h4 className="font-medium">{r.title}</h4>
                          <p className="text-xs text-gray-500">
                            {r.type} · {r.provider}
                          </p>
                          <p className="text-sm mt-1">{r.description}</p>
                        </div>
                        <Button size="sm" variant="outline" className="shrink-0" onClick={() => window.open(r.link, "_blank", "noopener")}>
                          {r.link_verified === false ? <Search className="h-4 w-4 mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />}
                          {r.link_verified === false ? "Find it" : "Open"}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Alert>
                  <AlertTitle>Tip</AlertTitle>
                  <AlertDescription>
                    Use the Resume Analyzer with this job description to get line-by-line rewrites that close these gaps.
                  </AlertDescription>
                </Alert>

                <Button variant="outline" onClick={() => setSelected(null)}>
                  Back to results
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default JobAssessment;
