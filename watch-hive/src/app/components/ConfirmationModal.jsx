"use client";
import { useEffect } from 'react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDanger = false }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="futuristic-card p-6 max-w-md w-full mx-4 border-2 border-futuristic-blue-500/50 shadow-glow-blue-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className={`text-2xl font-bold mb-4 ${isDanger ? 'text-red-400' : 'text-futuristic-yellow-400'} futuristic-text-glow-yellow`}>
                    {title}
                </h2>
                <p className="text-white mb-6">
                    {message}
                </p>
                <div className="flex gap-4 justify-end">
                    <button
                        onClick={onClose}
                        className="futuristic-button px-4 py-2"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 font-semibold transition-colors ${
                            isDanger 
                                ? 'bg-red-600 hover:bg-red-500 text-white' 
                                : 'futuristic-button-yellow'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;

