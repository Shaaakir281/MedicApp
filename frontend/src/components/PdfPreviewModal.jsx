import React from 'react';
import Modal from './Modal.jsx';

const PdfPreviewModal = ({ isOpen, onClose, title = 'Apercu', url, actions = null }) => (
  <Modal isOpen={isOpen} onClose={onClose}>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Fermer
        </button>
      </div>
      {url ? (
        <div className="h-[70vh] border rounded-xl overflow-hidden bg-white">
          <iframe src={url} title={title} className="w-full h-full" frameBorder="0" />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Aucun document a afficher.</p>
      )}
      {actions && <div className="flex flex-wrap gap-2 justify-end">{actions}</div>}
    </div>
  </Modal>
);

export default PdfPreviewModal;
