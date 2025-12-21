import React from 'react';
import { useFormContext } from 'react-hook-form';

import { Button, Card, SectionHeading } from '../../../components/ui';
import { ChildIdentityForm } from '../../../components/patient/sections/ChildIdentityForm.jsx';
import { GuardiansForm } from '../../../components/patient/sections/GuardiansForm.jsx';
import { LABELS_FR } from '../../../constants/labels.fr.js';

export function ProcedureForm({ childAgeDisplay, loading, onSubmit }) {
  const { handleSubmit } = useFormContext();

  return (
    <section className="space-y-6">
      <Card className="space-y-6">
        <SectionHeading
          title={LABELS_FR.patientSpace.tabs.file}
          subtitle="Renseignez les informations pour générer le consentement et planifier les rendez-vous."
        />

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChildIdentityForm childAgeDisplay={childAgeDisplay} />
            <GuardiansForm />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Enregistrement…' : LABELS_FR.patientSpace.dossier.saveCase}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}

