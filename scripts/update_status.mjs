import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCVZ-C2ezeuOhgHtCTQVi234Fhc4ZGX8Qs",
  authDomain: "jl-operation.firebaseapp.com",
  projectId: "jl-operation",
  storageBucket: "jl-operation.firebasestorage.app",
  messagingSenderId: "118256366160",
  appId: "1:118256366160:web:b44f0592501796c0ef1755"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const targetStr = "116229";

async function run() {
  try {
    const collectionsToCheck = ["orders", "corporate-orders", "workshop-allocations", "invoices", "closed-corporate-orders", "archived-orders"];
    let found = false;

    for (const coll of collectionsToCheck) {
      console.log(`Checking collection: ${coll}`);
      const colRef = collection(db, coll);
      const snapshot = await getDocs(colRef);
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const jsonStr = JSON.stringify(data);
        
        if (docSnapshot.id.includes(targetStr) || jsonStr.includes(targetStr)) {
          console.log(`FOUND in ${coll}! Doc ID: ${docSnapshot.id}`);
          console.log(`Current data: ${jsonStr.substring(0, 200)}...`);
          
          found = true;
          
          const updateData = {};
          if (data.status) updateData.status = "inprogress";
          if (data.orderDetails && data.orderDetails.status) {
            updateData["orderDetails.status"] = "inprogress";
          }
          if (Object.keys(updateData).length === 0) {
            updateData.status = "inprogress"; // Default
          }
          
          await updateDoc(doc(db, coll, docSnapshot.id), updateData);
          console.log(`Updated status to inprogress successfully.`);
        }
      }
    }
    
    if (!found) {
      console.log(`Could not find any document containing ${targetStr}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
