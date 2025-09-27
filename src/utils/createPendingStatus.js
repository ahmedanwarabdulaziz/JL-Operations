import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

export const createPendingStatus = async () => {
  try {
    // Check if pending status already exists
    const statusesRef = collection(db, 'invoiceStatuses');
    const pendingQuery = query(statusesRef, where('value', '==', 'pending'));
    const pendingSnapshot = await getDocs(pendingQuery);
    
    if (!pendingSnapshot.empty) {
      console.log('Pending status already exists');
      return;
    }

    // Get current statuses to determine sort order
    const allStatusesSnapshot = await getDocs(statusesRef);
    const allStatuses = allStatusesSnapshot.docs.map(doc => doc.data());
    const maxSortOrder = Math.max(...allStatuses.map(status => status.sortOrder || 0), 0);

    // Create pending status
    const pendingStatus = {
      label: 'Pending',
      value: 'pending',
      color: '#ff9800',
      description: 'Order postponed by customer - waiting for resume',
      isEndState: true,
      endStateType: 'pending',
      isDefault: false,
      sortOrder: maxSortOrder + 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(statusesRef, pendingStatus);
    console.log('Pending status created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating pending status:', error);
    throw error;
  }
};

// Function to run the script
export const runPendingStatusCreation = async () => {
  try {
    await createPendingStatus();
    console.log('✅ Pending status creation completed successfully');
  } catch (error) {
    console.error('❌ Failed to create pending status:', error);
  }
};
