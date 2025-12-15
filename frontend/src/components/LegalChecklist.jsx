import React, { useEffect, useMemo, useState } from 'react';

import {
  acknowledgeLegalBulk,
  acknowledgeLegalCase,
  fetchLegalCatalog,
  fetchLegalStatus,
} from '../lib/api.js';

const ROLE_LABELS = {
  parent1: 'Parent 1',
  parent2: 'Parent 2',
  other_guardian: 'Tuteur légal',
};

const LoadingState = ({ text = 'Chargement...' }) => (
  <div className="flex items-center gap-2 text-sm text-slate-600">
    <span className="loading loading-spinner loading-sm" />
    <span>{text}</span>
  </div>
);

export function LegalChecklist({
  appointmentId,
  token,
  sessionCode,
  fixedRole = null,
  onStatusChange,
}) {
  const [catalog, setCatalog] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeRole, setActiveRole] = useState(fixedRole || 'parent1');
  const [submitting, setSubmitting] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState(new Set());

  useEffect(() => {
    if (fixedRole) {
      setActiveRole(fixedRole);
    }
  }, [fixedRole]);

  useEffect(() => {
    if (!appointmentId && !sessionCode) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchLegalCatalog({ appointmentId, sessionCode, token }),
      fetchLegalStatus({ appointmentId, sessionCode, token }),
    ])
      .then(([catalogPayload, statusPayload]) => {
        if (cancelled) return;
        setCatalog(catalogPayload);
        setStatus(statusPayload);
        onStatusChange?.(statusPayload);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Impossible de charger les documents.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId, sessionCode, token, onStatusChange]);

  useEffect(() => {
    if (catalog?.documents?.length) {
      setExpandedDocs(new Set(catalog.documents.map((doc) => doc.document_type)));
    }
  }, [catalog]);

  const docStatusByType = useMemo(() => {
    const map = new Map();
    (status?.documents || []).forEach((doc) => {
      map.set(doc.document_type, doc);
    });
    return map;
  }, [status]);

  const availableRoles = useMemo(() => {
    const roles = new Set();
    (status?.documents || []).forEach((doc) => {
      (doc.required_roles || []).forEach((role) => roles.add(role));
    });
    if (!roles.size && fixedRole) {
      roles.add(fixedRole);
    }
    if (!roles.size) {
      roles.add('parent1');
    }
    return Array.from(roles);
  }, [status, fixedRole]);

  useEffect(() => {
    if (!availableRoles.includes(activeRole)) {
      setActiveRole(availableRoles[0]);
    }
  }, [availableRoles, activeRole]);

  const isCaseChecked = (documentType, caseKey) => {
    const docStatus = docStatusByType.get(documentType);
    if (!docStatus) return false;
    const ack = docStatus.acknowledged || {};
    const roleAck = ack[activeRole] || ack?.[String(activeRole)] || [];
    return roleAck.includes(caseKey);
  };

  const missingForRole = (documentType) => {
    const docStatus = docStatusByType.get(documentType);
    if (!docStatus) return [];
    const missing = docStatus.missing || {};
    return missing[activeRole] || missing?.[String(activeRole)] || [];
  };

  const documentCounts = (documentType, doc) => {
    const requiredCases = (doc?.cases || []).filter(
      (item) => item.required && (item.required_roles || []).includes(activeRole),
    );
    const total = requiredCases.length;
    const checked = requiredCases.filter((item) => isCaseChecked(documentType, item.key)).length;
    const missingCount = missingForRole(documentType).length;
    const complete = missingCount === 0 && total > 0;
    return { total, checked, complete };
  };

  const documentComplete = (documentType, doc) => documentCounts(documentType, doc).complete;
  const checklistComplete = Boolean(status?.complete);

  const handleStatusUpdate = (nextStatus) => {
    setStatus(nextStatus);
    onStatusChange?.(nextStatus);
  };

  const handleCheck = async (documentType, caseKey) => {
    if (!appointmentId) return;
    setSubmitting(true);
    setError(null);
    try {
      const nextStatus = await acknowledgeLegalCase({
        appointmentId,
        signerRole: activeRole,
        documentType,
        caseKey,
        sessionCode,
        token,
      });
      handleStatusUpdate(nextStatus);
    } catch (err) {
      setError(err?.message || 'Echec de sauvegarde de la case.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckAll = async () => {
    if (!appointmentId || !catalog) return;
    setSubmitting(true);
    setError(null);
    const acknowledgements = [];
    (catalog.documents || []).forEach((doc) => {
      const docStatus = docStatusByType.get(doc.document_type);
      const required = (doc.cases || []).filter(
        (item) => item.required && (item.required_roles || []).includes(activeRole),
      );
      required.forEach((item) => {
        const alreadyChecked = isCaseChecked(doc.document_type, item.key);
        if (!alreadyChecked) {
          acknowledgements.push({ document_type: doc.document_type, case_key: item.key });
        }
      });
    });
    if (!acknowledgements.length) {
      setSubmitting(false);
      return;
    }
    try {
      const nextStatus = await acknowledgeLegalBulk({
        appointmentId,
        signerRole: activeRole,
        acknowledgements,
        sessionCode,
        token,
      });
      handleStatusUpdate(nextStatus);
    } catch (err) {
      setError(err?.message || 'Echec de la validation des documents.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDoc = (documentType) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(documentType)) {
        next.delete(documentType);
      } else {
        next.add(documentType);
      }
      return next;
    });
  };

  if (!appointmentId && !sessionCode) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-semibold">Checklist documents</h3>
          <span
            className={`badge ${checklistComplete ? 'badge-success' : 'badge-warning'} text-xs`}
          >
            {checklistComplete ? 'Complet' : 'Incomplet'}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {availableRoles.map((role) => (
            <button
              key={role}
              type="button"
              className={`btn btn-xs ${activeRole === role ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveRole(role)}
              disabled={Boolean(fixedRole) || submitting}
            >
              {ROLE_LABELS[role] || role}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={handleCheckAll}
            disabled={submitting || loading}
          >
            {submitting ? 'Validation...' : 'Tout cocher'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error text-sm">{error}</div>}
      {loading && <LoadingState />}

      <div className="space-y-3">
        {(catalog?.documents || []).map((doc) => {
          const counts = documentCounts(doc.document_type, doc);
          const expanded = expandedDocs.has(doc.document_type);
          const docComplete = counts.complete;
          return (
            <div key={doc.document_type} className="border rounded-xl bg-white shadow-sm">
              <button
                type="button"
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                onClick={() => toggleDoc(doc.document_type)}
              >
                <div className="space-y-1">
                  <p className="font-semibold text-slate-800">{doc.title}</p>
                  <p className="text-xs text-slate-500">Version {doc.version}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {counts.checked}/{counts.total || 0} cases
                  </span>
                  <span className={`badge ${docComplete ? 'badge-success' : 'badge-warning'} badge-sm`}>
                    {docComplete ? 'Complet' : 'À valider'}
                  </span>
                  <span className="text-sm text-slate-600">{expanded ? '▲' : '▼'}</span>
                </div>
              </button>
              {expanded && (
                <div className="px-4 pb-4">
                  <ul className="space-y-2">
                    {(doc.cases || []).map((item) => {
                      const checked = isCaseChecked(doc.document_type, item.key);
                      const disabled = checked || submitting;
                      return (
                        <li key={item.key} className="flex items-start gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm mt-1"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => handleCheck(doc.document_type, item.key)}
                          />
                          <span>{item.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
