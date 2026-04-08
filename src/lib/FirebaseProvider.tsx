import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Sync user with Firestore
        const userRef = doc(db, "usuarios", user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          await setDoc(userRef, {
            id: user.uid,
            nome: user.displayName || "Usuário",
            email: user.email,
            foto: user.photoURL,
            role: user.email === "wilkergcintra@gmail.com" ? "admin" : "cliente",
            criado_em: serverTimestamp(),
            atualizado_em: serverTimestamp()
          });
        } else {
          await setDoc(userRef, {
            nome: user.displayName || userDoc.data().nome,
            foto: user.photoURL || userDoc.data().foto,
            atualizado_em: serverTimestamp()
          }, { merge: true });
        }
      }
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Error Boundary Component
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "{}");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = "Você não tem permissão para realizar esta ação.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="flex h-screen flex-col items-center justify-center p-4 text-center space-y-4">
          <h1 className="text-2xl font-bold uppercase tracking-tighter">Ops! Algo deu errado.</h1>
          <p className="text-gray-500 max-w-md">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-black px-8 py-3 text-sm font-bold text-white uppercase tracking-widest"
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
