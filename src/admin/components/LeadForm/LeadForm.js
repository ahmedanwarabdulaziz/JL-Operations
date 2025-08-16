import React, { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../shared/firebase/config';
import { uploadImageToImgBB } from '../shared/config/imgbb';
import './LeadForm.css';

const LeadForm = () => {
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    description: '',
    imageUrls: [] // Changed from imageUrl to imageUrls array
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadedImages, setUploadedImages] = useState([]); // Track uploaded images
  const [isUploading, setIsUploading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
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
      console.log('Form data before submission:', formData); // Debug log
      
      const leadData = {
        ...formData,
        timestamp: serverTimestamp(),
        status: 'new',
        createdAt: serverTimestamp()
      };

      console.log('Lead data to be sent to Firebase:', leadData); // Debug log
      await addDoc(collection(db, 'leads'), leadData);
      
      setShowSuccess(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        description: '',
        imageUrls: []
      });
      
      // Clear uploaded images display
      setUploadedImages([]);
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Hide success message after 5 seconds
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
          <label htmlFor="image">Attach Images (Optional)</label>
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
  );
};

export default LeadForm; 
