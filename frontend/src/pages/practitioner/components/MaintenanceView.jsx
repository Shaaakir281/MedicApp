import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../../components/ui/Badge.jsx';
import {
  fetchAdminHealth,
  fetchAdminOverview,
  fetchAdminRecentActivity,
} from '../../../lib/api.js';

export const MaintenanceView = ({ token }) => {
  const overviewQuery = useQuery({
    queryKey: ['adminOverview'],
    queryFn: () => fetchAdminOverview(token),
    enabled: Boolean(token),
  });

  const healthQuery = useQuery({
    queryKey: ['adminHealth'],
    queryFn: () => fetchAdminHealth(token),
    enabled: Boolean(token),
  });

  const activityQuery = useQuery({
    queryKey: ['adminActivity'],
    queryFn: () => fetchAdminRecentActivity(token),
    enabled: Boolean(token),
  });

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Vue globale</h3>
          {overviewQuery.isLoading ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : (
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Patients</span>
                <span className="font-semibold text-slate-900">
                  {overviewQuery.data?.total_patients ?? '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Signatures en attente</span>
                <span className="font-semibold text-slate-900">
                  {overviewQuery.data?.pending_signatures ?? '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>RDV semaine</span>
                <span className="font-semibold text-slate-900">
                  {overviewQuery.data?.appointments_this_week ?? '-'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Santé services</h3>
          {healthQuery.isLoading ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : (
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Base de données</span>
                <Badge variant={healthQuery.data?.database === 'ok' ? 'success' : 'danger'} size="xs">
                  {healthQuery.data?.database ?? 'n/a'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Stockage</span>
                <Badge variant={healthQuery.data?.storage === 'ok' ? 'success' : 'danger'} size="xs">
                  {healthQuery.data?.storage ?? 'n/a'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Email</span>
                <Badge
                  variant={healthQuery.data?.email_service === 'ok' ? 'success' : 'warning'}
                  size="xs"
                >
                  {healthQuery.data?.email_service ?? 'n/a'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>SMS</span>
                <Badge variant={healthQuery.data?.sms_service === 'ok' ? 'success' : 'warning'} size="xs">
                  {healthQuery.data?.sms_service ?? 'n/a'}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Activité récente</h3>
          {activityQuery.isLoading ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : (
            <div className="space-y-2 text-sm text-slate-600">
              {(activityQuery.data || []).length === 0 && (
                <p className="text-sm text-slate-400">Aucune activité récente.</p>
              )}
              {(activityQuery.data || []).slice(0, 6).map((item) => (
                <div key={`${item.type}-${item.date}`} className="flex flex-col gap-0.5">
                  <span className="font-medium text-slate-800">{item.details}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(item.date).toLocaleString('fr-FR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
