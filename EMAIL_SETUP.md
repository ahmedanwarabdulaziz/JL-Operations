# Email Setup Guide

This guide will help you set up the email functionality for sending order details to customers.

## Gmail API Setup

The app uses **Gmail API with Google Identity Services** to send emails from your Gmail account (`jlupholstery@gmail.com`). This is the same system used in the Test Email page.

### 1. Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API for your project
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized JavaScript origins: `http://localhost:3000`, `http://localhost:3001`
   - Add authorized redirect URIs: `http://localhost:3000`, `http://localhost:3001`
   - Note down your **Client ID**

### 2. Configure the App
1. Open `src/config/gmail.js`
2. Update the CLIENT_ID with your actual Google OAuth Client ID:
   ```javascript
   export const GMAIL_CONFIG = {
     CLIENT_ID: 'your_oauth_client_id_here',
     // ... other settings
   };
   ```

### 3. Test the Setup
1. Go to the "Test Email" page in your app
2. Click "Sign in with Google"
3. Authorize the app to send emails
4. Send a test email to verify everything works

## How It Works

### Email Toggle in Step 6
- When creating or editing an order, users will see a toggle switch in Step 6 (Submit)
- Users must first sign in with their Gmail account to enable email sending
- The toggle allows them to choose whether to send an email to the customer
- The email will include all order details, pricing, and payment information

### Gmail Sign-in Process
- Users click "Sign in with Google" in Step 6
- Google OAuth popup appears for authorization
- Once authorized, the user can enable email sending
- Emails are sent from the signed-in Gmail account

### Email Content
The email template includes:
- Professional styling with your business branding
- Complete order details and furniture specifications
- Pricing breakdown (materials, labour, foam, pickup/delivery)
- Payment instructions and deposit requirements
- E-transfer security information
- Business contact details

### Email Template Structure
The email is generated using the template in `src/utils/emailTemplate.js` which includes:
- Customer greeting with personalized name
- Quote summary with invoice number
- Detailed furniture specifications
- Payment and deposit information
- Business policies and scheduling notes
- Professional signature and footer

## Testing the Email Functionality

1. Create a new order with customer email
2. Go through all steps to Step 6
3. Click "Sign in with Google" and authorize the app
4. Enable the "Send Order Details Email" toggle
5. Click "Create Order"
6. Check the customer's email for the quote

## Troubleshooting

### Email Not Sending
- Verify Google OAuth Client ID is correct
- Check browser console for error messages
- Ensure customer email is valid
- Make sure user is signed in with Gmail
- Verify Gmail API is enabled in Google Cloud Console

### Gmail Sign-in Issues
- Check that Google Identity Services is loaded
- Verify OAuth Client ID is properly configured
- Ensure authorized origins include your domain
- Check browser console for OAuth errors

### Configuration Issues
- Double-check Google Cloud Console settings
- Verify Gmail API is enabled
- Ensure OAuth consent screen is configured
- Check that redirect URIs are correct

## Security Notes

- Gmail API uses OAuth 2.0 for secure authentication
- User must explicitly authorize the app to send emails
- No credentials are stored in the frontend code
- Emails are sent from the user's own Gmail account
- Gmail API has generous quotas for personal use

## Customization

### Business Information
Edit `src/config/gmail.js` to update:
- Business name and email settings
- Default subject lines and messages

### Email Template
Modify `src/utils/emailTemplate.js` to customize:
- Email styling and colors
- Content layout
- Business policies
- Contact information

### Gmail API Settings
The Gmail API configuration in `src/config/gmail.js` can be extended to:
- Add different scopes for more permissions
- Configure different OAuth settings
- Add multiple Gmail accounts
- Set up email templates 