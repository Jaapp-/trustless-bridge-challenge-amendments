import { Block, loadValidatorSet, ValidatorDescr_validator_addr, ValidatorSet_validators_ext } from './gen/block';
import {
    BlockAndFileHash,
    CheckBlock,
    NewKeyBlock,
    Signature,
    SignatureMap,
    storeBlockAndFileHash,
    storeSignatureMap,
    Validator,
    ValidatorSet,
} from '../wrappers/LiteClient';
import { bitStringToBuffer, bufferToBigInt, cellHashMapToDict } from './util';
import { beginCell, Cell, Dictionary } from '@ton/core';
import { sha256 } from '@ton/crypto';
import { BlockSignatures } from './toncenter';
import { CheckTransaction, ProvableBlock, storeProvableBlock } from '../wrappers/TransactionChecker';

const createValidator = async (v: ValidatorDescr_validator_addr): Promise<Validator> => {
    return {
        $$type: 'Validator',
        weight: v.weight,
        pub_key: beginCell().storeBits(v.public_key.pubkey).asSlice().loadUintBig(256),
    };
};

export const createValidatorSet = async (block: Block): Promise<ValidatorSet> => {
    const custom = block.extra.custom;
    if (custom.kind !== 'Maybe_just') {
        throw new Error('Expected custom');
    }
    const configMap = custom.value.config?.config;
    if (!configMap) {
        throw new Error('Expected configMap to be present');
    }
    const dict = cellHashMapToDict(configMap);
    const configParams = dict.get(34);
    const validatorSet = loadValidatorSet(configParams!.asSlice()) as ValidatorSet_validators_ext;
    const validatorItems = validatorSet.list.values() as ValidatorDescr_validator_addr[];
    const validators = Dictionary.empty<bigint, Validator>();
    for (const item of validatorItems) {
        const validator = await createValidator(item);
        const node_id = await sha256(
            Buffer.concat([Buffer.from([0xc6, 0xb4, 0x13, 0x48]), bitStringToBuffer(item.public_key.pubkey)]),
        );
        validators.set(bufferToBigInt(node_id), validator);
    }
    return {
        $$type: 'ValidatorSet',
        validators: validators,
        total_weight: validatorSet.total_weight,
    };
};

export const createSignatureMap = (signatures: BlockSignatures): SignatureMap => {
    const signatureMap = Dictionary.empty<number, Signature>();
    let i = 0;
    for (const item of signatures.signatures) {
        const signature: Signature = {
            $$type: 'Signature',
            node_id_short: bufferToBigInt(Buffer.from(item.node_id_short, 'base64')),
            signature: beginCell().storeBuffer(Buffer.from(item.signature, 'base64')).endCell(),
        };
        signatureMap.set(i, signature);
        i++;
    }

    return {
        $$type: 'SignatureMap',
        signatures: signatureMap,
    };
};

export const createBlockAndFileHash = async (bytes: Buffer): Promise<BlockAndFileHash> => {
    const fileHash = await sha256(bytes);
    const [rootCell] = Cell.fromBoc(bytes);
    return {
        $$type: 'BlockAndFileHash',
        fileHash: bufferToBigInt(fileHash),
        block: rootCell,
    };
};

export const createNewKeyBlock = (
    queryId: bigint,
    blockAndFileHash: BlockAndFileHash,
    signatureMap: SignatureMap,
): NewKeyBlock => {
    const bnfCell = beginCell();
    storeBlockAndFileHash(blockAndFileHash)(bnfCell);

    const sigCell = beginCell();
    storeSignatureMap(signatureMap)(sigCell);

    return {
        $$type: 'NewKeyBlock',
        query_id: queryId,
        block: bnfCell.endCell(),
        signatures: sigCell.endCell(),
    };
};

export const createCheckBlock = (
    queryId: bigint,
    blockAndFileHash: BlockAndFileHash,
    signatureMap: SignatureMap,
): CheckBlock => {
    const bnfCell = beginCell();
    storeBlockAndFileHash(blockAndFileHash)(bnfCell);

    const sigCell = beginCell();
    storeSignatureMap(signatureMap)(sigCell);

    return {
        $$type: 'CheckBlock',
        query_id: queryId,
        block: bnfCell.endCell(),
        signatures: sigCell.endCell(),
    };
};

export const createProvableBlock = (blockAndFileHash: BlockAndFileHash, signatureMap: SignatureMap): ProvableBlock => {
    const bnfCell = beginCell();
    storeBlockAndFileHash(blockAndFileHash)(bnfCell);

    const sigCell = beginCell();
    storeSignatureMap(signatureMap)(sigCell);

    return {
        $$type: 'ProvableBlock',
        block_and_filehash: bnfCell.endCell(),
        signatures: sigCell.endCell(),
    };
};

export const createCheckTransaction = (
    transaction: Cell,
    proof: Cell,
    provableBlock: ProvableBlock,
): CheckTransaction => {
    const pbCell = beginCell();
    storeProvableBlock(provableBlock)(pbCell);

    return {
        $$type: 'CheckTransaction',
        transaction: bufferToBigInt(transaction.hash(0)),
        proof: proof,
        current_block: pbCell.endCell(),
    };
};
