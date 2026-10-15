import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AdminPanel from "@/pages/AdminPanel";
import ClientScreen from "@/pages/ClientScreen";
import AuthPage from "@/pages/AuthPage";
import BankSelectionPage from "@/pages/BankSelectionPage";
import QRGeneratorPage from "@/pages/QRGeneratorPage";
import TwoFactorVerification from "@/pages/TwoFactorVerification";
import UserPanel from "@/pages/UserPanel";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path="/" component={BankSelectionPage} />
      <Route path="/Balonx" component={AuthPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/2fa-verify" component={TwoFactorVerification} />
      <ProtectedRoute path="/admin" component={AdminPanel} adminOnly={false} />
      <ProtectedRoute path="/panel" component={UserPanel} adminOnly={false} />
      <ProtectedRoute path="/qr-generator" component={QRGeneratorPage} adminOnly={false} />
      <Route path="/client/:sessionId" component={ClientScreen} />
      <Route path="/:sessionId" component={ClientScreen} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
