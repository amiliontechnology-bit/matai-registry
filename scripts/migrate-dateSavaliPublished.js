/**
 * ONE-TIME MIGRATION SCRIPT
 * Renames the Firestore field: dateProclamation → dateSavaliPublished
 *
 * Run this ONCE from a local terminal after deploying the updated app code.
 * After running, verify the app works, then remove the normaliseRecord shim
 * from src/utils/cache.js.
 *
 * HOW TO RUN:
 *   1. Install the Firebase Admin SDK (once):
 *        npm install firebase-admin --save-dev
 *
 *   2. Download your service account key from:
 *        Firebase Console → Project Settings → Service Accounts → Generate New Private Key
 *      Save it as: scripts/service-account.json
 *      (This file is gitignored — never commit it)
 *
 *   3. Run the migration:
 *        node scripts/migrate-dateSavaliPublished.js
 *
 *   4. Check the output. It will print how many records were updated.
 *
 *   5. Once confirmed working, delete this script and remove the
 *      normaliseRecord shim from src/utils/cache.js.
 */

const admin = require("firebase-admin");
const serviceAccount = require("./service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "resitalaina-o-matai",
});

const db = admin.firestore();

async function migrate() {
  const collection = db.collection("registrations");
  const snapshot = await collection.get();

  let updated = 0;
  let skipped = 0;
  let batches = [];
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Only migrate if old field exists and new field does NOT yet exist
    if (data.dateProclamation !== undefined && data.dateSavaliPublished === undefined) {
      batch.update(docSnap.ref, {
        dateSavaliPublished: data.dateProclamation,
        dateProclamation: admin.firestore.FieldValue.delete(),
      });
      batchCount++;
      updated++;

      // Firestore batch limit is 500 writes
      if (batchCount === 500) {
        batches.push(batch);
        batch = db.batch();
        batchCount = 0;
      }
    } else {
      skipped++;
    }
  }

  // Commit remaining batch
  if (batchCount > 0) {
    batches.push(batch);
  }

  console.log(`\nMigration plan:`);
  console.log(`  Total records : ${snapshot.size}`);
  console.log(`  To update     : ${updated}`);
  console.log(`  Already done  : ${skipped}`);
  console.log(`  Batches needed: ${batches.length}\n`);

  if (updated === 0) {
    console.log("✅ Nothing to migrate — all records already use dateSavaliPublished.");
    process.exit(0);
  }

  console.log("Committing...");
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`  Batch ${i + 1}/${batches.length} committed`);
  }

  console.log(`\n✅ Migration complete. ${updated} records updated.`);
  console.log("\nNext steps:");
  console.log("  1. Verify the app works correctly in production.");
  console.log("  2. Remove the normaliseRecord shim from src/utils/cache.js");
  console.log("  3. Delete this script and scripts/service-account.json");
}

migrate().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
