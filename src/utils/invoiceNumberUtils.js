import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Get the next available customer invoice number considering both customer-invoices and taxed invoices
 * This ensures no gaps in the customer invoice number sequence (like 101660, 101661, etc.)
 */
export const getNextCustomerInvoiceNumber = async () => {
  try {
    // Get all customer invoice numbers from both collections
    const [customerInvoicesSnapshot, taxedInvoicesSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'customer-invoices'), orderBy('invoiceNumber', 'desc'))),
      getDocs(query(collection(db, 'taxedInvoices'), orderBy('invoiceNumber', 'desc')))
    ]);

    // Extract invoice numbers from customer-invoices
    const customerInvoiceNumbers = customerInvoicesSnapshot.docs
      .map(doc => doc.data().invoiceNumber)
      .filter(bill => bill && !isNaN(parseInt(bill)))
      .map(bill => parseInt(bill));

    // Extract invoice numbers from taxed invoices
    const taxedNumbers = taxedInvoicesSnapshot.docs
      .map(doc => doc.data().invoiceNumber)
      .filter(bill => bill && !isNaN(parseInt(bill)))
      .map(bill => parseInt(bill));

    // Combine all numbers and find the maximum
    const allNumbers = [...customerInvoiceNumbers, ...taxedNumbers];
    
    if (allNumbers.length === 0) {
      return '101660'; // Starting number for customer invoices
    }

    const maxNumber = Math.max(...allNumbers, 101659);
    const nextNumber = maxNumber + 1;
    
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
export const validateCustomerInvoiceNumber = async (invoiceNumber) => {
  try {
    const [customerInvoicesSnapshot, taxedInvoicesSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'customer-invoices'), orderBy('invoiceNumber', 'desc'))),
      getDocs(query(collection(db, 'taxedInvoices'), orderBy('invoiceNumber', 'desc')))
    ]);

    // Check customer-invoices collection
    const customerInvoiceNumbers = customerInvoicesSnapshot.docs
      .map(doc => doc.data().invoiceNumber)
      .filter(bill => bill === invoiceNumber);

    // Check taxed invoices collection
    const taxedNumbers = taxedInvoicesSnapshot.docs
      .map(doc => doc.data().invoiceNumber)
      .filter(bill => bill === invoiceNumber);

    // If found in either collection, it's not available
    return customerInvoiceNumbers.length === 0 && taxedNumbers.length === 0;
    
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
    const [customerInvoicesSnapshot, taxedInvoicesSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'customer-invoices'), orderBy('invoiceNumber', 'asc'))),
      getDocs(query(collection(db, 'taxedInvoices'), orderBy('invoiceNumber', 'asc')))
    ]);

    // Get all used customer invoice numbers
    const customerInvoiceNumbers = customerInvoicesSnapshot.docs
      .map(doc => doc.data().invoiceNumber)
      .filter(bill => bill && !isNaN(parseInt(bill)))
      .map(bill => parseInt(bill));

    const taxedNumbers = taxedInvoicesSnapshot.docs
      .map(doc => doc.data().invoiceNumber)
      .filter(bill => bill && !isNaN(parseInt(bill)))
      .map(bill => parseInt(bill));

    const allUsedNumbers = [...new Set([...customerInvoiceNumbers, ...taxedNumbers])].sort((a, b) => a - b);
    
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
