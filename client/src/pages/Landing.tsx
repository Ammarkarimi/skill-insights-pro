
// import React, { useState } from 'react';
// import { Link } from 'react-router-dom';
import { 
    Award, 
    BarChart, 
    Brain, 
    BriefcaseBusiness, 
  //   CheckCircle, 
    ChevronRight, 
  //   FileText, 
    GraduationCap, 
  //   Menu, 
    MessageSquare, 
  //   Network, 
    Search, 
    User, 
    UserPlus,
    Users,
  //   X
  } from 'lucide-react';
  import { Button } from '@/components/ui/button';
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { Input } from '@/components/ui/input';
  
  // // Team member data
  // const teamMembers = [
  //   {
  //     name: 'Team Member 1',
  //     role: 'ML Engineer',
  //     image: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80',
  //     social: {
  //       linkedin: '#',
  //       github: '#',
  //       twitter: '#'
  //     }
  //   },
  //   {
  //     name: 'Team Member 2',
  //     role: 'Frontend Developer',
  //     image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=698&q=80',
  //     social: {
  //       linkedin: '#',
  //       github: '#',
  //       twitter: '#'
  //     }
  //   },
  //   {
  //     name: 'Team Member 3',
  //     role: 'UI/UX Designer',
  //     image: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80',
  //     social: {
  //       linkedin: '#',
  //       github: '#',
  //       twitter: '#'
  //     }
  //   },
  //   {
  //     name: 'Team Member 4',
  //     role: 'Backend Developer',
  //     image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80',
  //     social: {
  //       linkedin: '#',
  //       github: '#',
  //       twitter: '#'
  //     }
  //   },
  //   {
  //     name: 'Team Member 5',
  //     role: 'Data Scientist',
  //     image: 'https://images.unsplash.com/photo-1556157382-97eda2f9e2bf?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80',
  //     social: {
  //       linkedin: '#',
  //       github: '#',
  //       twitter: '#'
  //     }
  //   }
  // ];
  
  // // Features data
  // const features = [
  //   {
  //     title: "Skills Assessment",
  //     description: "Comprehensive assessment of your technical and soft skills to identify strengths and areas for improvement.",
  //     icon: <Brain className="h-10 w-10 text-skill-primary" />,
  //     route: "/skill-assessment"
  //   },
  //   {
  //     title: "Job Market Analysis",
  //     description: "Real-time insights into industry trends, salary ranges, and in-demand skills for your target roles.",
  //     icon: <BarChart className="h-10 w-10 text-skill-primary" />,
  //     route: "/job-market"
  //   },
  //   {
  //     title: "Resume & Interview Tips",
  //     description: "Personalized recommendations to optimize your resume and ace your interviews with confidence.",
  //     icon: <FileText className="h-10 w-10 text-skill-primary" />,
  //     route: "/resume-tips"
  //   },
  //   {
  //     title: "Career Path Recommendations",
  //     description: "AI-driven career path suggestions based on your skills, experience, and career goals.",
  //     icon: <GraduationCap className="h-10 w-10 text-skill-primary" />,
  //     route: "/path-recommendation"
  //   },
  //   {
  //     title: "Network Analysis",
  //     description: "Strategic networking suggestions to connect with professionals who can help advance your career.",
  //     icon: <Network className="h-10 w-10 text-skill-primary" />,
  //     route: "/network-analysis"
  //   },
  //   {
  //     title: "Job Assessment",
  //     description: "Evaluate job opportunities against your skills and career goals to find the perfect match.",
  //     icon: <BriefcaseBusiness className="h-10 w-10 text-skill-primary" />,
  //     route: "/job-assessment"
  //   },
  //   {
  //     title: "Chatbot Assistant",
  //     description: "Get instant answers to your career questions with our AI-powered chatbot.",
  //     icon: <MessageSquare className="h-10 w-10 text-skill-primary" />,
  //     route: "/chatbot"
  //   },
  //   {
  //     title: "Interview Practice",
  //     description: "Practice interview scenarios with AI feedback to improve your performance.",
  //     icon: <Users className="h-10 w-10 text-skill-primary" />,
  //     route: "/practice-interview"
  //   }
  // ];
  
  // const Landing = () => {
  //   const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  //   return (
  //     <div className="min-h-screen flex flex-col">
  //       {/* Navigation */}
  //       <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md shadow-sm">
  //         <div className="container mx-auto px-4 py-4 flex justify-between items-center">
  //           <div className="flex items-center space-x-2">
  //             <GraduationCap className="h-8 w-8 text-skill-primary" />
  //             <span className="text-xl font-bold text-skill-dark">SkillSphere</span>
  //           </div>
            
  //           {/* Desktop Navigation */}
  //           <nav className="hidden md:flex items-center space-x-6">
  //             <Link to="/home" className="nav-button">Home</Link>
  //             <Link to="#features" className="nav-button">Features</Link>
  //             <Link to="#about" className="nav-button">About</Link>
  //             <Link to="#team" className="nav-button">Team</Link>
              
  //             <div className="flex items-center space-x-3 ml-6">
  //               <AuthDialogs />
  //             </div>
  //           </nav>
            
  //           {/* Mobile Menu Button */}
  //           <button 
  //             className="md:hidden text-skill-dark"
  //             onClick={() => setIsMenuOpen(!isMenuOpen)}
  //           >
  //             {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
  //           </button>
  //         </div>
          
  //         {/* Mobile Navigation */}
  //         {isMenuOpen && (
  //           <div className="md:hidden px-4 py-4 bg-white border-t border-gray-100 animate-fade-in">
  //             <nav className="flex flex-col space-y-4">
  //               <Link to="/home" className="nav-button" onClick={() => setIsMenuOpen(false)}>Home</Link>
  //               <Link to="#features" className="nav-button" onClick={() => setIsMenuOpen(false)}>Features</Link>
  //               <Link to="#about" className="nav-button" onClick={() => setIsMenuOpen(false)}>About</Link>
  //               <Link to="#team" className="nav-button" onClick={() => setIsMenuOpen(false)}>Team</Link>
                
  //               <div className="flex flex-col space-y-3 pt-4 border-t">
  //                 <AuthDialogs mobile={true} />
  //               </div>
  //             </nav>
  //           </div>
  //         )}
  //       </header>
  
  //       <main>
  //         {/* Hero Section */}
  //         <section className="hero-gradient text-white pb-20">
  //           <div className="container mx-auto px-4 pt-20 pb-16 md:py-32">
  //             <div className="max-w-3xl mx-auto text-center space-y-6">
  //               <h1 className="text-4xl md:text-6xl font-bold leading-tight animate-fade-in">
  //                 Navigate Your Career with Confidence
  //               </h1>
  //               <p className="text-lg md:text-xl opacity-90 md:leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
  //                 Your intelligent career advisor that guides you through job market trends, skill assessments,
  //                 and personalized recommendations for professional growth.
  //               </p>
  //               <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
  //                 <Link to="/skill-assessment" className="w-full sm:w-auto button-primary flex items-center justify-center gap-2">
  //                   Get Started <ChevronRight className="h-4 w-4" />
  //                 </Link>
  //                 <Link to="/job-market" className="w-full sm:w-auto button-secondary flex items-center justify-center gap-2">
  //                   Explore Market Trends <Search className="h-4 w-4" />
  //                 </Link>
  //               </div>
  //             </div>
  //           </div>
  //           <div className="w-full overflow-hidden">
  //             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="fill-white w-full h-auto">
  //               <path d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,42.7C1120,32,1280,32,1360,32L1440,32L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"></path>
  //             </svg>
  //           </div>
  //         </section>
  
  //         {/* Features Section */}
  //         <section id="features" className="section-padding bg-white">
  //           <div className="container mx-auto px-4">
  //             <div className="text-center max-w-2xl mx-auto mb-16">
  //               <span className="inline-block px-3 py-1 rounded-full bg-skill-light text-skill-primary font-medium text-sm mb-4">
  //                 Features
  //               </span>
  //               <h2 className="text-3xl md:text-4xl font-bold text-skill-dark mb-4">
  //                 Comprehensive Career Growth Tools
  //               </h2>
  //               <p className="text-gray-600">
  //                 Everything you need to assess your skills, analyze the job market, and advance your career, all in one platform.
  //               </p>
  //             </div>
  
  //             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  //               {features.map((feature, index) => (
  //                 <Link to={feature.route} key={index} className="feature-card group">
  //                   <div className="mb-4">{feature.icon}</div>
  //                   <h3 className="text-xl font-semibold mb-2 group-hover:text-skill-primary transition-colors">
  //                     {feature.title}
  //                   </h3>
  //                   <p className="text-gray-600 text-sm">
  //                     {feature.description}
  //                   </p>
  //                 </Link>
  //               ))}
  //             </div>
  //           </div>
  //         </section>
  
  //         {/* About Section */}
  //         <section id="about" className="section-padding bg-gray-50">
  //           <div className="container mx-auto px-4">
  //             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
  //               <div className="order-2 lg:order-1">
  //                 <span className="inline-block px-3 py-1 rounded-full bg-skill-light text-skill-primary font-medium text-sm mb-4">
  //                   About Skill Sphere
  //                 </span>
  //                 <h2 className="text-3xl md:text-4xl font-bold text-skill-dark mb-6">
  //                   Your AI-Powered Career Navigator
  //                 </h2>
  //                 <div className="space-y-4 text-gray-600">
  //                   <p>
  //                     Skill Sphere is an intelligent virtual career advisor designed to simplify your career journey and help you make data-driven decisions.
  //                   </p>
  //                   <p>
  //                     Our platform leverages advanced AI and machine learning to analyze your skills, compare them with current market demands, and provide personalized recommendations that align with your career goals.
  //                   </p>
  //                   <div className="pt-2">
  //                     <ul className="space-y-2">
  //                       {[
  //                         "AI-driven skill gap analysis",
  //                         "Real-time job market insights",
  //                         "Personalized career roadmaps",
  //                         "Interview preparation with AI feedback",
  //                         "Strategic networking suggestions",
  //                       ].map((item, i) => (
  //                         <li key={i} className="flex items-start">
  //                           <CheckCircle className="h-5 w-5 text-skill-primary shrink-0 mr-2 mt-0.5" />
  //                           <span>{item}</span>
  //                         </li>
  //                       ))}
  //                     </ul>
  //                   </div>
  //                 </div>
  //               </div>
  //               <div className="order-1 lg:order-2 relative">
  //                 <div className="relative z-10 bg-white rounded-xl shadow-xl overflow-hidden">
  //                   <img 
  //                     src="https://images.unsplash.com/photo-1551135049-8a33b5883817?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1770&q=80" 
  //                     alt="Career Growth" 
  //                     className="w-full h-auto object-cover"
  //                   />
  //                 </div>
  //                 <div className="absolute -bottom-6 -right-6 w-64 h-64 bg-skill-primary/20 rounded-full blur-3xl -z-10"></div>
  //                 <div className="absolute -top-6 -left-6 w-64 h-64 bg-skill-secondary/20 rounded-full blur-3xl -z-10"></div>
  //               </div>
  //             </div>
  //           </div>
  //         </section>
  
  
  //         {/* Team Section */}
  //         <section id="team" className="section-padding bg-white">
  //           <div className="container mx-auto px-4">
  //             <div className="text-center mb-16">
  //               <span className="inline-block px-3 py-1 rounded-full bg-skill-light text-skill-primary font-medium text-sm mb-4">
  //                 Our Team
  //               </span>
  //               <h2 className="text-3xl md:text-4xl font-bold text-skill-dark mb-4">
  //                 Meet the Minds Behind Skill Sphere
  //               </h2>
  //               <p className="text-gray-600 max-w-2xl mx-auto">
  //                 Our diverse team of experts combines AI technology, career coaching, and industry insights to create the ultimate career navigation platform.
  //               </p>
  //             </div>
  
  //             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
  //               {teamMembers.map((member, index) => (
  //                 <div key={index} className="team-card flex flex-col h-full">
  //                   <div className="relative overflow-hidden aspect-square">
  //                     <img 
  //                       src={member.image} 
  //                       alt={member.name} 
  //                       className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
  //                     />
  //                   </div>
  //                   <div className="p-4 flex-grow">
  //                     <h3 className="text-lg font-semibold">{member.name}</h3>
  //                     <p className="text-skill-primary text-sm">{member.role}</p>
  //                   </div>
  //                   <div className="px-4 pb-4 flex justify-center space-x-4">
  //                     <a href={member.social.linkedin} className="text-gray-500 hover:text-skill-primary transition-colors">
  //                       <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
  //                         <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.454C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
  //                       </svg>
  //                     </a>
  //                     <a href={member.social.github} className="text-gray-500 hover:text-skill-primary transition-colors">
  //                       <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
  //                         <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  //                       </svg>
  //                     </a>
  //                     <a href={member.social.twitter} className="text-gray-500 hover:text-skill-primary transition-colors">
  //                       <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
  //                         <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
  //                       </svg>
  //                     </a>
  //                   </div>
  //                 </div>
  //               ))}
  //             </div>
  //           </div>
  //         </section>
  //       </main>
  
  //       {/* Footer */}
  //       <footer className="bg-skill-dark text-white pt-16 pb-8">
  //         <div className="container mx-auto px-4">
  //           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
  //             <div>
  //               <div className="flex items-center space-x-2 mb-6">
  //                 <GraduationCap className="h-8 w-8 text-skill-primary" />
  //                 <span className="text-xl font-bold">SkillSphere</span>
  //               </div>
  //               <p className="text-gray-400 mb-6">
  //                 Your intelligent career advisor that guides you through market trends and personalized recommendations.
  //               </p>
  //               <div className="flex space-x-4">
  //                 {/* Social icons */}
  //                 <a href="#" className="text-gray-400 hover:text-skill-primary transition-colors">
  //                   <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
  //                     <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
  //                   </svg>
  //                 </a>
  //                 <a href="#" className="text-gray-400 hover:text-skill-primary transition-colors">
  //                   <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
  //                     <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
  //                   </svg>
  //                 </a>
  //                 <a href="#" className="text-gray-400 hover:text-skill-primary transition-colors">
  //                   <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
  //                     <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
  //                   </svg>
  //                 </a>
  //                 <a href="#" className="text-gray-400 hover:text-skill-primary transition-colors">
  //                   <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
  //                     <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
  //                   </svg>
  //                 </a>
  //               </div>
  //             </div>
  //             <div>
  //               <h4 className="text-lg font-semibold mb-4">Features</h4>
  //               <ul className="space-y-2">
  //                 <li><Link to="/skill-assessment" className="text-gray-400 hover:text-white transition-colors">Skills Assessment</Link></li>
  //                 <li><Link to="/job-market" className="text-gray-400 hover:text-white transition-colors">Job Market Analysis</Link></li>
  //                 <li><Link to="/resume-tips" className="text-gray-400 hover:text-white transition-colors">Resume & Interview Tips</Link></li>
  //                 <li><Link to="/path-recommendation" className="text-gray-400 hover:text-white transition-colors">Career Path Recommendations</Link></li>
  //                 <li><Link to="/network-analysis" className="text-gray-400 hover:text-white transition-colors">Network Analysis</Link></li>
  //               </ul>
  //             </div>
  //             <div>
  //               <h4 className="text-lg font-semibold mb-4">Resources</h4>
  //               <ul className="space-y-2">
  //                 <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
  //                 <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Career Guides</a></li>
  //                 <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Industry Reports</a></li>
  //                 <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Webinars</a></li>
  //                 <li><a href="#" className="text-gray-400 hover:text-white transition-colors">FAQs</a></li>
  //               </ul>
  //             </div>
  //             <div>
  //               <h4 className="text-lg font-semibold mb-4">Contact</h4>
  //               <ul className="space-y-2">
  //                 <li className="text-gray-400">Email: info@skillsphere.ai</li>
  //                 <li className="text-gray-400">Phone: +1 (555) 123-4567</li>
  //                 <li className="text-gray-400">Address: 123 Career Lane, Innovation City, CA 94043</li>
  //               </ul>
  //             </div>
  //           </div>
  //           <div className="pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
  //             <p>&copy; {new Date().getFullYear()} Skill Sphere. All rights reserved.</p>
  //           </div>
  //         </div>
  //       </footer>
  //     </div>
  //   );
  // };
  
  // // Authentication Dialog Component
  
  // export default Landing;
  
  // landing.tsx
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  // import React, { useState, useEffect } from 'react';
  // import { Link } from 'react-router-dom';
  // import './landing.css';
  
  // const Landing: React.FC = () => {
  //   const [isScrolled, setIsScrolled] = useState(false);
  //   const [isMenuOpen, setIsMenuOpen] = useState(false);
    
  //   useEffect(() => {
  //     const handleScroll = () => {
  //       setIsScrolled(window.scrollY > 50);
  //     };
      
  //     window.addEventListener('scroll', handleScroll);
  //     return () => window.removeEventListener('scroll', handleScroll);
  //   }, []);
  
  //   const toggleMenu = () => {
  //     setIsMenuOpen(!isMenuOpen);
  //   };
  
  //   return (
  //     <div className="landing-container">
  //       {/* Navigation */}
  //       <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
  //         <div className="navbar-container">
  //           <div className="logo">
  //             <Link to="/home">
  //               <span className="logo-text">Skill<span className="highlight">Sphere</span></span>
  //             </Link>
  //           </div>
            
  //           <div className="mobile-menu-icon" onClick={toggleMenu}>
  //             <i className={isMenuOpen ? "fas fa-times" : "fas fa-bars"}></i>
  //           </div>
            
  //           <ul className={`nav-menu ${isMenuOpen ? 'active' : ''}`}>
  //             <li><Link to="/home" className="nav-link">Home</Link></li>
  //             <li><Link to="/skill-assessment" className="nav-link">Skills</Link></li>
  //             <li><Link to="/job-market" className="nav-link">Market</Link></li>
  //             <li><Link to="/path-recommendation" className="nav-link">Career Paths</Link></li>
  //             <li><Link to="/network-analysis" className="nav-link">Network</Link></li>
  //             <li><Link to="/login" className="nav-button login">Login</Link></li>
  //             <li><Link to="/register" className="nav-button register">Register</Link></li>
  //           </ul>
  //         </div>
  //       </nav>
  
  //       {/* Hero Section */}
  //       <section className="hero-section">
  //         <div className="hero-content">
  //           <h1>Navigate Your Career Journey with AI-Powered Insights</h1>
  //           <p className="hero-subtitle">Unleash your professional potential with personalized guidance tailored to your skills and the market demand</p>
  //           <div className="hero-buttons">
  //             <Link to="/skill-assessment" className="primary-button">Start Assessment</Link>
  //             <Link to="/job-market" className="secondary-button">Explore Market</Link>
  //           </div>
  //         </div>
  //         <div className="hero-image">
  //           <img src="/api/placeholder/600/450" alt="Career advancement illustration" />
  //         </div>
  //       </section>
  
  //       {/* Features Section */}
  //       <section className="features-section">
  //         <div className="section-header">
  //           <h2>Intelligent Career Guidance at Your Fingertips</h2>
  //           <p>Our AI-driven platform offers comprehensive tools to help you succeed in today's competitive job market</p>
  //         </div>
          
  //         <div className="feature-cards">
  //           <div className="feature-card">
  //             <div className="feature-icon">
  //               <i className="fas fa-chart-line"></i>
  //             </div>
  //             <h3>Skills Assessment</h3>
  //             <p>Identify your strengths and areas for growth with our advanced assessment tools</p>
  //             <Link to="/skill-assessment" className="feature-link">Assess Now</Link>
  //           </div>
            
  //           <div className="feature-card">
  //             <div className="feature-icon">
  //               <i className="fas fa-search-dollar"></i>
  //             </div>
  //             <h3>Job Market Analysis</h3>
  //             <p>Gain insights into current market trends and discover in-demand opportunities</p>
  //             <Link to="/job-market" className="feature-link">Analyze Market</Link>
  //           </div>
            
  //           <div className="feature-card">
  //             <div className="feature-icon">
  //               <i className="fas fa-file-alt"></i>
  //             </div>
  //             <h3>Resume & Interview Tips</h3>
  //             <p>Optimize your resume and prepare for interviews with personalized guidance</p>
  //             <Link to="/resume-tips" className="feature-link">Get Tips</Link>
  //           </div>
            
  //           <div className="feature-card">
  //             <div className="feature-icon">
  //               <i className="fas fa-route"></i>
  //             </div>
  //             <h3>Career Path Recommendations</h3>
  //             <p>Discover personalized career trajectories based on your unique profile</p>
  //             <Link to="/path-recommendation" className="feature-link">Explore Paths</Link>
  //           </div>
  //         </div>
  //       </section>
  
  //       {/* How It Works Section */}
  //       <section className="how-it-works">
  //         <div className="section-header">
  //           <h2>How SkillSphere Works</h2>
  //           <p>Our intelligent platform simplifies your career journey in three easy steps</p>
  //         </div>
          
  //         <div className="steps-container">
  //           <div className="step">
  //             <div className="step-number">1</div>
  //             <div className="step-content">
  //               <h3>Assess Your Skills</h3>
  //               <p>Take our comprehensive assessment to discover your strengths, preferences, and areas for growth</p>
  //             </div>
  //           </div>
            
  //           <div className="step">
  //             <div className="step-number">2</div>
  //             <div className="step-content">
  //               <h3>Get Personalized Insights</h3>
  //               <p>Receive data-driven recommendations tailored to your profile and current market demands</p>
  //             </div>
  //           </div>
            
  //           <div className="step">
  //             <div className="step-number">3</div>
  //             <div className="step-content">
  //               <h3>Take Action</h3>
  //               <p>Implement actionable strategies to enhance your resume, ace interviews, and advance your career</p>
  //             </div>
  //           </div>
  //         </div>
  //       </section>
  
  //       {/* Tools Section */}
  //       <section className="tools-section">
  //         <div className="section-header">
  //           <h2>Powerful Career Tools</h2>
  //           <p>Access our suite of advanced career development tools</p>
  //         </div>
          
  //         <div className="tools-grid">
  //           <Link to="/chatbot" className="tool-card">
  //             <div className="tool-icon">
  //               <i className="fas fa-comment-dots"></i>
  //             </div>
  //             <h3>AI Career Chatbot</h3>
  //             <p>Get instant answers to your career questions</p>
  //           </Link>
            
  //           <Link to="/practice-interview" className="tool-card">
  //             <div className="tool-icon">
  //               <i className="fas fa-video"></i>
  //             </div>
  //             <h3>Interview Practice</h3>
  //             <p>Prepare with realistic interview simulations</p>
  //           </Link>
            
  //           <Link to="/job-assessment" className="tool-card">
  //             <div className="tool-icon">
  //               <i className="fas fa-briefcase"></i>
  //             </div>
  //             <h3>Job Match Analysis</h3>
  //             <p>Find positions that align with your skills</p>
  //           </Link>
            
  //           <Link to="/network-analysis" className="tool-card">
  //             <div className="tool-icon">
  //               <i className="fas fa-network-wired"></i>
  //             </div>
  //             <h3>Network Intelligence</h3>
  //             <p>Strategically expand your professional network</p>
  //           </Link>
  //         </div>
  //       </section>
  
  //       {/* Testimonials */}
  //       <section className="testimonials-section">
  //         <div className="section-header">
  //           <h2>Success Stories</h2>
  //           <p>See how SkillSphere has transformed careers</p>
  //         </div>
          
  //         <div className="testimonials-container">
  //           <div className="testimonial-card">
  //             <div className="testimonial-content">
  //               <p>"SkillSphere helped me identify skills gaps that were holding me back. After following their recommendations, I secured a position with a 30% salary increase!"</p>
  //             </div>
  //             <div className="testimonial-author">
  //               <div className="author-avatar">
  //                 <img src="/api/placeholder/60/60" alt="User profile" />
  //               </div>
  //               <div className="author-info">
  //                 <h4>Sarah Johnson</h4>
  //                 <p>Software Developer</p>
  //               </div>
  //             </div>
  //           </div>
            
  //           <div className="testimonial-card">
  //             <div className="testimonial-content">
  //               <p>"The market analysis feature gave me insights into emerging fields where my skills were highly valued. This completely changed my job search strategy for the better."</p>
  //             </div>
  //             <div className="testimonial-author">
  //               <div className="author-avatar">
  //                 <img src="/api/placeholder/60/60" alt="User profile" />
  //               </div>
  //               <div className="author-info">
  //                 <h4>Michael Tan</h4>
  //                 <p>Data Analyst</p>
  //               </div>
  //             </div>
  //           </div>
            
  //           <div className="testimonial-card">
  //             <div className="testimonial-content">
  //               <p>"The interview practice tool was a game-changer! I felt so prepared and confident during my actual interviews, and received multiple offers as a result."</p>
  //             </div>
  //             <div className="testimonial-author">
  //               <div className="author-avatar">
  //                 <img src="/api/placeholder/60/60" alt="User profile" />
  //               </div>
  //               <div className="author-info">
  //                 <h4>Priya Patel</h4>
  //                 <p>Marketing Manager</p>
  //               </div>
  //             </div>
  //           </div>
  //         </div>
  //       </section>
        
  //       {/* Stats Section */}
  //       <section className="stats-section">
  //         <div className="stats-container">
  //           <div className="stat-item">
  //             <h3>5000+</h3>
  //             <p>Career Paths Analyzed</p>
  //           </div>
  //           <div className="stat-item">
  //             <h3>85%</h3>
  //             <p>Success Rate</p>
  //           </div>
  //           <div className="stat-item">
  //             <h3>25K+</h3>
  //             <p>Active Users</p>
  //           </div>
  //           <div className="stat-item">
  //             <h3>3X</h3>
  //             <p>Interview Success</p>
  //           </div>
  //         </div>
  //       </section>
  
  //       {/* Call to Action */}
  //       <section className="cta-section">
  //         <div className="cta-content">
  //           <h2>Ready to Transform Your Career Journey?</h2>
  //           <p>Join thousands of professionals who have accelerated their careers with SkillSphere</p>
  //           <div className="cta-buttons">
  //             <Link to="/register" className="primary-button">Get Started for Free</Link>
  //             <Link to="/skill-assessment" className="secondary-button">Try Demo</Link>
  //           </div>
  //         </div>
  //       </section>
  
  //       {/* Team Section */}
  //       <section className="team-section">
  //         <div className="section-header">
  //           <h2>Meet Our Team</h2>
  //           <p>The minds behind SkillSphere committed to transforming career development</p>
  //         </div>
          
  //         <div className="team-members">
  //           <div className="team-member">
  //             <div className="member-image">
  //               <img src="/api/placeholder/180/180" alt="Team member" />
  //             </div>
  //             <h3>Team Member 1</h3>
  //             <p>Full Stack Developer</p>
  //             <div className="social-icons">
  //               <a href="#" className="social-icon"><i className="fab fa-linkedin"></i></a>
  //               <a href="#" className="social-icon"><i className="fab fa-github"></i></a>
  //             </div>
  //           </div>
            
  //           <div className="team-member">
  //             <div className="member-image">
  //               <img src="/api/placeholder/180/180" alt="Team member" />
  //             </div>
  //             <h3>Team Member 2</h3>
  //             <p>UI/UX Designer</p>
  //             <div className="social-icons">
  //               <a href="#" className="social-icon"><i className="fab fa-linkedin"></i></a>
  //               <a href="#" className="social-icon"><i className="fab fa-github"></i></a>
  //             </div>
  //           </div>
            
  //           <div className="team-member">
  //             <div className="member-image">
  //               <img src="/api/placeholder/180/180" alt="Team member" />
  //             </div>
  //             <h3>Team Member 3</h3>
  //             <p>Machine Learning Engineer</p>
  //             <div className="social-icons">
  //               <a href="#" className="social-icon"><i className="fab fa-linkedin"></i></a>
  //               <a href="#" className="social-icon"><i className="fab fa-github"></i></a>
  //             </div>
  //           </div>
            
  //           <div className="team-member">
  //             <div className="member-image">
  //               <img src="/api/placeholder/180/180" alt="Team member" />
  //             </div>
  //             <h3>Team Member 4</h3>
  //             <p>Data Scientist</p>
  //             <div className="social-icons">
  //               <a href="#" className="social-icon"><i className="fab fa-linkedin"></i></a>
  //               <a href="#" className="social-icon"><i className="fab fa-github"></i></a>
  //             </div>
  //           </div>
            
  //           <div className="team-member">
  //             <div className="member-image">
  //               <img src="/api/placeholder/180/180" alt="Team member" />
  //             </div>
  //             <h3>Team Member 5</h3>
  //             <p>Product Manager</p>
  //             <div className="social-icons">
  //               <a href="#" className="social-icon"><i className="fab fa-linkedin"></i></a>
  //               <a href="#" className="social-icon"><i className="fab fa-github"></i></a>
  //             </div>
  //           </div>
  //         </div>
  //       </section>
  
  //       {/* Footer */}
  //       <footer className="footer">
  //         <div className="footer-container">
  //           <div className="footer-logo">
  //             <span className="logo-text">Skill<span className="highlight">Sphere</span></span>
  //             <p>Your AI-powered career companion</p>
  //           </div>
            
  //           <div className="footer-links">
  //             <div className="link-column">
  //               <h4>Platform</h4>
  //               <ul>
  //                 <li><Link to="/skill-assessment">Skills Assessment</Link></li>
  //                 <li><Link to="/job-market">Job Market Analysis</Link></li>
  //                 <li><Link to="/resume-tips">Resume Builder</Link></li>
  //                 <li><Link to="/path-recommendation">Career Paths</Link></li>
  //               </ul>
  //             </div>
              
  //             <div className="link-column">
  //               <h4>Tools</h4>
  //               <ul>
  //                 <li><Link to="/chatbot">AI Career Chatbot</Link></li>
  //                 <li><Link to="/practice-interview">Interview Practice</Link></li>
  //                 <li><Link to="/job-assessment">Job Match Analysis</Link></li>
  //                 <li><Link to="/network-analysis">Network Intelligence</Link></li>
  //               </ul>
  //             </div>
              
  //             <div className="link-column">
  //               <h4>Company</h4>
  //               <ul>
  //                 <li><Link to="/about">About Us</Link></li>
  //                 <li><Link to="/contact">Contact</Link></li>
  //                 <li><Link to="/privacy">Privacy Policy</Link></li>
  //                 <li><Link to="/terms">Terms of Service</Link></li>
  //               </ul>
  //             </div>
  //           </div>
            
  //           <div className="newsletter">
  //             <h4>Stay Updated</h4>
  //             <p>Subscribe to our newsletter for career tips and updates</p>
  //             <div className="newsletter-form">
  //               <input type="email" placeholder="Your email address" />
  //               <button>Subscribe</button>
  //             </div>
  //             <div className="social-links">
  //               <a href="#" className="social-link"><i className="fab fa-twitter"></i></a>
  //               <a href="#" className="social-link"><i className="fab fa-linkedin"></i></a>
  //               <a href="#" className="social-link"><i className="fab fa-instagram"></i></a>
  //             </div>
  //           </div>
  //         </div>
          
  //         <div className="copyright">
  //           <p>&copy; {new Date().getFullYear()} SkillSphere. All rights reserved.</p>
  //         </div>
  //       </footer>
  //     </div>
  //   );
  // };
  
  // export default Landing;
  
  
  
  
  
  "use client"
  
  import { useState, useEffect } from "react"
  import { Link, Navigate } from "react-router-dom"
  import "./landing.css"
  import {
    Menu,
    X,
    ChevronDown,
    CheckCircle,
    BarChart2,
    FileText,
    Compass,
    Network,
    Briefcase,
    MessageCircle,
    Video,
  } from "lucide-react"
  
  const Landing = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [activeSection, setActiveSection] = useState("home")
  
    useEffect(() => {
      const handleScroll = () => {
        const sections = document.querySelectorAll("section")
        const scrollPosition = window.scrollY + 300
  
        sections.forEach((section) => {
          const sectionTop = section.offsetTop
          const sectionHeight = section.offsetHeight
          const sectionId = section.getAttribute("id")
  
          if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            setActiveSection(sectionId || "home")
          }
        })
      }
  
      window.addEventListener("scroll", handleScroll)
      return () => window.removeEventListener("scroll", handleScroll)
    }, [])
  
    const toggleMenu = () => {
      setIsMenuOpen(!isMenuOpen)
    }
  
    const scrollToSection = (sectionId: string) => {
      const section = document.getElementById(sectionId)
      if (section) {
        window.scrollTo({
          top: section.offsetTop - 100,
          behavior: "smooth",
        })
      }
      setIsMenuOpen(false)
    }
  
    const AuthDialogs = ({ mobile = false }: { mobile?: boolean }) => {
      return (
        <>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className={`${mobile ? 'w-full' : ''} flex items-center gap-2`}>
                <User className="h-4 w-4" />
                <span>Login</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Login</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Email
                      </label>
                      <Input
                        id="email"
                        placeholder="example@example.com"
                        type="email"
                        autoCapitalize="none"
                        autoComplete="email"
                        autoCorrect="off"
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Password
                      </label>
                      <Input
                        id="password"
                        type="password"
                        className="w-full"
                      />
                    </div>
                    <Link to={"home"}>
                    <Button className="w-full bg-skill-primary hover:bg-skill-secondary text-black">
                      Login
                    </Button>
                    </Link>
                  </div>
                </TabsContent>
                <TabsContent value="register">
                <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="first-name" className="text-sm font-medium">
                            First name
                          </label>
                          <Input id="first-name" placeholder="John" />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="last-name" className="text-sm font-medium">
                            Last name
                          </label>
                          <Input id="last-name" placeholder="Doe" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="register-email" className="text-sm font-medium">
                          Email
                        </label>
                        <Input id="register-email" placeholder="example@example.com" type="email" />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="register-password" className="text-sm font-medium">
                          Password
                        </label>
                        <Input id="register-password" type="password" />
                      </div>
                      <Button className="w-full bg-skill-primary hover:bg-skill-secondary text-black">
                        Register
                      </Button>
                    </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
    
          <Dialog>
            <DialogTrigger asChild>
              <Button className={`${mobile ? 'w-full' : ''} flex items-center gap-2 bg-skill-primary hover:bg-skill-secondary`}>
                <UserPlus className="h-4 w-4" />
                <span>Register</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create an account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="first-name-dialog" className="text-sm font-medium">
                      First name
                    </label>
                    <Input id="first-name-dialog" placeholder="John" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="last-name-dialog" className="text-sm font-medium">
                      Last name
                    </label>
                    <Input id="last-name-dialog" placeholder="Doe" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="email-dialog" className="text-sm font-medium">
                    Email
                  </label>
                  <Input id="email-dialog" placeholder="example@example.com" type="email" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password-dialog" className="text-sm font-medium">
                    Password
                  </label>
                  <Input id="password-dialog" type="password" />
                </div>
                <Button className="w-full bg-skill-primary hover:bg-skill-secondary text-white">
                  Register
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      );
    };
    
  
    const features = [
      {
        icon: <CheckCircle className="feature-icon" />,
        title: "Skills Assessment",
        description: "Evaluate your current skills and identify areas for improvement",
        route: "/skill-assessment",
      },
      {
        icon: <BarChart2 className="feature-icon" />,
        title: "Job Market Analysis",
        description: "Get insights into current job market trends and demands",
        route: "/job-market",
      },
      {
        icon: <FileText className="feature-icon" />,
        title: "Resume & Interview Tips",
        description: "Optimize your resume and prepare for interviews with expert advice",
        route: "/resume-tips",
      },
      {
        icon: <Compass className="feature-icon" />,
        title: "Path Recommendation",
        description: "Receive personalized career path recommendations based on your profile",
        route: "/path-recommendation",
      },
      {
        icon: <Network className="feature-icon" />,
        title: "Network Analysis",
        description: "Analyze and optimize your professional network for better opportunities",
        route: "/network-analysis",
      },
      {
        icon: <Briefcase className="feature-icon" />,
        title: "Job Assessment",
        description: "Evaluate job opportunities against your skills and career goals",
        route: "/job-assessment",
      },
      {
        icon: <MessageCircle className="feature-icon" />,
        title: "AI Career Chatbot",
        description: "Get instant answers to your career questions from our AI assistant",
        route: "/chatbot",
      },
      {
        icon: <Video className="feature-icon" />,
        title: "Interview Practice",
        description: "Practice interviews with AI-powered simulations and get feedback",
        route: "/practice-interview",
      },
    ]
  
    const teamMembers = [
      {
        name: "Ammar Karimi",
        role: "Founder & CEO",
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        name: "Dhairya Patel",
        role: "Executive Manager",
        image: "/placeholder.svg?height=200&width=200",
      },
      {
        name: "Nishchay Agrawal",
        role: "Executive Manager",
        image: "/placeholder.svg?height=200&width=200",
      },
    ]
  
    return (
      <div className="landing-container">
        {/* Header */}
        <header className="header">
          <div className="logo-container">
            <h1 className="logo">
              Skill<span>Sphere</span>
            </h1>
          </div>
          <nav className={`nav-links ${isMenuOpen ? "active" : ""}`}>
            <ul>
              <li className={activeSection === "home" ? "active" : ""}>
                <button onClick={() => scrollToSection("home")}>Home</button>
              </li>
              <li className={activeSection === "features" ? "active" : ""}>
                <button onClick={() => scrollToSection("features")}>Features</button>
              </li>
              <li className={activeSection === "how-it-works" ? "active" : ""}>
                <button onClick={() => scrollToSection("how-it-works")}>How It Works</button>
              </li>
              <li className={activeSection === "team" ? "active" : ""}>
                <button onClick={() => scrollToSection("team")}>Team</button>
              </li>
              <li className="auth-buttons mobile">
                {/* <Link to="/login" className="btn btn-login">
                  Login
                </Link> */}
                <div className="flex items-center space-x-3 ml-6">
                 <AuthDialogs />
               </div>
                {/* <Link to="/register" className="btn btn-register">
                  Register
                </Link> */}
              </li>
            </ul>
          </nav>
          <div className="auth-buttons desktop">
            {/* <Link to="/login" className="btn btn-login">
              Login
            </Link> */}
            <div className="flex items-center space-x-3 ml-6">
                 <AuthDialogs />
               </div>
            {/* <Link to="/register" className="btn btn-register">
              Register
            </Link> */}
          </div>
          <button className="menu-toggle" onClick={toggleMenu}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>
  
        {/* Hero Section */}
        <section id="home" className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">Navigate Your Career Journey with AI-Powered Guidance</h1>
            <p className="hero-subtitle">
              Skill Sphere helps you assess your skills, analyze job markets, and build a strategic career path tailored
              to your goals.
            </p>
            <div className="hero-buttons">
              <Link to="/home" className="btn btn-primary">
                Get Started
              </Link>
              
              <Link to="/skill-assessment" className="btn btn-secondary">
                Try Skills Assessment
              </Link>
            </div>
          </div>
          <div className="hero-image">
            <img src="/herop.webp?height=500&width=600" alt="Career growth illustration" />
          </div>
        </section>
  
        {/* Features Section */}
        <section id="features" className="features-section">
          <div className="section-header">
            <h2>Powerful Features to Accelerate Your Career</h2>
            <p>Discover the tools that will help you navigate your professional journey</p>
          </div>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div className="feature-card" key={index}>
                <div className="feature-icon-container">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <Link to={feature.route} className="feature-link">
                  Explore <ChevronDown size={16} className="feature-arrow" />
                </Link>
              </div>
            ))}
          </div>
        </section>
  
        {/* How It Works Section */}
        <section id="how-it-works" className="how-it-works-section">
          <div className="section-header">
            <h2>How Skill Sphere Works</h2>
            <p>Your journey to career success in four simple steps</p>
          </div>
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Assess Your Skills</h3>
                <p>Take our comprehensive skills assessment to identify your strengths and areas for improvement.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Analyze Market Trends</h3>
                <p>Get insights into current job market trends and understand what employers are looking for.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Receive Personalized Recommendations</h3>
                <p>Based on your profile and goals, we'll provide tailored career path recommendations.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>Implement and Grow</h3>
                <p>Use our tools to optimize your resume, practice interviews, and strategically network.</p>
              </div>
            </div>
          </div>
        </section>
  
        {/* Statistics Section */}
        {/* <section className="statistics-section">
          <div className="statistic">
            <h3>10,000+</h3>
            <p>Career Paths Analyzed</p>
          </div>
          <div className="statistic">
            <h3>85%</h3>
            <p>Success Rate</p>
          </div>
          <div className="statistic">
            <h3>5,000+</h3>
            <p>Happy Users</p>
          </div>
          <div className="statistic">
            <h3>24/7</h3>
            <p>AI Support</p>
          </div>
        </section> */}
  
        {/* Testimonials Section */}
        {/* <section className="testimonials-section">
          <div className="section-header">
            <h2>What Our Users Say</h2>
            <p>Success stories from professionals who transformed their careers with Skill Sphere</p>
          </div>
          <div className="testimonials-container">
            <div className="testimonial">
              <div className="testimonial-content">
                <p>
                  "Skill Sphere helped me identify the skills I needed to transition into a tech role. Within 3 months, I
                  landed my dream job!"
                </p>
              </div>
              <div className="testimonial-author">
                <img src="/placeholder.svg?height=60&width=60" alt="Testimonial author" />
                <div>
                  <h4>Sarah Johnson</h4>
                  <p>Software Developer</p>
                </div>
              </div>
            </div>
            <div className="testimonial">
              <div className="testimonial-content">
                <p>
                  "The job market analysis feature gave me insights I couldn't find anywhere else. It completely changed
                  my approach to job hunting."
                </p>
              </div>
              <div className="testimonial-author">
                <img src="/placeholder.svg?height=60&width=60" alt="Testimonial author" />
                <div>
                  <h4>Michael Chen</h4>
                  <p>Marketing Specialist</p>
                </div>
              </div>
            </div>
            <div className="testimonial">
              <div className="testimonial-content">
                <p>
                  "The interview practice tool was a game-changer. I felt so much more confident and prepared for my
                  interviews."
                </p>
              </div>
              <div className="testimonial-author">
                <img src="/placeholder.svg?height=60&width=60" alt="Testimonial author" />
                <div>
                  <h4>Emily Rodriguez</h4>
                  <p>Project Manager</p>
                </div>
              </div>
            </div>
          </div>
        </section> */}
  
        {/* Team Section */}
        <section id="team" className="team-section">
          <div className="section-header">
            <h2>Meet Our Team</h2>
            <p>The minds behind Skill Sphere working to transform career guidance</p>
          </div>
          <div className="team-grid">
            {teamMembers.map((member, index) => (
              <div className="team-member" key={index}>
                <div className="member-image">
                  <img src={member.image || "/placeholder.svg"} alt={member.name} />
                </div>
                <h3>{member.name}</h3>
                <p>{member.role}</p>
                <div className="social-links">
                  <a href="#" aria-label="LinkedIn">
                    <i className="fab fa-linkedin"></i>
                  </a>
                  <a href="#" aria-label="GitHub">
                    <i className="fab fa-github"></i>
                  </a>
                  <a href="#" aria-label="Twitter">
                    <i className="fab fa-twitter"></i>
                  </a>
                </div>
              </div>
            ))}
          </div>
          
        </section>
  
        {/* CTA Section */}
        <section className="cta-section">
          <div className="cta-content">
            <h2>Ready to Transform Your Career?</h2>
            <p>Join thousands of professionals who have accelerated their career growth with Skill Sphere</p>
            <Link to="/home" className="btn btn-cta">
              Get Started Today
            </Link>
          </div>
        </section>
  
  
        {/* Footer */}
        <footer className="footer">
          <div className="footer-content">
            <div className="footer-logo">
              <h2>
                Skill<span>Sphere</span>
              </h2>
              <p>Your AI-powered career advisor</p>
            </div>
            <div className="footer-links">
              <div className="footer-column">
                <h3>Features</h3>
                <ul>
                  <li>
                    <Link to="/skill-assessment">Skills Assessment</Link>
                  </li>
                  <li>
                    <Link to="/job-market">Job Market Analysis</Link>
                  </li>
                  <li>
                    <Link to="/resume-tips">Resume & Interview Tips</Link>
                  </li>
                  <li>
                    <Link to="/path-recommendation">Path Recommendation</Link>
                  </li>
                </ul>
              </div>
              <div className="footer-column">
                <h3>Resources</h3>
                <ul>
                  <li>
                    <Link to="/network-analysis">Network Analysis</Link>
                  </li>
                  <li>
                    <Link to="/job-assessment">Job Assessment</Link>
                  </li>
                  <li>
                    <Link to="/chatbot">AI Chatbot</Link>
                  </li>
                  <li>
                    <Link to="/practice-interview">Interview Practice</Link>
                  </li>
                </ul>
              </div>
              <div className="footer-column">
                <h3>Company</h3>
                <ul>
                  <li>
                    <a href="#">About Us</a>
                  </li>
                  <li>
                    <a href="#">Contact</a>
                  </li>
                  <li>
                    <a href="#">Privacy Policy</a>
                  </li>
                  <li>
                    <a href="#">Terms of Service</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} Skill Sphere. All rights reserved.</p>
          </div>
        </footer>
      </div>
    )
  }
  
  export default Landing
  