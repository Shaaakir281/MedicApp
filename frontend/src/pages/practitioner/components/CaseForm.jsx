import React from 'react';

export const CaseForm = ({ caseForm, onChange }) => {
  return (
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
      <label className="form-control">
        <span className="label-text">Parent 1</span>
        <input
          type="text"
          name="parent1_name"
          className="input input-bordered"
          value={caseForm.parent1_name}
          onChange={onChange}
        />
      </label>
      <label className="form-control">
        <span className="label-text">Email parent 1</span>
        <input
          type="email"
          name="parent1_email"
          className="input input-bordered"
          value={caseForm.parent1_email}
          onChange={onChange}
        />
      </label>
      <label className="form-control">
        <span className="label-text">Parent 2</span>
        <input
          type="text"
          name="parent2_name"
          className="input input-bordered"
          value={caseForm.parent2_name}
          onChange={onChange}
        />
      </label>
      <label className="form-control">
        <span className="label-text">Email parent 2</span>
        <input
          type="email"
          name="parent2_email"
          className="input input-bordered"
          value={caseForm.parent2_email}
          onChange={onChange}
        />
      </label>
      <label className="form-control md:col-span-2">
        <span className="label-text">Notes</span>
        <textarea
          name="notes"
          className="textarea textarea-bordered"
          rows={3}
          value={caseForm.notes}
          onChange={onChange}
        />
      </label>
    </div>
  );
};
