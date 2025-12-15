import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Patient from './pages/Patient.jsx';
import Praticien from './pages/Praticien.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import TabletSession from './pages/TabletSession.jsx';

/**
 * Top‑level component defining the navigation bar and routes for the application.
 */
function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        {/* Navigation bar */}
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
        {/* Main content area */}
        <main className="flex-1 p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/patient" element={<Patient />} />
            <Route path="/praticien" element={<Praticien />} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/verify-email" element={<VerifyEmail />} />
            <Route path="/tablet/:sessionCode" element={<TabletSession />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
