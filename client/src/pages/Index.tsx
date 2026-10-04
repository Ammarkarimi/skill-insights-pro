
import React from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import FeatureCard from '@/components/FeatureCard';
import ReadinessPanel from '@/components/readiness/ReadinessPanel';
import { BookOpen, BarChart, FileText, FilePen, Mail, HandCoins, GraduationCap, BriefcaseBusiness, BotIcon, UsersIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const features = [
  {
    title: "Skill Assessment",
    description: "Take an adaptive test generated from your resume's tech stack, with explanations and a personalised learning path.",
    icon: <BookOpen size={24} />,
    path: "/skill-assessment",
  },
  {
    title: "Resume Analyzer",
    description: "Get recruiter-grade scores, line-by-line rewrites and ATS keyword gaps, then download a PDF report.",
    icon: <FileText size={24} />,
    path: "/resume-tips",
  },
  {
    title: "Resume Tailor",
    description: "Rewrite your resume for a specific job, honestly, then download an ATS-friendly Word or PDF file.",
    icon: <FilePen size={24} />,
    path: "/resume-tailor",
  },
  {
    title: "Cover Letters & Outreach",
    description: "Cover letters, recruiter emails, LinkedIn notes, referral requests and thank-yous that sound like you.",
    icon: <Mail size={24} />,
    path: "/letters",
  },
  {
    title: "Practice Interview",
    description: "Quick practice, or 'Defend my resume': an interviewer probes your resume claims with follow-ups and verifies each one.",
    icon: <UsersIcon size={24} />,
    path: "/practice-interview",
  },
  {
    title: "Salary Negotiation",
    description: "Negotiate with an AI recruiter who has a hidden budget, see what you left on the table, and get real scripts.",
    icon: <HandCoins size={24} />,
    path: "/negotiation",
  },
  {
    title: "Job Match",
    description: "Compare one or more resumes against a job description: requirement-by-requirement fit, gaps and a learning plan.",
    icon: <BriefcaseBusiness size={24} />,
    path: "/job-assessment",
  },
  {
    title: "Career Paths",
    description: "Discover roles that fit your skills and goals, with salary ranges, skill gaps and the resources to close them.",
    icon: <GraduationCap size={24} />,
    path: "/path-recommendation",
  },
  {
    title: "Job Market",
    description: "See demand, salary bands, hiring hubs and related skills for any technology in your country.",
    icon: <BarChart size={24} />,
    path: "/job-market",
  },
  {
    title: "Career Chatbot",
    description: "Ask anything about careers, learning roadmaps, applications or negotiation, any time.",
    icon: <BotIcon size={24} />,
    path: "/chatbot",
  },
];

const Home: React.FC = () => {
  const { user } = useAuth();
  return (
    <Layout>
      <section className="mb-12">
        <motion.h1
          className="text-3xl md:text-4xl font-bold mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {user?.name ? `Welcome, ${user.name.split(" ")[0]}` : "Welcome to Skill Sphere"}
        </motion.h1>
        <ReadinessPanel />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">All tools</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.path}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * index }}
            >
              <FeatureCard {...feature} />
            </motion.div>
          ))}
        </div>
      </section>
    </Layout>
  );
};

export default Home;
