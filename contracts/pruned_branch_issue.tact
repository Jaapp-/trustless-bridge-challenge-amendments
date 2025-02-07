import "@stdlib/deploy";

message OneCell {
    cell: Cell;
}

contract PrunedBranchIssue with Deployable {
    receive(msg: OneCell) {
        // Cell only has the following functions:
        // - Cell.beginParse
        // - Cell.hash
        // - Cell.asSlice
        //
        // Both beginParse and asSlice will throw. Tact supplies no other way to parse deeper into the cell.
        msg.cell.beginParse();
    }
}
