import "@stdlib/deploy";

import "./common/block_and_filehash.tact";
import "./common/signature_map.tact";
import "./common/check_block.tact";
import "./common/slice_load_nth_ref.tact";

message(0x11a78ffe) NewKeyBlock {
    query_id: Int as uint64;
    block: Cell;
    signatures: Cell;
}

message(0xff8ff4e1) Ok {
    query_id: Int as uint64;
    block_hash: Int as uint256;
}

struct Validator {
    weight: Int as uint64;
    pub_key: Int as uint256;
}

struct ValidatorSet {
    total_weight: Int as uint64;
    validators: map<Int as uint256, Validator>
}

struct ConfigParams {
    config: map<Int as uint32, Cell>;
}

struct SigPubKey {
    magic: Int as uint32; // #8e81278a
    pubkey: Int as uint256;
}

struct ValidatorDesc {
    magic: Int as uint8; // #53
    pk_magic: Int as uint32; // #8e81278a
    pubkey: Int as uint256;
    weight: Int as uint64;
    adnl_addr: Int as uint256;
}

contract LiteClient with Deployable {
    override const storageReserve: Int = ton("0.1");

    seqno: Int as uint32;
    validatorSet: ValidatorSet;
    global_id: Int as int32;

    // We trust this init data so our methods can be fully trustless
    init(global_id: Int, seqno: Int, validatorSet: ValidatorSet) {
        self.global_id = global_id;
        self.seqno = seqno;
        // TODO sort validators by weight desc
        self.validatorSet = validatorSet;
    }

    // We want the correct network, key_block==true, workchain==1, and prev_key_block_seqno matches our own seqno
    fun validateMcBlock(cell: Cell, requireKeyBlock: Bool): Int {
        let slice = cell.asSlice();
        require(slice.loadUint(32) == 300897706, "Expect Block magic");
        require(slice.loadInt(32) == self.global_id, "Expect correct global_id");

        let info = slice.loadRef().asSlice();
        require(info.loadUint(32) == 2613553543, "Expect BlockInfo magic");
        info.skipBits(32 + 6); // version and 6 bools
        let isKey = info.loadBool();
        if (requireKeyBlock) {
            require(isKey, "Expect key_block");
        }
        info.skipBits(1 + 8); // bool, flags
        let seq_no = info.loadUint(32);

        info.skipBits(32 + 2 + 6); // vert_seq_no, shard magic, pfx_bits
        require(info.loadInt(32) == -1, "Expect workchain == -1");
        // shard_prefix gen_utime start_lt end_lt gen_validator_list_hash_short gen_catchain_seqno min_ref_mc_seqno
        info.skipBits(64 + 32 + 64 + 64 + 32 + 32 + 32);
        require(info.loadUint(32) == self.seqno, "Expect matching prev_key_block_seqno");
        return seq_no;
    }

    // Each signature should have a corresponding known validator
    // Sum validator weights to confirm 2/3 majority
    fun validateSignatures(signatureMap: SignatureMap, blockAndFileHash: BlockAndFileHash, rootHash: Int): Bool {
        let message = beginCell()
        .storeUint(0x706e0bc5, 32)
        .storeUint(rootHash, 256)
        .storeUint(blockAndFileHash.fileHash, 256)
        .asSlice();
        let requiredWeight = self.validatorSet.total_weight * 2 / 3;
        let weight = 0;
        foreach (idx, sig in signatureMap.signatures) {
            let validatorOpt = self.validatorSet.validators.get(sig.node_id_short);
            if (validatorOpt != null) {
                let validator = validatorOpt!!;
                if (checkDataSignature(message, sig.signature.asSlice(), validator.pub_key)) {
                    weight += validator.weight;
                    if (weight >= requiredWeight) {
                        return true;
                    }
                }
            }
        }
        return weight >= requiredWeight;
    }

    // Tact-native parsing seems to break on this one (exitCode: 10) when using Struct::fromSlice, unclear why
    // So we'll parse ValidatorDescr values ourselves, disregarding keys
    fun parseValidatorDescMap(slice: Slice, idx: Int) {
        if (slice.refs() == 2) {
            // fork
            repeat (2) {
                self.parseValidatorDescMap(slice.loadRef().asSlice(), idx);
                idx += 1;
            }
        } else {
            // label + val
            let remainingBits = slice.bits();
            require(remainingBits > 616, "Expect enough space for ValidatorDesc");
            // We know ValidatorDesc size and it should be at the end of the cell
            // so we don't parse labels
            slice.skipBits(remainingBits - 616);
            let item = ValidatorDesc.fromSlice(slice);
            let validator = Validator{
            weight: item.weight,
            pub_key: item.pubkey
            };

            let nodeId = sha256(beginCell()
            .storeUint(0xc6b41348, 32)
            .storeUint(validator.pub_key, 256)
            .asSlice());
            self.validatorSet.validators.set(nodeId, validator);
        }
    }

    // Update the validator set in-place
    //
    // Can't be done "smoothly" with fromStruct calls because tact structs
    // often don't provide enough control over memory layout to match tlb
    fun loadValidators(cell: Cell) {
        let block = cell.asSlice();
        let extra = block.loadNthRef(3).asSlice();
        let mcBlockExtra = extra.loadNthRef(3).asSlice();
        let dictCell = mcBlockExtra.loadNthRef(3);
        // Ignore remaining 74 bits in slice and build dict
        // Tact doesn't want to loadDirect, instead we create our own HashmapE
        let b = beginCell().storeMaybeRef(dictCell).asSlice();
        let configParams = ConfigParams.fromSlice(b);
        let validatorSetOpt = configParams.config.get(34);
        require(validatorSetOpt != null, "Expect ValidatorSet presence");
        let validatorSet = validatorSetOpt!!.asSlice();
        validatorSet.skipBits(8 + 32 + 32 + 16 + 16);
        self.validatorSet.total_weight =  validatorSet.loadUint(64);
        let onlyRef = validatorSet.loadRef();
        let i = 0;
        self.validatorSet.validators = emptyMap();
        self.parseValidatorDescMap(onlyRef.asSlice(), 0);
        require(!self.validatorSet.validators.isEmpty(), "Loaded descrs");
    }

    // Validate a new key block and load its new validators
    receive(msg: NewKeyBlock) {
        let blockAndFileHash = BlockAndFileHash.fromCell(msg.block);
        let signatureMap = SignatureMap.fromCell(msg.signatures);
        let rootHash = blockAndFileHash.block.hash();
        let new_seq_no = self.validateMcBlock(blockAndFileHash.block, true);
        require(self.validateSignatures(signatureMap, blockAndFileHash, rootHash), "Expect valid signature");

        self.seqno = new_seq_no;
        self.loadValidators(blockAndFileHash.block);

        self.notify(Ok{
            query_id: msg.query_id,
            block_hash: rootHash
        }.toCell());
    }

    receive(msg: CheckBlock) {
        let blockAndFileHash = BlockAndFileHash.fromCell(msg.block);
        let signatureMap = SignatureMap.fromCell(msg.signatures);
        let rootHash = blockAndFileHash.block.hash();
        self.validateMcBlock(blockAndFileHash.block, false);
        require(self.validateSignatures(signatureMap, blockAndFileHash, rootHash), "Expect valid signature");

        self.notify(Correct{
        query_id: msg.query_id,
        block_hash: rootHash
        }.toCell());
    }

    get fun seqno(): Int {
        return self.seqno;
    }
}
