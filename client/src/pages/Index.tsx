
import React from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import FeatureCard from '@/components/FeatureCard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  BookOpen, 
  BarChart, 
  FileText, 
  GraduationCap, 
  Network, 
  BriefcaseBusiness, 
  BotIcon,
  User2Icon,
  UsersIcon
} from 'lucide-react';

const Home: React.FC = () => {
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
              Skill Sphere Navigator
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <FeatureCard
              title="Skill Assessment"
              description="Evaluate your technical skills through our comprehensive assessment system tailored to your experience level."
              icon={<BookOpen size={24} />}
              path="/skill-assessment"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <FeatureCard
              title="Job Market Analysis"
              description="Gain insights into current job market trends, in-demand skills, and salary expectations for your field."
              icon={<BarChart size={24} />}
              path="/job-market"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <FeatureCard
              title="Resume & Interview Tips"
              description="Get expert advice on optimizing your resume and preparing for technical interviews."
              icon={<FileText size={24} />}
              path="/resume-tips"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <FeatureCard
              title="Path Recommendation"
              description="Receive personalized career path recommendations based on your skills and interests."
              icon={<GraduationCap size={24} />}
              path="/path-recommendation"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <FeatureCard
              title="Network Analysis"
              description="Analyze your professional network and discover potential connections to enhance your career opportunities."
              icon={<Network size={24} />}
              path="/network-analysis"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
          >
            <FeatureCard
              title="Job Assessment"
              description="Match your resume with job descriptions to evaluate your suitability for specific roles."
              icon={<BriefcaseBusiness size={24} />}
              path="/job-assessment"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.7 }}
          >
            <FeatureCard
              title="Chatbot"
              description="Ask anything regarding your career advice, just don't think ask."
              icon={<BotIcon size={24} />}
              path="/chatbot"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.8 }}
          >
            <FeatureCard
              title="Interview Practice"
              description='Sharpen your skills with mock interviews tailored to real-world job roles and questions.'
              icon={<UsersIcon size={24} />}
              path="/interview"
            />
          </motion.div>

        </div>
      </section>
    </Layout>
  );
};

export default Home;
