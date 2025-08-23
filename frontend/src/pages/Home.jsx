import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Home page offering a choice between the patient and practitioner journeys.
 */
const Home = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 mt-8">
      <h1 className="text-3xl font-bold">Bienvenue sur MedScript</h1>
      <p className="text-center">Choisissez votre parcours&nbsp;:</p>
      <div className="flex space-x-4">
        <Link to="/patient" className="btn btn-primary">
          Je suis patient
        </Link>
        <Link to="/praticien" className="btn btn-secondary">
          Je suis praticien
        </Link>
      </div>
      <div className="mt-4 text-sm text-slate-500 italic">
        Démo cliquable – aucune donnée réelle
      </div>
    </div>
  );
};

export default Home;