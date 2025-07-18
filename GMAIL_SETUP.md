# Gmail API Setup Guide

## Setting up Direct Gmail Integration

The app now uses Gmail API directly for sending emails. This is much more reliable and straightforward than third-party services.

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click on it and press "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Web application" as the application type
4. Add authorized JavaScript origins:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (for production)
5. Add authorized redirect URIs:
   - `http://localhost:3000`
   - `https://yourdomain.com`
6. Click "Create"
7. **Save your Client ID** - you'll need this

### 3. Create API Key

1. In "Credentials", click "Create Credentials" → "API Key"
2. **Save your API Key** - you'll need this
3. (Optional) Restrict the API key to Gmail API only

### 4. Update the Configuration

1. Open `src/config/gmail.js`
2. Replace the placeholder values with your actual credentials:

```javascript
export const GMAIL_CONFIG = {
  CLIENT_ID: 'your_client_id_here.apps.googleusercontent.com', // Your OAuth 2.0 Client ID
  API_KEY: 'your_api_key_here', // Your API Key
  
  // Email settings
  FROM_EMAIL: 'your-email@gmail.com', // Your Gmail address
  FROM_NAME: 'JL Upholstery',
  DEFAULT_SUBJECT: 'Test Email from JL Upholstery',
  DEFAULT_MESSAGE: 'This is a test email to verify the email functionality is working properly.\n\nBest regards,\nJL Upholstery Team'
};
```

### 5. Test the Email Functionality

1. Start your React app: `npm start`
2. Navigate to the "Test Email" page
3. Fill in the form and click "Send Email"
4. You'll be prompted to sign in with your Google account
5. Grant permission to send emails
6. Check your email inbox for the test message

## How It Works

1. **Authentication**: Uses Google OAuth 2.0 for secure authentication
2. **Direct Gmail API**: Sends emails directly through Gmail's API
3. **Real-time**: No delays or third-party services involved
4. **Reliable**: Uses Google's infrastructure for delivery

## Benefits of Direct Gmail Integration

✅ **No third-party dependencies** - Direct Google service  
✅ **High deliverability** - Uses Gmail's infrastructure  
✅ **Free** - No monthly limits or costs  
✅ **Secure** - OAuth 2.0 authentication  
✅ **Real-time** - Immediate sending  
✅ **Professional** - Emails come from your actual Gmail account  

## Troubleshooting

### Common Issues:

1. **"Gmail API not configured" error**
   - Make sure you've updated the configuration file with your actual credentials

2. **"Client ID not found" error**
   - Verify your Client ID is correct
   - Make sure you've added the correct authorized origins

3. **"API key not valid" error**
   - Verify your API Key is correct
   - Make sure Gmail API is enabled in your Google Cloud project

4. **"Permission denied" error**
   - Make sure you've granted the necessary permissions
   - Check that your Gmail account has sending permissions

5. **"Sign-in required" error**
   - The app will automatically prompt for Google sign-in
   - Make sure you're signed in with the correct Google account

### Gmail API Quotas:
- **Free tier**: 1 billion queries per day
- **Sending emails**: 100 emails per day per user
- **Reading emails**: 1 billion queries per day

For most business use cases, the free tier is more than sufficient.

## Security Notes:
- Client ID and API Key are safe to use in client-side code
- OAuth 2.0 handles authentication securely
- Emails are sent through Google's secure infrastructure
- No sensitive data is stored locally

## Production Deployment:

When deploying to production:
1. Update authorized origins in Google Cloud Console
2. Add your production domain to authorized JavaScript origins
3. Update the configuration with production settings
4. Test thoroughly before going live

## Alternative Setup (Simpler):

If you prefer an even simpler approach, you can also use:
- **Gmail SMTP** with a backend service
- **Firebase Functions** with Nodemailer
- **SendGrid** (paid service)

But the direct Gmail API approach is the most straightforward for a React app. 