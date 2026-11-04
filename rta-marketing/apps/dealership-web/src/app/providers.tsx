import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../auth/AuthContext";
import { NavigationProvider } from "../router/Navigation";
import { RtaAssistant } from "@rta/assistant-ui";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useNavigation } from "../router/Navigation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function AssistantMount() {
  const { user } = useAuth();
  const { path, navigate } = useNavigation();
  return (
    <RtaAssistant
      key={user ? `${user.id}:${user.workspaceId ?? "platform"}` : "public"}
      authenticated={Boolean(user)}
      path={path}
      navigate={navigate}
      request={async (input) => {
        const response = await api<{ data: import("@rta/assistant-ui").AssistantAnswer }>("/assistant/chat", {
          method: "POST",
          body: JSON.stringify(input),
        });
        return response.data;
      }}
    />
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationProvider>
        <AuthProvider>
          <AssistantMount />
          {children}
        </AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4_000 }} />
      </NavigationProvider>
    </QueryClientProvider>
  );
}
