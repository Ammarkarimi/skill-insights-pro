import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import FileUpload from "@/components/FileUpload";
import CostNote from "@/components/CostNote";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckSquare, AlertTriangle, FileText, BookOpen, MessageSquare, Highlighter, Loader2, Download, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { jsPDF } from "jspdf";
import { fetchReadiness, invalidateReadiness, TargetRole } from "@/lib/readiness";
import { Checkbox } from "@/components/ui/checkbox";

interface Suggestion {
  startIndex: number;
  endIndex: number;
  original: string;
  suggestion: string;
  reason: string;
  category: string;
  severity: "high" | "medium" | "low";
}

interface Analysis {
  text: string;
  overall_score: number;
  headline: string;
  summary: string;
  strengths: string[];
  scores: Record<string, { score: number; justification: string }>;
  missing_sections: string[];
  keywords_to_add: string[];
  suggestions: Suggestion[];
}

const SCORE_LABELS: Record<string, string> = {
  word_choice: "Word choice",
  grammar: "Grammar & spelling",
  structure: "Structure & formatting",
  content_relevance: "Content relevance",
  ats_compatibility: "ATS compatibility",
};

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-red-100 hover:bg-red-200 border-b-2 border-red-400",
  medium: "bg-amber-100 hover:bg-amber-200 border-b-2 border-amber-400",
  low: "bg-blue-50 hover:bg-blue-100 border-b-2 border-blue-300",
};

const scoreColor = (s: number) => (s >= 75 ? "text-green-600" : s >= 55 ? "text-amber-500" : "text-red-500");

