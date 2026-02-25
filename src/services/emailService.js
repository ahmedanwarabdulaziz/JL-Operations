import { generateOrderEmailTemplate } from '../utils/emailTemplate';
import { generateDepositEmailTemplate, generateDepositReminderEmailTemplate, generatePickupReadyEmailTemplate } from '../utils/depositEmailTemplate';
import { db } from '../firebase/config';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { getSessionToken } from '../components/Auth/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL !== undefined && process.env.REACT_APP_API_URL !== ''
  ? process.env.REACT_APP_API_URL
  : '';
const EMAIL_SECRET = process.env.REACT_APP_EMAIL_API_SECRET || 'jl-email-2024';

let gmailConfig = { userEmail: 'JL Upholstery', isConfigured: false };

async function sendEmailCore(to, subject, html) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: EMAIL_SECRET, to, subject, html })
    });
  } catch (err) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Cannot reach email server. Run "npm run start:api" in the project. Emails are sent via Gmail (JL email + app password) on the server—set GMAIL_USER and GMAIL_APP_PASSWORD in the server environment.');
    }
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to send email');
  return { success: true };
}

function updateGmailConfigFromSession() {
  gmailConfig.isConfigured = !!getSessionToken();
  gmailConfig.userEmail = gmailConfig.isConfigured ? 'JL Upholstery' : '';
}

export const loadGmailConfig = () => {
  updateGmailConfigFromSession();
  return gmailConfig;
};

export const saveGmailConfig = (config) => {
  gmailConfig = { ...gmailConfig, ...config, isConfigured: true };
  return true;
};

export const getGmailConfig = () => {
  updateGmailConfigFromSession();
  return gmailConfig.isConfigured
    ? { userEmail: gmailConfig.userEmail || 'JL Upholstery', isConfigured: true }
    : { isConfigured: false };
};

export const ensureGmailAuthorized = async () => {
  updateGmailConfigFromSession();
  if (!gmailConfig.isConfigured) throw new Error('Please log in to send emails.');
  return gmailConfig;
};

export const sendEmailWithGmail = async (orderData, customerEmail, onProgress) => {
  const updateProgress = (msg) => {
    if (onProgress) onProgress(msg);
    console.log('📧 Email Progress:', msg);
  };
  updateProgress('Preparing email content...');
  const emailContent = generateOrderEmailTemplate(orderData);
  const billNo = orderData.orderDetails?.billInvoice || 'N/A';
  updateProgress('Sending email...');
  await sendEmailCore(customerEmail, `JL Upholstery Service Quote - Invoice #${billNo}`, emailContent);
  updateProgress('Email sent successfully!');
  return { success: true, message: `Email sent successfully to ${customerEmail}!` };
};

export const sendDepositEmailWithGmail = async (orderData, customerEmail, onProgress) => {
  const updateProgress = (msg) => {
    if (onProgress) onProgress(msg);
    console.log('📧 Deposit Email Progress:', msg);
  };
  updateProgress('Preparing deposit confirmation...');
  const emailContent = generateDepositEmailTemplate(orderData);
  const billNo = orderData.orderDetails?.billInvoice || 'N/A';
  updateProgress('Sending deposit confirmation...');
  await sendEmailCore(customerEmail, `Deposit Payment Confirmed - Invoice #${billNo}`, emailContent);
  updateProgress('Deposit confirmation sent successfully!');
  return { success: true, message: `Deposit confirmation sent successfully to ${customerEmail}!` };
};

export const sendDepositReminderEmailWithGmail = async (orderData, customerEmail, onProgress) => {
  const updateProgress = (msg) => {
    if (onProgress) onProgress(msg);
    console.log('📧 Deposit Reminder Email Progress:', msg);
  };
  updateProgress('Preparing deposit reminder...');
  const emailContent = generateDepositReminderEmailTemplate(orderData);
  const billNo = orderData?.orderDetails?.billInvoice || 'N/A';
  const subject = `Deposit Reminder – Fabric Order Confirmation (Order #${billNo})`;
  updateProgress('Sending deposit reminder...');
  await sendEmailCore(customerEmail, subject, emailContent);
  updateProgress('Deposit reminder sent successfully!');
  return { success: true, message: `Deposit reminder sent successfully to ${customerEmail}!` };
};

export const sendPickupReadyEmailWithGmail = async (customerEmail, pickupOptions, onProgress) => {
  const updateProgress = (msg) => {
    if (onProgress) onProgress(msg);
    console.log('📧 Pickup Ready Email Progress:', msg);
  };
  updateProgress('Preparing pickup ready email...');
  const emailContent = generatePickupReadyEmailTemplate(pickupOptions);
  const subject = 'Your Furniture Is Ready for Pickup';
  updateProgress('Sending pickup ready email...');
  await sendEmailCore(customerEmail, subject, emailContent);
  updateProgress('Pickup ready email sent successfully!');
  return { success: true, message: `Pickup ready email sent successfully to ${customerEmail}!` };
};

export const isGmailConfigured = () => {
  updateGmailConfigFromSession();
  return gmailConfig.isConfigured && !!EMAIL_SECRET;
};

export const getCurrentGmailConfig = () => {
  updateGmailConfigFromSession();
  return gmailConfig;
};

export const signOutGmail = () => {
  gmailConfig = { userEmail: '', isConfigured: false };
};

export const clearGmailConfig = () => {
  gmailConfig = { userEmail: '', isConfigured: false };
};

