import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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
    const docRef = doc(db, "orders", "rxaIcfjnIYTXE2z44f6F");
    const snap = await getDoc(docRef);
    if(snap.exists()) {
      const data = snap.data();
      console.log(`CURRENT DOC: invoiceStatus: ${data.invoiceStatus}, status: ${data.status}`);
      console.log(`billInvoice: ${data.orderDetails?.billInvoice || data.billInvoice}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
