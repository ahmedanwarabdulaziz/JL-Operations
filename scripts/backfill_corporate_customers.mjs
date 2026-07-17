/**
 * One-off backfill: create missing corporateCustomers documents for
 * corporate-orders that reference a customer that was never saved to the
 * corporateCustomers collection (this happened for orders created by
 * converting a Corporate Quote that used a temporary "quote customer",
 * before that flow was fixed to promote the customer on submit).
 *
 * For every corporate-orders doc whose corporateCustomer.id does not exist
 * in corporateCustomers, this script:
 *   1. Groups affected orders by customer (by corporateCustomer.id when
 *      present, otherwise by normalized corporateName+email) so the same
 *      customer isn't created twice.
 *   2. Creates one corporateCustomers document per group, merging in every
 *      distinct contact person seen across that group's orders.
 *   3. Updates each order's corporateCustomer.id / contactPerson.id to
 *      point at the newly created document.
 *
 * Usage:
 *   node scripts/backfill_corporate_customers.mjs          # dry run (default) — prints the plan, writes nothing
 *   node scripts/backfill_corporate_customers.mjs --apply   # actually writes to Firestore
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, addDoc, updateDoc } from "firebase/firestore";

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

const APPLY = process.argv.includes("--apply");

const normalize = (s) => (s || "").trim().toLowerCase();

async function run() {
  console.log(APPLY ? "Running in APPLY mode — Firestore will be written to." : "Running in DRY-RUN mode — no writes will be made (pass --apply to write).");

  const [customersSnap, ordersSnap] = await Promise.all([
    getDocs(collection(db, "corporateCustomers")),
    getDocs(collection(db, "corporate-orders")),
  ]);

  const existingCustomerIds = new Set(customersSnap.docs.map((d) => d.id));
  const orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const orphaned = orders.filter(
    (o) => !o.corporateCustomer?.id || !existingCustomerIds.has(o.corporateCustomer.id)
  );

  console.log(`Found ${orders.length} corporate-orders, ${orphaned.length} reference a missing corporateCustomers document.`);

  if (orphaned.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  // Group orphaned orders by customer identity.
  const groups = new Map(); // key -> { orders: [], corporateCustomer, contactPersons: Map<id-or-key, contact> }

  for (const order of orphaned) {
    const cust = order.corporateCustomer || {};
    const key = cust.id || `${normalize(cust.corporateName)}|${normalize(cust.email)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        orders: [],
        corporateCustomer: cust,
        contactPersons: new Map(),
      });
    }
    const group = groups.get(key);
    group.orders.push(order);

    const contact = order.contactPerson;
    if (contact) {
      const contactKey = contact.id || `${normalize(contact.name)}|${normalize(contact.email)}|${normalize(contact.phone)}`;
      if (!group.contactPersons.has(contactKey)) {
        group.contactPersons.set(contactKey, contact);
      }
    }
  }

  console.log(`These ${orphaned.length} orders belong to ${groups.size} distinct customer(s):\n`);

  let created = 0;
  let updated = 0;

  for (const [key, group] of groups) {
    const cust = group.corporateCustomer;
    const contactPersons = Array.from(group.contactPersons.values()).map((c, i) => ({
      id: c.id || `${Date.now()}${i}`,
      name: c.name || "",
      email: c.email || "",
      phone: c.phone || "",
      position: c.position || "",
    }));

    console.log(`- "${cust.corporateName || "(no name)"}" (key: ${key})`);
    console.log(`    orders: ${group.orders.map((o) => o.orderDetails?.billInvoice || o.id).join(", ")}`);
    console.log(`    contacts: ${contactPersons.map((c) => c.name).join(", ") || "(none)"}`);

    if (!APPLY) {
      continue;
    }

    const newCustomerRef = await addDoc(collection(db, "corporateCustomers"), {
      corporateName: cust.corporateName || "",
      email: cust.email || "",
      phone: cust.phone || "",
      address: cust.address || "",
      contactPersons,
      createdAt: new Date(),
      updatedAt: new Date(),
      backfilledFrom: "corporate-orders",
    });
    created++;

    for (const order of group.orders) {
      const oldContact = order.contactPerson;
      const oldContactKey = oldContact?.id || `${normalize(oldContact?.name)}|${normalize(oldContact?.email)}|${normalize(oldContact?.phone)}`;
      const matched = contactPersons.find((c, i) => {
        const original = Array.from(group.contactPersons.keys())[i];
        return original === oldContactKey;
      });

      await updateDoc(doc(db, "corporate-orders", order.id), {
        "corporateCustomer.id": newCustomerRef.id,
        ...(matched ? { "contactPerson.id": matched.id } : {}),
      });
      updated++;
    }
  }

  console.log("\nSummary:");
  console.log(`  Customer groups: ${groups.size}`);
  if (APPLY) {
    console.log(`  Customers created: ${created}`);
    console.log(`  Orders updated: ${updated}`);
  } else {
    console.log("  (dry run — re-run with --apply to write these changes)");
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
