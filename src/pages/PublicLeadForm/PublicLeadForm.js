import React from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { uploadImageToImgBB } from '../../config/imgbb';
import './PublicLeadForm.css';

// Firebase configuration (direct import to avoid auth context)
const firebaseConfig = {
  apiKey: "AIzaSyCVZ-C2ezeuOhgHtCTQVi234Fhc4ZGX8Qs",
  authDomain: "jl-operation.firebaseapp.com",
  projectId: "jl-operation",
  storageBucket: "jl-operation.firebasestorage.app",
  messagingSenderId: "118256366160",
  appId: "1:118256366160:web:b44f0592501796c0ef1755"
};

// Initialize Firebase directly
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PublicLeadForm = () => {
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    description: '',
    imageUrl: ''
  });
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const [uploadedImageUrl, setUploadedImageUrl] = React.useState('');
  const fileInputRef = React.useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      e.target.value = '';
      return;
    }

    try {
      const data = await uploadImageToImgBB(file);
      
      if (data.success) {
        const imageUrl = data.data.url;
        setFormData(prev => ({
          ...prev,
          imageUrl: imageUrl
        }));
        setUploadedImageUrl(imageUrl);
      } else {
        console.error('ImgBB upload failed:', data);
        alert(`Failed to upload image: ${data.error?.message || 'Unknown error'}`);
        e.target.value = '';
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please check your internet connection and try again.');
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const leadData = {
        ...formData,
        timestamp: serverTimestamp(),
        status: 'new',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'leads'), leadData);
      
      setShowSuccess(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        description: '',
        imageUrl: ''
      });
      
      setUploadedImageUrl('');
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
      
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('There was an error submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="public-lead-form-page">
      <div className="page-header">
        <h1>JL Operations</h1>
        <p>Professional Furniture Manufacturing & Custom Solutions</p>
        <div className="contact-info">
          <p>📧 info@jloperations.com</p>
          <p>📞 +1 (555) 123-4567</p>
        </div>
      </div>
      
      <div className="lead-form-container">
        {showSuccess && (
          <div className="success-message">
            <h3>Thank You!</h3>
            <p>We have received your request and will contact you with your quote within 2 working days.</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="lead-form">
          <h2>Get Your Quote</h2>
          <p className="form-subtitle">Fill out the form below and we'll get back to you within 2 working days.</p>
          
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={errors.name ? 'error' : ''}
              placeholder="Enter your full name"
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={errors.email ? 'error' : ''}
              placeholder="Enter your email address"
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Enter your phone number"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Project Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe your project requirements..."
              rows="4"
            />
          </div>

          <div className="form-group">
            <label htmlFor="image">Attach Image (Optional)</label>
            <input
              type="file"
              id="image"
              name="image"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="file-input"
            />
            <small>Supported formats: JPG, PNG, GIF (Max 5MB)</small>
            {uploadedImageUrl && (
              <div className="uploaded-image">
                <p>✅ Image uploaded successfully!</p>
                <img src={uploadedImageUrl} alt="Uploaded" style={{maxWidth: '200px', maxHeight: '200px', marginTop: '10px'}} />
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
      
      <div className="page-footer">
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

export default PublicLeadForm; 