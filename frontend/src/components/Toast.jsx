import React from 'react';

/**
 * A simple toast component. It appears in the bottom right when visible.
 * Props:
 *  - message: string to display
 *  - isVisible: boolean controlling visibility
 */
const Toast = ({ message, isVisible }) => {
  if (!isVisible) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-green-500 text-white px-4 py-2 rounded shadow-lg">
        {message}
      </div>
    </div>
  );
};

export default Toast;