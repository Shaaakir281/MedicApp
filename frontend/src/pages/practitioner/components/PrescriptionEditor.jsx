import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal.jsx';
import { Button } from '../../../components/ui';

export function PrescriptionEditor({
  isOpen,
  onClose,
  defaultItems,
  defaultInstructions,
  catalog = [],
  loading,
  onSubmit,
}) {
  const [itemsText, setItemsText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      setItemsText((defaultItems || []).join('\n'));
      setInstructions(defaultInstructions || '');
      setSelected(new Set(defaultItems || []));
    }
  }, [isOpen, defaultItems, defaultInstructions]);

  const toggleItem = (value) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      setItemsText(Array.from(next).join('\n'));
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const items = itemsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    onSubmit({ items, instructions });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3 className="text-xl font-semibold mb-4">Modifier l&apos;ordonnance</h3>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {!!catalog.length && (
          <div>
            <span className="label-text font-medium text-slate-600 mb-2 block">
              Lignes courantes
            </span>
            <div className="grid md:grid-cols-2 gap-2">
              {catalog.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selected.has(item)}
                    onChange={() => toggleItem(item)}
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
        )}
        <label className="form-control w-full">
          <span className="label-text font-medium text-slate-600">Lignes de prescription</span>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={6}
            value={itemsText}
            onChange={(event) => setItemsText(event.target.value)}
            required
          />
          <span className="label-text-alt text-xs text-slate-500">
            Une ligne par produit/instruction (ex : Bactigras 10x10 cm x 5)
          </span>
        </label>
        <label className="form-control w-full">
          <span className="label-text font-medium text-slate-600">Instructions</span>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={4}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Mettre à jour'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
