import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, query, limit } from "firebase/firestore";

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

async function run() {
  try {
    const ordersRef = collection(db, "orders");
    const snapshot = await getDocs(query(ordersRef, limit(5)));
    
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      console.log(`Order ${docSnapshot.id}: status=${data.status}, invoiceStatus=${data.invoiceStatus}, orderDetails.status=${data.orderDetails?.status}`);
    }
    
    // Also log the 116229 order specifically
    const docRef = doc(db, "orders", "rxaIcfjnIYTXE2z44f6F");
    const myDoc = await getDocs(query(ordersRef));
    const targetDoc = myDoc.docs.find(d => d.id === "rxaIcfjnIYTXE2z44f6F");
    if(targetDoc) {
      console.log("----------------------");
      console.log("TARGET DOC:");
      const t = targetDoc.data();
      console.log(`invoiceStatus: ${t.invoiceStatus}, status: ${t.status}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
