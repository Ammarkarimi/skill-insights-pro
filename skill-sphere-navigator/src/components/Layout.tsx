
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  BookOpen, 
  BarChart, 
  BriefcaseBusiness, 
  Network, 
  GraduationCap,
  Menu,
  X, 
  BotIcon,
  UsersIcon,
  VideoIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
 // Business person = interview

import path from 'path';

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick?: () => void;
}

const NavItem = ({ to, label, icon, isActive, onClick }: NavItemProps) => (
  <Link 
    to={to} 
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-3 rounded-md transition-colors",
      isActive 
        ? "bg-primary text-primary-foreground" 
        : "text-gray-700 hover:bg-gray-100"
    )}
  >
    {icon}
    <span>{label}</span>
  </Link>
);

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  const navItems = [
    { path: "/", label: "Home", icon: <FileText size={20} /> },
    { path: "/skill-assessment", label: "Skill Assessment", icon: <BookOpen size={20} /> },
    { path: "/job-market", label: "Job Market Analysis", icon: <BarChart size={20} /> },
    { path: "/resume-tips", label: "Resume & Interview Tips", icon: <FileText size={20} /> },
    { path: "/path-recommendation", label: "Path Recommendation", icon: <GraduationCap size={20} /> },
    { path: "/network-analysis", label: "Network Analysis", icon: <Network size={20} /> },
    { path: "/job-assessment", label: "Job Assessment", icon: <BriefcaseBusiness size={20} /> },
    { path: "/chatbot", label: "Chatbot", icon: <BotIcon size={20} /> },
    { path: "/practice-interview", label: "Practice Interview", icon: <VideoIcon size={20} /> },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Header */}
      {isMobile && (
        <header className="sticky top-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary">Skill Sphere</Link>
          <Button variant="ghost" size="icon" onClick={toggleMenu}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </Button>
        </header>
      )}
      
      {/* Sidebar Navigation */}
      <aside 
        className={cn(
          "bg-gray-50 border-r transition-all duration-300",
          isMobile 
            ? `fixed inset-0 z-40 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} pt-16` 
            : "w-64 min-h-screen"
        )}
      >
        {!isMobile && (
          <div className="p-4 border-b">
            <Link to="/" className="text-xl font-bold text-primary">Skill Sphere</Link>
          </div>
        )}
        
        <nav className="p-2 space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              to={item.path}
              label={item.label}
              icon={item.icon}
              isActive={location.pathname === item.path}
              onClick={isMobile ? closeMenu : undefined}
            />
          ))}
        </nav>
      </aside>
      
      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 p-6",
        isMobile && isMenuOpen ? "blur-sm" : ""
      )}>
        {/* Backdrop for mobile */}
        {isMobile && isMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={closeMenu}
          />
        )}
        
        {children}
      </main>
    </div>
  );
};

export default Layout;
