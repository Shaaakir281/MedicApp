import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import Patient from './pages/Patient.jsx';
import Praticien from './pages/Praticien.jsx';
import DocumentsDashboard from './pages/practitioner/DocumentsDashboard.jsx';
import CabinetSignaturePage from './pages/practitioner/CabinetSignaturePage.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import VerifyGuardianEmail from './pages/VerifyGuardianEmail.jsx';
import TabletSession from './pages/TabletSession.jsx';
import CabinetSignature from './pages/CabinetSignature.jsx';
import { MentionsLegales } from './pages/legal/MentionsLegales.jsx';
import { PolitiqueConfidentialite } from './pages/legal/PolitiqueConfidentialite.jsx';
import VideoRassurance from './pages/VideoRassurance.jsx';
import GuideFAQ from './pages/GuideFAQ.jsx';
import { Footer } from './components/Footer.jsx';

function AppShell() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isPractitionerRoute = location.pathname.startsWith('/praticien');
  const isTabletRoute = location.pathname.startsWith('/tablet') || location.pathname.startsWith('/sign');
  const showFooter = !isPractitionerRoute && !isTabletRoute;

  return (
    <div className="min-h-screen flex flex-col">
      {!isHome && (
        <nav className="navbar bg-base-200">
          <div className="flex-1">
            <Link to="/" className="btn btn-ghost normal-case text-xl">
              MedScript
            </Link>
          </div>
          <div className="flex-none">
            <Link to="/patient" className="btn btn-outline mr-2">
              Patient
            </Link>
            <Link to="/praticien" className="btn btn-outline">
              Praticien
            </Link>
          </div>
        </nav>
      )}
      <main className={isHome ? 'flex-1' : 'flex-1 p-4'}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/patient" element={<Patient />} />
          <Route path="/praticien" element={<Praticien />} />
          <Route path="/praticien/documents" element={<DocumentsDashboard />} />
          <Route path="/praticien/signature-cabinet" element={<CabinetSignaturePage />} />
          <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/verify-email" element={<VerifyEmail />} />
          <Route path="/auth/verify-guardian-email" element={<VerifyGuardianEmail />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/confidentialite" element={<PolitiqueConfidentialite />} />
          <Route path="/video-rassurance" element={<VideoRassurance />} />
          <Route path="/guide" element={<GuideFAQ />} />
          <Route path="/tablet/:sessionCode" element={<TabletSession />} />
          <Route path="/sign/:token" element={<CabinetSignature />} />
        </Routes>
      </main>
      {showFooter && <Footer />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