export const getGmailConfigStatus = () => {
  updateGmailConfigFromSession();
  const ready = gmailConfig.isConfigured && EMAIL_SECRET;
  return {
    gmail: {
      configured: ready,
      userEmail: gmailConfig.userEmail || 'Not set',
      accessToken: EMAIL_SECRET ? 'Set' : 'Not set',
      message: !gmailConfig.isConfigured
        ? 'Please log in to send emails.'
        : !EMAIL_SECRET
          ? 'Add REACT_APP_EMAIL_API_SECRET to .env.local and restart.'
          : 'Email sends via app backend. Keep "npm run start:api" running.'
    },
    simulation: { configured: true, message: 'Backend in same project sends via Gmail.' }
  };
};

export const sendLeadFollowUpEmail = async (leadData, templateId, onProgress) => {
  const updateProgress = (msg) => {
    if (onProgress) onProgress(msg);
    console.log('📧 Lead Email Progress:', msg);
  };
  updateProgress('Preparing email content...');
  const { emailTemplates } = await import('../utils/leadEmailTemplates');
  const template = emailTemplates.find((t) => t.id === templateId);
  if (!template) throw new Error('Email template not found');
  const emailContent = template.generateTemplate(leadData);
  updateProgress('Sending follow-up email...');
  await sendEmailCore(leadData.email, template.subject, emailContent);
  updateProgress('Follow-up email sent successfully!');
  try {
    await storeEmailHistory(leadData.id, {
      templateId,
      subject: template.subject,
      recipient: leadData.email,
      threadId: null,
      messageId: null,
      content: emailContent
    });
  } catch (e) {
    console.warn('Failed to store email history:', e);
  }
  return { success: true, message: `Follow-up email sent successfully to ${leadData.email}!` };
};

export const storeEmailHistory = async (leadId, emailData) => {
  const leadRef = doc(db, 'leads', leadId);
  const leadDoc = await getDoc(leadRef);
  if (!leadDoc.exists()) throw new Error('Lead not found');
  const emailHistoryEntry = {
    id: Date.now().toString(),
    sentDate: new Date().toISOString(),
    templateId: emailData.templateId,
    subject: emailData.subject,
    recipient: emailData.recipient,
    threadId: emailData.threadId,
    messageId: emailData.messageId,
    status: 'sent',
    content: emailData.content
  };
  await updateDoc(leadRef, {
    emailHistory: arrayUnion(emailHistoryEntry),
    lastEmailSent: new Date().toISOString(),
    threadId: emailData.threadId || leadDoc.data().threadId
  });
  return emailHistoryEntry;
};

export const getEmailHistory = async (leadId) => {
  const leadRef = doc(db, 'leads', leadId);
  const leadDoc = await getDoc(leadRef);
  if (!leadDoc.exists()) return [];
  return leadDoc.data().emailHistory || [];
};

export const updateEmailStatus = async (leadId, emailId, status, replyData = null) => {
  const leadRef = doc(db, 'leads', leadId);
  const leadDoc = await getDoc(leadRef);
  if (!leadDoc.exists()) throw new Error('Lead not found');
  const currentHistory = leadDoc.data().emailHistory || [];
  const updatedHistory = currentHistory.map((email) => {
    if (email.id === emailId) {
      return {
        ...email,
        status,
        replyDate: replyData ? new Date().toISOString() : email.replyDate,
        replyContent: replyData ? replyData.content : email.replyContent,
        replyAttachments: replyData ? replyData.attachments : email.replyAttachments
      };
    }
    return email;
  });
  await updateDoc(leadRef, {
    emailHistory: updatedHistory,
    lastReplyDate: replyData ? new Date().toISOString() : leadDoc.data().lastReplyDate
  });
};

export const sendCompletionEmailWithGmail = async (
  orderData,
  customerEmail,
  includeReviewRequest = true,
  onProgress
) => {
  const updateProgress = (msg) => {
    if (onProgress) onProgress(msg);
    console.log('📧 Completion Email Progress:', msg);
  };
  if (!customerEmail?.trim()) throw new Error('Customer email is required');
  if (!orderData) throw new Error('Order data is required');
  updateProgress('Preparing completion email...');
  const { generateCompletionEmailTemplate } = await import('../utils/completionEmailTemplate');
  const emailContent = await generateCompletionEmailTemplate(orderData, includeReviewRequest);
  const billNo = orderData.orderDetails?.billInvoice || 'N/A';
  const subject = `Thank You - Your Order #${billNo} is Complete!`;
  updateProgress('Sending completion email...');
  await sendEmailCore(customerEmail, subject, emailContent);
  updateProgress('Completion email sent successfully!');
  return { success: true, message: `Completion email sent successfully to ${customerEmail}!` };
};

export const sendEmailWithConfig = sendEmailWithGmail;
export const sendDepositEmailWithConfig = sendDepositEmailWithGmail;
export const sendDepositReminderEmailWithConfig = sendDepositReminderEmailWithGmail;
export const sendPickupReadyEmailWithConfig = sendPickupReadyEmailWithGmail;
export const loadEmailConfig = loadGmailConfig;
export const saveEmailConfig = saveGmailConfig;
export const isSignedIn = isGmailConfigured;
export const getCurrentUser = getCurrentGmailConfig;
export const signOut = signOutGmail;
export const getEmailConfigStatus = getGmailConfigStatus;
