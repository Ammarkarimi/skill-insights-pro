
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import SkillAssessment from "./pages/SkillAssessment";
import JobMarket from "./pages/JobMarket";
import ResumeTips from "./pages/ResumeTips";
import PathRecommendation from "./pages/PathRecommendation";
import NetworkAnalysis from "./pages/NetworkAnalysis";
import JobAssessment from "./pages/JobAssessment";
import NotFound from "./pages/NotFound";
import Chatbot from "./pages/Chatbot";
import PracticeInterview from "./pages/PracticeInterview";
import Landing from "./pages/Landing";
import LinkedInCallback from "./pages/LinkedInCallback";

const queryClient = new QueryClient();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/home" element={<Index />} />
          <Route path="/skill-assessment" element={<SkillAssessment />} />
          <Route path="/job-market" element={<JobMarket />} />
          <Route path="/resume-tips" element={<ResumeTips />} />
          <Route path="/path-recommendation" element={<PathRecommendation />} />
          <Route path="/network-analysis" element={<NetworkAnalysis />} />
          <Route path="/job-assessment" element={<JobAssessment />} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/practice-interview" element={<PracticeInterview />} />
          <Route path="/linkedin-callback" element={<LinkedInCallback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
