import { Stream } from 'node:stream';
import fs from 'fs/promises';
import path from 'path';

const TEST_DATA_DIR = path.resolve(__dirname, '__test-data__');

function bufferReviver(key: string, value: any): any {
    if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
        return Buffer.from(value.data);
    }
    return value;
}

export const readTestData = async (fileName: string) => {
    return await fs.readFile(path.resolve(TEST_DATA_DIR, fileName));
};

export const writeTestData = async (
    fileName: string,
    data:
        | string
        | NodeJS.ArrayBufferView
        | Iterable<string | NodeJS.ArrayBufferView>
        | AsyncIterable<string | NodeJS.ArrayBufferView>
        | Stream,
) => {
    return await fs.writeFile(path.resolve(TEST_DATA_DIR, fileName), data);
};

export const readTestDataJson = async (filename: string) => {
    const data = await readTestData(filename);
    return JSON.parse(data.toString(), bufferReviver);
};
