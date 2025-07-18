// Gmail Configuration
// You'll need to set up Gmail API credentials

export const GMAIL_CONFIG = {
  // Gmail API credentials - these should be set in environment variables
  CLIENT_ID: process.env.REACT_APP_GMAIL_CLIENT_ID || '', // Your OAuth 2.0 Client ID
  API_KEY: process.env.REACT_APP_GMAIL_API_KEY || '', // Your API Key
  
  // Email settings
  FROM_EMAIL: process.env.REACT_APP_FROM_EMAIL || 'jlupholstery@gmail.com', // Your Gmail address
  FROM_NAME: 'JL Upholstery',
  DEFAULT_SUBJECT: 'Test Email from JL Upholstery',
  DEFAULT_MESSAGE: 'This is a test email to verify the email functionality is working properly.\n\nBest regards,\nJL Upholstery Team'
};

// Gmail API scopes needed
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose'
];

// Gmail API discovery document
export const GMAIL_DISCOVERY_DOC = 'https://www.googleapis.com/$discovery/rest?version=v1'; 