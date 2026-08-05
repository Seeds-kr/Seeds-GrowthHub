import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import About from "@/pages/about";
import Program from "@/pages/program";
import Faq from "@/pages/faq";
import Recruit from "@/pages/recruit";
import Apply from "@/pages/apply";
import ApplySuccess from "@/pages/apply-success";

import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminApplications from "@/pages/admin/applications";
import AdminApplicationDetail from "@/pages/admin/application-detail";
import AdminEvaluators from "@/pages/admin/evaluators";
import AdminStudents from "@/pages/admin/students";
import { StudentLayout } from "@/components/layout/StudentLayout";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { EvaluatorLayout } from "@/components/layout/EvaluatorLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import AdminStudentDetail from "@/pages/admin/student-detail";
import AdminCohorts from "@/pages/admin/cohorts";
import AdminPrograms from "@/pages/admin/programs";
import AdminSessions from "@/pages/admin/sessions";
import AdminSessionAttendance from "@/pages/admin/session-attendance";
import AdminAssignments from "@/pages/admin/assignments";
import AdminAssignmentDetail from "@/pages/admin/assignment-detail";
import AdminAnnouncements from "@/pages/admin/announcements";
import AdminActivityRecords from "@/pages/admin/activity-records";
import AdminProjects from "@/pages/admin/projects";
import AdminProjectDetail from "@/pages/admin/project-detail";
import AdminArtifacts from "@/pages/admin/artifacts";
import AdminFeedback from "@/pages/admin/feedback";
import AdminTags from "@/pages/admin/tags";
import AdminStudentTimeline from "@/pages/admin/student-timeline";
import AdminStudentReport from "@/pages/admin/student-report";
import AdminCohortSummary from "@/pages/admin/cohort-summary";
import AdminSiteContent from "@/pages/admin/site-content";

import EvaluatorDashboard from "@/pages/evaluator/dashboard";
import EvaluatorApplicationDetail from "@/pages/evaluator/application-detail";

import MentorDashboard from "@/pages/mentor/dashboard";
import MentorTeams from "@/pages/mentor/teams";
import MentorProjectDetail from "@/pages/mentor/project-detail";
import MentorFeedback from "@/pages/mentor/feedback";
import MentorProfile from "@/pages/mentor/profile";

import StudentLogin from "@/pages/student/login";
import StudentDashboard from "@/pages/student/dashboard";
import StudentSessions from "@/pages/student/sessions";
import StudentAssignments from "@/pages/student/assignments";
import StudentAssignmentDetail from "@/pages/student/assignment-detail";
import StudentAnnouncements from "@/pages/student/announcements";
import StudentAttendance from "@/pages/student/attendance";
import StudentTimeline from "@/pages/student/timeline";
import StudentProjects from "@/pages/student/projects";
import StudentProjectDetail from "@/pages/student/project-detail";
import StudentArtifacts from "@/pages/student/artifacts";
import StudentStudies from "@/pages/student/studies";
import StudentStudyDetail from "@/pages/student/study-detail";
import StudentReflections from "@/pages/student/reflections";
import StudentFeedback from "@/pages/student/feedback";
import StudentReportPage from "@/pages/student/report";
import ActivatePage from "@/pages/activate";
import PeoplePage from "@/pages/people";
import PersonDetailPage from "@/pages/person-detail";
import AdminPeople from "@/pages/admin/people";
import AdminMeetings from "@/pages/admin/meetings";
import AdminMeetingDetail from "@/pages/admin/meeting-detail";
import AdminTasks from "@/pages/admin/tasks";
import AdminFinance from "@/pages/admin/finance";
import AdminOpsDashboard from "@/pages/admin/ops-dashboard";
import AdminAuditLogs from "@/pages/admin/audit-logs";
import AdminStudies from "@/pages/admin/studies";
import AdminTeamStatus from "@/pages/admin/team-status";
import AdminUsers from "@/pages/admin/users";
import AdminRoles from "@/pages/admin/roles";
import AdminDocuments from "@/pages/admin/documents";
import AdminDocumentDetail from "@/pages/admin/document-detail";
import AdminMedia from "@/pages/admin/media";
import AdminInterviews from "@/pages/admin/interviews";
import AdminAttendance from "@/pages/admin/attendance";
import AdminReports from "@/pages/admin/reports";
import AdminSessionDetail from "@/pages/admin/session-detail";
import StudentProfilePage from "@/pages/student/profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});


/**
 * 현재 경로에 맞는 셸(레이아웃)을 고른다.
 *
 * 전에는 각 페이지가 저마다 <AdminLayout> 를 감쌌다. 그러면 화면을 옮길 때마다
 * 레이아웃이 통째로 리마운트되고, 사이드바에서 손으로 펼친 섹션이 매번 접혔다
 * (실측으로 확인). 셸을 Switch 바깥에 두면 같은 표면 안에서 이동할 때 레이아웃
 * 컴포넌트가 그대로 유지되고 안쪽 내용만 바뀐다.
 *
 * wouter 의 중첩 라우팅(`<Route path="/admin*">` 안에 Switch)을 쓰지 않는 이유:
 * 3.9 에서 `/admin/:rest*` 는 `/admin` 자체를 못 잡고, `/admin*` 은 하위 경로를
 * 못 잡았다(둘 다 실측). 어느 쪽이 base 를 거는지 문서만으로 확신할 수 없어서,
 * 라우트는 전부 평평한 절대 경로 그대로 두고 셸만 경로로 고른다. 라우팅 동작이
 * 한 줄도 안 바뀌므로 이 변경으로 깨질 경로가 없다.
 *
 * 로그인 화면은 셸 밖이다 — AdminLayout 이 인증을 확인하고 되돌려보내므로
 * 로그인 화면을 그 안에 넣으면 서로를 물고 늘어진다.
 */
