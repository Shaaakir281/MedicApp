import React from 'react';
import { LegalPage } from '../../components/LegalPage.jsx';
import privacyContent from '../../content/politique-confidentialite.md?raw';

export function PolitiqueConfidentialite() {
  return <LegalPage title="Politique de confidentialite" content={privacyContent} />;
}
