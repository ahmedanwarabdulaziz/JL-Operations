import { generateOrderEmailTemplate } from '../utils/emailTemplate';
import { generateDepositEmailTemplate } from '../utils/depositEmailTemplate';
import { GMAIL_CONFIG, GMAIL_SCOPES, GMAIL_DISCOVERY_DOC } from '../config/gmail';

// Global variables to store Gmail API state
let gmailToken = null;
let gmailUser = null;

// Helper functions to persist and restore Gmail auth state
const saveGmailAuthState = (token, user) => {
  try {
    localStorage.setItem('gmailToken', token);
    localStorage.setItem('gmailUser', JSON.stringify(user));
  } catch (error) {
    console.warn('Failed to save Gmail auth state to localStorage:', error);
  }
};

const loadGmailAuthState = () => {
  try {
    const token = localStorage.getItem('gmailToken');
    const userStr = localStorage.getItem('gmailUser');
    if (token && userStr) {
      gmailToken = token;
      gmailUser = JSON.parse(userStr);
      return true;
    }
  } catch (error) {
    console.warn('Failed to load Gmail auth state from localStorage:', error);
  }
  return false;
};

// Load saved auth state on module load
loadGmailAuthState();

// Initialize Gmail API
const initializeGmailAPI = async () => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Google API loading timeout. Please refresh the page and try again.'));
    }, 10000);
    
    window.gapi.load('client', async () => {
      try {
        clearTimeout(timeout);
        await window.gapi.client.init({
          discoveryDocs: [GMAIL_DISCOVERY_DOC],
        });
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
};

// Google Identity Services sign-in
export const signInWithGoogle = async () => {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      reject(new Error('Google Identity Services not loaded. Please refresh the page.'));
      return;
    }
    
    window.google.accounts.oauth2.initTokenClient({
      client_id: GMAIL_CONFIG.CLIENT_ID,
      scope: GMAIL_SCOPES.join(' '),
      callback: async (response) => {
        if (response.error) {
          reject(new Error('Google sign-in failed: ' + response.error));
          return;
        }
        
        gmailToken = response.access_token;
        
        // Get user info
        try {
          const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + response.access_token }
          });
          gmailUser = await userResponse.json();
          
          // Save auth state to localStorage
          saveGmailAuthState(gmailToken, gmailUser);
          
          resolve(gmailUser);
        } catch (error) {
          reject(new Error('Failed to get user info: ' + error.message));
        }
      },
    }).requestAccessToken();
  });
};

// Send email using Gmail API
export const sendOrderEmail = async (orderData, customerEmail) => {
  try {
    // Check if we have a token
    if (!gmailToken) {
      throw new Error('Not signed in to Gmail. Please sign in first.');
    }

    // Validate token before sending email
    const isValid = await validateGmailToken();
    if (!isValid) {
      throw new Error('Gmail token has expired. Please sign in again.');
    }

    // Initialize Gmail API
    await initializeGmailAPI();
    
    // Set the access token for Gmail API
    window.gapi.client.setToken({ access_token: gmailToken });
    
    // Generate the email HTML content
    const emailHtml = generateOrderEmailTemplate(orderData);
    
    // Create email content with proper RFC2822 format
    const emailContent = [
        `From: "${GMAIL_CONFIG.FROM_NAME}" <${gmailUser?.email || GMAIL_CONFIG.FROM_EMAIL}>`,
        `To: ${customerEmail}`,
        `Subject: Your JL Upholstery Service Quote - Invoice #${orderData.orderDetails.billInvoice}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset="UTF-8"',
        '', // Empty line to separate headers from body
        emailHtml
    ].join('\r\n');
    
    // Encode email for Gmail API - FIXED Unicode encoding
    const safeEmailContent = emailContent.replace(/[\u0080-\uFFFF]/g, function(match) {
        return '&#' + match.charCodeAt(0) + ';';
    });
    const encodedEmail = btoa(safeEmailContent)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    
    // Send email using Gmail API
    const response = await window.gapi.client.gmail.users.messages.send({
      userId: 'me',
      resource: { raw: encodedEmail }
    });
    
    console.log('Email sent successfully:', response);
    return { 
      success: true, 
      message: `Email sent successfully to ${customerEmail}! Gmail Message ID: ${response.result.id}` 
    };
  } catch (error) {
    console.error('Error sending email:', error);
    console.error('Error details:', {
      status: error.status,
      statusText: error.statusText,
      result: error.result,
      body: error.body
    });
    
    let errorMessage = 'Failed to send email';
    if (error.result && error.result.error) {
      errorMessage = `Gmail API Error: ${error.result.error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, message: errorMessage };
  }
};

// Check if user is signed in
export const isSignedIn = () => {
  return !!gmailToken;
};

// Get current user
export const getCurrentUser = () => {
  return gmailUser;
};

// Validate if the stored token is still valid
export const validateGmailToken = async () => {
  if (!gmailToken) {
    return false;
  }
  
  try {
    // Debug: Log the token being used
    console.log('validateGmailToken: using gmailToken', gmailToken);
    // Try to make a simple API call to test the token
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + gmailToken }
    });
    
    if (response.ok) {
      return true;
    } else {
      // Token is invalid, clear it
      signOut();
      return false;
    }
  } catch (error) {
    // Token is invalid, clear it
    signOut();
    return false;
  }
};

