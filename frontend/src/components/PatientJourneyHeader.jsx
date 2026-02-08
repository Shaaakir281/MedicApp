import React, { useMemo } from 'react';
import { Calendar, Check, Clock, FileText, PenTool, Phone } from 'lucide-react';

const defaultJourney = {
  dossier: { created: false, complete: false, missing_fields: [] },
  pre_consultation: { booked: false, date: null },
  rdv_acte: { booked: false, date: null },
  signatures: {
    complete: false,
    parent1_signed: false,
    parent2_signed: false,
    reflection_delay: { can_sign: false, days_left: null, available_date: null },
  },
};

const getStyles = (status) => {
  switch (status) {
    case 'complete':
      return {
        circle: 'bg-emerald-500 border-emerald-500 text-white shadow-sm',
        label: 'text-emerald-700',
        subtext: 'text-emerald-600',
        line: 'bg-emerald-500',
      };
    case 'current':
      return {
        circle: 'bg-blue-800 border-blue-800 text-white shadow-md',
        label: 'text-blue-900',
        subtext: 'text-blue-700',
        line: 'bg-slate-300',
      };
    case 'waiting':
      return {
        circle: 'bg-white border-amber-500 text-amber-600 shadow-sm',
        label: 'text-slate-700',
        subtext: 'text-amber-600',
        line: 'bg-slate-300',
      };
    default:
      return {
        circle: 'bg-white border-slate-300 text-slate-400 shadow-sm',
        label: 'text-slate-500',
        subtext: 'text-slate-400',
        line: 'bg-slate-200',
      };
  }
};

const buildJourneyMessage = (journeyStatus) => {
  if (!journeyStatus) return null;

  const dossier = journeyStatus.dossier || defaultJourney.dossier;
  const preConsultation = journeyStatus.pre_consultation || defaultJourney.pre_consultation;
  const rdvActe = journeyStatus.rdv_acte || defaultJourney.rdv_acte;
  const signatures = journeyStatus.signatures || defaultJourney.signatures;
  const delay = signatures.reflection_delay || {};

  if (!dossier.created) {
    return {
      type: 'action',
      text: "Pour commencer, compl?tez le dossier (nom, pr?nom et date de naissance de l?enfant + nom/pr?nom du parent 1) pour pouvoir planifier un rendez-vous.",
      icon: FileText,
      action: 'Compl?ter le dossier',
      target: 'dossier',
    };
  }

  if (!preConsultation.booked) {
    return {
      type: 'info',
      text: 'Vous pouvez d?sormais prendre votre rendez-vous d?information.',
      icon: Calendar,
      action: 'Prendre rendez-vous',
      target: 'rdv',
    };
  }

  if (preConsultation.booked && !rdvActe.booked) {
    return {
      type: 'info',
      text: 'Vous pouvez planifier votre rendez-vous pour l?acte.',
      icon: Calendar,
      action: 'Planifier l?acte',
      target: 'rdv',
    };
  }

  if (signatures.complete) return null;

  if (delay && delay.can_sign === false && typeof delay.days_left === 'number') {
    return {
      type: 'waiting',
      text: `Signature possible dans ${delay.days_left} jour${delay.days_left > 1 ? 's' : ''}`,
      icon: Clock,
    };
  }

  if (!dossier.complete) {
    return {
      type: 'action',
      text: 'Compl?tez le dossier pour signer ? distance',
      icon: FileText,
      action: 'Compl?ter le dossier',
      target: 'dossier',
    };
  }

  const missingParents = [];
  if (!signatures.parent1_signed) missingParents.push('Parent 1');
  if (!signatures.parent2_signed) missingParents.push('Parent 2');

  if (missingParents.length) {
    return {
      type: 'ready',
      text: `${missingParents.join(' et ')} peut signer`,
      icon: PenTool,
    };
  }

  return null;
};

