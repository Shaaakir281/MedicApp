import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import PdfPreview from '../components/PdfPreview.jsx';
import { getPracticienSeed, getUiMetrics } from '../lib/fixtures.js';

/**
 * Practitioner dashboard inspired by the supplied HTML mockup.
 *
 * This page displays high‑level metrics, a list of patients with different states
 * (urgent, pending, validated), quick actions, recent activity, and allows
 * previewing a dummy PDF representing an ordinance.
 */
const Praticien = () => {
  const { patientsToday } = getPracticienSeed();
  const metrics = getUiMetrics();
  const [pdfVisible, setPdfVisible] = useState(false);

  // Base64 encoded minimal PDF (same as previous version)
  const pdfBase64 =
    'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMTQ0XSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCA+PiA+PgplbmRvYmoKNCAwIG9iago8PCAvTGVuZ3RoIDQ0ID4+CnN0cmVhbQpCVCAvRjEgMTIgVGYgNzIgNzIgVGQgKEhlbGxvLCB3b3JsZCEpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNTYgMDAwMDAgbiAKMDAwMDAwMDExNyAwMDAwMCBuIAowMDAwMDAwMTkyIDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNSAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMjY1CiUlRU9GCg==';

  // Helper to determine CSS classes based on patient state flags
  const getPatientClasses = (patient) => {
    if (patient.urgent) return 'patient-frame urgent';
    if (patient.validated) return 'patient-frame validated';
    return 'patient-frame';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Metrics section */}
      <section className="section-frame p-8">
        <h2 className="section-title flex items-center mb-6">
          <span className="mr-3">📊</span>
          Tableau de bord
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="metric-frame p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold text-blue-700">{metrics.rdvToday}</span>
            </div>
            <div className="text-slate-700 font-medium">Rendez‑vous aujourd’hui</div>
          </div>
          <div className="metric-frame p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold text-amber-700">{metrics.pending}</span>
            </div>
            <div className="text-slate-700 font-medium">Ordonnances en attente</div>
          </div>
          <div className="metric-frame p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold text-red-700">{metrics.urgent}</span>
            </div>
            <div className="text-slate-700 font-medium">Cas urgents</div>
          </div>
          <div className="metric-frame p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold text-green-700">{metrics.validatedMonth}</span>
            </div>
            <div className="text-slate-700 font-medium">Validées ce mois</div>
          </div>
        </div>
      </section>
      {/* Patients list section */}
      <section className="section-frame p-8">
        <h2 className="section-title flex items-center mb-6">
          <span className="mr-3">👥</span>
          Patients du jour
        </h2>
        <div className="space-y-4">
          {patientsToday.map((patient, idx) => (
            <div key={idx} className={`${getPatientClasses(patient)} p-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 flex items-center justify-center rounded-2xl border-2" data-state={patient.state}>
                    {/* Placeholder for icon; you can integrate lucide-react or keep this empty */}
                    <span className="text-xl">👤</span>
                  </div>
                  <div>
                    <div className="font-semibold text-lg text-slate-900 flex items-center">
                      {patient.nom}
                      {patient.urgent && (
                        <span className="ml-3 px-3 py-1 bg-red-500 text-white text-xs rounded-full font-bold">
                          URGENT
                        </span>
                      )}
                    </div>
                    <div className="text-slate-600 font-medium">
                      {patient.heure} • {patient.acte}
                    </div>
                    {patient.note && (
                      <div className={`text-sm mt-2 font-medium ${patient.urgent ? 'text-red-600' : patient.validated ? 'text-green-600' : 'text-slate-500' }`}>
                        {patient.note}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {/* Status indicator could be implemented similarly to the mockup using CSS classes */}
                  <button
                    className={`btn ${patient.validated ? 'btn-success' : 'btn-primary'} px-6`}
                    onClick={() => setPdfVisible(true)}
                  >
                    {patient.validated ? 'Validée' : 'Ordonnance'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* Quick actions & Activity section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="action-frame p-6">
            <h3 className="section-title text-lg mb-4">Actions rapides</h3>
            <div className="space-y-3">
              <button className="w-full btn btn-success">Nouvelle ordonnance</button>
              <button className="w-full btn btn-info">Planifier RDV</button>
              <button className="w-full btn btn-accent">Exporter données</button>
            </div>
          </div>
          <div className="activity-frame p-6">
            <h3 className="section-title text-lg mb-4">Activité récente</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-center space-x-3 p-3 bg-white rounded-xl border-2 border-green-100">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <div className="font-semibold text-slate-800">Ordonnance validée</div>
                  <div className="text-slate-500 text-xs">Sophie Martin • 5 minutes</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-white rounded-xl border-2 border-blue-100">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div>
                  <div className="font-semibold text-slate-800">Nouveau RDV</div>
                  <div className="text-slate-500 text-xs">Antoine Dubois • 12 minutes</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-white rounded-xl border-2 border-amber-100">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <div>
                  <div className="font-semibold text-slate-800">Demande de modification</div>
                  <div className="text-slate-500 text-xs">Marie Leblanc • 1 heure</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Empty placeholder for a possible agenda or other content in the second column */}
        <div className="lg:col-span-2"></div>
      </section>
      {/* Modal for PDF preview */}
      <Modal isOpen={pdfVisible} onClose={() => setPdfVisible(false)}>
        <div className="w-full h-96">
          <PdfPreview base64String={pdfBase64} />
        </div>
      </Modal>
    </div>
  );
};

export default Praticien;