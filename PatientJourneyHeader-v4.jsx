import React, { useState } from 'react';
import { FileText, Phone, Calendar, PenTool, Check, Clock } from 'lucide-react';

const PatientJourneyHeader = () => {
  // Simulation données patient (viendront de l'API)
  const [patientData] = useState({
    childName: "Fathi METALSI",
    email: "fathimetalsi@gmail.com",
    
    // Étape 1 : Dossier
    dossierCreated: true,
    dossierComplete: false,
    missingFields: ["Parent 2"],
    
    // Étape 2 : Pré-consultation
    preConsultBooked: true,
    preConsultDate: "2025-02-10T10:00:00",
    
    // Étape 3 : RDV Acte
    rdvActeBooked: true,
    rdvActeDate: "2025-02-25T09:00:00",
    
    // Étape 4 : Signatures
    signaturesComplete: false,
    parent1Signed: false,
    parent2Signed: false,
  });

  // Calcul délai de réflexion (15 jours après pré-consult)
  const calculateDelaiReflexion = () => {
    if (!patientData.preConsultDate) return { canSign: false, daysLeft: null };
    
    const preConsultDate = new Date(patientData.preConsultDate);
    const signatureAllowedDate = new Date(preConsultDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.max(0, Math.ceil((signatureAllowedDate - now) / (1000 * 60 * 60 * 24)));
    
    return {
      canSign: daysLeft === 0,
      daysLeft,
      signatureAllowedDate
    };
  };

  const delaiInfo = calculateDelaiReflexion();

  // Message contextuel pour l'étape Signatures
  const getSignatureMessage = () => {
    if (patientData.signaturesComplete) {
      return null; // Pas de message si terminé
    }
    
    // Délai non écoulé
    if (!delaiInfo.canSign) {
      return { 
        type: 'waiting', 
        text: `Signature possible dans ${delaiInfo.daysLeft} jour${delaiInfo.daysLeft > 1 ? 's' : ''}`,
        icon: Clock
      };
    }
    
    // Délai OK mais dossier incomplet → un seul message combiné
    if (!patientData.dossierComplete) {
      return { 
        type: 'action', 
        text: 'Complétez le dossier pour signer à distance',
        icon: FileText,
        clickable: true
      };
    }
    
    // Tout est prêt
    const canSign = [];
    if (!patientData.parent1Signed) canSign.push('Parent 1');
    if (!patientData.parent2Signed) canSign.push('Parent 2');
    
    return { 
      type: 'ready', 
      text: `${canSign.join(' et ')} peut signer`,
      icon: PenTool
    };
  };

  const signatureMessage = getSignatureMessage();

  // Définition des 4 étapes
  const steps = [
    {
      id: 'dossier',
      label: 'Dossier',
      Icon: FileText,
      status: patientData.dossierCreated ? 'complete' : 'current',
      subtext: patientData.dossierCreated ? 'Créé' : 'À créer',
      onClick: () => document.getElementById('tab-dossier')?.click(),
    },
    {
      id: 'preconsult',
      label: 'Pré-consultation',
      Icon: Phone,
      status: patientData.preConsultBooked ? 'complete' : 'pending',
      subtext: patientData.preConsultBooked ? 'RDV pris' : 'À planifier',
      onClick: () => document.getElementById('tab-rdv')?.click(),
    },
    {
      id: 'rdvacte',
      label: 'RDV Acte',
      Icon: Calendar,
      status: patientData.rdvActeBooked ? 'complete' : 'pending',
      subtext: patientData.rdvActeBooked ? 'RDV pris' : 'À planifier',
      onClick: () => document.getElementById('tab-rdv')?.click(),
    },
    {
      id: 'signatures',
      label: 'Signatures',
      Icon: PenTool,
      status: patientData.signaturesComplete 
        ? 'complete' 
        : delaiInfo.canSign 
          ? 'current' 
          : 'waiting',
      subtext: patientData.signaturesComplete ? 'Terminé' : 'En attente',
      onClick: () => document.getElementById('tab-signatures')?.click(),
    },
  ];

  // Styles selon statut - palette lumineuse
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

  return (
    <div className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
      {/* Ligne supérieure */}
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between border-b border-slate-200/60">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Enfant :</span>
          <span className="font-semibold text-slate-800">{patientData.childName}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500 hidden sm:inline">{patientData.email}</span>
          <button className="text-slate-500 hover:text-blue-800 transition-colors font-medium">
            Se déconnecter
          </button>
        </div>
      </div>

      {/* Timeline Desktop */}
      <div className="hidden md:block max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between relative">
          {/* Ligne de fond */}
          <div className="absolute top-5 left-[12%] right-[12%] h-0.5 bg-slate-200" />
          
          {steps.map((step, index) => {
            const styles = getStyles(step.status);
            const Icon = step.Icon;
            
            return (
              <div key={step.id} className="flex flex-col items-center relative z-10" style={{ flex: 1 }}>
                {/* Ligne verte si étape complète */}
                {index < steps.length - 1 && step.status === 'complete' && (
                  <div 
                    className="absolute top-5 h-0.5 bg-emerald-500 z-0" 
                    style={{ left: '50%', width: '100%' }}
                  />
                )}
                
                {/* Cercle */}
                <button
                  onClick={step.onClick}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
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
                
                {/* Label */}
                <span className={`mt-2 text-sm font-medium ${styles.label}`}>
                  {step.label}
                </span>
                
                {/* Sous-texte */}
                <span className={`text-xs ${styles.subtext}`}>
                  {step.subtext}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Message contextuel unique */}
        {signatureMessage && (
          <div className="mt-5 flex justify-center">
            {signatureMessage.clickable ? (
              <button 
                onClick={() => document.getElementById('tab-dossier')?.click()}
                className="inline-flex items-center gap-2 text-sm text-blue-800 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg py-2 px-4 transition-colors font-medium"
              >
                <signatureMessage.icon className="w-4 h-4" />
                {signatureMessage.text}
              </button>
            ) : (
              <div className={`
                inline-flex items-center gap-2 text-sm rounded-lg py-2 px-4 font-medium
                ${signatureMessage.type === 'waiting' ? 'text-amber-700 bg-amber-50 border border-amber-200' : ''}
                ${signatureMessage.type === 'ready' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : ''}
              `}>
                <signatureMessage.icon className="w-4 h-4" />
                {signatureMessage.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline Mobile */}
      <div className="md:hidden px-4 py-4">
        {/* Timeline compacte */}
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => {
            const styles = getStyles(step.status);
            const Icon = step.Icon;
            
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={step.onClick}
                  className="flex flex-col items-center"
                >
                  <div className={`
                    w-9 h-9 rounded-full flex items-center justify-center
                    border-2 ${styles.circle}
                  `}>
                    {step.status === 'complete' ? (
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    ) : step.status === 'waiting' ? (
                      <Clock className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`mt-1 text-[10px] font-medium ${styles.label}`}>
                    {step.id === 'preconsult' ? 'Pré-consult' : 
                     step.id === 'rdvacte' ? 'RDV' : 
                     step.label}
                  </span>
                  <span className={`text-[9px] ${styles.subtext}`}>
                    {step.subtext}
                  </span>
                </button>
                
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${
                    step.status === 'complete' ? 'bg-emerald-500' : 'bg-slate-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        
        {/* Message mobile */}
        {signatureMessage && (
          <div className="flex justify-center">
            {signatureMessage.clickable ? (
              <button 
                onClick={() => document.getElementById('tab-dossier')?.click()}
                className="inline-flex items-center gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg py-2 px-3 font-medium"
              >
                <signatureMessage.icon className="w-3.5 h-3.5" />
                {signatureMessage.text}
              </button>
            ) : (
              <div className={`
                inline-flex items-center gap-2 text-xs rounded-lg py-2 px-3 font-medium
                ${signatureMessage.type === 'waiting' ? 'text-amber-700 bg-amber-50 border border-amber-200' : ''}
                ${signatureMessage.type === 'ready' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : ''}
              `}>
                <signatureMessage.icon className="w-3.5 h-3.5" />
                {signatureMessage.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientJourneyHeader;
