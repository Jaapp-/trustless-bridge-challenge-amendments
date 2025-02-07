import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import {
    loadCheckBlock,
    loadExcesses,
    loadTransactionChecked,
    TransactionChecker,
} from '../wrappers/TransactionChecker';
import '@ton/test-utils';
import { readTestData, readTestDataJson } from './testUtil';
import { parseBlock, parseProofTransactions } from '../src/parser';
import {
    createBlockAndFileHash,
    createCheckTransaction,
    createProvableBlock,
    createSignatureMap,
    createValidatorSet,
} from '../src/structs';
import { LiteClient, loadCorrect, SignatureMap } from '../wrappers/LiteClient';
import { testBlock } from './LiteClient.spec';
import { liteServer_blockTransactions } from 'ton-lite-client/dist/schema';

const getTestCheckTransaction = async (seqno: number, isKey: boolean) => {
    const extra = isKey ? '-key' : '';
    const nextBlock = await readTestData(`testnet-${seqno}${extra}.block`); // Block of later epoch
    const signatureMap: SignatureMap = createSignatureMap(
        await readTestDataJson(`testnet-${seqno}${extra}.signatures.json`),
    );
    const bnfh = await createBlockAndFileHash(nextBlock);
    const provableBlock = createProvableBlock(bnfh, signatureMap);
    const transactionResponse: liteServer_blockTransactions = await readTestDataJson(
        `testnet-${seqno}.transactions.json`,
    );
    const [transactionProof] = Cell.fromBoc(transactionResponse.proof);
    const transactions = parseProofTransactions(transactionProof.refs[0]);
    return createCheckTransaction(transactions[0], Cell.fromBoc(nextBlock)[0], provableBlock);
};

describe('TransactionChecker', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let transactionChecker: SandboxContract<TransactionChecker>;
    let liteClient: SandboxContract<LiteClient>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        const keyBlock = testBlock(27683262, true);
        const initBlock = await readTestData(keyBlock.block);
        const parsedInit = parseBlock(initBlock);
        const initValidators = await createValidatorSet(parsedInit);
        deployer = await blockchain.treasury('deployer');

        liteClient = blockchain.openContract(await LiteClient.fromInit(-3n, 27683262n, initValidators));
        const lcDeployResult = await liteClient.send(
            deployer.getSender(),
            {
                value: toNano('0.15'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );
        expect(lcDeployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: liteClient.address,
            deploy: true,
            success: true,
        });

        transactionChecker = blockchain.openContract(await TransactionChecker.fromInit(liteClient.address));
        const tcDeployResult = await transactionChecker.send(
            deployer.getSender(),
            {
                value: toNano('0.15'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );
        expect(tcDeployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: transactionChecker.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and transactionChecker are ready to use
    });

    it('should check a transaction', async () => {
        const sender = await blockchain.treasury('sender');
        const checkTransaction = await getTestCheckTransaction(27683263, false);

        const response: SendMessageResult = await transactionChecker.send(
            sender.getSender(),
            { value: toNano('0.5') },
            checkTransaction,
        );

        expect(response.transactions).toHaveTransaction({
            from: sender.address,
            to: transactionChecker.address,
            success: true,
        });
        expect(response.transactions).toHaveTransaction({
            from: transactionChecker.address,
            to: liteClient.address,
            success: true,
        });
        expect(response.transactions).toHaveTransaction({
            from: liteClient.address,
            to: transactionChecker.address,
            success: true,
        });
        expect(response.transactions).toHaveTransaction({
            from: transactionChecker.address,
            to: sender.address,
            success: true,
        });

        const messages = response.events.filter((event) => event.type === 'message_sent');
        const checkBlock = loadCheckBlock(messages[1].body.asSlice());
        const correct = loadCorrect(messages[2].body.asSlice());
        expect(checkBlock.query_id).toBe(correct.query_id);
        const transactionChecked = loadTransactionChecked(messages[3].body.asSlice());
        expect(transactionChecked.transaction).toBe(checkTransaction.transaction);
    });

    it('should reject an invalid transaction', async () => {
        const sender = await blockchain.treasury('sender');
        const checkTransaction = await getTestCheckTransaction(27689757, true); // Block of later epoch
        const response: SendMessageResult = await transactionChecker.send(
            sender.getSender(),
            { value: toNano('0.5') },
            checkTransaction,
        );

        expect(response.transactions).toHaveTransaction({
            from: sender.address,
            to: transactionChecker.address,
            success: true,
        });
        expect(response.transactions).toHaveTransaction({
            from: transactionChecker.address,
            to: liteClient.address,
            success: false,
            exitCode: 19820, // Expect matching prev_key_block_seqno
        });
        expect(response.transactions).toHaveTransaction({
            from: liteClient.address,
            to: transactionChecker.address,
            inMessageBounced: true,
            success: true,
        });
        expect(response.transactions).toHaveTransaction({
            from: transactionChecker.address,
            to: sender.address,
            success: true,
            op: 0xd53276db, // Excesses
        });
    });
});
