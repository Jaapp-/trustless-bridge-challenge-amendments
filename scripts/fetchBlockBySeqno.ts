import { NetworkProvider } from '@ton/blueprint';
import { getClient, storeBlock } from './fetchTestData';
import { MC_SHARD } from '../src/constants';
import { requireSeqNo } from '../src/ui';

export async function run(provider: NetworkProvider, args: string[]) {
    const seqno = requireSeqNo(args[0], __filename);
    const client = await getClient(provider.network());
    await storeBlock(provider.network(), client, {
        kind: 'tonNode.blockId',
        workchain: -1,
        shard: MC_SHARD,
        seqno: seqno,
    });
}
