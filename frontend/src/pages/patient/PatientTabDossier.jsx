import React, { useEffect, useState } from 'react';

import { InfoBanner } from '../../components/patient/dossier/InfoBanner.jsx';
import { ChildIdentityForm } from '../../components/patient/dossier/ChildIdentityForm.jsx';
import { GuardianForm } from '../../components/patient/dossier/GuardianForm.jsx';
import { SmsVerificationPanel } from '../../components/patient/dossier/SmsVerificationPanel.jsx';
import { Button, Card, SectionHeading } from '../../components/ui';
import { useDossier } from '../../hooks/useDossier.js';
import { vmToForm } from '../../services/dossier.mapper.js';

export function PatientTabDossier({ token }) {
  const dossier = useDossier({ token });
  const [sendingRole, setSendingRole] = useState(null);
  const [verifyingRole, setVerifyingRole] = useState(null);

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
            />
            <GuardianForm
              title="Parent / Tuteur 2"
              prefix="parent2"
              formState={dossier.formState || {}}
              onChange={dossier.updateForm}
              required
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={dossier.saving || dossier.loading || !dossier.formState}
            onClick={dossier.save}
          >
            {dossier.saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </Card>

      <SmsVerificationPanel
        vm={dossier.vm}
        onSend={handleSendOtp}
        onVerify={handleVerifyOtp}
        sendingRole={sendingRole}
        verifyingRole={verifyingRole}
      />
    </div>
  );
}
