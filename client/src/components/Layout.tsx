import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  FileText,
  BookOpen,
  BarChart,
  BriefcaseBusiness,
  GraduationCap,
  Home,
  Menu,
  X,
  BotIcon,
  VideoIcon,
  Coins,
  LogOut,
  FilePen,
  Mail,
  HandCoins,
  BadgeCheck,
  KanbanSquare,
  Timer,
  BookMarked,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/context/AuthContext";
import { fetchReadiness, READINESS_CHANGED_EVENT } from "@/lib/readiness";

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
}

const NavItem = ({ to, label, icon, isActive, onClick, badge }: NavItemProps) => (
  <Link
    to={to}
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm",
      isActive ? "bg-primary text-primary-foreground" : "text-gray-700 hover:bg-gray-100",
    )}
  >
    {icon}
    <span className="flex-1">{label}</span>
    {badge}
  </Link>
);

interface NavLink {
  path: string;
  label: string;
  icon: React.ReactNode;
}

// Grouped by where the user is in the job search.
const navSections: { title: string; items: NavLink[] }[] = [
  {
    title: "Overview",
    items: [
      { path: "/home", label: "Dashboard", icon: <Home size={20} /> },
      { path: "/applications", label: "Applications", icon: <KanbanSquare size={20} /> },
    ],
  },
  {
    title: "Build skills",
    items: [
      { path: "/skill-assessment", label: "Skill Assessment", icon: <BookOpen size={20} /> },
      { path: "/practice-tests", label: "Practice Tests", icon: <Timer size={20} /> },
      { path: "/portfolio", label: "Skill Portfolio", icon: <BadgeCheck size={20} /> },
    ],
  },
  {
    title: "Apply",
    items: [
      { path: "/resume-tips", label: "Resume Analyzer & Tips", icon: <FileText size={20} /> },
      { path: "/resume-tailor", label: "Resume Tailor", icon: <FilePen size={20} /> },
      { path: "/letters", label: "Cover Letters & Outreach", icon: <Mail size={20} /> },
      { path: "/job-assessment", label: "Job Match", icon: <BriefcaseBusiness size={20} /> },
    ],
  },
  {
    title: "Interview",
    items: [
      { path: "/practice-interview", label: "Practice Interview", icon: <VideoIcon size={20} /> },
      { path: "/stories", label: "Story Bank", icon: <BookMarked size={20} /> },
      { path: "/negotiation", label: "Salary Negotiation", icon: <HandCoins size={20} /> },
    ],
  },
  {
    title: "Explore",
    items: [
      { path: "/path-recommendation", label: "Career Paths", icon: <GraduationCap size={20} /> },
      { path: "/job-market", label: "Job Market", icon: <BarChart size={20} /> },
      { path: "/chatbot", label: "Career Chatbot", icon: <BotIcon size={20} /> },
    ],
  },
];

const CreditsPill: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const { user } = useAuth();
  return (
    <Link
      to="/billing"
      onClick={onClick}
      className="flex items-center justify-between gap-2 rounded-md border bg-amber-50 border-amber-200 px-3 py-2 text-sm hover:bg-amber-100"
    >
      <span className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-amber-500" />
        <strong>{user?.credits ?? 0}</strong> credits
      </span>
      <span className="text-primary font-medium">Buy</span>
    </Link>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [readiness, setReadiness] = React.useState<number | null>(null);
  React.useEffect(() => {
    const load = () =>
      fetchReadiness()
        .then((r) => setReadiness(r.target ? (r.score ?? 0) : null))
        .catch(() => undefined);
    load();
    window.addEventListener(READINESS_CHANGED_EVENT, load);
    return () => window.removeEventListener(READINESS_CHANGED_EVENT, load);
  }, [location.pathname]);
  const closeMenu = () => setIsMenuOpen(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {isMobile && (
        <header className="sticky top-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between">
          <Link to="/home" className="text-xl font-bold text-primary">
            Skill Sphere
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/billing" className="flex items-center gap-1 text-sm">
              <Coins className="h-4 w-4 text-amber-500" />
              {user?.credits ?? 0}
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Menu">
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
          </div>
        </header>
      )}

      <aside
        className={cn(
          "bg-gray-50 border-r transition-all duration-300 flex flex-col",
          isMobile
            ? `fixed inset-0 z-40 ${isMenuOpen ? "translate-x-0" : "-translate-x-full"} pt-16`
            : "w-64 min-h-screen sticky top-0 h-screen",
        )}
      >
        {!isMobile && (
          <div className="p-4 border-b">
            <Link to="/home" className="text-xl font-bold text-primary">
              Skill Sphere
            </Link>
          </div>
        )}

        <nav className="p-2 flex-1 overflow-y-auto space-y-3">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              <p className="px-4 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{section.title}</p>
              {section.items.map((item) => (
                <NavItem
                  key={item.path}
                  to={item.path}
                  label={item.label}
                  icon={item.icon}
                  isActive={location.pathname === item.path}
                  onClick={isMobile ? closeMenu : undefined}
                  badge={
                    item.path === "/home" && readiness !== null ? (
                      <span className="text-xs font-semibold rounded-full bg-white/80 text-primary border px-2" title="Readiness score">
                        {readiness}
                      </span>
                    ) : undefined
                  }
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t space-y-2">
          <CreditsPill onClick={isMobile ? closeMenu : undefined} />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs text-gray-500 truncate" title={user?.email}>
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className={cn("flex-1 min-w-0 transition-all duration-300 p-4 sm:p-6", isMobile && isMenuOpen ? "blur-sm" : "")}>
        {isMobile && isMenuOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30" onClick={closeMenu} />}
        {children}
      </main>
    </div>
  );
};

export default Layout;
