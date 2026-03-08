import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, BarChart3, FileText, Home, Mic, Upload } from "lucide-react";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/evaluate", label: "Interview", icon: Mic },
  { path: "/upload-analysis", label: "Upload", icon: Upload },
  { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { path: "/history", label: "History", icon: FileText },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border"
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-6">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center glow-cyan">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <span className="font-display text-lg font-bold tracking-wider text-foreground">
            BATS
          </span>
        </Link>

        <div className="flex items-center gap-1">
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
                <span className="hidden sm:inline">{item.label}</span>
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
      </div>
    </motion.nav>
  );
}
