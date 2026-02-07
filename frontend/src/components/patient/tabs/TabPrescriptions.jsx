import React, { useEffect, useMemo } from 'react';

import { sortAppointments } from '../../../utils/date.js';

const getAppointmentId = (appt) => appt?.id || appt?.appointment_id || null;

const formatDisplayDate = (appt) => {
  if (!appt?.date) return '--';
  const parsed = new Date(appt.date);
  if (Number.isNaN(parsed.getTime())) return String(appt.date);
  return parsed.toLocaleDateString('fr-FR');
};

const formatDisplayTime = (appt) => {
  if (!appt?.time) return '';
  return String(appt.time).slice(0, 5);
};

export function TabPrescriptions({ appointments, onDownload, highlightAppointmentId }) {
  const withPrescriptions = useMemo(() => {
    const filtered = (appointments || []).filter(
      (appt) => appt?.prescription_url && (appt?.prescription_signed || appt?.prescription_signed_at),
    );
    return sortAppointments(filtered);
  }, [appointments]);

  useEffect(() => {
    if (!highlightAppointmentId) return;
    const target = document.getElementById(`prescription-${highlightAppointmentId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightAppointmentId]);

  if (!withPrescriptions.length) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Aucune ordonnance disponible pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {withPrescriptions.map((appt) => {
        const apptId = getAppointmentId(appt);
        const isHighlighted = highlightAppointmentId && String(apptId) === String(highlightAppointmentId);
        const typeLabel = appt?.appointment_type === 'act' ? 'Acte' : 'Pré-consultation';
        return (
          <div
            key={apptId || `${appt?.appointment_type || 'appt'}-${appt?.date || 'unknown'}`}
            id={apptId ? `prescription-${apptId}` : undefined}
            className={`card bg-white shadow-md border ${isHighlighted ? 'ring-2 ring-blue-400' : ''}`}
          >
            <div className="card-body">
              <h3 className="card-title">Ordonnance {typeLabel}</h3>
              <p className="text-sm text-slate-600">
                Date RDV: {formatDisplayDate(appt)} {formatDisplayTime(appt)}
              </p>
              <div className="card-actions justify-end">
                <button type="button" onClick={() => onDownload?.(appt)} className="btn btn-primary btn-sm">
                  Telecharger PDF
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
