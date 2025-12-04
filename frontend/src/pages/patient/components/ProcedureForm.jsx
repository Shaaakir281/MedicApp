import React from 'react';
import { useFormContext } from 'react-hook-form';

import { Button, Card, InputField, SectionHeading } from '../../../components/ui';

export function ProcedureForm({
  childAgeDisplay,
  loading,
  onSubmit,
  showConsentDownload,
  showConsentPending,
  consentLink,
  sendingConsentEmail,
  onSendConsent,
  canSendConsent,
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useFormContext();

  return (
    <section className="space-y-6">
      <Card className="space-y-6">
        <SectionHeading
          title="Dossier patient"
          subtitle="Renseignez les informations pour generer le consentement et planifier les rendez-vous."
        />

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Informations sur l&apos;enfant</h3>
            <InputField
              label="Nom complet"
              placeholder="Prenom NOM"
              {...register('child_full_name')}
              error={errors.child_full_name?.message}
              required
            />
            <InputField
              label="Date de naissance"
              type="date"
              {...register('child_birthdate')}
              error={errors.child_birthdate?.message}
              required
              hint={childAgeDisplay ? `Âge : ${childAgeDisplay}` : undefined}
            />
            <InputField
              label="Poids (kg)"
              type="number"
              step="0.1"
              min="0"
              {...register('child_weight_kg')}
              error={errors.child_weight_kg?.message}
              placeholder="Ex. 8.2"
            />
            <label className="form-control w-full">
              <span className="label-text font-medium text-slate-600">Notes medicales</span>
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
              <span className="text-sm text-slate-700">
                Je comprends que le consentement des deux titulaires de l&apos;autorite parentale est obligatoire.
              </span>
            </label>
            {errors.parental_authority_ack && (
              <p className="text-sm text-red-500">{errors.parental_authority_ack.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Parents / responsables legaux</h3>
            <InputField
              label="Parent / tuteur 1"
              placeholder="Nom Prenom"
              {...register('parent1_name')}
              error={errors.parent1_name?.message}
              required
            />
            <InputField
              label="Email parent 1"
              type="email"
              placeholder="parent1@email.com"
              {...register('parent1_email')}
              error={errors.parent1_email?.message}
              required
            />
            <InputField
              label="Telephone parent 1"
              type="tel"
              placeholder="+33600000000"
              {...register('parent1_phone')}
              error={errors.parent1_phone?.message}
              required
            />
            <label className="flex items-center gap-3">
              <input type="checkbox" className="toggle toggle-primary" {...register('parent1_sms_optin')} defaultChecked />
              <span className="text-sm text-slate-700">Recevoir les codes SMS sur le numero du parent 1</span>
            </label>
            <InputField
              label="Parent / tuteur 2 (optionnel)"
              placeholder="Nom Prénom"
              {...register('parent2_name')}
              error={errors.parent2_name?.message}
            />
            <InputField
              label="Email parent 2 (optionnel)"
              type="email"
              placeholder="parent2@email.com"
              {...register('parent2_email')}
              error={errors.parent2_email?.message}
            />
            <InputField
              label="Telephone parent 2 (optionnel)"
              type="tel"
              placeholder="+33610000000"
              {...register('parent2_phone')}
              error={errors.parent2_phone?.message}
            />
            <label className="flex items-center gap-3">
              <input type="checkbox" className="toggle toggle-primary" {...register('parent2_sms_optin')} />
              <span className="text-sm text-slate-700">Recevoir les codes SMS sur le numero du parent 2</span>
            </label>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer le dossier'}
            </Button>
          </div>
        </form>
      </Card>

      {showConsentDownload && (
        <Card className="space-y-3">
          <h3 className="font-semibold">Consentement pre-rempli</h3>
          <p className="text-sm text-slate-600">
            Telechargez le document, faites-le signer par les deux parents, puis apportez-le le jour de l&apos;intervention.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a className="btn btn-outline btn-sm" href={consentLink}>
              Telecharger le consentement
            </a>
            <button
              type="button"
              className="btn btn-sm"
              onClick={onSendConsent}
              disabled={sendingConsentEmail || !canSendConsent}
            >
              {sendingConsentEmail ? 'Envoi en cours...' : 'Envoyer le lien par e-mail'}
            </button>
          </div>
        </Card>
      )}

      {showConsentPending && (
        <Card className="space-y-2">
          <h3 className="font-semibold">Consentement en preparation</h3>
          <p className="text-sm text-slate-600">
            Le document de consentement est en cours de generation. Vous recevrez un lien par e-mail des qu&apos;il sera pret.
          </p>
        </Card>
      )}
    </section>
  );
}
