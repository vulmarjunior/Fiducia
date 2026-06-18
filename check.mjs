import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const accountsSnap = await getDocs(collection(db, "accounts"));
  let sicoob = null;
  accountsSnap.forEach(doc => {
    if (doc.data().name.toLowerCase().includes("sicoob")) {
      sicoob = { id: doc.id, ...doc.data() };
    }
  });

  if (!sicoob) {
    console.log("Sicoob account not found");
    return;
  }

  console.log("Account:", sicoob.name, "| Balance:", sicoob.balance, "| Initial:", sicoob.initialBalance);

  const txSnap = await getDocs(query(collection(db, "transactions"), where("accountId", "==", sicoob.id)));
  const destSnap = await getDocs(query(collection(db, "transactions"), where("destinationAccountId", "==", sicoob.id)));

  const txs = [];
  const seen = new Set();
  const add = (d) => {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      txs.push({ id: d.id, ...d.data() });
    }
  };
  txSnap.forEach(add);
  destSnap.forEach(add);

  console.log(`Found ${txs.length} transactions for Sicoob`);
  
  let total = sicoob.initialBalance || 0;
  txs.sort((a,b) => a.date.localeCompare(b.date)).forEach(t => {
    let eff = 0;
    if (t.status === 'pago' || t.status === 'paga' || t.status === 'realizado' || t.status === 'paid') {
      if (t.type === 'transferencia') {
        eff = t.destinationAccountId === sicoob.id ? t.amount : -t.amount;
      } else if (t.type === 'receita') {
        eff = t.amount;
      } else {
        eff = -t.amount;
      }
      total += eff;
    }
    console.log(`${t.date.split('T')[0]} | ${t.type} | ${t.status} | effect: ${eff} | ${t.amount} | ${t.description}`);
  });
  console.log("MATHEMATICAL SUM:", total);
}

run();
