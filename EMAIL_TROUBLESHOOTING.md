# Email Troubleshooting Guide

## Issue: Completion Email Not Being Received

### 🔍 Step-by-Step Debugging Process

#### 1. **Check Browser Console (F12)**
- Open Developer Tools (F12)
- Go to Console tab
- Look for debug messages starting with:
  - `🔍 Workshop Debug -`
  - `🔍 Admin Workshop Debug -`
  - `🔍 Email Debug -`
  - `🧪 Test -`

#### 2. **Use the Email Test Page**
- Navigate to `/admin/email-test` in your app
- This page will help you test the email functionality step by step

#### 3. **Common Issues and Solutions**

##### Issue A: Gmail Authorization Problems
**Symptoms:**
- "Gmail authorization required" error
- "Gmail token expired" error
- "Gmail permissions denied" error

**Solutions:**
1. Go to `/admin/email-settings`
2. Click "Authorize Gmail"
3. Follow the Google OAuth flow
4. Grant all requested permissions
5. Test authorization with "Test Auth" button

##### Issue B: Customer Email Missing
**Symptoms:**
- "Customer email is required" error
- Email not being sent because customer has no email

**Solutions:**
1. Check if the customer has an email address in their order
2. Verify the email format is correct
3. Make sure the email field is not empty or just whitespace

##### Issue C: Order Data Structure Issues
**Symptoms:**
- "Order data is required" error
- Missing treatment information
- Incomplete order details

**Solutions:**
1. Verify the order has complete data:
   - `personalInfo.customerName`
   - `personalInfo.email`
   - `orderDetails.billInvoice`
   - `furnitureData.groups` (with treatment information)

##### Issue D: Gmail API Quotas
**Symptoms:**
- "Quota exceeded" error
- Emails not being sent after multiple attempts

**Solutions:**
1. Check Gmail API quotas in Google Cloud Console
2. Wait for quota reset (usually daily)
3. Consider upgrading Gmail API quota

##### Issue E: Network/Connectivity Issues
**Symptoms:**
- "Network error" or timeout errors
- Gmail API calls failing

**Solutions:**
1. Check internet connectivity
2. Verify firewall settings
3. Try again later

#### 4. **Testing Process**

##### Step 1: Test Gmail Authorization
1. Go to `/admin/email-test`
2. Check Gmail Configuration status
3. If not configured, click "Authorize Gmail"
4. Use "Test Auth" button to verify

##### Step 2: Test Email Sending
1. Enter a test email address (use your own email for testing)
2. Fill in test data:
   - Customer Name: "Test Customer"
   - Order Number: "TEST-001"
   - Treatments: "Leather Treatment, Fabric Protection"
3. Toggle "Include Review Request" as needed
4. Click "Send Test Completion Email"
5. Check console for debug logs

##### Step 3: Check Real Order Process
1. Go to `/admin/workshop`
2. Find an order with customer email
3. Try to mark it as "Done"
4. In the confirmation dialog:
   - Make sure "Send completion email" is checked
   - Make sure "Include Google review request" is checked
5. Click "Complete Order"
6. Watch console for debug messages

#### 5. **Debug Information to Collect**

When reporting issues, please provide:

1. **Console Logs:**
   ```
   Copy all console messages starting with 🔍 or 🧪
   ```

2. **Gmail Configuration Status:**
   ```
   - Is Gmail configured? (Yes/No)
   - User Email: [email address]
   - Token Status: [Set/Not Set]
   ```

3. **Order Information:**
   ```
   - Customer Email: [email address]
   - Order Number: [order number]
   - Has Treatments: (Yes/No)
   - Treatments: [list of treatments]
   ```

4. **Error Messages:**
   ```
   Copy any error messages from console or UI
   ```

#### 6. **Fallback Behavior**

The system has a fallback mechanism:
- If Gmail API fails, it shows "simulation completed"
- This means the email wasn't actually sent
- Check the console for the actual error

#### 7. **Verification Steps**

To verify if an email was actually sent:

1. **Check Gmail Sent Folder:**
   - Look in the Gmail account used for sending
   - Check "Sent" folder for the email

2. **Check Spam/Junk Folder:**
   - Recipient should check spam/junk folder
   - Add sender to contacts if needed

3. **Check Gmail API Response:**
   - Console should show "✅ Gmail API response"
   - Should include `messageId` and `threadId`

#### 8. **Quick Fixes**

##### If emails are going to simulation:
1. Re-authorize Gmail in `/admin/email-settings`
2. Check Gmail API quotas
3. Verify network connectivity

##### If no emails are being sent at all:
1. Check if customer has email address
2. Verify "Send completion email" is checked in dialog
3. Check console for error messages

##### If emails are sent but not received:
1. Check spam/junk folder
2. Verify email address is correct
3. Check Gmail API response in console

### 🚨 Emergency Contact

If you continue to have issues:
1. Collect all debug information above
2. Check the console logs thoroughly
3. Test with the Email Test Page first
4. Report specific error messages and console output
