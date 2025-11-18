// Logic theo dõi các sự kiện/số dư on-chain
import { db } from '@gr2/shared';

async function main() {
  console.log('Onchain Fetcher Service Started');
  
  // TODO: Implement blockchain subscriber logic
  // - Monitor on-chain events (transfers, swaps, etc.)
  // - Track token balances
  // - Monitor wallet activities
  
  // Store on-chain events to database
  // await db.insert(signals).values({...});
}

main().catch((err) => {
  console.error('Onchain Fetcher failed:', err);
  process.exit(1);
});

