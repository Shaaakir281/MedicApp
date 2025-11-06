import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordField from '../components/PasswordField.jsx';
import {
  fetchPractitionerAgenda,
  fetchPractitionerStats,
} from '../lib/api.js';

const DEFAULT_START = '2026-02-03';
const VIEW_OPTIONS = [7, 14, 23];

const weekdayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const timeFormatter = (value) => {
  if (!value) return '';
  return value.slice(0, 5);
};

const toDate = (isoDate) => new Date(`${isoDate}T00:00:00`);
const toISODate = (dateObj) => dateObj.toISOString().split('T')[0];
const addDays = (isoDate, delta) => {
  const base = toDate(isoDate);
  base.setDate(base.getDate() + delta);
  return toISODate(base);
};

const typeLabels = {
  preconsultation: 'Pré-consultation',
  act: 'Acte',
  general: 'Général',
};

const statusLabels = {
  pending: 'En attente',
  validated: 'Validé',
};

function PractitionerLogin({ onSubmit, loading, error }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-white shadow-xl rounded-2xl border border-slate-200">
      <h1 className="text-2xl font-semibold text-center mb-4">Connexion praticien</h1>
      <p className="text-sm text-slate-500 mb-6 text-center">
        Utilisez le compte de démonstration généré via le script&nbsp;
        <code>backend/scripts/seed_practitioner_demo.py</code>.<br />
        Exemple : <strong>praticien.demo1@demo.medicapp</strong> / <strong>password</strong>
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="input input-bordered w-full"
          required
        />
        <PasswordField
          label="Mot de passe"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Mot de passe"
          required
          autoComplete="current-password"
        />
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
        {error && <p className="text-error text-sm text-center">{error}</p>}
      </form>
    </div>
  );
}

function StatCard({ title, value, tone = 'neutral' }) {
  const toneClasses = {
    neutral: 'border-slate-200',
    primary: 'border-blue-200',
    warning: 'border-amber-200',
    danger: 'border-red-200',
    success: 'border-emerald-200',
  };
  return (
    <div className={`bg-white border ${toneClasses[tone] || toneClasses.neutral} rounded-2xl p-5 shadow-sm`}>
      <div className="text-sm text-slate-500 font-medium mb-2">{title}</div>
      <div className="text-3xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function AgendaDay({ day }) {
  const dateLabel = useMemo(() => {
    const dateObj = toDate(day.date);
    return weekdayFormatter.format(dateObj);
  }, [day.date]);

  if (!day.appointments.length) {
    return (
      <div className="space-y-3">
        <div className="text-lg font-semibold text-slate-800">{dateLabel}</div>
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-slate-500">
          Aucun rendez-vous planifié.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold text-slate-800">{dateLabel}</div>
      <div className="space-y-4">
        {day.appointments.map((appointment) => {
          const needsFollowUp = appointment.procedure.needs_follow_up;
          const cardClasses = needsFollowUp
            ? 'border-amber-300 bg-amber-50/70'
            : 'border-slate-200 bg-white';

          return (
            <div
              key={appointment.appointment_id}
              className={`rounded-2xl border ${cardClasses} p-5 shadow-sm transition-all`}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="text-slate-900 font-semibold text-lg flex items-center gap-3 flex-wrap">
                    <span>{timeFormatter(appointment.time)}</span>
                    <span className="px-3 py-1 text-xs rounded-full bg-slate-800 text-white">
                      {typeLabels[appointment.appointment_type] || appointment.appointment_type}
                    </span>
                    {appointment.mode && (
                      <span className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                        {appointment.mode === 'visio' ? 'Visio' : 'Présentiel'}
                      </span>
                    )}
                    <span className="px-3 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
                      {statusLabels[appointment.status] || appointment.status}
                    </span>
                    {needsFollowUp && (
                      <span className="px-3 py-1 text-xs rounded-full bg-amber-500 text-white">
                        Relance requise
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 mt-2">
                    Patient&nbsp;: <strong>{appointment.patient.child_full_name}</strong> ·{' '}
                    <span className="text-slate-500">{appointment.patient.email}</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    Né le {new Date(`${appointment.procedure.child_birthdate}T00:00:00`).toLocaleDateString('fr-FR')}
                  </div>
                  {appointment.procedure.notes && (
                    <div className="text-sm text-slate-500 mt-2 italic">
                      {appointment.procedure.notes.replace('[demo]', '').trim()}
                    </div>
                  )}
                </div>
                {appointment.procedure.missing_items.length > 0 && (
                  <div className="md:w-64 bg-white/70 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
                    <div className="font-semibold uppercase text-xs tracking-wide">
                      Eléments manquants
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                      {appointment.procedure.missing_items.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Praticien = () => {
  const { isAuthenticated, login, token, loading: authLoading, logout, user } = useAuth();
  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [viewLength, setViewLength] = useState(7);
  const [agenda, setAgenda] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const endDate = useMemo(() => addDays(startDate, viewLength - 1), [startDate, viewLength]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    const fetchData = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const [agendaData, statsData] = await Promise.all([
          fetchPractitionerAgenda({ start: startDate, end: endDate }, token),
          fetchPractitionerStats(startDate, token),
        ]);
        if (!cancelled) {
          setAgenda(agendaData);
          setStats(statsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [token, startDate, endDate, refreshIndex]);

  const handleLogin = async (credentials) => {
    setLoginError(null);
    try {
      await login(credentials);
    } catch (err) {
      setLoginError(err.message || "Échec de la connexion");
    }
  };

  const handleRefresh = () => setRefreshIndex((prev) => prev + 1);

  if (!isAuthenticated) {
    return <PractitionerLogin onSubmit={handleLogin} loading={authLoading} error={loginError} />;
  }

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-10">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Tableau de bord praticien</h1>
          {user?.email && <p className="text-sm text-slate-500">Connecté en tant que {user.email}</p>}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
          Se déconnecter
        </button>
      </header>

      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div>
              <label className="label text-xs font-semibold text-slate-500">Date de départ</label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="input input-bordered"
              />
            </div>
            <div>
              <label className="label text-xs font-semibold text-slate-500">Période</label>
              <select
                className="select select-bordered"
                value={viewLength}
                onChange={(event) => setViewLength(Number(event.target.value))}
              >
                {VIEW_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option} jours</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500">
              Affichage du <strong>{startDate}</strong> au <strong>{endDate}</strong>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleRefresh} disabled={loadingData}>
              Actualiser
            </button>
          </div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <StatCard title="Rendez-vous du jour" value={stats ? stats.total_appointments : '—'} tone="primary" />
        <StatCard title="Créations aujourd'hui" value={stats ? stats.bookings_created : '—'} />
        <StatCard title="Nouveaux patients" value={stats ? stats.new_patients : '—'} />
        <StatCard title="Relances nécessaires" value={stats ? stats.follow_ups_required : '—'} tone="warning" />
        <StatCard title="Consents manquants" value={stats ? stats.pending_consents : '—'} tone="danger" />
      </section>

      <section className="space-y-8">
        {loadingData && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
            Chargement de l'agenda...
          </div>
        )}
        {!loadingData && agenda && (
          agenda.days.map((day) => (
            <AgendaDay key={day.date} day={day} />
          ))
        )}
      </section>
    </div>
  );
};

export default Praticien;


