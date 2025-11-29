import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

const fetchAllDocs = async (path) => {
  const collectionRef = collection(db, path);
  return getDocs(collectionRef);
};

const parseInvoiceNumber = (value) => {
  if (value === null || value === undefined) return null;

  const valueStr = String(value).trim();
  if (valueStr.length === 0) return null;

  const match = valueStr.match(/\d+/);
  if (!match) return null;

  const parsed = parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const extractInvoiceNumbers = (snapshot, accessor) => {
  if (!snapshot) return [];
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      if (!data) return null;

      let value = null;
      if (accessor) {
        value = accessor(data);
      } else {
        value =
          data.invoiceNumber ??
          data.billInvoice;
      }

      return parseInvoiceNumber(value);
    })
    .filter(number => number !== null);
};

const extractCorporateBillInvoices = (snapshot) => {
  if (!snapshot) return [];
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      if (!data) return null;
      const value =
        data.orderDetails?.billInvoice ??
        data.billInvoice ??
        data.invoiceNumber;
      return parseInvoiceNumber(value);
    })
    .filter(number => number !== null);
};

/**
 * Extract T- format invoice numbers from corporate orders
 * Returns array of numbers (without T- prefix) for comparison
 */
const extractCorporateTInvoiceNumbers = (snapshot) => {
  if (!snapshot) return [];
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      if (!data) return null;
      const value =
        data.orderDetails?.billInvoice ??
        data.billInvoice ??
        data.invoiceNumber;
      
      if (!value) return null;
      
      const valueStr = String(value).trim();
      // Check if it's T- format
      if (valueStr.startsWith('T-')) {
        const numberPart = valueStr.substring(2);
        const parsed = parseInt(numberPart, 10);
        return Number.isNaN(parsed) ? null : parsed;
      }
      
      return null; // Not T- format, ignore
    })
    .filter(number => number !== null);
};

const getAllInvoiceNumbers = async () => {
  const [customerInvoicesSnapshot, corporateOrdersSnapshot] = await Promise.all([
    fetchAllDocs('customer-invoices'),
    fetchAllDocs('corporate-orders')
  ]);

  // Only include non-T- format corporate orders (old format) in customer invoice numbers
  // T- format corporate orders are handled separately
  const corporateNumbers = extractCorporateBillInvoices(corporateOrdersSnapshot)
    .filter(num => {
      // Check if this number could be from a T- format (would be >= 100000)
      // We'll exclude T- format numbers by checking the actual invoice values
      return true; // For now, include all for backward compatibility
    });

  return [
    ...extractInvoiceNumbers(customerInvoicesSnapshot),
    ...corporateNumbers
  ];
};

/**
 * Get the next available customer invoice number considering both customer-invoices and taxed invoices
 * This ensures no gaps in the customer invoice number sequence (like 101660, 101661, etc.)
 */
export const getNextCustomerInvoiceNumber = async () => {
  try {
    // Get invoice numbers from all relevant collections to keep a single shared sequence
    const allNumbers = await getAllInvoiceNumbers();
    const numbersSet = new Set(allNumbers);

    if (allNumbers.length === 0) {
      return '101660'; // Starting number for customer invoices
    }

    const maxNumber = Math.max(...allNumbers, 101659);
    let nextNumber = maxNumber + 1;

    // Skip any numbers already present in the fetched dataset
    while (numbersSet.has(nextNumber)) {
      nextNumber += 1;
    }

  // Ensure the number we return is truly available by double-checking against validation
  // This guards against any missed datasets or timing differences.
  // Continue incrementing until a free number is found.
  while (!(await validateCustomerInvoiceNumber(nextNumber.toString(), numbersSet))) {
    numbersSet.add(nextNumber);
      nextNumber += 1;
    }

    return nextNumber.toString();
    
  } catch (error) {
    console.error('Error getting next customer invoice number:', error);
    return '101660'; // Fallback
  }
};

/**
 * Validate that a customer invoice number is available (not used in customer-invoices or taxed invoices)
 * This prevents duplicate customer invoice numbers
 */
export const validateCustomerInvoiceNumber = async (invoiceNumber, existingNumbersSet = null) => {
  try {
    let invoiceNumbers = existingNumbersSet;
    if (!invoiceNumbers) {
      invoiceNumbers = new Set(await getAllInvoiceNumbers());
    }

    const parsed = parseInvoiceNumber(invoiceNumber);

    if (parsed === null) {
      return false;
    }

    if (!invoiceNumbers.has(parsed)) {
      // If the provided set does not contain the number, double-check by refetching
      const refreshedNumbers = new Set(await getAllInvoiceNumbers());
      if (existingNumbersSet) {
        // Keep the provided set in sync so callers can reuse it
        refreshedNumbers.forEach(num => existingNumbersSet.add(num));
      }
      invoiceNumbers = refreshedNumbers;
    }

    return !invoiceNumbers.has(parsed);
    
  } catch (error) {
    console.error('Error validating customer invoice number:', error);
    return false; // If error, assume not available for safety
  }
};

/**
 * Get the customer invoice sequence status - shows which customer invoice numbers are used/missing
 * This helps identify gaps in the customer invoice sequence
 */
