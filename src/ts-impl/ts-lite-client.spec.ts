import { TsLiteClient } from './ts-lite-client';
import { parseBlock } from '../parser';
import { readTestData, readTestDataJson } from '../../tests/testUtil';
import { BlockSignatures } from '../toncenter';
import {
    createBlockAndFileHash,
    createCheckBlock,
    createNewKeyBlock,
    createSignatureMap,
    createValidatorSet,
} from '../structs';
import { sha256 } from '@ton/crypto';
import { Cell } from '@ton/core';

describe('ts-lite-client', () => {
    it('should validate a new key block', async () => {
        const initBlock = await readTestData('testnet-27689041-key.block');
        const initValidators = await createValidatorSet(parseBlock(initBlock));
        const nextBlock = await readTestData('testnet-27689757-key.block');

        const liteClient = new TsLiteClient(-3, 27689041, initValidators);

        const signatures: BlockSignatures = await readTestDataJson('testnet-27689757-key.signatures.json');
        const fileHash = await sha256(nextBlock);
        const newKeyBlock = createNewKeyBlock(
            0n,
            await createBlockAndFileHash(Cell.fromBoc(nextBlock)[0], fileHash),
            createSignatureMap(signatures),
        );

        await liteClient.newKeyBlock(newKeyBlock);
    });
    it('should check a non-key block', async () => {
        const initBlock = await readTestData('testnet-27683262-key.block');
        const initValidators = await createValidatorSet(parseBlock(initBlock));
        const nonKeyBlock = await readTestData('testnet-27683263.block');
        const signatures: BlockSignatures = await readTestDataJson('testnet-27683263.signatures.json');

        const liteClient = new TsLiteClient(-3, 27683262, initValidators);

        const checkBlock = createCheckBlock(
            0n,
            await createBlockAndFileHash(Cell.fromBoc(nonKeyBlock)[0], await sha256(nonKeyBlock)),
            createSignatureMap(signatures),
        );

        await liteClient.checkBlock(checkBlock);
    });
});
