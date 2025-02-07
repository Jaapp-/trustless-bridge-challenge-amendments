import { beginCell, BitString, Builder, Cell } from '@ton/core';
import { storeMERKLE_PROOF } from './gen/block';

export const toPruned = (cell: Cell) => {
    const hash = cell.hash(0);
    return beginCell()
        .storeUint(1, 8)
        .storeUint(1, 8)
        .storeBuffer(hash, 256 / 8)
        .storeUint(cell.depth(), 16)
        .endCell({ exotic: true });
};

export const pruneAllBranchesExceptArray = (cell: Cell, idx: number[]): Cell => {
    const fromSlice = cell.asSlice();
    const toSlice = beginCell();
    toSlice.storeBits(fromSlice.loadBits(fromSlice.remainingBits));
    const refs = fromSlice.remainingRefs;
    for (let i = 0; i < refs; i++) {
        const ref = fromSlice.loadRef();
        if (idx.includes(i)) {
            toSlice.storeRef(ref);
        } else {
            toSlice.storeRef(toPruned(ref));
        }
    }
    return toSlice.endCell();
};

export const pruneAllBranchesExcept = (cell: Cell, idx: number) => {
    return pruneAllBranchesExceptArray(cell, [idx]);
};

export const withRefAtIndex = (cell: Cell, idx: number, replacement: Cell) => {
    const fromSlice = cell.asSlice();
    const toSlice = beginCell();
    toSlice.storeBits(fromSlice.loadBits(fromSlice.remainingBits));

    const refs = cell.refs.length;
    for (let i = 0; i < refs; i++) {
        if (i === idx) {
            fromSlice.loadRef();
            toSlice.storeRef(replacement);
        } else {
            toSlice.storeRef(fromSlice.loadRef());
        }
    }
    return toSlice.endCell();
};

/**
 * Create merkle proof cell with level 0
 *
 * @param cell pruned branch cell to wrap
 */
export const createMerkleProof = (cell: Cell) => {
    const builder = beginCell();
    const hash = cell.hash(0);
    storeMERKLE_PROOF(
        {
            kind: 'MERKLE_PROOF',
            virtual_hash: new BitString(hash, 0, hash.length * 8),
            depth: cell.depth(0),
            virtual_root: cell,
        },
        (c: Cell) => (builder: Builder) => builder.storeSlice(c.beginParse(true)),
    )(builder);
    return builder.endCell({ exotic: true });
};
