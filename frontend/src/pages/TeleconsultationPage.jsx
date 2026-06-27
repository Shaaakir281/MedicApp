import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';

import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchPatientTeleconsultationToken,
  fetchPractitionerTeleconsultationToken,
} from '../lib/api.js';

const sessionRequestCache = new Map();

function loadTeleconsultationSession(requestKey, loader) {
  if (!sessionRequestCache.has(requestKey)) {
    sessionRequestCache.set(
      requestKey,
      loader().catch((error) => {
        sessionRequestCache.delete(requestKey);
        throw error;
      }),
    );
  }
  return sessionRequestCache.get(requestKey);
}

function LocalDevicePreview() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const stopPreview = useCallback((updateState = true) => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (updateState) {
      setStatus('idle');
    }
  }, []);

  const startPreview = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Ce navigateur ne permet pas d'accéder à la caméra.");
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play?.();
      }
      setStatus('ready');
    } catch (err) {
      setError(
        err?.name === 'NotAllowedError'
          ? 'Autorisez la caméra et le micro dans le navigateur pour tester la visio.'
          : "Impossible d'ouvrir la caméra ou le micro.",
      );
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    startPreview();
    return () => stopPreview(false);
  }, [startPreview, stopPreview]);

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Test caméra et micro</h2>
          <p className="text-sm text-slate-500">
            Prévisualisation locale en attendant la configuration LiveKit.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={startPreview}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Activation...' : 'Activer'}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={stopPreview}>
            Couper
          </button>
        </div>
      </div>

      <div className="aspect-video overflow-hidden rounded-lg bg-slate-950">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          autoPlay
        />
      </div>

      {status === 'ready' && (
        <div className="alert alert-success py-2 text-sm">
          Caméra et micro accessibles sur ce navigateur.
        </div>
      )}
      {error && <div className="alert alert-warning py-2 text-sm">{error}</div>}
    </div>
  );
}

export default function TeleconsultationPage() {
  const { appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const { token, isAuthenticated } = useAuth();
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const role = searchParams.get('role') || 'patient';
  const accessToken = searchParams.get('access_token');
  const isPractitioner = role === 'practitioner' || role === 'praticien';

  const title = useMemo(
    () => (isPractitioner ? 'Téléconsultation praticien' : 'Téléconsultation patient'),
    [isPractitioner],
  );

  useEffect(() => {
    if (!isAuthenticated || !token || !appointmentId) return;

    const requestKey = `${appointmentId}:${role}:${accessToken || ''}`;

    if (!isPractitioner && !accessToken) {
      setError("Le lien de téléconsultation patient est incomplet.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSession(null);

    loadTeleconsultationSession(requestKey, () =>
      isPractitioner
        ? fetchPractitionerTeleconsultationToken(token, appointmentId)
        : fetchPatientTeleconsultationToken(token, appointmentId, accessToken),
    )
      .then((payload) => {
        if (!cancelled) {
          setSession(payload);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Impossible d'ouvrir la téléconsultation.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, appointmentId, isAuthenticated, isPractitioner, role, token]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto py-16 space-y-4">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <div className="alert alert-warning">
          Connectez-vous pour accéder à la téléconsultation.
        </div>
        <Link to="/patient" className="btn btn-primary">
          Se connecter
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 space-y-4">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <div className="flex items-center gap-3 text-slate-600">
          <span className="loading loading-spinner loading-sm" />
          Préparation de la salle...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-16 space-y-4">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <div className="alert alert-error">{error}</div>
        <Link to={isPractitioner ? '/praticien' : '/patient'} className="btn btn-outline">
          Retour
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-3xl mx-auto py-16 space-y-4">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <div className="alert alert-info">La salle n'est pas encore disponible.</div>
      </div>
    );
  }

  if (session.mock) {
    return (
      <div className="max-w-3xl mx-auto py-16 space-y-5">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">Mode local</p>
          <h1 className="text-3xl font-semibold">{title}</h1>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-3">
          <div className="badge badge-success">Salle prête</div>
          <p className="text-sm text-slate-600">
            Le backend a généré un jeton de test pour la salle{' '}
            <span className="font-mono text-slate-800">{session.room_name}</span>.
          </p>
          <p className="text-sm text-slate-500">
            Configurez LiveKit pour remplacer cet écran par la visio réelle.
          </p>
        </div>
        <LocalDevicePreview />
        <Link to={isPractitioner ? '/praticien' : '/patient'} className="btn btn-outline">
          Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-950 text-white rounded-xl overflow-hidden">
      <LiveKitRoom
        token={session.token}
        serverUrl={session.livekit_url}
        connect
        audio
        video
        data-lk-theme="default"
        className="min-h-[calc(100vh-8rem)]"
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
