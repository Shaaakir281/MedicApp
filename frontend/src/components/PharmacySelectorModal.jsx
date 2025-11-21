import React, { useEffect, useState } from 'react';
import Modal from './Modal.jsx';

function PharmacySelectorModal({ isOpen, onClose, onSelect }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!email || !email.includes('@')) {
      setError('Merci de saisir un email de pharmacie valide.');
      return;
    }
    const entry = {
      id: `manual-${email}`,
      name: 'Pharmacie (email renseigné)',
      ms_sante_address: email,
      source: 'manual',
    };
    onSelect?.(entry);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-5">
        <header className="space-y-1">
          <h3 className="text-xl font-semibold text-slate-800">Email de la pharmacie</h3>
          <p className="text-sm text-slate-600">
            Entrez l&apos;adresse email de votre pharmacie. Nous préparerons l&apos;envoi du lien sécurisé.
          </p>
        </header>

        <label className="form-control">
          <span className="label-text text-sm text-slate-600">Email</span>
          <input
            type="email"
            className="input input-bordered"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="pharmacie@exemple.fr"
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={!email}>
            Enregistrer cet email
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default PharmacySelectorModal;
