import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isAuthReady: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          // Check if user document exists, if not create it
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: currentUser.email,
              name: currentUser.displayName,
              createdAt: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        console.error('Error synchronizing user profile:', error);
        // We don't throw or use handleFirestoreError here to avoid blocking isAuthReady
      } finally {
        setUser(currentUser);
        setIsAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login error:', error);
      const code = error?.code;
      if (code === 'auth/unauthorized-domain') {
        const hostname = window.location.hostname;
        toast.error(`Domínio não autorizado. Adicione "${hostname}" em Authentication > Settings > Authorized domains no console do Firebase.`);
      } else if (code === 'auth/popup-closed-by-user') {
        toast.error('Login cancelado.');
      } else if (code === 'auth/popup-blocked') {
        toast.error('Pop-up bloqueado pelo navegador. Permita pop-ups para este site.');
      } else if (code === 'auth/operation-not-allowed') {
        toast.error('Login com Google não está habilitado. Ative o provedor Google em Authentication > Sign-in method no console do Firebase.');
      } else if (code === 'auth/cancelled-popup-request') {
        toast.error('Requisição cancelada. Tente novamente.');
      } else if (error?.message) {
        toast.error(`Erro ao fazer login: ${error.message}`);
      } else {
        toast.error('Erro inesperado ao fazer login. Tente novamente.');
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
