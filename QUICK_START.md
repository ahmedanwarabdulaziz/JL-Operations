# Quick Start Guide

## 🚀 Get Your JL Operations App Running Locally

### ✅ Firebase Configuration - Already Set Up!

Your Firebase configuration is already configured with your real project:
- **Project ID:** `jl-operation`
- **Auth Domain:** `jl-operation.firebaseapp.com`
- **Storage Bucket:** `jl-operation.firebasestorage.app`

The app is ready to connect to your real Firebase data!

### Step 1: Set Up Firebase Services (if not already done)

1. **Enable Authentication:**
   - In Firebase Console → Authentication → Sign-in methods
   - Enable Google sign-in

2. **Create Firestore Database:**
   - In Firebase Console → Firestore Database
   - Create database in test mode for development

3. **Add localhost to authorized domains:**
   - In Firebase Console → Authentication → Settings → Authorized domains
   - Add `localhost`

### Step 2: Run the Application

**Option A: Use the setup script (Windows)**
```bash
# Run the batch file
setup.bat

# Or use PowerShell
powershell -ExecutionPolicy Bypass -File setup.ps1
```

**Option B: Manual commands**
```bash
# Install dependencies (if not already done)
npm install

# Start the development server
npm start
```

### Step 3: Test the Connection

1. Open your browser to `http://localhost:3000`
2. Sign in with Google
3. Go to the Test page (`http://localhost:3000/test`)
4. Use the Firebase Connection Test to verify everything is working

### Step 4: Verify Everything Works

✅ **Firebase Connection:** Should show "Firebase is connected successfully!"  
✅ **Authentication:** Should be able to sign in with Google  
✅ **Firestore Test:** Should be able to write and read test documents  
✅ **App Navigation:** Should be able to navigate between pages  
✅ **Real Data:** Should see your actual data from the online version  

## 🔧 Troubleshooting

### Common Issues:

**"Firebase: Error (auth/unauthorized-domain)"**
- Add `localhost` to authorized domains in Firebase Console

**"Firebase: Error (auth/operation-not-allowed)"**
- Enable Google sign-in in Authentication settings

**"Firebase: Error (permission-denied)"**
- Use test mode rules in Firestore for development

**App not loading**
- Make sure you're running `npm start` from the project root
- Check that port 3000 is available

## 📚 Next Steps

Once everything is working:
1. Set up proper Firestore security rules
2. Configure email services (see EMAIL_SETUP.md)
3. Add your production domain to authorized domains
4. Deploy to production

## 📖 Detailed Documentation

- **Firebase Setup:** `FIREBASE_SETUP.md`
- **Email Configuration:** `EMAIL_SETUP.md`
- **Gmail Integration:** `GMAIL_SETUP.md`

## 🆘 Need Help?

If you encounter any issues:
1. Check the browser console for error messages
2. Ensure all Firebase services are properly enabled
3. Check the Test page for connection status
4. Verify `localhost` is in authorized domains 