import "@stdlib/deploy";

import "./common/block_and_filehash.tact";
import "./common/signature_map.tact";
import "./common/check_block.tact";
import "./common/slice_load_nth_ref.tact";
import "./common/begin_parse_exotic.tact";

const MAX_PENDING_REQUESTS: Int = 100;

message(0x91d555f7) CheckTransaction {
    transaction: Int as uint256;
    proof: Cell;
    current_block: Cell;
}

message(0x756adff1) TransactionChecked {
    transaction: Int as uint256;
}

message ProvableBlock {
    block_and_filehash: Cell;
    signatures: Cell;
}

message PendingRequestState {
    transaction: Int;
    sender: Address;
}

message(0xd53276db) Excesses {}


contract TransactionChecker with Deployable {
    override const storageReserve: Int = ton("0.1");

    liteClient: Address;
    pendingRequests: map<Int as uint64, PendingRequestState>;
    pendingRequestIdx: Int as uint64;

    init(liteClient: Address) {
        self.liteClient = liteClient;
        self.pendingRequestIdx = 0;
    }

    fun findTrustedTransaction(root: Cell, transactionHash: Int): Bool {
        let cell = root.beginParseExotic();
        // Check if the pruned branch cell's hash equals the transaction we're looking for
        //
        // TODO: This is insufficient as it allows parsing of transaction message contents within a non-pruned transaction
        // Parse entire map properly instead
        if (cell.isExotic) {
            cell.slice.skipBits(16);
            let hash  = cell.slice.loadUint(256);
            return hash == transactionHash;
        }
        let slice = root.asSlice();

        repeat (slice.refs()) {
            if (self.findTrustedTransaction(slice.loadRef(), transactionHash)) {
                return true;
            }
        }
        return false;
    }

    fun validateTransaction(transactionHash: Int, proof: Cell): Bool {
        let extra = proof.asSlice().loadNthRef(3);
        let blocks = extra.asSlice().loadNthRef(2);
        let accountDictRoot = blocks.asSlice().loadRef();
        return self.findTrustedTransaction(accountDictRoot, transactionHash);
    }

    fun requestCheckBlock(provableBlock: ProvableBlock, transaction: Int) {
        self.forward(self.liteClient, CheckBlock{
            query_id: self.pendingRequestIdx,
            block: provableBlock.block_and_filehash,
            signatures: provableBlock.signatures,
        }.toCell(), true, null);

        let request = PendingRequestState{
            sender: sender(),
            transaction: transaction,
        };
        self.pendingRequests.set(self.pendingRequestIdx, request);
        self.pendingRequestIdx += 1;
        // Limit pending requests size
        if (self.pendingRequestIdx > MAX_PENDING_REQUESTS) {
            self.pendingRequests.del(self.pendingRequestIdx - MAX_PENDING_REQUESTS);
        }
    }

    receive(msg: CheckTransaction) {
        let provableBlock = ProvableBlock.fromCell(msg.current_block);
        let blockAndFileHash = BlockAndFileHash.fromCell(provableBlock.block_and_filehash);
        let headerProofCell = blockAndFileHash.block.beginParseExotic();
        let headerCell = headerProofCell.slice.loadRef();
        let transactionMerkleProof = msg.proof.beginParseExotic();
        let transactionProof = transactionMerkleProof.slice.loadRef();

        // We fixed the logic, so that we actually compare the pruned proofs
        require(headerCell.hash0() == transactionProof.hash0(), "Expect block and proof hashes match");
        require(self.validateTransaction(msg.transaction, transactionProof), "Expect valid transaction");
        self.requestCheckBlock(provableBlock, msg.transaction);
    }

    receive(msg: Correct) {
        require(sender() == self.liteClient, "Expect liteClient sender");
        let stateOpt = self.pendingRequests.get(msg.query_id);
        require(stateOpt != null, "Expect PendingRequestState exists");
        self.pendingRequests.del(msg.query_id);
        let state = stateOpt!!;

        send(SendParameters{
            to: state.sender,
            value: 0,
            mode: SendRemainingValue + SendIgnoreErrors,
            body: TransactionChecked{
                transaction: state.transaction
            }.toCell()
        });
    }

    bounced(msg: bounced<CheckBlock>) {
        require(sender() == self.liteClient, "Expect liteClient sender");
        let stateOpt = self.pendingRequests.get(msg.query_id);
        require(stateOpt != null, "Expect PendingRequestState exists");
        self.pendingRequests.del(msg.query_id);
        let state = stateOpt!!;

        // Send value back to original sender
        self.forward(state.sender, Excesses{}.toCell(), false, null);
    }
}
