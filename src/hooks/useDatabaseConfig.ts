import { useState, useEffect } from 'react';

export interface DatabaseConfig {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  defaultPort: string;
  description: string;
  isBeta?: boolean;
  releaseNotes?: string;
}

export interface DatabaseConfigResponse {
  dataSources: DatabaseConfig[];
  total: number;
}

export function useDatabaseConfig() {
  const [dataSources, setDataSources] = useState<DatabaseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDatabaseConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/data-sources/config');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch database config: ${response.statusText}`);
        }

        const data: DatabaseConfigResponse = await response.json();
        setDataSources(data.dataSources);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to empty array if API fails
        setDataSources([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDatabaseConfig();
  }, []);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/data-sources/config');
      
      if (!response.ok) {
        throw new Error(`Failed to refetch database config: ${response.statusText}`);
      }

      const data: DatabaseConfigResponse = await response.json();
      setDataSources(data.dataSources);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return {
    dataSources,
    loading,
    error,
    refetch
  };
}
