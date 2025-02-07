import { Cell } from '@ton/core';
import { TsLiteClient } from './ts-lite-client';
import {
    CheckTransaction,
    loadBlockAndFileHash,
    loadProvableBlock,
    loadSignatureMap,
} from '../../wrappers/TransactionChecker';
import { createCheckBlock } from '../structs';
import { bufferToBigInt } from '../util';

export class TsTransactionChecker {
    private client: TsLiteClient;

    constructor(client: TsLiteClient) {
        this.client = client;
    }

    private findTrustedTransaction(root: Cell, transaction: bigint) {
        if (root.isExotic) {
            return bufferToBigInt(root.hash(0)) === transaction;
        }

        for (const ref of root.refs) {
            if (this.findTrustedTransaction(ref, transaction)) {
                return true;
            }
        }
        return false;
    }

    private validateTransaction(transaction: bigint, proof: Cell): boolean {
        const extra = proof.refs[3];
        const blocks = extra.refs[2];
        const accountDictRoot = blocks.refs[0];
        return this.findTrustedTransaction(accountDictRoot, transaction);
    }

    checkTransaction(msg: CheckTransaction) {
        const provableBlock = loadProvableBlock(msg.current_block.asSlice());
        const blockAndFileHash = loadBlockAndFileHash(provableBlock.block_and_filehash.asSlice());
        const signatures = loadSignatureMap(provableBlock.signatures.asSlice());

        if (!blockAndFileHash.block.hash(0).equals(msg.proof.refs[0].hash(0))) {
            throw new Error('Expect block and proof hash match');
        }

        if (!this.validateTransaction(msg.transaction, msg.proof.refs[0])) {
            throw new Error('Expect valid transaction');
        }

        if (!this.client.checkBlock(createCheckBlock(0n, blockAndFileHash, signatures))) {
            throw new Error('Expect check block');
        }
        return true;
    }
}
