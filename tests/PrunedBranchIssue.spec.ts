import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { PrunedBranchIssue } from '../wrappers/PrunedBranchIssue';
import '@ton/test-utils';

describe('PrunedBranchIssue', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let prunedBranchIssue: SandboxContract<PrunedBranchIssue>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        prunedBranchIssue = blockchain.openContract(await PrunedBranchIssue.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await prunedBranchIssue.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: prunedBranchIssue.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and prunedBranchIssue are ready to use
    });

    it("can't parse merkle cell or cell with pruned branch children", async () => {
        const sender = await blockchain.treasury('sender');
        // Boc taken from https://docs.ton.org/v3/documentation/data-formats/tlb/proofs#block-transactions
        const buffer = Buffer.from(
            'b5ee9c72010207010001470009460351ed3b9e728e7c548b15a5e5ce988b4a74984c3f8374f3f1a52c7b1f46c26406001601241011ef55aaffffff110204050601a09bc7a98700000000040101dc65010000000100ffffffff000000000000000064b6c356000023d38ba64000000023d38ba64004886d00960007028101dc64fd01dc42bec400000003000000000000002e030098000023d38b96fdc401dc650048a3971c46472b85c8d761060a6e7ae9f13a90cdda815915a89597cfecb393a6b568807adfb3c1c5efc920907225175db61ca384e4f8b313799e3cbb8b7b4085284801018c6053c1185700c0fe4311d5cf8fa533ea0382e361a7b76d0cf299b75ac0356c000328480101741100d622b0d5264bcdb86a14e36fc8c349b82ae49e037002eb07079ead8b060015284801015720b6aefcbf406209522895faa6c0d10cc3315d90bcaf09791b19f595e86f8f0007',
            'hex',
        );
        const [merkleProofCell] = Cell.fromBoc(buffer);
        let result = await prunedBranchIssue.send(
            sender.getSender(),
            { value: toNano('0.05') },
            { $$type: 'OneCell', cell: merkleProofCell },
        );
        expect(result.transactions).toHaveTransaction({
            from: sender.address,
            to: prunedBranchIssue.address,
            success: false,
            exitCode: 9, // Error because `exoticCell.asSlice()` will throw
        });

        // Error: Error while executing transaction: Can't deserialize message boc: [Error : 0 : bag of cells has a root with non-zero level]
        const cellWithPrunedBranchChildren = merkleProofCell.refs[0];
        await expect(async () => {
            await prunedBranchIssue.send(
                sender.getSender(),
                { value: toNano('0.05') },
                { $$type: 'OneCell', cell: cellWithPrunedBranchChildren },
            );
        }).rejects.toThrow(Error);
    });
});
