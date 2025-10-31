import React from 'react';

/**
 * A simple toast component. It appears in the bottom right when visible.
 * Props:
 *  - message: string to display
 *  - isVisible: boolean controlling visibility
 *  - onClose: optional callback when the toast is dismissed
 */
const Toast = ({ message, isVisible, onClose }) => {
  if (!isVisible) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-green-500 text-white px-4 py-2 rounded shadow-lg flex items-center space-x-3">
        <span>{message}</span>
        {onClose && (
          <button type="button" className="text-white/80 hover:text-white" onClick={onClose}>
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;
