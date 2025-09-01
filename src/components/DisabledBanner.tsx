import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DisabledBannerProps {
  onDismiss?: () => void;
  dismissible?: boolean;
}

export function DisabledBanner({ onDismiss, dismissible = false }: DisabledBannerProps) {
  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Project Disabled
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  This project has been disabled (it was part of a hackathon). Functionality is limited. To enable it, please contact me.
                </p>
              </div>
            </div>
            {dismissible && onDismiss && (
              <div className="flex-shrink-0">
                <button
                  type="button"
                  className="bg-orange-50 dark:bg-transparent rounded-md p-1.5 text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  onClick={onDismiss}
                >
                  <span className="sr-only">Dismiss</span>
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}