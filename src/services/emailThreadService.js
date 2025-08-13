import { ensureGmailAuthorized } from './emailService';

// Gmail API wrapper
const gmailApi = {
  // Get a specific thread by ID
  async getThread(threadId) {
    try {
      const config = await ensureGmailAuthorized();
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`, {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get thread: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting thread:', error);
      throw error;
    }
  },

  // Search for threads by email address
  async searchThreads(query) {
    try {
      const config = await ensureGmailAuthorized();
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to search threads: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error searching threads:', error);
      throw error;
    }
  },

  // Get a specific message by ID
  async getMessage(messageId) {
    try {
      const config = await ensureGmailAuthorized();
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get message: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting message:', error);
      throw error;
    }
  },

  // Get attachment content
  async getAttachment(messageId, attachmentId) {
    try {
      const config = await ensureGmailAuthorized();
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`, {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get attachment: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting attachment:', error);
      throw error;
    }
  },

  // Send a reply to a thread
  async sendReply(threadId, customerEmail, subject, content) {
    try {
      const config = await ensureGmailAuthorized();
      
      // Create the email message
      const email = [
        `To: ${customerEmail}`,
        `Subject: ${subject}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        content
      ].join('\r\n');
      
      // Encode the email in base64
      const encodedEmail = btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodedEmail,
          threadId: threadId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send reply: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending reply:', error);
      throw error;
    }
  }
};

// Helper functions
const extractEmailBody = (payload) => {
  // Helper function to decode base64 content
  const decodeContent = (data) => {
    if (!data) return '';
    try {
      return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    } catch (error) {
      console.error('Error decoding content:', error);
      return '';
    }
  };

  // Helper function to clean HTML content
  const cleanHtmlContent = (html) => {
    if (!html) return '';
    
    // Remove HTML tags but keep line breaks
    let cleaned = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Remove extra whitespace and normalize line breaks
    cleaned = cleaned
      .replace(/\n\s*\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned;
  };

  // Try to get content from the main body
  if (payload.body && payload.body.data) {
    const content = decodeContent(payload.body.data);
    if (payload.mimeType === 'text/html') {
      return cleanHtmlContent(content);
    }
    return content;
  }

  // If no main body, check parts
  if (payload.parts) {
    // First, try to find HTML content
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        const content = decodeContent(part.body.data);
        return cleanHtmlContent(content);
      }
    }
    
    // If no HTML, try plain text
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        const content = decodeContent(part.body.data);
        return content;
      }
    }
    
    // If still no content, recursively check nested parts
    for (const part of payload.parts) {
      if (part.parts) {
        const nestedContent = extractEmailBody(part);
        if (nestedContent && nestedContent !== 'No content available') {
          return nestedContent;
        }
      }
    }
  }

  // If we still have no content, try to extract from the snippet
  if (payload.snippet) {
    return payload.snippet;
  }

  return 'No content available';
};

const extractAttachments = (payload) => {
  const attachments = [];
  
  const processPart = (part) => {
    if (part.filename && part.body && part.body.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size
      });
    }
    
    if (part.parts) {
      part.parts.forEach(processPart);
    }
  };
  
  processPart(payload);
  return attachments;
};

const extractHeaders = (payload) => {
  const headers = {};
  if (payload.headers) {
    payload.headers.forEach(header => {
      headers[header.name] = header.value;
    });
  }
  return headers;
};

// Quick reply templates
export const quickReplyTemplates = [
  {
    id: 'thank_photos',
    name: 'Thank You for Photos',
    description: 'Thank the customer for sending photos'
  },
  {
    id: 'need_measurements',
    name: 'Need Measurements',
    description: 'Request additional measurements'
  },
  {
    id: 'quote_ready',
    name: 'Quote Ready',
    description: 'Inform customer that quote is ready'
  },
  {
    id: 'custom',
    name: 'Custom Message',
    description: 'Send a custom message'
  }
];

// Main email thread tracking functions
export const emailThreadService = {
  // Search for threads by customer email
  async searchThreadsByEmail(customerEmail) {
    try {
      console.log('🔍 Searching for threads with email:', customerEmail);
      
      // Search for threads containing this email address
      const searchQuery = `from:${customerEmail} OR to:${customerEmail}`;
      const searchResult = await gmailApi.searchThreads(searchQuery);
      
      console.log('📧 Found threads:', searchResult.threads?.length || 0);
      return searchResult.threads || [];
    } catch (error) {
      console.error('Error searching threads by email:', error);
      throw error;
    }
  },

  // Get complete thread history for a lead
  async getThreadHistory(customerEmail) {
    try {
      // First, search for threads containing this email
      const threads = await this.searchThreadsByEmail(customerEmail);
      
      if (threads.length === 0) {
        console.log('📭 No threads found for email:', customerEmail);
        return [];
      }
      
      // Get the most recent thread (assuming it's the main conversation)
      const mainThread = threads[0];
      const thread = await gmailApi.getThread(mainThread.id);
      const messages = [];
      
      // Get the current Gmail user's email to identify customer vs business messages
      const config = await ensureGmailAuthorized();
      const businessEmail = config.userEmail;
      
      console.log('📧 Getting thread history for thread ID:', mainThread.id);
      console.log('🏢 Business email:', businessEmail);
      console.log('📨 Total messages in thread:', thread.messages.length);
      
      for (const message of thread.messages) {
        const messageData = await gmailApi.getMessage(message.id);
        const headers = extractHeaders(messageData.payload);
        const body = extractEmailBody(messageData.payload);
        const attachments = extractAttachments(messageData.payload);
        
        // Determine if this message is from the customer (not from the business)
        const isFromCustomer = !headers.From.toLowerCase().includes(businessEmail.toLowerCase());
        
        console.log(`📨 Message ${message.id}:`, {
          from: headers.From,
          subject: headers.Subject,
          date: headers.Date,
          isFromCustomer: isFromCustomer,
          hasAttachments: attachments.length > 0,
          bodyLength: body ? body.length : 0,
          bodyPreview: body ? body.substring(0, 100) + '...' : 'No content'
        });
        
        messages.push({
          id: message.id,
          threadId: mainThread.id,
          from: headers.From,
          to: headers.To,
          subject: headers.Subject,
          date: headers.Date,
          body: body,
          attachments: attachments,
          isFromCustomer: isFromCustomer
        });
      }
      
      const sortedMessages = messages.sort((a, b) => new Date(a.date) - new Date(b.date));
      console.log('✅ Thread history loaded:', sortedMessages.length, 'messages');
      return sortedMessages;
    } catch (error) {
      console.error('Error getting thread history:', error);
      throw error;
    }
  },

  // Download attachment content
  async downloadAttachment(messageId, attachmentId) {
    try {
      const attachment = await gmailApi.getAttachment(messageId, attachmentId);
      const content = atob(attachment.data.replace(/-/g, '+').replace(/_/g, '/'));
      
      return {
        filename: attachment.filename || 'attachment',
        content: content,
        size: attachment.size,
        mimeType: attachment.mimeType
      };
    } catch (error) {
      console.error('Error downloading attachment:', error);
      throw error;
    }
  },

  // Send quick reply
  async sendQuickReply(customerEmail, message) {
    try {
      // First, find the thread for this customer
      const threads = await this.searchThreadsByEmail(customerEmail);
      
      if (threads.length === 0) {
        throw new Error('No existing thread found for this customer');
      }
      
      const threadId = threads[0].id;
      const subject = 'Re: Your Quote Request';
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #274290; margin-bottom: 20px;">JL Upholstery</h2>
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              ${message}
            </div>
            <div style="font-size: 14px; color: #666;">
              <p><strong>Contact Information:</strong></p>
              <p>Phone: 647-261-4116</p>
              <p>Email: info@jlupholstery.com</p>
              <p>Website: www.jlupholstery.com</p>
            </div>
          </div>
        </div>
      `;
      
      const result = await gmailApi.sendReply(threadId, customerEmail, subject, htmlContent);
      console.log('✅ Quick reply sent successfully');
      return result;
    } catch (error) {
      console.error('Error sending quick reply:', error);
      throw error;
    }
  },

  // Check for new replies
  async checkForNewReplies(customerEmail) {
    try {
      console.log('🔍 Checking for new replies from:', customerEmail);
      
      // Get the current thread history
      const currentMessages = await this.getThreadHistory(customerEmail);
      
      if (currentMessages.length === 0) {
        console.log('📭 No existing thread found');
        return [];
      }
      
      // For now, we'll just return the current messages
      // In a real implementation, you'd compare with previously stored messages
      const customerMessages = currentMessages.filter(msg => msg.isFromCustomer);
      
      console.log('📨 Found customer messages:', customerMessages.length);
      return customerMessages;
    } catch (error) {
      console.error('Error checking for new replies:', error);
      throw error;
    }
  }
}; 