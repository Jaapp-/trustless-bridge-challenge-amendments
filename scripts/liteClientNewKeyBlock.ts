import { NetworkProvider } from '@ton/blueprint';
import { storeNewKeyBlock } from '../wrappers/LiteClient';
import { getClient } from './fetchTestData';
import { beginCell, toNano } from '@ton/core';
import { createBlockAndFileHash, createNewKeyBlock, createSignatureMap } from '../src/structs';
import { lookupFullBlock } from '../src/lite-client';
import { getMasterchainBlockSignatures } from '../src/toncenter';
import { requireAddress, requireSeqNo } from '../src/ui';
import { opposingNetwork } from '../src/util';
import { createSenderProvider } from '../src/deploy';

const ARGUMENTS = '<address> <seqno>';

export async function run(provider: NetworkProvider, args: string[]) {
    const address = requireAddress(args[0], __filename, ARGUMENTS);
    const seqno = requireSeqNo(args[1], __filename, ARGUMENTS);
    const client = await getClient(opposingNetwork(provider.network()));
    const block = await lookupFullBlock(client, seqno);

    const signatures = await getMasterchainBlockSignatures(opposingNetwork(provider.network()), seqno);
    const blockAndFileHash = await createBlockAndFileHash(block.data);
    const signatureMap = createSignatureMap(signatures);

    const sender = await createSenderProvider(provider);
    const builder = beginCell();
    storeNewKeyBlock(createNewKeyBlock(1n, blockAndFileHash, signatureMap))(builder);
    await sender.sendTransaction(address, toNano('0.5'), builder.endCell());
}
