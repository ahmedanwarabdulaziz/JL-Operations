# Firebase Setup Guide

## ✅ Firebase Configuration - Already Configured!

Your Firebase configuration is already set up with your real project:
- **Project ID:** `jl-operation`
- **Auth Domain:** `jl-operation.firebaseapp.com`
- **Storage Bucket:** `jl-operation.firebasestorage.app`

The app is ready to connect to your real Firebase data!

## Step 1: Verify Firebase Services

1. **Check Authentication:**
   - In Firebase Console → Authentication → Sign-in methods
   - Make sure Google sign-in is enabled

2. **Check Firestore Database:**
   - In Firebase Console → Firestore Database
   - Ensure database exists and is accessible

3. **Check Authorized Domains:**
   - In Firebase Console → Authentication → Settings → Authorized domains
   - Make sure `localhost` is in the list for local development

## Step 2: Run the Application

1. Start the development server:
   ```bash
   npm start
   ```

2. The app should open in your browser at `http://localhost:3000`

## Step 3: Test the Connection

1. Try to sign in with Google
2. Check if data is being read/written to Firestore
3. Check the browser console for any Firebase-related errors
4. Go to `/test` page to use the Firebase Connection Test

## Troubleshooting

### Common Issues:

1. **"Firebase: Error (auth/unauthorized-domain)"**
   - Go to Firebase Console > Authentication > Settings > Authorized domains
   - Add `localhost` to the list

2. **"Firebase: Error (auth/operation-not-allowed)"**
   - Make sure Google sign-in is enabled in Authentication > Sign-in methods

3. **"Firebase: Error (permission-denied)"**
   - Check your Firestore security rules
   - For development, you can use test mode rules

### Security Rules for Development:

In Firestore Database > Rules, you can temporarily use these rules for development:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ Warning: These rules allow full access. Only use for development!**

## Next Steps

Once everything is working:
1. Set up proper Firestore security rules
2. Configure email services if needed
3. Set up proper authentication flows
4. Deploy to production

## Current Configuration

Your app is configured to use:
- **Project:** jl-operation
- **API Key:** AIzaSyCVZ-C2ezeuOhgHtCTQVi234Fhc4ZGX8Qs
- **Auth Domain:** jl-operation.firebaseapp.com
- **Storage Bucket:** jl-operation.firebasestorage.app
- **Messaging Sender ID:** 118256366160
- **App ID:** 1:118256366160:web:b44f0592501796c0ef1755 