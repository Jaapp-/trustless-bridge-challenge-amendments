import { Block, loadBlock } from '../gen/block';
import crypto from 'crypto';
import { beginCell, Slice } from '@ton/core';
import {
    CheckBlock,
    loadBlockAndFileHash,
    loadSignatureMap,
    NewKeyBlock,
    Signature,
    SignatureMap,
    Validator,
    ValidatorSet,
} from '../../wrappers/LiteClient';
import { createValidatorSet } from '../structs';

/**
 * init with current_validators
 *
 * new_key_block#11a78ffe query_id:uint64 block:^Cell signatures:^Cell = InternalMsgBody;
 *
 * block contains BlockIdExt and RootCell
 *
 * Validate BlockIdExt.root_hash == RootCell.hash()
 * Create signatures
 *
 *
 * check_block#8eaa9d76 query_id:uint64 block:^Cell signatures:^Cell = InternalMsgBody;
 */
export class TsLiteClient {
    private readonly globalId: number;
    private seqNo: number;
    private validatorSet: ValidatorSet;

    constructor(globalId: number, seqNo: number, validatorSet: ValidatorSet) {
        this.globalId = globalId;
        this.seqNo = seqNo;
        this.validatorSet = validatorSet;
    }

    async newKeyBlock(msg: NewKeyBlock): Promise<boolean> {
        const block = loadBlockAndFileHash(msg.block.asSlice());
        const signatures = loadSignatureMap(msg.signatures.asSlice());

        const rootHash = block.block.hash(0);
        const parsedBlock = loadBlock(block.block.asSlice());

        this.validateMcBlock(parsedBlock, true);
        if (!validateSignatures(rootHash, block.fileHash, signatures, this.validatorSet)) {
            throw new Error('Invalid signatures');
        }

        this.validatorSet = await createValidatorSet(parsedBlock);
        this.seqNo = parsedBlock.info.seq_no;
        return true;
    }

    async checkBlock(msg: CheckBlock): Promise<boolean> {
        const block = loadBlockAndFileHash(msg.block.asSlice());
        const signatures = loadSignatureMap(msg.signatures.asSlice());

        const rootHash = block.block.hash(0);
        const parsedBlock = loadBlock(block.block.asSlice());

        this.validateMcBlock(parsedBlock, false);
        if (!validateSignatures(rootHash, block.fileHash, signatures, this.validatorSet)) {
            throw new Error('Invalid signatures');
        }
        return true;
    }

    private validateMcBlock(parsedBlock: Block, requireKey: boolean) {
        if (parsedBlock.global_id !== this.globalId) {
            throw new Error(`Expected network ${this.globalId}, got ${parsedBlock.global_id}`);
        }
        if (parsedBlock.info.not_master) {
            throw new Error(`Expected network master chain block`);
        }
        if (requireKey && !parsedBlock.info.key_block) {
            throw new Error('Expected key block');
        }
        if (parsedBlock.info.prev_key_block_seqno !== this.seqNo) {
            throw new Error('Invalid prev_key_bloc_seqno');
        }
    }
}

export const createMessage = (rootHash: Buffer, fileHash: bigint) => {
    return Buffer.concat([
        Buffer.from([0x70, 0x6e, 0x0b, 0xc5]),
        rootHash,
        beginCell()
            .storeUint(fileHash, 256)
            .asSlice()
            .loadBuffer(256 / 8),
    ]);
};

const validateSignature = (message: Buffer, signature: Signature, validator: Validator) => {
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const spkiKey = Buffer.concat([
        spkiPrefix,
        beginCell()
            .storeUint(validator.pub_key, 256)
            .asSlice()
            .loadBuffer(256 / 8),
    ]);
    const publicKey = `-----BEGIN PUBLIC KEY-----\n${spkiKey.toString('base64')}\n-----END PUBLIC KEY-----`;
    const slice: Slice = signature.signature.asSlice();
    return crypto.verify(null, message, publicKey, slice.loadBuffer(slice.remainingBits / 8));
};

const validateSignatures = (rootHash: Buffer, fileHash: bigint, signatures: SignatureMap, validators: ValidatorSet) => {
    const message = createMessage(rootHash, fileHash);
    const requiredWeight = (validators.total_weight * 2n) / 3n;
    let validWeight = 0n;
    for (const [_, signature] of signatures.signatures) {
        const validator = validators.validators.get(signature.node_id_short);
        if (!validator) {
            console.warn(`No validator for ${signature}`);
            return false;
        }
        if (!validateSignature(message, signature, validator)) {
            console.warn(`Invalid signature for ${message} ${signature} ${validator}`);
            return false;
        }
        validWeight += validators.total_weight;
        if (validWeight > requiredWeight) return true;
    }

    return validWeight > requiredWeight;
};
