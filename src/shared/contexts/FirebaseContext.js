import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';

const FirebaseContext = createContext();

export const useFirebaseStatus = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebaseStatus must be used within a FirebaseProvider');
  }
  return context;
};

export const FirebaseProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to read from customers collection to verify connection
        // This is more reliable than a test collection
        await getDocs(collection(db, 'customers'));
        setIsConnected(true);
        console.log('✅ Firebase connection successful');
      } catch (error) {
        console.error('Firebase connection check failed:', error);
        
        // Check if it's a permissions issue
        if (error.code === 'permission-denied') {
          console.log('⚠️ Firebase permissions issue - this might be normal if not authenticated');
          // For now, assume connection is working but permissions are restricted
          setIsConnected(true);
        } else {
          // Try a simple connection test
          try {
            await getDocs(collection(db, 'test'));
            setIsConnected(true);
            console.log('✅ Firebase connection successful (via test collection)');
          } catch (testError) {
            console.error('Firebase test collection also failed:', testError);
            setIsConnected(false);
          }
        }
      } finally {
        setIsChecking(false);
      }
    };

    checkConnection();
  }, []);

  const value = {
    isConnected,
    isChecking
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}; 