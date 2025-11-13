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

const getAllInvoiceNumbers = async () => {
  const [customerInvoicesSnapshot, corporateOrdersSnapshot] = await Promise.all([
    fetchAllDocs('customer-invoices'),
    fetchAllDocs('corporate-orders')
  ]);

  return [
    ...extractInvoiceNumbers(customerInvoicesSnapshot),
    ...extractCorporateBillInvoices(corporateOrdersSnapshot)
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
