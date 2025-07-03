import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import FileUpload from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Check,
  AlertTriangle,
  FileQuestion,
  Loader2,
  Cpu,
  BookOpen,
  ArrowRight,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
// Modified imports at the top of the file
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
enum AssessmentStage {
  Upload = 0,
  Categorization = 1,
  DifficultySelection = 2,
  Test = 3,
  Results = 4,
  PathRecommendation = 5
}

interface Question {
  id?: number;
  question: string;
  options: { [key: string]: string } | string[];
  answer?: string;
  code?: string | null;  
}


interface TechStack {
  name: string;
  selected: boolean;
}

interface Resource {
  title: string;
  type: string;
  link: string;
  description: string;
}

interface LearningPathResponse {
  learningPath: Resource[];
}
const SkillAssessment: React.FC = () => {
  const [stage, setStage] = useState<AssessmentStage>(AssessmentStage.Upload);
  const [isUploading, setIsUploading] = useState(false);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, string>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [techStacks, setTechStacks] = useState<TechStack[]>([]);
  const [learningPath, setLearningPath] = useState<Resource[] | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  // Update handleFileUpload function to ensure correct stage transition
  const handleFileUpload = async (files: FileList, extractedInfo?: any) => {
    setIsUploading(true);
  
    try {
      if (extractedInfo && extractedInfo.techStack) {
        const techStackList: TechStack[] = extractedInfo.techStack.map(
          (tech: string) => ({
            name: tech,
            selected: true,
          })
        );
  
        setTechStacks(techStackList);
        setCategory(extractedInfo.category || "Technology");
  
        toast({
          title: "Resume Processed Successfully",
          description:
            "Your resume has been analyzed and tech stack extracted.",
        });
      } else {
        setCategory("Technology");
        setTechStacks([
          { name: "JavaScript", selected: true },
          { name: "React", selected: true },
          { name: "Python", selected: true },
          { name: "Machine Learning", selected: false },
        ]);
  
        toast({
          title: "Resume Uploaded Successfully",
          description: "Your resume has been categorized as Technology.",
        });
      }
  
      setResumeUploaded(true);
      setStage(AssessmentStage.Categorization);
    } catch (error) {
      console.error("Error processing resume:", error);
      toast({
        title: "Error",
        description: "Failed to process your resume. Please try again.",
        variant: "destructive",
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
        .filter((tech) => tech.selected)
        .map((tech) => tech.name);

      if (selectedTechs.length === 0) {
        throw new Error("Please select at least one technology");
      }

      // Call the API with tech stack and difficulty parameters
      const queryParams = new URLSearchParams({
        difficulty: difficulty,
        tech_stack: selectedTechs.join(","),
      });

      const response = await fetch(
        `http://127.0.0.1:5000/generate_mcqs?${queryParams}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(30000) // 30 second timeout
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch questions: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Parse the response and format questions
      let parsedQuestions: Question[] = [];

      if (data && data.mcqs) {
        try {
          let mcqsArray = data.mcqs;
          
          if (typeof mcqsArray === 'string') {
            // Remove markdown code block if present
            let trimmed = mcqsArray.trim();
            if (trimmed.startsWith('```json')) {
              trimmed = trimmed.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (trimmed.startsWith('```')) {
              trimmed = trimmed.replace(/^```/, '').replace(/```$/, '').trim();
            }
            mcqsArray = JSON.parse(trimmed);
          }

          if (!Array.isArray(mcqsArray)) {
            throw new Error('Received data is not in the expected format');
          }

          if (mcqsArray.length === 0) {
            throw new Error('No questions received from the server');
          }

          parsedQuestions = mcqsArray.map((q, index) => ({
            ...q,
            id: index + 1,
            options: q.options || {},
            answer: q.answer || ''
          }));

          // Validate questions format
          const invalidQuestions = parsedQuestions.filter(q => 
            !q.question || 
            !q.options || 
            Object.keys(q.options).length === 0 || 
            !q.answer
          );

          if (invalidQuestions.length > 0) {
            throw new Error('Some questions are missing required fields');
          }

        } catch (parseError) {
          console.error("Error parsing questions:", parseError);
          throw new Error("Failed to process the questions from the server");
        }
      } else {
        throw new Error("No questions data received from the server");
      }

      setQuestions(parsedQuestions);
      setCurrentQuestionIndex(0); // Reset to first question
      setSelectedAnswers({}); // Clear any previous answers
      
      return true; // Indicate successful fetch

    } catch (error) {
      console.error("Error fetching questions:", error);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load questions. Please try again.",
        variant: "destructive",
      });

      // Use fallback questions only in development environment
      if (process.env.NODE_ENV === 'development') {
        const fallbackQuestions = [
          {
            id: 1,
            question: "What is the primary purpose of a RESTful API?",
            options: {
              A: "To provide a graphical user interface",
              B: "To enable communication between different systems over the internet",
              C: "To store data in a SQL database",
              D: "To manage server hardware resources",
            },
            answer: "B",
          },
          {
            id: 2,
            question: "Which of the following is NOT a JavaScript framework?",
            options: {
              A: "React",
              B: "Angular",
              C: "Vue",
              D: "Flask",
            },
            answer: "D",
          },
        ];

        setQuestions(fallbackQuestions);
        return true; // Allow continuing with fallback questions in development
      }

      setQuestions([]);
      return false; // Indicate fetch failure
    } finally {
      setIsLoading(false);
    }
  };

  // Update stage transitions in the component
  const handleCategoryConfirm = () => {
    const selectedTechs = techStacks.filter(tech => tech.selected);
    if (selectedTechs.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one technology.",
        variant: "destructive"
      });
      return;
    }
    setStage(AssessmentStage.DifficultySelection);
  };

  const handleDifficultySelection = async (difficultyLevel: string) => {
    setDifficulty(difficultyLevel);
    const success = await fetchQuestionsFromAPI();
    if (success && questions.length > 0) {
      setStage(AssessmentStage.Test);
    } else {
      toast({
        title: "Error",
        description: "Failed to load questions. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAnswerSelection = (questionId: number, answer: string) => {
    setSelectedAnswers({ ...selectedAnswers, [questionId]: answer });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Complete test and calculate results
      setIsLoading(true);
      let correctAnswers = 0;
      questions.forEach((question) => {
        if (question.id !== undefined && selectedAnswers[question.id] === question.answer) {
          correctAnswers++;
        }
      });
      const scoreValue = Math.round((correctAnswers / questions.length) * 100);
      setScore(scoreValue);
      setIsLoading(false);
      setStage(AssessmentStage.Results);
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
    setCategory("");
    setDifficulty("");
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setScore(null);
    setTechStacks([]);
    setLearningPath(null);
  };

  // Updated handlePathRecommendation function
  const handlePathRecommendation = async () => {
    if (!score || !difficulty || questions.length === 0) {
      toast({
        title: "Error",
        description: "Missing assessment data. Please complete the assessment first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Prepare assessment data
      const selectedTechs = techStacks
        .filter((tech) => tech.selected)
        .map((tech) => tech.name);

      if (selectedTechs.length === 0) {
        throw new Error("No technologies selected. Please select at least one technology.");
      }

      // Get question and user answers with correct/incorrect status
      const questionAnswers = questions.map((question) => {
        const questionId = question.id as number;
        const userAnswer = selectedAnswers[questionId] || "";
        const isCorrect = userAnswer === question.answer;

        return {
          question: question.question,
          userAnswer,
          correctAnswer: question.answer,
          isCorrect,
        };
      });

      // Validate that all questions have been answered
      const unansweredQuestions = questionAnswers.filter(qa => !qa.userAnswer);
      if (unansweredQuestions.length > 0) {
        throw new Error("Please answer all questions before generating the learning path.");
      }

      // Send data to backend for path recommendation
      const response = await fetch(
        "http://127.0.0.1:5000/generate_learning_path",
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            score,
            difficulty,
            techStack: selectedTechs,
            questionAnswers,
          }),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get path recommendations: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate learning path data
      if (!data || !data.learningPath || !Array.isArray(data.learningPath)) {
        throw new Error("Invalid learning path data received from server");
      }

      // Validate each resource in the learning path
      const validatedPath = data.learningPath.map((resource, index) => {
        if (!resource.title || !resource.type || !resource.link || !resource.description) {
          console.warn(`Invalid resource at index ${index}:`, resource);
          return {
            title: resource.title || "Resource " + (index + 1),
            type: resource.type || "other",
            link: resource.link || "#",
            description: resource.description || "No description available."
          };
        }
        return resource;
      });

      setLearningPath(validatedPath);
      setStage(AssessmentStage.PathRecommendation);

    } catch (error) {
      console.error("Error generating learning path:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to generate learning path";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      // Only use fallback in development environment
      if (process.env.NODE_ENV === 'development') {
        const fallbackPath = [
          {
            title: "Fundamentals Refresher",
            type: "course",
            link: "https://example.com/course1",
            description: "Review core concepts to ensure a solid foundation.",
          },
          {
            title: "Practice Projects",
            type: "project",
            link: "https://example.com/projects",
            description: "Apply your knowledge with hands-on projects.",
          },
          {
            title: "Advanced Topics",
            type: "tutorial",
            link: "https://example.com/advanced",
            description: "Deepen your understanding with specialized topics.",
          },
        ];

        setLearningPath(fallbackPath);
        setStage(AssessmentStage.PathRecommendation);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const downloadLearningPath = () => {
    if (!learningPath || learningPath.length === 0) {
      toast({
        title: "Error",
        description: "Learning path not available for download.",
        variant: "destructive",
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

      // Add title and logo
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("Skill Assessment Report", pageWidth / 2, yPosition, {
        align: "center",
      });
      yPosition += 25;

      // Add assessment summary section
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Assessment Summary", margin, yPosition);
      yPosition += 10;

      // Add assessment details in a structured format
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const summaryData = [
        ["Score", `${score}%`],
        ["Difficulty Level", difficulty],
        ["Technologies", techStacks.filter(tech => tech.selected).map(tech => tech.name).join(", ")]
      ];

      autoTable(doc, {
        startY: yPosition,
        body: summaryData,
        theme: 'plain',
        styles: { fontSize: 12 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { cellWidth: 130 }
        },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;

      // Add performance analysis section
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Performance Analysis", margin, yPosition);
      yPosition += 10;

      // Add analysis text
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const analysis = score >= 70 ? 
        "You've demonstrated strong proficiency in the assessed skills. The recommended resources will help you further advance your expertise." :
        "There's room for improvement in some areas. The recommended resources will help strengthen your foundation and build advanced skills.";

      const splitAnalysis = doc.splitTextToSize(analysis, pageWidth - 2 * margin);
      doc.text(splitAnalysis, margin, yPosition);
      yPosition += splitAnalysis.length * 8 + 20;

      // Add learning path section
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Personalized Learning Path", margin, yPosition);
      yPosition += 10;

      // Add resources in a structured table
      const resourcesData = learningPath.map((resource) => [
        resource.title,
        resource.type,
        resource.description
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["Resource", "Type", "Description"]],
        body: resourcesData,
        styles: { 
          overflow: "linebreak", 
          cellPadding: 5,
          fontSize: 11
        },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 30 },
          2: { cellWidth: 110 }
        },
        headStyles: { 
          fillColor: [41, 128, 185], 
          textColor: 255,
          fontSize: 12,
          fontStyle: 'bold'
        },
      });

      // Add resource links section
      yPosition = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Resource Links", margin, yPosition);
      yPosition += 8;

      // Add links in a separate table
      const linkData = learningPath.map((resource) => [
        resource.title,
        resource.link
      ]);

      autoTable(doc, {
        startY: yPosition,
        body: linkData,
        theme: 'plain',
        styles: { 
          fontSize: 10,
          textColor: [0, 0, 238]
        },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 140 }
        },
      });

      // Add footer
      const finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} | Skill Assessment Platform`,
        pageWidth / 2,
        finalY,
        { align: "center" }
      );

      // Download the PDF
      doc.save(`skill-assessment-report-${new Date().getTime()}.pdf`);

      toast({
        title: "Download Complete",
        description: "Your assessment report has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Download Failed",
        description: "There was an error creating your PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  }; // Helper function to render options correctly
  const renderOptions = (question: Question) => {
    if (!question || !question.options) return null;

    // Handle different option formats
    const optionsArray = Array.isArray(question.options)
      ? question.options.map((opt, idx) => ({
          key: String.fromCharCode(65 + idx),
          value: opt,
        }))
      : Object.entries(question.options).map(([key, value]) => ({
          key,
          value,
        }));

    return optionsArray.map((option, index) => (
      <div
        key={index}
        className="flex items-start space-x-3 border p-3 rounded-md hover:bg-gray-50"
      >
        <RadioGroupItem value={option.key} id={`option-${index}`} />
        <Label htmlFor={`option-${index}`}>{option.value}</Label>
      </div>
    ));
  };

  // Helper function to determine resource icon based on type
  const getResourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "course":
        return <BookOpen className="h-5 w-5 text-blue-500" />;
      case "project":
        return <FileQuestion className="h-5 w-5 text-green-500" />;
      case "tutorial":
        return <Cpu className="h-5 w-5 text-purple-500" />;
      default:
        return <ArrowRight className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <Layout>
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6">Skill Assessment</h1>

        <div className="mb-8 w-full">
          <Progress value={(stage + 1) * (100 / 6)} className="h-2" />
          <div className="flex justify-between items-center mt-4">
            {[
              { stage: AssessmentStage.Upload, label: "Upload", icon: <FileQuestion className="h-4 w-4" /> },
              { stage: AssessmentStage.Categorization, label: "Category", icon: <Cpu className="h-4 w-4" /> },
              { stage: AssessmentStage.DifficultySelection, label: "Difficulty", icon: <AlertTriangle className="h-4 w-4" /> },
              { stage: AssessmentStage.Test, label: "Test", icon: <BookOpen className="h-4 w-4" /> },
              { stage: AssessmentStage.Results, label: "Results", icon: <Check className="h-4 w-4" /> },
              { stage: AssessmentStage.PathRecommendation, label: "Path", icon: <ArrowRight className="h-4 w-4" /> }
            ].map((item, index) => (
              <div key={index} className="relative flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${stage >= item.stage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}
                >
                  {item.icon}
                </div>
                <span className="text-xs mt-2 text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {stage === AssessmentStage.Upload && (
          <Card className="w-full">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl text-center">Upload Your Resume</CardTitle>
              <CardDescription className="text-center">
                We'll analyze your resume to identify your skills and suggest an appropriate assessment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <FileUpload
                onFileUpload={handleFileUpload}
                acceptedTypes=".pdf,.docx,.doc"
                extractTechStack={true}
              />
            </CardContent>
            <CardFooter className="flex justify-center p-4 sm:p-6">
              {isUploading ? (
                <Button disabled className="w-full sm:w-auto">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </Button>
              ) : (
                <Button
                  onClick={() => setStage(AssessmentStage.Categorization)}
                  disabled={!resumeUploaded && stage === AssessmentStage.Upload}
                  className="w-full sm:w-auto"
                >
                  {resumeUploaded ? "Continue" : "Please Upload Your Resume"}
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {stage === AssessmentStage.Categorization && (
          <Card className="w-full">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl text-center">Resume Analysis Complete</CardTitle>
              <CardDescription className="text-center">
                Based on your resume, we've identified your primary skill category and tech stack.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              <Alert className="bg-blue-50">
                <AlertTitle className="text-blue-700 flex items-center justify-center sm:justify-start">
                  <Check className="h-4 w-4 mr-2" />
                  Skill Category Identified
                </AlertTitle>
                <AlertDescription className="text-blue-600 text-center sm:text-left">
                  Your resume has been analyzed and your primary skill category is <strong>{category}</strong>.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-center sm:text-left">
                  Detected Tech Stack
                </h3>
                <p className="text-gray-700 text-center sm:text-left">
                  We've identified the following technologies in your resume. Please confirm or adjust:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {techStacks.map((tech, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                      <Checkbox
                        id={`tech-${index}`}
                        checked={tech.selected}
                        onCheckedChange={() => toggleTechStack(index)}
                      />
                      <Label htmlFor={`tech-${index}`} className="flex items-center cursor-pointer">
                        <Cpu className="h-4 w-4 mr-2 text-gray-500" />
                        {tech.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button
                onClick={() => setStage(AssessmentStage.DifficultySelection)}
              >
                Continue
              </Button>
            </CardFooter>
          </Card>
        )}

        {stage === AssessmentStage.DifficultySelection && (
          <Card className="w-full">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl text-center">Select Difficulty Level</CardTitle>
              <CardDescription className="text-center">
                Choose the difficulty level for your assessment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <RadioGroup
                className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                defaultValue="beginner"
                onValueChange={handleDifficultySelection}
              >
                <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="beginner" id="beginner" />
                  <Label htmlFor="beginner">Beginner</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="intermediate" id="intermediate" />
                  <Label htmlFor="intermediate">Intermediate</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="advanced" id="advanced" />
                  <Label htmlFor="advanced">Advanced</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {stage === AssessmentStage.Test && (
          <Card className="w-full">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl text-center">
                Question {currentQuestionIndex + 1} of {questions.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              {questions[currentQuestionIndex] && (
                <div className="space-y-6">
                  <div className="text-lg font-medium text-center sm:text-left">
                    {questions[currentQuestionIndex].question}
                  </div>
                  {questions[currentQuestionIndex].code && (
                    <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                      {questions[currentQuestionIndex].code}
                    </pre>
                  )}
                  <RadioGroup
                    value={selectedAnswers[questions[currentQuestionIndex].id || 0] || ""}
                    onValueChange={(value) =>
                      handleAnswerSelection(
                        questions[currentQuestionIndex].id || 0,
                        value
                      )
                    }
                    className="space-y-3"
                  >
                    {renderOptions(questions[currentQuestionIndex])}
                  </RadioGroup>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 p-4 sm:p-6">
              <Button
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
                variant="outline"
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Previous
              </Button>
              <Button
                onClick={handleNextQuestion}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {currentQuestionIndex === questions.length - 1 ? "Finish" : "Next"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {stage === AssessmentStage.Results && (
          <Card className="w-full">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl text-center">Assessment Results</CardTitle>
              <CardDescription className="text-center">
                Here's how you performed in your assessment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="text-4xl sm:text-6xl font-bold text-blue-600">
                  {score}%
                </div>
                <p className="text-gray-600 text-center">
                  You've completed the {difficulty} level assessment
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  onClick={handleRestart}
                  variant="outline"
                  className="w-full"
                >
                  Take Another Assessment
                </Button>
                <Button
                  onClick={handlePathRecommendation}
                  className="w-full"
                >
                  Get Learning Path
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === AssessmentStage.PathRecommendation && (
          <Card className="w-full">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl text-center">Your Learning Path</CardTitle>
              <CardDescription className="text-center">
                Based on your assessment results, here's your personalized learning path.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
                  <p className="text-gray-600">Generating your learning path...</p>
                </div>
              ) : learningPath ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {learningPath.map((resource, index) => (
                      <Card key={index} className="flex flex-col h-full">
                        <CardHeader>
                          <div className="flex items-center space-x-2">
                            {getResourceIcon(resource.type)}
                            <CardTitle className="text-lg">{resource.title}</CardTitle>
                          </div>
                          <Badge variant="secondary" className="w-fit">
                            {resource.type}
                          </Badge>
                        </CardHeader>
                        <CardContent className="flex-grow">
                          <p className="text-gray-600">{resource.description}</p>
                        </CardContent>
                        <CardFooter>
                          <a
                            href={resource.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline w-full text-center"
                          >
                            View Resource
                          </a>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button
                      onClick={downloadLearningPath}
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={isDownloading}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isDownloading ? "Downloading..." : "Download Path"}
                    </Button>
                    <Button
                      onClick={handleRestart}
                      className="w-full sm:w-auto"
                    >
                      Start New Assessment
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No learning path available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default SkillAssessment;
