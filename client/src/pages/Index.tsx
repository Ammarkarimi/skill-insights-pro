
import React from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import FeatureCard from '@/components/FeatureCard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { BookOpen, BarChart, FileText, GraduationCap, BriefcaseBusiness, BotIcon, UsersIcon } from 'lucide-react';
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
    title: "Practice Interview",
    description: "Answer realistic interview questions by voice or text and get scored, detailed feedback with model answers.",
    icon: <UsersIcon size={24} />,
    path: "/practice-interview",
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
      <section className="mb-16">
        <div className="hero-gradient rounded-2xl p-10 text-center md:text-left md:flex md:items-center md:justify-between">
          <div className="md:w-1/2">
            <motion.h1 
              className="text-4xl md:text-5xl font-bold mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {user?.name ? `Welcome, ${user.name.split(" ")[0]}` : "Welcome to Skill Sphere"}
            </motion.h1>
            <motion.p 
              className="text-lg mb-8 max-w-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Assess your skills, explore job opportunities, and chart your career path with our comprehensive career navigation platform.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Link to="/skill-assessment">
                <Button className="bg-white text-skill-blue hover:bg-gray-100 px-8 py-6 text-lg">
                  Start Your Assessment
                </Button>
              </Link>
            </motion.div>
          </div>
          <motion.div 
            className="hidden md:block md:w-2/5"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <img 
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1742&q=80" 
              alt="Career Development" 
              className="rounded-lg shadow-xl max-h-72 object-cover w-full"
            />
          </motion.div>
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Explore Our Features</h2>
        
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
