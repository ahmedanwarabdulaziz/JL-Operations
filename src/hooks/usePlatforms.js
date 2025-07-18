import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

export const usePlatforms = () => {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlatforms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const platformsRef = collection(db, 'platforms');
      const platformsQuery = query(platformsRef, orderBy('createdAt', 'asc'));
      const platformsSnapshot = await getDocs(platformsQuery);
      const platformsData = platformsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlatforms(platformsData);
    } catch (err) {
      console.error('Error fetching platforms:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  return {
    platforms,
    loading,
    error,
    refetch: fetchPlatforms
  };
}; 