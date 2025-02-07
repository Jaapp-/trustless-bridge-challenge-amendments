import { BlockID, LiteClient, LiteEngine, LiteRoundRobinEngine, LiteSingleEngine } from 'ton-lite-client';
import { intToIP } from './util';
import { TESTNET_CONFIG } from './configs/testnet-config';
import { MAINNET_CONFIG } from './configs/main-config';
import { parseBlock } from './parser';
import { Functions, tonNode_blockId, tonNode_blockIdExt } from 'ton-lite-client/dist/schema';
import { MC_SHARD } from './constants';
import { FASTNET_CONFIG } from './configs/fastnet-config';

type LiteServerConfig = {
    ip: number;
    port: number;
    provided: string;
    id: {
        '@type': 'pub.ed25519';
        key: string;
    };
};

type ConfigResponse = {
    liteservers: LiteServerConfig[];
};

const getClient = async (server: LiteServerConfig) => {
    const engines: LiteEngine[] = [];
    engines.push(
        new LiteSingleEngine({
            host: `tcp://${intToIP(server.ip)}:${server.port}`,
            publicKey: Buffer.from(server.id.key, 'base64'),
        }),
    );
    const engine: LiteEngine = new LiteRoundRobinEngine(engines);
    return new LiteClient({ engine });
};

export const getLatestClient = async (configUrl: string) => {
    const response = await fetch(configUrl);
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    const data: ConfigResponse = await response.json();
    return getClient(data.liteservers[0]);
};

export const getCachedMainClient = async () => {
    return await getClient(MAINNET_CONFIG.liteservers[0] as LiteServerConfig);
};

export const getCachedTestClient = async () => {
    return await getClient(TESTNET_CONFIG.liteservers[0] as LiteServerConfig);
};

export const getCachedFastnetClient = async () => {
    return await getClient(FASTNET_CONFIG.liteservers[0] as LiteServerConfig);
};

export async function lookupFullBlock(client: LiteClient, seqno: number, workchain = -1, shard = MC_SHARD) {
    const idExt = await client.lookupBlockByID({
        seqno: seqno,
        shard: shard,
        workchain: workchain,
    });
    return await client.engine.query(Functions.liteServer_getBlock, {
        kind: 'liteServer.getBlock',
        id: idExt.id,
    });
}

export async function getFullBlock(client: LiteClient, id: tonNode_blockIdExt) {
    return await client.engine.query(Functions.liteServer_getBlock, {
        kind: 'liteServer.getBlock',
        id: id,
    });
}

export async function getLastMcBlockId(client: LiteClient): Promise<tonNode_blockId> {
    const mcInfo = await client.getMasterchainInfo();
    const lastBlockResponse = await getFullBlock(client, mcInfo.last);
    const lastBlock = parseBlock(lastBlockResponse.data);
    const lastKeySeqno = lastBlock.info.key_block ? lastBlock.info.seq_no : lastBlock.info.prev_key_block_seqno;
    return {
        kind: 'tonNode.blockId',
        workchain: mcInfo.last.workchain,
        seqno: lastKeySeqno,
        shard: mcInfo.last.shard,
    };
}

export async function getLastMcBlock(client: LiteClient) {
    const lastBlockId = await getLastMcBlockId(client);
    return await lookupFullBlock(client, lastBlockId.seqno, lastBlockId.workchain, lastBlockId.shard);
}

export async function listBlockTransactions(client: LiteClient, id: BlockID) {
    return await client.listBlockTransactions(id, {
        count: 100,
        mode: (1 << 5) | (1 + 2 + 4),
    });
}
