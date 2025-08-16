import React from 'react';
import LeadForm from '../../components/LeadForm/LeadForm';
import './LeadFormPage.css';

const LeadFormPage = () => {
  return (
    <div className="lead-form-page">
      <div className="page-header">
        <h1>JL Operations</h1>
        <p>Professional Furniture Manufacturing & Custom Solutions</p>
      </div>
      
      <LeadForm />
      
      <div className="page-footer">
        <p>&copy; 2024 JL Operations. All rights reserved.</p>
      </div>
    </div>
  );
};

export default LeadFormPage; 