// Send deposit confirmation email
export const sendDepositEmail = async (orderData, customerEmail) => {
  try {
    // Check if we have a token
    if (!gmailToken) {
      return { 
        success: false, 
        message: 'Not signed in to Gmail. Please sign in first.' 
      };
    }

    // Validate token before sending email
    const isValid = await validateGmailToken();
    if (!isValid) {
      return { 
        success: false, 
        message: 'Gmail token has expired. Please sign in again.' 
      };
    }

    // Initialize Gmail API
    await initializeGmailAPI();
    
    // Set the access token for Gmail API
    window.gapi.client.setToken({ access_token: gmailToken });
    
    // Prepare data for deposit email template
    const depositData = {
      customerSalutationName: orderData.personalInfo?.customerName?.split(' ')[0] || 'Customer',
      formattedDeposit: orderData.paymentData?.deposit || '0',
      billNo: orderData.orderDetails?.billInvoice || 'N/A',
      currentYear: new Date().getFullYear(),
      YOUR_BUSINESS_EMAIL_SIGNATURE: 'ANWAR JL Upholstery',
      YOUR_BUSINESS_NAME: 'ANWAR JL Upholstery'
    };
    
    // Generate the email HTML content
    const emailHtml = generateDepositEmailTemplate(depositData);
    
    // Create email content with HTML
    const emailContent = [
        `From: "${GMAIL_CONFIG.FROM_NAME}" <${gmailUser?.email || GMAIL_CONFIG.FROM_EMAIL}>`,
        'Content-Type: text/html; charset="UTF-8"',
        'MIME-Version: 1.0',
        `To: ${customerEmail}`,
        `Subject: Deposit Received - Invoice #${orderData.orderDetails?.billInvoice || 'N/A'}`,
        '',
        emailHtml
    ].join('\r\n');
    
    // Encode email for Gmail API - FIXED Unicode encoding
    const safeEmailContent = emailContent.replace(/[\u0080-\uFFFF]/g, function(match) {
        return '&#' + match.charCodeAt(0) + ';';
    });
    const encodedEmail = btoa(safeEmailContent)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    
    // Send email using Gmail API
    const response = await window.gapi.client.gmail.users.messages.send({
      userId: 'me',
      resource: { raw: encodedEmail }
    });
    
    console.log('Deposit confirmation email sent successfully:', response);
    return { 
      success: true, 
      message: `Deposit confirmation email sent successfully to ${customerEmail}!` 
    };
  } catch (error) {
    console.error('Error sending deposit email:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to send deposit email' 
    };
  }
};

// Sign out
export const signOut = () => {
  gmailToken = null;
  gmailUser = null;
  
  // Clear saved auth state from localStorage
  try {
    localStorage.removeItem('gmailToken');
    localStorage.removeItem('gmailUser');
  } catch (error) {
    console.warn('Failed to clear Gmail auth state from localStorage:', error);
  }
}; 