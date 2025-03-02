export const FASTNET_CONFIG = {
    '@type': 'config.global',
    dht: {
        '@type': 'dht.config.global',
        k: 3,
        a: 3,
        static_nodes: {
            '@type': 'dht.nodes',
            nodes: [
                {
                    '@type': 'dht.node',
                    id: {
                        '@type': 'pub.ed25519',
                        key: 'XWd8AmjiOcAPHAS7SlElLjoHVUJ4coy6vMjISrzEMos=',
                    },
                    addr_list: {
                        '@type': 'adnl.addressList',
                        addrs: [
                            {
                                '@type': 'adnl.address.udp',
                                ip: 1844206431,
                                port: 40003,
                            },
                        ],
                        version: 0,
                        reinit_date: 0,
                        priority: 0,
                        expire_at: 0,
                    },
                    version: -1,
                    signature:
                        'QYAYhZOPEic/yuid4UxnR45DtiMtM97339RDlm7XKn4CvOVAuTjYj4i6Xm/I07w3G1aNdNXtIqQ6mM7pUI37CA==',
                },
            ],
        },
    },
    validator: {
        '@type': 'validator.config.global',
        zero_state: {
            workchain: -1,
            shard: -9223372036854775808,
            seqno: 0,
            root_hash: 'C/MCgmpgfICBrMI87r1cMpSjvZ7kLAhT4F6rdwEyZmE=',
            file_hash: 'QdP/mhtTsAO0aTJo3HgNyBto/tlMt83oUS3sKa+arR0=',
        },
        init_block: {
            workchain: -1,
            shard: -9223372036854775808,
            seqno: 0,
            root_hash: 'C/MCgmpgfICBrMI87r1cMpSjvZ7kLAhT4F6rdwEyZmE=',
            file_hash: 'QdP/mhtTsAO0aTJo3HgNyBto/tlMt83oUS3sKa+arR0=',
        },
    },
    liteservers: [
        {
            ip: 1482896250,
            port: 22603,
            id: {
                '@type': 'pub.ed25519',
                key: 'M6z0tzBLejE9LSAEQiLNZ4iC+u9hGv7q0gc6m0Io2rk=',
            },
        },
    ],
};
