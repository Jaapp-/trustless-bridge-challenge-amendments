import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/pruned_branch_issue.tact',
    options: {
        debug: true,
    },
};
