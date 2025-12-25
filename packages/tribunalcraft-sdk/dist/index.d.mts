import { PublicKey, Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { BN, Wallet, Program, EventParser } from '@coral-xyz/anchor';

/**
 * PDA derivation helpers for TribunalCraft accounts
 * Updated for V2 round-based design
 */
declare class PDA {
    private programId;
    constructor(programId?: PublicKey);
    /**
     * Derive Protocol Config PDA
     */
    protocolConfig(): [PublicKey, number];
    /**
     * Derive Defender Pool PDA for an owner
     * Seeds: [defender_pool, owner]
     */
    defenderPool(owner: PublicKey): [PublicKey, number];
    /**
     * Derive Challenger Pool PDA for an owner
     * Seeds: [challenger_pool, owner]
     */
    challengerPool(owner: PublicKey): [PublicKey, number];
    /**
     * Derive Juror Pool PDA for a juror
     * Seeds: [juror_pool, owner]
     */
    jurorPool(owner: PublicKey): [PublicKey, number];
    /**
     * Derive Subject PDA for a subject ID
     * Seeds: [subject, subject_id]
     */
    subject(subjectId: PublicKey): [PublicKey, number];
    /**
     * Derive Dispute PDA for a subject
     * Seeds: [dispute, subject_id]
     * Note: In V2, there's one Dispute per subject (persistent, reset per round)
     */
    dispute(subjectId: PublicKey): [PublicKey, number];
    /**
     * Derive Escrow PDA for a subject
     * Seeds: [escrow, subject_id]
     * Holds funds and RoundResult history for claims
     */
    escrow(subjectId: PublicKey): [PublicKey, number];
    /**
     * Derive Defender Record PDA for a specific round
     * Seeds: [defender_record, subject_id, defender, round]
     */
    defenderRecord(subjectId: PublicKey, defender: PublicKey, round: number): [PublicKey, number];
    /**
     * Derive Challenger Record PDA for a specific round
     * Seeds: [challenger_record, subject_id, challenger, round]
     */
    challengerRecord(subjectId: PublicKey, challenger: PublicKey, round: number): [PublicKey, number];
    /**
     * Derive Juror Record PDA for a specific round
     * Seeds: [juror_record, subject_id, juror, round]
     */
    jurorRecord(subjectId: PublicKey, juror: PublicKey, round: number): [PublicKey, number];
}
declare const pda: PDA;

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/tribunalcraft.json`.
 */
type Tribunalcraft = {
    "address": "YxF3CEwUr5Nhk8FjzZDhKFcSHfgRHYA31Ccm3vd2Mrz";
    "metadata": {
        "name": "tribunalcraft";
        "version": "0.1.0";
        "spec": "0.1.0";
        "description": "Decentralized arbitration protocol";
    };
    "instructions": [
        {
            "name": "addBondDirect";
            "docs": [
                "Add bond directly from wallet"
            ];
            "discriminator": [
                2,
                240,
                206,
                50,
                106,
                238,
                109,
                254
            ];
            "accounts": [
                {
                    "name": "defender";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                },
                {
                    "name": "defenderRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "defender";
                            },
                            {
                                "kind": "account";
                                "path": "subject.round";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "defenderPool";
                    "docs": [
                        "Defender's pool - created if doesn't exist"
                    ];
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "defender";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "docs": [
                        "Optional: Active dispute (for updating bond_at_risk during dispute)"
                    ];
                    "writable": true;
                    "optional": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "addBondFromPool";
            "docs": [
                "Add bond from defender pool"
            ];
            "discriminator": [
                127,
                107,
                194,
                189,
                87,
                53,
                213,
                211
            ];
            "accounts": [
                {
                    "name": "defender";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                },
                {
                    "name": "defenderPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "defender";
                            }
                        ];
                    };
                },
                {
                    "name": "defenderRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "defender";
                            },
                            {
                                "kind": "account";
                                "path": "subject.round";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "docs": [
                        "Optional: Active dispute (for updating bond_at_risk during dispute)"
                    ];
                    "writable": true;
                    "optional": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "addChallengerStake";
            "docs": [
                "Add stake to challenger pool"
            ];
            "discriminator": [
                240,
                11,
                100,
                179,
                24,
                255,
                67,
                234
            ];
            "accounts": [
                {
                    "name": "challenger";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "challengerPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    99,
                                    104,
                                    97,
                                    108,
                                    108,
                                    101,
                                    110,
                                    103,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "addJurorStake";
            "docs": [
                "Add stake to juror pool"
            ];
            "discriminator": [
                42,
                194,
                234,
                159,
                186,
                115,
                32,
                169
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "jurorPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "addToVote";
            "docs": [
                "Add stake to an existing vote"
            ];
            "discriminator": [
                202,
                66,
                94,
                152,
                90,
                103,
                240,
                68
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "jurorPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "jurorRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            },
                            {
                                "kind": "arg";
                                "path": "round";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "round";
                    "type": "u32";
                },
                {
                    "name": "additionalStake";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "claimChallenger";
            "docs": [
                "Claim challenger reward"
            ];
            "discriminator": [
                148,
                51,
                9,
                223,
                64,
                230,
                123,
                189
            ];
            "accounts": [
                {
                    "name": "challenger";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "challengerRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    99,
                                    104,
                                    97,
                                    108,
                                    108,
                                    101,
                                    110,
                                    103,
                                    101,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            },
                            {
                                "kind": "arg";
                                "path": "round";
                            }
                        ];
                    };
                },
                {
                    "name": "challengerPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    99,
                                    104,
                                    97,
                                    108,
                                    108,
                                    101,
                                    110,
                                    103,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "round";
                    "type": "u32";
                }
            ];
        },
        {
            "name": "claimDefender";
            "docs": [
                "Claim defender reward"
            ];
            "discriminator": [
                230,
                104,
                48,
                216,
                165,
                86,
                123,
                142
            ];
            "accounts": [
                {
                    "name": "defender";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "defenderRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "defender";
                            },
                            {
                                "kind": "arg";
                                "path": "round";
                            }
                        ];
                    };
                },
                {
                    "name": "defenderPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "defender";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "round";
                    "type": "u32";
                }
            ];
        },
        {
            "name": "claimJuror";
            "docs": [
                "Claim juror reward"
            ];
            "discriminator": [
                239,
                58,
                13,
                171,
                137,
                109,
                76,
                30
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "jurorRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            },
                            {
                                "kind": "arg";
                                "path": "round";
                            }
                        ];
                    };
                },
                {
                    "name": "jurorPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "round";
                    "type": "u32";
                }
            ];
        },
        {
            "name": "closeChallengerRecord";
            "docs": [
                "Close challenger record"
            ];
            "discriminator": [
                254,
                255,
                55,
                246,
                51,
                196,
                121,
                232
            ];
            "accounts": [
                {
                    "name": "challenger";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "challengerRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    99,
                                    104,
                                    97,
                                    108,
                                    108,
                                    101,
                                    110,
                                    103,
                                    101,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            },
                            {
                                "kind": "arg";
                                "path": "round";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "round";
                    "type": "u32";
                }
            ];
        },
        {
            "name": "closeDefenderRecord";
            "docs": [
                "Close defender record"
            ];
            "discriminator": [
                192,
                4,
                53,
                135,
                80,
                151,
                171,
                87
            ];
            "accounts": [
                {
                    "name": "defender";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "defenderRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "defender";
                            },
                            {
                                "kind": "arg";
                                "path": "round";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "round";
                    "type": "u32";
                }
            ];
        },
        {
            "name": "closeJurorRecord";
            "docs": [
                "Close juror record"
            ];
            "discriminator": [
                17,
                237,
                233,
                65,
                255,
                237,
                33,
                58
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "jurorRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            },
                            {
                                "kind": "arg";
                                "path": "round";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "round";
                    "type": "u32";
                }
            ];
        },
        {
            "name": "createDefenderPool";
            "docs": [
                "Create a defender pool"
            ];
            "discriminator": [
                146,
                138,
                10,
                14,
                120,
                153,
                97,
                34
            ];
            "accounts": [
                {
                    "name": "owner";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "defenderPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "owner";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "initialAmount";
                    "type": "u64";
                },
                {
                    "name": "maxBond";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "createDispute";
            "docs": [
                "Create a dispute against a subject"
            ];
            "discriminator": [
                161,
                99,
                53,
                116,
                60,
                79,
                149,
                105
            ];
            "accounts": [
                {
                    "name": "challenger";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "challengerRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    99,
                                    104,
                                    97,
                                    108,
                                    108,
                                    101,
                                    110,
                                    103,
                                    101,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            },
                            {
                                "kind": "account";
                                "path": "subject.round";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "challengerPool";
                    "docs": [
                        "Challenger's pool - created if doesn't exist"
                    ];
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    99,
                                    104,
                                    97,
                                    108,
                                    108,
                                    101,
                                    110,
                                    103,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            }
                        ];
                    };
                },
                {
                    "name": "creatorDefenderPool";
                    "docs": [
                        "Creator's defender pool - for auto-matching"
                    ];
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.creator";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "creatorDefenderRecord";
                    "docs": [
                        "Creator's defender record for this round - init_if_needed for pool contribution"
                    ];
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "subject.creator";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "subject.round";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "disputeType";
                    "type": {
                        "defined": {
                            "name": "disputeType";
                        };
                    };
                },
                {
                    "name": "detailsCid";
                    "type": "string";
                },
                {
                    "name": "stake";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "createSubject";
            "docs": [
                "Create a subject with Subject + Dispute + Escrow PDAs",
                "Creator's pool is linked. If initial_bond > 0, transfers from wallet."
            ];
            "discriminator": [
                243,
                24,
                101,
                208,
                170,
                5,
                242,
                26
            ];
            "accounts": [
                {
                    "name": "creator";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "arg";
                                "path": "subjectId";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "arg";
                                "path": "subjectId";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "arg";
                                "path": "subjectId";
                            }
                        ];
                    };
                },
                {
                    "name": "defenderPool";
                    "docs": [
                        "Creator's defender pool - created if doesn't exist"
                    ];
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "creator";
                            }
                        ];
                    };
                },
                {
                    "name": "defenderRecord";
                    "docs": [
                        "Creator's defender record for round 0"
                    ];
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "arg";
                                "path": "subjectId";
                            },
                            {
                                "kind": "account";
                                "path": "creator";
                            },
                            {
                                "kind": "const";
                                "value": [
                                    0,
                                    0,
                                    0,
                                    0
                                ];
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "subjectId";
                    "type": "pubkey";
                },
                {
                    "name": "detailsCid";
                    "type": "string";
                },
                {
                    "name": "matchMode";
                    "type": "bool";
                },
                {
                    "name": "votingPeriod";
                    "type": "i64";
                },
                {
                    "name": "initialBond";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "depositDefenderPool";
            "docs": [
                "Deposit to defender pool"
            ];
            "discriminator": [
                91,
                11,
                23,
                235,
                88,
                18,
                65,
                162
            ];
            "accounts": [
                {
                    "name": "owner";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "defenderPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "owner";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "initializeConfig";
            "docs": [
                "Initialize protocol config (one-time setup by deployer)"
            ];
            "discriminator": [
                208,
                127,
                21,
                1,
                194,
                190,
                196,
                70
            ];
            "accounts": [
                {
                    "name": "authority";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "config";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    112,
                                    114,
                                    111,
                                    116,
                                    111,
                                    99,
                                    111,
                                    108,
                                    95,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [];
        },
        {
            "name": "joinChallengers";
            "docs": [
                "Join existing dispute as additional challenger"
            ];
            "discriminator": [
                223,
                204,
                21,
                113,
                209,
                155,
                162,
                77
            ];
            "accounts": [
                {
                    "name": "challenger";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "challengerRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    99,
                                    104,
                                    97,
                                    108,
                                    108,
                                    101,
                                    110,
                                    103,
                                    101,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            },
                            {
                                "kind": "account";
                                "path": "subject.round";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "challengerPool";
                    "docs": [
                        "Challenger's pool - created if doesn't exist"
                    ];
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    99,
                                    104,
                                    97,
                                    108,
                                    108,
                                    101,
                                    110,
                                    103,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "detailsCid";
                    "type": "string";
                },
                {
                    "name": "stake";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "registerChallenger";
            "docs": [
                "Register as a challenger"
            ];
            "discriminator": [
                69,
                151,
                151,
                202,
                4,
                226,
                241,
                134
            ];
            "accounts": [
                {
                    "name": "challenger";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "challengerPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    99,
                                    104,
                                    97,
                                    108,
                                    108,
                                    101,
                                    110,
                                    103,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "stakeAmount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "registerJuror";
            "docs": [
                "Register as a juror"
            ];
            "discriminator": [
                116,
                81,
                98,
                42,
                220,
                219,
                2,
                141
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "jurorPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "stakeAmount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "resolveDispute";
            "docs": [
                "Resolve a dispute after voting period ends"
            ];
            "discriminator": [
                231,
                6,
                202,
                6,
                96,
                103,
                12,
                230
            ];
            "accounts": [
                {
                    "name": "resolver";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "protocolConfig";
                    "docs": [
                        "Protocol config for treasury address"
                    ];
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    112,
                                    114,
                                    111,
                                    116,
                                    111,
                                    99,
                                    111,
                                    108,
                                    95,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            }
                        ];
                    };
                },
                {
                    "name": "treasury";
                    "docs": [
                        "Treasury receives platform fee"
                    ];
                    "writable": true;
                },
                {
                    "name": "creatorDefenderPool";
                    "docs": [
                        "Optional: Creator's defender pool for auto-rebond on defender win"
                    ];
                    "writable": true;
                    "optional": true;
                },
                {
                    "name": "creatorDefenderRecord";
                    "docs": [
                        "Optional: Creator's defender record - initialized via init_if_needed",
                        "Uses subject.creator and next_round for PDA seeds"
                    ];
                    "writable": true;
                    "optional": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [100, 101, 102, 101, 110, 100, 101, 114, 95, 114, 101, 99, 111, 114, 100];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "subject.creator";
                                "account": "subject";
                            },
                            {
                                "kind": "arg";
                                "path": "next_round";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "nextRound";
                    "type": "u32";
                }
            ];
        },
        {
            "name": "submitRestore";
            "docs": [
                "Submit a restoration request for an invalidated subject"
            ];
            "discriminator": [
                32,
                59,
                202,
                78,
                224,
                183,
                80,
                191
            ];
            "accounts": [
                {
                    "name": "restorer";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "challengerRecord";
                    "docs": [
                        "Challenger record for the restorer (acts as first challenger)"
                    ];
                    "writable": true;
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "disputeType";
                    "type": {
                        "defined": {
                            "name": "disputeType";
                        };
                    };
                },
                {
                    "name": "detailsCid";
                    "type": "string";
                },
                {
                    "name": "stakeAmount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "sweepRoundCreator";
            "docs": [
                "Creator sweep unclaimed funds (after 30 days)"
            ];
            "discriminator": [
                171,
                13,
                243,
                211,
                73,
                235,
                65,
                30
            ];
            "accounts": [
                {
                    "name": "creator";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "round";
                    "type": "u32";
                }
            ];
        },
        {
            "name": "sweepRoundTreasury";
            "docs": [
                "Treasury sweep unclaimed funds (after 90 days)"
            ];
            "discriminator": [
                224,
                70,
                132,
                233,
                159,
                248,
                133,
                130
            ];
            "accounts": [
                {
                    "name": "sweeper";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "protocolConfig";
                    "docs": [
                        "Protocol config for treasury address"
                    ];
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    112,
                                    114,
                                    111,
                                    116,
                                    111,
                                    99,
                                    111,
                                    108,
                                    95,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            }
                        ];
                    };
                },
                {
                    "name": "treasury";
                    "docs": [
                        "Treasury receives swept funds"
                    ];
                    "writable": true;
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "round";
                    "type": "u32";
                }
            ];
        },
        {
            "name": "unlockJurorStake";
            "docs": [
                "Unlock juror stake (7 days after resolution)"
            ];
            "discriminator": [
                109,
                73,
                56,
                32,
                115,
                125,
                5,
                242
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "escrow";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    101,
                                    115,
                                    99,
                                    114,
                                    111,
                                    119
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "jurorRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            },
                            {
                                "kind": "arg";
                                "path": "round";
                            }
                        ];
                    };
                },
                {
                    "name": "jurorPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "round";
                    "type": "u32";
                }
            ];
        },
        {
            "name": "unregisterJuror";
            "docs": [
                "Unregister juror"
            ];
            "discriminator": [
                199,
                200,
                113,
                139,
                182,
                118,
                206,
                124
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "jurorPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [];
        },
        {
            "name": "updateMaxBond";
            "docs": [
                "Update max_bond setting for defender pool"
            ];
            "discriminator": [
                19,
                70,
                113,
                22,
                140,
                149,
                203,
                23
            ];
            "accounts": [
                {
                    "name": "owner";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "defenderPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "owner";
                            }
                        ];
                    };
                }
            ];
            "args": [
                {
                    "name": "newMaxBond";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "updateTreasury";
            "docs": [
                "Update treasury address (admin only)"
            ];
            "discriminator": [
                60,
                16,
                243,
                66,
                96,
                59,
                254,
                131
            ];
            "accounts": [
                {
                    "name": "authority";
                    "writable": true;
                    "signer": true;
                    "relations": [
                        "config"
                    ];
                },
                {
                    "name": "config";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    112,
                                    114,
                                    111,
                                    116,
                                    111,
                                    99,
                                    111,
                                    108,
                                    95,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            }
                        ];
                    };
                }
            ];
            "args": [
                {
                    "name": "newTreasury";
                    "type": "pubkey";
                }
            ];
        },
        {
            "name": "voteOnDispute";
            "docs": [
                "Vote on a dispute"
            ];
            "discriminator": [
                7,
                213,
                96,
                171,
                252,
                59,
                55,
                23
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "jurorPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "jurorRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            },
                            {
                                "kind": "account";
                                "path": "subject.round";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "choice";
                    "type": {
                        "defined": {
                            "name": "voteChoice";
                        };
                    };
                },
                {
                    "name": "stakeAllocation";
                    "type": "u64";
                },
                {
                    "name": "rationaleCid";
                    "type": "string";
                }
            ];
        },
        {
            "name": "voteOnRestore";
            "docs": [
                "Vote on a restoration"
            ];
            "discriminator": [
                122,
                123,
                92,
                240,
                251,
                205,
                189,
                32
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "jurorPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "subject";
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    115,
                                    117,
                                    98,
                                    106,
                                    101,
                                    99,
                                    116
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "dispute";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    105,
                                    115,
                                    112,
                                    117,
                                    116,
                                    101
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "jurorRecord";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    114,
                                    101,
                                    99,
                                    111,
                                    114,
                                    100
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "subject.subject_id";
                                "account": "subject";
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            },
                            {
                                "kind": "account";
                                "path": "subject.round";
                                "account": "subject";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "choice";
                    "type": {
                        "defined": {
                            "name": "restoreVoteChoice";
                        };
                    };
                },
                {
                    "name": "stakeAllocation";
                    "type": "u64";
                },
                {
                    "name": "rationaleCid";
                    "type": "string";
                }
            ];
        },
        {
            "name": "withdrawChallengerStake";
            "docs": [
                "Withdraw from challenger pool"
            ];
            "discriminator": [
                78,
                33,
                10,
                217,
                10,
                63,
                81,
                45
            ];
            "accounts": [
                {
                    "name": "challenger";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "challengerPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    99,
                                    104,
                                    97,
                                    108,
                                    108,
                                    101,
                                    110,
                                    103,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "challenger";
                            }
                        ];
                    };
                },
                {
                    "name": "protocolConfig";
                    "docs": [
                        "Protocol config for treasury address"
                    ];
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    112,
                                    114,
                                    111,
                                    116,
                                    111,
                                    99,
                                    111,
                                    108,
                                    95,
                                    99,
                                    111,
                                    110,
                                    102,
                                    105,
                                    103
                                ];
                            }
                        ];
                    };
                },
                {
                    "name": "treasury";
                    "docs": [
                        "Treasury receives slashed amounts"
                    ];
                    "writable": true;
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "withdrawDefenderPool";
            "docs": [
                "Withdraw from defender pool"
            ];
            "discriminator": [
                34,
                62,
                12,
                146,
                220,
                10,
                123,
                61
            ];
            "accounts": [
                {
                    "name": "owner";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "defenderPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    100,
                                    101,
                                    102,
                                    101,
                                    110,
                                    100,
                                    101,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "owner";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        },
        {
            "name": "withdrawJurorStake";
            "docs": [
                "Withdraw from juror pool"
            ];
            "discriminator": [
                178,
                43,
                144,
                250,
                188,
                199,
                135,
                133
            ];
            "accounts": [
                {
                    "name": "juror";
                    "writable": true;
                    "signer": true;
                },
                {
                    "name": "jurorPool";
                    "writable": true;
                    "pda": {
                        "seeds": [
                            {
                                "kind": "const";
                                "value": [
                                    106,
                                    117,
                                    114,
                                    111,
                                    114,
                                    95,
                                    112,
                                    111,
                                    111,
                                    108
                                ];
                            },
                            {
                                "kind": "account";
                                "path": "juror";
                            }
                        ];
                    };
                },
                {
                    "name": "systemProgram";
                    "address": "11111111111111111111111111111111";
                }
            ];
            "args": [
                {
                    "name": "amount";
                    "type": "u64";
                }
            ];
        }
    ];
    "accounts": [
        {
            "name": "challengerPool";
            "discriminator": [
                88,
                158,
                225,
                15,
                47,
                185,
                77,
                238
            ];
        },
        {
            "name": "challengerRecord";
            "discriminator": [
                8,
                80,
                134,
                108,
                192,
                142,
                121,
                14
            ];
        },
        {
            "name": "defenderPool";
            "discriminator": [
                227,
                100,
                92,
                157,
                203,
                252,
                63,
                118
            ];
        },
        {
            "name": "defenderRecord";
            "discriminator": [
                14,
                3,
                219,
                215,
                38,
                254,
                254,
                92
            ];
        },
        {
            "name": "dispute";
            "discriminator": [
                36,
                49,
                241,
                67,
                40,
                36,
                241,
                74
            ];
        },
        {
            "name": "escrow";
            "discriminator": [
                31,
                213,
                123,
                187,
                186,
                22,
                218,
                155
            ];
        },
        {
            "name": "jurorPool";
            "discriminator": [
                217,
                104,
                42,
                167,
                209,
                1,
                171,
                33
            ];
        },
        {
            "name": "jurorRecord";
            "discriminator": [
                144,
                76,
                94,
                12,
                102,
                207,
                151,
                40
            ];
        },
        {
            "name": "protocolConfig";
            "discriminator": [
                207,
                91,
                250,
                28,
                152,
                179,
                215,
                209
            ];
        },
        {
            "name": "subject";
            "discriminator": [
                52,
                161,
                41,
                165,
                202,
                238,
                138,
                166
            ];
        }
    ];
    "events": [
        {
            "name": "addToVoteEvent";
            "discriminator": [
                228,
                249,
                101,
                93,
                5,
                47,
                190,
                66
            ];
        },
        {
            "name": "bondAddedEvent";
            "discriminator": [
                139,
                73,
                9,
                193,
                204,
                12,
                69,
                174
            ];
        },
        {
            "name": "bondWithdrawnEvent";
            "discriminator": [
                1,
                22,
                115,
                176,
                15,
                248,
                123,
                151
            ];
        },
        {
            "name": "challengerJoinedEvent";
            "discriminator": [
                163,
                95,
                96,
                131,
                237,
                97,
                229,
                35
            ];
        },
        {
            "name": "disputeCreatedEvent";
            "discriminator": [
                89,
                162,
                48,
                158,
                30,
                116,
                145,
                247
            ];
        },
        {
            "name": "disputeResolvedEvent";
            "discriminator": [
                152,
                37,
                98,
                245,
                229,
                39,
                150,
                78
            ];
        },
        {
            "name": "poolDepositEvent";
            "discriminator": [
                17,
                52,
                153,
                164,
                206,
                202,
                228,
                220
            ];
        },
        {
            "name": "poolWithdrawEvent";
            "discriminator": [
                4,
                215,
                203,
                122,
                8,
                73,
                179,
                46
            ];
        },
        {
            "name": "recordClosedEvent";
            "discriminator": [
                127,
                196,
                65,
                213,
                113,
                178,
                80,
                55
            ];
        },
        {
            "name": "restoreResolvedEvent";
            "discriminator": [
                151,
                57,
                204,
                231,
                9,
                240,
                171,
                205
            ];
        },
        {
            "name": "restoreSubmittedEvent";
            "discriminator": [
                91,
                160,
                93,
                112,
                192,
                112,
                155,
                30
            ];
        },
        {
            "name": "restoreVoteEvent";
            "discriminator": [
                54,
                218,
                241,
                44,
                90,
                247,
                210,
                238
            ];
        },
        {
            "name": "rewardClaimedEvent";
            "discriminator": [
                246,
                43,
                215,
                228,
                82,
                49,
                230,
                56
            ];
        },
        {
            "name": "roundSweptEvent";
            "discriminator": [
                245,
                127,
                207,
                243,
                30,
                229,
                3,
                134
            ];
        },
        {
            "name": "stakeUnlockedEvent";
            "discriminator": [
                99,
                31,
                70,
                177,
                150,
                105,
                180,
                93
            ];
        },
        {
            "name": "subjectCreatedEvent";
            "discriminator": [
                70,
                23,
                14,
                215,
                220,
                223,
                89,
                17
            ];
        },
        {
            "name": "subjectStatusChangedEvent";
            "discriminator": [
                118,
                28,
                47,
                229,
                59,
                42,
                149,
                118
            ];
        },
        {
            "name": "voteEvent";
            "discriminator": [
                195,
                71,
                250,
                105,
                120,
                119,
                234,
                134
            ];
        }
    ];
    "errors": [
        {
            "code": 6000;
            "name": "insufficientBalance";
            "msg": "Insufficient balance in defender pool";
        }
    ];
    "types": [
        {
            "name": "addToVoteEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "juror";
                        "type": "pubkey";
                    },
                    {
                        "name": "additionalStake";
                        "type": "u64";
                    },
                    {
                        "name": "additionalVotingPower";
                        "type": "u64";
                    },
                    {
                        "name": "totalStake";
                        "type": "u64";
                    },
                    {
                        "name": "totalVotingPower";
                        "type": "u64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "bondAddedEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "defender";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "amount";
                        "type": "u64";
                    },
                    {
                        "name": "source";
                        "type": {
                            "defined": {
                                "name": "bondSource";
                            };
                        };
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "bondSource";
            "docs": [
                "Source of bond funds"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "direct";
                    },
                    {
                        "name": "pool";
                    }
                ];
            };
        },
        {
            "name": "bondWithdrawnEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "defender";
                        "type": "pubkey";
                    },
                    {
                        "name": "amount";
                        "type": "u64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "challengerJoinedEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "challenger";
                        "type": "pubkey";
                    },
                    {
                        "name": "stake";
                        "type": "u64";
                    },
                    {
                        "name": "totalStake";
                        "type": "u64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "challengerPool";
            "docs": [
                "Challenger's pool for holding stake funds",
                "Seeds: [CHALLENGER_POOL_SEED, owner]",
                "One per user, persistent"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "owner";
                        "docs": [
                            "Pool owner's wallet address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "balance";
                        "docs": [
                            "Available balance"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "reputation";
                        "docs": [
                            "Reputation score (6 decimals, 100% = 100_000_000)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "createdAt";
                        "docs": [
                            "Creation timestamp"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "challengerRecord";
            "docs": [
                "Individual challenger's stake for a specific subject round",
                "Seeds: [CHALLENGER_RECORD_SEED, subject_id, challenger, round]",
                "Created per round, closed after claim"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "docs": [
                            "The subject_id this record belongs to"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "challenger";
                        "docs": [
                            "Challenger's wallet address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "docs": [
                            "Which round this stake is for"
                        ];
                        "type": "u32";
                    },
                    {
                        "name": "stake";
                        "docs": [
                            "Stake amount contributed to the dispute"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "detailsCid";
                        "docs": [
                            "Evidence CID (IPFS hash)"
                        ];
                        "type": "string";
                    },
                    {
                        "name": "rewardClaimed";
                        "docs": [
                            "Whether reward has been claimed"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "challengedAt";
                        "docs": [
                            "Timestamp when this challenger joined"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "claimRole";
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "defender";
                    },
                    {
                        "name": "challenger";
                    },
                    {
                        "name": "juror";
                    }
                ];
            };
        },
        {
            "name": "defenderPool";
            "docs": [
                "Defender's pool for holding bond funds",
                "Seeds: [DEFENDER_POOL_SEED, owner]",
                "One per user, persistent"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "owner";
                        "docs": [
                            "Pool owner's wallet address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "balance";
                        "docs": [
                            "Available balance (not locked in active bonds)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "maxBond";
                        "docs": [
                            "Max bond per subject (for auto-allocation)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "createdAt";
                        "docs": [
                            "Creation timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "updatedAt";
                        "docs": [
                            "Last update timestamp"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "defenderRecord";
            "docs": [
                "Individual defender's bond for a specific subject round",
                "Seeds: [DEFENDER_RECORD_SEED, subject_id, defender, round]",
                "Created per round, closed after claim"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "docs": [
                            "The subject_id this record belongs to"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "defender";
                        "docs": [
                            "Defender's wallet address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "docs": [
                            "Which round this bond is for"
                        ];
                        "type": "u32";
                    },
                    {
                        "name": "bond";
                        "docs": [
                            "Bond amount backing the subject"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "source";
                        "docs": [
                            "Source of bond funds"
                        ];
                        "type": {
                            "defined": {
                                "name": "bondSource";
                            };
                        };
                    },
                    {
                        "name": "rewardClaimed";
                        "docs": [
                            "Whether reward has been claimed"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "bondedAt";
                        "docs": [
                            "Timestamp when this defender bonded"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "dispute";
            "docs": [
                "Dispute - Persistent PDA, reset after each round",
                "Seeds: [DISPUTE_SEED, subject_id]"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "docs": [
                            "Subject being disputed (subject_id, not Subject PDA)"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "docs": [
                            "Which round this dispute is for"
                        ];
                        "type": "u32";
                    },
                    {
                        "name": "status";
                        "docs": [
                            "Dispute status"
                        ];
                        "type": {
                            "defined": {
                                "name": "disputeStatus";
                            };
                        };
                    },
                    {
                        "name": "disputeType";
                        "docs": [
                            "Dispute type"
                        ];
                        "type": {
                            "defined": {
                                "name": "disputeType";
                            };
                        };
                    },
                    {
                        "name": "totalStake";
                        "docs": [
                            "Total stake from all challengers"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "challengerCount";
                        "docs": [
                            "Number of challengers"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "bondAtRisk";
                        "docs": [
                            "Bond at risk (calculated based on mode)",
                            "Match: min(total_stake, available_bond)",
                            "Prop: available_bond"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "defenderCount";
                        "docs": [
                            "Number of defenders (snapshot at dispute creation, updated if new defenders join)"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "votesForChallenger";
                        "docs": [
                            "Cumulative voting power for challenger"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "votesForDefender";
                        "docs": [
                            "Cumulative voting power for defender"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "voteCount";
                        "docs": [
                            "Number of jurors who voted"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "votingStartsAt";
                        "docs": [
                            "Voting start timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "votingEndsAt";
                        "docs": [
                            "Voting end timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "outcome";
                        "docs": [
                            "Resolution outcome"
                        ];
                        "type": {
                            "defined": {
                                "name": "resolutionOutcome";
                            };
                        };
                    },
                    {
                        "name": "resolvedAt";
                        "docs": [
                            "Resolution timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "isRestore";
                        "docs": [
                            "True if this dispute is a restoration request"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "restoreStake";
                        "docs": [
                            "Stake posted by restorer (for restorations only)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "restorer";
                        "docs": [
                            "Restorer's pubkey (for restorations only)"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "detailsCid";
                        "docs": [
                            "Details CID (IPFS hash for dispute details)"
                        ];
                        "type": "string";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "createdAt";
                        "docs": [
                            "Creation timestamp"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "disputeCreatedEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "creator";
                        "type": "pubkey";
                    },
                    {
                        "name": "stake";
                        "type": "u64";
                    },
                    {
                        "name": "bondAtRisk";
                        "type": "u64";
                    },
                    {
                        "name": "votingEndsAt";
                        "type": "i64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "disputeResolvedEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "outcome";
                        "type": {
                            "defined": {
                                "name": "resolutionOutcome";
                            };
                        };
                    },
                    {
                        "name": "totalStake";
                        "type": "u64";
                    },
                    {
                        "name": "bondAtRisk";
                        "type": "u64";
                    },
                    {
                        "name": "winnerPool";
                        "type": "u64";
                    },
                    {
                        "name": "jurorPool";
                        "type": "u64";
                    },
                    {
                        "name": "resolvedAt";
                        "type": "i64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "disputeStatus";
            "docs": [
                "Dispute status"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "none";
                    },
                    {
                        "name": "pending";
                    },
                    {
                        "name": "resolved";
                    }
                ];
            };
        },
        {
            "name": "disputeType";
            "docs": [
                "Dispute type (generic categories)"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "other";
                    },
                    {
                        "name": "breach";
                    },
                    {
                        "name": "fraud";
                    },
                    {
                        "name": "qualityDispute";
                    },
                    {
                        "name": "nonDelivery";
                    },
                    {
                        "name": "misrepresentation";
                    },
                    {
                        "name": "policyViolation";
                    },
                    {
                        "name": "damagesClaim";
                    }
                ];
            };
        },
        {
            "name": "escrow";
            "docs": [
                "Escrow account - holds funds for claims across rounds",
                "Seeds: [ESCROW_SEED, subject_id]",
                "Persistent PDA - created once, reused"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "docs": [
                            "Subject this escrow belongs to"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "balance";
                        "docs": [
                            "Current balance available for claims"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "rounds";
                        "docs": [
                            "Historical round results for claims",
                            "Vec grows with realloc on dispute creation, shrinks on last claim"
                        ];
                        "type": {
                            "vec": {
                                "defined": {
                                    "name": "roundResult";
                                };
                            };
                        };
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    }
                ];
            };
        },
        {
            "name": "jurorPool";
            "docs": [
                "Juror's pool for holding voting stake",
                "Seeds: [JUROR_POOL_SEED, owner]",
                "One per user, persistent"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "owner";
                        "docs": [
                            "Juror's wallet address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "balance";
                        "docs": [
                            "Available balance"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "reputation";
                        "docs": [
                            "Reputation score (6 decimals, 100% = 100_000_000)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "createdAt";
                        "docs": [
                            "Registration timestamp"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "jurorRecord";
            "docs": [
                "Juror's vote record for a specific subject round",
                "Seeds: [JUROR_RECORD_SEED, subject_id, juror, round]",
                "Created per round, closed after claim"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "docs": [
                            "The subject_id this record belongs to"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "juror";
                        "docs": [
                            "Juror who cast the vote"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "docs": [
                            "Which round this vote is for"
                        ];
                        "type": "u32";
                    },
                    {
                        "name": "choice";
                        "docs": [
                            "Vote choice for regular disputes"
                        ];
                        "type": {
                            "defined": {
                                "name": "voteChoice";
                            };
                        };
                    },
                    {
                        "name": "restoreChoice";
                        "docs": [
                            "Vote choice for restorations (only used when is_restore_vote is true)"
                        ];
                        "type": {
                            "defined": {
                                "name": "restoreVoteChoice";
                            };
                        };
                    },
                    {
                        "name": "isRestoreVote";
                        "docs": [
                            "Whether this is a restoration vote"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "votingPower";
                        "docs": [
                            "Calculated voting power"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "stakeAllocation";
                        "docs": [
                            "Stake allocated (locked from juror pool)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "rewardClaimed";
                        "docs": [
                            "Whether reward has been claimed"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "stakeUnlocked";
                        "docs": [
                            "Whether stake has been unlocked (7 days after voting ends)"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "votedAt";
                        "docs": [
                            "Vote timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "rationaleCid";
                        "docs": [
                            "IPFS CID for vote rationale (optional)"
                        ];
                        "type": "string";
                    }
                ];
            };
        },
        {
            "name": "poolDepositEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "poolType";
                        "type": {
                            "defined": {
                                "name": "poolType";
                            };
                        };
                    },
                    {
                        "name": "owner";
                        "type": "pubkey";
                    },
                    {
                        "name": "amount";
                        "type": "u64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "poolType";
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "defender";
                    },
                    {
                        "name": "challenger";
                    },
                    {
                        "name": "juror";
                    }
                ];
            };
        },
        {
            "name": "poolWithdrawEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "poolType";
                        "type": {
                            "defined": {
                                "name": "poolType";
                            };
                        };
                    },
                    {
                        "name": "owner";
                        "type": "pubkey";
                    },
                    {
                        "name": "amount";
                        "type": "u64";
                    },
                    {
                        "name": "slashed";
                        "type": "u64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "protocolConfig";
            "docs": [
                "Protocol-wide configuration account",
                "Stores treasury address and admin authority for fee collection"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "authority";
                        "docs": [
                            "Admin who can update config (deployer initially)"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "treasury";
                        "docs": [
                            "Platform fee recipient address"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "PDA bump seed"
                        ];
                        "type": "u8";
                    }
                ];
            };
        },
        {
            "name": "recordClosedEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "owner";
                        "type": "pubkey";
                    },
                    {
                        "name": "role";
                        "type": {
                            "defined": {
                                "name": "claimRole";
                            };
                        };
                    },
                    {
                        "name": "rentReturned";
                        "type": "u64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "resolutionOutcome";
            "docs": [
                "Resolution outcome"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "none";
                    },
                    {
                        "name": "challengerWins";
                    },
                    {
                        "name": "defenderWins";
                    },
                    {
                        "name": "noParticipation";
                    }
                ];
            };
        },
        {
            "name": "restoreResolvedEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "outcome";
                        "type": {
                            "defined": {
                                "name": "resolutionOutcome";
                            };
                        };
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "restoreSubmittedEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "restorer";
                        "type": "pubkey";
                    },
                    {
                        "name": "stake";
                        "type": "u64";
                    },
                    {
                        "name": "detailsCid";
                        "type": "string";
                    },
                    {
                        "name": "votingPeriod";
                        "type": "i64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "restoreVoteChoice";
            "docs": [
                "Vote choice for restorations"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "forRestoration";
                    },
                    {
                        "name": "againstRestoration";
                    }
                ];
            };
        },
        {
            "name": "restoreVoteEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "juror";
                        "type": "pubkey";
                    },
                    {
                        "name": "choice";
                        "type": {
                            "defined": {
                                "name": "restoreVoteChoice";
                            };
                        };
                    },
                    {
                        "name": "votingPower";
                        "type": "u64";
                    },
                    {
                        "name": "rationaleCid";
                        "type": "string";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "rewardClaimedEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "claimer";
                        "type": "pubkey";
                    },
                    {
                        "name": "role";
                        "type": {
                            "defined": {
                                "name": "claimRole";
                            };
                        };
                    },
                    {
                        "name": "amount";
                        "type": "u64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "roundResult";
            "docs": [
                "Result data for a completed round, stored in Escrow",
                "Used for claim calculations after resolution"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "round";
                        "docs": [
                            "Round number"
                        ];
                        "type": "u32";
                    },
                    {
                        "name": "creator";
                        "docs": [
                            "Dispute creator (for rent refund on last claim or sweep)"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "resolvedAt";
                        "docs": [
                            "Resolution timestamp (for grace period calculation)"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "outcome";
                        "docs": [
                            "Resolution outcome"
                        ];
                        "type": {
                            "defined": {
                                "name": "resolutionOutcome";
                            };
                        };
                    },
                    {
                        "name": "totalStake";
                        "docs": [
                            "Total stake from challengers"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "bondAtRisk";
                        "docs": [
                            "Bond at risk from defenders"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "safeBond";
                        "docs": [
                            "Safe bond (available_bond - bond_at_risk) returned to defenders"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "totalVoteWeight";
                        "docs": [
                            "Total voting power cast"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "winnerPool";
                        "docs": [
                            "Winner pool amount (80%)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "jurorPool";
                        "docs": [
                            "Juror pool amount (19%)"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "defenderCount";
                        "docs": [
                            "Number of defenders"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "challengerCount";
                        "docs": [
                            "Number of challengers"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "jurorCount";
                        "docs": [
                            "Number of jurors"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "defenderClaims";
                        "docs": [
                            "Number of defenders who have claimed"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "challengerClaims";
                        "docs": [
                            "Number of challengers who have claimed"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "jurorClaims";
                        "docs": [
                            "Number of jurors who have claimed"
                        ];
                        "type": "u16";
                    }
                ];
            };
        },
        {
            "name": "roundSweptEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "sweeper";
                        "type": "pubkey";
                    },
                    {
                        "name": "unclaimed";
                        "type": "u64";
                    },
                    {
                        "name": "botReward";
                        "type": "u64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "stakeUnlockedEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "juror";
                        "type": "pubkey";
                    },
                    {
                        "name": "amount";
                        "type": "u64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "subject";
            "docs": [
                "Subject that defenders back - identified by subject_id",
                "Persistent PDA - created once, reused across rounds"
            ];
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "docs": [
                            "Subject identifier (could be PDA from external program)"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "creator";
                        "docs": [
                            "Creator of this subject (for auto-bond on reset)"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "detailsCid";
                        "docs": [
                            "Content CID (IPFS hash for subject details)"
                        ];
                        "type": "string";
                    },
                    {
                        "name": "round";
                        "docs": [
                            "Current round counter (0, 1, 2, ...)"
                        ];
                        "type": "u32";
                    },
                    {
                        "name": "availableBond";
                        "docs": [
                            "Total bond available for current round"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "defenderCount";
                        "docs": [
                            "Number of defenders in current round"
                        ];
                        "type": "u16";
                    },
                    {
                        "name": "status";
                        "docs": [
                            "Current status"
                        ];
                        "type": {
                            "defined": {
                                "name": "subjectStatus";
                            };
                        };
                    },
                    {
                        "name": "matchMode";
                        "docs": [
                            "Match mode: true = bond_at_risk matches stake, false = proportionate (all bond at risk)"
                        ];
                        "type": "bool";
                    },
                    {
                        "name": "votingPeriod";
                        "docs": [
                            "Voting period in seconds for this subject's disputes"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "dispute";
                        "docs": [
                            "Current active dispute (if any)"
                        ];
                        "type": "pubkey";
                    },
                    {
                        "name": "bump";
                        "docs": [
                            "Bump seed for PDA"
                        ];
                        "type": "u8";
                    },
                    {
                        "name": "createdAt";
                        "docs": [
                            "Creation timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "updatedAt";
                        "docs": [
                            "Last update timestamp"
                        ];
                        "type": "i64";
                    },
                    {
                        "name": "lastDisputeTotal";
                        "docs": [
                            "Previous dispute's (stake + bond) - minimum stake required for restoration"
                        ];
                        "type": "u64";
                    },
                    {
                        "name": "lastVotingPeriod";
                        "docs": [
                            "Previous dispute's voting period - restorations use 2x this value"
                        ];
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "subjectCreatedEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "creator";
                        "type": "pubkey";
                    },
                    {
                        "name": "matchMode";
                        "type": "bool";
                    },
                    {
                        "name": "votingPeriod";
                        "type": "i64";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "subjectStatus";
            "docs": [
                "Subject status"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "dormant";
                    },
                    {
                        "name": "valid";
                    },
                    {
                        "name": "disputed";
                    },
                    {
                        "name": "invalid";
                    },
                    {
                        "name": "restoring";
                    }
                ];
            };
        },
        {
            "name": "subjectStatusChangedEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "oldStatus";
                        "type": "u8";
                    },
                    {
                        "name": "newStatus";
                        "type": "u8";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        },
        {
            "name": "voteChoice";
            "docs": [
                "Vote choice for disputes"
            ];
            "type": {
                "kind": "enum";
                "variants": [
                    {
                        "name": "forChallenger";
                    },
                    {
                        "name": "forDefender";
                    }
                ];
            };
        },
        {
            "name": "voteEvent";
            "type": {
                "kind": "struct";
                "fields": [
                    {
                        "name": "subjectId";
                        "type": "pubkey";
                    },
                    {
                        "name": "round";
                        "type": "u32";
                    },
                    {
                        "name": "juror";
                        "type": "pubkey";
                    },
                    {
                        "name": "choice";
                        "type": {
                            "defined": {
                                "name": "voteChoice";
                            };
                        };
                    },
                    {
                        "name": "votingPower";
                        "type": "u64";
                    },
                    {
                        "name": "rationaleCid";
                        "type": "string";
                    },
                    {
                        "name": "timestamp";
                        "type": "i64";
                    }
                ];
            };
        }
    ];
};

interface UserActivity {
    type: string;
    signature: string;
    timestamp: number;
    slot: number;
    dispute?: string;
    subject?: string;
    round?: number;
    amount?: number;
    rentReclaimed?: number;
    voteChoice?: "ForChallenger" | "ForDefender" | "ForRestoration" | "AgainstRestoration";
    outcome?: "ChallengerWins" | "DefenderWins" | "NoParticipation";
    rationaleCid?: string;
    success: boolean;
}
interface ProtocolConfig {
    authority: PublicKey;
    treasury: PublicKey;
    bump: number;
}
interface DefenderPool {
    owner: PublicKey;
    balance: BN;
    maxBond: BN;
    bump: number;
    createdAt: BN;
    updatedAt: BN;
}
interface ChallengerPool {
    owner: PublicKey;
    balance: BN;
    reputation: BN;
    bump: number;
    createdAt: BN;
}
interface JurorPool {
    owner: PublicKey;
    balance: BN;
    reputation: BN;
    bump: number;
    createdAt: BN;
}
interface Subject {
    subjectId: PublicKey;
    creator: PublicKey;
    detailsCid: string;
    round: number;
    availableBond: BN;
    defenderCount: number;
    status: SubjectStatus;
    matchMode: boolean;
    votingPeriod: BN;
    dispute: PublicKey;
    bump: number;
    createdAt: BN;
    updatedAt: BN;
    lastDisputeTotal: BN;
    lastVotingPeriod: BN;
}
interface Dispute {
    subjectId: PublicKey;
    round: number;
    status: DisputeStatus;
    disputeType: DisputeType;
    totalStake: BN;
    challengerCount: number;
    bondAtRisk: BN;
    defenderCount: number;
    votesForChallenger: BN;
    votesForDefender: BN;
    voteCount: number;
    votingStartsAt: BN;
    votingEndsAt: BN;
    outcome: ResolutionOutcome;
    resolvedAt: BN;
    isRestore: boolean;
    restoreStake: BN;
    restorer: PublicKey;
    detailsCid: string;
    bump: number;
    createdAt: BN;
}
interface Escrow {
    subjectId: PublicKey;
    balance: BN;
    rounds: RoundResult[];
    bump: number;
}
interface RoundResult {
    round: number;
    creator: PublicKey;
    resolvedAt: BN;
    outcome: ResolutionOutcome;
    totalStake: BN;
    bondAtRisk: BN;
    safeBond: BN;
    totalVoteWeight: BN;
    winnerPool: BN;
    jurorPool: BN;
    defenderCount: number;
    challengerCount: number;
    jurorCount: number;
    defenderClaims: number;
    challengerClaims: number;
    jurorClaims: number;
}
interface DefenderRecord {
    subjectId: PublicKey;
    defender: PublicKey;
    round: number;
    bond: BN;
    source: BondSource;
    rewardClaimed: boolean;
    bump: number;
    bondedAt: BN;
}
interface ChallengerRecord {
    subjectId: PublicKey;
    challenger: PublicKey;
    round: number;
    stake: BN;
    detailsCid: string;
    rewardClaimed: boolean;
    bump: number;
    challengedAt: BN;
}
interface JurorRecord {
    subjectId: PublicKey;
    juror: PublicKey;
    round: number;
    choice: VoteChoice;
    restoreChoice: RestoreVoteChoice;
    isRestoreVote: boolean;
    votingPower: BN;
    stakeAllocation: BN;
    rewardClaimed: boolean;
    stakeUnlocked: boolean;
    bump: number;
    votedAt: BN;
    rationaleCid: string;
}
type SubjectStatus = {
    dormant: Record<string, never>;
} | {
    valid: Record<string, never>;
} | {
    disputed: Record<string, never>;
} | {
    invalid: Record<string, never>;
} | {
    restoring: Record<string, never>;
};
type DisputeStatus = {
    none: Record<string, never>;
} | {
    pending: Record<string, never>;
} | {
    resolved: Record<string, never>;
};
type ResolutionOutcome = {
    none: Record<string, never>;
} | {
    challengerWins: Record<string, never>;
} | {
    defenderWins: Record<string, never>;
} | {
    noParticipation: Record<string, never>;
};
type DisputeType = {
    other: Record<string, never>;
} | {
    breach: Record<string, never>;
} | {
    fraud: Record<string, never>;
} | {
    qualityDispute: Record<string, never>;
} | {
    nonDelivery: Record<string, never>;
} | {
    misrepresentation: Record<string, never>;
} | {
    policyViolation: Record<string, never>;
} | {
    damagesClaim: Record<string, never>;
};
type VoteChoice = {
    forChallenger: Record<string, never>;
} | {
    forDefender: Record<string, never>;
};
type RestoreVoteChoice = {
    forRestoration: Record<string, never>;
} | {
    againstRestoration: Record<string, never>;
};
type BondSource = {
    direct: Record<string, never>;
} | {
    pool: Record<string, never>;
};
declare const SubjectStatusEnum: {
    Dormant: SubjectStatus;
    Valid: SubjectStatus;
    Disputed: SubjectStatus;
    Invalid: SubjectStatus;
    Restoring: SubjectStatus;
};
declare const DisputeStatusEnum: {
    None: DisputeStatus;
    Pending: DisputeStatus;
    Resolved: DisputeStatus;
};
declare const ResolutionOutcomeEnum: {
    None: ResolutionOutcome;
    ChallengerWins: ResolutionOutcome;
    DefenderWins: ResolutionOutcome;
    NoParticipation: ResolutionOutcome;
};
declare const DisputeTypeEnum: {
    Other: DisputeType;
    Breach: DisputeType;
    Fraud: DisputeType;
    QualityDispute: DisputeType;
    NonDelivery: DisputeType;
    Misrepresentation: DisputeType;
    PolicyViolation: DisputeType;
    DamagesClaim: DisputeType;
};
declare const VoteChoiceEnum: {
    ForChallenger: VoteChoice;
    ForDefender: VoteChoice;
};
declare const RestoreVoteChoiceEnum: {
    ForRestoration: RestoreVoteChoice;
    AgainstRestoration: RestoreVoteChoice;
};
declare const BondSourceEnum: {
    Direct: BondSource;
    Pool: BondSource;
};
declare function isSubjectDormant(status: SubjectStatus): boolean;
declare function isSubjectValid(status: SubjectStatus): boolean;
declare function isSubjectDisputed(status: SubjectStatus): boolean;
declare function isSubjectInvalid(status: SubjectStatus): boolean;
declare function isSubjectRestoring(status: SubjectStatus): boolean;
declare function isDisputeNone(status: DisputeStatus): boolean;
declare function isDisputePending(status: DisputeStatus): boolean;
declare function isDisputeResolved(status: DisputeStatus): boolean;
declare function isChallengerWins(outcome: ResolutionOutcome): boolean;
declare function isDefenderWins(outcome: ResolutionOutcome): boolean;
declare function isNoParticipation(outcome: ResolutionOutcome): boolean;
declare function getDisputeTypeName(disputeType: DisputeType): string;
declare function getOutcomeName(outcome: ResolutionOutcome): string;
declare function getBondSourceName(source: BondSource): string;

interface SimulationResult$1 {
    success: boolean;
    error?: string;
    errorCode?: number;
    logs?: string[];
    unitsConsumed?: number;
}
interface TribunalCraftClientConfig {
    connection: Connection;
    wallet?: Wallet;
    programId?: PublicKey;
    /** If true, all transactions will be simulated before sending */
    simulateFirst?: boolean;
}
interface TransactionResult {
    signature: string;
    accounts?: Record<string, PublicKey>;
}
/**
 * TribunalCraft SDK Client
 *
 * Framework-agnostic client for interacting with the TribunalCraft Solana program.
 * Can be used in Node.js, browser, React, Vue, or any JavaScript/TypeScript environment.
 *
 * @example
 * ```ts
 * import { TribunalCraftClient } from "@tribunalcraft/sdk";
 * import { Connection, Keypair } from "@solana/web3.js";
 *
 * const connection = new Connection("https://api.devnet.solana.com");
 * const wallet = new Wallet(keypair);
 * const client = new TribunalCraftClient({ connection, wallet });
 *
 * // Register as a juror
 * const result = await client.registerJuror(new BN(100_000_000));
 * console.log("Signature:", result.signature);
 * ```
 */
declare class TribunalCraftClient {
    readonly connection: Connection;
    readonly programId: PublicKey;
    readonly pda: PDA;
    simulateFirst: boolean;
    private wallet;
    private anchorProgram;
    constructor(config: TribunalCraftClientConfig);
    private initProgram;
    /**
     * Set or update the wallet
     */
    setWallet(wallet: Wallet): void;
    /**
     * Get the current wallet public key
     */
    get walletPublicKey(): PublicKey | null;
    /**
     * Get the Anchor program instance (for advanced usage)
     */
    get program(): Program<Tribunalcraft> | null;
    /**
     * Get wallet and program, throwing if not connected
     */
    private getWalletAndProgram;
    /**
     * Parse program error from simulation logs
     */
    private parseErrorFromLogs;
    /**
     * Simulate a transaction and return detailed results
     */
    simulateTransaction(tx: Transaction | VersionedTransaction): Promise<SimulationResult$1>;
    /**
     * Build and simulate a method call without sending
     * Returns simulation result with parsed errors
     */
    simulateMethod(methodName: string, args: unknown[], accounts?: Record<string, PublicKey | null>): Promise<SimulationResult$1>;
    /**
     * Helper to run RPC with optional simulation first
     * Wraps Anchor's rpc() call with simulation check using Anchor's simulate()
     * @param forceSimulate - If true, always simulate regardless of simulateFirst setting
     */
    private rpcWithSimulation;
    /**
     * Initialize protocol config (one-time setup by deployer)
     */
    initializeConfig(): Promise<TransactionResult>;
    /**
     * Update treasury address (admin only)
     */
    updateTreasury(newTreasury: PublicKey): Promise<TransactionResult>;
    /**
     * Create a defender pool with initial deposit and max bond setting
     */
    createDefenderPool(initialAmount: BN, maxBond?: BN): Promise<TransactionResult>;
    /**
     * Deposit to defender pool
     */
    depositDefenderPool(amount: BN): Promise<TransactionResult>;
    /**
     * Withdraw from defender pool
     */
    withdrawDefenderPool(amount: BN): Promise<TransactionResult>;
    /**
     * Update max_bond setting for defender pool
     */
    updateMaxBond(newMaxBond: BN): Promise<TransactionResult>;
    /**
     * Create a subject with its associated Dispute and Escrow accounts
     * Creator's pool is linked automatically. If initialBond > 0, transfers from wallet.
     * Subject starts as Valid if pool.balance > 0 or initialBond > 0.
     */
    createSubject(params: {
        subjectId: PublicKey;
        detailsCid: string;
        matchMode?: boolean;
        votingPeriod: BN;
        initialBond?: BN;
    }): Promise<TransactionResult>;
    /**
     * Add bond directly from wallet to a subject
     * Creates DefenderRecord for the current round
     * Also creates DefenderPool if it doesn't exist
     */
    addBondDirect(subjectId: PublicKey, amount: BN): Promise<TransactionResult>;
    /**
     * Add bond from defender pool to a subject
     * Creates DefenderRecord for the current round
     */
    addBondFromPool(subjectId: PublicKey, amount: BN): Promise<TransactionResult>;
    /**
     * Register as a juror with initial stake
     */
    registerJuror(stakeAmount: BN): Promise<TransactionResult>;
    /**
     * Add more stake to juror account
     */
    addJurorStake(amount: BN): Promise<TransactionResult>;
    /**
     * Withdraw available stake from juror account
     */
    withdrawJurorStake(amount: BN): Promise<TransactionResult>;
    /**
     * Unregister juror and withdraw all available stake
     */
    unregisterJuror(): Promise<TransactionResult>;
    /**
     * Register as a challenger with initial stake
     */
    registerChallenger(stakeAmount: BN): Promise<TransactionResult>;
    /**
     * Add more stake to challenger pool
     */
    addChallengerStake(amount: BN): Promise<TransactionResult>;
    /**
     * Withdraw available stake from challenger pool
     */
    withdrawChallengerStake(amount: BN): Promise<TransactionResult>;
    /**
     * Create a new dispute against a subject
     * This initiates the dispute and creates a ChallengerRecord for the caller
     * Auto-pulls min(pool.balance, max_bond) from creator's defender pool
     */
    createDispute(params: {
        subjectId: PublicKey;
        disputeType: DisputeType;
        detailsCid: string;
        stake: BN;
    }): Promise<TransactionResult>;
    /**
     * Join an existing dispute as additional challenger
     */
    joinChallengers(params: {
        subjectId: PublicKey;
        detailsCid: string;
        stake: BN;
    }): Promise<TransactionResult>;
    /**
     * Submit a restoration request against an invalidated subject
     * Fees are collected during resolution from total pool
     */
    submitRestore(params: {
        subjectId: PublicKey;
        disputeType: DisputeType;
        detailsCid: string;
        stakeAmount: BN;
    }): Promise<TransactionResult>;
    /**
     * Vote on a dispute
     * Creates a JurorRecord for the current round
     */
    voteOnDispute(params: {
        subjectId: PublicKey;
        choice: VoteChoice;
        stakeAllocation: BN;
        rationaleCid?: string;
    }): Promise<TransactionResult>;
    /**
     * Vote on a restoration request
     * Creates a JurorRecord for the current round
     */
    voteOnRestore(params: {
        subjectId: PublicKey;
        choice: RestoreVoteChoice;
        stakeAllocation: BN;
        rationaleCid?: string;
    }): Promise<TransactionResult>;
    /**
     * Add stake to an existing vote
     * Increases voting power on an existing JurorRecord
     */
    addToVote(params: {
        subjectId: PublicKey;
        round: number;
        additionalStake: BN;
    }): Promise<TransactionResult>;
    /**
     * Resolve a dispute after voting period ends (permissionless)
     * Optionally auto-rebonds from creator's pool if available
     */
    resolveDispute(params: {
        subjectId: PublicKey;
    }): Promise<TransactionResult>;
    /**
     * Claim juror reward for a specific round
     */
    claimJuror(params: {
        subjectId: PublicKey;
        round: number;
    }): Promise<TransactionResult>;
    /**
     * Unlock juror stake after 7 days post-resolution
     * Returns the locked stake back to the juror pool
     */
    unlockJurorStake(params: {
        subjectId: PublicKey;
        round: number;
    }): Promise<TransactionResult>;
    /**
     * Claim challenger reward for a specific round (if dispute upheld)
     */
    claimChallenger(params: {
        subjectId: PublicKey;
        round: number;
    }): Promise<TransactionResult>;
    /**
     * Claim defender reward for a specific round (if dispute dismissed)
     */
    claimDefender(params: {
        subjectId: PublicKey;
        round: number;
    }): Promise<TransactionResult>;
    /**
     * Batch claim all available rewards in a single transaction
     * Combines juror, challenger, and defender claims
     */
    batchClaimRewards(params: {
        jurorClaims?: Array<{
            subjectId: PublicKey;
            round: number;
        }>;
        challengerClaims?: Array<{
            subjectId: PublicKey;
            round: number;
        }>;
        defenderClaims?: Array<{
            subjectId: PublicKey;
            round: number;
        }>;
    }): Promise<TransactionResult>;
    /**
     * Close juror record and reclaim rent (after reward claimed)
     */
    closeJurorRecord(params: {
        subjectId: PublicKey;
        round: number;
    }): Promise<TransactionResult>;
    /**
     * Close challenger record and reclaim rent (after reward claimed)
     */
    closeChallengerRecord(params: {
        subjectId: PublicKey;
        round: number;
    }): Promise<TransactionResult>;
    /**
     * Close defender record and reclaim rent (after reward claimed)
     */
    closeDefenderRecord(params: {
        subjectId: PublicKey;
        round: number;
    }): Promise<TransactionResult>;
    /**
     * Batch close multiple records in a single transaction.
     * Useful for reclaiming rent after claiming rewards.
     */
    batchCloseRecords(records: Array<{
        type: "juror" | "challenger" | "defender";
        subjectId: PublicKey;
        round: number;
    }>): Promise<{
        signature: string;
        closedCount: number;
    }>;
    /**
     * Fetch protocol config
     */
    fetchProtocolConfig(): Promise<ProtocolConfig | null>;
    /**
     * Fetch defender pool by address
     */
    fetchDefenderPool(address: PublicKey): Promise<DefenderPool | null>;
    /**
     * Fetch defender pool by owner
     */
    fetchDefenderPoolByOwner(owner: PublicKey): Promise<DefenderPool | null>;
    /**
     * Fetch subject by address
     */
    fetchSubject(address: PublicKey): Promise<Subject | null>;
    /**
     * Fetch subject by subject ID
     */
    fetchSubjectById(subjectId: PublicKey): Promise<Subject | null>;
    /**
     * Fetch dispute by address
     */
    fetchDispute(address: PublicKey): Promise<Dispute | null>;
    /**
     * Fetch juror pool by address
     */
    fetchJurorPool(address: PublicKey): Promise<JurorPool | null>;
    /**
     * Fetch juror pool by owner pubkey
     */
    fetchJurorPoolByOwner(owner: PublicKey): Promise<JurorPool | null>;
    /**
     * Fetch escrow by address
     */
    fetchEscrow(address: PublicKey): Promise<Escrow | null>;
    /**
     * Fetch escrow by subject ID
     */
    fetchEscrowBySubjectId(subjectId: PublicKey): Promise<Escrow | null>;
    /**
     * Fetch juror record by address
     */
    fetchJurorRecord(address: PublicKey): Promise<JurorRecord | null>;
    /**
     * Fetch juror record for a subject, juror, and round
     */
    fetchJurorRecordBySubjectAndJuror(subjectId: PublicKey, juror: PublicKey, round: number): Promise<JurorRecord | null>;
    /**
     * Fetch challenger pool by address
     */
    fetchChallengerPool(address: PublicKey): Promise<ChallengerPool | null>;
    /**
     * Fetch challenger pool by owner pubkey
     */
    fetchChallengerPoolByOwner(owner: PublicKey): Promise<ChallengerPool | null>;
    /**
     * Fetch challenger record by address
     */
    fetchChallengerRecord(address: PublicKey): Promise<ChallengerRecord | null>;
    /**
     * Fetch challenger record by subject, challenger, and round
     */
    fetchChallengerRecordBySubject(subjectId: PublicKey, challenger: PublicKey, round: number): Promise<ChallengerRecord | null>;
    /**
     * Fetch defender record by address
     */
    fetchDefenderRecord(address: PublicKey): Promise<DefenderRecord | null>;
    /**
     * Fetch defender record by subject, defender, and round
     */
    fetchDefenderRecordBySubject(subjectId: PublicKey, defender: PublicKey, round: number): Promise<DefenderRecord | null>;
    /**
     * Fetch all defender pools
     */
    fetchAllDefenderPools(): Promise<Array<{
        publicKey: PublicKey;
        account: DefenderPool;
    }>>;
    /**
     * Fetch all subjects
     */
    fetchAllSubjects(): Promise<Array<{
        publicKey: PublicKey;
        account: Subject;
    }>>;
    /**
     * Fetch all disputes (V2: one dispute per subject)
     */
    fetchAllDisputes(): Promise<Array<{
        publicKey: PublicKey;
        account: Dispute;
    }>>;
    /**
     * Fetch all juror pools
     */
    fetchAllJurorPools(): Promise<Array<{
        publicKey: PublicKey;
        account: JurorPool;
    }>>;
    /**
     * Fetch all challenger pools
     */
    fetchAllChallengerPools(): Promise<Array<{
        publicKey: PublicKey;
        account: ChallengerPool;
    }>>;
    /**
     * Fetch all escrows
     */
    fetchAllEscrows(): Promise<Array<{
        publicKey: PublicKey;
        account: Escrow;
    }>>;
    /**
     * Fetch all juror records
     * Note: Uses raw account fetching to handle old accounts missing new fields
     */
    fetchAllJurorRecords(): Promise<Array<{
        publicKey: PublicKey;
        account: JurorRecord;
    }>>;
    /**
     * Fetch all challenger records
     */
    fetchAllChallengerRecords(): Promise<Array<{
        publicKey: PublicKey;
        account: ChallengerRecord;
    }>>;
    /**
     * Fetch all defender records
     */
    fetchAllDefenderRecords(): Promise<Array<{
        publicKey: PublicKey;
        account: DefenderRecord;
    }>>;
    /**
     * Fetch dispute by subject ID
     */
    fetchDisputeBySubjectId(subjectId: PublicKey): Promise<Dispute | null>;
    /**
     * Fetch juror records by subject
     * Note: Uses raw account fetching to handle old accounts missing new fields
     */
    fetchJurorRecordsBySubject(subjectId: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: JurorRecord;
    }>>;
    /**
     * Fetch challengers by subject
     */
    fetchChallengersBySubject(subjectId: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: ChallengerRecord;
    }>>;
    /**
     * Fetch defenders by subject
     */
    fetchDefendersBySubject(subjectId: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: DefenderRecord;
    }>>;
    /**
     * Fetch challenger records by subject (alias for fetchChallengersBySubject)
     */
    fetchChallengerRecordsBySubject(subjectId: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: ChallengerRecord;
    }>>;
    /**
     * Fetch defender records by subject (alias for fetchDefendersBySubject)
     */
    fetchDefenderRecordsBySubject(subjectId: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: DefenderRecord;
    }>>;
    /**
     * Fetch all juror records for a juror
     * Note: Uses raw account fetching to handle old accounts missing new fields
     */
    fetchJurorRecordsByJuror(juror: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: JurorRecord;
    }>>;
    /**
     * Fetch all challenger records for a challenger
     */
    fetchChallengerRecordsByChallenger(challenger: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: ChallengerRecord;
    }>>;
    /**
     * Fetch all defender records for a defender
     */
    fetchDefenderRecordsByDefender(defender: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: DefenderRecord;
    }>>;
    /**
     * Scan all user records and return what's eligible for collection
     * TODO: Implement for V2 round-based design
     */
    scanCollectableRecords(): Promise<{
        claims: {
            juror: Array<{
                subjectId: PublicKey;
                round: number;
                jurorRecord: PublicKey;
            }>;
            challenger: Array<{
                subjectId: PublicKey;
                round: number;
                challengerRecord: PublicKey;
            }>;
            defender: Array<{
                subjectId: PublicKey;
                round: number;
                defenderRecord: PublicKey;
            }>;
        };
        closes: {
            juror: Array<{
                subjectId: PublicKey;
                round: number;
            }>;
            challenger: Array<{
                subjectId: PublicKey;
                round: number;
            }>;
            defender: Array<{
                subjectId: PublicKey;
                round: number;
            }>;
        };
        totals: {
            estimatedRewards: number;
            estimatedRent: number;
        };
    }>;
    /**
     * Execute collect all - claims rewards and closes records
     * TODO: Implement for V2 round-based design with claim instructions
     */
    collectAll(): Promise<{
        signatures: string[];
        summary: {
            claimCount: number;
            closeCount: number;
        };
    }>;
    /**
     * Activity types that can be parsed from transaction history
     */
    static readonly ACTIVITY_TYPES: {
        readonly VOTE: "vote";
        readonly CHALLENGE: "challenge";
        readonly DEFEND: "defend";
        readonly CLAIM_JUROR: "claim_juror";
        readonly CLAIM_CHALLENGER: "claim_challenger";
        readonly CLAIM_DEFENDER: "claim_defender";
        readonly CLOSE_VOTE: "close_vote";
        readonly CLOSE_CHALLENGER: "close_challenger";
        readonly CLOSE_DEFENDER: "close_defender";
        readonly UNLOCK_STAKE: "unlock_stake";
    };
    /**
     * Instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
     */
    private static readonly INSTRUCTION_DISCRIMINATORS;
    /**
     * Fetch transaction history for a user and parse TribunalCraft activity
     * This allows showing historical activity even for closed records
     */
    fetchUserActivity(user: PublicKey, options?: {
        limit?: number;
        before?: string;
    }): Promise<Array<{
        type: string;
        signature: string;
        timestamp: number;
        slot: number;
        dispute?: string;
        subject?: string;
        accounts?: string[];
        amount?: number;
        rentReclaimed?: number;
        voteChoice?: "ForChallenger" | "ForDefender" | "ForRestoration" | "AgainstRestoration";
        outcome?: "ChallengerWins" | "DefenderWins" | "NoParticipation";
        rationaleCid?: string;
        success: boolean;
    }>>;
    private static readonly EVENT_DISCRIMINATORS;
    /**
     * Parse activity type from transaction logs and Anchor events
     */
    private parseActivityFromLogs;
    /**
     * Parse Anchor events from "Program data:" logs
     * Events contain reliable dispute/subject keys and amounts
     * Uses browser-compatible methods (no Node.js Buffer methods)
     */
    private parseAnchorEventsFromLogs;
    /**
     * Check if a discriminator matches an event name
     * Uses pre-computed EVENT_DISCRIMINATORS to avoid crypto dependency
     */
    private matchesEventName;
    /**
     * Extract vote choice and rationale from instruction data
     */
    private extractVoteDetailsFromTx;
    /**
     * Try to infer dispute outcome from transaction logs
     */
    private inferOutcomeFromLogs;
    /**
     * Extract dispute and subject pubkeys from transaction accounts
     *
     * Account layout for most TribunalCraft instructions:
     * [0] signer (user)
     * [1] user's main account (juror_account, challenger_account, etc.)
     * [2] dispute PDA
     * [3] record PDA (vote_record, challenger_record, etc.)
     * [4] subject PDA
     * [5+] other accounts (system_program, etc.)
     */
    private extractAccountsFromTx;
    /**
     * Extract balance changes for the user from transaction
     */
    private extractBalanceChanges;
    /**
     * Account types that can be batch fetched
     */
    static readonly ACCOUNT_TYPES: readonly ["dispute", "escrow", "jurorRecord", "challengerRecord", "defenderRecord", "jurorPool", "challengerPool", "defenderPool", "subject"];
    /**
     * Batch fetch multiple accounts in a single RPC call
     *
     * @example
     * ```ts
     * const results = await client.fetchMultiple([
     *   { address: disputePda, type: "dispute" },
     *   { address: escrowPda, type: "escrow" },
     *   { address: jurorRecordPda, type: "jurorRecord" },
     * ]);
     * // results[0] is Dispute | null
     * // results[1] is Escrow | null
     * // results[2] is JurorRecord | null
     * ```
     */
    fetchMultiple<T extends {
        address: PublicKey;
        type: string;
    }[]>(requests: T): Promise<Array<any | null>>;
    /**
     * Batch fetch for modal - fetches all required data in minimal RPC calls
     *
     * This is optimized for the SubjectModal use case where we need:
     * - Dispute (current round)
     * - Escrow
     * - User's records (juror, challenger, defender) for current round
     *
     * @returns Object with all fetched data, nulls for missing accounts
     */
    fetchModalData(subjectId: PublicKey, disputeRound: number, userPubkey?: PublicKey | null): Promise<{
        dispute: Dispute | null;
        escrow: Escrow | null;
        jurorRecord: JurorRecord | null;
        challengerRecord: ChallengerRecord | null;
        defenderRecord: DefenderRecord | null;
    }>;
}

declare const PROGRAM_ID: PublicKey;
declare const PROTOCOL_CONFIG_SEED: Buffer<ArrayBuffer>;
declare const DEFENDER_POOL_SEED: Buffer<ArrayBuffer>;
declare const CHALLENGER_POOL_SEED: Buffer<ArrayBuffer>;
declare const JUROR_POOL_SEED: Buffer<ArrayBuffer>;
declare const SUBJECT_SEED: Buffer<ArrayBuffer>;
declare const DISPUTE_SEED: Buffer<ArrayBuffer>;
declare const ESCROW_SEED: Buffer<ArrayBuffer>;
declare const DEFENDER_RECORD_SEED: Buffer<ArrayBuffer>;
declare const CHALLENGER_RECORD_SEED: Buffer<ArrayBuffer>;
declare const JUROR_RECORD_SEED: Buffer<ArrayBuffer>;
declare const TOTAL_FEE_BPS = 2000;
declare const PLATFORM_SHARE_BPS = 500;
declare const JUROR_SHARE_BPS = 9500;
declare const WINNER_SHARE_BPS = 8000;
declare const CLAIM_GRACE_PERIOD: number;
declare const TREASURY_SWEEP_PERIOD: number;
declare const BOT_REWARD_BPS = 100;
declare const MIN_JUROR_STAKE = 10000000;
declare const MIN_CHALLENGER_BOND = 10000000;
declare const MIN_DEFENDER_STAKE = 10000000;
declare const BASE_CHALLENGER_BOND = 10000000;
declare const STAKE_UNLOCK_BUFFER: number;
declare const MIN_VOTING_PERIOD: number;
declare const MAX_VOTING_PERIOD: number;
declare const REP_PRECISION = 1000000;
declare const REP_100_PERCENT = 100000000;
declare const INITIAL_REPUTATION = 50000000;
declare const REPUTATION_GAIN_RATE = 1000000;
declare const REPUTATION_LOSS_RATE = 2000000;
/**
 * Integer square root using Newton's method
 * Mirrors the on-chain implementation
 */
declare function integerSqrt(n: number): number;
/**
 * Calculate minimum bond based on challenger reputation
 * Mirrors the on-chain calculate_min_bond function
 *
 * Formula: min_bond = base_bond * sqrt(0.5 / reputation_pct)
 * - 50% rep = 1.0x multiplier (base bond)
 * - 25% rep = 1.41x multiplier
 * - 100% rep = 0.71x multiplier (minimum)
 * - 0% rep = 10x multiplier (maximum)
 *
 * @param reputation - Challenger's reputation (0 to REP_100_PERCENT)
 * @param baseBond - Base bond amount in lamports (default: BASE_CHALLENGER_BOND)
 * @returns Minimum bond required in lamports
 */
declare function calculateMinBond(reputation: number, baseBond?: number): number;
/**
 * Format reputation as percentage string
 * @param reputation - Reputation value (0 to REP_100_PERCENT)
 * @returns Formatted percentage string (e.g., "50.0%")
 */
declare function formatReputation(reputation: number): string;

/** Minimal juror record fields needed for reward calculation */
interface JurorRecordInput {
    votingPower: BN | number;
}
/** Minimal challenger record fields needed for reward calculation */
interface ChallengerRecordInput {
    stake: BN | number;
}
/** Minimal defender record fields needed for reward calculation */
interface DefenderRecordInput {
    bond: BN | number;
}
interface JurorRewardBreakdown {
    /** Total reward amount in lamports */
    total: number;
    /** Share of juror pool based on voting power */
    jurorPoolShare: number;
    /** Juror's voting power */
    votingPower: number;
    /** Total voting power in the round */
    totalVoteWeight: number;
    /** Percentage of total votes */
    votePercentage: number;
}
interface ChallengerRewardBreakdown {
    /** Total reward amount in lamports */
    total: number;
    /** Share of winner pool (only if challenger wins) */
    winnerPoolShare: number;
    /** Challenger's stake */
    stake: number;
    /** Total challenger stake in the round */
    totalStake: number;
    /** Percentage of winner pool */
    poolPercentage: number;
}
interface DefenderRewardBreakdown {
    /** Total reward amount in lamports */
    total: number;
    /** Share of safe bond returned (always returned regardless of outcome) */
    safeBondShare: number;
    /** Share of winner pool (only if defender wins) */
    winnerPoolShare: number;
    /** Defender's bond */
    bond: number;
    /** Total defender bond (bond at risk) */
    totalBondAtRisk: number;
    /** Safe bond amount */
    safeBond: number;
    /** Percentage of winner pool (if applicable) */
    poolPercentage: number;
}
interface UserRewardSummary {
    /** Total claimable reward across all roles */
    total: number;
    /** Juror reward breakdown (if user voted) */
    juror?: JurorRewardBreakdown;
    /** Challenger reward breakdown (if user challenged) */
    challenger?: ChallengerRewardBreakdown;
    /** Defender reward breakdown (if user defended) */
    defender?: DefenderRewardBreakdown;
    /** Whether challenger won this round */
    challengerWins: boolean;
    /** Whether defender won this round */
    defenderWins: boolean;
}
/**
 * Calculate juror reward for a specific round
 * All jurors share the juror pool proportionally by voting power
 */
declare function calculateJurorReward(roundResult: RoundResult, jurorRecord: JurorRecordInput): JurorRewardBreakdown;
/**
 * Calculate challenger reward for a specific round
 * - ChallengerWins: Share of winner pool proportional to stake
 * - NoParticipation: 99% refund proportional to stake (1% treasury fee)
 * - DefenderWins: Nothing (stake lost to winner pool)
 */
declare function calculateChallengerReward(roundResult: RoundResult, challengerRecord: ChallengerRecordInput): ChallengerRewardBreakdown;
/**
 * Calculate defender reward for a specific round
 * - Safe bond: Always returned regardless of outcome
 * - Winner pool: Only if defender wins or NoParticipation
 * - NoParticipation: 99% refund proportional to at-risk contribution
 */
declare function calculateDefenderReward(roundResult: RoundResult, defenderRecord: DefenderRecordInput): DefenderRewardBreakdown;
/**
 * Calculate total user rewards for a round
 * Combines juror, challenger, and defender rewards if applicable
 */
declare function calculateUserRewards(roundResult: RoundResult, records: {
    jurorRecord?: JurorRecordInput;
    challengerRecord?: ChallengerRecordInput;
    defenderRecord?: DefenderRecordInput;
}): UserRewardSummary;
/** Record with claim status */
interface ClaimableRecord {
    rewardClaimed: boolean;
}
/**
 * Check if a juror reward is claimable
 */
declare function isJurorRewardClaimable(jurorRecord: ClaimableRecord): boolean;
/**
 * Check if a challenger reward is claimable
 */
declare function isChallengerRewardClaimable(challengerRecord: ClaimableRecord, outcome: ResolutionOutcome): boolean;
/**
 * Check if a defender reward is claimable
 * Defenders can always claim (safe bond) regardless of outcome
 */
declare function isDefenderRewardClaimable(defenderRecord: ClaimableRecord): boolean;
/**
 * Format lamports to SOL with specified decimals
 */
declare function lamportsToSol(lamports: number, decimals?: number): string;

/** Claim role enum matching on-chain ClaimRole */
type ClaimRole = "Defender" | "Challenger" | "Juror";
/** Parsed RewardClaimedEvent */
interface RewardClaimedEvent {
    subjectId: PublicKey;
    round: number;
    claimer: PublicKey;
    role: ClaimRole;
    amount: number;
    timestamp: number;
}
/** Parsed RecordClosedEvent */
interface RecordClosedEvent {
    subjectId: PublicKey;
    round: number;
    owner: PublicKey;
    role: ClaimRole;
    rentReturned: number;
    timestamp: number;
}
/** Parsed StakeUnlockedEvent */
interface StakeUnlockedEvent {
    subjectId: PublicKey;
    round: number;
    juror: PublicKey;
    amount: number;
    timestamp: number;
}
/** Parsed DisputeResolvedEvent */
interface DisputeResolvedEvent {
    subjectId: PublicKey;
    round: number;
    outcome: string;
    totalStake: number;
    bondAtRisk: number;
    winnerPool: number;
    jurorPool: number;
    resolvedAt: number;
    timestamp: number;
}
/** Union of all parsed events */
type TribunalEvent = {
    type: "RewardClaimed";
    data: RewardClaimedEvent;
} | {
    type: "RecordClosed";
    data: RecordClosedEvent;
} | {
    type: "StakeUnlocked";
    data: StakeUnlockedEvent;
} | {
    type: "DisputeResolved";
    data: DisputeResolvedEvent;
};
/**
 * Create an event parser for TribunalCraft events
 */
declare function createEventParser(): EventParser;
/**
 * Parse events from transaction logs
 */
declare function parseEventsFromLogs(logs: string[]): TribunalEvent[];
/**
 * Fetch claim history for a user from transaction signatures
 * Returns all RewardClaimedEvents for the given claimer
 */
declare function fetchClaimHistory(connection: Connection, claimer: PublicKey, options?: {
    limit?: number;
    before?: string;
}): Promise<RewardClaimedEvent[]>;
/**
 * Fetch claim history for a specific subject
 */
declare function fetchClaimHistoryForSubject(connection: Connection, subjectId: PublicKey, escrowAddress: PublicKey, options?: {
    limit?: number;
}): Promise<RewardClaimedEvent[]>;
/**
 * Get claim summary for a user on a specific subject/round
 * Uses escrow address for efficient querying (only fetches txs for that subject)
 */
declare function getClaimSummaryFromHistory(connection: Connection, claimer: PublicKey, subjectId: PublicKey, round: number, escrowAddress?: PublicKey): Promise<{
    defender?: RewardClaimedEvent;
    challenger?: RewardClaimedEvent;
    juror?: RewardClaimedEvent;
    total: number;
}>;
/**
 * Parse events from a single transaction
 */
declare function parseEventsFromTransaction(connection: Connection, signature: string): Promise<TribunalEvent[]>;

interface TransactionError {
    code: number | null;
    name: string;
    message: string;
    raw?: string;
    logs?: string[];
}
interface SimulationResult {
    success: boolean;
    error?: TransactionError;
    logs?: string[];
    unitsConsumed?: number;
}
/**
 * Parse an error from transaction simulation or execution
 */
declare function parseTransactionError(error: unknown): TransactionError;
/**
 * Parse simulation response error
 */
declare function parseSimulationError(err: any, logs?: string[]): TransactionError;
/**
 * Simulate a transaction before sending
 */
declare function simulateTransaction(connection: Connection, transaction: Transaction | VersionedTransaction): Promise<SimulationResult>;
/**
 * Custom error class with parsed error info
 */
declare class TribunalError extends Error {
    code: number | null;
    errorName: string;
    raw?: string;
    logs?: string[];
    constructor(error: TransactionError);
}
/**
 * Wrap a function that may throw and convert errors to TribunalError
 */
declare function withErrorHandling<T>(fn: () => Promise<T>): Promise<T>;
/**
 * Get all program error codes
 */
declare function getProgramErrors(): Record<number, {
    name: string;
    message: string;
}>;
/**
 * Get error info by code
 */
declare function getErrorByCode(code: number): {
    name: string;
    message: string;
} | undefined;
/**
 * Get error info by name
 */
declare function getErrorByName(name: string): {
    code: number;
    name: string;
    message: string;
} | undefined;

/**
 * TribunalCraft Content Types
 *
 * These types define the JSON structure stored at CIDs on IPFS.
 * The protocol only stores CIDs - content interpretation is platform-specific.
 */
/**
 * Subject Content - stored at subject CID
 * Defines what is being staked on and can be disputed
 */
interface SubjectContent {
    version: 1;
    title: string;
    description: string;
    category: SubjectCategory;
    terms: {
        text: string;
        documentCid?: string;
    };
    evidence?: Evidence[];
    parties?: Party[];
    createdAt: string;
    platformData?: Record<string, unknown>;
}
/**
 * Subject categories - extensible by platform
 */
type SubjectCategory = "contract" | "claim" | "deliverable" | "service" | "listing" | "proposal" | "other";
/**
 * Evidence item - supporting materials for subjects or disputes
 */
interface Evidence {
    type: "document" | "image" | "video" | "link" | "text";
    title: string;
    cid?: string;
    url?: string;
    text?: string;
    description?: string;
}
/**
 * Party in an agreement
 */
interface Party {
    wallet: string;
    name?: string;
    role: string;
}
/**
 * Dispute Content - stored at dispute reason CID
 * Explains why a subject is being challenged
 */
interface DisputeContent {
    version: 1;
    type: ContentDisputeType;
    title: string;
    reason: string;
    evidence: Evidence[];
    requestedOutcome: string;
    createdAt: string;
    subjectCid: string;
    platformData?: Record<string, unknown>;
}
/**
 * Dispute types for content (separate from on-chain DisputeType enum)
 */
type ContentDisputeType = "breach" | "fraud" | "non_delivery" | "quality" | "refund" | "other";
/**
 * Vote Rationale Content - stored at vote rationale CID
 * Explains why a juror voted a certain way
 */
interface VoteRationaleContent {
    version: 1;
    rationale: string;
    evidence?: Evidence[];
    createdAt: string;
    platformData?: Record<string, unknown>;
}
/**
 * Helper to create empty subject content
 */
declare function createSubjectContent(partial: Partial<SubjectContent> & Pick<SubjectContent, "title" | "description" | "category" | "terms">): SubjectContent;
/**
 * Helper to create empty dispute content
 */
declare function createDisputeContent(partial: Partial<DisputeContent> & Pick<DisputeContent, "title" | "reason" | "type" | "subjectCid" | "requestedOutcome">): DisputeContent;
/**
 * Helper to create vote rationale content
 */
declare function createVoteRationaleContent(partial: Partial<VoteRationaleContent> & Pick<VoteRationaleContent, "rationale">): VoteRationaleContent;
/**
 * Validate subject content
 */
declare function validateSubjectContent(content: unknown): content is SubjectContent;
/**
 * Validate dispute content
 */
declare function validateDisputeContent(content: unknown): content is DisputeContent;
/**
 * Validate vote rationale content
 */
declare function validateVoteRationaleContent(content: unknown): content is VoteRationaleContent;

var address = "YxF3CEwUr5Nhk8FjzZDhKFcSHfgRHYA31Ccm3vd2Mrz";
var metadata = {
	name: "tribunalcraft",
	version: "0.1.0",
	spec: "0.1.0",
	description: "Decentralized arbitration protocol"
};
var instructions = [
	{
		name: "add_bond_direct",
		docs: [
			"Add bond directly from wallet"
		],
		discriminator: [
			2,
			240,
			206,
			50,
			106,
			238,
			109,
			254
		],
		accounts: [
			{
				name: "defender",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				writable: true
			},
			{
				name: "defender_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "defender"
						},
						{
							kind: "account",
							path: "subject.round",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "defender_pool",
				docs: [
					"Defender's pool - created if doesn't exist"
				],
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "defender"
						}
					]
				}
			},
			{
				name: "dispute",
				docs: [
					"Optional: Active dispute (for updating bond_at_risk during dispute)"
				],
				writable: true,
				optional: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								105,
								115,
								112,
								117,
								116,
								101
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "amount",
				type: "u64"
			}
		]
	},
	{
		name: "add_bond_from_pool",
		docs: [
			"Add bond from defender pool"
		],
		discriminator: [
			127,
			107,
			194,
			189,
			87,
			53,
			213,
			211
		],
		accounts: [
			{
				name: "defender",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				writable: true
			},
			{
				name: "defender_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "defender"
						}
					]
				}
			},
			{
				name: "defender_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "defender"
						},
						{
							kind: "account",
							path: "subject.round",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "dispute",
				docs: [
					"Optional: Active dispute (for updating bond_at_risk during dispute)"
				],
				writable: true,
				optional: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								105,
								115,
								112,
								117,
								116,
								101
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "amount",
				type: "u64"
			}
		]
	},
	{
		name: "add_challenger_stake",
		docs: [
			"Add stake to challenger pool"
		],
		discriminator: [
			240,
			11,
			100,
			179,
			24,
			255,
			67,
			234
		],
		accounts: [
			{
				name: "challenger",
				writable: true,
				signer: true
			},
			{
				name: "challenger_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								104,
								97,
								108,
								108,
								101,
								110,
								103,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "challenger"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "amount",
				type: "u64"
			}
		]
	},
	{
		name: "add_juror_stake",
		docs: [
			"Add stake to juror pool"
		],
		discriminator: [
			42,
			194,
			234,
			159,
			186,
			115,
			32,
			169
		],
		accounts: [
			{
				name: "juror",
				writable: true,
				signer: true
			},
			{
				name: "juror_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "juror"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "amount",
				type: "u64"
			}
		]
	},
	{
		name: "add_to_vote",
		docs: [
			"Add stake to an existing vote"
		],
		discriminator: [
			202,
			66,
			94,
			152,
			90,
			103,
			240,
			68
		],
		accounts: [
			{
				name: "juror",
				writable: true,
				signer: true
			},
			{
				name: "juror_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "juror"
						}
					]
				}
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "dispute",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								105,
								115,
								112,
								117,
								116,
								101
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "juror_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "juror"
						},
						{
							kind: "arg",
							path: "round"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "round",
				type: "u32"
			},
			{
				name: "additional_stake",
				type: "u64"
			}
		]
	},
	{
		name: "claim_challenger",
		docs: [
			"Claim challenger reward"
		],
		discriminator: [
			148,
			51,
			9,
			223,
			64,
			230,
			123,
			189
		],
		accounts: [
			{
				name: "challenger",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "challenger_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								104,
								97,
								108,
								108,
								101,
								110,
								103,
								101,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "challenger"
						},
						{
							kind: "arg",
							path: "round"
						}
					]
				}
			},
			{
				name: "challenger_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								104,
								97,
								108,
								108,
								101,
								110,
								103,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "challenger"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "round",
				type: "u32"
			}
		]
	},
	{
		name: "claim_defender",
		docs: [
			"Claim defender reward"
		],
		discriminator: [
			230,
			104,
			48,
			216,
			165,
			86,
			123,
			142
		],
		accounts: [
			{
				name: "defender",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "defender_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "defender"
						},
						{
							kind: "arg",
							path: "round"
						}
					]
				}
			},
			{
				name: "defender_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "defender"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "round",
				type: "u32"
			}
		]
	},
	{
		name: "claim_juror",
		docs: [
			"Claim juror reward"
		],
		discriminator: [
			239,
			58,
			13,
			171,
			137,
			109,
			76,
			30
		],
		accounts: [
			{
				name: "juror",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "juror_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "juror"
						},
						{
							kind: "arg",
							path: "round"
						}
					]
				}
			},
			{
				name: "juror_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "juror"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "round",
				type: "u32"
			}
		]
	},
	{
		name: "close_challenger_record",
		docs: [
			"Close challenger record"
		],
		discriminator: [
			254,
			255,
			55,
			246,
			51,
			196,
			121,
			232
		],
		accounts: [
			{
				name: "challenger",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "challenger_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								104,
								97,
								108,
								108,
								101,
								110,
								103,
								101,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "challenger"
						},
						{
							kind: "arg",
							path: "round"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "round",
				type: "u32"
			}
		]
	},
	{
		name: "close_defender_record",
		docs: [
			"Close defender record"
		],
		discriminator: [
			192,
			4,
			53,
			135,
			80,
			151,
			171,
			87
		],
		accounts: [
			{
				name: "defender",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "defender_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "defender"
						},
						{
							kind: "arg",
							path: "round"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "round",
				type: "u32"
			}
		]
	},
	{
		name: "close_juror_record",
		docs: [
			"Close juror record"
		],
		discriminator: [
			17,
			237,
			233,
			65,
			255,
			237,
			33,
			58
		],
		accounts: [
			{
				name: "juror",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "juror_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "juror"
						},
						{
							kind: "arg",
							path: "round"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "round",
				type: "u32"
			}
		]
	},
	{
		name: "create_defender_pool",
		docs: [
			"Create a defender pool"
		],
		discriminator: [
			146,
			138,
			10,
			14,
			120,
			153,
			97,
			34
		],
		accounts: [
			{
				name: "owner",
				writable: true,
				signer: true
			},
			{
				name: "defender_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "owner"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "initial_amount",
				type: "u64"
			},
			{
				name: "max_bond",
				type: "u64"
			}
		]
	},
	{
		name: "create_dispute",
		docs: [
			"Create a dispute against a subject"
		],
		discriminator: [
			161,
			99,
			53,
			116,
			60,
			79,
			149,
			105
		],
		accounts: [
			{
				name: "challenger",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "dispute",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								105,
								115,
								112,
								117,
								116,
								101
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "challenger_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								104,
								97,
								108,
								108,
								101,
								110,
								103,
								101,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "challenger"
						},
						{
							kind: "account",
							path: "subject.round",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "challenger_pool",
				docs: [
					"Challenger's pool - created if doesn't exist"
				],
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								104,
								97,
								108,
								108,
								101,
								110,
								103,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "challenger"
						}
					]
				}
			},
			{
				name: "creator_defender_pool",
				docs: [
					"Creator's defender pool - for auto-matching"
				],
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "subject.creator",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "creator_defender_record",
				docs: [
					"Creator's defender record for this round - init_if_needed for pool contribution"
				],
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "subject.creator",
							account: "Subject"
						},
						{
							kind: "account",
							path: "subject.round",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "dispute_type",
				type: {
					defined: {
						name: "DisputeType"
					}
				}
			},
			{
				name: "details_cid",
				type: "string"
			},
			{
				name: "stake",
				type: "u64"
			}
		]
	},
	{
		name: "create_subject",
		docs: [
			"Create a subject with Subject + Dispute + Escrow PDAs",
			"Creator's pool is linked. If initial_bond > 0, transfers from wallet."
		],
		discriminator: [
			243,
			24,
			101,
			208,
			170,
			5,
			242,
			26
		],
		accounts: [
			{
				name: "creator",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "arg",
							path: "subject_id"
						}
					]
				}
			},
			{
				name: "dispute",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								105,
								115,
								112,
								117,
								116,
								101
							]
						},
						{
							kind: "arg",
							path: "subject_id"
						}
					]
				}
			},
			{
				name: "escrow",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "arg",
							path: "subject_id"
						}
					]
				}
			},
			{
				name: "defender_pool",
				docs: [
					"Creator's defender pool - created if doesn't exist"
				],
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "creator"
						}
					]
				}
			},
			{
				name: "defender_record",
				docs: [
					"Creator's defender record for round 0"
				],
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "arg",
							path: "subject_id"
						},
						{
							kind: "account",
							path: "creator"
						},
						{
							kind: "const",
							value: [
								0,
								0,
								0,
								0
							]
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "subject_id",
				type: "pubkey"
			},
			{
				name: "details_cid",
				type: "string"
			},
			{
				name: "match_mode",
				type: "bool"
			},
			{
				name: "voting_period",
				type: "i64"
			},
			{
				name: "initial_bond",
				type: "u64"
			}
		]
	},
	{
		name: "deposit_defender_pool",
		docs: [
			"Deposit to defender pool"
		],
		discriminator: [
			91,
			11,
			23,
			235,
			88,
			18,
			65,
			162
		],
		accounts: [
			{
				name: "owner",
				writable: true,
				signer: true
			},
			{
				name: "defender_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "owner"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "amount",
				type: "u64"
			}
		]
	},
	{
		name: "initialize_config",
		docs: [
			"Initialize protocol config (one-time setup by deployer)"
		],
		discriminator: [
			208,
			127,
			21,
			1,
			194,
			190,
			196,
			70
		],
		accounts: [
			{
				name: "authority",
				writable: true,
				signer: true
			},
			{
				name: "config",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								112,
								114,
								111,
								116,
								111,
								99,
								111,
								108,
								95,
								99,
								111,
								110,
								102,
								105,
								103
							]
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
		]
	},
	{
		name: "join_challengers",
		docs: [
			"Join existing dispute as additional challenger"
		],
		discriminator: [
			223,
			204,
			21,
			113,
			209,
			155,
			162,
			77
		],
		accounts: [
			{
				name: "challenger",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "dispute",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								105,
								115,
								112,
								117,
								116,
								101
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "challenger_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								104,
								97,
								108,
								108,
								101,
								110,
								103,
								101,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "challenger"
						},
						{
							kind: "account",
							path: "subject.round",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "challenger_pool",
				docs: [
					"Challenger's pool - created if doesn't exist"
				],
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								104,
								97,
								108,
								108,
								101,
								110,
								103,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "challenger"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "details_cid",
				type: "string"
			},
			{
				name: "stake",
				type: "u64"
			}
		]
	},
	{
		name: "register_challenger",
		docs: [
			"Register as a challenger"
		],
		discriminator: [
			69,
			151,
			151,
			202,
			4,
			226,
			241,
			134
		],
		accounts: [
			{
				name: "challenger",
				writable: true,
				signer: true
			},
			{
				name: "challenger_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								104,
								97,
								108,
								108,
								101,
								110,
								103,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "challenger"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "stake_amount",
				type: "u64"
			}
		]
	},
	{
		name: "register_juror",
		docs: [
			"Register as a juror"
		],
		discriminator: [
			116,
			81,
			98,
			42,
			220,
			219,
			2,
			141
		],
		accounts: [
			{
				name: "juror",
				writable: true,
				signer: true
			},
			{
				name: "juror_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "juror"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "stake_amount",
				type: "u64"
			}
		]
	},
	{
		name: "resolve_dispute",
		docs: [
			"Resolve a dispute after voting period ends"
		],
		discriminator: [
			231,
			6,
			202,
			6,
			96,
			103,
			12,
			230
		],
		accounts: [
			{
				name: "resolver",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "dispute",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								105,
								115,
								112,
								117,
								116,
								101
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "protocol_config",
				docs: [
					"Protocol config for treasury address"
				],
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								112,
								114,
								111,
								116,
								111,
								99,
								111,
								108,
								95,
								99,
								111,
								110,
								102,
								105,
								103
							]
						}
					]
				}
			},
			{
				name: "treasury",
				docs: [
					"Treasury receives platform fee"
				],
				writable: true
			},
			{
				name: "creator_defender_pool",
				docs: [
					"Optional: Creator's defender pool to check for auto-rebond"
				],
				writable: true,
				optional: true
			},
			{
				name: "creator_defender_record",
				docs: [
					"Optional: Creator's defender record - initialized via init_if_needed",
					"Uses subject.creator and next_round for PDA seeds"
				],
				writable: true,
				optional: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "subject.creator",
							account: "Subject"
						},
						{
							kind: "arg",
							path: "next_round"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "next_round",
				type: "u32"
			}
		]
	},
	{
		name: "submit_restore",
		docs: [
			"Submit a restoration request for an invalidated subject"
		],
		discriminator: [
			32,
			59,
			202,
			78,
			224,
			183,
			80,
			191
		],
		accounts: [
			{
				name: "restorer",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "dispute",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								105,
								115,
								112,
								117,
								116,
								101
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "challenger_record",
				docs: [
					"Challenger record for the restorer (acts as first challenger)"
				],
				writable: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "dispute_type",
				type: {
					defined: {
						name: "DisputeType"
					}
				}
			},
			{
				name: "details_cid",
				type: "string"
			},
			{
				name: "stake_amount",
				type: "u64"
			}
		]
	},
	{
		name: "sweep_round_creator",
		docs: [
			"Creator sweep unclaimed funds (after 30 days)"
		],
		discriminator: [
			171,
			13,
			243,
			211,
			73,
			235,
			65,
			30
		],
		accounts: [
			{
				name: "creator",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "round",
				type: "u32"
			}
		]
	},
	{
		name: "sweep_round_treasury",
		docs: [
			"Treasury sweep unclaimed funds (after 90 days)"
		],
		discriminator: [
			224,
			70,
			132,
			233,
			159,
			248,
			133,
			130
		],
		accounts: [
			{
				name: "sweeper",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "protocol_config",
				docs: [
					"Protocol config for treasury address"
				],
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								112,
								114,
								111,
								116,
								111,
								99,
								111,
								108,
								95,
								99,
								111,
								110,
								102,
								105,
								103
							]
						}
					]
				}
			},
			{
				name: "treasury",
				docs: [
					"Treasury receives swept funds"
				],
				writable: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "round",
				type: "u32"
			}
		]
	},
	{
		name: "unlock_juror_stake",
		docs: [
			"Unlock juror stake (7 days after resolution)"
		],
		discriminator: [
			109,
			73,
			56,
			32,
			115,
			125,
			5,
			242
		],
		accounts: [
			{
				name: "juror",
				writable: true,
				signer: true
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "escrow",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								101,
								115,
								99,
								114,
								111,
								119
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "juror_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "juror"
						},
						{
							kind: "arg",
							path: "round"
						}
					]
				}
			},
			{
				name: "juror_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "juror"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "round",
				type: "u32"
			}
		]
	},
	{
		name: "unregister_juror",
		docs: [
			"Unregister juror"
		],
		discriminator: [
			199,
			200,
			113,
			139,
			182,
			118,
			206,
			124
		],
		accounts: [
			{
				name: "juror",
				writable: true,
				signer: true
			},
			{
				name: "juror_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "juror"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
		]
	},
	{
		name: "update_max_bond",
		docs: [
			"Update max_bond setting for defender pool"
		],
		discriminator: [
			19,
			70,
			113,
			22,
			140,
			149,
			203,
			23
		],
		accounts: [
			{
				name: "owner",
				writable: true,
				signer: true
			},
			{
				name: "defender_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "owner"
						}
					]
				}
			}
		],
		args: [
			{
				name: "new_max_bond",
				type: "u64"
			}
		]
	},
	{
		name: "update_treasury",
		docs: [
			"Update treasury address (admin only)"
		],
		discriminator: [
			60,
			16,
			243,
			66,
			96,
			59,
			254,
			131
		],
		accounts: [
			{
				name: "authority",
				writable: true,
				signer: true,
				relations: [
					"config"
				]
			},
			{
				name: "config",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								112,
								114,
								111,
								116,
								111,
								99,
								111,
								108,
								95,
								99,
								111,
								110,
								102,
								105,
								103
							]
						}
					]
				}
			}
		],
		args: [
			{
				name: "new_treasury",
				type: "pubkey"
			}
		]
	},
	{
		name: "vote_on_dispute",
		docs: [
			"Vote on a dispute"
		],
		discriminator: [
			7,
			213,
			96,
			171,
			252,
			59,
			55,
			23
		],
		accounts: [
			{
				name: "juror",
				writable: true,
				signer: true
			},
			{
				name: "juror_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "juror"
						}
					]
				}
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "dispute",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								105,
								115,
								112,
								117,
								116,
								101
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "juror_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "juror"
						},
						{
							kind: "account",
							path: "subject.round",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "choice",
				type: {
					defined: {
						name: "VoteChoice"
					}
				}
			},
			{
				name: "stake_allocation",
				type: "u64"
			},
			{
				name: "rationale_cid",
				type: "string"
			}
		]
	},
	{
		name: "vote_on_restore",
		docs: [
			"Vote on a restoration"
		],
		discriminator: [
			122,
			123,
			92,
			240,
			251,
			205,
			189,
			32
		],
		accounts: [
			{
				name: "juror",
				writable: true,
				signer: true
			},
			{
				name: "juror_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "juror"
						}
					]
				}
			},
			{
				name: "subject",
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								115,
								117,
								98,
								106,
								101,
								99,
								116
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "dispute",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								105,
								115,
								112,
								117,
								116,
								101
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "juror_record",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								114,
								101,
								99,
								111,
								114,
								100
							]
						},
						{
							kind: "account",
							path: "subject.subject_id",
							account: "Subject"
						},
						{
							kind: "account",
							path: "juror"
						},
						{
							kind: "account",
							path: "subject.round",
							account: "Subject"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "choice",
				type: {
					defined: {
						name: "RestoreVoteChoice"
					}
				}
			},
			{
				name: "stake_allocation",
				type: "u64"
			},
			{
				name: "rationale_cid",
				type: "string"
			}
		]
	},
	{
		name: "withdraw_challenger_stake",
		docs: [
			"Withdraw from challenger pool"
		],
		discriminator: [
			78,
			33,
			10,
			217,
			10,
			63,
			81,
			45
		],
		accounts: [
			{
				name: "challenger",
				writable: true,
				signer: true
			},
			{
				name: "challenger_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								99,
								104,
								97,
								108,
								108,
								101,
								110,
								103,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "challenger"
						}
					]
				}
			},
			{
				name: "protocol_config",
				docs: [
					"Protocol config for treasury address"
				],
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								112,
								114,
								111,
								116,
								111,
								99,
								111,
								108,
								95,
								99,
								111,
								110,
								102,
								105,
								103
							]
						}
					]
				}
			},
			{
				name: "treasury",
				docs: [
					"Treasury receives slashed amounts"
				],
				writable: true
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "amount",
				type: "u64"
			}
		]
	},
	{
		name: "withdraw_defender_pool",
		docs: [
			"Withdraw from defender pool"
		],
		discriminator: [
			34,
			62,
			12,
			146,
			220,
			10,
			123,
			61
		],
		accounts: [
			{
				name: "owner",
				writable: true,
				signer: true
			},
			{
				name: "defender_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								100,
								101,
								102,
								101,
								110,
								100,
								101,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "owner"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "amount",
				type: "u64"
			}
		]
	},
	{
		name: "withdraw_juror_stake",
		docs: [
			"Withdraw from juror pool"
		],
		discriminator: [
			178,
			43,
			144,
			250,
			188,
			199,
			135,
			133
		],
		accounts: [
			{
				name: "juror",
				writable: true,
				signer: true
			},
			{
				name: "juror_pool",
				writable: true,
				pda: {
					seeds: [
						{
							kind: "const",
							value: [
								106,
								117,
								114,
								111,
								114,
								95,
								112,
								111,
								111,
								108
							]
						},
						{
							kind: "account",
							path: "juror"
						}
					]
				}
			},
			{
				name: "system_program",
				address: "11111111111111111111111111111111"
			}
		],
		args: [
			{
				name: "amount",
				type: "u64"
			}
		]
	}
];
var accounts = [
	{
		name: "ChallengerPool",
		discriminator: [
			88,
			158,
			225,
			15,
			47,
			185,
			77,
			238
		]
	},
	{
		name: "ChallengerRecord",
		discriminator: [
			8,
			80,
			134,
			108,
			192,
			142,
			121,
			14
		]
	},
	{
		name: "DefenderPool",
		discriminator: [
			227,
			100,
			92,
			157,
			203,
			252,
			63,
			118
		]
	},
	{
		name: "DefenderRecord",
		discriminator: [
			14,
			3,
			219,
			215,
			38,
			254,
			254,
			92
		]
	},
	{
		name: "Dispute",
		discriminator: [
			36,
			49,
			241,
			67,
			40,
			36,
			241,
			74
		]
	},
	{
		name: "Escrow",
		discriminator: [
			31,
			213,
			123,
			187,
			186,
			22,
			218,
			155
		]
	},
	{
		name: "JurorPool",
		discriminator: [
			217,
			104,
			42,
			167,
			209,
			1,
			171,
			33
		]
	},
	{
		name: "JurorRecord",
		discriminator: [
			144,
			76,
			94,
			12,
			102,
			207,
			151,
			40
		]
	},
	{
		name: "ProtocolConfig",
		discriminator: [
			207,
			91,
			250,
			28,
			152,
			179,
			215,
			209
		]
	},
	{
		name: "Subject",
		discriminator: [
			52,
			161,
			41,
			165,
			202,
			238,
			138,
			166
		]
	}
];
var events = [
	{
		name: "AddToVoteEvent",
		discriminator: [
			228,
			249,
			101,
			93,
			5,
			47,
			190,
			66
		]
	},
	{
		name: "BondAddedEvent",
		discriminator: [
			139,
			73,
			9,
			193,
			204,
			12,
			69,
			174
		]
	},
	{
		name: "BondWithdrawnEvent",
		discriminator: [
			1,
			22,
			115,
			176,
			15,
			248,
			123,
			151
		]
	},
	{
		name: "ChallengerJoinedEvent",
		discriminator: [
			163,
			95,
			96,
			131,
			237,
			97,
			229,
			35
		]
	},
	{
		name: "DisputeCreatedEvent",
		discriminator: [
			89,
			162,
			48,
			158,
			30,
			116,
			145,
			247
		]
	},
	{
		name: "DisputeResolvedEvent",
		discriminator: [
			152,
			37,
			98,
			245,
			229,
			39,
			150,
			78
		]
	},
	{
		name: "PoolDepositEvent",
		discriminator: [
			17,
			52,
			153,
			164,
			206,
			202,
			228,
			220
		]
	},
	{
		name: "PoolWithdrawEvent",
		discriminator: [
			4,
			215,
			203,
			122,
			8,
			73,
			179,
			46
		]
	},
	{
		name: "RecordClosedEvent",
		discriminator: [
			127,
			196,
			65,
			213,
			113,
			178,
			80,
			55
		]
	},
	{
		name: "RestoreResolvedEvent",
		discriminator: [
			151,
			57,
			204,
			231,
			9,
			240,
			171,
			205
		]
	},
	{
		name: "RestoreSubmittedEvent",
		discriminator: [
			91,
			160,
			93,
			112,
			192,
			112,
			155,
			30
		]
	},
	{
		name: "RestoreVoteEvent",
		discriminator: [
			54,
			218,
			241,
			44,
			90,
			247,
			210,
			238
		]
	},
	{
		name: "RewardClaimedEvent",
		discriminator: [
			246,
			43,
			215,
			228,
			82,
			49,
			230,
			56
		]
	},
	{
		name: "RoundSweptEvent",
		discriminator: [
			245,
			127,
			207,
			243,
			30,
			229,
			3,
			134
		]
	},
	{
		name: "StakeUnlockedEvent",
		discriminator: [
			99,
			31,
			70,
			177,
			150,
			105,
			180,
			93
		]
	},
	{
		name: "SubjectCreatedEvent",
		discriminator: [
			70,
			23,
			14,
			215,
			220,
			223,
			89,
			17
		]
	},
	{
		name: "SubjectStatusChangedEvent",
		discriminator: [
			118,
			28,
			47,
			229,
			59,
			42,
			149,
			118
		]
	},
	{
		name: "VoteEvent",
		discriminator: [
			195,
			71,
			250,
			105,
			120,
			119,
			234,
			134
		]
	}
];
var errors = [
	{
		code: 6000,
		name: "InsufficientBalance",
		msg: "Insufficient balance in defender pool"
	}
];
var types = [
	{
		name: "AddToVoteEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "juror",
					type: "pubkey"
				},
				{
					name: "additional_stake",
					type: "u64"
				},
				{
					name: "additional_voting_power",
					type: "u64"
				},
				{
					name: "total_stake",
					type: "u64"
				},
				{
					name: "total_voting_power",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "BondAddedEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "defender",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "amount",
					type: "u64"
				},
				{
					name: "source",
					type: {
						defined: {
							name: "BondSource"
						}
					}
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "BondSource",
		docs: [
			"Source of bond funds"
		],
		type: {
			kind: "enum",
			variants: [
				{
					name: "Direct"
				},
				{
					name: "Pool"
				}
			]
		}
	},
	{
		name: "BondWithdrawnEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "defender",
					type: "pubkey"
				},
				{
					name: "amount",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "ChallengerJoinedEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "challenger",
					type: "pubkey"
				},
				{
					name: "stake",
					type: "u64"
				},
				{
					name: "total_stake",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "ChallengerPool",
		docs: [
			"Challenger's pool for holding stake funds",
			"Seeds: [CHALLENGER_POOL_SEED, owner]",
			"One per user, persistent"
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "owner",
					docs: [
						"Pool owner's wallet address"
					],
					type: "pubkey"
				},
				{
					name: "balance",
					docs: [
						"Available balance"
					],
					type: "u64"
				},
				{
					name: "reputation",
					docs: [
						"Reputation score (6 decimals, 100% = 100_000_000)"
					],
					type: "u64"
				},
				{
					name: "bump",
					docs: [
						"Bump seed for PDA"
					],
					type: "u8"
				},
				{
					name: "created_at",
					docs: [
						"Creation timestamp"
					],
					type: "i64"
				}
			]
		}
	},
	{
		name: "ChallengerRecord",
		docs: [
			"Individual challenger's stake for a specific subject round",
			"Seeds: [CHALLENGER_RECORD_SEED, subject_id, challenger, round]",
			"Created per round, closed after claim"
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					docs: [
						"The subject_id this record belongs to"
					],
					type: "pubkey"
				},
				{
					name: "challenger",
					docs: [
						"Challenger's wallet address"
					],
					type: "pubkey"
				},
				{
					name: "round",
					docs: [
						"Which round this stake is for"
					],
					type: "u32"
				},
				{
					name: "stake",
					docs: [
						"Stake amount contributed to the dispute"
					],
					type: "u64"
				},
				{
					name: "details_cid",
					docs: [
						"Evidence CID (IPFS hash)"
					],
					type: "string"
				},
				{
					name: "reward_claimed",
					docs: [
						"Whether reward has been claimed"
					],
					type: "bool"
				},
				{
					name: "bump",
					docs: [
						"Bump seed for PDA"
					],
					type: "u8"
				},
				{
					name: "challenged_at",
					docs: [
						"Timestamp when this challenger joined"
					],
					type: "i64"
				}
			]
		}
	},
	{
		name: "ClaimRole",
		type: {
			kind: "enum",
			variants: [
				{
					name: "Defender"
				},
				{
					name: "Challenger"
				},
				{
					name: "Juror"
				}
			]
		}
	},
	{
		name: "DefenderPool",
		docs: [
			"Defender's pool for holding bond funds",
			"Seeds: [DEFENDER_POOL_SEED, owner]",
			"One per user, persistent"
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "owner",
					docs: [
						"Pool owner's wallet address"
					],
					type: "pubkey"
				},
				{
					name: "balance",
					docs: [
						"Available balance (not locked in active bonds)"
					],
					type: "u64"
				},
				{
					name: "max_bond",
					docs: [
						"Max bond per subject (for auto-allocation)"
					],
					type: "u64"
				},
				{
					name: "bump",
					docs: [
						"Bump seed for PDA"
					],
					type: "u8"
				},
				{
					name: "created_at",
					docs: [
						"Creation timestamp"
					],
					type: "i64"
				},
				{
					name: "updated_at",
					docs: [
						"Last update timestamp"
					],
					type: "i64"
				}
			]
		}
	},
	{
		name: "DefenderRecord",
		docs: [
			"Individual defender's bond for a specific subject round",
			"Seeds: [DEFENDER_RECORD_SEED, subject_id, defender, round]",
			"Created per round, closed after claim"
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					docs: [
						"The subject_id this record belongs to"
					],
					type: "pubkey"
				},
				{
					name: "defender",
					docs: [
						"Defender's wallet address"
					],
					type: "pubkey"
				},
				{
					name: "round",
					docs: [
						"Which round this bond is for"
					],
					type: "u32"
				},
				{
					name: "bond",
					docs: [
						"Bond amount backing the subject"
					],
					type: "u64"
				},
				{
					name: "source",
					docs: [
						"Source of bond funds"
					],
					type: {
						defined: {
							name: "BondSource"
						}
					}
				},
				{
					name: "reward_claimed",
					docs: [
						"Whether reward has been claimed"
					],
					type: "bool"
				},
				{
					name: "bump",
					docs: [
						"Bump seed for PDA"
					],
					type: "u8"
				},
				{
					name: "bonded_at",
					docs: [
						"Timestamp when this defender bonded"
					],
					type: "i64"
				}
			]
		}
	},
	{
		name: "Dispute",
		docs: [
			"Dispute - Persistent PDA, reset after each round",
			"Seeds: [DISPUTE_SEED, subject_id]"
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					docs: [
						"Subject being disputed (subject_id, not Subject PDA)"
					],
					type: "pubkey"
				},
				{
					name: "round",
					docs: [
						"Which round this dispute is for"
					],
					type: "u32"
				},
				{
					name: "status",
					docs: [
						"Dispute status"
					],
					type: {
						defined: {
							name: "DisputeStatus"
						}
					}
				},
				{
					name: "dispute_type",
					docs: [
						"Dispute type"
					],
					type: {
						defined: {
							name: "DisputeType"
						}
					}
				},
				{
					name: "total_stake",
					docs: [
						"Total stake from all challengers"
					],
					type: "u64"
				},
				{
					name: "challenger_count",
					docs: [
						"Number of challengers"
					],
					type: "u16"
				},
				{
					name: "bond_at_risk",
					docs: [
						"Bond at risk (calculated based on mode)",
						"Match: min(total_stake, available_bond)",
						"Prop: available_bond"
					],
					type: "u64"
				},
				{
					name: "defender_count",
					docs: [
						"Number of defenders (snapshot at dispute creation, updated if new defenders join)"
					],
					type: "u16"
				},
				{
					name: "votes_for_challenger",
					docs: [
						"Cumulative voting power for challenger"
					],
					type: "u64"
				},
				{
					name: "votes_for_defender",
					docs: [
						"Cumulative voting power for defender"
					],
					type: "u64"
				},
				{
					name: "vote_count",
					docs: [
						"Number of jurors who voted"
					],
					type: "u16"
				},
				{
					name: "voting_starts_at",
					docs: [
						"Voting start timestamp"
					],
					type: "i64"
				},
				{
					name: "voting_ends_at",
					docs: [
						"Voting end timestamp"
					],
					type: "i64"
				},
				{
					name: "outcome",
					docs: [
						"Resolution outcome"
					],
					type: {
						defined: {
							name: "ResolutionOutcome"
						}
					}
				},
				{
					name: "resolved_at",
					docs: [
						"Resolution timestamp"
					],
					type: "i64"
				},
				{
					name: "is_restore",
					docs: [
						"True if this dispute is a restoration request"
					],
					type: "bool"
				},
				{
					name: "restore_stake",
					docs: [
						"Stake posted by restorer (for restorations only)"
					],
					type: "u64"
				},
				{
					name: "restorer",
					docs: [
						"Restorer's pubkey (for restorations only)"
					],
					type: "pubkey"
				},
				{
					name: "details_cid",
					docs: [
						"Details CID (IPFS hash for dispute details)"
					],
					type: "string"
				},
				{
					name: "bump",
					docs: [
						"Bump seed for PDA"
					],
					type: "u8"
				},
				{
					name: "created_at",
					docs: [
						"Creation timestamp"
					],
					type: "i64"
				}
			]
		}
	},
	{
		name: "DisputeCreatedEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "creator",
					type: "pubkey"
				},
				{
					name: "stake",
					type: "u64"
				},
				{
					name: "bond_at_risk",
					type: "u64"
				},
				{
					name: "voting_ends_at",
					type: "i64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "DisputeResolvedEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "outcome",
					type: {
						defined: {
							name: "ResolutionOutcome"
						}
					}
				},
				{
					name: "total_stake",
					type: "u64"
				},
				{
					name: "bond_at_risk",
					type: "u64"
				},
				{
					name: "winner_pool",
					type: "u64"
				},
				{
					name: "juror_pool",
					type: "u64"
				},
				{
					name: "resolved_at",
					type: "i64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "DisputeStatus",
		docs: [
			"Dispute status"
		],
		type: {
			kind: "enum",
			variants: [
				{
					name: "None"
				},
				{
					name: "Pending"
				},
				{
					name: "Resolved"
				}
			]
		}
	},
	{
		name: "DisputeType",
		docs: [
			"Dispute type (generic categories)"
		],
		type: {
			kind: "enum",
			variants: [
				{
					name: "Other"
				},
				{
					name: "Breach"
				},
				{
					name: "Fraud"
				},
				{
					name: "QualityDispute"
				},
				{
					name: "NonDelivery"
				},
				{
					name: "Misrepresentation"
				},
				{
					name: "PolicyViolation"
				},
				{
					name: "DamagesClaim"
				}
			]
		}
	},
	{
		name: "Escrow",
		docs: [
			"Escrow account - holds funds for claims across rounds",
			"Seeds: [ESCROW_SEED, subject_id]",
			"Persistent PDA - created once, reused"
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					docs: [
						"Subject this escrow belongs to"
					],
					type: "pubkey"
				},
				{
					name: "balance",
					docs: [
						"Current balance available for claims"
					],
					type: "u64"
				},
				{
					name: "rounds",
					docs: [
						"Historical round results for claims",
						"Vec grows with realloc on dispute creation, shrinks on last claim"
					],
					type: {
						vec: {
							defined: {
								name: "RoundResult"
							}
						}
					}
				},
				{
					name: "bump",
					docs: [
						"Bump seed for PDA"
					],
					type: "u8"
				}
			]
		}
	},
	{
		name: "JurorPool",
		docs: [
			"Juror's pool for holding voting stake",
			"Seeds: [JUROR_POOL_SEED, owner]",
			"One per user, persistent"
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "owner",
					docs: [
						"Juror's wallet address"
					],
					type: "pubkey"
				},
				{
					name: "balance",
					docs: [
						"Available balance"
					],
					type: "u64"
				},
				{
					name: "reputation",
					docs: [
						"Reputation score (6 decimals, 100% = 100_000_000)"
					],
					type: "u64"
				},
				{
					name: "bump",
					docs: [
						"Bump seed for PDA"
					],
					type: "u8"
				},
				{
					name: "created_at",
					docs: [
						"Registration timestamp"
					],
					type: "i64"
				}
			]
		}
	},
	{
		name: "JurorRecord",
		docs: [
			"Juror's vote record for a specific subject round",
			"Seeds: [JUROR_RECORD_SEED, subject_id, juror, round]",
			"Created per round, closed after claim"
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					docs: [
						"The subject_id this record belongs to"
					],
					type: "pubkey"
				},
				{
					name: "juror",
					docs: [
						"Juror who cast the vote"
					],
					type: "pubkey"
				},
				{
					name: "round",
					docs: [
						"Which round this vote is for"
					],
					type: "u32"
				},
				{
					name: "choice",
					docs: [
						"Vote choice for regular disputes"
					],
					type: {
						defined: {
							name: "VoteChoice"
						}
					}
				},
				{
					name: "restore_choice",
					docs: [
						"Vote choice for restorations (only used when is_restore_vote is true)"
					],
					type: {
						defined: {
							name: "RestoreVoteChoice"
						}
					}
				},
				{
					name: "is_restore_vote",
					docs: [
						"Whether this is a restoration vote"
					],
					type: "bool"
				},
				{
					name: "voting_power",
					docs: [
						"Calculated voting power"
					],
					type: "u64"
				},
				{
					name: "stake_allocation",
					docs: [
						"Stake allocated (locked from juror pool)"
					],
					type: "u64"
				},
				{
					name: "reward_claimed",
					docs: [
						"Whether reward has been claimed"
					],
					type: "bool"
				},
				{
					name: "stake_unlocked",
					docs: [
						"Whether stake has been unlocked (7 days after voting ends)"
					],
					type: "bool"
				},
				{
					name: "bump",
					docs: [
						"Bump seed for PDA"
					],
					type: "u8"
				},
				{
					name: "voted_at",
					docs: [
						"Vote timestamp"
					],
					type: "i64"
				},
				{
					name: "rationale_cid",
					docs: [
						"IPFS CID for vote rationale (optional)"
					],
					type: "string"
				}
			]
		}
	},
	{
		name: "PoolDepositEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "pool_type",
					type: {
						defined: {
							name: "PoolType"
						}
					}
				},
				{
					name: "owner",
					type: "pubkey"
				},
				{
					name: "amount",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "PoolType",
		type: {
			kind: "enum",
			variants: [
				{
					name: "Defender"
				},
				{
					name: "Challenger"
				},
				{
					name: "Juror"
				}
			]
		}
	},
	{
		name: "PoolWithdrawEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "pool_type",
					type: {
						defined: {
							name: "PoolType"
						}
					}
				},
				{
					name: "owner",
					type: "pubkey"
				},
				{
					name: "amount",
					type: "u64"
				},
				{
					name: "slashed",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "ProtocolConfig",
		docs: [
			"Protocol-wide configuration account",
			"Stores treasury address and admin authority for fee collection"
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "authority",
					docs: [
						"Admin who can update config (deployer initially)"
					],
					type: "pubkey"
				},
				{
					name: "treasury",
					docs: [
						"Platform fee recipient address"
					],
					type: "pubkey"
				},
				{
					name: "bump",
					docs: [
						"PDA bump seed"
					],
					type: "u8"
				}
			]
		}
	},
	{
		name: "RecordClosedEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "owner",
					type: "pubkey"
				},
				{
					name: "role",
					type: {
						defined: {
							name: "ClaimRole"
						}
					}
				},
				{
					name: "rent_returned",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "ResolutionOutcome",
		docs: [
			"Resolution outcome"
		],
		type: {
			kind: "enum",
			variants: [
				{
					name: "None"
				},
				{
					name: "ChallengerWins"
				},
				{
					name: "DefenderWins"
				},
				{
					name: "NoParticipation"
				}
			]
		}
	},
	{
		name: "RestoreResolvedEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "outcome",
					type: {
						defined: {
							name: "ResolutionOutcome"
						}
					}
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "RestoreSubmittedEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "restorer",
					type: "pubkey"
				},
				{
					name: "stake",
					type: "u64"
				},
				{
					name: "details_cid",
					type: "string"
				},
				{
					name: "voting_period",
					type: "i64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "RestoreVoteChoice",
		docs: [
			"Vote choice for restorations"
		],
		type: {
			kind: "enum",
			variants: [
				{
					name: "ForRestoration"
				},
				{
					name: "AgainstRestoration"
				}
			]
		}
	},
	{
		name: "RestoreVoteEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "juror",
					type: "pubkey"
				},
				{
					name: "choice",
					type: {
						defined: {
							name: "RestoreVoteChoice"
						}
					}
				},
				{
					name: "voting_power",
					type: "u64"
				},
				{
					name: "rationale_cid",
					type: "string"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "RewardClaimedEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "claimer",
					type: "pubkey"
				},
				{
					name: "role",
					type: {
						defined: {
							name: "ClaimRole"
						}
					}
				},
				{
					name: "amount",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "RoundResult",
		docs: [
			"Result data for a completed round, stored in Escrow",
			"Used for claim calculations after resolution"
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "round",
					docs: [
						"Round number"
					],
					type: "u32"
				},
				{
					name: "creator",
					docs: [
						"Dispute creator (for rent refund on last claim or sweep)"
					],
					type: "pubkey"
				},
				{
					name: "resolved_at",
					docs: [
						"Resolution timestamp (for grace period calculation)"
					],
					type: "i64"
				},
				{
					name: "outcome",
					docs: [
						"Resolution outcome"
					],
					type: {
						defined: {
							name: "ResolutionOutcome"
						}
					}
				},
				{
					name: "total_stake",
					docs: [
						"Total stake from challengers"
					],
					type: "u64"
				},
				{
					name: "bond_at_risk",
					docs: [
						"Bond at risk from defenders"
					],
					type: "u64"
				},
				{
					name: "safe_bond",
					docs: [
						"Safe bond (available_bond - bond_at_risk) returned to defenders"
					],
					type: "u64"
				},
				{
					name: "total_vote_weight",
					docs: [
						"Total voting power cast"
					],
					type: "u64"
				},
				{
					name: "winner_pool",
					docs: [
						"Winner pool amount (80%)"
					],
					type: "u64"
				},
				{
					name: "juror_pool",
					docs: [
						"Juror pool amount (19%)"
					],
					type: "u64"
				},
				{
					name: "defender_count",
					docs: [
						"Number of defenders"
					],
					type: "u16"
				},
				{
					name: "challenger_count",
					docs: [
						"Number of challengers"
					],
					type: "u16"
				},
				{
					name: "juror_count",
					docs: [
						"Number of jurors"
					],
					type: "u16"
				},
				{
					name: "defender_claims",
					docs: [
						"Number of defenders who have claimed"
					],
					type: "u16"
				},
				{
					name: "challenger_claims",
					docs: [
						"Number of challengers who have claimed"
					],
					type: "u16"
				},
				{
					name: "juror_claims",
					docs: [
						"Number of jurors who have claimed"
					],
					type: "u16"
				}
			]
		}
	},
	{
		name: "RoundSweptEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "sweeper",
					type: "pubkey"
				},
				{
					name: "unclaimed",
					type: "u64"
				},
				{
					name: "bot_reward",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "StakeUnlockedEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "juror",
					type: "pubkey"
				},
				{
					name: "amount",
					type: "u64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "Subject",
		docs: [
			"Subject that defenders back - identified by subject_id",
			"Persistent PDA - created once, reused across rounds"
		],
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					docs: [
						"Subject identifier (could be PDA from external program)"
					],
					type: "pubkey"
				},
				{
					name: "creator",
					docs: [
						"Creator of this subject (for auto-bond on reset)"
					],
					type: "pubkey"
				},
				{
					name: "details_cid",
					docs: [
						"Content CID (IPFS hash for subject details)"
					],
					type: "string"
				},
				{
					name: "round",
					docs: [
						"Current round counter (0, 1, 2, ...)"
					],
					type: "u32"
				},
				{
					name: "available_bond",
					docs: [
						"Total bond available for current round"
					],
					type: "u64"
				},
				{
					name: "defender_count",
					docs: [
						"Number of defenders in current round"
					],
					type: "u16"
				},
				{
					name: "status",
					docs: [
						"Current status"
					],
					type: {
						defined: {
							name: "SubjectStatus"
						}
					}
				},
				{
					name: "match_mode",
					docs: [
						"Match mode: true = bond_at_risk matches stake, false = proportionate (all bond at risk)"
					],
					type: "bool"
				},
				{
					name: "voting_period",
					docs: [
						"Voting period in seconds for this subject's disputes"
					],
					type: "i64"
				},
				{
					name: "dispute",
					docs: [
						"Current active dispute (if any)"
					],
					type: "pubkey"
				},
				{
					name: "bump",
					docs: [
						"Bump seed for PDA"
					],
					type: "u8"
				},
				{
					name: "created_at",
					docs: [
						"Creation timestamp"
					],
					type: "i64"
				},
				{
					name: "updated_at",
					docs: [
						"Last update timestamp"
					],
					type: "i64"
				},
				{
					name: "last_dispute_total",
					docs: [
						"Previous dispute's (stake + bond) - minimum stake required for restoration"
					],
					type: "u64"
				},
				{
					name: "last_voting_period",
					docs: [
						"Previous dispute's voting period - restorations use 2x this value"
					],
					type: "i64"
				}
			]
		}
	},
	{
		name: "SubjectCreatedEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "creator",
					type: "pubkey"
				},
				{
					name: "match_mode",
					type: "bool"
				},
				{
					name: "voting_period",
					type: "i64"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "SubjectStatus",
		docs: [
			"Subject status"
		],
		type: {
			kind: "enum",
			variants: [
				{
					name: "Dormant"
				},
				{
					name: "Valid"
				},
				{
					name: "Disputed"
				},
				{
					name: "Invalid"
				},
				{
					name: "Restoring"
				}
			]
		}
	},
	{
		name: "SubjectStatusChangedEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "old_status",
					type: "u8"
				},
				{
					name: "new_status",
					type: "u8"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	},
	{
		name: "VoteChoice",
		docs: [
			"Vote choice for disputes"
		],
		type: {
			kind: "enum",
			variants: [
				{
					name: "ForChallenger"
				},
				{
					name: "ForDefender"
				}
			]
		}
	},
	{
		name: "VoteEvent",
		type: {
			kind: "struct",
			fields: [
				{
					name: "subject_id",
					type: "pubkey"
				},
				{
					name: "round",
					type: "u32"
				},
				{
					name: "juror",
					type: "pubkey"
				},
				{
					name: "choice",
					type: {
						defined: {
							name: "VoteChoice"
						}
					}
				},
				{
					name: "voting_power",
					type: "u64"
				},
				{
					name: "rationale_cid",
					type: "string"
				},
				{
					name: "timestamp",
					type: "i64"
				}
			]
		}
	}
];
var idl = {
	address: address,
	metadata: metadata,
	instructions: instructions,
	accounts: accounts,
	events: events,
	errors: errors,
	types: types
};

export { BASE_CHALLENGER_BOND, BOT_REWARD_BPS, type BondSource, BondSourceEnum, CHALLENGER_POOL_SEED, CHALLENGER_RECORD_SEED, CLAIM_GRACE_PERIOD, type ChallengerPool, type ChallengerRecord, type ChallengerRecordInput, type ChallengerRewardBreakdown, type ClaimRole, type ContentDisputeType, DEFENDER_POOL_SEED, DEFENDER_RECORD_SEED, DISPUTE_SEED, type DefenderPool, type DefenderRecord, type DefenderRecordInput, type DefenderRewardBreakdown, type Dispute, type DisputeContent, type DisputeResolvedEvent, type DisputeStatus, DisputeStatusEnum, type DisputeType, DisputeTypeEnum, ESCROW_SEED, type SimulationResult as ErrorSimulationResult, type Escrow, type Evidence, idl as IDL, INITIAL_REPUTATION, JUROR_POOL_SEED, JUROR_RECORD_SEED, JUROR_SHARE_BPS, type JurorPool, type JurorRecord, type JurorRecordInput, type JurorRewardBreakdown, MAX_VOTING_PERIOD, MIN_CHALLENGER_BOND, MIN_DEFENDER_STAKE, MIN_JUROR_STAKE, MIN_VOTING_PERIOD, PDA, PLATFORM_SHARE_BPS, PROGRAM_ID, PROTOCOL_CONFIG_SEED, type Party, type ProtocolConfig, REPUTATION_GAIN_RATE, REPUTATION_LOSS_RATE, REP_100_PERCENT, REP_PRECISION, type RecordClosedEvent, type ResolutionOutcome, ResolutionOutcomeEnum, type RestoreVoteChoice, RestoreVoteChoiceEnum, type RewardClaimedEvent, type RoundResult, STAKE_UNLOCK_BUFFER, SUBJECT_SEED, type SimulationResult$1 as SimulationResult, type StakeUnlockedEvent, type Subject, type SubjectCategory, type SubjectContent, type SubjectStatus, SubjectStatusEnum, TOTAL_FEE_BPS, TREASURY_SWEEP_PERIOD, type TransactionError, type TransactionResult, TribunalCraftClient, type TribunalCraftClientConfig, TribunalError, type TribunalEvent, type Tribunalcraft, type UserActivity, type UserRewardSummary, type VoteChoice, VoteChoiceEnum, type VoteRationaleContent, WINNER_SHARE_BPS, calculateChallengerReward, calculateDefenderReward, calculateJurorReward, calculateMinBond, calculateUserRewards, createDisputeContent, createEventParser, createSubjectContent, createVoteRationaleContent, fetchClaimHistory, fetchClaimHistoryForSubject, formatReputation, getBondSourceName, getClaimSummaryFromHistory, getDisputeTypeName, getErrorByCode, getErrorByName, getOutcomeName, getProgramErrors, integerSqrt, isChallengerRewardClaimable, isChallengerWins, isDefenderRewardClaimable, isDefenderWins, isDisputeNone, isDisputePending, isDisputeResolved, isJurorRewardClaimable, isNoParticipation, isSubjectDisputed, isSubjectDormant, isSubjectInvalid, isSubjectRestoring, isSubjectValid, lamportsToSol, parseEventsFromLogs, parseEventsFromTransaction, parseSimulationError, parseTransactionError, pda, simulateTransaction, validateDisputeContent, validateSubjectContent, validateVoteRationaleContent, withErrorHandling };
