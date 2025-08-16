// EmailJS Configuration
// Sign up at https://www.emailjs.com/ and get these values

export const EMAILJS_CONFIG = {
  // Replace these with your actual EmailJS credentials
  SERVICE_ID: 'YOUR_SERVICE_ID', // Your EmailJS service ID
  TEMPLATE_ID: 'YOUR_TEMPLATE_ID', // Your EmailJS template ID
  PUBLIC_KEY: 'YOUR_PUBLIC_KEY', // Your EmailJS public key
  
  // Email settings
  FROM_NAME: 'JL Upholstery',
  FROM_EMAIL: 'jlupholstery@jloperation.com',
  DEFAULT_SUBJECT: 'Test Email from JL Upholstery',
  DEFAULT_MESSAGE: 'This is a test email to verify the email functionality is working properly.\n\nBest regards,\nJL Upholstery Team'
};

// Template parameters that will be sent to EmailJS
export const getTemplateParams = (toEmail, subject, message) => ({
  to_email: toEmail,
  from_name: EMAILJS_CONFIG.FROM_NAME,
  from_email: EMAILJS_CONFIG.FROM_EMAIL,
  subject: subject,
  message: message,
}); 