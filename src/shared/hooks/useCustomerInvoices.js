import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase/config';

const sortInvoicesByNumber = (invoices) => {
  return [...invoices].sort((a, b) => {
    const invoiceA = parseInt(a.invoiceNumber || '0', 10);
    const invoiceB = parseInt(b.invoiceNumber || '0', 10);
    return invoiceB - invoiceA;
  });
};

export const useCustomerInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const invoicesCollection = collection(db, 'customer-invoices');
      const invoicesQuery = query(invoicesCollection, orderBy('invoiceNumber', 'desc'));
      const snapshot = await getDocs(invoicesQuery);

      const invoicesData = snapshot.docs.map((invoiceDoc) => ({
        id: invoiceDoc.id,
        ...invoiceDoc.data()
      }));

      const invoicesWithOrderNumber = await Promise.all(
        invoicesData.map(async (invoice) => {
          if (invoice.originalOrderNumber || !invoice.originalOrderId) {
            return invoice;
          }

          try {
            const orderDoc = await getDoc(doc(collection(db, 'orders'), invoice.originalOrderId));
            if (orderDoc.exists()) {
              const orderData = orderDoc.data();
              return {
                ...invoice,
                originalOrderNumber: orderData.orderDetails?.billInvoice || 'N/A'
              };
            }
          } catch (orderError) {
            console.error('Failed to fetch order for invoice', invoice.id, orderError);
          }

          return invoice;
        })
      );

      setInvoices(sortInvoicesByNumber(invoicesWithOrderNumber));
    } catch (err) {
      console.error('Failed to fetch customer invoices', err);
      setError(err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const refresh = useCallback(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return {
    invoices,
    loading,
    error,
    refresh
  };
};

export default useCustomerInvoices;

