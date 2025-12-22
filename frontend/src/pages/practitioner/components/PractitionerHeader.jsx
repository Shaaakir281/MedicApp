import React from 'react';
import { IconBell } from './icons';

/**
 * PractitionerHeader moderne avec logo gradient, avatar utilisateur et design épuré
 */

export const PractitionerHeader = ({ userEmail, onLogout }) => {
  // Extraire les initiales de l'email
  const getInitials = (email) => {
    if (!email) return 'P';
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(userEmail);
  const displayName = userEmail?.split('@')[0] || 'Praticien';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 -mx-10 px-10 py-4 mb-10">
      <div className="flex items-center justify-between">
        {/* Logo et titre */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">MedScript</h1>
            <p className="text-[10px] text-slate-500 -mt-0.5">Espace praticien</p>
          </div>
        </div>

        {/* Actions utilisateur */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button
            type="button"
            className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            title="Notifications"
          >
            <IconBell className="w-5 h-5" />
            {/* Dot de notification */}
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
          </button>

          {/* Séparateur */}
          <div className="h-8 w-px bg-slate-200" />

          {/* User profile + logout */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm shadow-lg shadow-violet-500/25">
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-slate-700">{displayName}</p>
              <p className="text-xs text-slate-500 -mt-0.5">{userEmail}</p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onLogout}
              title="Se déconnecter"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
