import { NetworkProvider } from '@ton/blueprint';
import { getClient } from './fetchTestData';
import { parseBlock } from '../src/parser';
import { createValidatorSet } from '../src/structs';
import { getLastMcBlock } from '../src/lite-client';
import { LiteClient } from '../wrappers/LiteClient';
import { opposingNetwork } from '../src/util';
import { deploy } from '../src/deploy';

export async function run(provider: NetworkProvider) {
    provider.ui().write('Loading last mc block');
    const client = await getClient(opposingNetwork(provider.network()));
    const lastMcBlockResponse = await getLastMcBlock(client);
    const lastMcBlock = parseBlock(lastMcBlockResponse.data);
    const validatorSet = await createValidatorSet(lastMcBlock);
    const globalId = BigInt(lastMcBlock.global_id);
    const seqNo = BigInt(lastMcBlock.info.seq_no);

    let validators = validatorSet.validators;
    provider
        .ui()
        .write(`Deploying contract for globalId=${globalId} seqNo=${seqNo} validators=${validators.values().length}`);

    const liteClientInit = await LiteClient.init(globalId, seqNo, validatorSet);
    await deploy(provider, liteClientInit);
}
