import { loadBlock, loadBlockInfo, loadCurrencyCollection } from './gen/block';
import { Builder, Cell, Dictionary, DictionaryValue, Slice } from '@ton/core';

export const parseBlock = (buffer: Buffer) => {
    const [rootCell] = Cell.fromBoc(buffer);
    return loadBlock(rootCell.beginParse());
};

export const parseBlockHeader = (buffer: Buffer) => {
    const [rootCell] = Cell.fromBoc(buffer);
    return loadBlockInfo(rootCell.refs[0].refs[0].beginParse());
};

export const parseProofTransactions = (root: Cell): Cell[] => {
    const extra = root.refs[3];
    const account_blocks = extra.refs[2];
    const shardAccountBlocks = Dictionary.load(
        Dictionary.Keys.BigUint(256),
        <DictionaryValue<Dictionary<bigint, Cell>>>{
            serialize: function (src: unknown, builder: Builder): void {
                throw new Error('Function not implemented.');
            },
            parse: function (src: Slice): any {
                loadCurrencyCollection(src);
                src.skip(4); // magic
                src.skip(256); // AccountBlock.account_addr
                let dict = <Dictionary<bigint, Cell>>Dictionary.loadDirect(
                    Dictionary.Keys.BigUint(64),
                    {
                        serialize: function (src: Cell, builder: Builder): void {
                            throw new Error('Function not implemented.');
                        },
                        parse: function (src: Slice): Cell {
                            loadCurrencyCollection(src);
                            return src.loadRef();
                        },
                    },
                    src,
                );
                src.loadRef();
                return dict;
            },
        },
        account_blocks,
    );
    let transactions = [];
    for (const [_, accountBlock] of shardAccountBlocks) {
        for (const [_, tx] of accountBlock) {
            transactions.push(tx);
        }
    }
    return transactions;
};
