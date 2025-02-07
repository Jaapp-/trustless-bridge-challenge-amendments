import path from 'path';
import { Address } from '@ton/core';

export function usageError(filename: string, args: string) {
    return new Error(`Usage: npx blueprint run ${path.basename(filename).split('.')[0]} ${args}`);
}

export function requireAddress(arg: string, filename: string, args = '<address>') {
    if (!arg) {
        throw usageError(filename, args);
    }
    return Address.parse(arg);
}

export function requireSeqNo(arg: string | undefined, filename: string, args = '<seqno>') {
    if (!arg || !parseInt(arg)) {
        throw usageError(filename, args);
    }
    return parseInt(arg);
}
