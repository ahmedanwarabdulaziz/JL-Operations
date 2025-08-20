// Completion Email Template for JL Upholstery
// This template is used when an order is completed and marked as "Done"

export const generateCompletionEmailTemplate = async (orderData, includeReviewRequest = true) => {
  const customerName = orderData.personalInfo?.customerName || 'Valued Customer';
  const orderNumber = orderData.orderDetails?.billInvoice || 'N/A';
  const customerEmail = orderData.personalInfo?.email || '';
  const currentYear = new Date().getFullYear();
  
  console.log('🔍 Completion Email Debug - Order Data:', orderData);
  console.log('🔍 Completion Email Debug - Furniture Data:', orderData.furnitureData);
  console.log('🔍 Completion Email Debug - Furniture Groups:', orderData.furnitureData?.groups);
  
  // Extract unique treatments from furniture groups
  const furnitureTreatments = []; // Array to store furniture treatment objects
  
  if (orderData.furnitureData?.groups) {
    console.log('🔍 Completion Email Debug - Processing furniture groups...');
    orderData.furnitureData.groups.forEach((group, index) => {
      console.log(`🔍 Completion Email Debug - Group ${index}:`, group);
      console.log(`🔍 Completion Email Debug - Group ${index} materialCompany:`, group.materialCompany);
      console.log(`🔍 Completion Email Debug - Group ${index} furnitureType:`, group.furnitureType);
      console.log(`🔍 Completion Email Debug - Group ${index} all fields:`, Object.keys(group));
      
      // Show all field values for debugging
      Object.keys(group).forEach(field => {
        console.log(`🔍 Completion Email Debug - Group ${index} ${field}:`, group[field]);
      });
      
      // Check if material company exists
      const materialCompany = group.materialCompany;
      const furnitureType = group.furnitureType || `Furniture Item ${index + 1}`;
      
      console.log(`🔍 Completion Email Debug - Group ${index} - Material Company: ${materialCompany}, Furniture Type: ${furnitureType}`);
      
      if (materialCompany && materialCompany.trim() !== '') {
        furnitureTreatments.push({
          materialCompany: materialCompany,
          furnitureType: furnitureType
        });
        console.log(`🔍 Completion Email Debug - Added furniture with material company: ${materialCompany} for ${furnitureType}`);
      } else {
        console.log(`🔍 Completion Email Debug - No material company found in group ${index}`);
      }
    });
  } else {
    console.log('🔍 Completion Email Debug - No furniture groups found');
  }
  
  console.log('🔍 Completion Email Debug - Final furniture treatments array:', furnitureTreatments);

  // Get treatment links from database based on material companies
  const treatmentLinks = await getTreatmentLinksByMaterialCompany(furnitureTreatments);
  console.log('🔍 Completion Email Debug - Treatment links result:', treatmentLinks);

  // Group furniture by treatment to merge duplicates
  const groupedTreatments = {};
  
  furnitureTreatments.forEach(furnitureTreatment => {
    const treatmentLink = treatmentLinks[furnitureTreatment.materialCompany];
    const treatmentKey = treatmentLink ? treatmentLink.treatmentKind : 'no-treatment';
    
    if (!groupedTreatments[treatmentKey]) {
      groupedTreatments[treatmentKey] = {
        treatmentKind: treatmentLink ? treatmentLink.treatmentKind : 'Care Instructions',
        url: treatmentLink ? treatmentLink.url : null,
        materialCompanies: new Set(), // Use Set to avoid duplicates
        furnitureTypes: []
      };
    }
    
    // Add material company if not already present (using Set for automatic deduplication)
    groupedTreatments[treatmentKey].materialCompanies.add(furnitureTreatment.materialCompany);
    
    // Add furniture type
    groupedTreatments[treatmentKey].furnitureTypes.push(furnitureTreatment.furnitureType);
  });
  
  // Convert Sets back to arrays for easier template processing
  Object.keys(groupedTreatments).forEach(treatmentKey => {
    groupedTreatments[treatmentKey].materialCompanies = Array.from(groupedTreatments[treatmentKey].materialCompanies);
  });
  
  console.log('🔍 Completion Email Debug - Grouped treatments:', groupedTreatments);

  // Google Review Link (you can customize this)
  const googleReviewLink = "https://g.page/r/CeufI7yS3kV5EAE/review";

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thank You - JL Upholstery</title>
        <style>
            body { margin:0; padding:0; -webkit-font-smoothing:antialiased; width:100%!important; background-color:#f4f4f4; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:16px; line-height:1.6; color:#333; }
            .email-wrapper { width:100%; background-color:#f4f4f4; padding:20px 0; }
            .email-container { width:90%; max-width:680px; margin:0 auto; background-color:#fff; border-radius:8px; overflow:hidden; border:1px solid #ddd; }
            .email-header { background-color:#1A1A1A; color:#DAA520; padding:25px; text-align:center; }
            .email-header h1 { margin:0; font-size:24px; font-weight:bold; }
            .email-body { padding:25px 30px; }
            .greeting { font-size:17px; margin-bottom:20px; }
            .completion-summary-header { display:table; width:100%; margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid #eee; }
            .completion-summary-title { display:table-cell; font-size:18px; font-weight:bold; color:#DAA520; vertical-align:middle; }
            .order-number { display:table-cell; font-size:16px; color:#DAA520; text-align:right; vertical-align:middle; font-weight:bold; }
            .treatment-item { background-color: #f9f9f9; border: 1px solid #e9e9e9; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
            .treatment-item h4 { font-size: 16px; color: #1A1A1A; margin-top: 0; margin-bottom: 12px; font-weight:bold; }
            .treatment-item p { margin-bottom: 8px; font-size: 14px; color: #444; line-height: 1.5; }
            .treatment-item strong { color: #222; font-weight: 600; }
            .treatment-link { color: #DAA520; text-decoration: none; font-weight: 600; }
            .treatment-link:hover { text-decoration: underline; }
            .review-section { background-color:#2C2C2C; color:#F0F0F0; padding:20px 30px; margin-top:25px; border-radius: 5px; }
            .review-section h3 { font-size:18px; color:#DAA520; margin-top:0; margin-bottom:15px; text-align:left; border-bottom: 1px solid #444; padding-bottom: 8px;}
            .review-section p { margin-bottom:10px; font-size:14px; }
            .review-button { display: inline-block; background-color:#DAA520; color:#1A1A1A; text-decoration: none; padding:12px 25px; border-radius: 4px; font-weight:bold; margin-top:15px; font-size:14px; }
            .review-button:hover { background-color:#B8860B; }
            .highlight-note { background-color:#fffaf0; border-left:4px solid #DAA520; padding:15px; margin:25px 0; font-size:14px; color: #555;}
            .highlight-note strong { color: #333; }
            .closing { margin-top:25px; font-size:14px; }
            .signature { font-weight:bold; color:#1A1A1A; font-size:14px; }
            .email-footer { background-color:#333; color:#bbb; padding:20px; text-align:center; font-size:12px; border-top: 1px solid #444;}
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="email-container">
                <div class="email-header"><h1>Order Completion - Thank You!</h1></div>
                <div class="email-body">
                    <p class="greeting">Dear ${customerName},</p>
                    <p>We are delighted to inform you that your order has been <strong>successfully completed</strong>! It has been our pleasure to work on your furniture and bring your vision to life.</p>
                    
                    <div class="completion-summary-header">
                        <span class="completion-summary-title">Order Summary</span>
                        <span class="order-number">Order #${orderNumber}</span>
                    </div>

                    <p>Your order has been completed with the highest standards of quality and craftsmanship. We hope you are completely satisfied with the results. Your furniture has been carefully crafted and treated to ensure it will provide you with years of comfort and beauty.</p>

                    ${Object.keys(groupedTreatments).length > 0 ? `
                    <div style="margin: 25px 0;">
                        <h3 style="color: #DAA520; margin-bottom: 15px; font-size: 18px;">Care Instructions for Your Treated Furniture</h3>
                        <p style="margin-bottom: 15px; font-size: 14px; color: #444;">To help you maintain the beauty and longevity of your furniture, please follow the care instructions below for each treated piece:</p>
                        
                        ${Object.entries(groupedTreatments).map(([treatmentKey, treatmentData]) => {
                            const treatmentLink = treatmentData.url;
                            const materialCompanies = treatmentData.materialCompanies.join(', ');
                            const furnitureTypes = treatmentData.furnitureTypes.join(', ');
                            
                            console.log(`🔍 Email Template Debug - Processing treatment: ${materialCompanies}, Link: ${treatmentLink}, Treatment Kind: ${treatmentData.treatmentKind}`);
                            
                            // Create a more natural description for furniture types
                            const furnitureDescription = treatmentData.furnitureTypes.length === 1 
                                ? treatmentData.furnitureTypes[0].toLowerCase()
                                : treatmentData.furnitureTypes.slice(0, -1).join(', ').toLowerCase() + ' and ' + treatmentData.furnitureTypes[treatmentData.furnitureTypes.length - 1].toLowerCase();
                            
                            return `
                                <div class="treatment-item">
                                    <h4>${treatmentData.treatmentKind}</h4>
                                    <p style="margin-bottom: 12px; font-size: 14px; color: #444;">
                                        For your ${furnitureDescription}, please follow the care and treatment instructions in the link below to maintain its beauty and durability.
                                    </p>
                                    ${treatmentLink ? 
                                        `<a href="${treatmentLink}" target="_blank" class="treatment-link">View Care Instructions for ${treatmentData.treatmentKind} →</a>` :
                                        `<span style="color: #999999; font-style: italic;">Care instructions link not available</span>`
                                    }
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ` : `
                    <div style="margin: 25px 0;">
                        <h3 style="color: #DAA520; margin-bottom: 15px; font-size: 18px;">Care Instructions for Your Treated Furniture</h3>
                        <p style="margin-bottom: 15px; font-size: 14px; color: #444;">No furniture treatments were found in this order.</p>
                        <div class="treatment-item">
                            <h4>Debug Information</h4>
                            <p style="margin-bottom: 12px; font-size: 14px; color: #444;">
                                <strong>Furniture Treatments Found:</strong> ${Object.keys(groupedTreatments).length}<br>
                                <strong>Treatment Links Found:</strong> ${Object.keys(treatmentLinks).length}<br>
                                <strong>Furniture Groups:</strong> ${orderData.furnitureData?.groups?.length || 0}
                            </p>
                        </div>
                    </div>
                    `}

                    ${includeReviewRequest ? `
                    <div class="review-section">
                        <h3>We'd Love to Hear from You!</h3>
                        <p>Your satisfaction is our top priority. If you're happy with our work, we would be incredibly grateful if you could take a moment to share your experience.</p>
                        <p>Your review helps other customers discover our services and motivates our team to continue delivering exceptional quality.</p>
                        <a href="${googleReviewLink}" target="_blank" class="review-button">
                            ✨ Leave Us a Review ✨
                        </a>
                    </div>
                    ` : ''}

                    <div class="highlight-note">
                        <p><strong>Thank you for choosing JL Upholstery for your furniture needs.</strong></p>
                        <p><strong>We truly appreciate your business and look forward to serving you again in the future.</strong></p>
                    </div>
                    
                    <p class="closing">If you have any questions about your order, please don't hesitate to contact us. ❓</p>
                    <p>Sincerely,</p>
                    <p class="signature">JL Upholstery Team</p>
                </div>
                <div class="email-footer">
                    <p>&copy; ${currentYear} JL Upholstery. All Rights Reserved.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;

  return htmlContent;
};

// Function to get treatment links from the database based on material companies
export const getTreatmentLinksByMaterialCompany = async (furnitureTreatments) => {
  try {
    // Extract unique material companies
    const materialCompaniesArray = furnitureTreatments.map(t => t.materialCompany);
    
    // If no treatments, return empty object immediately
    if (materialCompaniesArray.length === 0) {
      console.log('🔍 Treatment Debug - No treatments found, skipping database query');
      return {};
    }
    
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const { db } = await import('../firebase/config');
    
    console.log('🔍 Treatment Debug - Fetching treatment links for material companies:', materialCompaniesArray);
    
    // Query treatments collection - we need to check if any of our material companies are in the materialCompanies array
    const treatmentsRef = collection(db, 'treatments');
    const treatmentsSnapshot = await getDocs(treatmentsRef);
    
    const treatmentLinks = {};
    
    // First, build a map of material companies to their treatments
    const materialToTreatmentMap = {};
    
    treatmentsSnapshot.docs.forEach(doc => {
      const treatment = doc.data();
      console.log('🔍 Treatment Debug - Found treatment document:', treatment);
      
      // Check if this treatment has a URL link and if any of our material companies are in its materialCompanies array
      if (treatment.urlPageLink && treatment.materialCompanies && Array.isArray(treatment.materialCompanies)) {
        // Map each material company to this treatment
        treatment.materialCompanies.forEach(materialCompany => {
          if (materialCompaniesArray.includes(materialCompany)) {
            materialToTreatmentMap[materialCompany] = {
              url: treatment.urlPageLink,
              treatmentKind: treatment.treatmentKind
            };
            console.log(`🔍 Treatment Debug - Mapped material company ${materialCompany} to treatment ${treatment.treatmentKind}`);
          }
        });
      }
    });
    
    // Now assign treatment links to each furniture treatment
    furnitureTreatments.forEach(furnitureTreatment => {
      const treatment = materialToTreatmentMap[furnitureTreatment.materialCompany];
      if (treatment) {
        treatmentLinks[furnitureTreatment.materialCompany] = treatment;
        console.log(`🔍 Treatment Debug - Assigned ${treatment.treatmentKind} to ${furnitureTreatment.furnitureType} (${furnitureTreatment.materialCompany})`);
      } else {
        console.log(`🔍 Treatment Debug - No treatment found for ${furnitureTreatment.materialCompany}`);
      }
    });
    
    console.log('🔍 Treatment Debug - Final treatment links:', treatmentLinks);
    return treatmentLinks;
  } catch (error) {
    console.error('Error fetching treatment links by material company:', error);
    return {};
  }
};