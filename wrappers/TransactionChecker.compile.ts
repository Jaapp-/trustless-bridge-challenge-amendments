import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/transaction_checker.tact',
    options: {
        debug: false,
        masterchain: true,
    },
};