const SHELLS: Array<{ prefix: string; except: string[]; Layout: React.ComponentType<{ children: React.ReactNode }> }> = [
  { prefix: "/admin", except: ["/admin/login"], Layout: AdminLayout },
  { prefix: "/evaluator", except: [], Layout: EvaluatorLayout },
  { prefix: "/mentor", except: [], Layout: MentorLayout },
  { prefix: "/student", except: ["/student/login"], Layout: StudentLayout },
];

function Passthrough({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function shellFor(location: string) {
  for (const { prefix, except, Layout } of SHELLS) {
    if (except.includes(location)) continue;
    if (location === prefix || location.startsWith(prefix + "/")) return Layout;
  }
  return Passthrough;
}

function Router() {
  const [location] = useLocation();
  const Shell = shellFor(location);

  return (
    <Shell>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/program" component={Program} />
      <Route path="/faq" component={Faq} />
      <Route path="/recruit" component={Recruit} />
      <Route path="/apply" component={Apply} />
      <Route path="/apply/success" component={ApplySuccess} />
      <Route path="/people" component={PeoplePage} />
      <Route path="/mentors" component={PeoplePage} />
      <Route path="/staff" component={PeoplePage} />
      <Route path="/members" component={PeoplePage} />
      <Route path="/people/:kind/:id" component={PersonDetailPage} />

      <Route path="/activate/:token" component={ActivatePage} />
      <Route path="/login" component={AdminLogin} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/applications" component={AdminApplications} />
      <Route path="/admin/applications/:id" component={AdminApplicationDetail} />
      <Route path="/admin/evaluators" component={AdminEvaluators} />
      <Route path="/admin/students" component={AdminStudents} />
      <Route path="/admin/students/:id" component={AdminStudentDetail} />
      <Route path="/admin/cohorts" component={AdminCohorts} />
      <Route path="/admin/programs" component={AdminPrograms} />
      <Route path="/admin/sessions" component={AdminSessions} />
      <Route path="/admin/sessions/:id/attendance" component={AdminSessionAttendance} />
      <Route path="/admin/sessions/:id" component={AdminSessionDetail} />
      <Route path="/admin/assignments" component={AdminAssignments} />
      <Route path="/admin/assignments/:id" component={AdminAssignmentDetail} />
      <Route path="/admin/announcements" component={AdminAnnouncements} />
      <Route path="/admin/activity-records" component={AdminActivityRecords} />
      <Route path="/admin/projects" component={AdminProjects} />
      <Route path="/admin/projects/:id" component={AdminProjectDetail} />
      <Route path="/admin/artifacts" component={AdminArtifacts} />
      <Route path="/admin/feedback" component={AdminFeedback} />
      <Route path="/admin/tags" component={AdminTags} />
      <Route path="/admin/students/:id/timeline" component={AdminStudentTimeline} />
      <Route path="/admin/students/:id/report" component={AdminStudentReport} />
      <Route path="/admin/cohorts/:id/summary" component={AdminCohortSummary} />
      <Route path="/admin/site-content" component={AdminSiteContent} />
      <Route path="/admin/people" component={AdminPeople} />
      <Route path="/admin/meetings" component={AdminMeetings} />
      <Route path="/admin/meetings/:id" component={AdminMeetingDetail} />
      <Route path="/admin/tasks" component={AdminTasks} />
      <Route path="/admin/finance" component={AdminFinance} />
      <Route path="/admin/ops-dashboard" component={AdminOpsDashboard} />
      <Route path="/admin/audit-logs" component={AdminAuditLogs} />
      <Route path="/admin/studies" component={AdminStudies} />
      <Route path="/admin/team-status" component={AdminTeamStatus} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/roles" component={AdminRoles} />
      <Route path="/admin/documents" component={AdminDocuments} />
      <Route path="/admin/documents/:id" component={AdminDocumentDetail} />

      <Route path="/admin/media" component={AdminMedia} />
      <Route path="/admin/interviews" component={AdminInterviews} />
      <Route path="/admin/attendance" component={AdminAttendance} />
      <Route path="/admin/reports" component={AdminReports} />

      <Route path="/evaluator" component={EvaluatorDashboard} />
      <Route path="/evaluator/applications/:id" component={EvaluatorApplicationDetail} />

      <Route path="/mentor" component={MentorDashboard} />
      <Route path="/mentor/teams" component={MentorTeams} />
      <Route path="/mentor/projects/:id" component={MentorProjectDetail} />
      <Route path="/mentor/feedback" component={MentorFeedback} />
      <Route path="/mentor/profile" component={MentorProfile} />

      <Route path="/student/login" component={StudentLogin} />
      <Route path="/student" component={StudentDashboard} />
      <Route path="/student/sessions" component={StudentSessions} />
      <Route path="/student/assignments" component={StudentAssignments} />
      <Route path="/student/assignments/:id" component={StudentAssignmentDetail} />
      <Route path="/student/announcements" component={StudentAnnouncements} />
      <Route path="/student/attendance" component={StudentAttendance} />
      <Route path="/student/timeline" component={StudentTimeline} />
      <Route path="/student/projects" component={StudentProjects} />
      <Route path="/student/projects/:id" component={StudentProjectDetail} />
      <Route path="/student/artifacts" component={StudentArtifacts} />
      <Route path="/student/studies" component={StudentStudies} />
      <Route path="/student/studies/:id" component={StudentStudyDetail} />
      <Route path="/student/reflections" component={StudentReflections} />
      <Route path="/student/feedback" component={StudentFeedback} />
      <Route path="/student/report" component={StudentReportPage} />
      <Route path="/student/profile" component={StudentProfilePage} />

      <Route component={NotFound} />
    </Switch>
    </Shell>
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
