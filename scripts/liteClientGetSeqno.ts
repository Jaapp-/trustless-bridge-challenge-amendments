import { NetworkProvider } from '@ton/blueprint';
import { LiteClient } from '../wrappers/LiteClient';
import { requireAddress } from '../src/ui';

export async function run(provider: NetworkProvider, args: string[]) {
    const address = requireAddress(args[0], __filename);

    const liteClient = provider.open(LiteClient.fromAddress(address));
    const seqno = await liteClient.getSeqno();
    provider.ui().write(`Seqno: ${seqno}`);
}
