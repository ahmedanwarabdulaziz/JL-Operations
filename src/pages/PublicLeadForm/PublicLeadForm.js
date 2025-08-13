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
    imageUrls: [] // Changed from imageUrl to imageUrls array
  });
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const [uploadedImages, setUploadedImages] = React.useState([]); // Track uploaded images
  const [isUploading, setIsUploading] = React.useState(false);
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
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large. Must be less than 5MB.`);
        }

        if (!file.type.startsWith('image/')) {
          throw new Error(`File ${file.name} is not an image.`);
        }

        const data = await uploadImageToImgBB(file);
        
        if (data.success) {
          return {
            url: data.data.url,
            name: file.name,
            size: file.size
          };
        } else {
          throw new Error(`Failed to upload ${file.name}: ${data.error?.message || 'Unknown error'}`);
        }
      });

      const uploadedImages = await Promise.all(uploadPromises);
      
      // Add new images to existing ones
      setUploadedImages(prev => [...prev, ...uploadedImages]);
      setFormData(prev => ({
        ...prev,
        imageUrls: [...prev.imageUrls, ...uploadedImages.map(img => img.url)]
      }));

    } catch (error) {
      console.error('Error uploading images:', error);
      alert(`Error uploading images: ${error.message}`);
    } finally {
      setIsUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (indexToRemove) => {
    setUploadedImages(prev => prev.filter((_, index) => index !== indexToRemove));
    setFormData(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, index) => index !== indexToRemove)
    }));
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
        imageUrls: []
      });
      
      setUploadedImages([]);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Auto-close after 8 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 8000);
      
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('There was an error submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
  };

  if (showSuccess) {
    return (
      <div className="success-overlay">
        <div className="success-container">
          <div className="success-icon">✓</div>
          <h2>Thank You for Your Interest!</h2>
          <p className="success-message">
            We have successfully received your project request. Our team will carefully review your requirements and contact you within 2 working days with a detailed quote and timeline.
          </p>
          <div className="success-details">
            <p><strong>What happens next?</strong></p>
            <ul>
              <li>Our design team will analyze your project requirements</li>
              <li>We'll prepare a comprehensive quote with material options</li>
              <li>You'll receive a detailed timeline for completion</li>
              <li>We'll schedule a consultation to discuss your project</li>
            </ul>
          </div>
          <p className="contact-note">
            If you have any urgent questions, please contact us at:<br/>
            <strong>📧 info@jloperations.com</strong><br/>
            <strong>📞 +1 (555) 123-4567</strong>
          </p>
          <button onClick={handleCloseSuccess} className="close-btn">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="public-lead-form-page">
      <div className="lead-form-container">
        <form onSubmit={handleSubmit} className="lead-form">
          <h2>Get Your Custom Quote</h2>
          <p className="form-subtitle">Tell us about your project and we'll provide you with a detailed quote within 2 working days.</p>
          
          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
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
            <label htmlFor="email">Email Address *</label>
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
              placeholder="Describe your project requirements, dimensions, materials, or any specific details..."
              rows="4"
            />
          </div>

          <div className="form-group">
            <label htmlFor="image">Attach Reference Images (Optional)</label>
            <input
              type="file"
              id="image"
              name="image"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              multiple
              className="file-input"
            />
            <small>Supported formats: JPG, PNG, GIF (Max 5MB each). You can select multiple images.</small>
            
            {isUploading && (
              <div className="uploading-message">
                <p>📤 Uploading images...</p>
              </div>
            )}

            {uploadedImages.length > 0 && (
              <div className="uploaded-images">
                <p>✅ Images uploaded successfully!</p>
                <div className="images-grid">
                  {uploadedImages.map((image, index) => (
                    <div key={index} className="image-item">
                      <img src={image.url} alt={image.name} />
                      <button 
                        type="button" 
                        className="remove-image-btn"
                        onClick={() => removeImage(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="submit-btn"
            disabled={isSubmitting || isUploading}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PublicLeadForm; 