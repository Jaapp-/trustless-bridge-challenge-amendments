import { readTestData, readTestDataJson } from '../../tests/testUtil';
import {
    createBlockAndFileHash,
    createCheckTransaction,
    createProvableBlock,
    createSignatureMap,
    createValidatorSet,
} from '../structs';
import { parseBlock, parseProofTransactions } from '../parser';
import { TsLiteClient } from './ts-lite-client';
import { TsTransactionChecker } from './ts-transaction-checker';
import { SignatureMap } from '../../wrappers/LiteClient';
import { liteServer_blockTransactions } from 'ton-lite-client/dist/schema';
import { Cell } from '@ton/core';
import { sha256 } from '@ton/crypto';

describe('ts-transaction-checker', () => {
    it('should validate a transaction', async () => {
        const initBlock = await readTestData('testnet-27683262-key.block');
        const initValidators = await createValidatorSet(parseBlock(initBlock));
        const liteClient = new TsLiteClient(-3, 27683262, initValidators);

        const nextBlock = await readTestData('testnet-27683263.block');
        const signatureMap: SignatureMap = createSignatureMap(
            await readTestDataJson('testnet-27683263.signatures.json'),
        );
        const bnfh = await createBlockAndFileHash(Cell.fromBoc(nextBlock)[0], await sha256(nextBlock));
        const provableBlock = createProvableBlock(bnfh, signatureMap);
        const transactionResponse: liteServer_blockTransactions = await readTestDataJson(
            'testnet-27683263.transactions.json',
        );
        const [transactionProof] = Cell.fromBoc(transactionResponse.proof);
        const transactions = parseProofTransactions(transactionProof.refs[0]);
        const checkTransaction = createCheckTransaction(
            transactions[0],
            Cell.fromBoc(transactionResponse.proof)[0],
            provableBlock,
        );
        const transactionChecker = new TsTransactionChecker(liteClient);
        const response = transactionChecker.checkTransaction(checkTransaction);
        expect(response).toBeTruthy();
    });
});
