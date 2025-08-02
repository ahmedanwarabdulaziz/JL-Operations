import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { format } from 'date-fns';
import { Search, Filter, Eye, Calendar, Mail, Phone, FileText, Image as ImageIcon } from 'lucide-react';
import './LeadsManagement.css';

const LeadsManagement = () => {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDetailPopup, setShowDetailPopup] = useState(false);

  // Status options
  const statusOptions = [
    { value: 'all', label: 'All Leads', color: '#666' },
    { value: 'new', label: 'New', color: '#3b82f6' },
    { value: 'contacted', label: 'Contacted', color: '#f59e0b' },
    { value: 'quoted', label: 'Quoted', color: '#8b5cf6' },
    { value: 'won', label: 'Won', color: '#10b981' },
    { value: 'lost', label: 'Lost', color: '#ef4444' }
  ];

  // Fetch leads from Firebase
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const leadsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }));
        setLeads(leadsData);
        setFilteredLeads(leadsData);
      } catch (error) {
        console.error('Error fetching leads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  // Filter and search leads
  useEffect(() => {
    let filtered = leads;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.name?.toLowerCase().includes(searchLower) ||
        lead.email?.toLowerCase().includes(searchLower) ||
        lead.description?.toLowerCase().includes(searchLower) ||
        lead.phone?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredLeads(filtered);
  }, [leads, searchTerm, statusFilter]);

  // Update lead status
  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        status: newStatus,
        updatedAt: new Date()
      });

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

  // Open detail popup
  const openLeadDetail = (lead) => {
    setSelectedLead(lead);
    setShowDetailPopup(true);
  };

  // Close detail popup
  const closeLeadDetail = () => {
    setShowDetailPopup(false);
    setSelectedLead(null);
  };

  // Get status color
  const getStatusColor = (status) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.color : '#666';
  };

  // Get status label
  const getStatusLabel = (status) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.label : 'Unknown';
  };

  // Format date
  const formatDate = (date) => {
    return format(date, 'MMM dd, yyyy HH:mm');
  };

  // Truncate text
  const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (loading) {
    return (
      <div className="leads-management-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leads-management-page">
      <div className="page-header">
        <h1>Leads Management</h1>
        <p>Manage and track all incoming leads</p>
      </div>

      {/* Filters and Search */}
      <div className="filters-section">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search leads by name, email, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-container">
          <Filter className="filter-icon" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="results-count">
        <p>Showing {filteredLeads.length} of {leads.length} leads</p>
      </div>

      {/* Leads Grid */}
      <div className="leads-grid">
        {filteredLeads.length === 0 ? (
          <div className="no-leads">
            <p>No leads found matching your criteria.</p>
          </div>
        ) : (
          filteredLeads.map(lead => (
            <div key={lead.id} className="lead-card" onClick={() => openLeadDetail(lead)}>
              <div className="card-header">
                <h3 className="lead-name">{lead.name}</h3>
                <span 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(lead.status) }}
                >
                  {getStatusLabel(lead.status)}
                </span>
              </div>

              <div className="card-content">
                <div className="lead-info">
                  <div className="info-item">
                    <Mail className="info-icon" />
                    <span>{lead.email}</span>
                  </div>
                  
                  {lead.phone && (
                    <div className="info-item">
                      <Phone className="info-icon" />
                      <span>{lead.phone}</span>
                    </div>
                  )}

                  <div className="info-item">
                    <Calendar className="info-icon" />
                    <span>{formatDate(lead.createdAt)}</span>
                  </div>

                  {lead.description && (
                    <div className="info-item">
                      <FileText className="info-icon" />
                      <span>{truncateText(lead.description)}</span>
                    </div>
                  )}
                </div>

                {lead.imageUrl && (
                  <div className="image-preview">
                    <ImageIcon className="image-icon" />
                    <span>Image attached</span>
                  </div>
                )}
              </div>

              <div className="card-footer">
                <button className="view-details-btn">
                  <Eye className="eye-icon" />
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Popup */}
      {showDetailPopup && selectedLead && (
        <div className="detail-popup-overlay" onClick={closeLeadDetail}>
          <div className="detail-popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h2>Lead Details</h2>
              <button className="close-btn" onClick={closeLeadDetail}>×</button>
            </div>

            <div className="popup-content">
              <div className="detail-section">
                <h3>Contact Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Name:</label>
                    <span>{selectedLead.name}</span>
                  </div>
                  <div className="detail-item">
                    <label>Email:</label>
                    <span>{selectedLead.email}</span>
                  </div>
                  {selectedLead.phone && (
                    <div className="detail-item">
                      <label>Phone:</label>
                      <span>{selectedLead.phone}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <label>Submitted:</label>
                    <span>{formatDate(selectedLead.createdAt)}</span>
                  </div>
                </div>
              </div>

              {selectedLead.description && (
                <div className="detail-section">
                  <h3>Project Description</h3>
                  <p className="description-text">{selectedLead.description}</p>
                </div>
              )}

              {selectedLead.imageUrl && (
                <div className="detail-section">
                  <h3>Reference Image</h3>
                  <div className="image-container">
                    <img src={selectedLead.imageUrl} alt="Reference" className="reference-image" />
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>Status Management</h3>
                <div className="status-update">
                  <label>Current Status:</label>
                  <select
                    value={selectedLead.status || 'new'}
                    onChange={(e) => updateLeadStatus(selectedLead.id, e.target.value)}
                    className="status-select"
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
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsManagement; 