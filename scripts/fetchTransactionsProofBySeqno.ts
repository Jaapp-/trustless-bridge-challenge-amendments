import { NetworkProvider } from '@ton/blueprint';
import { getClient } from './fetchTestData';
import { MC_SHARD } from '../src/constants';
import { writeTestData } from '../tests/testUtil';
import { requireSeqNo } from '../src/ui';
import { listBlockTransactions } from '../src/lite-client';

export async function run(provider: NetworkProvider, args: string[]) {
    const seqno = requireSeqNo(args[0], __filename);
    const client = await getClient(provider.network());
    const header = await client.lookupBlockByID({
        workchain: -1,
        shard: MC_SHARD,
        seqno: seqno,
    });
    const transactions = await listBlockTransactions(client, header.id);
    await writeTestData(`${provider.network()}-${seqno}.transactions.json`, JSON.stringify(transactions, null, 2));
}
