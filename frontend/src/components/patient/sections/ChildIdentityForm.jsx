import React from 'react';
import { useFormContext } from 'react-hook-form';

import { InputField } from '../../ui';
import { LABELS_FR } from '../../../constants/labels.fr.js';

export function ChildIdentityForm({ childAgeDisplay }) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg">{LABELS_FR.patientSpace.dossier.childIdentityTitle}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <InputField
          label={LABELS_FR.patientSpace.dossier.childFirstName}
          placeholder="Prénom"
          {...register('child_first_name')}
          error={errors.child_first_name?.message}
          required
        />
        <InputField
          label={LABELS_FR.patientSpace.dossier.childLastName}
          placeholder="Nom"
          {...register('child_last_name')}
          error={errors.child_last_name?.message}
          required
        />
      </div>
      <InputField
        label={LABELS_FR.patientSpace.dossier.childBirthDate}
        type="date"
        {...register('child_birthdate')}
        error={errors.child_birthdate?.message}
        required
        hint={childAgeDisplay ? `Âge : ${childAgeDisplay}` : undefined}
      />
      <InputField
        label={LABELS_FR.patientSpace.dossier.childWeightKg}
        type="number"
        step="0.1"
        min="0"
        {...register('child_weight_kg')}
        error={errors.child_weight_kg?.message}
        placeholder="Ex. 8.2"
      />
      <label className="form-control w-full">
        <span className="label-text font-medium text-slate-600">
          {LABELS_FR.patientSpace.dossier.childMedicalNotes}
        </span>
        <textarea
          className="textarea textarea-bordered w-full"
          rows={4}
          placeholder="Allergies, traitements en cours..."
          {...register('notes')}
        />
        {errors.notes && <span className="label-text-alt text-red-500">{errors.notes.message}</span>}
      </label>
      <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 bg-slate-50">
        <input type="checkbox" className="checkbox mt-1" {...register('parental_authority_ack')} />
        <span className="text-sm text-slate-700">{LABELS_FR.patientSpace.dossier.parentalAuthorityAck}</span>
      </label>
      {errors.parental_authority_ack && (
        <p className="text-sm text-red-500">{errors.parental_authority_ack.message}</p>
      )}
    </div>
  );
}

