import { NetworkProvider } from '@ton/blueprint';
import { getCachedFastnetClient, getCachedMainClient, getCachedTestClient, getLastMcBlockId } from '../src/lite-client';
import { parseBlock } from '../src/parser';
import { LiteClient } from 'ton-lite-client/dist/client';
import { Functions, tonNode_blockId } from 'ton-lite-client/dist/schema';
import { getMasterchainBlockSignatures } from '../src/toncenter';
import { writeTestData } from '../tests/testUtil';
import { Network } from '../src/constants';

export async function getClient(network: Network) {
    switch (network) {
        case 'mainnet':
            return await getCachedMainClient();
        case 'testnet':
            return await getCachedTestClient();
        case 'custom':
            return await getCachedFastnetClient();
        default:
            throw new Error('Not implemented');
    }
}

export const storeBlock = async (
    network: Network,
    client: LiteClient,
    id: tonNode_blockId,
): Promise<tonNode_blockId> => {
    const blockheader = await client.lookupBlockByID(id);
    const fullBlock = await client.engine.query(Functions.liteServer_getBlock, {
        kind: 'liteServer.getBlock',
        id: blockheader.id,
    });
    const parsedBlock = parseBlock(fullBlock.data);
    const signatures = await getMasterchainBlockSignatures(network, id.seqno);

    await writeTestData(`${network}-${id.seqno}${parsedBlock.info.key_block ? '-key' : ''}.block`, fullBlock.data);
    await writeTestData(
        `${network}-${id.seqno}${parsedBlock.info.key_block ? '-key' : ''}.signatures.json`,
        JSON.stringify(signatures, null, 2),
    );
    await new Promise((f) => setTimeout(f, 1000));

    return {
        kind: 'tonNode.blockId',
        workchain: id.workchain,
        shard: id.shard,
        seqno: parsedBlock.info.prev_key_block_seqno,
    };
};

export async function run(provider: NetworkProvider, args: string[]) {
    const numBlocks = parseInt(args[0]) || 1;
    provider.ui().write(`Fetching ${numBlocks} latest key blocks & signatures`);

    const client = await getClient(provider.network());
    let blockId = await getLastMcBlockId(client);
    for (let i = 0; i < numBlocks; i++) {
        provider.ui().write(`[${i + 1}/${numBlocks}] Downloading ${JSON.stringify(blockId)}`);
        blockId = await storeBlock(provider.network(), client, blockId);
    }
}
