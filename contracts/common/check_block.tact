message(0x8eaa9d76) CheckBlock {
    query_id: Int as uint64;
    block: Cell;
    signatures: Cell;
}

message(0xce02b807) Correct {
    query_id: Int as uint64;
    block_hash: Int as uint256;
}

