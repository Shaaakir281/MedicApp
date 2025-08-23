import React from 'react';

/**
 * Renders a PDF from a base64 encoded string inside an iframe.
 * Pass the `base64String` prop without the `data:application/pdf;base64,` prefix.
 */
const PdfPreview = ({ base64String }) => {
  return (
    <iframe
      title="PDF Preview"
      src={`data:application/pdf;base64,${base64String}`}
      className="w-full h-full"
    />
  );
};

export default PdfPreview;