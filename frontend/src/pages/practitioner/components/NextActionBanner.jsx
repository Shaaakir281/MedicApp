import React from 'react';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : null);

export const NextActionBanner = ({ procedure, documentSignatures = [] }) => {
  const getNextAction = () => {
    // Priorité 1: Vérifier signatures
    const docs = documentSignatures || [];
    const partialDocs = docs.filter(d => d.status === 'partial');

    if (partialDocs.length > 0) {
      const doc = partialDocs[0];
      const pendingParent = doc.parent1Status !== 'signed' ? 'Parent 1' : 'Parent 2';
      return {
        type: 'warning',
        icon: '⚠️',
        message: `Attente signature ${pendingParent}`,
        detail: `Document: ${doc.displayLabel || doc.documentType}`,
      };
    }

    const unsignedDocs = docs.filter(d => d.status !== 'completed');
    if (unsignedDocs.length > 0) {
      return {
        type: 'info',
        icon: 'ℹ️',
        message: `${unsignedDocs.length} document(s) non signé(s)`,
        detail: unsignedDocs.map(d => d.displayLabel || d.documentType).join(', '),
      };
    }

    // Priorité 2: Vérifier RDV
    if (!procedure?.has_preconsultation) {
      return {
        type: 'warning',
        icon: '⚠️',
        message: 'Pré-consultation non planifiée',
        detail: 'Planifier le rendez-vous de consultation pré-opératoire',
      };
    }

    if (!procedure?.has_act_planned) {
      return {
        type: 'warning',
        icon: '⚠️',
        message: 'Acte non planifié',
        detail: 'Planifier le rendez-vous pour l\'acte chirurgical',
      };
    }

    // Priorité 3: Données manquantes
    const missingItems = procedure?.missing_items || [];
    if (missingItems.length > 0) {
      return {
        type: 'info',
        icon: 'ℹ️',
        message: `${missingItems.length} donnée(s) manquante(s)`,
        detail: missingItems.slice(0, 2).join(', '),
      };
    }

    // Tout OK !
    return {
      type: 'success',
      icon: '✅',
      message: 'Dossier complet',
      detail: 'Tous les documents sont signés, RDV planifiés',
    };
  };

  const action = getNextAction();

  const bgColors = {
    success: 'bg-green-50 border-green-300',
    warning: 'bg-yellow-50 border-yellow-300',
    info: 'bg-blue-50 border-blue-300',
  };

  const textColors = {
    success: 'text-green-800',
    warning: 'text-yellow-800',
    info: 'text-blue-800',
  };

  return (
    <div className={`border-l-4 p-4 rounded-lg ${bgColors[action.type]}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{action.icon}</span>
        <div className="flex-1">
          <h4 className={`font-semibold ${textColors[action.type]}`}>
            Prochaine action
          </h4>
          <p className={`text-sm font-medium ${textColors[action.type]} mt-0.5`}>
            {action.message}
          </p>
          {action.detail && (
            <p className={`text-xs ${textColors[action.type]} mt-1 opacity-80`}>
              {action.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
