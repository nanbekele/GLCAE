import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Departments from "./pages/Departments";
import Projects from "./pages/Projects";
import Careers from "./pages/Careers";
import News from "./pages/News";
import DepartmentDetail from "./pages/DepartmentDetail";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import AdminDashboard from "./pages/portal/AdminDashboard";
import AdminAnalytics from "./pages/portal/AdminAnalytics";
import HRDashboard from "./pages/portal/HRDashboard";
import MarketingDashboard from "./pages/portal/MarketingDashboard";
import EmployeeDashboard from "./pages/portal/EmployeeDashboard";
import EmployeeTasks from "./pages/portal/EmployeeTasks";
import EmployeeDoneTasks from "./pages/portal/EmployeeDoneTasks";
import EmployeeSchedule from "./pages/portal/EmployeeSchedule";
import EmployeePrepareReport from "./pages/portal/EmployeePrepareReport";
import HeadReviewReports from "./pages/portal/HeadReviewReports";
import ArchitecturalDashboard from "./pages/portal/ArchitecturalDashboard";
import ElectroMechanicalDashboard from "./pages/portal/MechanicalDashboard";
import ICTDashboard from "./pages/portal/ICTDashboard";
import ICTServiceTickets from "./pages/portal/ICTServiceTickets";
import MechanicalServiceTickets from "./pages/portal/MechanicalServiceTickets";
import ArchitecturalServiceTickets from "./pages/portal/ArchitecturalServiceTickets";
import MaterialTestingServiceTickets from "./pages/portal/MaterialTestingServiceTickets";
import MaterialTestingDashboard from "./pages/portal/MaterialTestingDashboard";
import StaffRegister from "./pages/auth/StaffRegister";
import Gallery from "./pages/Gallery";
import JobApplication from "./pages/JobApplication";
import MarketingMessages from "./pages/portal/MarketingMessages";
import GalleryManagement from "./pages/portal/GalleryManagement";
import AdminUsers from "./pages/portal/AdminUsers";
import HRApplications from "./pages/portal/HRApplications";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import CreateTestUsers from "./pages/CreateTestUsers";
import ClientPortal from "./pages/portal/ClientPortal";
import ClientServiceRequests from "./pages/portal/ClientServiceRequests";
import ClientConsultancyRequest from "./pages/portal/ClientConsultancyRequest";
import ClientInterviewSchedules from "./pages/portal/ClientInterviewSchedules";
import ClientDoneTasks from "./pages/portal/ClientDoneTasks";
import ClientConsultancySchedules from "./pages/portal/ClientConsultancySchedules";
import JobDetail from "./pages/JobDetail";
import MarketingProjects from "./pages/portal/MarketingProjects";
import MarketingSocialMedia from "./pages/portal/MarketingSocialMedia";
import HRPortalRequests from "./pages/portal/HRPortalRequests";
import HRVerifiedTasks from "./pages/portal/HRVerifiedTasks";
import HRDeliveryScheduling from "./pages/portal/HRDeliveryScheduling";
import HRSupportChat from "./pages/portal/HRSupportChat";
import HRPostJob from "./pages/portal/HRPostJob";
import HRJobPosts from "./pages/portal/HRJobPosts";
import HRScheduleInterview from "./pages/portal/HRScheduleInterview";
import HRUserManagement from "./pages/portal/HRUserManagement";
import HRGenerateReport from "./pages/portal/HRGenerateReport";
import ICTConsultancy from "./pages/portal/consultancy/ICTConsultancy";
import MechanicalConsultancy from "./pages/portal/consultancy/MechanicalConsultancy";
import MaterialTestingConsultancy from "./pages/portal/consultancy/MaterialTestingConsultancy";
import ArchitecturalConsultancy from "./pages/portal/consultancy/ArchitecturalConsultancy";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="departments" element={<Departments />} />
              <Route path="departments/:departmentId" element={<DepartmentDetail />} />
              <Route path="projects" element={<Projects />} />
              <Route path="careers" element={<Careers />} />
              <Route path="careers/job/:jobId" element={<JobDetail />} />
              <Route path="careers/apply/:jobId" element={<JobApplication />} />
              <Route path="news" element={<News />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="contact" element={<Contact />} />
              <Route path="change-password" element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              } />
              <Route path="client-portal" element={
                <ProtectedRoute requiredRoles="client">
                  <ClientPortal />
                </ProtectedRoute>
              } />
              <Route path="portal/client/service-requests" element={
                <ProtectedRoute requiredRoles="client">
                  <ClientServiceRequests />
                </ProtectedRoute>
              } />
              <Route path="/portal/client/consultancy" element={
                <ProtectedRoute requiredRoles="client">
                  <ClientConsultancyRequest />
                </ProtectedRoute>
              } />
              <Route path="portal/client/interviews" element={
                <ProtectedRoute requiredRoles="client">
                  <ClientInterviewSchedules />
                </ProtectedRoute>
              } />
              <Route path="portal/client/consultancy-schedules" element={
                <ProtectedRoute requiredRoles="client">
                  <ClientConsultancySchedules />
                </ProtectedRoute>
              } />
              <Route path="portal/client/done-tasks" element={
                <ProtectedRoute requiredRoles="client">
                  <ClientDoneTasks />
                </ProtectedRoute>
              } />
            </Route>
            
            {/* Authentication Routes */}
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/create-test-users" element={<CreateTestUsers />} />
            
            <Route path="/auth/staff-register" element={
              <ProtectedRoute requiredRoles={['hr_staff', 'super_admin']}>
                <StaffRegister />
              </ProtectedRoute>
            } />
            
            {/* Protected Portal Routes */}
            <Route path="/portal/admin" element={
              <ProtectedRoute requiredRoles="super_admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/portal/admin/analytics" element={
              <ProtectedRoute requiredRoles="super_admin">
                <AdminAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/portal/hr" element={
              <ProtectedRoute requiredRoles="hr_staff">
                <HRDashboard />
              </ProtectedRoute>
            } />
            <Route path="/portal/marketing" element={
              <ProtectedRoute requiredRoles="marketing_communications">
                <MarketingDashboard />
              </ProtectedRoute>
            } />
            <Route path="/portal/employee" element={
              <ProtectedRoute requiredRoles="employee">
                <EmployeeDashboard />
              </ProtectedRoute>
            } />
            <Route path="/portal/employee/tasks" element={
              <ProtectedRoute requiredRoles="employee">
                <EmployeeTasks />
              </ProtectedRoute>
            } />
            <Route path="/portal/employee/done-tasks" element={
              <ProtectedRoute requiredRoles="employee">
                <EmployeeDoneTasks />
              </ProtectedRoute>
            } />
            <Route path="/portal/employee/schedule" element={
              <ProtectedRoute requiredRoles="employee">
                <EmployeeSchedule />
              </ProtectedRoute>
            } />
            <Route path="/portal/employee/prepare-report" element={
              <ProtectedRoute requiredRoles="employee">
                <EmployeePrepareReport />
              </ProtectedRoute>
            } />
            
            {/* Department-specific dashboards */}
            <Route path="/portal/architectural" element={
              <ProtectedRoute requiredRoles="architectural_civil_head">
                <ArchitecturalDashboard />
              </ProtectedRoute>
            } />
            <Route path="/portal/consultancy/architectural" element={
              <ProtectedRoute requiredRoles="architectural_civil_head">
                <ArchitecturalConsultancy />
              </ProtectedRoute>
            } />
            <Route path="/portal/mechanical" element={
              <ProtectedRoute requiredRoles="mechanical_head">
                <ElectroMechanicalDashboard />
              </ProtectedRoute>
            } />
            <Route path="/portal/consultancy/mechanical" element={
              <ProtectedRoute requiredRoles="mechanical_head">
                <MechanicalConsultancy />
              </ProtectedRoute>
            } />
            <Route path="/portal/ict" element={
              <ProtectedRoute requiredRoles="ict_head">
                <ICTDashboard />
              </ProtectedRoute>
            } />
            <Route path="/portal/consultancy/ict" element={
              <ProtectedRoute requiredRoles="ict_head">
                <ICTConsultancy />
              </ProtectedRoute>
            } />
            <Route path="/portal/ict/service-tickets" element={
              <ProtectedRoute requiredRoles="ict_head">
                <ICTServiceTickets />
              </ProtectedRoute>
            } />
            <Route path="/portal/mechanical/service-tickets" element={
              <ProtectedRoute requiredRoles="mechanical_head">
                <MechanicalServiceTickets />
              </ProtectedRoute>
            } />
            <Route path="/portal/architectural/service-tickets" element={
              <ProtectedRoute requiredRoles="architectural_civil_head">
                <ArchitecturalServiceTickets />
              </ProtectedRoute>
            } />
            <Route path="/portal/material-testing/service-tickets" element={
              <ProtectedRoute requiredRoles="material_testing_head">
                <MaterialTestingServiceTickets />
              </ProtectedRoute>
            } />
            <Route path="/portal/material-testing" element={
              <ProtectedRoute requiredRoles="material_testing_head">
                <MaterialTestingDashboard />
              </ProtectedRoute>
            } />
            <Route path="/portal/consultancy/material-testing" element={
              <ProtectedRoute requiredRoles="material_testing_head">
                <MaterialTestingConsultancy />
              </ProtectedRoute>
            } />
            <Route path="/portal/head/reports" element={
              <ProtectedRoute requiredRoles={["mechanical_head","ict_head","material_testing_head","architectural_civil_head"]}>
                <HeadReviewReports />
              </ProtectedRoute>
            } />
            
            {/* Marketing Sub-routes */}
            <Route path="/portal/marketing/messages" element={
              <ProtectedRoute requiredRoles={["marketing_communications", "super_admin"]}>
                <MarketingMessages />
              </ProtectedRoute>
            } />
            <Route path="/portal/marketing/projects" element={
              <ProtectedRoute requiredRoles={["marketing_communications", "super_admin"]}>
                <MarketingProjects />
              </ProtectedRoute>
            } />
            <Route path="/portal/marketing/social-media" element={
              <ProtectedRoute requiredRoles={["marketing_communications", "super_admin"]}>
                <MarketingSocialMedia />
              </ProtectedRoute>
            } />
            <Route path="/portal/marketing/gallery" element={
              <ProtectedRoute requiredRoles={["marketing_communications", "super_admin"]}>
                <GalleryManagement />
              </ProtectedRoute>
            } />
            <Route path="/portal/hr/applications" element={
              <ProtectedRoute requiredRoles={["hr_staff", "super_admin"]}>
                <HRApplications />
              </ProtectedRoute>
            } />
            <Route path="/portal/hr/portal-requests" element={
              <ProtectedRoute requiredRoles="hr_staff">
                <HRPortalRequests />
              </ProtectedRoute>
            } />
            <Route path="/portal/hr/verified-tasks" element={
              <ProtectedRoute requiredRoles="hr_staff">
                <HRVerifiedTasks />
              </ProtectedRoute>
            } />
            <Route path="/portal/hr/verified-tasks/:taskId/delivery-scheduling" element={
              <ProtectedRoute requiredRoles="hr_staff">
                <HRDeliveryScheduling />
              </ProtectedRoute>
            } />
            <Route path="/portal/hr/support-chat" element={
              <ProtectedRoute requiredRoles="hr_staff">
                <HRSupportChat />
              </ProtectedRoute>
            } />
            <Route path="/portal/hr/post-job" element={
              <ProtectedRoute requiredRoles="hr_staff">
                <HRPostJob />
              </ProtectedRoute>
            } />
            <Route path="/portal/hr/job-posts" element={
              <ProtectedRoute requiredRoles="hr_staff">
                <HRJobPosts />
              </ProtectedRoute>
            } />
            <Route path="/portal/hr/schedule-interview" element={
              <ProtectedRoute requiredRoles="hr_staff">
                <HRScheduleInterview />
              </ProtectedRoute>
            } />
            <Route path="/portal/hr/user-management" element={
              <ProtectedRoute requiredRoles="hr_staff">
                <HRUserManagement />
              </ProtectedRoute>
            } />
            <Route path="/portal/hr/generate-report" element={
              <ProtectedRoute requiredRoles="hr_staff">
                <HRGenerateReport />
              </ProtectedRoute>
            } />
            <Route path="/portal/admin/users" element={
              <ProtectedRoute requiredRoles="super_admin">
                <AdminUsers />
              </ProtectedRoute>
            } />
            
            {/* Unauthorized */}
            <Route path="/unauthorized" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
                  <p className="text-muted-foreground">You don't have permission to access this resource.</p>
                </div>
              </div>
            } />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
