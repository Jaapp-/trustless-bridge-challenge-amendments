struct ExoticCell {
    slice: Slice;
    isExotic: Bool;
}

asm extends fun beginParseExotic(self: Cell): ExoticCell {
    XCTOS
}

asm extends fun hash0(self: Cell): Int {
    0 CHASHI
}
