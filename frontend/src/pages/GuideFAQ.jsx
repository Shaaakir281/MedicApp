import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import faqDataRaw from '../data/faqData.json';
import { BackToPatient } from '../components/BackToPatient.jsx';

const CATEGORY_LABELS = {
  "INSCRIPTION ET COMPTE": 'Inscription et compte',
  "DOSSIER DE L'ENFANT": "Dossier de l'enfant",
  "ENTRETIEN D'INFORMATION": "Entretien d'information",
  "DÉLAI DE RÉFLEXION": 'Délai de réflexion',
  "RENDEZ-VOUS POUR L'ACTE": "Rendez-vous pour l'acte",
  "SIGNATURE DES DOCUMENTS": 'Signature des documents',
  "LE JOUR DE L'INTERVENTION": "Le jour de l'intervention",
  "APRÈS L'INTERVENTION": "Après l'intervention",
  "TARIFS ET PAIEMENT": 'Tarifs et paiement',
  "AUTRES QUESTIONS": 'Autres questions',
};

const TOPIC_TARGETS = {
  rdv: {
    category_raw: "DOSSIER DE L'ENFANT",
    match: 'Compléter le dossier pour prendre rendez-vous',
  },
  'rdv-info': {
    category_raw: "ENTRETIEN D'INFORMATION",
    match: "Comment prendre rendez-vous pour l’entretien d’information",
  },
  'rdv-acte': {
    category_raw: "RENDEZ-VOUS POUR L'ACTE",
    match: "Comment prendre rendez-vous pour l'intervention",
  },
  signature: {
    category_raw: 'SIGNATURE DES DOCUMENTS',
    match: 'Comment signer les documents',
  },
  'signature-distance': {
    category_raw: 'SIGNATURE DES DOCUMENTS',
    match: 'Comment signer les documents',
  },
  'signature-delay': {
    category_raw: "ENTRETIEN D'INFORMATION",
    match: 'délai de 15 jours',
  },
  dossier: {
    category_raw: "DOSSIER DE L'ENFANT",
    match: 'Compléter le dossier pour prendre rendez-vous',
  },
};

const normalize = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const buildQuestionId = (category, question) => `${slugify(category)}-${slugify(question)}`;

const parseAnswer = (answer, bullets) => {
  if (bullets && bullets.length > 0) {
    return { text: answer, bullets };
  }
  if (!answer) {
    return { text: '', bullets: [] };
  }
  if (answer.includes('•')) {
    const parts = answer.split('•').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) {
      return { text: '', bullets: [] };
    }
    if (parts.length === 1) {
      return { text: parts[0], bullets: [] };
    }
    if (answer.trim().startsWith('•')) {
      return { text: '', bullets: parts };
    }
    return { text: parts[0], bullets: parts.slice(1) };
  }
  return { text: answer, bullets: [] };
};

const resolveTopicTarget = (topic, faqData) => {
  if (!topic) return null;
  const target = TOPIC_TARGETS[topic];
  if (!target) return null;
  const category = faqData.find((item) => item.category_raw === target.category_raw);
  if (!category || !category.questions.length) return null;
  let question = null;
  if (target.match) {
    const match = normalize(target.match);
    question = category.questions.find((item) => normalize(item.question).includes(match));
  }
  if (!question) {
    const index = typeof target.index === 'number' ? target.index : 0;
    question = category.questions[index] || category.questions[0];
  }
  return {
    categoryRaw: category.category_raw,
    questionId: buildQuestionId(category.category_raw, question.question),
  };
};

