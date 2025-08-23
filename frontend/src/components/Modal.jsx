import React from 'react';

/**
 * Generic modal component. It renders its children in a centered dialog
 * overlay when `isOpen` is true. A close button triggers `onClose`.
 */
const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-base-100 rounded-lg p-4 max-w-3xl w-full relative">
        <button
          className="absolute top-2 right-2 btn btn-sm btn-circle btn-error"
          onClick={onClose}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
};

export default Modal;