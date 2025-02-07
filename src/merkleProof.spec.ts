import { readTestData } from '../tests/testUtil';
import { Cell, Slice } from '@ton/core';
import { loadMERKLE_PROOF } from './gen/block';
import { createMerkleProof, pruneAllBranchesExcept } from './merkleProof';
import { createConfigProofWithHeader, createHeaderProof } from './structs';

describe('merkleProof', () => {
    it('should create a merkle proof', async () => {
        const header = await readTestData('testnet-27678205.header');
        const [headerRoot] = Cell.fromBoc(header);

        const merkleProof = headerRoot.beginParse(true);
        const proof = loadMERKLE_PROOF(merkleProof, (slice: Slice) => {
            return slice.asCell();
        });
        expect(proof.virtual_root.equals(headerRoot.refs[0])).toBeTruthy();
        const headerMerkle = createMerkleProof(headerRoot.refs[0]);
        expect(headerMerkle.equals(headerRoot)).toBeTruthy();
    });
    it('should create pruned branches', async () => {
        const blockBytes = await readTestData('testnet-27678205-key.block');
        const [blockRoot] = Cell.fromBoc(blockBytes);
        const headerBytes = await readTestData('testnet-27678205.header');
        const [headerRoot] = Cell.fromBoc(headerBytes);
        const headerBlock = headerRoot.refs[0];
        const headerInfo = headerBlock.refs[0];
        expect(headerInfo.equals(blockRoot.refs[0]));
        const prunedBlock = pruneAllBranchesExcept(blockRoot, 0);
        expect(prunedBlock.equals(headerBlock)).toBeTruthy();
        const prunedBlockMerkle = createMerkleProof(prunedBlock);
        expect(prunedBlockMerkle.equals(headerRoot)).toBeTruthy();
    });

    it('should create header proof', async () => {
        const blockBytes = await readTestData('testnet-27678205-key.block');
        const [blockRoot] = Cell.fromBoc(blockBytes);
        const headerBytes = await readTestData('testnet-27678205.header');
        const [headerRoot] = Cell.fromBoc(headerBytes);
        expect(createHeaderProof(blockRoot).equals(headerRoot));
    });

    it('should create config proof', async () => {
        const blockBytes = await readTestData('testnet-27678205-key.block');
        const [blockRoot] = Cell.fromBoc(blockBytes);
        expect(createConfigProofWithHeader(blockRoot).refs[0].hash(0).equals(blockRoot.hash(0)));
    });
});
