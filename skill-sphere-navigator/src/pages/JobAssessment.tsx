import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import FileUpload from '@/components/FileUpload';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Mail, FileText, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ResumeMatch {
  resume: string;
  similarity_score: number;
  email: string;
  strengths?: string[];
  weaknesses?: string[];
  learning_path?: LearningPath;
}

interface LearningPath {
  title: string;
  description: string;
  resources: LearningResource[];
}

interface LearningResource {
  title: string;
  type: string;
  link: string;
  description: string;
}

const JobAssessment: React.FC = () => {
  const [jobDescription, setJobDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matches, setMatches] = useState<ResumeMatch[]>([]);
  const [hasResults, setHasResults] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedFiles, setUploadedFiles] = useState<FileList | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<ResumeMatch | null>(null);
  const { toast } = useToast();
  

  // Update active tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleResumeUpload = (files: FileList) => {
    setIsUploading(true);
    setUploadedFiles(files);
    
    // Create FormData to send files to backend
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('resumes', file);
    });
    
    // Upload to backend API
    fetch('http://localhost:5000/upload_resumes_job', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      setIsUploading(false);
      toast({
        title: "Resumes Uploaded",
        description: `${files.length} resumes have been uploaded successfully.`,
      });
    })
    .catch(error => {
      setIsUploading(false);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your resumes. Please try again.",
        variant: "destructive"
      });
      console.error("Error uploading resumes:", error);
    });
  };

  const handleAnalyzeClick = () => {
    if (!jobDescription.trim()) {
      toast({
        title: "Missing Job Description",
        description: "Please enter a job description before analyzing.",
        variant: "destructive"
      });
      return;
    }
    
    setIsAnalyzing(true);
    
    // First send job description to backend
    fetch('http://localhost:5000/job_description_job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ job_description: jobDescription })
    })
    .then(response => response.json())
    .then(() => {
      // Now get similarity analysis
      return fetch('http://localhost:5000/check_similarity_job');
    })
    .then(response => response.json())
    .then(data => {
      // Enhance the data with placeholder learning paths
      const enhancedData = data.map((match: any) => ({
        ...match,
        strengths: ["Strong technical skills", "Experience with required technologies"],
        weaknesses: ["Limited industry experience", "Missing some key skills"],
        learning_path: {
          title: "Personalized Learning Path",
          description: "Improve your skills to match this job better",
          resources: [
            {
              title: "Relevant Technical Course",
              type: "course",
              link: "https://example.com/course_job",
              description: "This course will help you build relevant skills."
            }
          ]
        }
      }));
      
      setMatches(enhancedData);
      setHasResults(true);
      setIsAnalyzing(false);
      setActiveTab('results');
      
      toast({
        title: "Analysis Complete",
        description: "Resume matching has been completed. View the results below.",
      });
    })
    .catch(error => {
      setIsAnalyzing(false);
      toast({
        title: "Analysis Failed",
        description: "There was an error analyzing the resumes. Please try again.",
        variant: "destructive"
      });
      console.error("Error analyzing resumes:", error);
    });
  };

  const handleSendEmail = (email: string) => {
    setSelectedEmail(email);
    setIsSendingEmail(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSendingEmail(false);
      
      toast({
        title: "Email Sent",
        description: `An invitation email has been sent to ${email}.`,
      });
    }, 2000);
  };

  const handleViewResume = (resumeName: string) => {
    // Open resume in new window
    window.open(`http://localhost:5000/view_resume_job?file=${resumeName}`, '_blank');
    
    toast({
      title: "Opening Resume",
      description: `Viewing ${resumeName}`,
    });
  };

  const handleViewLearningPath = (candidate: ResumeMatch) => {
    setSelectedCandidate(candidate);
  };

  // Effect to auto navigate to job description tab after successful upload
  useEffect(() => {
    if (uploadedFiles && uploadedFiles.length > 0 && !isUploading) {
      setActiveTab('job');
    }
  }, [uploadedFiles, isUploading]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <h1 className="page-header">Job Assessment</h1>
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="upload" className="flex-1">Upload Resumes</TabsTrigger>
            <TabsTrigger value="job" className="flex-1">Job Description</TabsTrigger>
            <TabsTrigger value="results" className="flex-1" disabled={!hasResults}>Results</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload Candidate Resumes</CardTitle>
                <CardDescription>
                  Upload the resumes you want to analyze against your job description.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload 
                  onFileUpload={handleResumeUpload} 
                  acceptedTypes=".pdf,.docx,.doc" 
                  multiple={true}
                  maxFiles={10}
                />
              </CardContent>
              <CardFooter>
                {isUploading ? (
                  <Button disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </Button>
                ) : (
                  <Button onClick={() => setActiveTab('job')}>
                    Continue to Job Description
                  </Button>
                )}
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="job">
            <Card>
              <CardHeader>
                <CardTitle>Enter Job Description</CardTitle>
                <CardDescription>
                  Paste the job description to match against candidate resumes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea 
                  placeholder="Enter the complete job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="min-h-[300px]"
                />
              </CardContent>
              <CardFooter>
                <div className="w-full flex justify-between">
                  <Button variant="outline" onClick={() => setActiveTab('upload')}>
                    Back to Uploads
                  </Button>
                  <Button 
                    onClick={handleAnalyzeClick}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      'Analyze Resumes'
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="results">
            {!selectedCandidate ? (
              <Card>
                <CardHeader>
                  <CardTitle>Resume Matching Results</CardTitle>
                  <CardDescription>
                    Here are the candidates ranked by how well their resume matches the job description.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Resume</TableHead>
                        <TableHead>Match Score</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matches.map((match, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>{match.resume}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={match.similarity_score * 100} 
                                className="h-2 w-28" 
                              />
                              <span className="text-sm">
                                {Math.round(match.similarity_score * 100)}%
                              </span>
                              {match.similarity_score >= 0.7 && (
                                <Badge className="bg-green-500">Good Fit</Badge>
                              )}
                              {match.similarity_score < 0.7 && match.similarity_score >= 0.5 && (
                                <Badge className="bg-yellow-500">Potential Fit</Badge>
                              )}
                              {match.similarity_score < 0.5 && (
                                <Badge className="bg-red-500">Gap to Fill</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{match.email}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewResume(match.resume)}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewLearningPath(match)}
                              >
                                <BookOpen className="h-4 w-4 mr-1" />
                                Learning Path
                              </Button>
                              {/* <Button
                                size="sm"
                                onClick={() => handleSendEmail(match.email)}
                                disabled={isSendingEmail && selectedEmail === match.email}
                              >
                                {isSendingEmail && selectedEmail === match.email ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <Mail className="h-4 w-4 mr-1" />
                                )}
                                Invite
                              </Button> */}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter>
                  <div className="w-full flex justify-between">
                    <Button variant="outline" onClick={() => setActiveTab('job')}>
                      Back to Job Description
                    </Button>
                    <Button onClick={() => window.location.reload()}>
                      Start New Assessment
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Learning Path for {selectedCandidate.email}</CardTitle>
                      <CardDescription>
                        Personalized recommendations to improve job fit
                      </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => setSelectedCandidate(null)}>
                      Back to Results
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Match Analysis</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Strengths</h4>
                          <ul className="list-disc pl-5">
                            {selectedCandidate.strengths?.map((strength, i) => (
                              <li key={i} className="text-sm">{strength}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Areas for Improvement</h4>
                          <ul className="list-disc pl-5">
                            {selectedCandidate.weaknesses?.map((weakness, i) => (
                              <li key={i} className="text-sm">{weakness}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <Alert>
                      <AlertTitle>{selectedCandidate.learning_path?.title}</AlertTitle>
                      <AlertDescription>
                        {selectedCandidate.learning_path?.description}
                      </AlertDescription>
                    </Alert>
                    
                    <div>
                      <h3 className="text-lg font-medium mb-2">Recommended Resources</h3>
                      <div className="space-y-4">
                        {selectedCandidate.learning_path?.resources.map((resource, i) => (
                          <div key={i} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{resource.title}</h4>
                                <p className="text-sm text-gray-500">{resource.type}</p>
                                <p className="text-sm mt-1">{resource.description}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => window.open(resource.link, '_blank')}>
                                View Resource
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default JobAssessment;