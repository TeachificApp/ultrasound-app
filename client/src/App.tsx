import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppLayout from "./components/AppLayout";
import Home from "./pages/Home";
import UltrasoundAssistHub from "./pages/UltrasoundAssistHub";
import SpecialtyDetail from "./pages/SpecialtyDetail";
import POCUSAssist from "./pages/POCUSAssist";
import FetalEchoAssist from "./pages/FetalEchoAssist";
import Flashcards from "./pages/Flashcards";
import CaseLibrary from "./pages/CaseLibrary";
import CaseDetail from "./pages/CaseDetail";
import SoundBytes from "./pages/SoundBytes";
import DailyChallenge from "./pages/DailyChallenge";
import Leaderboard from "./pages/Leaderboard";
import PremiumAccess from "./pages/PremiumAccess";
import AdminDashboard from "./pages/AdminDashboard";
import LearnFetalEcho from "./pages/LearnFetalEcho";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/ultrasound-assist" component={UltrasoundAssistHub} />
      <Route path="/ultrasound-assist/:specialty" component={SpecialtyDetail} />
      <Route path="/pocus-assist" component={POCUSAssist} />
      <Route path="/fetal-echo-assist" component={FetalEchoAssist} />
      <Route path="/flashcards" component={Flashcards} />
      <Route path="/case-library" component={CaseLibrary} />
      <Route path="/case-library/:id" component={CaseDetail} />
      <Route path="/soundbytes" component={SoundBytes} />
      <Route path="/daily-challenge" component={DailyChallenge} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/premium" component={PremiumAccess} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/learn-fetal-echo" component={LearnFetalEcho} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppLayout>
            <Router />
          </AppLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
