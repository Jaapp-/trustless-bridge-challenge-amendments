import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { BlockAndFileHash, LiteClient, storeCorrect, storeOk } from '../wrappers/LiteClient';
import '@ton/test-utils';
import { readTestData, readTestDataJson } from './testUtil';
import { bufferToBigInt } from '../src/util';
import { BlockSignatures } from '../src/toncenter';
import { parseBlock } from '../src/parser';
import { randomInt } from 'node:crypto';
import {
    createBlockAndFileHash,
    createCheckBlock,
    createNewKeyBlock,
    createSignatureMap,
    createValidatorSet,
} from '../src/structs';

async function loadBlockAndFileHash(blockFile: string): Promise<BlockAndFileHash> {
    const nextBlock = await readTestData(blockFile);
    return await createBlockAndFileHash(nextBlock);
}

async function loadSignatureMap(signatureFile: string) {
    const signatures: BlockSignatures = await readTestDataJson(signatureFile);
    return createSignatureMap(signatures);
}

async function loadNewKeyBlock(blockFile: string, signatureFile: string, queryId: number) {
    const blockAndFileHash = await loadBlockAndFileHash(blockFile);
    const signatureMap = await loadSignatureMap(signatureFile);
    return createNewKeyBlock(BigInt(queryId), blockAndFileHash, signatureMap);
}

async function loadCheckBlock(blockFile: string, signatureFile: string, queryId: number) {
    const blockAndFileHash = await loadBlockAndFileHash(blockFile);
    const signatureMap = await loadSignatureMap(signatureFile);
    return createCheckBlock(BigInt(queryId), blockAndFileHash, signatureMap);
}

export const testBlock = (seqno: number, isKey: boolean) => ({
    block: `testnet-${seqno}${isKey ? '-key' : ''}.block`,
    signatures: `testnet-${seqno}${isKey ? '-key' : ''}.signatures.json`,
    seqno: seqno,
});

describe('LiteClient', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let liteClient: SandboxContract<LiteClient>;

    const keyBlocks = [27678205, 27683262, 27683981, 27689041, 27689757].map((s) => testBlock(s, true));
    const nonKeyBlock = testBlock(27683263, false);

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        const initBlock = await readTestData(keyBlocks[0].block);
        const parsedInit = parseBlock(initBlock);
        const initValidators = await createValidatorSet(parsedInit);

        liteClient = blockchain.openContract(await LiteClient.fromInit(-3n, 27678205n, initValidators));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await liteClient.send(
            deployer.getSender(),
            {
                value: toNano('0.15'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: liteClient.address,
            deploy: true,
            success: true,
        });
    });

    it('should accept a new keyblock', async () => {
        const sender = await blockchain.treasury('sender');

        for (const testBlock of keyBlocks.slice(1)) {
            const queryId = randomInt(0, 1000);
            const newKeyBlock = await loadNewKeyBlock(testBlock.block, testBlock.signatures, queryId);
            const response = await liteClient.send(
                sender.getSender(),
                {
                    value: toNano('0.5'),
                },
                newKeyBlock,
            );
            expect(response.transactions).toHaveTransaction({
                from: sender.address,
                to: liteClient.address,
                success: true,
            });

            const expectedResponse = beginCell();
            storeOk({
                $$type: 'Ok',
                query_id: BigInt(queryId),
                block_hash: bufferToBigInt(Cell.fromBoc(await readTestData(testBlock.block))[0].hash()),
            })(expectedResponse);

            const okTransaction = response.transactions[1];
            expect(okTransaction.description.type).toEqual('generic');
            if (okTransaction.description.type !== 'generic') {
                throw new Error('Generic transaction expected');
            }
            expect(okTransaction.outMessages.get(0)?.body).toEqualCell(expectedResponse.endCell());

            expect(await liteClient.getSeqno()).toBe(BigInt(testBlock.seqno));
        }
    });

    it('should reject the wrong key block', async () => {
        const sender = await blockchain.treasury('sender');
        const testBlock = keyBlocks[2]; // 1 would be correct
        const newKeyBlock = await loadNewKeyBlock(testBlock.block, testBlock.signatures, 0);
        const response = await liteClient.send(sender.getSender(), { value: toNano('0.5') }, newKeyBlock);
        expect(response.transactions).toHaveTransaction({
            from: sender.address,
            to: liteClient.address,
            success: false,
            exitCode: 19820, // Expect matching prev_key_block_seqno
        });
        expect(response.transactions).toHaveTransaction({
            from: liteClient.address,
            to: sender.address,
            success: true,
            inMessageBounced: true,
        });
    });

    it('should do check_block', async () => {
        const sender = await blockchain.treasury('sender');
        const keyBlock = keyBlocks[1];
        const newKeyBlock = await loadNewKeyBlock(keyBlock.block, keyBlock.signatures, 123);
        const response: SendMessageResult = await liteClient.send(
            sender.getSender(),
            {
                value: toNano('0.5'),
            },
            newKeyBlock,
        );
        expect(response.transactions).toHaveTransaction({
            from: sender.address,
            to: liteClient.address,
            success: true,
        });

        expect(await liteClient.getSeqno()).toBe(BigInt(keyBlock.seqno));

        const queryId = randomInt(0, 1000);
        const checkBlock = await loadCheckBlock(nonKeyBlock.block, nonKeyBlock.signatures, queryId);
        const checkResponse = await liteClient.send(
            sender.getSender(),
            {
                value: toNano('0.5'),
            },
            checkBlock,
        );
        expect(checkResponse.transactions).toHaveTransaction({
            from: sender.address,
            to: liteClient.address,
            success: true,
        });

        const expectedResponse = beginCell();
        storeCorrect({
            $$type: 'Correct',
            query_id: BigInt(queryId),
            block_hash: bufferToBigInt(Cell.fromBoc(await readTestData(nonKeyBlock.block))[0].hash()),
        })(expectedResponse);

        const correctTransaction = checkResponse.transactions[1];
        expect(correctTransaction.description.type).toEqual('generic');
        if (correctTransaction.description.type !== 'generic') {
            throw new Error('Generic transaction expected');
        }
        expect(correctTransaction.outMessages.get(0)?.body).toEqualCell(expectedResponse.endCell());

        expect(await liteClient.getSeqno()).toBe(BigInt(keyBlock.seqno));
    });

    it('should reject the wrong check block', async () => {
        const sender = await blockchain.treasury('sender');
        const testBlock = keyBlocks[2]; // 1 would be correct
        const newKeyBlock = await loadCheckBlock(testBlock.block, testBlock.signatures, 0);
        const response = await liteClient.send(sender.getSender(), { value: toNano('0.5') }, newKeyBlock);
        expect(response.transactions).toHaveTransaction({
            from: sender.address,
            to: liteClient.address,
            success: false,
            exitCode: 19820, // Expect matching prev_key_block_seqno
        });
        expect(response.transactions).toHaveTransaction({
            from: liteClient.address,
            to: sender.address,
            success: true,
            inMessageBounced: true,
        });
    });
});
