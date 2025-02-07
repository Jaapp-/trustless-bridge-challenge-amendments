import { NetworkProvider } from '@ton/blueprint';
import { getClient } from './fetchTestData';
import { MC_SHARD } from '../src/constants';
import { writeTestData } from '../tests/testUtil';
import { requireSeqNo } from '../src/ui';

export async function run(provider: NetworkProvider, args: string[]) {
    const seqno = requireSeqNo(args[0], __filename);
    const client = await getClient(provider.network());
    const blockHeader = await client.lookupBlockByID({ seqno: seqno, shard: MC_SHARD, workchain: -1 });
    await writeTestData(`${provider.network()}-${seqno}.header`, blockHeader.headerProof);
}