export function PatientJourneyHeader({
  childName,
  email,
  journeyStatus,
  onLogout,
  onNavigate,
}) {
  const resolvedJourney = journeyStatus || defaultJourney;
  const dossier = resolvedJourney.dossier || defaultJourney.dossier;
  const preConsultation = resolvedJourney.pre_consultation || defaultJourney.pre_consultation;
  const rdvActe = resolvedJourney.rdv_acte || defaultJourney.rdv_acte;
  const signatures = resolvedJourney.signatures || defaultJourney.signatures;
  const delay = signatures.reflection_delay || defaultJourney.signatures.reflection_delay;

  const signatureStatus = useMemo(() => {
    if (signatures.complete) return 'complete';
    if (delay?.can_sign) return 'current';
    if (typeof delay?.days_left === 'number') return 'waiting';
    return 'pending';
  }, [delay?.can_sign, delay?.days_left, signatures.complete]);

  const steps = [
    {
      id: 'dossier',
      label: 'Dossier',
      Icon: FileText,
      status: dossier.created ? 'complete' : 'current',
      subtext: dossier.created ? 'Créé' : 'À créer',
      onClick: () => onNavigate?.('dossier'),
    },
    {
      id: 'preconsult',
      label: 'Pré-consultation',
      Icon: Phone,
      status: preConsultation.booked ? 'complete' : 'pending',
      subtext: preConsultation.booked ? 'RDV pris' : 'À planifier',
      onClick: () => onNavigate?.('rdv'),
    },
    {
      id: 'rdvacte',
      label: 'RDV Acte',
      Icon: Calendar,
      status: rdvActe.booked ? 'complete' : 'pending',
      subtext: rdvActe.booked ? 'RDV pris' : 'À planifier',
      onClick: () => onNavigate?.('rdv'),
    },
    {
      id: 'signatures',
      label: 'Signatures',
      Icon: PenTool,
      status: signatureStatus,
      subtext: signatures.complete ? 'Terminé' : 'En attente',
      onClick: () => onNavigate?.('signatures'),
    },
  ];

  const journeyMessage = useMemo(() => buildJourneyMessage(resolvedJourney), [resolvedJourney]);


  return (
    <div className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between border-b border-slate-200/60">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Enfant :</span>
          <span className="font-semibold text-slate-800">{childName || '-'}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500 hidden sm:inline">{email || '-'}</span>
          <button
            type="button"
            className="text-slate-500 hover:text-blue-800 transition-colors font-medium"
            onClick={onLogout}
          >
            Se déconnecter
          </button>
        </div>
      </div>

      <div className="hidden md:block max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between relative">
          <div className="absolute top-5 left-[12%] right-[12%] h-0.5 bg-slate-200 z-0 pointer-events-none" />

          {steps.map((step, index) => {
            const styles = getStyles(step.status);
            const Icon = step.Icon;

            return (
              <div key={step.id} className="flex flex-col items-center relative z-10" style={{ flex: 1 }}>
                {index < steps.length - 1 && step.status === 'complete' && (
                  <div
                    className="absolute top-5 h-0.5 bg-emerald-500 z-0 pointer-events-none"
                    style={{ left: '50%', width: '100%' }}
                  />
                )}

                <button
                  type="button"
                  onClick={step.onClick}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center relative z-20
                    border-2 transition-all duration-200 hover:scale-110 cursor-pointer
                    ${styles.circle}
                  `}
                >
                  {step.status === 'complete' ? (
                    <Check className="w-5 h-5" strokeWidth={2.5} />
                  ) : step.status === 'waiting' ? (
                    <Clock className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </button>

                <span className={`mt-2 text-sm font-medium ${styles.label}`}>
                  {step.label}
                </span>
                <span className={`text-xs ${styles.subtext}`}>{step.subtext}</span>
              </div>
            );
          })}
        </div>

        {journeyMessage && (
          <div className="mt-5 flex justify-center">
            {journeyMessage.type === 'action' || journeyMessage.type === 'info' ? (
              <button
                type="button"
                onClick={() => onNavigate?.(journeyMessage.target || 'dossier')}
                className={`inline-flex items-center gap-2 text-sm rounded-lg py-2 px-4 transition-colors font-medium ${
                  journeyMessage.type === 'info'
                    ? 'text-blue-800 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200'
                    : 'text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50'
                }`}
              >
                <journeyMessage.icon className="w-4 h-4" />
                {journeyMessage.text}
                {journeyMessage.action && (
                  <span className="ml-2 text-blue-700 font-semibold">{journeyMessage.action}</span>
                )}
              </button>
            ) : (
              <div
                className={`
                  inline-flex items-center gap-2 text-sm rounded-lg py-2 px-4 font-medium
                  ${journeyMessage.type === 'waiting' ? 'text-amber-700 bg-amber-50 border border-amber-200' : ''}
                  ${journeyMessage.type === 'ready' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : ''}
                `}
              >
                <journeyMessage.icon className="w-4 h-4" />
                {journeyMessage.text}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="md:hidden px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => {
            const styles = getStyles(step.status);
            const Icon = step.Icon;

            return (
              <React.Fragment key={step.id}>
                <button type="button" onClick={step.onClick} className="flex flex-col items-center">
                  <div
                    className={`
                      w-9 h-9 rounded-full flex items-center justify-center relative z-10
                      border-2 ${styles.circle}
                    `}
                  >
                    {step.status === 'complete' ? (
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    ) : step.status === 'waiting' ? (
                      <Clock className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`mt-1 text-[10px] font-medium ${styles.label}`}>
                    {step.id === 'preconsult'
                      ? 'Pré-consult'
                      : step.id === 'rdvacte'
                        ? 'RDV'
                        : step.label}
                  </span>
                  <span className={`text-[9px] ${styles.subtext}`}>{step.subtext}</span>
                </button>

                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 ${
                      step.status === 'complete' ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {journeyMessage && (
          <div className="flex justify-center">
            {journeyMessage.type === 'action' || journeyMessage.type === 'info' ? (
              <button
                type="button"
                onClick={() => onNavigate?.(journeyMessage.target || 'dossier')}
                className={`inline-flex items-center gap-2 text-xs rounded-lg py-2 px-3 font-medium ${
                  journeyMessage.type === 'info'
                    ? 'text-blue-800 bg-blue-50 border border-blue-200'
                    : 'text-slate-700 bg-white border border-slate-200 shadow-sm'
                }`}
              >
                <journeyMessage.icon className="w-3.5 h-3.5" />
                {journeyMessage.text}
                {journeyMessage.action && (
                  <span className="ml-2 text-blue-700 font-semibold">{journeyMessage.action}</span>
                )}
              </button>
            ) : (
              <div
                className={`
                  inline-flex items-center gap-2 text-xs rounded-lg py-2 px-3 font-medium
                  ${journeyMessage.type === 'waiting' ? 'text-amber-700 bg-amber-50 border border-amber-200' : ''}
                  ${journeyMessage.type === 'ready' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : ''}
                `}
              >
                <journeyMessage.icon className="w-3.5 h-3.5" />
                {journeyMessage.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
