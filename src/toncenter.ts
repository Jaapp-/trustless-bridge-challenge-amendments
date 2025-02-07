import { Network } from './constants';

type BlockSignature = {
    '@type': 'blocks.signature';
    node_id_short: string;
    signature: string;
};

type BlockIdExt = {
    '@type': 'ton.blockIdExt';
    workchain: number;
    shard: string;
    seqno: number;
    root_hash: string;
    file_hash: string;
};

export type BlockSignatures = {
    '@type': 'blocks.blockSignatures';
    id: BlockIdExt;
    signatures: BlockSignature[];
    '@extra': string;
};

export type ApiResponse = {
    ok: boolean;
    result: BlockSignatures;
};

export const TONCENTER_MAINNET_URL = 'https://toncenter.com/api/v2';
export const TONCENTER_TESTNET_URL = 'https://testnet.toncenter.com/api/v2';
export const TONCENTER_FASTNET_URL = 'http://109.236.91.95:8081';

const getTonCenterUrl = (network: Network) => {
    switch (network) {
        case 'mainnet':
            return TONCENTER_MAINNET_URL;
        case 'testnet':
            return TONCENTER_TESTNET_URL;
        case 'custom':
            return TONCENTER_FASTNET_URL;
        default:
            throw new Error('Not implemented');
    }
};

export const getMasterchainBlockSignatures = async (network: Network, seqNo: number) => {
    const url = new URL(getTonCenterUrl(network) + '/getMasterchainBlockSignatures');
    url.searchParams.append('seqno', String(seqNo));
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    const data: ApiResponse = await response.json();
    if (!data.ok) {
        throw new Error(JSON.stringify(data));
    }
    return data.result;
};
