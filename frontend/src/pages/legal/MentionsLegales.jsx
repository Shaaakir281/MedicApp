import React from 'react';
import { LegalPage } from '../../components/LegalPage.jsx';
import mentionsContent from '../../content/mentions-legales.md?raw';

export function MentionsLegales() {
  return <LegalPage title="Mentions legales" content={mentionsContent} />;
}
