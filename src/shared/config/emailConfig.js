// Gmail API Configuration
// The app uses Gmail API with Google Identity Services for sending emails
// Configuration is handled in src/config/gmail.js

// Business information for emails
export const BUSINESS_CONFIG = {
  NAME: 'JL Upholstery',
  EMAIL: 'jl.upholstery@gmail.com',
  PAYMENT_EMAIL: 'jl.upholstery@gmail.com',
  SIGNATURE: 'JL Upholstery Team'
};

// Email template variables that will be available in your EmailJS template
export const EMAIL_TEMPLATE_VARIABLES = {
  // These variables will be passed to your EmailJS template
  to_email: '', // Customer's email address
  to_name: '', // Customer's name
  message_html: '', // The complete HTML email content
  subject: '' // Email subject line
}; 