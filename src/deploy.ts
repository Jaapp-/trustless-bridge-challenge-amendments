import { NetworkProvider } from '@ton/blueprint';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { MnemonicProvider, WalletVersion } from '@ton/blueprint/dist/network/send/MnemonicProvider';
import { getWorkChainId } from './util';
import { beginCell, contractAddress, StateInit, toNano } from '@ton/core';

export function getDeployBody() {
    let cell = beginCell();
    cell.storeUint(2490013878, 32);
    cell.storeUint(0n, 64);
    return cell.endCell();
}

export const createSenderProvider = async (provider: NetworkProvider) => {
    const mnemonic = process.env.WALLET_MNEMONIC ?? '';
    const walletVersion = process.env.WALLET_VERSION ?? '';
    const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
    const mp = new MnemonicProvider({
        version: walletVersion.toLowerCase() as WalletVersion,
        client: provider.api(),
        secretKey: keyPair.secretKey,
        ui: provider.ui(),
        workchain: getWorkChainId(provider.network()),
    });
    if (provider.network() === 'custom') {
        provider.ui().write(`Fastnet - Actual wallet address: ${mp.address()}`);
    }
    return mp;
};

export async function deploy(provider: NetworkProvider, liteClientInit: StateInit) {
    const senderProvider = await createSenderProvider(provider);
    const toAddress = contractAddress(getWorkChainId(provider.network()), liteClientInit);
    provider.ui().write(`Deploying from ${senderProvider.address()} to ${toAddress}`);
    await senderProvider.sendTransaction(toAddress, toNano('0.15'), getDeployBody(), liteClientInit);
    await provider.waitForDeploy(toAddress);
}
