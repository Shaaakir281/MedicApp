import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import {
  API_BASE_URL,
  createPrescription,
  sendPrescriptionLink,
  signPrescription,
} from '../lib/api.js';

const toAbsoluteUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
};

const appendQueryParam = (url, key, value) => {
  if (!url || url.includes(`${key}=`)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${key}=${value}`;
};

const buildPractitionerUrl = (path, { inline = false, channel = 'preview' } = {}) => {
  if (!path) return null;
  let url = toAbsoluteUrl(path);
  url = appendQueryParam(url, 'actor', 'practitioner');
  url = appendQueryParam(url, 'channel', channel);
  if (inline) {
    url = appendQueryParam(url, 'mode', 'inline');
  }
  return url;
};

const buildDefaultPreviewState = () => ({
  open: false,
  url: null,
  title: "Apercu de l'ordonnance",
  appointmentId: null,
  mode: 'view',
});

export function usePractitionerPrescriptions({
  token,
  setError,
  setSuccessMessage,
  handleRefresh,
  triggerHistoryRefresh,
}) {
  const [previewingId, setPreviewingId] = useState(null);
  const [activeSendId, setActiveSendId] = useState(null);
  const [signingId, setSigningId] = useState(null);
  const [previewState, setPreviewState] = useState(buildDefaultPreviewState);

  const ensurePrescriptionMutation = useMutation({
    mutationFn: (appointmentId) => createPrescription(token, appointmentId),
  });

  const signMutation = useMutation({
    mutationFn: (appointmentId) => signPrescription(token, appointmentId),
  });

  const sendLinkMutation = useMutation({
    mutationFn: (appointmentId) => sendPrescriptionLink(token, appointmentId),
  });

  const openPreviewWithUrl = ({ url, appointmentId = null, title, mode = 'view' }) => {
    if (!url) return;
    setPreviewState({
      open: true,
      url,
      title: title || "Apercu de l'ordonnance",
      appointmentId,
      mode,
    });
  };

  const resetPreviewState = () => setPreviewState(buildDefaultPreviewState);

  const handlePreviewDocument = async (appointment, { mode = 'view' } = {}) => {
    if (!appointment) return;
    const appointmentId = appointment.appointment_id;
    if (!appointmentId) return;
    setError(null);
    setSuccessMessage(null);
    setPreviewingId(appointmentId);
    try {
      let previewPath = appointment.prescription_url;
      let generated = false;
      if (!previewPath) {
        const data = await ensurePrescriptionMutation.mutateAsync(appointmentId);
        previewPath = data.url;
        generated = true;
      }
      const previewUrl = buildPractitionerUrl(previewPath, { inline: true, channel: 'preview' });
      openPreviewWithUrl({
        url: previewUrl,
        appointmentId,
        title: mode === 'sign' ? "Verifiez l'ordonnance avant signature" : "Apercu de l'ordonnance",
        mode,
      });
      if (generated) {
        setSuccessMessage('Ordonnance generee.');
        triggerHistoryRefresh?.();
        handleRefresh?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewingId(null);
    }
  };

  const handleDirectPreview = (appointment, { url, title, mode = 'view' }) => {
    if (!url) return;
    openPreviewWithUrl({
      url,
      appointmentId: appointment?.appointment_id ?? null,
      title: title || "Apercu de l'ordonnance",
      mode,
    });
  };

  const handlePreviewAction = (appointment, options = {}) => {
    if (options.url) {
      handleDirectPreview(appointment, options);
    } else {
      handlePreviewDocument(appointment, options);
    }
  };

  const handleSignAppointment = async (appointmentId) => {
    if (!appointmentId) return;
    setError(null);
    setSuccessMessage(null);
    setSigningId(appointmentId);
    try {
      const data = await signMutation.mutateAsync(appointmentId);
      const previewUrl = buildPractitionerUrl(data.preview_url, { inline: true, channel: 'signature' });
      setSuccessMessage('Ordonnance signee et envoyee au patient.');
      triggerHistoryRefresh?.();
      handleRefresh?.();
      openPreviewWithUrl({
        url: previewUrl,
        appointmentId,
        title: 'Ordonnance signee',
        mode: 'view',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSigningId(null);
    }
  };

  const handleConfirmSignature = async () => {
    if (!previewState.appointmentId) return;
    await handleSignAppointment(previewState.appointmentId);
  };

  const handleSendPrescription = async (appointment) => {
    const appointmentId = appointment?.appointment_id;
    if (!appointmentId) return;
    if (!appointment?.prescription_signed_at) {
      setError("Veuillez signer l'ordonnance avant l'envoi au patient.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setActiveSendId(appointmentId);
    try {
      await sendLinkMutation.mutateAsync(appointmentId);
      setSuccessMessage('Lien renvoye au patient.');
    } catch (err) {
      setError(err.message);
    } finally {
      setActiveSendId(null);
    }
  };

  return {
    previewingId,
    activeSendId,
    signingId,
    previewState,
    resetPreviewState,
    handlePreviewDocument,
    handlePreviewAction,
    handleSignAppointment,
    handleConfirmSignature,
    handleSendPrescription,
    buildPractitionerUrl,
  };
}
