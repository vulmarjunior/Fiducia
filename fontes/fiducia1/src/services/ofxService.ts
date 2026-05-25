export interface OfxTransaction {
  id: string;
  type: 'receita' | 'despesa';
  amount: number;
  date: string;
  description: string;
  memo?: string;
}

export const parseOfx = (ofxString: string): OfxTransaction[] => {
  const transactions: OfxTransaction[] = [];
  
  // Some OFX files don't have closing tags for STMTTRN
  // We'll split by <STMTTRN> and process each block
  const blocks = ofxString.split(/<STMTTRN>/i);
  
  // Skip the first block as it's the header
  for (let i = 1; i < blocks.length; i++) {
    const trnContent = blocks[i];
    
    const trnType = getTagValue(trnContent, 'TRNTYPE');
    const dtPosted = getTagValue(trnContent, 'DTPOSTED');
    const trnAmtStr = getTagValue(trnContent, 'TRNAMT') || '0';
    const trnAmt = parseFloat(trnAmtStr.replace(',', '.'));
    const fitId = getTagValue(trnContent, 'FITID') || `ofx-${Date.now()}-${i}`;
    const name = getTagValue(trnContent, 'NAME') || getTagValue(trnContent, 'MEMO') || 'Sem descrição';
    const memo = getTagValue(trnContent, 'MEMO');

    if (dtPosted) {
      // OFX Date format: YYYYMMDD...
      const year = dtPosted.substring(0, 4);
      const month = dtPosted.substring(4, 6);
      const day = dtPosted.substring(6, 8);
      
      // Validate date parts
      if (year && year.length === 4 && month && month.length === 2 && day && day.length === 2) {
        const isoDate = `${year}-${month}-${day}T12:00:00.000Z`;

        transactions.push({
          id: fitId,
          type: trnAmt > 0 ? 'receita' : 'despesa',
          amount: Math.abs(trnAmt),
          date: isoDate,
          description: name.trim(),
          memo: memo?.trim()
        });
      }
    }
  }

  if (transactions.length === 0) {
    console.warn('OFX Parsing: No transactions found. Content preview:', ofxString.substring(0, 500));
  }

  return transactions;
};

const getTagValue = (content: string, tag: string): string | null => {
  // OFX tags can be <TAG>VALUE or <TAG>VALUE</TAG>
  // We use a more flexible regex that stops at the next tag or newline
  const regex = new RegExp(`<${tag}>([^<\\n\\r]*)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
};
