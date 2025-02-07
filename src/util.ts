import { Address, beginCell, BitBuilder, BitString, Builder, Cell, Dictionary } from '@ton/core';
import { Hashmap, storeHashmap } from './gen/block';
import { Network } from './constants';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV3R2 } from '@ton/ton';

export const intToIP = (int: number) => {
    const part1 = int & 255;
    const part2 = (int >> 8) & 255;
    const part3 = (int >> 16) & 255;
    const part4 = (int >> 24) & 255;

    return `${part4}.${part3}.${part2}.${part1}`;
};

export const cellHashMapToDict = (hashmap: Hashmap<Cell>) => {
    let cell1 = beginCell();
    storeHashmap<Cell>(hashmap, (arg: Cell) => {
        return (builder: Builder) => {
            let c = beginCell();
            c.storeSlice(arg.beginParse(true));
            builder.storeRef(c);
        };
    })(cell1);
    return Dictionary.loadDirect(Dictionary.Keys.Uint(32), Dictionary.Values.Cell(), cell1.endCell());
};

export const bitStringToBuffer = (bitString: BitString): Buffer => {
    const builder = new BitBuilder(bitString.length);
    builder.writeBits(bitString);
    return builder.buffer();
};

export const bufferToBigInt = (buffer: Buffer) => {
    return BigInt(`0x${buffer.toString('hex')}`);
};

export const opposingNetwork = (network: Network): Network => {
    switch (network) {
        case 'custom':
            return 'testnet';
        case 'testnet':
            return 'custom';
        default:
            throw new Error(`Network ${network} not supported`);
    }
};

export const addressToFastnet = (source: string) => {
    const addr = Address.parse(source);
    return `${addr.workChain}:${addr.hash.toString('hex')}`;
};

export const getWorkChainId = (network: Network) => {
    return network === 'custom' ? -1 : 0;
};

export const newWallet = async (network: Network) => {
    const mnemonic = await mnemonicNew(24, '');
    const pk = await mnemonicToPrivateKey(mnemonic, '');
    console.log(mnemonic.join(' '));

    const wallet = WalletContractV3R2.create({ workchain: getWorkChainId(network), publicKey: pk.publicKey });

    console.log(wallet.address);
};
