import React from 'react';
import { Link } from 'react-router-dom';
import { PRACTITIONER } from '../config/practitioner.js';

export function Footer() {
  const year = new Date().getFullYear();
  const doctorName = PRACTITIONER.doctorName || 'Nom du medecin';
  const address = PRACTITIONER.cabinetAddress || '';

  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm text-slate-500">
            <p className="font-medium text-slate-600 mb-1">Cabinet du Dr {doctorName}</p>
            {address ? <p>{address}</p> : <p>Adresse du cabinet a renseigner</p>}
          </div>

          <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
            <Link to="/mentions-legales" className="text-slate-500 hover:text-slate-700 transition-colors">
              Mentions legales
            </Link>
            <Link to="/confidentialite" className="text-slate-500 hover:text-slate-700 transition-colors">
              Politique de confidentialite
            </Link>
            <Link to="/guide" className="text-slate-500 hover:text-slate-700 transition-colors">
              Guide & FAQ
            </Link>
            <Link to="/video-rassurance" className="text-slate-500 hover:text-slate-700 transition-colors">
              Preparation intervention
            </Link>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 text-center sm:text-left">
          <p className="text-xs text-slate-400">
            © {year} Cabinet du Dr {doctorName}. Tous droits reserves.
          </p>
        </div>
      </div>
    </footer>
  );
}
