import React from 'react';

export const CaseForm = ({ caseForm, onChange }) => {
  return (
    <div className="space-y-6">
      {/* Section Enfant */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Informations Enfant</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text">Nom de l&apos;enfant</span>
            <input
              type="text"
              name="child_full_name"
              className="input input-bordered"
              value={caseForm.child_full_name}
              onChange={onChange}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Date de naissance</span>
            <input
              type="date"
              name="child_birthdate"
              className="input input-bordered"
              value={caseForm.child_birthdate}
              onChange={onChange}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Poids (kg)</span>
            <input
              type="number"
              name="child_weight_kg"
              className="input input-bordered"
              value={caseForm.child_weight_kg}
              onChange={onChange}
              min="0"
              step="0.1"
            />
          </label>
          <label className="form-control">
            <span className="label-text">Autorite parentale confirme</span>
            <input
              type="checkbox"
              name="parental_authority_ack"
              className="toggle toggle-primary"
              checked={caseForm.parental_authority_ack}
              onChange={onChange}
            />
          </label>
        </div>
      </div>

      {/* Section Parent 1 */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Parent 1</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text">Prénom</span>
            <input
              type="text"
              name="parent1_first_name"
              className="input input-bordered"
              value={caseForm.parent1_first_name}
              onChange={onChange}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Nom</span>
            <input
              type="text"
              name="parent1_last_name"
              className="input input-bordered"
              value={caseForm.parent1_last_name}
              onChange={onChange}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Email</span>
            <input
              type="email"
              name="parent1_email"
              className="input input-bordered"
              value={caseForm.parent1_email}
              onChange={onChange}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Telephone</span>
            <input
              type="tel"
              name="parent1_phone"
              className="input input-bordered"
              value={caseForm.parent1_phone}
              onChange={onChange}
              placeholder="+33700000000"
            />
          </label>
        </div>
      </div>

      {/* Section Parent 2 */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Parent 2</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text">Prénom</span>
            <input
              type="text"
              name="parent2_first_name"
              className="input input-bordered"
              value={caseForm.parent2_first_name}
              onChange={onChange}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Nom</span>
            <input
              type="text"
              name="parent2_last_name"
              className="input input-bordered"
              value={caseForm.parent2_last_name}
              onChange={onChange}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Email</span>
            <input
              type="email"
              name="parent2_email"
              className="input input-bordered"
              value={caseForm.parent2_email}
              onChange={onChange}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Telephone</span>
            <input
              type="tel"
              name="parent2_phone"
              className="input input-bordered"
              value={caseForm.parent2_phone}
              onChange={onChange}
              placeholder="+33700000000"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
