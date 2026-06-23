import { createContext, useContext, useEffect, useState } from "react";
import { useSupportMe, getSupportMeQueryKey, type SupportAgent } from "@workspace/api-client-react";

interface AuthContextType {
  agent: SupportAgent | null;
  isLoading: boolean;
  setAgent: (agent: SupportAgent | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [agent, setAgent] = useState<SupportAgent | null>(null);
  const { data: meData, isLoading: isMeLoading } = useSupportMe({
    query: {
      queryKey: getSupportMeQueryKey(),
      retry: false,
      staleTime: Infinity,
    },
  });

  useEffect(() => {
    if (meData) {
      setAgent(meData);
    }
  }, [meData]);

  return (
    <AuthContext.Provider value={{ agent, isLoading: isMeLoading, setAgent }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
