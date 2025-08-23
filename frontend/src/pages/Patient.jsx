import React, { useState, useEffect } from 'react';
import Calendar from '../components/Calendar.jsx';
import TimeSlots from '../components/TimeSlots.jsx';
import Toast from '../components/Toast.jsx';
import { loadDraft, saveDraft, addReservedSlot, loadReserved } from '../lib/storage.js';
import { getPracticienSeed } from '../lib/fixtures.js';

/**
 * Patient journey page.
 *
 * This component orchestrates three steps:
 *  1. Calendar and time slot selection.
 *  2. Appointment form with questionnaire.
 *  3. Confirmation showing the summary of the reservation.
 *
 * Data is persisted in sessionStorage; no backend calls are made.
 */
const Patient = () => {
  // Local state for month navigation and date/slot selection
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Form data with questionnaire (five booleans)
  const [formData, setFormData] = useState({
    nom: '',
    tel: '',
    email: '',
    questions: [false, false, false, false, false],
  });

  // Toast visibility for confirmation message
  const [toastVisible, setToastVisible] = useState(false);

  // Load any previously saved draft on component mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setSelectedDate(draft.date ? new Date(draft.date) : null);
      setSelectedSlot(draft.time || null);
      setFormData({
        nom: draft.nom || '',
        tel: draft.tel || '',
        email: draft.email || '',
        questions: draft.q ? Object.values(draft.q) : [false, false, false, false, false],
      });
    }
  }, []);

  // Retrieve fixtures for pre‑reserved slots
  const { appointmentsSeed } = getPracticienSeed();

  // Handlers for calendar navigation
  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Handler when a day is selected
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null); // Reset selected slot when date changes
  };

  // Handler for selecting a time slot
  const handleSlotSelect = (time) => {
    setSelectedSlot((prev) => (prev === time ? null : time));
  };

  // Handlers for form inputs
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  const toggleQuestion = (index) => {
    setFormData((prev) => {
      const updated = [...prev.questions];
      updated[index] = !updated[index];
      return { ...prev, questions: updated };
    });
  };

  // Handler for saving the appointment (step C)
  const handleSave = (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot) {
      // Nothing to save if no slot chosen
      return;
    }
    // Build the draft object for storage
    const draft = {
      date: selectedDate.toISOString().split('T')[0],
      time: selectedSlot,
      nom: formData.nom,
      tel: formData.tel,
      email: formData.email,
      q: formData.questions.reduce((acc, val, idx) => {
        acc[`q${idx + 1}`] = val;
        return acc;
      }, {}),
    };
    // Persist to sessionStorage
    saveDraft(draft);
    addReservedSlot({ date: draft.date, time: draft.time });
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Step A – Calendar and time slots */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Choisissez une date et un horaire</h2>
        <Calendar
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onSelectDate={handleDateSelect}
        />
        {selectedDate && (
          <TimeSlots
            date={selectedDate}
            appointmentsSeed={appointmentsSeed}
            reservedSession={loadReserved()}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSlotSelect}
          />
        )}
      </section>
      {/* Step B – Form and questionnaire */}
      {selectedDate && selectedSlot && (
        <section className="space-y-4">
          <h3 className="text-xl font-bold">Vos informations</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="nom" className="block mb-1">
                Nom&nbsp;:
              </label>
              <input
                id="nom"
                name="nom"
                type="text"
                value={formData.nom}
                onChange={handleInputChange}
                className="input input-bordered w-full"
                required
              />
            </div>
            <div>
              <label htmlFor="tel" className="block mb-1">
                Téléphone&nbsp;:
              </label>
              <input
                id="tel"
                name="tel"
                type="tel"
                value={formData.tel}
                onChange={handleInputChange}
                className="input input-bordered w-full"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block mb-1">
                Email&nbsp;:
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                className="input input-bordered w-full"
                required
              />
            </div>
            <div>
              <p className="font-medium mb-2">Questionnaire&nbsp;:</p>
              {['Question 1', 'Question 2', 'Question 3', 'Question 4', 'Question 5'].map((label, idx) => (
                <label key={idx} className="flex items-center space-x-2 mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.questions[idx]}
                    onChange={() => toggleQuestion(idx)}
                    className="checkbox"
                  />
                    <span>{label}</span>
                </label>
              ))}
            </div>
            <button type="submit" className="btn btn-primary">
              Enregistrer
            </button>
          </form>
        </section>
      )}
      {/* Step C – Confirmation summary */}
      {toastVisible && (
        <Toast message="Vos réponses ont été sauvegardées" isVisible={toastVisible} />
      )}
    </div>
  );
};

export default Patient;