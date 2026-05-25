const fs = require("fs");
let code = fs.readFileSync("src/App.tsx", "utf8");

// Remove Transactions
const txStart = code.indexOf("{/* ID: Transactions list page */}");
const txEnd = code.indexOf("{/* ID: Banks and credit cards management */}");
if (txStart !== -1 && txEnd !== -1) {
  code = code.substring(0, txStart) + code.substring(txEnd);
}

// Modify Reconciliation to become Movimentacoes subtabs
const recStartStr = `{/* ID: Reconciliation tab */}
        {activeTab === "reconciliation" && (`;
const recNewStr = `{/* ID: Reconciliation tab */}
        {activeTab === "movimentacoes" && activeSubTab === "reconciliation" && (`;

code = code.replace(recStartStr, recNewStr);

fs.writeFileSync("src/App.tsx", code);