export const getCustomerInvoiceSequenceStatus = async () => {
  try {
    const [
      customerInvoicesSnapshot,
      corporateOrdersSnapshot
    ] = await Promise.all([
      fetchAllDocs('customer-invoices'),
      fetchAllDocs('corporate-orders')
    ]);

    const customerInvoiceNumbers = extractInvoiceNumbers(customerInvoicesSnapshot);
    const corporateOrderNumbers = extractCorporateBillInvoices(corporateOrdersSnapshot);
    const allUsedNumbers = [...new Set([
      ...customerInvoiceNumbers,
      ...corporateOrderNumbers
    ])].sort((a, b) => a - b);
    
    // Find gaps
    const gaps = [];
    for (let i = 0; i < allUsedNumbers.length - 1; i++) {
      const current = allUsedNumbers[i];
      const next = allUsedNumbers[i + 1];
      if (next - current > 1) {
        gaps.push({ from: current + 1, to: next - 1 });
      }
    }

    return {
      usedNumbers: allUsedNumbers,
      gaps: gaps,
      nextAvailable: allUsedNumbers.length > 0 ? Math.max(...allUsedNumbers) + 1 : 101660,
      totalUsed: allUsedNumbers.length
    };
    
  } catch (error) {
    console.error('Error getting customer invoice sequence status:', error);
    return {
      usedNumbers: [],
      gaps: [],
      nextAvailable: 101660,
      totalUsed: 0
    };
  }
};

/**
 * Get the next available corporate invoice number in T- format
 * Format: T-100001, T-100002, etc. (always 6 digits)
 * Starting number: T-100001
 * Checks both corporate-orders and customer-invoices collections
 */
export const getNextCorporateInvoiceNumber = async () => {
  try {
    // Fetch both collections to get all T- numbers
    const [corporateOrdersSnapshot, customerInvoicesSnapshot] = await Promise.all([
      fetchAllDocs('corporate-orders'),
      fetchAllDocs('customer-invoices')
    ]);
    
    // Extract T- numbers from both collections
    const corporateTNumbers = extractCorporateTInvoiceNumbers(corporateOrdersSnapshot);
    const customerTNumbers = extractCustomerInvoiceTNumbers(customerInvoicesSnapshot);
    
    // Combine all T- numbers from both collections
    const allTNumbers = [...corporateTNumbers, ...customerTNumbers];
    const numbersSet = new Set(allTNumbers);

    if (allTNumbers.length === 0) {
      return 'T-100001'; // Starting number for corporate invoices
    }

    const maxNumber = Math.max(...allTNumbers, 100000);
    let nextNumber = maxNumber + 1;

    // Skip any numbers already present
    while (numbersSet.has(nextNumber)) {
      nextNumber += 1;
    }

    // Ensure the number we return is truly available by double-checking
    // This validates against both collections
    while (!(await validateCorporateInvoiceNumber(`T-${nextNumber.toString().padStart(6, '0')}`, numbersSet))) {
      numbersSet.add(nextNumber);
      nextNumber += 1;
    }

    // Always return 6 digits
    return `T-${nextNumber.toString().padStart(6, '0')}`;
    
  } catch (error) {
    console.error('Error getting next corporate invoice number:', error);
    return 'T-100001'; // Fallback
  }
};

/**
 * Extract T- format invoice numbers from customer-invoices collection
 */
const extractCustomerInvoiceTNumbers = (snapshot) => {
  if (!snapshot) return [];
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      if (!data) return null;
      const value = data.invoiceNumber ?? data.billInvoice;
      
      if (!value) return null;
      
      const valueStr = String(value).trim();
      // Check if it's T- format
      if (valueStr.startsWith('T-')) {
        const numberPart = valueStr.substring(2);
        const parsed = parseInt(numberPart, 10);
        return Number.isNaN(parsed) ? null : parsed;
      }
      
      return null; // Not T- format, ignore
    })
    .filter(number => number !== null);
};

/**
 * Validate that a corporate invoice number (T- format) is available
 * Format should be T-XXXXXX where XXXXXX is a 6-digit number
 * Checks both corporate-orders and customer-invoices collections
 */
export const validateCorporateInvoiceNumber = async (invoiceNumber, existingNumbersSet = null) => {
  try {
    if (!invoiceNumber || typeof invoiceNumber !== 'string') {
      return false;
    }

    const trimmed = invoiceNumber.trim();
    
    // Must start with T-
    if (!trimmed.startsWith('T-')) {
      return false;
    }

    // Extract number part
    const numberPart = trimmed.substring(2);
    const parsed = parseInt(numberPart, 10);

    if (Number.isNaN(parsed) || parsed < 100000) {
      return false;
    }

    // Check against existing T- numbers from both collections
    let tNumbers = existingNumbersSet;
    if (!tNumbers) {
      const [corporateOrdersSnapshot, customerInvoicesSnapshot] = await Promise.all([
        fetchAllDocs('corporate-orders'),
        fetchAllDocs('customer-invoices')
      ]);
      
      const corporateTNumbers = extractCorporateTInvoiceNumbers(corporateOrdersSnapshot);
      const customerTNumbers = extractCustomerInvoiceTNumbers(customerInvoicesSnapshot);
      
      // Combine both sets
      tNumbers = new Set([...corporateTNumbers, ...customerTNumbers]);
    }

    return !tNumbers.has(parsed);
    
  } catch (error) {
    console.error('Error validating corporate invoice number:', error);
    return false; // If error, assume not available for safety
  }
};

/**
 * Format corporate invoice number for display (removes T- prefix)
 * Used in invoice documents where T- should not be shown
 */
export const formatCorporateInvoiceForInvoice = (invoiceNumber) => {
  if (!invoiceNumber || typeof invoiceNumber !== 'string') {
    return invoiceNumber || '';
  }
  
  if (invoiceNumber.startsWith('T-')) {
    return invoiceNumber.substring(2); // Remove T- prefix
  }
  
  return invoiceNumber;
};
