# Email Setup Guide for JL Operations

## Overview
The application supports multiple email sending methods. You can configure one or more of these options:

1. **Gmail API** (Recommended) - Uses your Google account to send emails
2. **EmailJS** (Alternative) - Uses a third-party service to send emails
3. **Simulation** (Fallback) - Shows what would be sent (for testing)

## Option 1: Gmail API Setup (Recommended)

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Gmail API for your project

### Step 2: Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add authorized JavaScript origins:
   - `http://localhost:3000` (for development)
   - `https://your-domain.com` (for production)
5. Copy the Client ID

### Step 3: Configure Environment Variables
Create a `.env` file in your project root and add:

```env
# Gmail API Configuration
REACT_APP_GMAIL_CLIENT_ID=your_oauth_client_id_here
REACT_APP_GMAIL_API_KEY=your_api_key_here
REACT_APP_FROM_EMAIL=your-email@gmail.com
```

### Step 4: Test Gmail API
1. Start the application
2. Sign in with your Google account
3. Try sending an email - it should work automatically

## Option 2: EmailJS Setup (Alternative)

### Step 1: Create EmailJS Account
1. Go to [EmailJS](https://www.emailjs.com/)
2. Sign up for a free account
3. Create a new email service (Gmail, Outlook, etc.)

### Step 2: Create Email Template
1. In EmailJS dashboard, go to "Email Templates"
2. Create a new template with variables:
   - `{{to_email}}` - recipient email
   - `{{from_email}}` - sender email
   - `{{subject}}` - email subject
   - `{{message}}` - email content
   - `{{order_data}}` - order information

### Step 3: Configure Environment Variables
Add to your `.env` file:

```env
# EmailJS Configuration
REACT_APP_EMAILJS_PUBLIC_KEY=your_public_key
REACT_APP_EMAILJS_SERVICE_ID=your_service_id
REACT_APP_EMAILJS_TEMPLATE_ID=your_template_id
```

## Option 3: Simulation Mode (Testing)

If you don't configure any email service, the app will simulate email sending. You'll see:
- Console logs showing what would be sent
- Success messages indicating simulated sending
- No actual emails sent

## Troubleshooting

### Gmail API Issues
- **"Gmail access denied"**: Make sure you're signed in with the correct Google account
- **"No user signed in"**: Sign in to the app first before trying to send emails
- **"Google API loading timeout"**: Check your internet connection and refresh the page

### EmailJS Issues
- **"EmailJS failed"**: Check your EmailJS credentials and template
- **"Service not found"**: Verify your service ID in EmailJS dashboard

### General Issues
- **Emails not sending**: Check browser console for error messages
- **Authentication problems**: Try signing out and back in
- **Configuration issues**: Verify all environment variables are set correctly

## Current Status

The application will try these methods in order:
1. **Gmail API** (if configured and user is signed in)
2. **EmailJS** (if configured)
3. **Simulation** (always available as fallback)

## Quick Test

To test if emails are working:
1. Go to the Workshop page
2. Select an order with a customer email
3. Click "Mark Deposit Received"
4. Check if you see a success message
5. Check browser console for detailed logs

## Support

If you need help setting up email functionality:
1. Check the browser console for error messages
2. Verify all environment variables are set
3. Ensure you're signed in with the correct account
4. Try the simulation mode first to test the flow 