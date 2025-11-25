import React from 'react';

export const StepsCard = ({ stepsChecked, stepsSubmitting, onCheck, onContinue }) => {
  return (
    <section className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Etapes du parcours</h2>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>
            Consultation pre-operatoire (visio ou presentiel) pour valider l&apos;intervention et repondre
            aux questions.
          </li>
          <li>
            Signature du consentement eclaire par les deux parents ou representants legaux (telechargement
            ou signature sur place).
          </li>
          <li>Planification de l&apos;acte et preparation du materiel prescrit (ordonnance fournie).</li>
        </ul>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="checkbox checkbox-primary mt-1"
          checked={stepsChecked}
          onChange={(event) => onCheck?.(event.target.checked)}
        />
        <span>J&apos;ai compris les etapes du parcours.</span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={`btn ${stepsSubmitting ? 'loading' : 'btn-primary'}`}
          onClick={onContinue}
          disabled={!stepsChecked || stepsSubmitting}
        >
          {stepsSubmitting ? 'Enregistrement...' : 'Continuer'}
        </button>
        <a className="link text-primary text-sm" href="/faq" target="_blank" rel="noopener noreferrer">
          Consulter la FAQ
        </a>
      </div>
    </section>
  );
};
