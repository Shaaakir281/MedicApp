import React from 'react';
import { Link } from 'react-router-dom';
import { PRACTITIONER } from '../config/practitioner.js';

const HomePage = () => {
  const safePhone = (PRACTITIONER.hospitalPhone || '').replace(/\s/g, '');

  return (
    <div
      className="min-h-screen bg-slate-50 flex flex-col"
      style={{ fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif" }}
    >
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-slate-800 leading-tight">
                Cabinet du Dr {PRACTITIONER.doctorName}
              </h1>
              <p className="text-sm text-slate-500">Chirurgien pediatrique</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
          <section className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-800 mb-4">Bienvenue</h2>
            <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Ce site vous permet de prendre rendez-vous pour une circoncision rituelle
              pediatrique avec le Dr {PRACTITIONER.doctorName}, chirurgien pediatrique a{' '}
              {PRACTITIONER.city}. Les informations detaillees sur l&apos;intervention et le
              suivi seront accessibles apres creation de votre compte.
            </p>
          </section>

          <section className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>

                <h3 className="text-xl font-semibold text-slate-800 mb-2">Circoncision rituelle</h3>
                <p className="text-slate-500 mb-6 flex-1">
                  Prendre rendez-vous pour une circoncision rituelle pediatrique
                </p>

                <Link
                  to="/patient"
                  className="inline-flex items-center justify-center w-full px-5 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Creer mon compte
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>

            <div className="bg-slate-100 rounded-xl border border-slate-200 p-6 sm:p-8">
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>

                <h3 className="text-xl font-semibold text-slate-700 mb-2">Autre motif medical</h3>
                <p className="text-slate-500 mb-4">
                  Pour toute pathologie necessitant une intervention chirurgicale
                </p>

                <div className="bg-white rounded-lg p-4 border border-slate-200 mt-auto">
                  <p className="text-sm text-slate-500 mb-2">Veuillez contacter directement :</p>
                  <p className="font-medium text-slate-700">Hopital Victor Jousselin - Dreux</p>
                  {safePhone ? (
                    <a
                      href={`tel:${safePhone}`}
                      className="inline-flex items-center text-blue-600 hover:text-blue-700 mt-2 font-medium"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      {PRACTITIONER.hospitalPhone}
                    </a>
                  ) : (
                    <p className="text-sm text-slate-500 mt-2">Telephone a renseigner</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-slate-500">
              <p className="font-medium text-slate-600 mb-1">Cabinet du Dr {PRACTITIONER.doctorName}</p>
              <p>{PRACTITIONER.cabinetAddress}</p>
            </div>

            <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
              <Link to="/mentions-legales" className="text-slate-500 hover:text-slate-700 transition-colors">
                Mentions legales
              </Link>
              <Link to="/confidentialite" className="text-slate-500 hover:text-slate-700 transition-colors">
                Politique de confidentialite
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-center sm:text-left">
            <p className="text-xs text-slate-400">
              © 2026 Cabinet du Dr {PRACTITIONER.doctorName}. Tous droits reserves.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
