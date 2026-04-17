import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home, Citizens, Elites, Data, About, AboutSupport, AboutNews, International, PolicyValues, Report as ReportPage, Reports, ProfileWestwood, Primary, Codebook } from './pages';
import { ElitesLanding, ElitesProfiles, ElitesProfileDetail, ElitesRankings, ElitesData as ElitesDataPage, ElitesAbout } from './pages/elites/index';
import { PrimaryLanding, PrimaryRace, PrimaryState, PrimaryCandidate, PrimaryAbout } from './pages/primary/index';
import { Violence } from './pages/violence';
import { LegislatorSearch } from './pages/search';
import { Admin, AdminDashboard, MediaMentionsAdmin, ReportsAdmin, SurveyAdmin, ViolenceAdmin, PressUrlsAdmin, TeamAdmin, ProfileAdmin, ErrorLogAdmin, PrimaryAdmin, StateLegislatorsAdmin, OperationsDashboard, OperationsDetail, OperationsLogs, OperationsAlerts, DownloadStats } from './pages/admin';
import { StatsProvider } from './context/StatsContext';

// Wrapper for pages that use the main layout
function MainLayout({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <StatsProvider>
      <BrowserRouter>
        <Routes>
          {/* Admin routes - use their own layout */}
          <Route path="/admin" element={<Admin />}>
            <Route index element={<OperationsDashboard />} />
            <Route path="operations/job/:name" element={<OperationsDetail />} />
            <Route path="operations/logs" element={<OperationsLogs />} />
            <Route path="operations/alerts" element={<OperationsAlerts />} />
            <Route path="operations/downloads" element={<DownloadStats />} />
            <Route path="content" element={<AdminDashboard />} />
            <Route path="media" element={<MediaMentionsAdmin />} />
            <Route path="reports" element={<ReportsAdmin />} />
            <Route path="surveys" element={<SurveyAdmin />} />
            <Route path="press-urls" element={<PressUrlsAdmin />} />
            <Route path="state-legislators" element={<StateLegislatorsAdmin />} />
            <Route path="primaries" element={<PrimaryAdmin />} />
            <Route path="violence" element={<ViolenceAdmin />} />
            <Route path="team" element={<TeamAdmin />} />
            <Route path="profile" element={<ProfileAdmin />} />
            <Route path="logs" element={<ErrorLogAdmin />} />
          </Route>

          {/* Main site routes - use main layout */}
          <Route path="/" element={<MainLayout><Home /></MainLayout>} />
          <Route path="/report/:slug" element={<MainLayout><ReportPage /></MainLayout>} />
          <Route path="/reports" element={<MainLayout><Reports /></MainLayout>} />
          <Route path="/citizens" element={<MainLayout><Citizens /></MainLayout>} />
          <Route path="/citizens/values" element={<MainLayout><PolicyValues /></MainLayout>} />
          <Route path="/citizens/international" element={<MainLayout><International /></MainLayout>} />
          <Route path="/violence" element={<MainLayout><Violence /></MainLayout>} />
          <Route path="/search" element={<MainLayout><LegislatorSearch /></MainLayout>} />
          <Route path="/elites" element={<MainLayout><Elites /></MainLayout>}>
            <Route index element={<ElitesLanding />} />
            <Route path="profiles" element={<ElitesProfiles />} />
            <Route path="profile/:id" element={<ElitesProfileDetail />} />
            <Route path="rankings" element={<ElitesRankings />} />
            <Route path="data" element={<ElitesDataPage />} />
            <Route path="about" element={<ElitesAbout />} />
          </Route>
          <Route path="/primary" element={<MainLayout><Primary /></MainLayout>}>
            <Route index element={<PrimaryLanding />} />
            <Route path="race/:raceId" element={<PrimaryRace />} />
            <Route path="state/:stateCode" element={<PrimaryState />} />
            <Route path="candidate/:candidateId" element={<PrimaryCandidate />} />
            <Route path="about" element={<PrimaryAbout />} />
          </Route>
          <Route path="/data" element={<MainLayout><Data /></MainLayout>} />
          <Route path="/data/codebook" element={<MainLayout><Codebook /></MainLayout>} />
          <Route path="/about" element={<MainLayout><About /></MainLayout>} />
          <Route path="/about/support" element={<MainLayout><AboutSupport /></MainLayout>} />
          <Route path="/about/news" element={<MainLayout><AboutNews /></MainLayout>} />
          <Route path="/about/sean-westwood" element={<MainLayout><ProfileWestwood /></MainLayout>} />
        </Routes>
      </BrowserRouter>
    </StatsProvider>
  );
}

export default App;
