struct Signature {
    node_id_short: Int;
    signature: Cell;
}

struct SignatureMap {
    signatures: map<Int as uint16, Signature>
}
