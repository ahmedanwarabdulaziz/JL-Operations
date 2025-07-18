import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithGoogle, isSignedIn, getCurrentUser, signOut as signOutService, validateGmailToken } from '../services/emailService';

const GmailAuthContext = createContext();

export const useGmailAuth = () => {
  const context = useContext(GmailAuthContext);
  if (!context) {
    throw new Error('useGmailAuth must be used within a GmailAuthProvider');
  }
  return context;
};

export const GmailAuthProvider = ({ children }) => {
  const [gmailSignedIn, setGmailSignedIn] = useState(false);
  const [gmailUser, setGmailUser] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState(null);

  // Check if already signed in on app load
  useEffect(() => {
    const checkSignInStatus = async () => {
      // First check if we have a stored token
      const hasStoredToken = isSignedIn();
      
      if (hasStoredToken) {
        // Validate the stored token
        const isValid = await validateGmailToken();
        if (isValid) {
          const user = getCurrentUser();
          setGmailSignedIn(true);
          setGmailUser(user);
          return;
        }
      }
      
      // No valid token found
      setGmailSignedIn(false);
      setGmailUser(null);
    };

    // Check immediately
    checkSignInStatus();

    // Also check after a short delay to ensure services are loaded
    const timer = setTimeout(checkSignInStatus, 1000);
    return () => clearTimeout(timer);
  }, []);

  const signIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      const user = await signInWithGoogle();
      setGmailSignedIn(true);
      setGmailUser(user);
      return user;
    } catch (error) {
      setSignInError(error.message);
      throw error;
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = () => {
    signOutService();
    setGmailSignedIn(false);
    setGmailUser(null);
    setSignInError(null);
  };

  const value = {
    gmailSignedIn,
    gmailUser,
    signingIn,
    signInError,
    signIn,
    signOut
  };

  return (
    <GmailAuthContext.Provider value={value}>
      {children}
    </GmailAuthContext.Provider>
  );
}; 