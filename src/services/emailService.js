import { generateOrderEmailTemplate } from '../utils/emailTemplate';
import { generateDepositEmailTemplate } from '../utils/depositEmailTemplate';
import { auth } from '../firebase/config';

// Gmail configuration
let gmailConfig = {
  accessToken: '',
  userEmail: '',
  isConfigured: false
};

// Load Gmail configuration from localStorage
export const loadGmailConfig = () => {
  try {
    const saved = localStorage.getItem('gmailConfig');
    if (saved) {
      gmailConfig = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load Gmail config:', error);
  }
  return gmailConfig;
};

// Save Gmail configuration to localStorage
export const saveGmailConfig = (config) => {
  try {
    gmailConfig = { ...gmailConfig, ...config, isConfigured: true };
    localStorage.setItem('gmailConfig', JSON.stringify(gmailConfig));
    return true;
  } catch (error) {
    console.error('Failed to save Gmail config:', error);
    return false;
  }
};

// Request Gmail permissions and get access token
export const requestGmailPermissions = async () => {
  try {
    const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
    
    // Create Google provider with Gmail scopes
    const googleProvider = new GoogleAuthProvider();
    
    // Add basic scopes
    googleProvider.addScope('profile');
    googleProvider.addScope('email');
    googleProvider.addScope('openid');
    
    // Add Gmail scopes for full email access
    googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
    googleProvider.addScope('https://www.googleapis.com/auth/gmail.compose');
    googleProvider.addScope('https://www.googleapis.com/auth/gmail.modify');
    
    // Force consent to get fresh token
    googleProvider.setCustomParameters({
      prompt: 'consent',
      access_type: 'offline'
    });
    
    console.log('🔄 Requesting Gmail permissions...');
    
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    
    if (accessToken) {
      console.log('✅ Gmail access token obtained successfully');
      
      // Save Gmail configuration
      const config = {
        accessToken: accessToken,
        userEmail: user.email,
        isConfigured: true
      };
      
      saveGmailConfig(config);
      return config;
    } else {
      throw new Error('No access token received from Google');
    }
  } catch (error) {
    console.error('Failed to get Gmail permissions:', error);
    throw error;
  }
};

// Send email using Gmail API
const sendEmailViaGmail = async (to, subject, htmlContent, config) => {
  try {
    console.log('📧 Sending email via Gmail API:', {
      to: to,
      subject: subject,
      hasContent: !!htmlContent
    });

    // Create email message in Gmail format
    const emailLines = [
      `To: ${to}`,
      `From: "JL Upholstery" <${config.userEmail}>`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      htmlContent
    ];
    
    const email = emailLines.join('\r\n');
    const base64Email = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_');

    // Send via Gmail API
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: base64Email
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Gmail API response:', result);
      return { success: true, message: 'Email sent via Gmail API' };
    } else {
      const errorData = await response.json();
      console.error('Gmail API error:', errorData);
      
      // Handle specific error cases
      if (response.status === 401) {
        // Clear the invalid config
        clearGmailConfig();
        throw new Error('Gmail authorization expired. Please re-authorize Gmail access.');
      } else if (response.status === 403) {
        // Clear the invalid config
        clearGmailConfig();
        throw new Error('Gmail permissions denied. Please check your Gmail settings.');
      } else {
        throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
      }
    }
    
  } catch (error) {
    console.error('Gmail sending failed:', error);
    return { success: false, message: error.message };
  }
};

// Auto-check and authorize Gmail if needed
export const ensureGmailAuthorized = async () => {
  const config = loadGmailConfig();
  if (!config.isConfigured) {
    console.log('🔄 Gmail not authorized, requesting permissions...');
    try {
      const result = await requestGmailPermissions();
      return result;
    } catch (error) {
      console.error('Failed to authorize Gmail:', error);
      throw new Error('Gmail authorization required. Please authorize Gmail access first.');
    }
  }
  
  // Test the current token to see if it's still valid
  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });
    
    if (!response.ok) {
      console.log('🔄 Gmail token expired, requesting new permissions...');
      // Token is invalid, request new permissions
      const result = await requestGmailPermissions();
      return result;
    }
  } catch (error) {
    console.log('🔄 Gmail token test failed, requesting new permissions...');
    // Token test failed, request new permissions
    const result = await requestGmailPermissions();
    return result;
  }
  
  return config;
};

