import { useState, useEffect } from 'react';

export interface DataSourceConfig {
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

export interface DataSourceConfigResponse {
  dataSources: DataSourceConfig[];
  total: number;
}

export function useDataSourceConfig() {
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDataSourceConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/data-sources/config');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data source config: ${response.statusText}`);
        }

        const data: DataSourceConfigResponse = await response.json();
        setDataSources(data.dataSources);
      } catch (err) {
        console.error('Error fetching data source config:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to empty array if API fails
        setDataSources([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDataSourceConfig();
  }, []);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/data-sources/config');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data source config: ${response.statusText}`);
      }

      const data: DataSourceConfigResponse = await response.json();
      setDataSources(data.dataSources);
    } catch (err) {
      console.error('Error refetching data source config:', err);
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
