import { TransactionChecker } from '../wrappers/TransactionChecker';
import { NetworkProvider } from '@ton/blueprint';
import { requireAddress } from '../src/ui';
import { deploy } from '../src/deploy';

export async function run(provider: NetworkProvider, args: string[]) {
    const address = requireAddress(args[0], __filename);
    const transactionCheckerInit = await TransactionChecker.init(address);
    await deploy(provider, transactionCheckerInit);
}
