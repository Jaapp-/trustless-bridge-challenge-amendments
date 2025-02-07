# TON Trustless Bridge Challenge

## Edit

At time of submission I did not realize `XCTOS`'s existence. Furthermore, the implementation did not protect against
duplicate signatures. This Edit fixes both of these issues. Some new, much more efficient, transactions can be seen in
[log-testnet.md](./log-testnet.md).

## Overview

TACT implementation of LiteClient and TransactionChecker for the [Trustless Bridge Challenge](https://contest.com/docs/TrustlessBridgeChallenge).

## Project structure

This project uses [Blueprint SDK](https://docs.ton.org/v3/documentation/smart-contracts/getting-started/javascript) and
should feel familiar.

- `contracts` - LiteClient and TransactionChecker TACT implementation.
- `tests` - Tests for the contracts using blueprint.
- `src` - Supporting Typescript code.
    - `src/ts-impl` - Typescript implementation of challenge including tests.
    - `src/gen` - TLB parsing code generated with `tlb-codegen`.
    - `src/lite-client` - Code interacting with `ton-lite-client`
    - `src/toncenter` - Code interacting with toncenter APIs
    - `src/deploy` - Code for patching deployments for Fastnet
- `scripts` - Scripts to deploy contracts and download test data.

Get started by running the tests:

```shell
npm install
npx blueprint build LiteClient
npx blueprint build TransactionChecker
npx blueprint build PrunedBranchIssue
npm test
```

## Security Design

We aim to make these contracts trustless by only relying on init data. Beyond that, all inputs are verified based on
existing trusted state.

### LiteClient

To keep the LiteClient fully trustless, we initialize the contract with a `seqno` and a set of validators. After
initialization, new data is only accepted after verification based on the contract's current state.

Both `new_key_block` and `check_block` functions will:

1. Verify that the block corresponds to the known network, chain and epoch
    - in `new_key_block`, ensures the block is a key block
2. Calculate the root hash of the entire given block
3. Construct a message with the given `file_hash` and calculated `root_hash`
4. Verify that 2/3 (of `total_weight`) of validators' signatures have signed the message
5. In `new_key_block` we accept the new mc block and load its validators and seqno

We trust our known validators.
We verify that given signatures correspond to known validators.
We verify that the given block, through `root_hash`, corresponds entirely to the provided signatures.
Now that we can trust the block, we check its contents to verify it's the one we're looking for, and load its validators
and seqno.

### TransactionChecker

We initialize TransactionChecker with an address to a deployed LiteClient contract. This is the root of our trust.

For `check_transaction`, we take a block along with its `file_hash` and `signatures` and send it to LiteClient
for verification.
On `Correct` response, we know we can trust the block.

We compare given proof's calculated `root_hash` to the block's calculated `root_hash`.
If they match, we can trust the proof too.

The last step is to check whether the transaction's hash can be found within the proof.
If so, we have proven that the transaction is committed in the master chain block of LiteClient's current epoch.

> NOTE: For performance we actually check whether the transaction is in the proof before interacting with LiteClient

## Issues

### Unable parse cell containing pruned branches

Due to:

1. The VM will not accept a root cell with level != 0
2. The level of a cell is > 0 if any of its (nested) children is a pruned branch cell (unless their parent is a MERKLE_PROOF/UPDATE cell)
3. Tact throws on `beginParse()` and `asSlice()` on any exotic cell which leaves no way to traverse a BoC past a MERKLE_PROOF/UPDATE cell

It seems to be impossible to work with proofs or blocks that contain pruned branches.

As a workaround, this implementation uses full block data to avoid pruned branches and level > 0 cells entirely.
This issue has made the gas costs of the contracts very high, unfortunately.
Ideally something similar to `beginParse(allowExotic: true)` is added to Tact.

I believe additional language support is required to allow making both contracts reasonably efficient
while using Tact.

We included `tests/PrunedBranchIssue.spec.ts`: a proof of concept that shows how Tact is unable to parse the block
header example at https://docs.ton.org/v3/documentation/data-formats/tlb/proofs#block-header at all.

### Generated contract has hardcoded workchain=0 address

When building a contract with Blueprint, the init methods it exposes will set address's workchain to 0.
Fastnet requires workchain=-1.

```typescript
async function fromInit(global_id: bigint, seqno: bigint, validatorSet: ValidatorSet) {
    const init = await LiteClient_init(global_id, seqno, validatorSet);
    const address = contractAddress(0, init);
    return new LiteClient(address, init);
}
```

This doesn't seem configurable. As a workaround we use the contract's constructor, even though it's private.

### Blueprint sender has hardcoded workchain=0 address

Similarly to the above issue, the address of Blueprint's sender is hardcoded to workchain=0 as well.
As a workaround, we instantiate a `MnemonicProvider` with workchain=-1 in case of Fastnet.

### Fastnet generated wallet invalid private key

The Fastnet Faucet at http://109.236.91.95:88/ allows for generating a new wallet, though the given private key is only
32 bytes. KeyPair is assumed to have a secretKey of 64 bytes. I haven't been able to find a way to use the generated wallet.

As a workaround, we generate our own wallets for Fastnet:

```typescript
const mnemonic = await mnemonicNew(24, '');
const pk = await mnemonicToPrivateKey(mnemonic, '');
const wallet = WalletContractV3R2.create({ workchain: getWorkChainId(network), publicKey: pk.publicKey });
```

### Tact parsing limitations

Tact's structs are generally handy, but not very useful for parsing the block data in this challenge. Structs do not
provide enough control over the binary layout of its underlying cells.

In our implementation we use a combination of manual Cell parsing and Structs for parsing simpler cells.

Some notable limitations:

- Using Struct.fromSlice will throw if there are remaining bits or refs in the slice.
- There is no equivalent of `loadDirect` for hashmaps, sometimes it's required to wrap a cell in another cell such that
  Tact can parse it as a map.

### ton-lite-client proof fetching syntax

The syntax of `ton-lite-client` can be awkward. Especially fetching proofs with listBlockTransactions:

```typescript
listBlockTransactions: (
    block: BlockID,
    args?: {
        mode: number;
        count: number;
        after?: liteServer_transactionId3 | null | undefined;
        wantProof?: boolean;
    },
    queryArgs?: QueryArgs,
) => Promise<import('./schema').liteServer_blockTransactions>;
```

Using `wantProof` here will make the request fail with non-descriptive error.
Instead, `wantProof: undefined` along with `mode: 1 << 5` should be used.

## Scripts

Scripts can take arguments (like address, or seqno). Run a script without arguments to see its usage.

The default network is set to fastnet. Pass `--testnet` to use testnet instead.
Scripts that talk to contracts will use given network, but fetch data from the opposing network (between fastnet and testnet).

Using `--mnemonic` is recommended for both testnet and fastnet interactions.

These scripts are available, script arguments are shown as `<argument>`:

- `deployLiteClient` - Fetch init data from last key block and deploy LiteClient
- `deployTransactionChecker` - Deploy TransactionChecker with provided LiteClient `<address>`
- `liteClientCheckBlock` - Run `check_block` on provided LiteClient `<address>` for provided `<seqno>`
- `liteClientGetSeqno` - Print epoch's seqno for provided LiteClient `<address>`
- `liteClientNewKeyBlock` - Run `new_key_block` on provided LiteClient `<address>` for provided `<seqno>`
- `liteClientSync` - Sync all missing key blocks for provided LiteClient `<address>`
- `transactionChecker` - Run `check_transaction` on provided TransactionChecker `<address>`
- `fetchBlockBySeqno` - Fetch a block by seqno into `tests/__test_data__`
- `fetchHeaderBySeqno` - Fetch a block header by seqno into `tests/__test_data__`
- `fetchTestData` - Fetch the last `<num>` key blocks into `tests/__test_data__`
- `fetchTransactionsProofBySeqno` - Fetch block transactions proof by seqno into `tests/__test_data__`

E.g., use the following command to check a transaction with TransactionChecker:

`npx blueprint run --mnemonic transactionchecker Ef-AubEAoI8JjuxXaRr6HEijPzrOexfqoNM3rEduhqOJXJaI 27770658`

### LiteClient Testnet Deployment

To deploy LiteClient on testnet that syncs fastnet blocks:

```
$ npx blueprint build liteclient
$ npx blueprint run --mnemonic --testnet deployLiteClient

Contract deployed at address EQAyJy7wlODUL8qbVSehfyP6j7Zsw5EvtMdocP1JI30MIlUX
```

Get the seqno:

```
$ npx blueprint run --mnemonic --testnet liteClientGetSeqno EQAyJy7wlODUL8qbVSehfyP6j7Zsw5EvtMdocP1JI30MIlUX

Seqno: 765944
```

Check a block within the epoch:

```
$ npx blueprint run --mnemonic --testnet liteClientCheckBlock EQAyJy7wlODUL8qbVSehfyP6j7Zsw5EvtMdocP1JI30MIlUX 765945

Sent transaction
```

Transaction successful at: https://testnet.tonscan.org/tx/b65cbb8e80484ef5e4e1fdc5fe1f2422b524789fe965516750a302a841be2089

Check a block from before the epoch:

```
$ npx blueprint run --mnemonic --testnet liteClientCheckBlock EQAyJy7wlODUL8qbVSehfyP6j7Zsw5EvtMdocP1JI30MIlUX 765943

Sent transaction
```

Transaction failed at: https://testnet.tonscan.org/tx/c5149ab2e95b0140531a3dcc8086eb529ed6a82a95721ef85fe23278a64953a9

### TransactionChecker Testnet Deployment

To deploy TransactionChecker on testnet using above LiteClient:

```
$ npx blueprint build transactionchecker
$ npx blueprint run --mnemonic --testnet deployTransactionChecker EQAyJy7wlODUL8qbVSehfyP6j7Zsw5EvtMdocP1JI30MIlUX

Contract deployed at address EQDgKDi4Wq1eGh0Xyl2zUgaIolXdQ0gRHJQ4Q_uz5Xh_Al7_
```

Check a valid transaction:

```
$ npx blueprint run --mnemonic --testnet transactionChecker EQDgKDi4Wq1eGh0Xyl2zUgaIolXdQ0gRHJQ4Q_uz5Xh_Al7_ 765945

? Choose a transaction to check 47ddbc7c35d24a6257bdf4e417d68dd9d64b0a1fdc9096803c66dcebe46e4247: to=3333333333333333333333333333333333333333333333333333333333333333 lt=765945000001
Sent transaction
```

Transaction successful at: https://testnet.tonscan.org/tx/321cf968ba1ea7db8dd64ce5c5f4e2d60180096abb10d01f5e36bb3f45ec40ab

Check a transaction from a block of a previous epoch:

```
$ npx blueprint run --mnemonic --testnet transactionChecker EQDgKDi4Wq1eGh0Xyl2zUgaIolXdQ0gRHJQ4Q_uz5Xh_Al7_ 765943

? Choose a transaction to check c30cae38efa60e63e72ae02f3cc49a6b94ec05d364a9a550e41e5667bd990084: to=3333333333333333333333333333333333333333333333333333333333333333 lt=765943000001
Sent transaction
```

Transaction failed at: https://testnet.tonscan.org/tx/f5d7b032fda62b7a6a0e1323f034549d1fad909ed0b5d349b5477cd75a1eb2f3

### LiteClient Fastnet Deployment

We do the same steps as above, but we don't pass `--testnet` to use the custom Fastnet network, as defined in
the Blueprint config. We deploy to Fastnet and sync Testnet blocks:

```
npx blueprint run --mnemonic deployliteclient
Contract deployed at address Ef-46jk8v7obKFpikQ5HOvylr92SXzY2oJsuBQ0Py55BN2uk
```

http://109.236.91.95:8080/transaction?account=Ef-46jk8v7obKFpikQ5HOvylr92SXzY2oJsuBQ0Py55BN2uk&lt=833945000003&hash=B1F14E86C7F725CD098FF86750EDE851FA4DE0DAEEEF6CD8A597A6E13FC2B115

```
$ npx blueprint run --mnemonic liteClientGetSeqno Ef-46jk8v7obKFpikQ5HOvylr92SXzY2oJsuBQ0Py55BN2uk
Seqno: 27788014
```

```
$ npx blueprint run --mnemonic liteclientcheckblock Ef-46jk8v7obKFpikQ5HOvylr92SXzY2oJsuBQ0Py55BN2uk 27788015
Sent transaction
```

Successful transaction: http://109.236.91.95:8080/transaction?account=Ef-46jk8v7obKFpikQ5HOvylr92SXzY2oJsuBQ0Py55BN2uk&lt=834160000003&hash=B2D83DC5C2DDAAEFF0233BD8123C0878A93FC8933111519BEAFE7046C4AB1849

```
$ npx blueprint run --mnemonic liteclientcheckblock Ef-46jk8v7obKFpikQ5HOvylr92SXzY2oJsuBQ0Py55BN2uk 27788013
Sent transaction
```

Bounced transaction: http://109.236.91.95:8080/transaction?account=Ef-46jk8v7obKFpikQ5HOvylr92SXzY2oJsuBQ0Py55BN2uk&lt=834293000003&hash=32307CCFD3E91C8411F93C27853EDF96CCF4641F336A0AEA15A16D1C0DC4ADC0

### TransactionChecker Fastnet Deployment

```
$ npx blueprint run --mnemonic deploytransactionchecker Ef-46jk8v7obKFpikQ5HOvylr92SXzY2oJsuBQ0Py55BN2uk
Contract deployed at address Ef8npOe0GcnsL21pPs5xkZnmoGUjGeKEAYnz7oUZPsbM_CZd
```

http://109.236.91.95:8080/transaction?account=Ef8npOe0GcnsL21pPs5xkZnmoGUjGeKEAYnz7oUZPsbM_CZd&lt=834660000003&hash=943692B1EFD62016DD949696DAAE9E8CEB5FDFCFAB280F6FCF2A8EEFD84D6DD5

```
$ npx blueprint run --mnemonic transactionchecker Ef8npOe0GcnsL21pPs5xkZnmoGUjGeKEAYnz7oUZPsbM_CZd 27788015
? Choose a transaction to check 693070dfe7176fa59d726acc3654f37b3602344b84c074217438a5dc992064e9: to=3333333333333333333333333333333333333333333333333333333333333333 lt=30975094000001
Fastnet - Actual wallet address: Ef-MlcZAoLk8KDQ-PkvPtbjYhuTUq0zbYr22I8ne4a6wyE06
Sent transaction
```

Successful transaction: http://109.236.91.95:8080/transaction?account=Ef-MlcZAoLk8KDQ-PkvPtbjYhuTUq0zbYr22I8ne4a6wyE06&lt=838091000009&hash=82D3C80D147644139AD0B006BFC461D7DDA58AEA216C5E518A4CCF7A7006D2BB

```
$ npx blueprint run --mnemonic transactionchecker Ef8npOe0GcnsL21pPs5xkZnmoGUjGeKEAYnz7oUZPsbM_CZd 27788012

Using file: transactionChecker
? Choose a transaction to check 4834bcc1cff6ea758f353a7883a3a08791706c23b914be683d6a9f74736534c0: to=3333333333333333333333333333333333333333333333333333333333333333 lt=30975091000001
Fastnet - Actual wallet address: Ef93At4Ap0xs4BIVAFF3lS4qtM4EiBLImNrDTmxXN7CHlyLJ
Sent transaction
```

Transaction failed (Excess 0xd53276db returned): http://109.236.91.95:8080/transaction?account=Ef8npOe0GcnsL21pPs5xkZnmoGUjGeKEAYnz7oUZPsbM_CZd&lt=840683000003&hash=E9BF819390F5C336FA5509671A8EC86906E518599BC704402AD7382E54BFADE3
