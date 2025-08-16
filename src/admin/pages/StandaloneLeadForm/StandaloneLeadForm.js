import React from 'react';
import LeadForm from '../../components/LeadForm/LeadForm';
import './StandaloneLeadForm.css';

const StandaloneLeadForm = () => {
  return (
    <div className="standalone-lead-form">
      <div className="standalone-header">
        <h1>JL Operations</h1>
        <p>Professional Furniture Manufacturing & Custom Solutions</p>
        <div className="contact-info">
          <p>📧 info@jloperations.com</p>
          <p>📞 +1 (555) 123-4567</p>
        </div>
      </div>
      
      <LeadForm />
      
      <div className="standalone-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Our Services</h3>
            <ul>
              <li>Custom Furniture Design</li>
              <li>Commercial Furniture</li>
              <li>Residential Projects</li>
              <li>Restoration & Repair</li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h3>Why Choose Us</h3>
            <ul>
              <li>30+ Years Experience</li>
              <li>Premium Materials</li>
              <li>Custom Design</li>
              <li>Quality Guarantee</li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h3>Contact Info</h3>
            <p>📍 123 Furniture Lane</p>
            <p>🏢 Suite 100</p>
            <p>📧 info@jloperations.com</p>
            <p>📞 +1 (555) 123-4567</p>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; 2024 JL Operations. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default StandaloneLeadForm; 
