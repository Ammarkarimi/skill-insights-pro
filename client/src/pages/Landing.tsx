  
  import { useState, useEffect } from "react"
  import { Link } from "react-router-dom"
  import "./landing.css"
  import { Button } from "@/components/ui/button"
  import { useAuth } from "@/context/AuthContext"
  import { formatMoney } from "@/lib/api"
  import { COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/pricing"
  import {
    Menu,
    X,
    ChevronDown,
    CheckCircle,
    BarChart2,
    FileText,
    Compass,
    Briefcase,
    Video,
    Target,
    ShieldCheck,
    FilePen,
    HandCoins,
    Mail,
    BadgeCheck,
  } from "lucide-react"
  
  const Landing = () => {
    const { user, pricing } = useAuth()
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
  
    const features = [
      {
        icon: <Target className="feature-icon" />,
        title: "Readiness Score",
        description: "Pick the job you want and see a 0-100 score for how ready you are, requirement by requirement, with the next best step",
        route: "/home",
      },
      {
        icon: <ShieldCheck className="feature-icon" />,
        title: "Defend Your Resume",
        description: "An AI interviewer probes the claims on your resume with follow-up questions and tells you which ones hold up",
        route: "/practice-interview?mode=deep",
      },
      {
        icon: <BadgeCheck className="feature-icon" />,
        title: "Skill Portfolio",
        description: "Prove skills with timed adaptive tests and reviewed GitHub projects, then share one verified link with recruiters",
        route: "/portfolio",
      },
      {
        icon: <FilePen className="feature-icon" />,
        title: "Resume Tailor",
        description: "Rewrite your resume for any job, honestly, and download an ATS-friendly Word or PDF file",
        route: "/resume-tailor",
      },
      {
        icon: <HandCoins className="feature-icon" />,
        title: "Salary Negotiation",
        description: "Negotiate with an AI recruiter who has a hidden budget, then see what you left on the table",
        route: "/negotiation",
      },
      {
        icon: <Mail className="feature-icon" />,
        title: "Cover Letters & Outreach",
        description: "Cover letters, recruiter emails, LinkedIn notes and referral requests built from your real experience",
        route: "/letters",
      },
      {
        icon: <CheckCircle className="feature-icon" />,
        title: "Skills Assessment",
        description: "Targeted tests with explanations and a learning path built from your mistakes",
        route: "/skill-assessment",
      },
      {
        icon: <FileText className="feature-icon" />,
        title: "Resume Analyzer",
        description: "Recruiter-grade scores and line-by-line rewrites for your resume",
        route: "/resume-tips",
      },
      {
        icon: <Video className="feature-icon" />,
        title: "Interview Practice",
        description: "Voice or text mock interviews with scored feedback and model answers",
        route: "/practice-interview",
      },
      {
        icon: <BarChart2 className="feature-icon" />,
        title: "Job Market & Career Paths",
        description: "Demand, salary bands and the career paths that fit your skills",
        route: "/job-market",
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
              <li className={activeSection === "pricing" ? "active" : ""}>
                <button onClick={() => scrollToSection("pricing")}>Pricing</button>
              </li>
              <li className={activeSection === "team" ? "active" : ""}>
                <button onClick={() => scrollToSection("team")}>Team</button>
              </li>
              <li className="auth-buttons mobile">
                <div className="flex items-center gap-3 ml-6">
                  {user ? (
                    <Button asChild><Link to="/home">Go to dashboard</Link></Button>
                  ) : (
                    <>
                      <Button asChild variant="outline"><Link to="/login">Log in</Link></Button>
                      <Button asChild><Link to="/register">Get started free</Link></Button>
                    </>
                  )}
                </div>
              </li>
            </ul>
          </nav>
          <div className="auth-buttons desktop">
            <div className="flex items-center gap-3 ml-6">
                  {user ? (
                    <Button asChild><Link to="/home">Go to dashboard</Link></Button>
                  ) : (
                    <>
                      <Button asChild variant="outline"><Link to="/login">Log in</Link></Button>
                      <Button asChild><Link to="/register">Get started free</Link></Button>
                    </>
                  )}
                </div>
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
              Pick the job you want. Skill Sphere measures how ready you are for it, from your skills, resume and
              interviews, and shows you the fastest way to close the gaps.
            </p>
            <div className="hero-buttons">
              <Link to={user ? "/home" : "/register"} className="btn btn-primary">
                {user ? "Go to dashboard" : `Start free with ${pricing?.freeSignupCredits ?? 10} credits`}
              </Link>
              <button onClick={() => scrollToSection("pricing")} className="btn btn-secondary">
                See pricing
              </button>
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
  
        {/* Pricing Section */}
        <section id="pricing" className="features-section">
          <div className="section-header">
            <h2>Simple, pay-as-you-go pricing</h2>
            <p>
              No subscription. Start with {pricing?.freeSignupCredits ?? 10} free credits, then top up when you need
              more. Credits never expire, and failed requests are never charged.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-4">
            {(pricing?.packs ?? []).map((pack) => (
              <div
                key={pack.id}
                className={`rounded-xl border bg-white p-6 shadow-sm flex flex-col ${pack.highlight ? "border-2 border-indigo-500" : ""}`}
              >
                {pack.highlight && <span className="text-xs font-semibold text-indigo-600 mb-2">MOST POPULAR</span>}
                <h3 className="text-xl font-bold">{pack.name}</h3>
                <p className="text-gray-500 text-sm mb-4">{pack.description}</p>
                <div className="text-4xl font-bold mb-1">{formatMoney(pack.price_cents, pricing?.currency ?? "usd")}</div>
                <div className="text-gray-600 mb-6">{pack.credits} credits</div>
                <Button asChild className="mt-auto" variant={pack.highlight ? "default" : "outline"}>
                  <Link to={user ? "/billing" : "/register"}>{user ? "Buy credits" : "Get started"}</Link>
                </Button>
              </div>
            ))}
          </div>
          {pricing && (
            <div className="max-w-3xl mx-auto mt-10 px-4 text-sm text-gray-600 grid grid-cols-2 md:grid-cols-3 gap-2">
              <span>Resume analysis: {pricing.costs.resume_analysis} credits</span>
              <span>Skill assessment: {pricing.costs.assessment_questions} credits</span>
              <span>Learning path: {pricing.costs.learning_path} credits</span>
              <span>Mock interview: {pricing.costs.interview_questions + pricing.costs.interview_evaluation} credits</span>
              <span>Defend-your-resume interview: {pricing.costs.deep_interview_start + pricing.costs.deep_interview_report} credits</span>
              <span>Readiness scorecard: {pricing.costs.target_role_setup} credits per role</span>
              <span>Tailored resume + Word/PDF: {pricing.costs.resume_tailor} credits</span>
              <span>Cover letter or outreach: {pricing.costs.letter} credit</span>
              <span>Negotiation practice: {pricing.costs.negotiation_start + pricing.costs.negotiation_report} credits</span>
              <span>Skill proof test: {pricing.costs.proof_assessment} credits</span>
              <span>GitHub project review: {pricing.costs.project_review} credits</span>
              <span>Job match: {pricing.costs.job_match_per_resume} credits/resume</span>
              <span>Chat message: {pricing.costs.chat_message} credit</span>
            </div>
          )}
        </section>

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
              </div>
            ))}
          </div>
          
        </section>
  
        {/* CTA Section */}
        <section className="cta-section">
          <div className="cta-content">
            <h2>Ready to Transform Your Career?</h2>
            <p>Get personalised, AI-powered feedback on your skills, resume and interviews in minutes.</p>
            <Link to={user ? "/home" : "/register"} className="btn btn-cta">
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
                    <a href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>
                  </li>
                  <li>
                    <Link to="/privacy">Privacy Policy</Link>
                  </li>
                  <li>
                    <Link to="/terms">Terms of Service</Link>
                  </li>
                  <li>
                    <Link to="/refunds">Refund Policy</Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.</p>
          </div>
        </footer>
      </div>
    )
  }
  
  export default Landing
  