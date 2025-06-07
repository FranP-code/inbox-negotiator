import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Redirect logic
      if (requireAuth && !session?.user) {
        // User needs to be authenticated but isn't - redirect to login
        window.location.href = '/login';
      } else if (!requireAuth && session?.user) {
        // User is authenticated but on a public page - redirect to dashboard
        const currentPath = window.location.pathname;
        if (currentPath === '/login' || currentPath === '/signup') {
          window.location.href = '/dashboard';
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Handle auth state changes
        if (requireAuth && !session?.user) {
          window.location.href = '/login';
        } else if (!requireAuth && session?.user) {
          const currentPath = window.location.pathname;
          if (currentPath === '/login' || currentPath === '/signup') {
            window.location.href = '/dashboard';
          }
        }
      }
    );

    return () => subscription.unsubscribe();
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