const GuideFAQ = () => {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || '';
  const supportPhone = import.meta.env.VITE_HOSPITAL_PHONE || '';

  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [openQuestions, setOpenQuestions] = useState(() => new Set());

  const faqData = useMemo(
    () =>
      faqDataRaw.map((category) => ({
        ...category,
        label: CATEGORY_LABELS[category.category_raw] || category.category || category.category_raw,
      })),
    [],
  );

  const filteredFaq = useMemo(() => {
    const term = normalize(searchTerm.trim());

    return faqData
      .filter((category) => (!activeCategory ? true : category.category_raw === activeCategory))
      .map((category) => {
        const questions = category.questions.filter((question) => {
          if (!term) return true;
          const searchable = [
            question.question,
            question.answer,
            ...(question.bullets || []),
            ...(question.steps || []),
            ...(question.screenshots || []),
          ]
            .join(' ')
            .toLowerCase();
          return searchable.includes(term);
        });

        return { ...category, questions };
      })
      .filter((category) => category.questions.length > 0);
  }, [activeCategory, faqData, searchTerm]);

  const allQuestionIds = useMemo(() => {
    const ids = [];
    filteredFaq.forEach((category) => {
      category.questions.forEach((question) => {
        ids.push(buildQuestionId(category.category_raw, question.question));
      });
    });
    return ids;
  }, [filteredFaq]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const topic = params.get('topic');
    if (topic) {
      const target = resolveTopicTarget(topic, faqData);
      if (target) {
        setActiveCategory(target.categoryRaw);
        setOpenQuestions((prev) => {
          const next = new Set(prev);
          next.add(target.questionId);
          return next;
        });
        setTimeout(() => {
          document.getElementById(target.questionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
        return;
      }
    }
    if (!location.hash) return;
    const target = decodeURIComponent(location.hash.replace('#', ''));
    setOpenQuestions((prev) => {
      const next = new Set(prev);
      next.add(target);
      return next;
    });
    setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [faqData, location.hash, location.search]);

  const handleToggleQuestion = (questionId) => {
    setOpenQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setOpenQuestions(new Set(allQuestionIds));
  };

  const handleCollapseAll = () => {
    setOpenQuestions(new Set());
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <BackToPatient />
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-800">Guide & FAQ</h1>
        <p className="text-slate-600 mt-2">
          Retrouvez toutes les réponses pour votre parcours patient. Utilisez la recherche ou les catégories pour aller
          plus vite.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <aside className="space-y-4 lg:sticky lg:top-6 h-fit">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <label className="text-sm font-semibold text-slate-700" htmlFor="faq-search">
              Rechercher
            </label>
            <input
              id="faq-search"
              type="search"
              className="input input-bordered w-full mt-2"
              placeholder="Mots-clés, symptômes, rendez-vous..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Catégories</p>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setActiveCategory('')}>
                Tout
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {faqData.map((category) => (
                <button
                  key={category.category_raw}
                  type="button"
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm flex items-center justify-between gap-2 transition-colors ${
                    activeCategory === category.category_raw
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={() => setActiveCategory(category.category_raw)}
                >
                  <span>{category.label}</span>
                  <span className="text-xs text-slate-400">{category.questions.length}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-700 mb-3">Actions rapides</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline btn-xs" onClick={handleExpandAll}>
                Tout déplier
              </button>
              <button type="button" className="btn btn-outline btn-xs" onClick={handleCollapseAll}>
                Tout replier
              </button>
              <button type="button" className="btn btn-outline btn-xs" onClick={() => window.print()}>
                Version imprimable
              </button>
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          {filteredFaq.length === 0 && (
            <div className="text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6">
              Aucun résultat. Essayez un autre mot-clé.
            </div>
          )}

          {filteredFaq.map((category) => (
            <div key={category.category_raw} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-700">{category.label}</h2>
                <span className="text-xs text-slate-400">{category.questions.length} question(s)</span>
              </div>

              <div className="space-y-3">
                {category.questions.map((question) => {
                  const questionId = buildQuestionId(category.category_raw, question.question);
                  const isOpen = openQuestions.has(questionId);
                  const { text, bullets } = parseAnswer(question.answer, question.bullets);

                  return (
                    <div
                      key={questionId}
                      id={questionId}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white"
                    >
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 flex items-center justify-between gap-4"
                        onClick={() => handleToggleQuestion(questionId)}
                      >
                        <span className="font-medium text-slate-800">{question.question}</span>
                        <span className="text-slate-400">{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 text-slate-600 text-sm space-y-3">
                          {text && <p>{text}</p>}
                          {bullets.length > 0 && (
                            <ul className="list-disc list-inside space-y-1">
                              {bullets.map((bullet) => (
                                <li key={bullet}>{bullet}</li>
                              ))}
                            </ul>
                          )}
                          {question.steps && (
                            <ul className="list-disc list-inside space-y-1">
                              {question.steps.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ul>
                          )}
                          {question.screenshots && (
                            <div className="grid sm:grid-cols-2 gap-3">
                              {question.screenshots.map((src) => (
                                <img
                                  key={src}
                                  src={src}
                                  alt="Capture d'écran"
                                  className="rounded-lg border border-slate-200"
                                  loading="lazy"
                                />
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-2">
                            <button
                              type="button"
                              className="text-xs text-blue-600 hover:text-blue-700"
                              onClick={() =>
                                navigator.clipboard.writeText(`${window.location.origin}/guide#${questionId}`)
                              }
                            >
                              Copier le lien
                            </button>
                            <span className="text-xs text-slate-400">| Cette réponse vous a-t-elle aidé ?</span>
                            <button type="button" className="btn btn-xs btn-outline">
                              Oui
                            </button>
                            <button type="button" className="btn btn-xs btn-outline">
                              Non
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/video-rassurance" className="btn btn-outline btn-sm">
          Voir la vidéo de préparation
        </Link>
        <Link to="/patient" className="btn btn-primary btn-sm">
          Retour à mon espace patient
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Vous avez d'autres questions ?</p>
        <p className="mt-1">Contactez directement le cabinet.</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {supportEmail ? (
            <a className="text-blue-600 hover:text-blue-700" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          ) : (
            <span className="text-slate-400">Email du cabinet à renseigner</span>
          )}
          {supportPhone ? (
            <a className="text-blue-600 hover:text-blue-700" href={`tel:${supportPhone.replace(/\s/g, '')}`}>
              {supportPhone}
            </a>
          ) : (
            <span className="text-slate-400">Téléphone du cabinet à renseigner</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuideFAQ;
