import { NetworkProvider } from '@ton/blueprint';
import { getClient } from './fetchTestData';
import { beginCell, Cell, toNano } from '@ton/core';
import {
    createBlockAndFileHash,
    createCheckTransaction,
    createHeaderProof,
    createProvableBlock,
    createSignatureMap,
} from '../src/structs';
import { listBlockTransactions, lookupFullBlock } from '../src/lite-client';
import { getMasterchainBlockSignatures } from '../src/toncenter';
import { requireAddress, requireSeqNo } from '../src/ui';
import { opposingNetwork } from '../src/util';
import { storeCheckTransaction } from '../wrappers/TransactionChecker';
import { parseProofTransactions } from '../src/parser';
import { loadTransaction } from '../src/gen/block';
import { createSenderProvider } from '../src/deploy';
import { sha256 } from '@ton/crypto';

const ARGUMENTS = '<address> <seqno>';

export async function run(provider: NetworkProvider, args: string[]) {
    const address = requireAddress(args[0], __filename, ARGUMENTS);
    const seqno = requireSeqNo(args[1], __filename, ARGUMENTS);
    const client = await getClient(opposingNetwork(provider.network()));

    const block = await lookupFullBlock(client, seqno);
    const [rootCell] = Cell.fromBoc(block.data);
    const signatures = await getMasterchainBlockSignatures(opposingNetwork(provider.network()), seqno);
    const blockAndFileHash = await createBlockAndFileHash(
        createHeaderProof(Cell.fromBoc(block.data)[0]),
        await sha256(block.data),
    );
    const signatureMap = createSignatureMap(signatures);
    const provableBlock = createProvableBlock(blockAndFileHash, signatureMap);

    const transactions = parseProofTransactions(rootCell);
    const transaction = await provider.ui().choose('Choose a transaction to check', transactions.slice(0, 100), (t) => {
        const parsed = loadTransaction(t.asSlice());
        return `${t.hash(0).toString('hex')}: to=${parsed.account_addr} lt=${parsed.lt}`;
    });

    const transactionsProof = await listBlockTransactions(client, block.id);

    const sender = await createSenderProvider(provider);
    const builder = beginCell();
    storeCheckTransaction(createCheckTransaction(transaction, Cell.fromBoc(transactionsProof.proof)[0], provableBlock))(
        builder,
    );
    await sender.sendTransaction(
        address,
        provider.network() === 'custom' ? toNano('5') : toNano('0.1'),
        builder.endCell(),
    );
}
