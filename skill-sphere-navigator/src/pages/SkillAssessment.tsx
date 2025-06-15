import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import FileUpload from '@/components/FileUpload';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, AlertTriangle, FileQuestion, Loader2, Cpu, BookOpen, ArrowRight, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
// Modified imports at the top of the file
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import autoTable from 'jspdf-autotable';
enum AssessmentStage {
  Upload,
  Categorization,
  DifficultySelection,
  Test,
  Results,
  PathRecommendation
}

interface Question {
  id?: number;
  question: string;
  options: { [key: string]: string } | string[];
  answer?: string;
}

interface TechStack {
  name: string;
  selected: boolean;
}

interface LearningPath {
  title: string;
  description: string;
  resources: {
    title: string;
    type: string;
    link: string;
    description: string;
  }[];
}

const SkillAssessment: React.FC = () => {
  const [stage, setStage] = useState<AssessmentStage>(AssessmentStage.Upload);
  const [isUploading, setIsUploading] = useState(false);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [techStacks, setTechStacks] = useState<TechStack[]>([]);
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (files: FileList, extractedInfo?: any) => {
    setIsUploading(true);
    
    try {
      if (extractedInfo && extractedInfo.techStack) {
        // Process the extracted tech stack
        const techStackList: TechStack[] = extractedInfo.techStack.map((tech: string) => ({
          name: tech,
          selected: true
        }));
        
        setTechStacks(techStackList);
        setCategory(extractedInfo.category || 'Technology');
        
        toast({
          title: "Resume Processed Successfully",
          description: "Your resume has been analyzed and tech stack extracted.",
        });
      } else {
        // Fallback if no tech stack was extracted
        setCategory('Technology');
        setTechStacks([
          { name: 'JavaScript', selected: true },
          { name: 'React', selected: true },
          { name: 'Python', selected: true },
          { name: 'Machine Learning', selected: false }
        ]);
        
        toast({
          title: "Resume Uploaded Successfully",
          description: "Your resume has been categorized as Technology.",
        });
      }
      
      setResumeUploaded(true);
      setStage(AssessmentStage.Categorization);
    } catch (error) {
      console.error('Error processing resume:', error);
      toast({
        title: "Error",
        description: "Failed to process your resume. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const toggleTechStack = (index: number) => {
    const updatedTechStacks = [...techStacks];
    updatedTechStacks[index].selected = !updatedTechStacks[index].selected;
    setTechStacks(updatedTechStacks);
  };

  const fetchQuestionsFromAPI = async () => {
    try {
      setIsLoading(true);
      
      // Get selected tech stacks
      const selectedTechs = techStacks
        .filter(tech => tech.selected)
        .map(tech => tech.name);
      
      // Call the API with tech stack and difficulty parameters
      const queryParams = new URLSearchParams({
        difficulty: difficulty,
        tech_stack: selectedTechs.join(',')
      });
      
      const response = await fetch(`http://127.0.0.1:5000/generate_mcqs?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      
      const data = await response.json();
      
      // Parse the response and format questions
      let parsedQuestions: Question[] = [];
      
      if (data && data.mcqs) {
        try {
          // The API returns a string that contains JSON, so we need to parse it
          // The response might be wrapped in ```json ``` markdown code blocks
          let jsonString = data.mcqs;
          
          // Remove markdown code block syntax if present
          if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/```json\n|\n```/g, '');
          } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.replace(/```\n|\n```/g, '');
          }
          
          // Parse the JSON string to get the array of questions
          parsedQuestions = JSON.parse(jsonString);
          
          // Add unique IDs to each question
          parsedQuestions = parsedQuestions.map((q, index) => ({
            ...q,
            id: index + 1
          }));
        } catch (parseError) {
          console.error('Error parsing questions:', parseError);
          toast({
            title: "Error parsing questions",
            description: "There was an error processing the questions from the server.",
            variant: "destructive"
          });
        }
      }
      
      setQuestions(parsedQuestions);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setIsLoading(false);
      toast({
        title: "Error fetching questions",
        description: "There was an error loading the assessment questions. Please try again.",
        variant: "destructive"
      });
      
      // Fallback to sample questions in case of API failure
      const fallbackQuestions = [
        {
          id: 1,
          question: "What is the primary purpose of a RESTful API?",
          options: {
            "A": "To provide a graphical user interface",
            "B": "To enable communication between different systems over the internet",
            "C": "To store data in a SQL database",
            "D": "To manage server hardware resources"
          },
          answer: "B"
        },
        {
          id: 2,
          question: "Which of the following is NOT a JavaScript framework?",
          options: {
            "A": "React",
            "B": "Angular",
            "C": "Vue",
            "D": "Flask"
          },
          answer: "D"
        },
        // ... keeping a few fallback questions
      ];
      
      setQuestions(fallbackQuestions);
    }
  };

  const handleDifficultySelection = (difficultyLevel: string) => {
    setDifficulty(difficultyLevel);
    fetchQuestionsFromAPI();
    setStage(AssessmentStage.Test);
  };

  const handleAnswerSelection = (questionId: number, answer: string) => {
    setSelectedAnswers({ ...selectedAnswers, [questionId]: answer });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Complete test
      setIsLoading(true);
      
      // Calculate score based on correct answers
      setTimeout(() => {
        let correctAnswers = 0;
        
        questions.forEach(question => {
          if (question.id !== undefined && 
              selectedAnswers[question.id] === question.answer) {
            correctAnswers++;
          }
        });
        
        const scoreValue = Math.round((correctAnswers / questions.length) * 100);
        setScore(scoreValue);
        setIsLoading(false);
        setStage(AssessmentStage.Results);
      }, 2000);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleRestart = () => {
    setStage(AssessmentStage.Upload);
    setResumeUploaded(false);
    setCategory('');
    setDifficulty('');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setScore(null);
    setTechStacks([]);
    setLearningPath(null);
  };

  const handlePathRecommendation = async () => {
    setIsLoading(true);
    
    try {
      // Prepare assessment data
      const selectedTechs = techStacks
        .filter(tech => tech.selected)
        .map(tech => tech.name);
        
      // Get question and user answers with correct/incorrect status
      const questionAnswers = questions.map(question => {
        const questionId = question.id as number;
        const userAnswer = selectedAnswers[questionId] || '';
        const isCorrect = userAnswer === question.answer;
        
        return {
          question: question.question,
          userAnswer,
          correctAnswer: question.answer,
          isCorrect
        };
      });
      
      // Send data to backend for path recommendation
      const response = await fetch('http://127.0.0.1:5000/generate_learning_path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score,
          difficulty,
          techStack: selectedTechs,
          questionAnswers
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get path recommendations');
      }
      
      const data = await response.json();
      
      if (data && data.learningPath) {
        setLearningPath(data.learningPath);
        setStage(AssessmentStage.PathRecommendation);
      } else {
        toast({
          title: "Error",
          description: "Failed to generate learning path recommendations.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error generating learning path:', error);
      toast({
        title: "Error",
        description: "Failed to generate learning path recommendations. Please try again.",
        variant: "destructive"
      });
      
      // Fallback learning path in case of API failure
      setLearningPath({
        title: "Personalized Learning Path",
        description: "Based on your assessment, we've created a customized learning path to help strengthen your skills.",
        resources: [
          {
            title: "Fundamentals Refresher",
            type: "course",
            link: "https://example.com/course1",
            description: "Review core concepts to ensure a solid foundation."
          },
          {
            title: "Practice Projects",
            type: "project",
            link: "https://example.com/projects",
            description: "Apply your knowledge with hands-on projects."
          },
          {
            title: "Advanced Topics",
            type: "tutorial",
            link: "https://example.com/advanced",
            description: "Deepen your understanding with specialized topics."
          }
        ]
      });
      
      setStage(AssessmentStage.PathRecommendation);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadLearningPath = () => {
    if (!learningPath) {
      toast({
        title: "Error",
        description: "Learning path not available for download.",
        variant: "destructive"
      });
      return;
    }
  
    setIsDownloading(true);
  
    try {
      // Create a new PDF document
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = 20;
  
      // Add title
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(learningPath.title, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
  
      // Add assessment info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Assessment Score: ${score}%`, margin, yPosition);
      yPosition += 8;
      doc.text(`Difficulty Level: ${difficulty}`, margin, yPosition);
      yPosition += 8;
      
      // Add selected tech stacks
      const selectedTechs = techStacks
        .filter(tech => tech.selected)
        .map(tech => tech.name)
        .join(', ');
      
      doc.text(`Selected Technologies: ${selectedTechs}`, margin, yPosition);
      yPosition += 15;
  
      // Add description
      doc.setFontSize(14);
      doc.setFont('helvetica', 'italic');
      
      // Split description into multiple lines if needed
      const splitDescription = doc.splitTextToSize(
        learningPath.description, 
        pageWidth - (2 * margin)
      );
      
      doc.text(splitDescription, margin, yPosition);
      yPosition += (splitDescription.length * 8) + 15;
  
      // Add resources heading
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text("Recommended Resources", margin, yPosition);
      yPosition += 10;
  
      // Add resources table using the imported autoTable function
      const resourcesData = learningPath.resources.map(resource => [
        resource.title,
        resource.type,
        resource.description,
        resource.link
      ]);
  
      // Use autoTable as a function instead of a method
      autoTable(doc, {
        startY: yPosition,
        head: [['Title', 'Type', 'Description', 'Link']],
        body: resourcesData,
        margin: { top: 15, right: margin, bottom: 15, left: margin },
        styles: { overflow: 'linebreak', cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 25 },
          2: { cellWidth: 80 },
          3: { cellWidth: 45 }
        },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 }
      });
  
      // Get the final Y position after the table
      const finalY = (doc as any).lastAutoTable?.finalY + 20 || yPosition + 100;
      
      // Add footer
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} - Skill Assessment Platform`, 
        pageWidth / 2, 
        finalY, 
        { align: 'center' }
      );
  
      // Download the PDF
      doc.save(`learning-path-${new Date().getTime()}.pdf`);
  
      toast({
        title: "Download Complete",
        description: "Your learning path has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Download Failed",
        description: "There was an error creating your PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };
  // Helper function to render options correctly
  const renderOptions = (question: Question) => {
    if (!question || !question.options) return null;
    
    // Handle different option formats
    const optionsArray = Array.isArray(question.options) 
      ? question.options.map((opt, idx) => ({ key: String.fromCharCode(65 + idx), value: opt }))
      : Object.entries(question.options).map(([key, value]) => ({ key, value }));
    
    return optionsArray.map((option, index) => (
      <div key={index} className="flex items-start space-x-3 border p-3 rounded-md hover:bg-gray-50">
        <RadioGroupItem 
          value={option.key} 
          id={`option-${index}`} 
        />
        <Label htmlFor={`option-${index}`}>{option.value}</Label>
      </div>
    ));
  };

  // Helper function to determine resource icon based on type
  const getResourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'course':
        return <BookOpen className="h-5 w-5 text-blue-500" />;
      case 'project':
        return <FileQuestion className="h-5 w-5 text-green-500" />;
      case 'tutorial':
        return <Cpu className="h-5 w-5 text-purple-500" />;
      default:
        return <ArrowRight className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="page-header">Skill Assessment</h1>
        
        <div className="mb-8">
          <Progress value={(stage + 1) * (100/6)} className="h-2" />
          <div className="flex justify-between text-sm text-gray-500 mt-2">
            <span>Upload Resume</span>
            <span>Categorization</span>
            <span>Difficulty</span>
            <span>Assessment</span>
            <span>Results</span>
            <span>Path</span>
          </div>
        </div>
        
        {stage === AssessmentStage.Upload && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Your Resume</CardTitle>
              <CardDescription>
                We'll analyze your resume to identify your skills and suggest an appropriate assessment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload 
                onFileUpload={handleFileUpload} 
                acceptedTypes=".pdf,.docx,.doc" 
                extractTechStack={true}
              />
            </CardContent>
            <CardFooter className="justify-between">
              {isUploading ? (
                <Button disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </Button>
              ) : (
                <Button 
                  onClick={() => setStage(AssessmentStage.Categorization)} 
                  disabled={!resumeUploaded && stage === AssessmentStage.Upload}
                >
                  {resumeUploaded ? 'Continue' : 'Please Upload Your Resume'}
                </Button>
              )}
            </CardFooter>
          </Card>
        )}
        
        {stage === AssessmentStage.Categorization && (
          <Card>
            <CardHeader>
              <CardTitle>Resume Analysis Complete</CardTitle>
              <CardDescription>
                Based on your resume, we've identified your primary skill category and tech stack.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 bg-blue-50">
                <AlertTitle className="text-blue-700 flex items-center">
                  <Check className="h-4 w-4 mr-2" />
                  Skill Category Identified
                </AlertTitle>
                <AlertDescription className="text-blue-600">
                  Your resume has been analyzed and your primary skill category is <strong>{category}</strong>.
                </AlertDescription>
              </Alert>
              
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Detected Tech Stack</h3>
                <p className="text-gray-700 mb-4">
                  We've identified the following technologies in your resume. Please confirm or adjust:
                </p>
                
                <div className="space-y-3">
                  {techStacks.map((tech, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`tech-${index}`} 
                        checked={tech.selected}
                        onCheckedChange={() => toggleTechStack(index)}
                      />
                      <Label 
                        htmlFor={`tech-${index}`}
                        className="flex items-center"
                      >
                        <Cpu className="h-4 w-4 mr-2 text-gray-500" />
                        {tech.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-3">Skill Category</h3>
                <Tabs defaultValue={category.toLowerCase()} className="w-full">
                  <TabsList className="w-full mb-4">
                    <TabsTrigger value="technology" className="flex-1">Technology</TabsTrigger>
                    <TabsTrigger value="business" className="flex-1">Business</TabsTrigger>
                    <TabsTrigger value="design" className="flex-1">Design</TabsTrigger>
                    <TabsTrigger value="other" className="flex-1">Other</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={() => setStage(AssessmentStage.DifficultySelection)}>
                Continue
              </Button>
            </CardFooter>
          </Card>
        )}
        
        {stage === AssessmentStage.DifficultySelection && (
          <Card>
            <CardHeader>
              <CardTitle>Select Difficulty Level</CardTitle>
              <CardDescription>
                Choose the difficulty level for your skill assessment based on your experience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Selected Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {techStacks
                    .filter(tech => tech.selected)
                    .map((tech, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        {tech.name}
                      </Badge>
                    ))}
                </div>
              </div>
              
              <RadioGroup className="space-y-4" value={difficulty} onValueChange={setDifficulty}>
                <div className="flex items-start space-x-3 border p-4 rounded-md hover:bg-gray-50">
                  <RadioGroupItem value="beginner" id="beginner" />
                  <div className="grid gap-1.5">
                    <Label htmlFor="beginner" className="font-bold">Beginner</Label>
                    <p className="text-sm text-gray-500">
                      0-2 years of experience. Fundamental concepts and basic applications.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 border p-4 rounded-md hover:bg-gray-50">
                  <RadioGroupItem value="intermediate" id="intermediate" />
                  <div className="grid gap-1.5">
                    <Label htmlFor="intermediate" className="font-bold">Intermediate</Label>
                    <p className="text-sm text-gray-500">
                      2-5 years of experience. Advanced concepts and practical implementation.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 border p-4 rounded-md hover:bg-gray-50">
                  <RadioGroupItem value="advanced" id="advanced" />
                  <div className="grid gap-1.5">
                    <Label htmlFor="advanced" className="font-bold">Advanced</Label>
                    <p className="text-sm text-gray-500">
                      5+ years of experience. Expert-level concepts and complex problem-solving.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="outline" onClick={() => setStage(AssessmentStage.Categorization)}>
                Back
              </Button>
              <Button 
                onClick={() => handleDifficultySelection(difficulty)} 
                disabled={!difficulty}
              >
                Start Assessment
              </Button>
            </CardFooter>
          </Card>
        )}
        
        {stage === AssessmentStage.Test && (
          <Card>
            {isLoading ? (
              <CardContent className="py-8 flex flex-col items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-gray-600">Loading your assessment questions...</p>
              </CardContent>
            ) : questions.length > 0 ? (
              <>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Question {currentQuestionIndex + 1} of {questions.length}</CardTitle>
                    <span className="text-sm text-gray-500">
                      {Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}% Complete
                    </span>
                  </div>
                  <Progress 
                    value={((currentQuestionIndex + 1) / questions.length) * 100} 
                    className="h-2" 
                  />
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-4">
                      {questions[currentQuestionIndex]?.question}
                    </h3>
                    
                    <RadioGroup 
                      value={questions[currentQuestionIndex]?.id !== undefined ? 
                        selectedAnswers[questions[currentQuestionIndex].id!] || '' : ''}
                      onValueChange={(value) => questions[currentQuestionIndex]?.id !== undefined && 
                        handleAnswerSelection(questions[currentQuestionIndex].id!, value)}
                      className="space-y-3"
                    >
                      {renderOptions(questions[currentQuestionIndex])}
                    </RadioGroup>
                  </div>
                </CardContent>
                <CardFooter className="justify-between">
                  <Button 
                    variant="outline" 
                    onClick={handlePreviousQuestion}
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </Button>
                  <Button 
                    onClick={handleNextQuestion}
                    disabled={!questions[currentQuestionIndex]?.id || 
                      !selectedAnswers[questions[currentQuestionIndex].id!]}
                  >
                    {currentQuestionIndex === questions.length - 1 ? 'Finish' : 'Next'}
                  </Button>
                </CardFooter>
              </>
            ) : (
              <CardContent className="py-8 text-center">
                <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Questions Available</h3>
                <p className="text-gray-600 mb-4">
                  We couldn't load any questions for your assessment. Please try again or contact support.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setStage(AssessmentStage.DifficultySelection)}
                >
                  Go Back
                </Button>
              </CardContent>
            )}
          </Card>
        )}
        
        {stage === AssessmentStage.Results && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Assessment Results</CardTitle>
              <CardDescription>
                Your technology skills assessment is complete. Here's how you performed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-gray-600">Calculating your results...</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-48 h-48 flex items-center justify-center rounded-full bg-gray-100 mx-auto mb-6">
                    <div className="text-4xl font-bold text-primary">
                      {score}%
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-2">
                    {score && score >= 80 ? 'Excellent!' : score && score >= 60 ? 'Good Job!' : 'Keep Learning!'}
                  </h3>
                  
                  <p className="text-gray-600 mb-6">
                    {score && score >= 80 
                      ? "You've demonstrated advanced knowledge in your field. You're ready for expert-level positions." 
                      : score && score >= 60 
                        ? "You have a solid foundation of skills. Consider focusing on specific areas to enhance your expertise."
                        : "You're on the right track. Continue building your skills with focused learning and practice."}
                  </p>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Next Steps Recommendation</h4>
                    <p className="text-blue-600 text-sm">
                      Based on your performance, we recommend exploring our personalized path recommendations to enhance your skills in Technology.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="outline" onClick={handleRestart}>
                Start New Assessment
              </Button>
              <Button onClick={handlePathRecommendation}>
                Path Recommendation
              </Button>
            </CardFooter>
          </Card>
        )}
        
        {stage === AssessmentStage.PathRecommendation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{learningPath?.title || "Personalized Learning Path"}</CardTitle>
            <CardDescription>
              {learningPath?.description || "Based on your assessment, we've created a customized learning path to help strengthen your skills."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-gray-600">Generating your personalized learning path...</p>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Overview</h3>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-500">Score</p>
                      <p className="text-xl font-bold text-blue-700">{score}%</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-500">Level</p>
                      <p className="text-xl font-bold text-green-700">{difficulty || "Intermediate"}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-500">Focus Area</p>
                      <p className="text-xl font-bold text-purple-700">
                        {techStacks.filter(t => t.selected)[0]?.name || "Technology"}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Recommended Resources</h3>
                  
                  {learningPath?.resources.map((resource, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getResourceIcon(resource.type)}
                        </div>
                        <div>
                          <h4 className="text-md font-medium">{resource.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{resource.description}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{resource.type}</Badge>
                            <a 
                              href={resource.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              View Resource <ArrowRight className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(!learningPath || learningPath.resources.length === 0) && (
                    <div className="text-center py-6 text-gray-500">
                      <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-2" />
                      <p>No specific resources found. Please try again or contact support.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={handleRestart}>
              Start New Assessment
            </Button>
            <Button 
              onClick={downloadLearningPath}
              disabled={isDownloading || !learningPath}
              className="flex items-center gap-2"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing Download...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download Learning Path
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
      </div>
    </Layout>
  );
};

export default SkillAssessment;