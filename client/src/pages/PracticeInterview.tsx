import React, { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Mic, MicOff, Video, Phone, MessageSquare, Share2, VolumeX, Volume2, ClipboardCheck, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

// Define interview topics
const topics = [
  { value: 'frontend', label: 'Frontend Development' },
  { value: 'backend', label: 'Backend Development' },
  { value: 'data-science', label: 'Data Science' },
  { value: 'devops', label: 'DevOps' },
  { value: 'product-management', label: 'Product Management' },
  { value: 'ui-ux', label: 'UI/UX Design' },
];

// Define difficulty levels
const difficultyLevels = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

// Mock interview questions remain the same...
const mockQuestions = {
  // All your mock questions remain unchanged
  // ...
};

const PracticeInterview = () => {
  const [step, setStep] = useState('setup');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(5); // Default to 5 questions
  const [userAnswer, setUserAnswer] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interviewFinished, setInterviewFinished] = useState(false);
  const [questionsForSession, setQuestionsForSession] = useState([]);
  const [currentExpectedAnswer, setCurrentExpectedAnswer] = useState(''); // Store expected answer
  const [allUserAnswers, setAllUserAnswers] = useState([]); // Store all user answers
  const [isSaving, setIsSaving] = useState(false); // Track saving status
  const [showResultsModal, setShowResultsModal] = useState(false); // Control results modal
  const [savedInterviewId, setSavedInterviewId] = useState(null); // Store saved interview ID
  const [interviewResults, setInterviewResults] = useState(null); // Store full interview results
  const { toast } = useToast();
  
  // References
  const recognitionRef = useRef(null);
  const speechSynthesisRef = useRef(null);
  
  // Setup speech recognition
  useEffect(() => {
    // Check if browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsListening(true);
      };
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
          
        setUserAnswer(transcript);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        toast({
          title: "Speech Recognition Error",
          description: `Error: ${event.error}. Please try again.`,
          variant: "destructive",
        });
      };
      
      recognitionRef.current = recognition;
    } else {
      toast({
        title: "Browser Not Supported",
        description: "Your browser doesn't support speech recognition. Please use Chrome or Edge.",
        variant: "destructive",
      });
    }
    
    // Clean up function
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      
      // Cancel any ongoing speech synthesis
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [toast]);
  
  // Function to read text aloud
  const speakText = (text) => {
    if (!window.speechSynthesis || !isAudioEnabled) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower than default
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onstart = () => {
      setIsSpeaking(true);
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      // Auto-start listening after question is spoken
      if (isMicOn && step === 'interview' && !interviewFinished) {
        startListening();
      }
    };
    
    window.speechSynthesis.speak(utterance);
  };
  
  // Start listening for user's answer
  const startListening = () => {
    if (!recognitionRef.current || !isMicOn) return;
    
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  };
  
  // Stop listening and capture the user's answer
  const stopListening = () => {
    if (!recognitionRef.current) return;
    
    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  };
  
  // Toggle audio output
  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
    if (isAudioEnabled && isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Get questions from API or use mock data as fallback
  const getQuestions = async (selectedTopic, selectedDifficulty) => {
    try {
      const apiUrl = window.API_URL || 'http://localhost:5000';
      
      const topicName = selectedTopic === 'custom'
        ? customTopic
        : topics.find(t => t.value === selectedTopic)?.label || selectedTopic;
      
      console.log(`Requesting questions for topic: ${topicName}, difficulty: ${selectedDifficulty}`);
      
      const requestUrl = `${apiUrl}/start_interview`;
      console.log(`Request URL: ${requestUrl}`);
      
      const response = await axios.get(requestUrl, {
        params: {
          topic: topicName,
          difficulty: selectedDifficulty,
          num_questions: 5
        },
        timeout: 10000
      });
      
      // Log the entire response for debugging
      console.log('Full API Response:', response);
      console.log('API Response status:', response.status);
      console.log('API Response data type:', typeof response.data);
      console.log('API Response data:', response.data);
      
      // More detailed validation of the response
      if (response.data) {
        if (Array.isArray(response.data)) {
          console.log('Using API response data (array)');
          return response.data;
        } else if (typeof response.data === 'object') {
          // If response.data is an object but not an array, check if it contains questions
          console.log('API returned an object, checking for questions property');
          if (response.data.questions && Array.isArray(response.data.questions)) {
            console.log('Using questions from API response object');
            return response.data.questions;
          } else {
            // Try to stringify the object to see what it contains
            console.log('API response object contents:', JSON.stringify(response.data, null, 2));
            throw new Error('API response is an object but does not contain a questions array');
          }
        } else {
          console.error('Invalid API response format:', response.data);
          throw new Error(`Invalid API response format: ${typeof response.data}`);
        }
      } else {
        console.error('Empty API response data');
        throw new Error('Empty API response data');
      }
      
    } catch (error) {
      console.error('Error fetching questions:', error.message);
      
      if (error.response) {
        console.error('API error response:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      
      console.log('Falling back to mock data');
      
      const topicKey = selectedTopic === 'custom' ? 'custom' : selectedTopic;
      const difficultyKey = selectedDifficulty || 'intermediate';
      
      if (mockQuestions[topicKey] && mockQuestions[topicKey][difficultyKey]) {
        console.log('Using topic-specific mock questions');
        return mockQuestions[topicKey][difficultyKey].map(question => ({
          question: question,
          answer: "This is a sample expected answer for the question. In a real scenario, this would be generated by the AI."
        }));
      } else {
        console.log('Using ultimate fallback questions');
        return [
          {
            question: "Could you describe your experience with this technology?",
            answer: "A good answer would include specific examples of projects, tools used, and outcomes."
          },
          {
            question: "What challenges have you faced in this field?",
            answer: "A good answer would describe specific technical challenges and how you overcame them."
          },
          {
            question: "How do you stay updated with the latest developments?",
            answer: "A good answer would mention specific resources, communities, and learning practices."
          },
          {
            question: "Can you explain a complex concept in this domain?",
            answer: "A good answer would clearly break down the concept and use analogies or examples."
          },
          {
            question: "What projects have you worked on related to this area?",
            answer: "A good answer would detail specific projects, your role, technologies used, and outcomes."
          } 
        ];
      }
    }
  };
  
  // Modify the saveAllAnswers function to ensure the modal shows after saving
const saveAllAnswers = async () => {
  try {
    setIsSaving(true);
    const apiUrl = window.API_URL || 'http://localhost:5000';
    
    const saveData = {
      topic: topic === 'custom' ? customTopic : topics.find(t => t.value === topic)?.label || topic,
      difficulty: difficulty,
      answers: allUserAnswers.map((answer, index) => ({
        question: questionsForSession[index].question,
        expectedAnswer: questionsForSession[index].answer,
        userAnswer: answer
      }))
    };
    
    // Store interview results BEFORE making the API call to ensure it's there
    // even if the API call fails
    const resultsData = {
      topic: saveData.topic,
      difficulty: difficulty,
      answers: saveData.answers,
      timestamp: new Date().toLocaleString()
    };
    
    setInterviewResults(resultsData);
    
    const response = await axios.post(`${apiUrl}/save_answers`, saveData, {
      timeout: 10000
    });
    
    console.log('Save answers response:', response.data);
    
    // Store interview ID if available
    if (response.data && response.data.filename) {
      setSavedInterviewId(response.data.filename);
    }
    
    toast({
      title: "Answers Saved",
      description: "Your interview answers have been saved successfully.",
    });
    
    // Show results modal explicitly AFTER state updates
    setTimeout(() => {
      setShowResultsModal(true);
    }, 100);
    
    return response.data;
  } catch (error) {
    console.error('Error saving answers:', error);
    
    // Even if saving fails, still show the results
    setTimeout(() => {
      setShowResultsModal(true);
    }, 100);
    
    toast({
      title: "Error",
      description: "Failed to save your answers, but you can still view your results.",
      variant: "destructive",
    });
    
    return null;
  } finally {
    setIsSaving(false);
  }
};
  
  // Fetch specific interview details from the backend
  const fetchInterviewDetails = async (filename) => {
    try {
      const apiUrl = window.API_URL || 'http://localhost:5000';
      const response = await axios.get(`${apiUrl}/get_interview_details/${filename}`, {
        timeout: 5000
      });
      
      setInterviewResults(response.data);
      setShowResultsModal(true);
      
      return response.data;
    } catch (error) {
      console.error('Error fetching interview details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch interview details. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Fetch questions when starting the interview
  const handleStartInterview = async () => {
    if (!topic) {
      toast({
        title: "Topic required",
        description: "Please select an interview topic",
        variant: "destructive",
      });
      return;
    }

    if (!difficulty) {
      toast({
        title: "Difficulty required",
        description: "Please select a difficulty level",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Reset answers array
      setAllUserAnswers([]);
      
      // Get all questions and answers for this session
      const questionsAnswers = await getQuestions(topic, difficulty);
      setQuestionsForSession(questionsAnswers);
      
      // Set the first question and its expected answer
      if (questionsAnswers.length > 0) {
        setCurrentQuestion(questionsAnswers[0].question);
        setCurrentExpectedAnswer(questionsAnswers[0].answer);
        setTotalQuestions(questionsAnswers.length);
        setCurrentQuestionIndex(1); // Starting with question 1
        setStep('interview');
        
        // Read the question aloud after a short delay
        setTimeout(() => {
          speakText(questionsAnswers[0].question);
        }, 1000);
      } else {
        throw new Error('No questions available');
      }
      
    } catch (error) {
      console.error('Error starting interview:', error);
      toast({
        title: "Error",
        description: "Failed to set up the interview. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Submit the user's answer and get the next question
  const handleNextQuestion = async () => {
    // Stop listening if still active
    if (isListening) {
      stopListening();
    }
    
    try {
      // Store the current answer
      setAllUserAnswers(prev => [...prev, userAnswer]);
      
      // In a real implementation, we would submit the answer for evaluation
      // You can add API call to evaluate_answer here if needed
      const evaluationData = {
        answer: userAnswer,
        questionIndex: currentQuestionIndex - 1  // Adjust index (0-based for backend)
      };
      
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        await axios.post(`${apiUrl}/evaluate_answer`, evaluationData);
        // You can handle the evaluation response if needed
      } catch (evalError) {
        console.log('Evaluation API call failed, continuing with next question', evalError);
      }
      
      // Reset the user answer field
      setUserAnswer('');
      
// In handleNextQuestion, modify this part:
// Check if this was the last question
if (currentQuestionIndex >= totalQuestions) {
  setInterviewFinished(true);
  
  // Save all answers to the backend
  await saveAllAnswers();
  
  // Explicitly set the modal to show
  setTimeout(() => {
    setShowResultsModal(true);
  }, 200);
  
  toast({
    title: "Interview Completed",
    description: "You've completed all the questions. Your responses have been saved.",
  });
  return;
}
      
      // Get the next question
      const nextQuestionObj = questionsForSession[currentQuestionIndex];
      setCurrentQuestion(nextQuestionObj.question);
      setCurrentExpectedAnswer(nextQuestionObj.answer);
      setCurrentQuestionIndex(prev => prev + 1);
      
      // Read the new question aloud
      setTimeout(() => {
        speakText(nextQuestionObj.question);
      }, 500);
      
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast({
        title: "Error",
        description: "Failed to submit your answer. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleFinishInterview = async () => {
    // Add the final answer to the list
    setAllUserAnswers(prev => [...prev, userAnswer]);
    
    try {
      await saveAllAnswers();
      
      // If the modal still doesn't show, force it here
      setTimeout(() => {
        setShowResultsModal(true);
      }, 300);
      
      toast({
        title: "Interview Complete",
        description: "Your answers have been saved successfully.",
      });
    } catch (error) {
      console.error('Error finishing interview:', error);
      
      // Even on error, try to show results
      setTimeout(() => {
        setShowResultsModal(true);
      }, 300);
      
      toast({
        title: "Error",
        description: "Failed to save your answers, but you can still view your results.",
        variant: "destructive",
      });
    }
  };  
  // Toggle microphone status
  const toggleMic = () => {
    setIsMicOn(!isMicOn);
    if (isMicOn && isListening) {
      stopListening();
    }
  };

  // Toggle video status  
  const toggleVideo = () => setIsVideoOn(!isVideoOn);
  
  // End the interview session
  const endInterview = () => {
    // Stop speech and listening
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current && isListening) {
      stopListening();
    }
    
    setStep('setup');
    setCurrentQuestionIndex(0);
    setUserAnswer('');
    setInterviewFinished(false);
    setShowResultsModal(false);
    
    toast({
      title: "Interview Ended",
      description: "Your practice interview has ended.",
    });
  };

  // Speak the current question again
  const repeatQuestion = () => {
    if (currentQuestion) {
      speakText(currentQuestion);
    }
  };
  
  // Close the results modal and reset the interview
  const handleCloseResults = () => {
    setShowResultsModal(false);
    setStep('setup');
    setCurrentQuestionIndex(0);
    setUserAnswer('');
    setInterviewFinished(false);
  };

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">Practice Interview</h1>

        {step === 'setup' ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Set Up Your Interview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic">Interview Topic</Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger id="topic">
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom Topic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {topic === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="custom-topic">Specify Your Topic</Label>
                  <Input 
                    id="custom-topic" 
                    placeholder="E.g., React Native, Machine Learning, etc." 
                    value={customTopic} 
                    onChange={(e) => setCustomTopic(e.target.value)} 
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Difficulty Level</Label>
                <RadioGroup value={difficulty} onValueChange={setDifficulty} className="flex space-x-4">
                  {difficultyLevels.map((level) => (
                    <div key={level.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={level.value} id={`difficulty-${level.value}`} />
                      <Label htmlFor={`difficulty-${level.value}`}>{level.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Button 
                onClick={handleStartInterview} 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up interview...
                  </>
                ) : (
                  'Start Interview'
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="interview-screen max-w-5xl mx-auto">
            {/* Interview Interface */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Bot Video */}
              <div className="rounded-lg overflow-hidden bg-gray-800 aspect-video relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="size-20 bg-primary rounded-full mb-4 mx-auto flex items-center justify-center">
                      <MessageSquare className="size-10 text-white" />
                    </div>
                    <p className="text-white font-medium">AI Interviewer</p>
                    {isSpeaking && (
                      <div className="mt-2 flex justify-center">
                        <div className="flex space-x-1">
                          <div className="w-2 h-4 bg-blue-400 animate-pulse"></div>
                          <div className="w-2 h-6 bg-blue-500 animate-pulse delay-75"></div>
                          <div className="w-2 h-8 bg-blue-600 animate-pulse delay-150"></div>
                          <div className="w-2 h-4 bg-blue-400 animate-pulse delay-300"></div>
                          <div className="w-2 h-6 bg-blue-500 animate-pulse delay-225"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute top-2 left-2 bg-red-500 px-2 py-1 rounded text-xs text-white">
                  INTERVIEWER
                </div>
              </div>

              {/* User Video */}
              <div className="rounded-lg overflow-hidden bg-gray-800 aspect-video relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  {isVideoOn ? (
                    <div className="text-center">
                      <div className="size-20 bg-secondary rounded-full mb-4 mx-auto flex items-center justify-center">
                        <span className="text-xl">👤</span>
                      </div>
                      <p className="text-white font-medium">You</p>
                      {isListening && (
                        <div className="mt-2 flex justify-center">
                          <div className="flex space-x-1">
                            <div className="w-2 h-4 bg-green-400 animate-pulse"></div>
                            <div className="w-2 h-6 bg-green-500 animate-pulse delay-75"></div>
                            <div className="w-2 h-8 bg-green-600 animate-pulse delay-150"></div>
                            <div className="w-2 h-4 bg-green-400 animate-pulse delay-300"></div>
                            <div className="w-2 h-6 bg-green-500 animate-pulse delay-225"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-white">Video Off</p>
                    </div>
                  )}
                </div>
                <div className="absolute top-2 left-2 bg-blue-500 px-2 py-1 rounded text-xs text-white">
                  YOU
                </div>
              </div>
            </div>

            {/* Interview Question Card */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">
                    Question {currentQuestionIndex} of {totalQuestions}
                  </p>
                  <h3 className="text-xl font-medium mt-1">
                    {currentQuestion}
                  </h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2" 
                    onClick={repeatQuestion}
                    disabled={isSpeaking}
                  >
                    <Volume2 className="mr-2 h-4 w-4" /> Repeat Question
                  </Button>
                </div>
                
                {/* Speech-to-text result display */}
                <div className="mb-4 rounded-md bg-muted p-4">
                  <p className="font-medium mb-2">Your Answer {isListening && "(Recording...)"}</p>
                  <p className="text-muted-foreground">
                    {userAnswer || "Your answer will appear here as you speak..."}
                  </p>
                </div>
                
                <div className="flex justify-between">
                  <Button 
                    variant={isListening ? "destructive" : "default"}
                    onClick={isListening ? stopListening : startListening}
                    disabled={!isMicOn || isSpeaking}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="mr-2 h-4 w-4" /> Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-4 w-4" /> Start Recording
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={interviewFinished ? handleFinishInterview : handleNextQuestion}
                    disabled={isListening || userAnswer.trim() === '' || isSpeaking || isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      interviewFinished ? 'Finish Interview' : 'Next Question'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Interview Controls */}
            <div className="bg-background p-4 rounded-lg shadow-md flex items-center justify-center space-x-4">
              <Button
                variant={isMicOn ? "default" : "outline"}
                size="icon"
                onClick={toggleMic}
                title={isMicOn ? "Mute microphone" : "Unmute microphone"}
              >
                {isMicOn ? <Mic /> : <MicOff />}
              </Button>
              <Button
                variant={isVideoOn ? "default" : "outline"}
                size="icon"
                onClick={toggleVideo}
                title={isVideoOn ? "Turn off camera" : "Turn on camera"}
              >
                <Video />
              </Button>
              <Button
                variant={isAudioEnabled ? "default" : "outline"}
                size="icon"
                onClick={toggleAudio}
                title={isAudioEnabled ? "Mute audio" : "Unmute audio"}
              >
                {isAudioEnabled ? <Volume2 /> : <VolumeX />}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={endInterview}
                title="End interview"
              >
                <Phone />
              </Button>
            </div>
          </div>
        )}
        
        {/* Results Modal */}
        <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Interview Results</DialogTitle>
              <DialogDescription>
                {interviewResults && (
                  <div className="text-sm">
                    Topic: <span className="font-semibold">{interviewResults.topic}</span> | 
                    Difficulty: <span className="font-semibold">{interviewResults.difficulty}</span>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {interviewResults && interviewResults.answers && (
  <div className="space-y-6 mt-4">
    {interviewResults.answers.map((item, index) => (
      <div key={index} className="border rounded-lg p-4">
        <h3 className="font-medium text-lg mb-2">Question {index + 1}</h3>
        <p className="mb-4">{item.question}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-l-4 border-blue-500 pl-3 py-2">
            <h4 className="font-medium text-blue-700">Your Answer:</h4>
            <p>{item.userAnswer || "No answer provided"}</p>
          </div>
          
          <div className="border-l-4 border-green-500 pl-3 py-2">
            <h4 className="font-medium text-green-700">Expected Answer:</h4>
            <p>{item.expectedAnswer}</p>
          </div>
        </div>
      </div>
    ))}
  </div>
)}
            
            <DialogFooter className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (savedInterviewId) {
                      // Copy interview ID to clipboard
                      navigator.clipboard.writeText(savedInterviewId);
                      toast({
                        title: "Copied",
                        description: "Interview ID copied to clipboard",
                      });
                    }
                  }}
                  disabled={!savedInterviewId}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Results
                </Button>
              </div>
              <div>
                <Button variant="secondary" onClick={handleCloseResults} className="mr-2">
                  Start New Interview
                </Button>
                <Button onClick={() => setShowResultsModal(false)}>
                  Close
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PracticeInterview;