import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface DisabledProjectProps {
  showAuth?: boolean;
}

export function DisabledProject({ showAuth = false }: DisabledProjectProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground mb-4">
            Project Disabled
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            The project has been disabled (it was part of a hackathon). To enable it, please contact me.
          </p>
          
          {showAuth && (
            <div className="space-y-4">
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Authentication is still available:
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a
                    href="/login"
                    className="inline-flex items-center justify-center px-6 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Sign In
                  </a>
                  <a
                    href="/signup"
                    className="inline-flex items-center justify-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                  >
                    Sign Up
                  </a>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-8">
            <a
              href="/"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
            >
              ← Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}