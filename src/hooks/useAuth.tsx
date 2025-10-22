import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { callFunction, decodeJwt, fetchProfileByUserId } from '@/lib/api';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: 'client' | 'super_admin' | 'hr_staff' | 'architectural_civil_head' | 'mechanical_head' | 'ict_head' | 'material_testing_head' | 'marketing_communications' | 'employee';
  department?: string;
}

interface AuthContextType {
  profile: Profile | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (role: string | string[]) => boolean;
  getDashboardRoute: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('gcae.auth.token'));
  const decoded = useMemo(
    () => (token ? decodeJwt<{ sub: string; role: string; email: string; full_name: string; exp: number }>(token) : null),
    [token]
  );
  const isTokenExpired = useMemo(() => {
    if (!decoded?.exp) return false;
    return decoded.exp * 1000 < Date.now();
  }, [decoded]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (!token) {
        localStorage.removeItem('gcae.auth.token');
        if (isMounted) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      if (isTokenExpired) {
        localStorage.removeItem('gcae.auth.token');
        if (isMounted) {
          setToken(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      try {
        // Prefer function with user-token Authorization so gateway verifies JWT
        const profileResponse = await callFunction<{ profile: Profile | null }>(
          'auth-get-profile',
          {},
          { token, useAnonAuth: false }
        );

        if (isMounted) {
          setProfile(profileResponse?.profile ?? null);
        }
      } catch (error) {
        console.error('Failed to fetch profile on bootstrap:', error);
        // Fallback: try REST read of profiles using the same token (requires RLS policy)
        let restored: Profile | null = null;
        try {
          if (token && decoded?.sub) {
            const fallback = await fetchProfileByUserId<Profile>(token, decoded.sub);
            if (fallback) restored = fallback as Profile;
          }
        } catch (e) {
          console.warn('[auth] REST fallback profile fetch failed', e);
        }
        if (isMounted) {
          if (restored) {
            setProfile(restored);
          } else if (decoded?.sub) {
            // Build minimal profile from JWT claims to avoid bouncing user back to login
            const minimal: Profile = {
              id: decoded.sub,
              user_id: decoded.sub,
              full_name: (decoded as any).full_name ?? '',
              email: (decoded as any).email ?? '',
              role: ((decoded as any).role ?? 'client') as Profile['role'],
              department: (decoded as any).department ?? undefined,
            };
            setProfile(minimal);
          } else {
            localStorage.removeItem('gcae.auth.token');
            setToken(null);
            setProfile(null);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [token, isTokenExpired]);

  const signIn = async (email: string, password: string) => {
    try {
      const result = await callFunction<{ token: string; profile: Profile }>('auth-login', {
        email,
        password,
      });

      if (import.meta.env.DEV) {
        console.debug('[auth] login response', result);
      }

      localStorage.setItem('gcae.auth.token', result.token);
      setToken(result.token);
      setProfile(result.profile);

      if (import.meta.env.DEV) {
        console.debug('[auth] token stored', result.token);
        console.debug('[auth] profile received', result.profile);
      }

      toast({
        title: 'Welcome back!',
        description: 'You have successfully signed in.',
      });
    } catch (error: any) {
      toast({
        title: 'Sign In Error',
        description: error.message || 'An unknown error occurred.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      await callFunction('auth-register-client', {
        email,
        password,
        fullName,
      });

      toast({
        title: 'Account Created',
        description: 'Your account has been created successfully! You can now sign in.',
      });
    } catch (error: any) {
      toast({
        title: 'Sign Up Error',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const signOut = async () => {
    localStorage.removeItem('gcae.auth.token');
    setToken(null);
    setProfile(null);
    toast({
      title: 'Signed Out',
      description: 'You have been successfully signed out.',
    });
  };

  const hasRole = (requiredRoles: string | string[]): boolean => {
    if (!profile) return false;
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(profile.role);
  };

  const getDashboardRoute = (): string => {
    if (!profile) return '/auth/login';
    
    switch (profile.role) {
      case 'super_admin':
        return '/portal/admin';
      case 'hr_staff':
        return '/portal/hr';
      case 'architectural_civil_head':
        return '/portal/architectural';
      case 'mechanical_head':
        return '/portal/mechanical';
      case 'ict_head':
        return '/portal/ict';
      case 'material_testing_head':
        return '/portal/material-testing';
      case 'marketing_communications':
        return '/portal/marketing';
      case 'employee':
        return '/portal/employee';
      case 'client':
        return '/client-portal';
      default:
        return '/';
    }
  };

  const isAuthenticated = !!token && !isTokenExpired && !!decoded?.sub;

  return (
    <AuthContext.Provider
      value={{
        profile,
        token,
        loading,
        signIn,
        signUp,
        signOut,
        isAuthenticated,
        hasRole,
        getDashboardRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};