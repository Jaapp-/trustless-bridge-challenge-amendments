import "@stdlib/deploy";

import "./common/block_and_filehash.tact";
import "./common/signature_map.tact";
import "./common/check_block.tact";
import "./common/slice_load_nth_ref.tact";

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
        let slice = root.asSlice();
        // If we were iterating on the proof instead of the full block, we would check if the cell is a pruned branch
        // cell
        if (slice.bits() >= 4 && slice.preloadUint(4) == 0b0111) {
            return slice.hash() == transactionHash;
        }

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

        // blockAndFileHash.block and msg.proof are both the full block due to the exotic cell parsing issue.
        // We keep logic here and transmit both blocks to showcase correctness, even if we were able to
        // parse the pruned versions of the block.
        require(blockAndFileHash.block.hash() == msg.proof.hash(), "Expect block and proof hashes match");
        require(self.validateTransaction(msg.transaction, msg.proof), "Expect valid transaction");
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
