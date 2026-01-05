import React, { useEffect, useState } from 'react';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim()) ||
  'https://medicapp-backend-prod.azurewebsites.net';

/**
 * Panneau de vérification quotidienne des documents signés.
 * Affiche un résumé visuel avec indicateurs aujourd'hui/hier/demain.
 */
export const DocumentVerificationPanel = ({ token }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchVerificationStatus = async (date = null) => {
    if (!token) {
      setLoading(false);
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const path = date
        ? `/practitioner/document-verification/status?target_date=${date}`
        : '/practitioner/document-verification/status';

      const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Erreur ${response.status}: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Erreur vérification documents:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      const today = await fetchVerificationStatus();
      setStatus(today);
    };

    loadData();

    // Rafraîchir toutes les 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading && !status) {
    return (
      <div className="bg-slate-50 border rounded-lg p-4">
        <p className="text-sm text-slate-500">Chargement de la vérification...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-600">⚠️ {error}</p>
      </div>
    );
  }

  if (!status) return null;

  const isHealthy = status.status === 'healthy';
  const bgColor = isHealthy ? 'bg-green-50' : 'bg-orange-50';
  const borderColor = isHealthy ? 'border-green-200' : 'border-orange-300';
  const textColor = isHealthy ? 'text-green-700' : 'text-orange-700';
  const icon = isHealthy ? '✅' : '⚠️';

  return (
    <div className={`border rounded-lg p-4 ${bgColor} ${borderColor}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{icon}</span>
            <h3 className={`font-semibold ${textColor}`}>
              Vérification Documents Signés
            </h3>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Aujourd'hui :</span>
              <span className="font-semibold text-slate-900">
                {status.completed_today} document(s) complété(s)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">Stockage :</span>
              <span className={`font-semibold ${isHealthy ? 'text-green-700' : 'text-orange-700'}`}>
                {isHealthy ? (
                  `Tous stockés (${status.total_completed} documents)`
                ) : (
                  `${status.total_anomalies} anomalie(s) détectée(s)`
                )}
              </span>
            </div>

            {status.total_pending > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">En attente :</span>
                <span className="font-medium text-blue-600">
                  {status.total_pending} document(s)
                </span>
              </div>
            )}

            {!isHealthy && (
              <div className="mt-3 pt-3 border-t border-orange-200">
                <p className="text-xs font-medium text-orange-800 mb-1">Anomalies détectées :</p>
                <ul className="text-xs text-orange-700 space-y-0.5">
                  {status.anomalies_by_check.missing_identifiers > 0 && (
                    <li>• {status.anomalies_by_check.missing_identifiers} identifiant(s) manquant(s)</li>
                  )}
                  {status.anomalies_by_check.missing_files > 0 && (
                    <li>• {status.anomalies_by_check.missing_files} fichier(s) manquant(s)</li>
                  )}
                  {status.anomalies_by_check.orphaned_yousign > 0 && (
                    <li>• {status.anomalies_by_check.orphaned_yousign} procédure(s) non purgée(s)</li>
                  )}
                  {status.anomalies_by_check.stuck_partial > 0 && (
                    <li>• {status.anomalies_by_check.stuck_partial} signature(s) bloquée(s)</li>
                  )}
                  {status.anomalies_by_check.corrupted_files > 0 && (
                    <li>• {status.anomalies_by_check.corrupted_files} fichier(s) corrompu(s)</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-500">
          {new Date(status.date).toLocaleDateString('fr-FR')}
        </div>
      </div>
    </div>
  );
};
