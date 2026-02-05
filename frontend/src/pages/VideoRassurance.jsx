import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

const buildYouTubeEmbed = (url) => {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (!match) return url;
  return `https://www.youtube.com/embed/${match[1]}`;
};

const VideoRassurance = () => {
  const videoUrl = import.meta.env.VITE_VIDEO_URL || '';
  const isYouTube = /youtube\.com|youtu\.be/.test(videoUrl);
  const embedUrl = useMemo(() => (videoUrl ? buildYouTubeEmbed(videoUrl) : ''), [videoUrl]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-800">Preparer le jour de l'intervention</h1>
        <p className="text-slate-600 mt-2">
          Cette video vous explique les etapes importantes et vous aide a preparer votre enfant sereinement.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        {videoUrl ? (
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-100">
            {isYouTube ? (
              <iframe
                title="Video rassurance"
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video controls className="w-full h-full" src={videoUrl} />
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
            La video sera disponible prochainement. Merci de revenir plus tard.
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-lg font-semibold text-slate-800">Transcription</h2>
          <p className="text-slate-600 mt-2 leading-relaxed">
            Cette section contient la transcription de la video pour faciliter l'accessibilite. Vous pourrez
            la completer avec le texte officiel une fois la video finalisee.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/guide" className="btn btn-outline btn-sm">
          Consulter le guide FAQ
        </Link>
        <Link to="/patient" className="btn btn-primary btn-sm">
          Retour a mon espace patient
        </Link>
      </div>
    </div>
  );
};

export default VideoRassurance;
