import React, { useEffect, useState } from 'react';
import { account } from '../lib/appwrite';
import type { Models } from 'appwrite';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    account.get().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // Redirect logic
      if (requireAuth && !currentUser) {
        // User needs to be authenticated but isn't - redirect to login
        window.location.href = '/login';
      } else if (!requireAuth && currentUser) {
        // User is authenticated but on a public page - redirect to dashboard
        const currentPath = window.location.pathname;
        if (currentPath === '/login' || currentPath === '/signup') {
          window.location.href = '/dashboard';
        }
      }
    }).catch(() => {
      // No user session found
      setUser(null);
      setLoading(false);
      
      if (requireAuth) {
        window.location.href = '/login';
      }
    });

    // Note: Appwrite doesn't have built-in session listeners like Supabase
    // You might need to implement session checking through other means or use Appwrite's real-time features
  }, [requireAuth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-lg">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  // For protected routes, only render if user is authenticated
  if (requireAuth && !user) {
    return null; // Will redirect in useEffect
  }

  // For public routes, only render if user is not authenticated (or if they are, they'll be redirected)
  if (!requireAuth && user) {
    const currentPath = window.location.pathname;
    if (currentPath === '/login' || currentPath === '/signup') {
      return null; // Will redirect in useEffect
    }
  }

  return <>{children}</>;
}