const ResumeTips: React.FC = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [searchParams] = useSearchParams();
  const [target, setTarget] = useState<TargetRole | null>(null);
  const [useTarget, setUseTarget] = useState(searchParams.get("useTarget") === "1");

  useEffect(() => {
    fetchReadiness()
      .then((r) => setTarget(r.target))
      .catch(() => undefined);
  }, []);
  const forTarget = useTarget && target !== null;

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const form = new FormData();
      form.append("resume", file);
      form.append("target_role", targetRole);
      form.append("job_description", jobDescription);
      form.append("use_target", forTarget ? "true" : "false");
      const { data } = await api.post<Analysis>("/api/resume/analyze", form);
      setAnalysis(data);
      if (forTarget) invalidateReadiness();
    } catch (err) {
      if (!isInsufficientCredits(err)) {
        toast({ title: "Analysis failed", description: apiErrorMessage(err), variant: "destructive" });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: "Copied to clipboard" }));
  };

  const scrollTo = (index: number) =>
    document.getElementById(`suggestion-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  const HighlightedText = ({ data }: { data: Analysis }) => {
    const segments: React.ReactNode[] = [];
    let last = 0;
    data.suggestions.forEach((s, i) => {
      if (s.startIndex < 0 || s.startIndex < last) return;
      if (s.startIndex > last) segments.push(<span key={`t${i}`}>{data.text.slice(last, s.startIndex)}</span>);
      segments.push(
        <mark
          key={`h${i}`}
          className={`cursor-pointer rounded-sm px-0.5 text-inherit ${SEVERITY_STYLE[s.severity] ?? SEVERITY_STYLE.low}`}
          title={`${s.reason}\n\nSuggested: ${s.suggestion}`}
          onClick={() => scrollTo(i)}
        >
          {data.text.slice(s.startIndex, s.endIndex)}
          <sup className="ml-0.5 font-bold text-[10px]">{i + 1}</sup>
        </mark>,
      );
      last = s.endIndex;
    });
    if (last < data.text.length) segments.push(<span key="end">{data.text.slice(last)}</span>);
    return <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed">{segments}</div>;
  };

  const downloadReport = () => {
    if (!analysis) return;
    const doc = new jsPDF();
    const width = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;
    const write = (text: string, size = 10, bold = false) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, width - margin * 2);
      for (const line of lines) {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += size * 0.5;
      }
      y += 2;
    };
    write("Resume Analysis Report", 18, true);
    write(`Overall score: ${analysis.overall_score}/100: ${analysis.headline}`, 12, true);
    write(analysis.summary);
    y += 2;
    write("Category scores", 13, true);
    Object.entries(analysis.scores).forEach(([k, v]) => write(`${SCORE_LABELS[k] ?? k}: ${v.score}/100. ${v.justification}`));
    write("Strengths", 13, true);
    analysis.strengths.forEach((s) => write(`• ${s}`));
    if (analysis.keywords_to_add.length) {
      write("Keywords to add", 13, true);
      write(analysis.keywords_to_add.join(", "));
    }
    if (analysis.missing_sections.length) {
      write("Missing sections", 13, true);
      write(analysis.missing_sections.join(", "));
    }
    write("Suggested edits", 13, true);
    analysis.suggestions.forEach((s, i) => {
      write(`${i + 1}. [${s.severity.toUpperCase()} · ${s.category}]`, 10, true);
      write(`Original: ${s.original}`);
      write(`Suggested: ${s.suggestion}`);
      write(`Why: ${s.reason}`);
      y += 2;
    });
    doc.save(`resume-analysis-${Date.now()}.pdf`);
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <h1 className="page-header">Resume Analyzer & Tips</h1>

        <Tabs defaultValue="analyzer" className="mb-6">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="analyzer" className="flex-1">Resume Analyzer</TabsTrigger>
            <TabsTrigger value="resume" className="flex-1">Resume Tips</TabsTrigger>
            <TabsTrigger value="interview" className="flex-1">Interview Prep</TabsTrigger>
          </TabsList>

          <TabsContent value="resume">
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Resume Best Practices
                  </CardTitle>
                  <CardDescription>
                    Follow these guidelines to create an effective, impactful resume that stands out to recruiters and passes through ATS systems.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-green-600" />
                          <span>Optimize for ATS Systems</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600">
                        <ul className="list-disc pl-5 space-y-2">
                          <li>Use standard section headings (Education, Experience, Skills)</li>
                          <li>Include keywords from the job description</li>
                          <li>Use a clean, single-column layout</li>
                          <li>Submit in PDF format to preserve formatting</li>
                          <li>Avoid headers, footers, and text boxes which may not be properly parsed</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-2">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-green-600" />
                          <span>Highlight Relevant Skills</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600">
                        <ul className="list-disc pl-5 space-y-2">
                          <li>Include a dedicated skills section with technical and soft skills</li>
                          <li>Prioritize skills mentioned in the job description</li>
                          <li>Use industry-standard terminology and avoid obscure acronyms</li>
                          <li>Categorize skills by proficiency or type (programming languages, frameworks, tools)</li>
                          <li>Update your skills section for each job application to match requirements</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-3">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-green-600" />
                          <span>Quantify Achievements</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600">
                        <ul className="list-disc pl-5 space-y-2">
                          <li>Use metrics and percentages to demonstrate impact (e.g., "Reduced load time by 40%")</li>
                          <li>Include project outcomes, not just responsibilities</li>
                          <li>Mention team size for collaborative projects</li>
                          <li>Include timeframes to show efficiency</li>
                          <li>Highlight cost savings or revenue increases when applicable</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-4">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span>Common Resume Mistakes to Avoid</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600">
                        <ul className="list-disc pl-5 space-y-2">
                          <li>Generic objectives or summaries that don't match the position</li>
                          <li>Spelling and grammatical errors</li>
                          <li>Including personal information like age or marital status</li>
                          <li>Using an unprofessional email address</li>
                          <li>Cluttered design with excessive formatting</li>
                          <li>Including outdated or irrelevant experience</li>
                          <li>Missing contact information or broken links</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-5">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-blue-600" />
                          <span>Technical Resume Format</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600">
                        <p className="mb-3">For technical roles, consider this structure:</p>
                        <ol className="list-decimal pl-5 space-y-2">
                          <li><strong>Header:</strong> Name, contact info, LinkedIn, GitHub/portfolio link</li>
                          <li><strong>Summary:</strong> 2-3 sentences highlighting your expertise and career focus</li>
                          <li><strong>Skills:</strong> Categorized technical skills (languages, frameworks, tools, methodologies)</li>
                          <li><strong>Experience:</strong> Relevant positions with accomplishments and technical details</li>
                          <li><strong>Projects:</strong> Personal or academic projects with technologies used and outcomes</li>
                          <li><strong>Education:</strong> Degrees, certifications, and relevant coursework</li>
                          <li><strong>Additional:</strong> Conferences, publications, or open-source contributions</li>
                        </ol>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Resume Action Verbs
                  </CardTitle>
                  <CardDescription>
                    Use these powerful action verbs to strengthen your resume and demonstrate your skills and accomplishments.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <h3 className="font-semibold mb-2 text-gray-800">Development</h3>
                      <ul className="text-gray-600 space-y-1">
                        <li>Developed</li>
                        <li>Engineered</li>
                        <li>Programmed</li>
                        <li>Implemented</li>
                        <li>Architected</li>
                        <li>Designed</li>
                        <li>Created</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2 text-gray-800">Improvement</h3>
                      <ul className="text-gray-600 space-y-1">
                        <li>Optimized</li>
                        <li>Enhanced</li>
                        <li>Streamlined</li>
                        <li>Accelerated</li>
                        <li>Increased</li>
                        <li>Improved</li>
                        <li>Upgraded</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2 text-gray-800">Leadership</h3>
                      <ul className="text-gray-600 space-y-1">
                        <li>Led</li>
                        <li>Managed</li>
                        <li>Coordinated</li>
                        <li>Supervised</li>
                        <li>Guided</li>
                        <li>Directed</li>
                        <li>Spearheaded</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2 text-gray-800">Analysis</h3>
                      <ul className="text-gray-600 space-y-1">
                        <li>Analyzed</li>
                        <li>Evaluated</li>
                        <li>Assessed</li>
                        <li>Researched</li>
                        <li>Identified</li>
                        <li>Diagnosed</li>
                        <li>Investigated</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="interview">
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Technical Interview Preparation
                  </CardTitle>
                  <CardDescription>
                    Strategies to prepare for and excel in technical interviews across different formats.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-green-600" />
                          <span>Before the Interview</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600">
                        <ul className="list-disc pl-5 space-y-2">
                          <li>Research the company, their products, and tech stack</li>
                          <li>Review the job description and prepare examples of relevant experience</li>
                          <li>Practice common coding problems on platforms like LeetCode or HackerRank</li>
                          <li>Prepare your "tell me about yourself" response focused on technical background</li>
                          <li>Review your own projects and be prepared to discuss technical decisions</li>
                          <li>Set up your environment for remote technical interviews (camera, microphone, coding environment)</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-2">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-green-600" />
                          <span>Coding Interview Strategies</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600">
                        <ol className="list-decimal pl-5 space-y-2">
                          <li><strong>Clarify the problem:</strong> Ask questions to ensure you understand requirements</li>
                          <li><strong>Think out loud:</strong> Share your thought process as you work</li>
                          <li><strong>Start with a simple approach:</strong> Get a working solution before optimizing</li>
                          <li><strong>Test your code:</strong> Walk through examples step by step</li>
                          <li><strong>Analyze complexity:</strong> Discuss time and space complexity</li>
                          <li><strong>Consider edge cases:</strong> Empty inputs, maximum values, error conditions</li>
                          <li><strong>Be receptive to hints:</strong> Interviewers often guide you toward the solution</li>
                        </ol>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-3">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-green-600" />
                          <span>System Design Interviews</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600">
                        <ol className="list-decimal pl-5 space-y-2">
                          <li><strong>Understand requirements:</strong> Clarify functional and non-functional requirements</li>
                          <li><strong>Establish constraints:</strong> Discuss scale, traffic, data volume, and latency expectations</li>
                          <li><strong>High-level design:</strong> Start with major components and their interactions</li>
                          <li><strong>Data model:</strong> Outline schema and relationships</li>
                          <li><strong>Detailed design:</strong> Dive deeper into specific components</li>
                          <li><strong>Bottlenecks:</strong> Identify potential issues and propose solutions</li>
                          <li><strong>Trade-offs:</strong> Discuss pros and cons of your design choices</li>
                        </ol>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-4">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span>Interview Pitfalls to Avoid</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600">
                        <ul className="list-disc pl-5 space-y-2">
                          <li>Jumping into coding without understanding the problem</li>
                          <li>Staying silent for long periods without communicating your thoughts</li>
                          <li>Getting defensive when receiving feedback</li>
                          <li>Claiming knowledge in areas where you're not proficient</li>
                          <li>Focusing only on the solution without explaining your reasoning</li>
                          <li>Giving up too easily when facing challenges</li>
                          <li>Not asking clarifying questions when needed</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="item-5">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-blue-600" />
                          <span>Behavioral Interview Questions</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600">
                        <p className="mb-3">Use the STAR method (Situation, Task, Action, Result) for these common questions:</p>
                        <ul className="list-disc pl-5 space-y-2">
                          <li>"Tell me about a challenging project you worked on."</li>
                          <li>"Describe a time when you had to debug a complex issue."</li>
                          <li>"How have you handled disagreements with team members?"</li>
                          <li>"Give an example of how you've met a tight deadline."</li>
                          <li>"Describe a situation where you had to learn a new technology quickly."</li>
                          <li>"How do you prioritize your work when handling multiple tasks?"</li>
                          <li>"Tell me about a time you received constructive feedback."</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Questions to Ask the Interviewer
                  </CardTitle>
                  <CardDescription>
                    Thoughtful questions demonstrate your interest in the role and help you evaluate if the position is right for you.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-3 text-gray-800">About the Role & Team</h3>
                      <ul className="text-gray-600 space-y-2">
                        <li>"What does a typical day look like in this role?"</li>
                        <li>"How is the team structured? Who would I be working with directly?"</li>
                        <li>"What are the biggest challenges the team is currently facing?"</li>
                        <li>"What technologies does the team use regularly?"</li>
                        <li>"How do you measure success in this position?"</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-3 text-gray-800">Engineering Culture & Growth</h3>
                      <ul className="text-gray-600 space-y-2">
                        <li>"How does the team handle code reviews and quality assurance?"</li>
                        <li>"What learning and development opportunities are available?"</li>
                        <li>"How do you approach technical debt and refactoring?"</li>
                        <li>"Can you tell me about the company's approach to work-life balance?"</li>
                        <li>"What has been your experience with growth at the company?"</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="analyzer">
            <div className="space-y-6">
              {!analysis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Highlighter className="h-5 w-5 text-primary" />
                      Get a recruiter-grade review of your resume
                    </CardTitle>
                    <CardDescription>
                      Scores across five categories, line-by-line rewrites and the keywords you are missing. Add a
                      target role or job description for tailored feedback.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FileUpload onFilesChange={(files) => setFile(files[0] ?? null)} busy={isAnalyzing} busyLabel="Analysing your resume. This takes about 30 seconds..." />
                    {target && (
                      <label className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 cursor-pointer">
                        <Checkbox checked={useTarget} onCheckedChange={(v) => setUseTarget(v === true)} className="mt-0.5" />
                        <span className="text-sm">
                          <span className="font-medium">Analyse for my target role: {target.title}</span>
                          <span className="block text-gray-600">
                            Uses its job description unless you paste one below, and counts towards your readiness score.
                          </span>
                        </span>
                      </label>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="target-role">Target role (optional)</Label>
                        <Input
                          id="target-role"
                          placeholder={forTarget ? target.title : "e.g. Senior Frontend Engineer"}
                          value={targetRole}
                          maxLength={120}
                          onChange={(e) => setTargetRole(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 md:row-span-2">
                        <Label htmlFor="jd">Job description (optional)</Label>
                        <Textarea
                          id="jd"
                          placeholder={forTarget ? "Leave empty to use your target role's job description" : "Paste a job posting to tailor the feedback"}
                          className="min-h-[96px]"
                          value={jobDescription}
                          maxLength={12000}
                          onChange={(e) => setJobDescription(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex items-center justify-end gap-3">
                    <CostNote action="resume_analysis" />
                    <Button onClick={handleAnalyze} disabled={!file || isAnalyzing}>
                      {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      {isAnalyzing ? "Analysing..." : "Analyse resume"}
                    </Button>
                  </CardFooter>
                </Card>
              )}

              {analysis && (
                <>
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                        <div>
                          <CardTitle className="text-xl">{analysis.headline}</CardTitle>
                          <CardDescription className="text-base text-gray-700 mt-2">{analysis.summary}</CardDescription>
                        </div>
                        <div className="text-center shrink-0">
                          <div className={`text-5xl font-bold ${scoreColor(analysis.overall_score)}`}>{analysis.overall_score}</div>
                          <div className="text-xs text-gray-500">overall / 100</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        {Object.entries(analysis.scores).map(([key, value]) => (
                          <div key={key}>
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{SCORE_LABELS[key] ?? key}</span>
                              <span className={scoreColor(value.score)}>{value.score}</span>
                            </div>
                            <Progress value={value.score} className="h-2 my-1" />
                            <p className="text-xs text-gray-500">{value.justification}</p>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold text-sm mb-2">Strengths</h3>
                          <ul className="list-disc pl-5 text-sm space-y-1">
                            {analysis.strengths.map((s) => (
                              <li key={s}>{s}</li>
                            ))}
                          </ul>
                        </div>
                        {analysis.keywords_to_add.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-sm mb-2">Keywords to add</h3>
                            <div className="flex flex-wrap gap-2">
                              {analysis.keywords_to_add.map((k) => (
                                <Badge key={k} variant="secondary">
                                  {k}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {analysis.missing_sections.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-sm mb-2">Missing sections</h3>
                            <div className="flex flex-wrap gap-2">
                              {analysis.missing_sections.map((k) => (
                                <Badge key={k} variant="outline">
                                  {k}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" /> Your resume
                        </CardTitle>
                        <CardDescription>
                          Highlighted text has a numbered suggestion. Click a highlight to jump to it.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="max-h-[700px] overflow-y-auto border-t pt-4">
                        <HighlightedText data={analysis} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{analysis.suggestions.length} suggested edits</CardTitle>
                        <CardDescription>Ordered by position in your resume. Red means high impact.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 max-h-[700px] overflow-y-auto border-t pt-4">
                        {analysis.suggestions.map((s, i) => (
                          <div
                            id={`suggestion-${i}`}
                            key={i}
                            className={`p-3 rounded-md border-l-4 bg-gray-50 ${s.severity === "high" ? "border-red-500" : s.severity === "medium" ? "border-amber-500" : "border-blue-400"}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold">
                                #{i + 1} · {s.category.replace("_", " ")} · {s.severity}
                              </span>
                              <Button size="sm" variant="ghost" onClick={() => copy(s.suggestion)} title="Copy suggestion">
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-sm text-red-700 line-through decoration-red-300">{s.original}</p>
                            <p className="text-sm text-green-700 font-medium mt-1">{s.suggestion}</p>
                            <p className="text-xs text-gray-600 mt-2">{s.reason}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAnalysis(null);
                        setFile(null);
                      }}
                    >
                      Analyse another resume
                    </Button>
                    <Button onClick={downloadReport}>
                      <Download className="mr-2 h-4 w-4" /> Download report (PDF)
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ResumeTips;
