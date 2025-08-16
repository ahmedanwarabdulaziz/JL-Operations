import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Fetch all material companies and their tax rates from Firestore
 * @returns {Promise<Object>} Object with company names as keys and tax rates as values
 */
export const fetchMaterialCompanyTaxRates = async () => {
  try {
    const companiesRef = collection(db, 'materialCompanies');
    const q = query(companiesRef, orderBy('createdAt', 'asc'));
    const querySnapshot = await getDocs(q);
    
    const taxRates = {};
    querySnapshot.docs.forEach(doc => {
      const companyData = doc.data();
      const companyName = companyData.name?.toLowerCase().trim();
      const taxRate = parseFloat(companyData.taxRate) || 13; // Default to 13% if not specified
      
      if (companyName) {
        taxRates[companyName] = taxRate / 100; // Convert percentage to decimal
      }
    });
    
    return taxRates;
  } catch (error) {
    console.error('Error fetching material company tax rates:', error);
    // Return default tax rates if fetch fails
    return {
      'charlotte': 0.02, // 2% for Charlotte
      'default': 0.13    // 13% default
    };
  }
};

/**
 * Get tax rate for a specific material company
 * @param {string} companyName - The material company name
 * @param {Object} taxRates - Object containing company tax rates
 * @returns {number} Tax rate as decimal (e.g., 0.13 for 13%)
 */
export const getMaterialCompanyTaxRate = (companyName, taxRates = {}) => {
  if (!companyName) {
    return 0.13; // Default 13%
  }
  
  const normalizedCompanyName = companyName.toLowerCase().trim();
  
  // Check for exact match first
  if (taxRates[normalizedCompanyName] !== undefined) {
    return taxRates[normalizedCompanyName];
  }
  
  // Check for partial matches (e.g., "charlotte" in "charlotte fabrics")
  for (const [company, rate] of Object.entries(taxRates)) {
    if (normalizedCompanyName.includes(company) || company.includes(normalizedCompanyName)) {
      return rate;
    }
  }
  
  // Return default rate if no match found
  return taxRates.default || 0.13;
}; 