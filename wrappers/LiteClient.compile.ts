import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/lite_client.tact',
    options: {
        debug: false,
        masterchain: true,
    },
};
