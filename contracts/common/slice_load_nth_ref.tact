extends mutates fun loadNthRef(self: Slice, n: Int): Cell {
    repeat (n) {
        self.loadRef();
    }
    return self.loadRef();
}

