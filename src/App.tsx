import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Evaluate from "./pages/Evaluate";
import Interview from "./pages/Interview";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Result from "./pages/Result";
import UploadAnalysis from "./pages/UploadAnalysis";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// 🛡️ DYNAMIC API RESOLUTION: Intelligent fallback for Local vs Production
const API_BASE = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
    ? "http://localhost:8000" 
    : "https://bats-ai-backend.onrender.com");

const App = () => {
  // Wake up Render server instantly on load
  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .catch(() => console.log("[BATS] Sent wake-up ping to backend..."));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/evaluate" element={<Evaluate />} />
            <Route path="/interview" element={<Interview />} />
            <Route path="/interview/:sessionId" element={<Interview />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/upload-analysis" element={<UploadAnalysis />} />
            <Route path="/result/:id" element={<Result />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;