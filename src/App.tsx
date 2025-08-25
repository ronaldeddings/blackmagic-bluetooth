import React from 'react';
import AppLayout from './components/AppLayout';
import { QueryClient, QueryClientProvider } from 'react-query';

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && 'status' in error && 
            (error as any).status >= 400 && (error as any).status < 500) {
          return false;
        }
        return failureCount < 3;
      }
    }
  }
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout />
    </QueryClientProvider>
  );
};

export default App;