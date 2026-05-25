export interface ImportedTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'receita' | 'despesa';
  status: 'pending' | 'matched' | 'ignored' | 'added';
  matchedWithSystemId?: string;
}

export function parseOFX(ofxString: string): ImportedTransaction[] {
  const transactions: ImportedTransaction[] = [];
  
  // Extract STMTTRN blocks
  const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;
  
  while ((match = stmttrnRegex.exec(ofxString)) !== null) {
    const block = match[1];
    
    // Extract fields
    const trnTypeMatch = block.match(/<TRNTYPE>(.*?)(?:\r?\n|<)/);
    const dtPostedMatch = block.match(/<DTPOSTED>(.*?)(?:\r?\n|<)/);
    const trnAmtMatch = block.match(/<TRNAMT>(.*?)(?:\r?\n|<)/);
    const fitIdMatch = block.match(/<FITID>(.*?)(?:\r?\n|<)/);
    const memoMatch = block.match(/<MEMO>(.*?)(?:\r?\n|<)/);
    
    if (dtPostedMatch && trnAmtMatch) {
      const dtPosted = dtPostedMatch[1].trim();
      const trnAmt = parseFloat(trnAmtMatch[1].trim());
      const fitId = fitIdMatch ? fitIdMatch[1].trim() : crypto.randomUUID();
      const memo = memoMatch ? memoMatch[1].trim() : 'Transação Importada';
      
      // Parse date (YYYYMMDDHHMMSS or YYYYMMDD)
      const year = dtPosted.substring(0, 4);
      const month = dtPosted.substring(4, 6);
      const day = dtPosted.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}T12:00:00Z`).toISOString();
      
      transactions.push({
        id: fitId,
        date,
        amount: Math.abs(trnAmt),
        description: memo,
        type: trnAmt >= 0 ? 'receita' : 'despesa',
        status: 'pending'
      });
    }
  }
  
  return transactions;
}