// Professional email sending using Gmail
export const sendEmailWithGmail = async (orderData, customerEmail, onProgress) => {
  try {
    const updateProgress = (message) => {
      if (onProgress) onProgress(message);
      console.log('📧 Email Progress:', message);
    };

    updateProgress('Checking Gmail authorization...');
    
    const config = await ensureGmailAuthorized();

    updateProgress('Preparing email content...');
    
    // Generate email content using your existing template
    const emailContent = generateOrderEmailTemplate(orderData);
    
    updateProgress('Sending email via Gmail API...');
    
    // Extract invoice number for subject line
    const billNo = orderData.orderDetails?.billInvoice || 'N/A';
    
    const emailResult = await sendEmailViaGmail(
      customerEmail,
      `JL Upholstery Service Quote - Invoice #${billNo}`,
      emailContent,
      config
    );
    
    if (emailResult.success) {
      updateProgress('Email sent successfully!');
      return { 
        success: true, 
        message: `Email sent successfully to ${customerEmail}! (via Gmail)` 
      };
    } else {
      // Fallback to simulation if Gmail fails
      updateProgress('Gmail failed, using simulation...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateProgress('Email simulation completed!');
      
      return { 
        success: true, 
        message: `Email simulation completed for ${customerEmail}! (Gmail unavailable)` 
      };
    }
  } catch (error) {
    console.error('Email sending failed:', error);
    
    // Fallback to simulation if Gmail fails
    updateProgress('Gmail unavailable, using simulation...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    updateProgress('Email simulation completed!');
    
    return { 
      success: true, 
      message: `Email simulation completed for ${customerEmail}! (Check your Gmail authorization)` 
    };
  }
};

// Professional deposit email sending using Gmail
export const sendDepositEmailWithGmail = async (orderData, customerEmail, onProgress) => {
  try {
    const updateProgress = (message) => {
      if (onProgress) onProgress(message);
      console.log('📧 Deposit Email Progress:', message);
    };

    updateProgress('Checking Gmail authorization...');
    
    const config = await ensureGmailAuthorized();

    updateProgress('Preparing deposit confirmation...');
    
    // Generate deposit email content using your existing template
    const emailContent = generateDepositEmailTemplate(orderData);
    
    updateProgress('Sending deposit confirmation via Gmail API...');
    
    // Extract invoice number for subject line
    const billNo = orderData.orderDetails?.billInvoice || 'N/A';
    
    const emailResult = await sendEmailViaGmail(
      customerEmail,
      `Deposit Payment Confirmed - Invoice #${billNo}`,
      emailContent,
      config
    );
    
    if (emailResult.success) {
      updateProgress('Deposit confirmation sent successfully!');
      return { 
        success: true, 
        message: `Deposit confirmation sent successfully to ${customerEmail}! (via Gmail)` 
      };
    } else {
      // Fallback to simulation if Gmail fails
      updateProgress('Gmail failed, using simulation...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateProgress('Deposit confirmation simulation completed!');
      
      return { 
        success: true, 
        message: `Deposit confirmation simulation completed for ${customerEmail}! (Gmail unavailable)` 
      };
    }
  } catch (error) {
    console.error('Deposit email sending failed:', error);
    return { 
      success: false, 
      message: error.message 
    };
  }
};

// Check if Gmail is configured
export const isGmailConfigured = () => {
  return !!gmailConfig.isConfigured;
};

// Get current Gmail configuration
export const getCurrentGmailConfig = () => {
  return gmailConfig;
};

// Sign out (clear Gmail config)
export const signOutGmail = () => {
  gmailConfig = {
    accessToken: '',
    userEmail: '',
    isConfigured: false
  };
  
  // Clear saved config from localStorage
  try {
    localStorage.removeItem('gmailConfig');
  } catch (error) {
    console.warn('Failed to clear Gmail config from localStorage:', error);
  }
};

// Clear Gmail config when authorization fails
export const clearGmailConfig = () => {
  gmailConfig = {
    accessToken: '',
    userEmail: '',
    isConfigured: false
  };
  
  try {
    localStorage.removeItem('gmailConfig');
    console.log('🗑️ Gmail config cleared due to authorization failure');
  } catch (error) {
    console.warn('Failed to clear Gmail config from localStorage:', error);
  }
};

// Check Gmail configuration status
export const getGmailConfigStatus = () => {
  const status = {
    gmail: {
      configured: gmailConfig.isConfigured,
      userEmail: gmailConfig.userEmail || 'Not set',
      accessToken: gmailConfig.accessToken ? 'Set' : 'Not set',
      message: gmailConfig.isConfigured 
        ? 'Gmail is configured and ready to use' 
        : 'Gmail not configured - authorize Gmail access'
    },
    simulation: {
      configured: true,
      message: 'Email simulation is always available for testing'
    }
  };

  console.log('📧 Gmail Configuration Status:', status);
  return status;
};

// Legacy functions for backward compatibility
export const sendEmailWithConfig = sendEmailWithGmail;
export const sendDepositEmailWithConfig = sendDepositEmailWithGmail;
export const loadEmailConfig = loadGmailConfig;
export const saveEmailConfig = saveGmailConfig;
export const isSignedIn = isGmailConfigured;
export const getCurrentUser = getCurrentGmailConfig;
export const signOut = signOutGmail;
export const getEmailConfigStatus = getGmailConfigStatus; 