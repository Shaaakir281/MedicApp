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

  const normalizeKey = (value) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const normalizeLines = (value) =>
    value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

  const syncSelectedFromText = (value) => new Set(normalizeLines(value).map(normalizeKey));

  useEffect(() => {
    if (isOpen) {
      const initial = (defaultItems || []).join('\n');
      setItemsText(initial);
      setInstructions(defaultInstructions || '');
      setSelected(syncSelectedFromText(initial));
    }
  }, [isOpen, defaultItems, defaultInstructions]);

  const toggleItem = (value) => {
    const key = normalizeKey(value);
    const currentLines = normalizeLines(itemsText);
    const currentKeys = currentLines.map(normalizeKey);
    const idx = currentKeys.indexOf(key);
    let nextLines;
    if (idx >= 0) {
      nextLines = [...currentLines.slice(0, idx), ...currentLines.slice(idx + 1)];
    } else {
      nextLines = [value, ...currentLines];
    }
    setItemsText(nextLines.join('\n'));
    setSelected(syncSelectedFromText(nextLines.join('\n')));
  };

  const handleItemsChange = (event) => {
    const value = event.target.value;
    setItemsText(value);
    setSelected(syncSelectedFromText(value));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const items = normalizeLines(itemsText);
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
                    checked={selected.has(normalizeKey(item))}
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
            onChange={handleItemsChange}
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
