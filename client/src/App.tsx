import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/context/AuthContext";
import RequireAuth from "@/components/RequireAuth";
import CreditsWatcher from "@/components/CreditsWatcher";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

const Index = lazy(() => import("./pages/Index"));
const SkillAssessment = lazy(() => import("./pages/SkillAssessment"));
const JobMarket = lazy(() => import("./pages/JobMarket"));
const ResumeTips = lazy(() => import("./pages/ResumeTips"));
const ResumeTailor = lazy(() => import("./pages/ResumeTailor"));
const Letters = lazy(() => import("./pages/Letters"));
const Negotiation = lazy(() => import("./pages/Negotiation"));
const SkillPortfolio = lazy(() => import("./pages/SkillPortfolio"));
const Applications = lazy(() => import("./pages/Applications"));
const PublicPortfolio = lazy(() => import("./pages/PublicPortfolio"));
const PathRecommendation = lazy(() => import("./pages/PathRecommendation"));
const JobAssessment = lazy(() => import("./pages/JobAssessment"));
const Chatbot = lazy(() => import("./pages/Chatbot"));
const PracticeInterview = lazy(() => import("./pages/PracticeInterview"));
const Billing = lazy(() => import("./pages/Billing"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Terms = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Terms })));
const Privacy = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Privacy })));
const Refunds = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Refunds })));

const Fallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const protectedRoutes: [string, React.ComponentType][] = [
  ["/home", Index],
  ["/applications", Applications],
  ["/skill-assessment", SkillAssessment],
  ["/job-market", JobMarket],
  ["/resume-tips", ResumeTips],
  ["/resume-tailor", ResumeTailor],
  ["/letters", Letters],
  ["/negotiation", Negotiation],
  ["/portfolio", SkillPortfolio],
  ["/path-recommendation", PathRecommendation],
  ["/job-assessment", JobAssessment],
  ["/chatbot", Chatbot],
  ["/practice-interview", PracticeInterview],
  ["/billing", Billing],
];

const App = () => (
  <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CreditsWatcher />
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/refunds" element={<Refunds />} />
            <Route path="/p/:slug" element={<PublicPortfolio />} />
            {protectedRoutes.map(([path, Page]) => (
              <Route
                key={path}
                path={path}
                element={
                  <RequireAuth>
                    <Page />
                  </RequireAuth>
                }
              />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </AuthProvider>
);

export default App;
