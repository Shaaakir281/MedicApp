import React, { useEffect, useRef, useState } from 'react';

import { InfoBanner } from '../../components/patient/dossier/InfoBanner.jsx';
import { ChildIdentityForm } from '../../components/patient/dossier/ChildIdentityForm.jsx';
import { GuardianForm } from '../../components/patient/dossier/GuardianForm.jsx';
import { BlockingNotice, Button, Card, SectionHeading } from '../../components/ui';
import { useDossier } from '../../hooks/useDossier.js';

export function PatientTabDossierView({ dossier, currentUser }) {
  const [sendingRole, setSendingRole] = useState(null);
  const [verifyingRole, setVerifyingRole] = useState(null);
  const [sendingEmailRole, setSendingEmailRole] = useState(null);
  const autoFilledEmailRef = useRef(false);
  const userEmailVerified = Boolean(currentUser?.email_verified && currentUser?.email);
  const parent1EmailVerified = Boolean(
    dossier.vm?.guardians?.PARENT_1?.emailVerifiedAt || userEmailVerified,
  );
  const parent1PhoneVerified = Boolean(dossier.vm?.guardians?.PARENT_1?.phoneVerifiedAt);
  const missingRequiredFields = [];
  const hasValue = (value) => Boolean(String(value || '').trim());
  if (!hasValue(dossier.formState?.childFirstName)) missingRequiredFields.push("Prénom de l'enfant");
  if (!hasValue(dossier.formState?.childLastName)) missingRequiredFields.push("Nom de l'enfant");
  if (!hasValue(dossier.formState?.birthDate)) missingRequiredFields.push('Date de naissance');
  if (!hasValue(dossier.formState?.parent1FirstName)) missingRequiredFields.push('Prénom du parent 1');
  if (!hasValue(dossier.formState?.parent1LastName)) missingRequiredFields.push('Nom du parent 1');
  if (!hasValue(dossier.formState?.parent1Email)) {
    missingRequiredFields.push('Email du parent 1');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dossier.formState?.parent1Email)) {
    missingRequiredFields.push('Email du parent 1 invalide');
  }
  const canAcknowledge =
    missingRequiredFields.length === 0 || dossier.formState?.procedure_info_acknowledged;
  const canSave =
    !dossier.saving &&
    !dossier.loading &&
    dossier.formState &&
    dossier.formState.procedure_info_acknowledged &&
    missingRequiredFields.length === 0;


  const signatureMissing = {
    parent1: [],
    parent2: [],
  };
  if (!hasValue(dossier.formState?.parent1FirstName)) signatureMissing.parent1.push('prénom');
  if (!hasValue(dossier.formState?.parent1LastName)) signatureMissing.parent1.push('nom');
  if (!hasValue(dossier.formState?.parent1Email)) signatureMissing.parent1.push('email');
  if (!hasValue(dossier.formState?.parent1Phone)) signatureMissing.parent1.push('téléphone');
  if (!hasValue(dossier.formState?.parent2FirstName)) signatureMissing.parent2.push('prénom');
  if (!hasValue(dossier.formState?.parent2LastName)) signatureMissing.parent2.push('nom');
  if (!hasValue(dossier.formState?.parent2Email)) signatureMissing.parent2.push('email');
  if (!hasValue(dossier.formState?.parent2Phone)) signatureMissing.parent2.push('téléphone');
  const signatureMissingSummary = [
    signatureMissing.parent1.length ? `Parent 1 : ${signatureMissing.parent1.join(', ')}` : null,
    signatureMissing.parent2.length ? `Parent 2 : ${signatureMissing.parent2.join(', ')}` : null,
  ].filter(Boolean);

  useEffect(() => {
    if (autoFilledEmailRef.current) return;
    if (!currentUser?.email) return;
    if (!dossier.formState || dossier.formState.parent1Email) return;
    dossier.updateForm('parent1Email', currentUser.email);
    autoFilledEmailRef.current = true;
  }, [currentUser?.email, dossier.formState, dossier]);

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
        <SectionHeading title="Compléter votre dossier" subtitle="Identité de l'enfant et responsables légaux." />

        {dossier.isEditing ? (
          <div className="space-y-6">
            <ChildIdentityForm
              formState={dossier.formState || {}}
              onChange={dossier.updateForm}
              disabled={false}
            />
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
                userEmailVerified={userEmailVerified}
                disabled={false}
              />
            <GuardianForm
                title="Parent / Tuteur 2"
                prefix="parent2"
                formState={dossier.formState || {}}
                onChange={dossier.updateForm}
                required={false}
                guardianData={dossier.vm?.guardians?.PARENT_2}
                verificationState={dossier.vm?.verification?.PARENT_2}
                onSendCode={() => handleSendOtp('PARENT_2')}
                onVerifyCode={(code) => handleVerifyOtp('PARENT_2', code)}
                sending={sendingRole === 'PARENT_2'}
                verifying={verifyingRole === 'PARENT_2'}
                onSendEmailVerification={() => handleSendEmailVerification('PARENT_2')}
                sendingEmail={sendingEmailRole === 'PARENT_2'}
                disabled={false}
              />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg">
            {/* Enfant */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-slate-700 border-b pb-1">Enfant</h4>
              <div className="space-y-1 text-sm">
                <div><span className="text-slate-600">Nom:</span> <span className="font-medium">{dossier.formState?.childFirstName} {dossier.formState?.childLastName}</span></div>
                <div><span className="text-slate-600">Né(e) le:</span> <span className="font-medium">{dossier.formState?.birthDate ? new Date(dossier.formState.birthDate).toLocaleDateString('fr-FR') : '-'}</span></div>
                {dossier.formState?.weightKg && <div><span className="text-slate-600">Poids:</span> <span className="font-medium">{dossier.formState.weightKg} kg</span></div>}
              </div>
            </div>

            {/* Parent 1 */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-slate-700 border-b pb-1 flex items-center justify-between">
                <span>Parent / Tuteur 1</span>
                {(parent1PhoneVerified || parent1EmailVerified) && (
                  <div className="flex items-center gap-2">
                    {parent1PhoneVerified && (
                      <span className="badge badge-success badge-xs">Tél. vérifié</span>
                    )}
                    {parent1EmailVerified && (
                      <span className="badge badge-success badge-xs">Email vérifié</span>
                    )}
                  </div>
                )}
              </h4>
              <div className="space-y-1 text-sm">
                <div><span className="text-slate-600">Nom:</span> <span className="font-medium">{dossier.formState?.parent1FirstName} {dossier.formState?.parent1LastName}</span></div>
                <div><span className="text-slate-600">Email:</span> <span className="font-medium">{dossier.formState?.parent1Email}</span></div>
                <div><span className="text-slate-600">Tél:</span> <span className="font-medium">{dossier.formState?.parent1Phone || '-'}</span></div>
              </div>
            </div>

            {/* Parent 2 */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-slate-700 border-b pb-1 flex items-center justify-between">
                <span>Parent / Tuteur 2</span>
                {dossier.vm?.guardians?.PARENT_2?.phoneVerifiedAt && (
                  <span className="badge badge-success badge-xs">Tél. vérifié</span>
                )}
              </h4>
              <div className="space-y-1 text-sm">
                <div><span className="text-slate-600">Nom:</span> <span className="font-medium">{dossier.formState?.parent2FirstName} {dossier.formState?.parent2LastName}</span></div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Email:</span>
                  <span className="font-medium">{dossier.formState?.parent2Email}</span>
                  {dossier.vm?.guardians?.PARENT_2?.emailVerifiedAt && (
                    <span className="badge badge-success badge-xs">Vérifié</span>
                  )}
                </div>
                <div><span className="text-slate-600">Tél:</span> <span className="font-medium">{dossier.formState?.parent2Phone || '-'}</span></div>
              </div>
            </div>
          </div>
        )}

        <div className="border-t pt-6 space-y-4">
          {dossier.isEditing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-blue-900">Parcours de prise en charge</h3>
              <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
                <li>Un rendez-vous de pré-consultation est <strong>obligatoire</strong> avant toute intervention</li>
                <li>
                  Après la pré-consultation, un délai de réflexion de <strong>15 jours minimum</strong> est requis
                  avant de pouvoir signer les documents
                </li>
                <li>
                  Pour signer à distance, chaque parent doit renseigner son email et son numéro de téléphone
                </li>
                <li>
                  Les <strong>2 parents</strong> doivent signer tous les documents (autorisation chirurgicale,
                  consentement éclairé, devis)
                </li>
              </ul>
              {signatureMissingSummary.length > 0 && (
                <p className="text-sm text-blue-900">
                  Points à compléter pour signer à distance ({signatureMissingSummary.join(' ; ')}).
                </p>
              )}
              <div className="flex items-start gap-2 mt-3">
                <input
                  type="checkbox"
                  id="procedure-info-ack"
                  checked={dossier.formState?.procedure_info_acknowledged || false}
                  onChange={(e) => dossier.updateForm('procedure_info_acknowledged', e.target.checked)}
                  disabled={!canAcknowledge}
                  className="checkbox checkbox-primary mt-0.5"
                />
                <label htmlFor="procedure-info-ack" className="text-sm text-blue-900 cursor-pointer">
                  J'ai pris connaissance du parcours de prise en charge et j'accepte ces conditions
                </label>
              </div>
              {missingRequiredFields.length > 0 && (
                <BlockingNotice
                  title="Dossier incomplet"
                  message="Pour cocher la case et enregistrer, compl?tez :"
                  items={missingRequiredFields}
                />
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            {!dossier.isEditing && (
              <Button type="button" onClick={dossier.enableEdit} variant="secondary">
                Compléter / Modifier
              </Button>
            )}
            {dossier.isEditing && (
              <Button
                type="button"
                disabled={!canSave}
                onClick={dossier.save}
              >
                {dossier.saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export function PatientTabDossier({ token, currentUser }) {
  const dossier = useDossier({ token });
  return <PatientTabDossierView dossier={dossier} currentUser={currentUser} />;
}
