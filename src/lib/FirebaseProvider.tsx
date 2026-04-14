import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc, serverTimestamp, getDoc, query, collection, where, getDocs } from "firebase/firestore";

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
      try {
        if (user) {
          // Sync user with Firestore
          const userRef = doc(db, "usuarios", user.uid);
          let userDoc = await getDoc(userRef);
          
          // Fallback: Check if a document with this email already exists under a different ID
          if (!userDoc.exists() && user.email) {
            const q = query(collection(db, "usuarios"), where("email", "==", user.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              // Found an existing document with this email! 
              // We should probably migrate it to the new UID or at least use its data.
              const existingDoc = querySnapshot.docs[0];
              const existingData = existingDoc.data();
              
              // Create the new document with the data from the old one
              await setDoc(userRef, {
                ...existingData,
                id: user.uid, // Ensure ID matches new UID
                atualizado_em: serverTimestamp()
              });
              
              // Refresh userDoc reference
              userDoc = await getDoc(userRef);
            }
          }

          if (!userDoc.exists()) {
            await setDoc(userRef, {
              id: user.uid,
              nome: user.displayName || "Usuário",
              email: user.email || "",
              foto: user.photoURL || null,
              role: user.email === "wilkergcintra@gmail.com" ? "admin" : "cliente",
              criado_em: serverTimestamp(),
              atualizado_em: serverTimestamp()
            });
          } else {
            const existingData = userDoc.data();
            await setDoc(userRef, {
              nome: user.displayName || existingData.nome || "Usuário",
              foto: user.photoURL || existingData.foto || null,
              atualizado_em: serverTimestamp()
            }, { merge: true });
          }
        }
      } catch (error) {
        console.error("Error syncing user with Firestore:", error);
      } finally {
        setUser(user);
        setLoading(false);
      }
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
