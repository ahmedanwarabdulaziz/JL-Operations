import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../shared/firebase/config';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Send, MessageSquare, Download, RefreshCw } from 'lucide-react';
import { emailTemplates, generateMissingPictureEmail, generateMissingFoamEmail, generateMissingBenchCushionEmail } from '../shared/utils/leadEmailTemplates';
import { sendLeadFollowUpEmail } from '../shared/services/emailService';
import { emailThreadService } from '../shared/services/emailThreadService';
import './LeadsManagement.css';

const LeadsManagement = () => {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Email states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailProgress, setEmailProgress] = useState('');
  const [emailHistory, setEmailHistory] = useState([]);
  const [threadMessages, setThreadMessages] = useState([]);
  const [showThreadHistory, setShowThreadHistory] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);
  const [selectedQuickReply, setSelectedQuickReply] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isSendingQuickReply, setIsSendingQuickReply] = useState(false);

  const statusOptions = [
    { value: 'all', label: 'All Status', color: '#666' },
    { value: 'New', label: 'New', color: '#007bff' },
    { value: 'Quote sent', label: 'Quote sent', color: '#ffc107' },
    { value: 'Customer respond', label: 'Customer respond', color: '#17a2b8' },
    { value: 'Won', label: 'Won', color: '#28a745' },
    { value: 'lost', label: 'Lost', color: '#dc3545' }
  ];

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, selectedStatus]);

  const fetchLeads = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'leads'));
      const leadsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeads(leadsData);
      setFilteredLeads(leadsData);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = leads;

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(lead => lead.status === selectedStatus);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLeads(filtered);
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      const leadRef = doc(db, 'leads', leadId);
      await updateDoc(leadRef, { status: newStatus });
      
      // Update local state
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );
      
      // Update selected lead if it's the one being updated
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(prev => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  const openLeadDetail = async (lead) => {
    setSelectedLead(lead);
    setCurrentImageIndex(0);
    await loadEmailHistory(lead.id);
  };

  const closeLeadDetail = () => {
    setSelectedLead(null);
    setCurrentImageIndex(0);
    setEmailHistory([]);
    setThreadMessages([]);
  };

  const getImageUrls = (lead) => {
    if (lead.imageUrls && Array.isArray(lead.imageUrls)) {
      return lead.imageUrls;
    } else if (lead.imageUrl) {
      return [lead.imageUrl];
    }
    return [];
  };

  const getAttachmentCount = (lead) => {
    const imageUrls = getImageUrls(lead);
    return imageUrls.length;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'MMM dd, yyyy HH:mm');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const truncateText = (text, maxLength = 30) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Email functions
  const openEmailModal = () => {
    setShowEmailModal(true);
    setSelectedEmailTemplate('');
  };

  const closeEmailModal = () => {
    setShowEmailModal(false);
    setSelectedEmailTemplate('');
    setEmailProgress('');
  };

  const sendEmail = async () => {
    if (!selectedEmailTemplate || !selectedLead) return;

    setIsSendingEmail(true);
    setEmailProgress('Preparing email...');

    try {
      let emailContent = '';
      let subject = '';

      switch (selectedEmailTemplate) {
        case 'missing-picture':
          emailContent = generateMissingPictureEmail(selectedLead.name);
          subject = 'More Info Needed for Your Quote - Missing Picture';
          break;
        case 'missing-foam':
          emailContent = generateMissingFoamEmail(selectedLead.name);
          subject = 'More Info Needed for Your Quote - Missing Foam';
          break;
        case 'missing-bench-cushion':
          emailContent = generateMissingBenchCushionEmail(selectedLead.name);
          subject = 'More Info Needed for Your Quote - Missing Bench Cushion';
          break;
        default:
          throw new Error('Invalid email template');
      }

      setEmailProgress('Sending email...');
      const result = await sendLeadFollowUpEmail(selectedLead.email, subject, emailContent, selectedLead.id, selectedEmailTemplate);
      
              if (result.success) {
          setEmailProgress('Email sent successfully!');
          setTimeout(async () => {
            closeEmailModal();
            // Refresh email history
            await loadEmailHistory(selectedLead.id);
          }, 2000);
        } else {
        setEmailProgress('Failed to send email. Please try again.');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setEmailProgress('Error sending email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const loadEmailHistory = async (leadId) => {
    try {
      const leadDoc = await getDoc(doc(db, 'leads', leadId));
      if (leadDoc.exists()) {
        const emailHistory = leadDoc.data().emailHistory || [];
        setEmailHistory(emailHistory);
      }
    } catch (error) {
      console.error('Error loading email history:', error);
    }
  };

  const loadThreadMessages = async () => {
    if (!selectedLead || !selectedLead.email) return;

    setIsLoadingThread(true);
    try {
      const messages = await emailThreadService.getThreadHistory(selectedLead.email);
      setThreadMessages(messages);
      setShowThreadHistory(true);
    } catch (error) {
      console.error('Error loading thread messages:', error);
    } finally {
      setIsLoadingThread(false);
    }
  };

  const downloadAttachment = async (messageId, attachmentId, filename) => {
    try {
      const attachment = await emailThreadService.downloadAttachment(messageId, attachmentId);
      
      // Create download link
      const blob = new Blob([attachment.data], { type: attachment.mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading attachment:', error);
    }
  };

  const sendQuickReply = async () => {
    if (!selectedQuickReply || !selectedLead) return;

    setIsSendingQuickReply(true);
    try {
      const message = customMessage || selectedQuickReply;
      await emailThreadService.sendQuickReply(selectedLead.email, message);
      setShowQuickReplyModal(false);
      setSelectedQuickReply('');
      setCustomMessage('');
      
      // Refresh thread messages
      await loadThreadMessages();
    } catch (error) {
      console.error('Error sending quick reply:', error);
      alert('Error sending quick reply: ' + error.message);
    } finally {
      setIsSendingQuickReply(false);
    }
  };

  const checkForNewReplies = async () => {
    if (!selectedLead || !selectedLead.email) return;

    try {
      const newReplies = await emailThreadService.checkForNewReplies(selectedLead.email);
      if (newReplies.length > 0) {
        // Refresh thread messages to show new replies
        await loadThreadMessages();
        alert(`Found ${newReplies.length} new reply(ies)!`);
      } else {
        alert('No new replies found.');
      }
    } catch (error) {
      console.error('Error checking for new replies:', error);
    }
  };

  if (loading) {
    return (
      <div className="leads-management">
        <div className="loading-spinner">Loading leads...</div>
      </div>
    );
  }

  return (
    <div className="leads-management">
      <div className="leads-header">
        <h1>Leads Management</h1>
        <div className="leads-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="status-filter">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="leads-layout">
        {/* Left Panel - Lead Cards */}
        <div className="leads-panel">
          <div className="leads-grid">
            {filteredLeads.length === 0 ? (
              <div className="no-leads">No leads found</div>
            ) : (
              filteredLeads.map(lead => (
                <div
                  key={lead.id}
                  className={`lead-card ${selectedLead?.id === lead.id ? 'selected' : ''}`}
                  onClick={() => openLeadDetail(lead)}
                >
                  <div className="lead-card-header">
                    <h3>{lead.name || 'No Name'}</h3>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: statusOptions.find(s => s.value === lead.status)?.color || '#666'
                      }}
                    >
                      {lead.status || 'New'}
                    </span>
                  </div>
                  <div className="lead-card-content">
                    <p><strong>Email:</strong> {lead.email || 'No Email'}</p>
                    <p><strong>Phone:</strong> {lead.phone || 'No Phone'}</p>
                    <p><strong>Description:</strong> {truncateText(lead.description || 'No Description')}</p>
                    <p><strong>Date:</strong> {formatDate(lead.timestamp)}</p>
                    {getAttachmentCount(lead) > 0 && (
                      <p className="attachment-info">
                        📎 {getAttachmentCount(lead)} Attachment(s)
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Lead Details */}
        <div className="details-panel">
          {selectedLead ? (
            <div className="lead-details">
              <div className="details-header">
                <h2>{selectedLead.name || 'No Name'}</h2>
                <button className="close-btn" onClick={closeLeadDetail}>×</button>
              </div>

              <div className="details-content">
                <div className="basic-info">
                  <h3>Basic Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Email:</label>
                      <span>{selectedLead.email || 'No Email'}</span>
                    </div>
                    <div className="info-item">
                      <label>Phone:</label>
                      <span>{selectedLead.phone || 'No Phone'}</span>
                    </div>
                    <div className="info-item">
                      <label>Date:</label>
                      <span>{formatDate(selectedLead.timestamp)}</span>
                    </div>
                    <div className="info-item">
                      <label>Status:</label>
                      <select
                        value={selectedLead.status || 'New'}
                        onChange={(e) => updateLeadStatus(selectedLead.id, e.target.value)}
                      >
                        {statusOptions.filter(option => option.value !== 'all').map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="description-section">
                  <h3>Description</h3>
                  <p>{selectedLead.description || 'No description provided'}</p>
                </div>

                {/* Images Section */}
                {getImageUrls(selectedLead).length > 0 && (
                  <div className="images-section">
                    <h3>Attachments ({getImageUrls(selectedLead).length})</h3>
                    <div className="image-gallery">
                      <div className="main-image">
                        <img
                          src={getImageUrls(selectedLead)[currentImageIndex]}
                          alt={`Attachment ${currentImageIndex + 1}`}
                        />
                        {getImageUrls(selectedLead).length > 1 && (
                          <>
                            <button
                              className="nav-btn prev"
                              onClick={() => setCurrentImageIndex(prev => 
                                prev === 0 ? getImageUrls(selectedLead).length - 1 : prev - 1
                              )}
                            >
                              <ChevronLeft />
                            </button>
                            <button
                              className="nav-btn next"
                              onClick={() => setCurrentImageIndex(prev => 
                                prev === getImageUrls(selectedLead).length - 1 ? 0 : prev + 1
                              )}
                            >
                              <ChevronRight />
                            </button>
                          </>
                        )}
                      </div>
                      {getImageUrls(selectedLead).length > 1 && (
                        <div className="thumbnails">
                          {getImageUrls(selectedLead).map((url, index) => (
                            <img
                              key={index}
                              src={url}
                              alt={`Thumbnail ${index + 1}`}
                              className={index === currentImageIndex ? 'active' : ''}
                              onClick={() => setCurrentImageIndex(index)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Communication Section */}
                <div className="communication-section">
                  <h3>Communication</h3>
                  <div className="communication-actions">
                    <button className="action-btn" onClick={openEmailModal}>
                      <Send size={16} />
                      Send Follow-up Email
                    </button>
                    <button className="action-btn" onClick={loadThreadMessages}>
                      <MessageSquare size={16} />
                      View Email Thread
                    </button>
                    <button className="action-btn" onClick={checkForNewReplies}>
                      <RefreshCw size={16} />
                      Check Replies
                    </button>
                    <button className="action-btn" onClick={() => setShowQuickReplyModal(true)}>
                      <Send size={16} />
                      Quick Reply
                    </button>
                  </div>

                  {/* Sent Emails */}
                  {emailHistory.length > 0 && (
                    <div className="email-history">
                      <h4>Sent Emails</h4>
                      <div className="history-list">
                        {emailHistory.map((email, index) => (
                          <div key={email.id} className="history-item">
                            <div className="history-header">
                              <span className="history-date">{formatDate(new Date(email.sentDate))}</span>
                              <span className="history-template">{email.templateId}</span>
                            </div>
                            <div className="history-subject">{email.subject}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Thread Messages */}
                  {threadMessages.length > 0 && (
                    <div className="email-history">
                      <h4>Email Thread</h4>
                      <div className="history-list">
                        {threadMessages.map((message, index) => (
                          <div key={message.id} className={`history-item ${message.isFromCustomer ? 'customer-message' : 'business-message'}`}>
                            <div className="history-header">
                              <span className="history-date">{formatDate(new Date(message.date))}</span>
                              <span className="history-sender">{message.isFromCustomer ? 'Customer' : 'You'}</span>
                            </div>
                            <div className="history-subject">{message.subject}</div>
                            {message.attachments.length > 0 && (
                              <div className="history-attachments">
                                📎 {message.attachments.length} attachment(s)
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <h3>Select a lead to view details</h3>
              <p>Click on any lead card from the left panel to see detailed information, manage status, and handle communications.</p>
            </div>
          )}
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="modal-overlay">
          <div className="email-modal">
            <div className="modal-header">
              <h3>Send Follow-up Email</h3>
              <button onClick={closeEmailModal}>×</button>
            </div>
            <div className="modal-content">
              <div className="email-templates">
                <h4>Select Email Template:</h4>
                <div className="template-options">
                  {emailTemplates.map(template => (
                    <label key={template.id} className="template-option">
                      <input
                        type="radio"
                        name="emailTemplate"
                        value={template.id}
                        checked={selectedEmailTemplate === template.id}
                        onChange={(e) => setSelectedEmailTemplate(e.target.value)}
                      />
                      <span>{template.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              {emailProgress && (
                <div className="email-progress">{emailProgress}</div>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={closeEmailModal}>Cancel</button>
              <button
                onClick={sendEmail}
                disabled={!selectedEmailTemplate || isSendingEmail}
                className="send-btn"
              >
                {isSendingEmail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thread History Modal */}
      {showThreadHistory && (
        <div className="modal-overlay">
          <div className="thread-modal">
            <div className="modal-header">
              <h3>Email Thread History</h3>
              <button onClick={() => setShowThreadHistory(false)}>×</button>
            </div>
            <div className="modal-content">
              {isLoadingThread ? (
                <div className="loading">Loading thread history...</div>
              ) : (
                <div className="thread-messages">
                  {threadMessages.map((message, index) => (
                    <div key={index} className={`thread-message ${message.isFromCustomer ? 'customer' : 'business'}`}>
                      <div className="message-header">
                        <span className="sender">{message.isFromCustomer ? 'Customer' : 'You'}</span>
                        <span className="date">{formatDate(new Date(message.date))}</span>
                      </div>
                      <div className="message-subject">{message.subject}</div>
                                             <div className="message-body">
                         {message.body && message.body.length > 200 
                           ? `${message.body.substring(0, 200)}...` 
                           : message.body}
                       </div>
                      {message.attachments.length > 0 && (
                        <div className="message-attachments">
                          <h5>Attachments:</h5>
                          {message.attachments.map((attachment, idx) => (
                                                         <button
                               key={idx}
                               onClick={() => downloadAttachment(message.id, attachment.id)}
                               className="attachment-btn"
                             >
                              <Download size={14} />
                              {attachment.filename}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Reply Modal */}
      {showQuickReplyModal && (
        <div className="modal-overlay">
          <div className="quick-reply-modal">
            <div className="modal-header">
              <h3>Quick Reply</h3>
              <button onClick={() => setShowQuickReplyModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="quick-reply-templates">
                <h4>Select Quick Reply:</h4>
                <select
                  value={selectedQuickReply}
                  onChange={(e) => setSelectedQuickReply(e.target.value)}
                >
                  <option value="">Choose a template...</option>
                  <option value="Thank you for your inquiry. We'll get back to you within 24 hours.">
                    Thank you for your inquiry
                  </option>
                  <option value="We're currently reviewing your request and will provide a detailed quote soon.">
                    Reviewing your request
                  </option>
                  <option value="We need some additional information to provide you with an accurate quote.">
                    Need more information
                  </option>
                  <option value="Your quote is ready! Please check the attached document for details.">
                    Quote ready
                  </option>
                </select>
              </div>
              <div className="custom-message">
                <h4>Custom Message (Optional):</h4>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add any additional message here..."
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowQuickReplyModal(false)}>Cancel</button>
              <button
                onClick={sendQuickReply}
                disabled={!selectedQuickReply || isSendingQuickReply}
                className="send-btn"
              >
                {isSendingQuickReply ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsManagement; 
