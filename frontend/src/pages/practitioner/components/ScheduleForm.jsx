import React from 'react';

const HOURLY_SLOTS = Array.from({ length: 10 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);

export const ScheduleForm = ({
  scheduleForm,
  onChange,
  onSelectSlot,
  availableSlots,
  slotsLoading,
  slotsError,
  canUseSlot,
  normalizedSelectedSlot,
  onCancel,
  onSubmit,
  editedAppointmentId,
  procedure,
  updatingAppointment,
  creatingAppointment,
}) => {
  return (
    <form className="space-y-3 border rounded-2xl p-4 bg-slate-50" onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="form-control">
          <span className="label-text">Type</span>
          <select
            name="appointment_type"
            className="select select-bordered"
            value={scheduleForm.appointment_type}
            onChange={onChange}
          >
            <option value="preconsultation">Pré-consultation</option>
            <option value="act">Acte</option>
            <option value="general">General</option>
          </select>
        </label>
        <label className="form-control">
          <span className="label-text">Date</span>
          <input
            type="date"
            name="date"
            className="input input-bordered"
            value={scheduleForm.date}
            onChange={onChange}
          />
        </label>
        <label className="form-control">
          <span className="label-text">Heure</span>
          <input
            type="time"
            name="time"
            className="input input-bordered"
            value={scheduleForm.time}
            onChange={onChange}
          />
        </label>
        <label className="form-control">
          <span className="label-text">Mode</span>
          <select
            name="mode"
            className="select select-bordered"
            value={scheduleForm.mode}
            onChange={onChange}
            disabled={scheduleForm.appointment_type === 'act'}
          >
            <option value="">Non precise</option>
            <option value="presentiel">Presentiel</option>
            <option value="visio">Visio</option>
          </select>
          {scheduleForm.appointment_type === 'act' && (
            <span className="text-xs text-slate-500 mt-1">Un acte se deroule toujours en presentiel.</span>
          )}
        </label>
        <label className="form-control">
          <span className="label-text">Statut</span>
          <select
            name="status"
            className="select select-bordered"
            value={scheduleForm.status}
            onChange={onChange}
          >
            <option value="pending">En attente</option>
            <option value="validated">Confirme</option>
          </select>
        </label>
      </div>
      <div className="space-y-2">
        <span className="label-text font-medium">Creneaux disponibles</span>
        {slotsLoading ? (
          <p className="text-sm text-slate-500">Chargement des creneaux...</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {HOURLY_SLOTS.map((slot) => {
              const isSelected = normalizedSelectedSlot === slot;
              const disabled = !canUseSlot(slot);
              return (
                <button
                  key={slot}
                  type="button"
                  className={`px-4 py-2 rounded-md border text-sm ${
                    isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 hover:bg-blue-50'
                  } ${disabled && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={disabled && !isSelected}
                  onClick={() => onSelectSlot(slot)}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        )}
        {slotsError && <p className="text-xs text-red-600">{slotsError}</p>}
        {!slotsLoading && !slotsError && !availableSlots.length && (
          <p className="text-xs text-slate-500">Aucun creneau libre pour cette date. Veuillez selectionner un autre jour.</p>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Annuler
        </button>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={
            (!editedAppointmentId && !procedure?.case_id) ||
            (editedAppointmentId ? updatingAppointment : creatingAppointment)
          }
        >
          {editedAppointmentId
            ? updatingAppointment
              ? 'Replanification...'
              : 'Appliquer'
            : creatingAppointment
            ? 'Planification...'
            : 'Planifier'}
        </button>
      </div>
    </form>
  );
};
