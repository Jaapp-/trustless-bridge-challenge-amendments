import { NetworkProvider, sleep } from '@ton/blueprint';
import { LiteClient, storeNewKeyBlock } from '../wrappers/LiteClient';
import { LiteClient as TsLiteClient } from 'ton-lite-client';
import { getClient } from './fetchTestData';
import { getLastMcBlockId, lookupFullBlock } from '../src/lite-client';
import { requireAddress } from '../src/ui';
import { beginCell, OpenedContract, toNano } from '@ton/core';
import { liteServer_BlockData } from 'ton-lite-client/dist/schema';
import { parseBlock } from '../src/parser';
import { createBlockAndFileHash, createNewKeyBlock, createSignatureMap } from '../src/structs';
import { getMasterchainBlockSignatures } from '../src/toncenter';
import { opposingNetwork } from '../src/util';
import { createSenderProvider } from '../src/deploy';

export async function run(provider: NetworkProvider, args: string[]) {
    const address = requireAddress(args[0], __filename);

    const client = await getClient(opposingNetwork(provider.network()));
    const lastKeyBlock = await getLastMcBlockId(client);
    provider.ui().write(`Last masterchain key block: ${JSON.stringify(lastKeyBlock.seqno)}`);
    const liteClient = provider.open(LiteClient.fromAddress(address));
    const contractSeqno = Number(await liteClient.getSeqno());
    const lastSeqno = lastKeyBlock.seqno;
    const diff = lastSeqno - contractSeqno;
    const isUpToDate = diff === 0;
    provider.ui().write(`Contract seqno: ${contractSeqno} up-to-date:${isUpToDate} diff=${diff}`);
    if (isUpToDate) {
        provider.ui().write('No need to sync');
    } else {
        await sync(provider, client, liteClient, lastSeqno, contractSeqno);
    }
}

async function retryGetSignatures(seqno: number, provider: NetworkProvider) {
    for (let j = 0; j < 10; j++) {
        try {
            return await getMasterchainBlockSignatures(opposingNetwork(provider.network()), seqno);
        } catch (e) {
            provider.ui().write(`[attempt ${j + 1}/10] Failed to get signatures for ${seqno}: ${e}`);
            await sleep(1500);
        }
    }
    throw new Error('Failed to get signatures 10 times');
}

const sync = async (
    provider: NetworkProvider,
    client: TsLiteClient,
    contract: OpenedContract<LiteClient>,
    lastKeySeqno: number,
    contractSeqno: number,
) => {
    const blocks: { [key: number]: liteServer_BlockData } = {};
    let seqno = lastKeySeqno;

    provider.ui().write("Fetching key blocks from last mc to contract's seqno");
    while (seqno > contractSeqno) {
        const block = await lookupFullBlock(client, seqno);
        blocks[seqno] = block;
        seqno = parseBlock(block.data).info.prev_key_block_seqno;
        provider.ui().write(`${block.id.seqno} -> ${seqno} diff=${seqno - contractSeqno}`);
    }
    provider.ui().write(`Syncing ${Object.keys(blocks).length} key blocks`);

    const keys = Object.keys(blocks).sort();
    const sender = await createSenderProvider(provider);
    let i = 0;
    for (const seqnoStr of keys) {
        const seqno = parseInt(seqnoStr);
        const block = blocks[seqno];
        let signatures = await retryGetSignatures(seqno, provider);

        const signatureMap = createSignatureMap(signatures);
        const blockAndFileHash = await createBlockAndFileHash(block.data);

        provider.ui().write(`[${i + 1}/${keys.length}] Updating LiteClient to ${seqno}`);

        const builder = beginCell();
        storeNewKeyBlock(createNewKeyBlock(1n, blockAndFileHash, signatureMap))(builder);
        await sender.sendTransaction(contract.address, toNano('0.5'), builder.endCell());
        await sleep(10_000);
        i++;
    }
};
