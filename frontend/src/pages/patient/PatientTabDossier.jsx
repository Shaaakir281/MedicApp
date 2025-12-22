import React, { useEffect, useState } from 'react';

import { InfoBanner } from '../../components/patient/dossier/InfoBanner.jsx';
import { ChildIdentityForm } from '../../components/patient/dossier/ChildIdentityForm.jsx';
import { GuardianForm } from '../../components/patient/dossier/GuardianForm.jsx';
import { Button, Card, SectionHeading } from '../../components/ui';
import { useDossier } from '../../hooks/useDossier.js';
import { vmToForm } from '../../services/dossier.mapper.js';

export function PatientTabDossier({ token, currentUser }) {
  const dossier = useDossier({ token });
  const [sendingRole, setSendingRole] = useState(null);
  const [verifyingRole, setVerifyingRole] = useState(null);
  const [sendingEmailRole, setSendingEmailRole] = useState(null);

  useEffect(() => {
    if (dossier.vm) {
      dossier.setFormState(vmToForm(dossier.vm));
    }
  }, [dossier.vm]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendOtp = async (role) => {
    setSendingRole(role);
    await dossier.sendOtp(role);
    setSendingRole(null);
  };

  const handleVerifyOtp = async (role, code) => {
    if (!code) {
      dossier.setError('Veuillez saisir le code SMS.');
      return;
    }
    setVerifyingRole(role);
    await dossier.verifyOtp(role, code);
    setVerifyingRole(null);
  };

  const handleSendEmailVerification = async (role) => {
    setSendingEmailRole(role);
    await dossier.sendEmailVerification(role);
    setSendingEmailRole(null);
  };

  return (
    <div className="space-y-4">
      {dossier.error && <div className="alert alert-error">{dossier.error}</div>}
      {dossier.success && <div className="alert alert-success">{dossier.success}</div>}
      <InfoBanner warnings={dossier.vm?.warnings || []} />

      <Card className="space-y-6">
        <SectionHeading title="Dossier patient" subtitle="Identité de l'enfant et responsables légaux." />

        <div className="grid gap-6 lg:grid-cols-2">
          <ChildIdentityForm formState={dossier.formState || {}} onChange={dossier.updateForm} />
          <div className="space-y-3">
            <GuardianForm
              title="Parent / Tuteur 1"
              prefix="parent1"
              formState={dossier.formState || {}}
              onChange={dossier.updateForm}
              required
              guardianData={dossier.vm?.guardians?.PARENT_1}
              verificationState={dossier.vm?.verification?.PARENT_1}
              onSendCode={() => handleSendOtp('PARENT_1')}
              onVerifyCode={(code) => handleVerifyOtp('PARENT_1', code)}
              sending={sendingRole === 'PARENT_1'}
              verifying={verifyingRole === 'PARENT_1'}
              isUserAccount={true}
              userEmailVerified={currentUser?.email_verified || false}
            />
            <GuardianForm
              title="Parent / Tuteur 2"
              prefix="parent2"
              formState={dossier.formState || {}}
              onChange={dossier.updateForm}
              required
              guardianData={dossier.vm?.guardians?.PARENT_2}
              verificationState={dossier.vm?.verification?.PARENT_2}
              onSendCode={() => handleSendOtp('PARENT_2')}
              onVerifyCode={(code) => handleVerifyOtp('PARENT_2', code)}
              sending={sendingRole === 'PARENT_2'}
              verifying={verifyingRole === 'PARENT_2'}
              onSendEmailVerification={() => handleSendEmailVerification('PARENT_2')}
              sendingEmail={sendingEmailRole === 'PARENT_2'}
            />
          </div>
        </div>

        <div className="border-t pt-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-blue-900">Parcours de prise en charge</h3>
            <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
              <li>Un rendez-vous de pré-consultation est <strong>obligatoire</strong> avant toute intervention</li>
              <li>
                Après la pré-consultation, un délai de réflexion de <strong>15 jours minimum</strong> est requis
                avant de pouvoir signer les documents
              </li>
              <li>
                Les <strong>2 parents</strong> doivent signer tous les documents (autorisation chirurgicale,
                consentement éclairé, devis)
              </li>
              <li>Le rendez-vous pour l'acte ne pourra être pris qu'après signature complète de tous les documents</li>
            </ul>
            <div className="flex items-start gap-2 mt-3">
              <input
                type="checkbox"
                id="procedure-info-ack"
                checked={dossier.formState?.procedure_info_acknowledged || false}
                onChange={(e) => dossier.updateForm('procedure_info_acknowledged', e.target.checked)}
                className="checkbox checkbox-primary mt-0.5"
              />
              <label htmlFor="procedure-info-ack" className="text-sm text-blue-900 cursor-pointer">
                J'ai pris connaissance du parcours de prise en charge et j'accepte ces conditions
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={
                dossier.saving ||
                dossier.loading ||
                !dossier.formState ||
                !dossier.formState.procedure_info_acknowledged
              }
              onClick={dossier.save}
            >
              {dossier.saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
