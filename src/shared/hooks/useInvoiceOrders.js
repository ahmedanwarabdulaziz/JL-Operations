import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase/config';

const mapOrdersSnapshot = (snapshot) =>
  snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

const extractExcludedStatuses = (statuses) => {
  if (!Array.isArray(statuses)) {
    return [];
  }

  return statuses
    .filter(
      (status) =>
        status?.isEndState && (status?.endStateType === 'cancelled' || status?.endStateType === 'pending')
    )
    .map((status) => status?.value)
    .filter(Boolean);
};

export const useInvoiceOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load orders sorted by most recent
      const ordersCollection = collection(db, 'orders');
      const ordersQuery = query(ordersCollection, orderBy('createdAt', 'desc'));
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = mapOrdersSnapshot(ordersSnapshot);

      // Load invoice statuses to determine which orders to exclude
      const statusesSnapshot = await getDocs(collection(db, 'invoiceStatuses'));
      const statusesData = mapOrdersSnapshot(statusesSnapshot);
      const excludedStatuses = extractExcludedStatuses(statusesData);

      const activeOrders = ordersData.filter((order) => {
        if (!order?.invoiceStatus) {
          return true;
        }

        return !excludedStatuses.includes(order.invoiceStatus);
      });

      setOrders(activeOrders);
    } catch (err) {
      console.error('Failed to fetch invoice orders', err);
      setError(err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const refresh = useCallback(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    refresh
  };
};

export default useInvoiceOrders;

