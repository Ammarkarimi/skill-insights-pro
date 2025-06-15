import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckSquare, AlertTriangle, FileText, BookOpen, MessageSquare, Upload, Highlighter } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

const ResumeTips: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysis, setAnalysis] = useState<null | {
    text: string;
    suggestions: Array<{
      startIndex: number;
      endIndex: number;
      original: string;
      suggestion: string;
      reason: string;
    }>
  }>(null);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (file.type === 'application/pdf' || file.type.includes('document')) {
        setSelectedFile(file);
        setError("");
      } else {
        setError("Please upload a PDF or Word document (.doc, .docx)");
      }
    }
  };

  const handleAnalyzeResume = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = prev + Math.random() * 15;
        return newProgress >= 90 ? 90 : newProgress;
      });
    }, 300);
    
    try {
      // Create FormData for the file upload
      const formData = new FormData();
      formData.append('resume', selectedFile);
      
      // Call your backend API endpoint
      const response = await fetch('http://localhost:5000/api/analyze-resume', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        throw new Error('Resume analysis failed');
      }
      
      const data = await response.json();
      setUploadProgress(100);
      
      // Handle the analysis data
      setTimeout(() => {
        setAnalysis(data);
        setIsUploading(false);
      }, 500);
      
    } catch (err) {
      clearInterval(progressInterval);
      setError("Error analyzing resume. Please try again.");
      setIsUploading(false);
    }
  };

  const ResumeText = () => {
    if (!analysis) return null;
    
    // Create a component that highlights the issues in the text
    const text = analysis.text;
    const segments = [];
    let lastIndex = 0;
    
    // Sort suggestions by startIndex to process them in order
    const sortedSuggestions = [...analysis.suggestions].sort((a, b) => a.startIndex - b.startIndex);
    
    sortedSuggestions.forEach((suggestion, index) => {
      // Add text before the current suggestion
      if (suggestion.startIndex > lastIndex) {
        segments.push(
          <span key={`text-${index}`}>
            {text.substring(lastIndex, suggestion.startIndex)}
          </span>
        );
      }
      
      // Add the highlighted suggestion
      segments.push(
        <span 
          key={`highlight-${index}`}
          className="bg-yellow-100 hover:bg-yellow-200 cursor-pointer relative group"
          title={suggestion.reason}
        >
          {text.substring(suggestion.startIndex, suggestion.endIndex)}
          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-white border border-gray-200 shadow-lg rounded-md p-3 w-64 z-10">
            <p className="font-medium text-red-600 line-through mb-1">{suggestion.original}</p>
            <p className="font-medium text-green-600 mb-1">{suggestion.suggestion}</p>
            <p className="text-xs text-gray-600">{suggestion.reason}</p>
          </div>
        </span>
      );
      
      lastIndex = suggestion.endIndex;
    });
    
    // Add any remaining text
    if (lastIndex < text.length) {
      segments.push(
        <span key="text-end">
          {text.substring(lastIndex)}
        </span>
      );
    }
    
    return <div className="whitespace-pre-wrap">{segments}</div>;
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="page-header">Resume & Interview Tips</h1>
        
        <Tabs defaultValue="resume" className="mb-6">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="resume" className="flex-1">Resume Tips</TabsTrigger>
            <TabsTrigger value="interview" className="flex-1">Interview Preparation</TabsTrigger>
            <TabsTrigger value="analyzer" className="flex-1">Resume Analyzer</TabsTrigger>
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
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Highlighter className="h-5 w-5 text-primary" />
                    Resume Analyzer
                  </CardTitle>
                  <CardDescription>
                    Upload your resume for personalized feedback and suggestions to improve your chances of getting interviews.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <div className="space-y-3">
                        <Upload className="h-10 w-10 text-gray-400 mx-auto" />
                        <h3 className="text-lg font-medium">Upload your resume</h3>
                        <p className="text-sm text-gray-500">
                          PDF or Word documents (.doc, .docx) accepted
                        </p>
                        
                        <div className="flex justify-center mt-4">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              onChange={handleFileChange}
                            />
                            <div className="bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-md transition">
                              Select File
                            </div>
                          </label>
                        </div>
                        
                        {selectedFile && (
                          <div className="text-sm mt-2">
                            Selected: <span className="font-medium">{selectedFile.name}</span>
                          </div>
                        )}
                        
                        {error && (
                          <Alert variant="destructive" className="mt-4">
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                    
                    {selectedFile && !isUploading && !analysis && (
                      <div className="flex justify-center">
                        <Button 
                          onClick={handleAnalyzeResume}
                          className="bg-primary hover:bg-primary/90 text-white"
                        >
                          Analyze Resume
                        </Button>
                      </div>
                    )}
                    
                    {isUploading && (
                      <div className="space-y-3">
                        <Progress value={uploadProgress} className="h-2" />
                        <div className="text-center text-sm text-gray-600">
                          {uploadProgress < 100 ? "Analyzing your resume..." : "Analysis complete!"}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {analysis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Analysis Results
                    </CardTitle>
                    <CardDescription>
                      We found {analysis.suggestions.length} suggestions to improve your resume. Hover over the highlighted text for detailed feedback.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 className="font-medium text-gray-800 mb-4">Your Resume Content</h3>
                      <div className="text-gray-700 text-sm leading-relaxed">
                        <ResumeText />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-800 mb-3">Summary of Suggestions</h3>
                      <ul className="space-y-3">
                        {analysis.suggestions.map((suggestion, index) => (
                          <li key={index} className="bg-gray-50 p-3 rounded-md border-l-4 border-amber-500">
                            <p className="font-medium text-gray-800 mb-1">
                              Change: <span className="text-red-600">{suggestion.original}</span> to <span className="text-green-600">{suggestion.suggestion}</span>
                            </p>
                            <p className="text-sm text-gray-600">{suggestion.reason}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <div className="flex flex-col sm:flex-row sm:justify-between w-full gap-4">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setAnalysis(null);
                          setSelectedFile(null);
                        }}
                      >
                        Upload a Different Resume
                      </Button>
                      <Button className="bg-primary hover:bg-primary/90 text-white">
                        Download Suggestions as PDF
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              )}
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    How Our Resume Analyzer Works
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal pl-5 space-y-3">
                    <li className="text-gray-700">
                      <strong>Content Extraction:</strong> We parse your resume to extract text while preserving formatting.
                    </li>
                    <li className="text-gray-700">
                      <strong>Language Analysis:</strong> We analyze your word choice, sentence structure, and phrasing to identify improvement opportunities.
                    </li>
                    <li className="text-gray-700">
                      <strong>ATS Optimization:</strong> We check if your resume follows best practices for Applicant Tracking Systems.
                    </li>
                    <li className="text-gray-700">
                      <strong>Industry-Specific Review:</strong> We apply industry-specific standards to ensure your resume meets expectations for your field.
                    </li>
                    <li className="text-gray-700">
                      <strong>Targeted Feedback:</strong> We highlight specific words and phrases that could be improved, with detailed explanations.
                    </li>
                  </ol>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ResumeTips;