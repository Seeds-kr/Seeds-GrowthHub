import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import About from "@/pages/about";
import Program from "@/pages/program";
import Faq from "@/pages/faq";
import Apply from "@/pages/apply";
import ApplySuccess from "@/pages/apply-success";

import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminApplications from "@/pages/admin/applications";
import AdminApplicationDetail from "@/pages/admin/application-detail";
import AdminEvaluators from "@/pages/admin/evaluators";

import EvaluatorDashboard from "@/pages/evaluator/dashboard";
import EvaluatorApplicationDetail from "@/pages/evaluator/application-detail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/program" component={Program} />
      <Route path="/faq" component={Faq} />
      <Route path="/apply" component={Apply} />
      <Route path="/apply/success" component={ApplySuccess} />

      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/applications" component={AdminApplications} />
      <Route path="/admin/applications/:id" component={AdminApplicationDetail} />
      <Route path="/admin/evaluators" component={AdminEvaluators} />

      <Route path="/evaluator" component={EvaluatorDashboard} />
      <Route path="/evaluator/applications/:id" component={EvaluatorApplicationDetail} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
