import React from 'react';
import { useFormContext } from 'react-hook-form';

import { InputField } from '../../ui';
import { LABELS_FR } from '../../../constants/labels.fr.js';

export function GuardiansForm() {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg">{LABELS_FR.patientSpace.dossier.guardiansTitle}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <InputField
            label={LABELS_FR.patientSpace.dossier.parentName(LABELS_FR.patientSpace.guardians.parent1)}
            placeholder="Nom Prénom"
            {...register('parent1_name')}
            error={errors.parent1_name?.message}
            required
          />
          <InputField
            label={LABELS_FR.patientSpace.dossier.parentEmail(LABELS_FR.patientSpace.guardians.parent1)}
            type="email"
            placeholder="parent1@email.com"
            {...register('parent1_email')}
            error={errors.parent1_email?.message}
            required
          />
          <InputField
            label={LABELS_FR.patientSpace.dossier.parentPhone(LABELS_FR.patientSpace.guardians.parent1)}
            type="tel"
            placeholder="+33600000000"
            {...register('parent1_phone')}
            error={errors.parent1_phone?.message}
            required
          />
          <label className="flex items-center gap-3">
            <input type="checkbox" className="toggle toggle-primary" {...register('parent1_sms_optin')} />
            <span className="text-sm text-slate-700">
              {LABELS_FR.patientSpace.dossier.smsOptin(LABELS_FR.patientSpace.guardians.parent1)}
            </span>
          </label>
        </div>

        <div className="space-y-3">
          <InputField
            label={LABELS_FR.patientSpace.dossier.parentName(LABELS_FR.patientSpace.guardians.parent2)}
            placeholder="Nom Prénom"
            {...register('parent2_name')}
            error={errors.parent2_name?.message}
          />
          <InputField
            label={LABELS_FR.patientSpace.dossier.parentEmail(LABELS_FR.patientSpace.guardians.parent2)}
            type="email"
            placeholder="parent2@email.com"
            {...register('parent2_email')}
            error={errors.parent2_email?.message}
          />
          <InputField
            label={LABELS_FR.patientSpace.dossier.parentPhone(LABELS_FR.patientSpace.guardians.parent2)}
            type="tel"
            placeholder="+33610000000"
            {...register('parent2_phone')}
            error={errors.parent2_phone?.message}
          />
          <label className="flex items-center gap-3">
            <input type="checkbox" className="toggle toggle-primary" {...register('parent2_sms_optin')} />
            <span className="text-sm text-slate-700">
              {LABELS_FR.patientSpace.dossier.smsOptin(LABELS_FR.patientSpace.guardians.parent2)}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

