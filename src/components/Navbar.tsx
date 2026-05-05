import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, FileText, Home, Mic, Upload, Moon, Sun, Monitor, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/evaluate", label: "Initial Screening", icon: Mic },
  { path: "/upload-analysis", label: "L1 Tech Round", icon: Upload },
  { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { path: "/history", label: "History", icon: FileText },
];

export default function Navbar() {
  const location = useLocation();
  const [theme, setTheme] = useState<"dark" | "light" | "slate">("dark");
  
  // Quick auth check to ensure we only show the logout button to admins
  const isAuth = typeof window !== 'undefined' && sessionStorage.getItem("forgepro_auth") === "true";

  useEffect(() => {
    const savedTheme = (localStorage.getItem("forgepro_theme") as "dark" | "light" | "slate") || "dark";
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-slate");
    
    if (theme === "light") {
      root.classList.add("theme-light");
    } else if (theme === "slate") {
      root.classList.add("theme-slate");
    }
    
    localStorage.setItem("forgepro_theme", theme);
  }, [theme]);

  // 🛡️ THE FIX: ForgePro Anti-Sleep Keep-Alive Ping Engine
  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const API_URL = `${API_BASE.replace(/\/$/, "")}/api`;
    
    const pingEngine = () => {
      // Pings the backend to keep serverless hosts awake (Render, Heroku, etc.)
      fetch(`${API_URL}/health`).catch(() => {}); 
    };
    
    pingEngine(); 
    const interval = setInterval(pingEngine, 4 * 60 * 1000); // Pulse every 4 mins
    
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("forgepro_auth");
    window.location.href = "/"; // Instantly purges state and returns to login
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border transition-colors duration-300"
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-6">
        
        {/* BRANDING: Spinning Logo + ForgePro Text */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/20 overflow-hidden p-1 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
            <motion.img 
              animate={{ rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              src="/comp-logo.PNG" 
              alt="ForgePro Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-display text-lg font-bold tracking-wider text-foreground">
            ForgePro
          </span>
        </Link>

        {/* NAVIGATION LINKS */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* RIGHT SIDE: THEME SWITCHER & LOGOUT */}
        <div className="flex items-center gap-3">
          
          <div className="flex items-center gap-2 p-1 rounded-lg bg-muted/50 border border-border">
            <button
              onClick={() => setTheme("dark")}
              className={`p-1.5 rounded-md transition-all ${theme === "dark" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Dark Mode"
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme("slate")}
              className={`p-1.5 rounded-md transition-all ${theme === "slate" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Slate Mode"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`p-1.5 rounded-md transition-all ${theme === "light" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Light Mode"
            >
              <Sun className="w-4 h-4" />
            </button>
          </div>

          {/* DYNAMIC LOGOUT BUTTON */}
          {isAuth && (
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-all flex items-center justify-center"
              title="Secure Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

        </div>
      </div>
    </motion.nav>
  );
}