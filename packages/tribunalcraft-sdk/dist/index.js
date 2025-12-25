"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BASE_CHALLENGER_BOND: () => BASE_CHALLENGER_BOND,
  BOT_REWARD_BPS: () => BOT_REWARD_BPS,
  BondSourceEnum: () => BondSourceEnum,
  CHALLENGER_POOL_SEED: () => CHALLENGER_POOL_SEED,
  CHALLENGER_RECORD_SEED: () => CHALLENGER_RECORD_SEED,
  CLAIM_GRACE_PERIOD: () => CLAIM_GRACE_PERIOD,
  DEFENDER_POOL_SEED: () => DEFENDER_POOL_SEED,
  DEFENDER_RECORD_SEED: () => DEFENDER_RECORD_SEED,
  DISPUTE_SEED: () => DISPUTE_SEED,
  DisputeStatusEnum: () => DisputeStatusEnum,
  DisputeTypeEnum: () => DisputeTypeEnum,
  ESCROW_SEED: () => ESCROW_SEED,
  IDL: () => idl_default,
  INITIAL_REPUTATION: () => INITIAL_REPUTATION,
  JUROR_POOL_SEED: () => JUROR_POOL_SEED,
  JUROR_RECORD_SEED: () => JUROR_RECORD_SEED,
  JUROR_SHARE_BPS: () => JUROR_SHARE_BPS,
  MAX_VOTING_PERIOD: () => MAX_VOTING_PERIOD,
  MIN_CHALLENGER_BOND: () => MIN_CHALLENGER_BOND,
  MIN_DEFENDER_STAKE: () => MIN_DEFENDER_STAKE,
  MIN_JUROR_STAKE: () => MIN_JUROR_STAKE,
  MIN_VOTING_PERIOD: () => MIN_VOTING_PERIOD,
  PDA: () => PDA,
  PLATFORM_SHARE_BPS: () => PLATFORM_SHARE_BPS,
  PROGRAM_ID: () => PROGRAM_ID,
  PROTOCOL_CONFIG_SEED: () => PROTOCOL_CONFIG_SEED,
  REPUTATION_GAIN_RATE: () => REPUTATION_GAIN_RATE,
  REPUTATION_LOSS_RATE: () => REPUTATION_LOSS_RATE,
  REP_100_PERCENT: () => REP_100_PERCENT,
  REP_PRECISION: () => REP_PRECISION,
  ResolutionOutcomeEnum: () => ResolutionOutcomeEnum,
  RestoreVoteChoiceEnum: () => RestoreVoteChoiceEnum,
  STAKE_UNLOCK_BUFFER: () => STAKE_UNLOCK_BUFFER,
  SUBJECT_SEED: () => SUBJECT_SEED,
  SubjectStatusEnum: () => SubjectStatusEnum,
  TOTAL_FEE_BPS: () => TOTAL_FEE_BPS,
  TREASURY_SWEEP_PERIOD: () => TREASURY_SWEEP_PERIOD,
  TribunalCraftClient: () => TribunalCraftClient,
  TribunalError: () => TribunalError,
  VoteChoiceEnum: () => VoteChoiceEnum,
  WINNER_SHARE_BPS: () => WINNER_SHARE_BPS,
  calculateChallengerReward: () => calculateChallengerReward,
  calculateDefenderReward: () => calculateDefenderReward,
  calculateJurorReward: () => calculateJurorReward,
  calculateMinBond: () => calculateMinBond,
  calculateUserRewards: () => calculateUserRewards,
  createDisputeContent: () => createDisputeContent,
  createEventParser: () => createEventParser,
  createSubjectContent: () => createSubjectContent,
  createVoteRationaleContent: () => createVoteRationaleContent,
  fetchClaimHistory: () => fetchClaimHistory,
  fetchClaimHistoryForSubject: () => fetchClaimHistoryForSubject,
  formatReputation: () => formatReputation,
  getBondSourceName: () => getBondSourceName,
  getClaimSummaryFromHistory: () => getClaimSummaryFromHistory,
  getDisputeTypeName: () => getDisputeTypeName,
  getErrorByCode: () => getErrorByCode,
  getErrorByName: () => getErrorByName,
  getOutcomeName: () => getOutcomeName,
  getProgramErrors: () => getProgramErrors,
  integerSqrt: () => integerSqrt,
  isChallengerRewardClaimable: () => isChallengerRewardClaimable,
  isChallengerWins: () => isChallengerWins,
  isDefenderRewardClaimable: () => isDefenderRewardClaimable,
  isDefenderWins: () => isDefenderWins,
  isDisputeNone: () => isDisputeNone,
  isDisputePending: () => isDisputePending,
  isDisputeResolved: () => isDisputeResolved,
  isJurorRewardClaimable: () => isJurorRewardClaimable,
  isNoParticipation: () => isNoParticipation,
  isSubjectDisputed: () => isSubjectDisputed,
  isSubjectDormant: () => isSubjectDormant,
  isSubjectInvalid: () => isSubjectInvalid,
  isSubjectRestoring: () => isSubjectRestoring,
  isSubjectValid: () => isSubjectValid,
  lamportsToSol: () => lamportsToSol,
  parseEventsFromLogs: () => parseEventsFromLogs,
  parseEventsFromTransaction: () => parseEventsFromTransaction,
  parseSimulationError: () => parseSimulationError,
  parseTransactionError: () => parseTransactionError,
  pda: () => pda,
  simulateTransaction: () => simulateTransaction,
  validateDisputeContent: () => validateDisputeContent,
  validateSubjectContent: () => validateSubjectContent,
  validateVoteRationaleContent: () => validateVoteRationaleContent,
  withErrorHandling: () => withErrorHandling
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var import_web33 = require("@solana/web3.js");
var import_anchor = require("@coral-xyz/anchor");

// src/pda.ts
var import_web32 = require("@solana/web3.js");

// src/constants.ts
var import_web3 = require("@solana/web3.js");
var PROGRAM_ID = new import_web3.PublicKey(
  "YxF3CEwUr5Nhk8FjzZDhKFcSHfgRHYA31Ccm3vd2Mrz"
);
var PROTOCOL_CONFIG_SEED = Buffer.from("protocol_config");
var DEFENDER_POOL_SEED = Buffer.from("defender_pool");
var CHALLENGER_POOL_SEED = Buffer.from("challenger_pool");
var JUROR_POOL_SEED = Buffer.from("juror_pool");
var SUBJECT_SEED = Buffer.from("subject");
var DISPUTE_SEED = Buffer.from("dispute");
var ESCROW_SEED = Buffer.from("escrow");
var DEFENDER_RECORD_SEED = Buffer.from("defender_record");
var CHALLENGER_RECORD_SEED = Buffer.from("challenger_record");
var JUROR_RECORD_SEED = Buffer.from("juror_record");
var TOTAL_FEE_BPS = 2e3;
var PLATFORM_SHARE_BPS = 500;
var JUROR_SHARE_BPS = 9500;
var WINNER_SHARE_BPS = 8e3;
var CLAIM_GRACE_PERIOD = 30 * 24 * 60 * 60;
var TREASURY_SWEEP_PERIOD = 90 * 24 * 60 * 60;
var BOT_REWARD_BPS = 100;
var MIN_JUROR_STAKE = 1e7;
var MIN_CHALLENGER_BOND = 1e7;
var MIN_DEFENDER_STAKE = 1e7;
var BASE_CHALLENGER_BOND = 1e7;
var STAKE_UNLOCK_BUFFER = 7 * 24 * 60 * 60;
var MIN_VOTING_PERIOD = 24 * 60 * 60;
var MAX_VOTING_PERIOD = 30 * 24 * 60 * 60;
var REP_PRECISION = 1e6;
var REP_100_PERCENT = 1e8;
var INITIAL_REPUTATION = 5e7;
var REPUTATION_GAIN_RATE = 1e6;
var REPUTATION_LOSS_RATE = 2e6;
function integerSqrt(n) {
  if (n === 0) return 0;
  let x = n;
  let y = Math.floor((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.floor((x + Math.floor(n / x)) / 2);
  }
  return x;
}
function calculateMinBond(reputation, baseBond = BASE_CHALLENGER_BOND) {
  if (reputation === 0) {
    return baseBond * 10;
  }
  const sqrtHalf = 7071;
  const sqrtRep = integerSqrt(reputation);
  if (sqrtRep === 0) {
    return baseBond * 10;
  }
  const result = Math.floor(baseBond * sqrtHalf / sqrtRep);
  return Math.max(result, Math.floor(baseBond * 7 / 10));
}
function formatReputation(reputation) {
  return `${(reputation / REP_PRECISION).toFixed(1)}%`;
}

// src/pda.ts
var PDA = class {
  constructor(programId = PROGRAM_ID) {
    this.programId = programId;
  }
  /**
   * Derive Protocol Config PDA
   */
  protocolConfig() {
    return import_web32.PublicKey.findProgramAddressSync(
      [PROTOCOL_CONFIG_SEED],
      this.programId
    );
  }
  // =========================================================================
  // Pool PDAs (persistent per user)
  // =========================================================================
  /**
   * Derive Defender Pool PDA for an owner
   * Seeds: [defender_pool, owner]
   */
  defenderPool(owner) {
    return import_web32.PublicKey.findProgramAddressSync(
      [DEFENDER_POOL_SEED, owner.toBuffer()],
      this.programId
    );
  }
  /**
   * Derive Challenger Pool PDA for an owner
   * Seeds: [challenger_pool, owner]
   */
  challengerPool(owner) {
    return import_web32.PublicKey.findProgramAddressSync(
      [CHALLENGER_POOL_SEED, owner.toBuffer()],
      this.programId
    );
  }
  /**
   * Derive Juror Pool PDA for a juror
   * Seeds: [juror_pool, owner]
   */
  jurorPool(owner) {
    return import_web32.PublicKey.findProgramAddressSync(
      [JUROR_POOL_SEED, owner.toBuffer()],
      this.programId
    );
  }
  // =========================================================================
  // Subject PDAs (persistent per subject_id)
  // =========================================================================
  /**
   * Derive Subject PDA for a subject ID
   * Seeds: [subject, subject_id]
   */
  subject(subjectId) {
    return import_web32.PublicKey.findProgramAddressSync(
      [SUBJECT_SEED, subjectId.toBuffer()],
      this.programId
    );
  }
  /**
   * Derive Dispute PDA for a subject
   * Seeds: [dispute, subject_id]
   * Note: In V2, there's one Dispute per subject (persistent, reset per round)
   */
  dispute(subjectId) {
    return import_web32.PublicKey.findProgramAddressSync(
      [DISPUTE_SEED, subjectId.toBuffer()],
      this.programId
    );
  }
  /**
   * Derive Escrow PDA for a subject
   * Seeds: [escrow, subject_id]
   * Holds funds and RoundResult history for claims
   */
  escrow(subjectId) {
    return import_web32.PublicKey.findProgramAddressSync(
      [ESCROW_SEED, subjectId.toBuffer()],
      this.programId
    );
  }
  // =========================================================================
  // Round-specific Record PDAs
  // =========================================================================
  /**
   * Derive Defender Record PDA for a specific round
   * Seeds: [defender_record, subject_id, defender, round]
   */
  defenderRecord(subjectId, defender, round) {
    const roundBuffer = Buffer.alloc(4);
    roundBuffer.writeUInt32LE(round);
    return import_web32.PublicKey.findProgramAddressSync(
      [DEFENDER_RECORD_SEED, subjectId.toBuffer(), defender.toBuffer(), roundBuffer],
      this.programId
    );
  }
  /**
   * Derive Challenger Record PDA for a specific round
   * Seeds: [challenger_record, subject_id, challenger, round]
   */
  challengerRecord(subjectId, challenger, round) {
    const roundBuffer = Buffer.alloc(4);
    roundBuffer.writeUInt32LE(round);
    return import_web32.PublicKey.findProgramAddressSync(
      [CHALLENGER_RECORD_SEED, subjectId.toBuffer(), challenger.toBuffer(), roundBuffer],
      this.programId
    );
  }
  /**
   * Derive Juror Record PDA for a specific round
   * Seeds: [juror_record, subject_id, juror, round]
   */
  jurorRecord(subjectId, juror, round) {
    const roundBuffer = Buffer.alloc(4);
    roundBuffer.writeUInt32LE(round);
    return import_web32.PublicKey.findProgramAddressSync(
      [JUROR_RECORD_SEED, subjectId.toBuffer(), juror.toBuffer(), roundBuffer],
      this.programId
    );
  }
};
var pda = new PDA();

// src/idl.json
var idl_default = {
  address: "YxF3CEwUr5Nhk8FjzZDhKFcSHfgRHYA31Ccm3vd2Mrz",
  metadata: {
    name: "tribunalcraft",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Decentralized arbitration protocol"
  },
  instructions: [
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
      args: []
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
      args: []
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
  ],
  accounts: [
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
  ],
  events: [
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
  ],
  errors: [
    {
      code: 6e3,
      name: "InsufficientBalance",
      msg: "Insufficient balance in defender pool"
    }
  ],
  types: [
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
  ]
};

// src/client.ts
var ERROR_CODES = {
  6e3: "Unauthorized",
  6001: "InvalidConfig",
  6002: "StakeBelowMinimum",
  6003: "BondBelowMinimum",
  6004: "InsufficientStake",
  6005: "InsufficientAvailableStake",
  6006: "StakeLocked",
  6007: "SubjectCannotBeDisputed",
  6008: "SubjectCannotBeStaked",
  6009: "DisputeAlreadyExists",
  6010: "DisputeNotFound",
  6011: "DisputeAlreadyResolved",
  6012: "VotingNotStarted",
  6013: "VotingEnded",
  6014: "VotingNotEnded",
  6015: "AlreadyVoted",
  6016: "InvalidVoteChoice",
  6017: "RewardAlreadyClaimed",
  6018: "NotOnWinningSide",
  6019: "InvalidSubjectStatus",
  6020: "AppealNotAllowed",
  6021: "AppealAlreadyExists",
  6022: "NotRestorer",
  6023: "RestorationFailed"
};
var _TribunalCraftClient = class _TribunalCraftClient {
  constructor(config) {
    this.connection = config.connection;
    this.programId = config.programId ?? PROGRAM_ID;
    this.pda = new PDA(this.programId);
    this.wallet = config.wallet ?? null;
    this.simulateFirst = config.simulateFirst ?? false;
    const readOnlyProvider = new import_anchor.AnchorProvider(
      this.connection,
      {},
      // Dummy wallet for read-only operations
      { commitment: "confirmed" }
    );
    this.anchorProgram = new import_anchor.Program(
      idl_default,
      readOnlyProvider
    );
    if (this.wallet) {
      this.initProgram();
    }
  }
  initProgram() {
    if (!this.wallet) return;
    const provider = new import_anchor.AnchorProvider(this.connection, this.wallet, {
      commitment: "confirmed"
    });
    this.anchorProgram = new import_anchor.Program(
      idl_default,
      provider
    );
  }
  /**
   * Set or update the wallet
   */
  setWallet(wallet) {
    this.wallet = wallet;
    this.initProgram();
  }
  /**
   * Get the current wallet public key
   */
  get walletPublicKey() {
    return this.wallet?.publicKey ?? null;
  }
  /**
   * Get the Anchor program instance (for advanced usage)
   */
  get program() {
    return this.anchorProgram;
  }
  /**
   * Get wallet and program, throwing if not connected
   */
  getWalletAndProgram() {
    if (!this.wallet || !this.anchorProgram) {
      throw new Error("Wallet not connected. Call setWallet() first.");
    }
    return { wallet: this.wallet, program: this.anchorProgram };
  }
  // ===========================================================================
  // Transaction Simulation
  // ===========================================================================
  /**
   * Parse program error from simulation logs
   */
  parseErrorFromLogs(logs) {
    for (const log of logs) {
      const customErrorMatch = log.match(/Program log: AnchorError.*Error Code: (\w+)\. Error Number: (\d+)\. Error Message: (.+)\./);
      if (customErrorMatch) {
        const errorCode = parseInt(customErrorMatch[2], 10);
        const errorMessage = customErrorMatch[3];
        return { code: errorCode, message: `${customErrorMatch[1]}: ${errorMessage}` };
      }
      const errorNumberMatch = log.match(/Error Number: (\d+)/);
      if (errorNumberMatch) {
        const code = parseInt(errorNumberMatch[1], 10);
        const message = ERROR_CODES[code] || `Unknown error (${code})`;
        return { code, message };
      }
      const instructionErrorMatch = log.match(/Program.*failed: custom program error: 0x([0-9a-fA-F]+)/);
      if (instructionErrorMatch) {
        const code = parseInt(instructionErrorMatch[1], 16);
        const message = ERROR_CODES[code] || `Custom error 0x${instructionErrorMatch[1]}`;
        return { code, message };
      }
      if (log.includes("Error:") || log.includes("failed:")) {
        return { message: log };
      }
    }
    return { message: "Transaction simulation failed" };
  }
  /**
   * Simulate a transaction and return detailed results
   */
  async simulateTransaction(tx) {
    try {
      let response;
      if (tx instanceof import_web33.Transaction) {
        const { blockhash } = await this.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = this.wallet?.publicKey;
        const result = await this.connection.simulateTransaction(tx);
        response = result.value;
      } else {
        const result = await this.connection.simulateTransaction(tx);
        response = result.value;
      }
      if (response.err) {
        const { code, message } = this.parseErrorFromLogs(response.logs || []);
        return {
          success: false,
          error: message,
          errorCode: code,
          logs: response.logs || [],
          unitsConsumed: response.unitsConsumed
        };
      }
      return {
        success: true,
        logs: response.logs || [],
        unitsConsumed: response.unitsConsumed
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        logs: []
      };
    }
  }
  /**
   * Build and simulate a method call without sending
   * Returns simulation result with parsed errors
   */
  async simulateMethod(methodName, args, accounts) {
    const { program } = this.getWalletAndProgram();
    try {
      const method = program.methods[methodName](...args);
      if (accounts) {
        method.accountsPartial(accounts);
      }
      const tx = await method.transaction();
      return this.simulateTransaction(tx);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        logs: []
      };
    }
  }
  /**
   * Helper to run RPC with optional simulation first
   * Wraps Anchor's rpc() call with simulation check using Anchor's simulate()
   * @param forceSimulate - If true, always simulate regardless of simulateFirst setting
   */
  async rpcWithSimulation(methodBuilder, actionName, forceSimulate = false) {
    console.log(`[SDK] rpcWithSimulation called: ${actionName}, simulateFirst=${this.simulateFirst}, forceSimulate=${forceSimulate}`);
    if (this.simulateFirst || forceSimulate) {
      console.log(`[Simulation] Running simulation for ${actionName}...`);
      try {
        const simResult = await methodBuilder.simulate();
        console.log(`[Simulation] ${actionName} passed`);
        if (simResult.raw && simResult.raw.length > 0) {
          console.log("[Simulation] Logs:", simResult.raw.slice(-5).join("\n"));
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        let logs = [];
        if (err && typeof err === "object" && "logs" in err) {
          logs = err.logs || [];
        }
        if (logs.length === 0 && err && typeof err === "object" && "simulationResponse" in err) {
          const simResponse = err.simulationResponse;
          logs = simResponse?.logs || [];
        }
        const programSucceeded = logs.some(
          (log) => log.includes(`Program ${this.programId.toBase58()} success`) || log.includes("success")
        );
        if (programSucceeded) {
          console.warn(`[Simulation] ${actionName} threw but program succeeded, proceeding with RPC`);
        } else {
          const parsedError = logs.length > 0 ? this.parseErrorFromLogs(logs) : { message: errorMessage };
          const errorMsg = `Simulation failed for ${actionName}: ${parsedError.message}`;
          console.error(errorMsg);
          if (logs.length > 0) {
            console.error("Logs:", logs.slice(-10).join("\n"));
          }
          throw new Error(errorMsg);
        }
      }
    }
    try {
      return await methodBuilder.rpc();
    } catch (rpcError) {
      console.error(`[RPC] ${actionName} failed:`, rpcError);
      if (rpcError && typeof rpcError === "object") {
        const err = rpcError;
        if ("logs" in err && Array.isArray(err.logs)) {
          console.error(`[RPC] Transaction logs:`);
          err.logs.forEach((log, i) => console.error(`  ${i}: ${log}`));
        }
        if ("transactionLogs" in err && Array.isArray(err.transactionLogs)) {
          console.error(`[RPC] Transaction logs:`);
          err.transactionLogs.forEach((log, i) => console.error(`  ${i}: ${log}`));
        }
      }
      throw rpcError;
    }
  }
  // ===========================================================================
  // Protocol Config
  // ===========================================================================
  /**
   * Initialize protocol config (one-time setup by deployer)
   */
  async initializeConfig() {
    const { program } = this.getWalletAndProgram();
    const [protocolConfig] = this.pda.protocolConfig();
    const signature = await program.methods.initializeConfig().rpc();
    return { signature, accounts: { protocolConfig } };
  }
  /**
   * Update treasury address (admin only)
   */
  async updateTreasury(newTreasury) {
    const { program } = this.getWalletAndProgram();
    const signature = await program.methods.updateTreasury(newTreasury).rpc();
    return { signature };
  }
  // ===========================================================================
  // Defender Pool
  // ===========================================================================
  /**
   * Create a defender pool with initial deposit and max bond setting
   */
  async createDefenderPool(initialAmount, maxBond = new import_anchor.BN(0)) {
    const { wallet, program } = this.getWalletAndProgram();
    const [defenderPool] = this.pda.defenderPool(wallet.publicKey);
    const signature = await program.methods.createDefenderPool(initialAmount, maxBond).rpc();
    return { signature, accounts: { defenderPool } };
  }
  /**
   * Deposit to defender pool
   */
  async depositDefenderPool(amount) {
    const { program } = this.getWalletAndProgram();
    const signature = await program.methods.depositDefenderPool(amount).rpc();
    return { signature };
  }
  /**
   * Withdraw from defender pool
   */
  async withdrawDefenderPool(amount) {
    const { program } = this.getWalletAndProgram();
    const signature = await program.methods.withdrawDefenderPool(amount).rpc();
    return { signature };
  }
  /**
   * Update max_bond setting for defender pool
   */
  async updateMaxBond(newMaxBond) {
    const { program } = this.getWalletAndProgram();
    const signature = await program.methods.updateMaxBond(newMaxBond).rpc();
    return { signature };
  }
  // ===========================================================================
  // Subject Management
  // ===========================================================================
  /**
   * Create a subject with its associated Dispute and Escrow accounts
   * Creator's pool is linked automatically. If initialBond > 0, transfers from wallet.
   * Subject starts as Valid if pool.balance > 0 or initialBond > 0.
   */
  async createSubject(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [subject] = this.pda.subject(params.subjectId);
    const [dispute] = this.pda.dispute(params.subjectId);
    const [escrow] = this.pda.escrow(params.subjectId);
    const [defenderPool] = this.pda.defenderPool(wallet.publicKey);
    const [defenderRecord] = this.pda.defenderRecord(params.subjectId, wallet.publicKey, 0);
    const signature = await program.methods.createSubject(
      params.subjectId,
      params.detailsCid,
      params.matchMode ?? true,
      params.votingPeriod,
      params.initialBond ?? new import_anchor.BN(0)
    ).accountsPartial({
      creator: wallet.publicKey,
      subject,
      dispute,
      escrow,
      defenderPool,
      defenderRecord
    }).rpc();
    return { signature, accounts: { subject, dispute, escrow, defenderPool, defenderRecord } };
  }
  /**
   * Add bond directly from wallet to a subject
   * Creates DefenderRecord for the current round
   * Also creates DefenderPool if it doesn't exist
   */
  async addBondDirect(subjectId, amount) {
    const { wallet, program } = this.getWalletAndProgram();
    const subject = await this.fetchSubjectById(subjectId);
    if (!subject) throw new Error("Subject not found");
    console.log(`[SDK] addBondDirect: amount=${amount.toString()} lamports (${amount.toNumber() / 1e9} SOL)`);
    const [subjectPda] = this.pda.subject(subjectId);
    const [disputePda] = this.pda.dispute(subjectId);
    const [defenderRecord] = this.pda.defenderRecord(subjectId, wallet.publicKey, subject.round);
    const [defenderPool] = this.pda.defenderPool(wallet.publicKey);
    const methodBuilder = program.methods.addBondDirect(amount).accountsPartial({
      defender: wallet.publicKey,
      subject: subjectPda,
      defenderRecord,
      defenderPool,
      dispute: disputePda
    });
    const signature = await this.rpcWithSimulation(methodBuilder, "addBondDirect");
    return { signature, accounts: { defenderRecord } };
  }
  /**
   * Add bond from defender pool to a subject
   * Creates DefenderRecord for the current round
   */
  async addBondFromPool(subjectId, amount) {
    const { wallet, program } = this.getWalletAndProgram();
    const subject = await this.fetchSubjectById(subjectId);
    if (!subject) throw new Error("Subject not found");
    const [subjectPda] = this.pda.subject(subjectId);
    const [disputePda] = this.pda.dispute(subjectId);
    const [defenderPool] = this.pda.defenderPool(wallet.publicKey);
    const [defenderRecord] = this.pda.defenderRecord(subjectId, wallet.publicKey, subject.round);
    const signature = await program.methods.addBondFromPool(amount).accountsPartial({
      defender: wallet.publicKey,
      subject: subjectPda,
      defenderPool,
      defenderRecord,
      dispute: disputePda
    }).rpc();
    return { signature, accounts: { defenderRecord } };
  }
  // ===========================================================================
  // Juror Management
  // ===========================================================================
  /**
   * Register as a juror with initial stake
   */
  async registerJuror(stakeAmount) {
    const { wallet, program } = this.getWalletAndProgram();
    const [jurorPool] = this.pda.jurorPool(wallet.publicKey);
    const signature = await program.methods.registerJuror(stakeAmount).rpc();
    return { signature, accounts: { jurorPool } };
  }
  /**
   * Add more stake to juror account
   */
  async addJurorStake(amount) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.addJurorStake(amount).rpc();
    return { signature };
  }
  /**
   * Withdraw available stake from juror account
   */
  async withdrawJurorStake(amount) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.withdrawJurorStake(amount).rpc();
    return { signature };
  }
  /**
   * Unregister juror and withdraw all available stake
   */
  async unregisterJuror() {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.unregisterJuror().rpc();
    return { signature };
  }
  // ===========================================================================
  // Challenger Pool Management
  // ===========================================================================
  /**
   * Register as a challenger with initial stake
   */
  async registerChallenger(stakeAmount) {
    const { wallet, program } = this.getWalletAndProgram();
    const [challengerPool] = this.pda.challengerPool(wallet.publicKey);
    const signature = await program.methods.registerChallenger(stakeAmount).rpc();
    return { signature, accounts: { challengerPool } };
  }
  /**
   * Add more stake to challenger pool
   */
  async addChallengerStake(amount) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.addChallengerStake(amount).rpc();
    return { signature };
  }
  /**
   * Withdraw available stake from challenger pool
   */
  async withdrawChallengerStake(amount) {
    const { wallet, program } = this.getWalletAndProgram();
    const signature = await program.methods.withdrawChallengerStake(amount).rpc();
    return { signature };
  }
  // ===========================================================================
  // Dispute Management
  // ===========================================================================
  /**
   * Create a new dispute against a subject
   * This initiates the dispute and creates a ChallengerRecord for the caller
   * Auto-pulls min(pool.balance, max_bond) from creator's defender pool
   */
  async createDispute(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const subject = await this.fetchSubjectById(params.subjectId);
    if (!subject) throw new Error("Subject not found");
    const [subjectPda] = this.pda.subject(params.subjectId);
    const [disputePda] = this.pda.dispute(params.subjectId);
    const [escrowPda] = this.pda.escrow(params.subjectId);
    const [challengerRecord] = this.pda.challengerRecord(
      params.subjectId,
      wallet.publicKey,
      subject.round
    );
    const [challengerPool] = this.pda.challengerPool(wallet.publicKey);
    const [creatorDefenderPool] = this.pda.defenderPool(subject.creator);
    const [creatorDefenderRecord] = this.pda.defenderRecord(
      params.subjectId,
      subject.creator,
      subject.round
    );
    const methodBuilder = program.methods.createDispute(params.disputeType, params.detailsCid, params.stake).accountsPartial({
      challenger: wallet.publicKey,
      subject: subjectPda,
      dispute: disputePda,
      escrow: escrowPda,
      challengerRecord,
      challengerPool,
      creatorDefenderPool,
      creatorDefenderRecord
    });
    const signature = await this.rpcWithSimulation(methodBuilder, "createDispute");
    return { signature, accounts: { challengerRecord } };
  }
  /**
   * Join an existing dispute as additional challenger
   */
  async joinChallengers(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const subject = await this.fetchSubjectById(params.subjectId);
    if (!subject) throw new Error("Subject not found");
    const [subjectPda] = this.pda.subject(params.subjectId);
    const [disputePda] = this.pda.dispute(params.subjectId);
    const [challengerRecord] = this.pda.challengerRecord(
      params.subjectId,
      wallet.publicKey,
      subject.round
    );
    const [challengerPool] = this.pda.challengerPool(wallet.publicKey);
    const signature = await program.methods.joinChallengers(params.detailsCid, params.stake).accountsPartial({
      challenger: wallet.publicKey,
      subject: subjectPda,
      dispute: disputePda,
      challengerRecord,
      challengerPool
    }).rpc();
    return { signature, accounts: { challengerRecord } };
  }
  /**
   * Submit a restoration request against an invalidated subject
   * Fees are collected during resolution from total pool
   */
  async submitRestore(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const subject = await this.fetchSubjectById(params.subjectId);
    if (!subject) throw new Error("Subject not found");
    const [subjectPda] = this.pda.subject(params.subjectId);
    const [disputePda] = this.pda.dispute(params.subjectId);
    const [escrowPda] = this.pda.escrow(params.subjectId);
    const [challengerRecord] = this.pda.challengerRecord(
      params.subjectId,
      wallet.publicKey,
      subject.round + 1
    );
    const methodBuilder = program.methods.submitRestore(params.disputeType, params.detailsCid, params.stakeAmount).accountsPartial({
      restorer: wallet.publicKey,
      subject: subjectPda,
      dispute: disputePda,
      escrow: escrowPda,
      challengerRecord
    });
    const signature = await this.rpcWithSimulation(methodBuilder, "submitRestore");
    return { signature, accounts: { challengerRecord } };
  }
  // ===========================================================================
  // Voting
  // ===========================================================================
  /**
   * Vote on a dispute
   * Creates a JurorRecord for the current round
   */
  async voteOnDispute(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const subject = await this.fetchSubjectById(params.subjectId);
    if (!subject) throw new Error("Subject not found");
    const [subjectPda] = this.pda.subject(params.subjectId);
    const [disputePda] = this.pda.dispute(params.subjectId);
    const [jurorPool] = this.pda.jurorPool(wallet.publicKey);
    const [jurorRecord] = this.pda.jurorRecord(
      params.subjectId,
      wallet.publicKey,
      subject.round
    );
    const methodBuilder = program.methods.voteOnDispute(
      params.choice,
      params.stakeAllocation,
      params.rationaleCid ?? ""
    ).accountsPartial({
      juror: wallet.publicKey,
      subject: subjectPda,
      dispute: disputePda,
      jurorPool,
      jurorRecord
    });
    const signature = await this.rpcWithSimulation(methodBuilder, "voteOnDispute");
    return { signature, accounts: { jurorRecord } };
  }
  /**
   * Vote on a restoration request
   * Creates a JurorRecord for the current round
   */
  async voteOnRestore(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const subject = await this.fetchSubjectById(params.subjectId);
    if (!subject) throw new Error("Subject not found");
    const [subjectPda] = this.pda.subject(params.subjectId);
    const [disputePda] = this.pda.dispute(params.subjectId);
    const [jurorPool] = this.pda.jurorPool(wallet.publicKey);
    const [jurorRecord] = this.pda.jurorRecord(
      params.subjectId,
      wallet.publicKey,
      subject.round
    );
    const methodBuilder = program.methods.voteOnRestore(
      params.choice,
      params.stakeAllocation,
      params.rationaleCid ?? ""
    ).accountsPartial({
      juror: wallet.publicKey,
      subject: subjectPda,
      dispute: disputePda,
      jurorPool,
      jurorRecord
    });
    const signature = await this.rpcWithSimulation(methodBuilder, "voteOnRestore");
    return { signature, accounts: { jurorRecord } };
  }
  /**
   * Add stake to an existing vote
   * Increases voting power on an existing JurorRecord
   */
  async addToVote(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [subjectPda] = this.pda.subject(params.subjectId);
    const [disputePda] = this.pda.dispute(params.subjectId);
    const [jurorPool] = this.pda.jurorPool(wallet.publicKey);
    const [jurorRecord] = this.pda.jurorRecord(
      params.subjectId,
      wallet.publicKey,
      params.round
    );
    const methodBuilder = program.methods.addToVote(params.round, params.additionalStake).accountsPartial({
      juror: wallet.publicKey,
      subject: subjectPda,
      dispute: disputePda,
      jurorPool,
      jurorRecord
    });
    const signature = await this.rpcWithSimulation(methodBuilder, "addToVote");
    return { signature, accounts: { jurorRecord } };
  }
  // ===========================================================================
  // Resolution
  // ===========================================================================
  /**
   * Resolve a dispute after voting period ends (permissionless)
   * Optionally auto-rebonds from creator's pool if available
   */
  async resolveDispute(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [subjectPda] = this.pda.subject(params.subjectId);
    const [disputePda] = this.pda.dispute(params.subjectId);
    const [escrowPda] = this.pda.escrow(params.subjectId);
    const [protocolConfigPda] = this.pda.protocolConfig();
    const protocolConfig = await program.account.protocolConfig.fetch(protocolConfigPda);
    const subject = await program.account.subject.fetch(subjectPda);
    const creator = subject.creator;
    const nextRound = subject.round + 1;
    const [creatorDefenderPoolPda] = this.pda.defenderPool(creator);
    let creatorDefenderPool = null;
    let creatorDefenderRecord = null;
    try {
      const pool = await program.account.defenderPool.fetch(creatorDefenderPoolPda);
      if (pool && pool.balance.toNumber() > 0) {
        creatorDefenderPool = creatorDefenderPoolPda;
        [creatorDefenderRecord] = this.pda.defenderRecord(params.subjectId, creator, nextRound);
      }
    } catch {
    }
    const methodBuilder = program.methods.resolveDispute(nextRound).accountsPartial({
      resolver: wallet.publicKey,
      subject: subjectPda,
      dispute: disputePda,
      escrow: escrowPda,
      protocolConfig: protocolConfigPda,
      treasury: protocolConfig.treasury,
      creatorDefenderPool,
      creatorDefenderRecord
    });
    const signature = await this.rpcWithSimulation(methodBuilder, "resolveDispute");
    return { signature };
  }
  /**
   * Claim juror reward for a specific round
   */
  async claimJuror(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [jurorPool] = this.pda.jurorPool(wallet.publicKey);
    const [jurorRecord] = this.pda.jurorRecord(params.subjectId, wallet.publicKey, params.round);
    const method = program.methods.claimJuror(params.round);
    const signature = await this.rpcWithSimulation(method, "claimJuror", true);
    return { signature, accounts: { jurorPool, jurorRecord } };
  }
  /**
   * Unlock juror stake after 7 days post-resolution
   * Returns the locked stake back to the juror pool
   */
  async unlockJurorStake(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [subjectPda] = this.pda.subject(params.subjectId);
    const [escrowPda] = this.pda.escrow(params.subjectId);
    const [jurorPool] = this.pda.jurorPool(wallet.publicKey);
    const [jurorRecord] = this.pda.jurorRecord(params.subjectId, wallet.publicKey, params.round);
    const method = program.methods.unlockJurorStake(params.round).accountsPartial({
      juror: wallet.publicKey,
      subject: subjectPda,
      escrow: escrowPda,
      jurorRecord,
      jurorPool
    });
    const signature = await this.rpcWithSimulation(method, "unlockJurorStake", true);
    return { signature, accounts: { jurorPool, jurorRecord } };
  }
  /**
   * Claim challenger reward for a specific round (if dispute upheld)
   */
  async claimChallenger(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [challengerPool] = this.pda.challengerPool(wallet.publicKey);
    const [challengerRecord] = this.pda.challengerRecord(params.subjectId, wallet.publicKey, params.round);
    const method = program.methods.claimChallenger(params.round);
    const signature = await this.rpcWithSimulation(method, "claimChallenger", true);
    return { signature, accounts: { challengerPool, challengerRecord } };
  }
  /**
   * Claim defender reward for a specific round (if dispute dismissed)
   */
  async claimDefender(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [defenderPool] = this.pda.defenderPool(wallet.publicKey);
    const [defenderRecord] = this.pda.defenderRecord(params.subjectId, wallet.publicKey, params.round);
    const method = program.methods.claimDefender(params.round);
    const signature = await this.rpcWithSimulation(method, "claimDefender", true);
    return { signature, accounts: { defenderPool, defenderRecord } };
  }
  /**
   * Batch claim all available rewards in a single transaction
   * Combines juror, challenger, and defender claims
   */
  async batchClaimRewards(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const instructions = [];
    if (params.jurorClaims && params.jurorClaims.length > 0) {
      for (const claim of params.jurorClaims) {
        const [subjectPda] = this.pda.subject(claim.subjectId);
        const [escrowPda] = this.pda.escrow(claim.subjectId);
        const [jurorRecord] = this.pda.jurorRecord(claim.subjectId, wallet.publicKey, claim.round);
        const [jurorPool] = this.pda.jurorPool(wallet.publicKey);
        const ix = await program.methods.claimJuror(claim.round).accountsPartial({
          juror: wallet.publicKey,
          subject: subjectPda,
          escrow: escrowPda,
          jurorRecord,
          jurorPool
        }).instruction();
        instructions.push(ix);
      }
    }
    if (params.challengerClaims && params.challengerClaims.length > 0) {
      for (const claim of params.challengerClaims) {
        const [subjectPda] = this.pda.subject(claim.subjectId);
        const [escrowPda] = this.pda.escrow(claim.subjectId);
        const [challengerRecord] = this.pda.challengerRecord(claim.subjectId, wallet.publicKey, claim.round);
        const [challengerPool] = this.pda.challengerPool(wallet.publicKey);
        const ix = await program.methods.claimChallenger(claim.round).accountsPartial({
          challenger: wallet.publicKey,
          subject: subjectPda,
          escrow: escrowPda,
          challengerRecord,
          challengerPool
        }).instruction();
        instructions.push(ix);
      }
    }
    if (params.defenderClaims && params.defenderClaims.length > 0) {
      for (const claim of params.defenderClaims) {
        const [subjectPda] = this.pda.subject(claim.subjectId);
        const [escrowPda] = this.pda.escrow(claim.subjectId);
        const [defenderRecord] = this.pda.defenderRecord(claim.subjectId, wallet.publicKey, claim.round);
        const [defenderPool] = this.pda.defenderPool(wallet.publicKey);
        const ix = await program.methods.claimDefender(claim.round).accountsPartial({
          defender: wallet.publicKey,
          subject: subjectPda,
          escrow: escrowPda,
          defenderRecord,
          defenderPool
        }).instruction();
        instructions.push(ix);
      }
    }
    if (instructions.length === 0) {
      throw new Error("No claims provided");
    }
    const tx = new import_web33.Transaction().add(...instructions);
    if (this.simulateFirst) {
      console.log(`[SDK] Simulating batch claim with ${instructions.length} instructions`);
      try {
        const { blockhash } = await this.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey;
        const simulation = await this.connection.simulateTransaction(tx);
        if (simulation.value.err) {
          const errorMessage = this.parseErrorFromLogs(simulation.value.logs || []);
          throw new Error(`Simulation failed: ${errorMessage.message}`);
        }
        console.log("[SDK] Simulation succeeded");
      } catch (err) {
        if (err.message.includes("Simulation failed")) {
          throw err;
        }
        console.warn("[SDK] Simulation warning:", err.message);
      }
    }
    const signature = await program.provider.sendAndConfirm(tx, []);
    console.log(`[SDK] Batch claim completed: ${instructions.length} claims in tx ${signature}`);
    return { signature };
  }
  // ===========================================================================
  // Cleanup Instructions (close records to reclaim rent)
  // ===========================================================================
  /**
   * Close juror record and reclaim rent (after reward claimed)
   */
  async closeJurorRecord(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [jurorRecord] = this.pda.jurorRecord(params.subjectId, wallet.publicKey, params.round);
    const signature = await program.methods.closeJurorRecord(params.round).rpc();
    return { signature };
  }
  /**
   * Close challenger record and reclaim rent (after reward claimed)
   */
  async closeChallengerRecord(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [challengerRecord] = this.pda.challengerRecord(params.subjectId, wallet.publicKey, params.round);
    const signature = await program.methods.closeChallengerRecord(params.round).rpc();
    return { signature };
  }
  /**
   * Close defender record and reclaim rent (after reward claimed)
   */
  async closeDefenderRecord(params) {
    const { wallet, program } = this.getWalletAndProgram();
    const [defenderRecord] = this.pda.defenderRecord(params.subjectId, wallet.publicKey, params.round);
    const signature = await program.methods.closeDefenderRecord(params.round).rpc();
    return { signature };
  }
  /**
   * Batch close multiple records in a single transaction.
   * Useful for reclaiming rent after claiming rewards.
   */
  async batchCloseRecords(records) {
    const { wallet, program } = this.getWalletAndProgram();
    const instructions = [];
    for (const record of records) {
      const [subjectPda] = this.pda.subject(record.subjectId);
      const [escrowPda] = this.pda.escrow(record.subjectId);
      switch (record.type) {
        case "juror": {
          const [jurorRecord] = this.pda.jurorRecord(
            record.subjectId,
            wallet.publicKey,
            record.round
          );
          const ix = await program.methods.closeJurorRecord(record.round).accountsPartial({
            juror: wallet.publicKey,
            subject: subjectPda,
            escrow: escrowPda,
            jurorRecord
          }).instruction();
          instructions.push(ix);
          break;
        }
        case "challenger": {
          const [challengerRecord] = this.pda.challengerRecord(
            record.subjectId,
            wallet.publicKey,
            record.round
          );
          const ix = await program.methods.closeChallengerRecord(record.round).accountsPartial({
            challenger: wallet.publicKey,
            subject: subjectPda,
            escrow: escrowPda,
            challengerRecord
          }).instruction();
          instructions.push(ix);
          break;
        }
        case "defender": {
          const [defenderRecord] = this.pda.defenderRecord(
            record.subjectId,
            wallet.publicKey,
            record.round
          );
          const ix = await program.methods.closeDefenderRecord(record.round).accountsPartial({
            defender: wallet.publicKey,
            subject: subjectPda,
            escrow: escrowPda,
            defenderRecord
          }).instruction();
          instructions.push(ix);
          break;
        }
      }
    }
    if (instructions.length === 0) {
      throw new Error("No valid records to close");
    }
    const tx = new import_web33.Transaction().add(...instructions);
    const signature = await program.provider.sendAndConfirm(tx, []);
    console.log(`[SDK] Batch close completed: ${instructions.length} records in tx ${signature}`);
    return { signature, closedCount: instructions.length };
  }
  // ===========================================================================
  // Account Fetchers
  // ===========================================================================
  /**
   * Fetch protocol config
   */
  async fetchProtocolConfig() {
    const [address] = this.pda.protocolConfig();
    try {
      return await this.anchorProgram.account.protocolConfig.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch defender pool by address
   */
  async fetchDefenderPool(address) {
    try {
      return await this.anchorProgram.account.defenderPool.fetch(
        address
      );
    } catch (err) {
      if (err instanceof Error && !err.message.includes("Account does not exist")) {
        console.error("[SDK] fetchDefenderPool error:", err.message);
      }
      return null;
    }
  }
  /**
   * Fetch defender pool by owner
   */
  async fetchDefenderPoolByOwner(owner) {
    const [address] = this.pda.defenderPool(owner);
    return this.fetchDefenderPool(address);
  }
  /**
   * Fetch subject by address
   */
  async fetchSubject(address) {
    try {
      return await this.anchorProgram.account.subject.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch subject by subject ID
   */
  async fetchSubjectById(subjectId) {
    const [address] = this.pda.subject(subjectId);
    return this.fetchSubject(address);
  }
  /**
   * Fetch dispute by address
   */
  async fetchDispute(address) {
    try {
      return await this.anchorProgram.account.dispute.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  // NOTE: fetchEscrow removed - no escrow in simplified model
  /**
   * Fetch juror pool by address
   */
  async fetchJurorPool(address) {
    try {
      return await this.anchorProgram.account.jurorPool.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch juror pool by owner pubkey
   */
  async fetchJurorPoolByOwner(owner) {
    const [address] = this.pda.jurorPool(owner);
    return this.fetchJurorPool(address);
  }
  /**
   * Fetch escrow by address
   */
  async fetchEscrow(address) {
    try {
      return await this.anchorProgram.account.escrow.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch escrow by subject ID
   */
  async fetchEscrowBySubjectId(subjectId) {
    const [address] = this.pda.escrow(subjectId);
    return this.fetchEscrow(address);
  }
  /**
   * Fetch juror record by address
   */
  async fetchJurorRecord(address) {
    try {
      return await this.anchorProgram.account.jurorRecord.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch juror record for a subject, juror, and round
   */
  async fetchJurorRecordBySubjectAndJuror(subjectId, juror, round) {
    const [address] = this.pda.jurorRecord(subjectId, juror, round);
    return this.fetchJurorRecord(address);
  }
  /**
   * Fetch challenger pool by address
   */
  async fetchChallengerPool(address) {
    try {
      return await this.anchorProgram.account.challengerPool.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch challenger pool by owner pubkey
   */
  async fetchChallengerPoolByOwner(owner) {
    const [address] = this.pda.challengerPool(owner);
    return this.fetchChallengerPool(address);
  }
  /**
   * Fetch challenger record by address
   */
  async fetchChallengerRecord(address) {
    try {
      return await this.anchorProgram.account.challengerRecord.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch challenger record by subject, challenger, and round
   */
  async fetchChallengerRecordBySubject(subjectId, challenger, round) {
    const [address] = this.pda.challengerRecord(subjectId, challenger, round);
    return this.fetchChallengerRecord(address);
  }
  /**
   * Fetch defender record by address
   */
  async fetchDefenderRecord(address) {
    try {
      return await this.anchorProgram.account.defenderRecord.fetch(
        address
      );
    } catch {
      return null;
    }
  }
  /**
   * Fetch defender record by subject, defender, and round
   */
  async fetchDefenderRecordBySubject(subjectId, defender, round) {
    const [address] = this.pda.defenderRecord(subjectId, defender, round);
    return this.fetchDefenderRecord(address);
  }
  // ===========================================================================
  // Bulk Fetchers
  // ===========================================================================
  /**
   * Fetch all defender pools
   */
  async fetchAllDefenderPools() {
    const accounts = await this.anchorProgram.account.defenderPool.all();
    return accounts;
  }
  /**
   * Fetch all subjects
   */
  async fetchAllSubjects() {
    const accounts = await this.anchorProgram.account.subject.all();
    return accounts;
  }
  /**
   * Fetch all disputes (V2: one dispute per subject)
   */
  async fetchAllDisputes() {
    const accounts = await this.anchorProgram.account.dispute.all();
    return accounts;
  }
  /**
   * Fetch all juror pools
   */
  async fetchAllJurorPools() {
    const accounts = await this.anchorProgram.account.jurorPool.all();
    return accounts;
  }
  /**
   * Fetch all challenger pools
   */
  async fetchAllChallengerPools() {
    const accounts = await this.anchorProgram.account.challengerPool.all();
    return accounts;
  }
  /**
   * Fetch all escrows
   */
  async fetchAllEscrows() {
    const accounts = await this.anchorProgram.account.escrow.all();
    return accounts;
  }
  /**
   * Fetch all juror records
   * Note: Uses raw account fetching to handle old accounts missing new fields
   */
  async fetchAllJurorRecords() {
    try {
      const accounts = await this.anchorProgram.account.jurorRecord.all();
      return accounts;
    } catch (err) {
      console.warn("[fetchAllJurorRecords] Bulk fetch failed, trying individual fetch:", err);
      const gpaResult = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          { memcmp: { offset: 0, bytes: this.anchorProgram.account.jurorRecord.coder.accounts.memcmp("JurorRecord") } }
        ]
      });
      const validAccounts = [];
      for (const { pubkey, account } of gpaResult) {
        try {
          const decoded = this.anchorProgram.coder.accounts.decode(
            "JurorRecord",
            account.data
          );
          validAccounts.push({ publicKey: pubkey, account: decoded });
        } catch (decodeErr) {
          console.warn(`[fetchAllJurorRecords] Skipping account ${pubkey.toBase58()}: ${decodeErr}`);
        }
      }
      return validAccounts;
    }
  }
  /**
   * Fetch all challenger records
   */
  async fetchAllChallengerRecords() {
    const accounts = await this.anchorProgram.account.challengerRecord.all();
    return accounts;
  }
  /**
   * Fetch all defender records
   */
  async fetchAllDefenderRecords() {
    const accounts = await this.anchorProgram.account.defenderRecord.all();
    return accounts;
  }
  /**
   * Fetch dispute by subject ID
   */
  async fetchDisputeBySubjectId(subjectId) {
    const [address] = this.pda.dispute(subjectId);
    return this.fetchDispute(address);
  }
  /**
   * Fetch juror records by subject
   * Note: Uses raw account fetching to handle old accounts missing new fields
   */
  async fetchJurorRecordsBySubject(subjectId) {
    try {
      const accounts = await this.anchorProgram.account.jurorRecord.all([
        { memcmp: { offset: 8, bytes: subjectId.toBase58() } }
      ]);
      return accounts;
    } catch (err) {
      console.warn("[fetchJurorRecordsBySubject] Bulk fetch failed, trying individual fetch:", err);
      const gpaResult = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          { memcmp: { offset: 0, bytes: this.anchorProgram.account.jurorRecord.coder.accounts.memcmp("JurorRecord") } },
          { memcmp: { offset: 8, bytes: subjectId.toBase58() } }
        ]
      });
      const validAccounts = [];
      for (const { pubkey, account } of gpaResult) {
        try {
          const decoded = this.anchorProgram.coder.accounts.decode(
            "JurorRecord",
            account.data
          );
          validAccounts.push({ publicKey: pubkey, account: decoded });
        } catch (decodeErr) {
          console.warn(`[fetchJurorRecordsBySubject] Skipping account ${pubkey.toBase58()}: ${decodeErr}`);
        }
      }
      return validAccounts;
    }
  }
  /**
   * Fetch challengers by subject
   */
  async fetchChallengersBySubject(subjectId) {
    const accounts = await this.anchorProgram.account.challengerRecord.all([
      { memcmp: { offset: 8, bytes: subjectId.toBase58() } }
    ]);
    return accounts;
  }
  /**
   * Fetch defenders by subject
   */
  async fetchDefendersBySubject(subjectId) {
    const accounts = await this.anchorProgram.account.defenderRecord.all([
      { memcmp: { offset: 8, bytes: subjectId.toBase58() } }
    ]);
    return accounts;
  }
  /**
   * Fetch challenger records by subject (alias for fetchChallengersBySubject)
   */
  async fetchChallengerRecordsBySubject(subjectId) {
    return this.fetchChallengersBySubject(subjectId);
  }
  /**
   * Fetch defender records by subject (alias for fetchDefendersBySubject)
   */
  async fetchDefenderRecordsBySubject(subjectId) {
    return this.fetchDefendersBySubject(subjectId);
  }
  // ===========================================================================
  // User Record Fetchers (for Collect All)
  // ===========================================================================
  /**
   * Fetch all juror records for a juror
   * Note: Uses raw account fetching to handle old accounts missing new fields
   */
  async fetchJurorRecordsByJuror(juror) {
    try {
      const accounts = await this.anchorProgram.account.jurorRecord.all([
        { memcmp: { offset: 40, bytes: juror.toBase58() } }
      ]);
      return accounts;
    } catch (err) {
      console.warn("[fetchJurorRecordsByJuror] Bulk fetch failed, trying individual fetch:", err);
      const gpaResult = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          { memcmp: { offset: 0, bytes: this.anchorProgram.account.jurorRecord.coder.accounts.memcmp("JurorRecord") } },
          { memcmp: { offset: 40, bytes: juror.toBase58() } }
        ]
      });
      const validAccounts = [];
      for (const { pubkey, account } of gpaResult) {
        try {
          const decoded = this.anchorProgram.coder.accounts.decode(
            "JurorRecord",
            account.data
          );
          validAccounts.push({ publicKey: pubkey, account: decoded });
        } catch (decodeErr) {
          console.warn(`[fetchJurorRecordsByJuror] Skipping account ${pubkey.toBase58()}: ${decodeErr}`);
        }
      }
      return validAccounts;
    }
  }
  /**
   * Fetch all challenger records for a challenger
   */
  async fetchChallengerRecordsByChallenger(challenger) {
    const accounts = await this.anchorProgram.account.challengerRecord.all([
      { memcmp: { offset: 40, bytes: challenger.toBase58() } }
    ]);
    return accounts;
  }
  /**
   * Fetch all defender records for a defender
   */
  async fetchDefenderRecordsByDefender(defender) {
    const accounts = await this.anchorProgram.account.defenderRecord.all([
      { memcmp: { offset: 40, bytes: defender.toBase58() } }
    ]);
    return accounts;
  }
  // ===========================================================================
  // Collect All - Batch claim, unlock, and close (V2)
  // ===========================================================================
  /**
   * Scan all user records and return what's eligible for collection
   * TODO: Implement for V2 round-based design
   */
  async scanCollectableRecords() {
    const { wallet } = this.getWalletAndProgram();
    const user = wallet.publicKey;
    const [jurorRecords, challengerRecords, defenderRecords] = await Promise.all([
      this.fetchJurorRecordsByJuror(user),
      this.fetchChallengerRecordsByChallenger(user),
      this.fetchDefenderRecordsByDefender(user)
    ]);
    console.log("[scanCollectableRecords] Found records:", {
      jurorRecords: jurorRecords.length,
      challengerRecords: challengerRecords.length,
      defenderRecords: defenderRecords.length
    });
    const subjectIds = /* @__PURE__ */ new Set();
    for (const jr of jurorRecords) subjectIds.add(jr.account.subjectId.toBase58());
    for (const cr of challengerRecords) subjectIds.add(cr.account.subjectId.toBase58());
    for (const dr of defenderRecords) subjectIds.add(dr.account.subjectId.toBase58());
    const disputeInfoMap = /* @__PURE__ */ new Map();
    for (const subjectIdStr of subjectIds) {
      try {
        const subjectId = new import_web33.PublicKey(subjectIdStr);
        const [disputePda] = this.pda.dispute(subjectId);
        const dispute = await this.fetchDispute(disputePda);
        if (dispute) {
          disputeInfoMap.set(subjectIdStr, {
            isResolved: "resolved" in dispute.status,
            round: dispute.round
          });
        } else {
          disputeInfoMap.set(subjectIdStr, { isResolved: false, round: -1 });
        }
      } catch {
        disputeInfoMap.set(subjectIdStr, { isResolved: false, round: -1 });
      }
    }
    const claims = {
      juror: [],
      challenger: [],
      defender: []
    };
    const closes = {
      juror: [],
      challenger: [],
      defender: []
    };
    let estimatedRewards = 0;
    let estimatedRent = 0;
    const RENT_PER_RECORD = 2e-3 * 1e9;
    for (const jr of jurorRecords) {
      const disputeInfo = disputeInfoMap.get(jr.account.subjectId.toBase58());
      const isResolved = disputeInfo?.isResolved ?? false;
      const disputeRound = disputeInfo?.round ?? -1;
      const roundMatches = jr.account.round === disputeRound;
      console.log("[scanCollectableRecords] Juror record:", {
        subjectId: jr.account.subjectId.toBase58(),
        recordRound: jr.account.round,
        disputeRound,
        rewardClaimed: jr.account.rewardClaimed,
        stakeUnlocked: jr.account.stakeUnlocked,
        stakeAllocation: jr.account.stakeAllocation.toString(),
        isResolved,
        roundMatches
      });
      if (!jr.account.rewardClaimed && isResolved && roundMatches) {
        console.log("[scanCollectableRecords] \u2192 Added to CLAIMS");
        claims.juror.push({
          subjectId: jr.account.subjectId,
          round: jr.account.round,
          jurorRecord: jr.publicKey
        });
        estimatedRewards += 1e-3 * 1e9;
      } else if (jr.account.rewardClaimed && (jr.account.stakeUnlocked || jr.account.stakeAllocation.toNumber() === 0)) {
        console.log("[scanCollectableRecords] \u2192 Added to CLOSES");
        closes.juror.push({
          subjectId: jr.account.subjectId,
          round: jr.account.round
        });
        estimatedRent += RENT_PER_RECORD;
      } else {
        console.log("[scanCollectableRecords] \u2192 SKIPPED (claimed but stake locked, round mismatch, or not resolved)");
      }
    }
    for (const cr of challengerRecords) {
      const disputeInfo = disputeInfoMap.get(cr.account.subjectId.toBase58());
      const isResolved = disputeInfo?.isResolved ?? false;
      const disputeRound = disputeInfo?.round ?? -1;
      const roundMatches = cr.account.round === disputeRound;
      if (!cr.account.rewardClaimed && isResolved && roundMatches) {
        claims.challenger.push({
          subjectId: cr.account.subjectId,
          round: cr.account.round,
          challengerRecord: cr.publicKey
        });
        estimatedRewards += 1e-3 * 1e9;
      } else if (cr.account.rewardClaimed) {
        closes.challenger.push({
          subjectId: cr.account.subjectId,
          round: cr.account.round
        });
        estimatedRent += RENT_PER_RECORD;
      }
    }
    for (const dr of defenderRecords) {
      const disputeInfo = disputeInfoMap.get(dr.account.subjectId.toBase58());
      const isResolved = disputeInfo?.isResolved ?? false;
      const disputeRound = disputeInfo?.round ?? -1;
      const roundMatches = dr.account.round === disputeRound;
      console.log("[scanCollectableRecords] Defender record:", {
        subjectId: dr.account.subjectId.toBase58(),
        recordRound: dr.account.round,
        disputeRound,
        rewardClaimed: dr.account.rewardClaimed,
        isResolved,
        roundMatches
      });
      if (!dr.account.rewardClaimed && isResolved && roundMatches) {
        console.log("[scanCollectableRecords] \u2192 Added to CLAIMS");
        claims.defender.push({
          subjectId: dr.account.subjectId,
          round: dr.account.round,
          defenderRecord: dr.publicKey
        });
        estimatedRewards += 1e-3 * 1e9;
      } else if (dr.account.rewardClaimed) {
        console.log("[scanCollectableRecords] \u2192 Added to CLOSES");
        closes.defender.push({
          subjectId: dr.account.subjectId,
          round: dr.account.round
        });
        estimatedRent += RENT_PER_RECORD;
      } else {
        console.log("[scanCollectableRecords] \u2192 SKIPPED (round mismatch, not resolved, or already claimed)");
      }
    }
    return {
      claims,
      closes,
      totals: {
        estimatedRewards,
        estimatedRent
      }
    };
  }
  /**
   * Execute collect all - claims rewards and closes records
   * TODO: Implement for V2 round-based design with claim instructions
   */
  async collectAll() {
    console.warn("[collectAll] V2 implementation pending");
    return {
      signatures: [],
      summary: { claimCount: 0, closeCount: 0 }
    };
  }
  /**
   * Fetch transaction history for a user and parse TribunalCraft activity
   * This allows showing historical activity even for closed records
   */
  async fetchUserActivity(user, options) {
    const activities = [];
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        user,
        {
          limit: options?.limit || 100,
          before: options?.before
        }
      );
      for (const sigInfo of signatures) {
        if (sigInfo.err) continue;
        try {
          const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0
          });
          if (!tx || !tx.meta) continue;
          const programInvoked = tx.transaction.message.accountKeys.some(
            (key) => key.pubkey.equals(this.programId)
          );
          if (!programInvoked) continue;
          const logs = tx.meta.logMessages || [];
          const activity = this.parseActivityFromLogs(logs, sigInfo.signature, tx, user);
          if (activity) {
            activities.push({
              ...activity,
              timestamp: sigInfo.blockTime || 0,
              slot: sigInfo.slot,
              success: true
            });
          }
        } catch (err) {
          console.warn(`[fetchUserActivity] Failed to parse tx ${sigInfo.signature}:`, err);
        }
      }
    } catch (err) {
      console.error("[fetchUserActivity] Failed to fetch signatures:", err);
    }
    return activities;
  }
  /**
   * Parse activity type from transaction logs and Anchor events
   */
  parseActivityFromLogs(logs, signature, tx, userPubkey) {
    const hasProgram = logs.some((log) => log.includes(this.programId.toBase58()));
    if (!hasProgram) return null;
    const eventData = this.parseAnchorEventsFromLogs(logs, userPubkey);
    if (eventData) {
      return { signature, ...eventData };
    }
    const { dispute, subject } = this.extractAccountsFromTx(tx);
    const { received, sent, rentReclaimed } = this.extractBalanceChanges(tx, userPubkey);
    const voteDetails = this.extractVoteDetailsFromTx(tx);
    const outcome = this.inferOutcomeFromLogs(logs);
    for (const log of logs) {
      if (log.includes("Instruction: VoteOnDispute")) {
        return {
          type: "vote",
          signature,
          dispute,
          amount: sent,
          voteChoice: voteDetails?.choice,
          rationaleCid: voteDetails?.rationaleCid
        };
      }
      if (log.includes("Instruction: VoteOnRestore")) {
        return {
          type: "vote_restore",
          signature,
          dispute,
          amount: sent,
          voteChoice: voteDetails?.choice,
          rationaleCid: voteDetails?.rationaleCid
        };
      }
      if (log.includes("Instruction: SubmitDispute")) {
        return { type: "challenge", signature, dispute, amount: sent };
      }
      if (log.includes("Instruction: AddToDispute")) {
        return { type: "add_challenge", signature, dispute, amount: sent };
      }
      if (log.includes("Instruction: AddToStake")) {
        return { type: "defend", signature, subject, amount: sent };
      }
      if (log.includes("Instruction: CreateLinkedSubject")) {
        return { type: "create_subject", signature, subject };
      }
      if (log.includes("Instruction: ClaimJurorReward")) {
        return { type: "claim_juror", signature, dispute, amount: received, outcome };
      }
      if (log.includes("Instruction: ClaimChallengerReward")) {
        return { type: "claim_challenger", signature, dispute, amount: received, outcome: "ChallengerWins" };
      }
      if (log.includes("Instruction: ClaimDefenderReward")) {
        return { type: "claim_defender", signature, dispute, amount: received, outcome: "DefenderWins" };
      }
      if (log.includes("Instruction: CloseVoteRecord")) {
        return { type: "close_vote", signature, dispute, rentReclaimed };
      }
      if (log.includes("Instruction: CloseChallengerRecord")) {
        return { type: "close_challenger", signature, dispute, rentReclaimed };
      }
      if (log.includes("Instruction: CloseDefenderRecord")) {
        return { type: "close_defender", signature, subject, rentReclaimed };
      }
      if (log.includes("Instruction: UnlockJurorStake")) {
        return { type: "unlock_stake", signature, dispute };
      }
      if (log.includes("Instruction: ResolveDispute")) {
        return { type: "resolve", signature, dispute, outcome };
      }
    }
    return null;
  }
  /**
   * Parse Anchor events from "Program data:" logs
   * Events contain reliable dispute/subject keys and amounts
   * Uses browser-compatible methods (no Node.js Buffer methods)
   */
  parseAnchorEventsFromLogs(logs, userPubkey) {
    const base64ToBytes = (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    };
    const bytesToHex = (bytes) => {
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    };
    const readU64LE = (data, offset) => {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const lo = view.getUint32(offset, true);
      const hi = view.getUint32(offset + 4, true);
      return lo + hi * 4294967296;
    };
    const readU32LE = (data, offset) => {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      return view.getUint32(offset, true);
    };
    const bytesToUtf8 = (bytes) => {
      return new TextDecoder().decode(bytes);
    };
    try {
      for (const log of logs) {
        if (!log.startsWith("Program data: ")) continue;
        const base64Data = log.slice("Program data: ".length);
        const data = base64ToBytes(base64Data);
        if (data.length < 8) continue;
        const discriminator = bytesToHex(data.slice(0, 8));
        if (this.matchesEventName(discriminator, "VoteEvent")) {
          const dispute = new import_web33.PublicKey(data.slice(8, 40)).toBase58();
          const juror = new import_web33.PublicKey(data.slice(40, 72)).toBase58();
          if (juror !== userPubkey.toBase58()) continue;
          const choiceByte = data[72];
          const voteChoice = choiceByte === 0 ? "ForChallenger" : "ForDefender";
          const stakeAllocated = readU64LE(data, 73);
          let rationaleCid;
          if (data.length > 89) {
            const cidLength = readU32LE(data, 89);
            if (cidLength > 0 && cidLength < 200 && data.length >= 93 + cidLength) {
              rationaleCid = bytesToUtf8(data.slice(93, 93 + cidLength));
            }
          }
          return {
            type: "vote",
            dispute,
            amount: stakeAllocated,
            voteChoice,
            rationaleCid
          };
        }
        if (this.matchesEventName(discriminator, "RestoreVoteEvent")) {
          const dispute = new import_web33.PublicKey(data.slice(8, 40)).toBase58();
          const juror = new import_web33.PublicKey(data.slice(40, 72)).toBase58();
          if (juror !== userPubkey.toBase58()) continue;
          const choiceByte = data[72];
          const voteChoice = choiceByte === 0 ? "ForRestoration" : "AgainstRestoration";
          const stakeAllocated = readU64LE(data, 73);
          return {
            type: "vote_restore",
            dispute,
            amount: stakeAllocated,
            voteChoice
          };
        }
        if (this.matchesEventName(discriminator, "DisputeCreatedEvent")) {
          const dispute = new import_web33.PublicKey(data.slice(8, 40)).toBase58();
          const subject = new import_web33.PublicKey(data.slice(40, 72)).toBase58();
          const challenger = new import_web33.PublicKey(data.slice(72, 104)).toBase58();
          if (challenger !== userPubkey.toBase58()) continue;
          let offset = 104;
          offset += 1;
          const cidLength = readU32LE(data, offset);
          offset += 4 + cidLength;
          const bond = readU64LE(data, offset);
          return {
            type: "challenge",
            dispute,
            subject,
            amount: bond
          };
        }
        if (this.matchesEventName(discriminator, "ChallengerJoinedEvent")) {
          const dispute = new import_web33.PublicKey(data.slice(8, 40)).toBase58();
          const challenger = new import_web33.PublicKey(data.slice(40, 72)).toBase58();
          if (challenger !== userPubkey.toBase58()) continue;
          const bond = readU64LE(data, 72);
          return {
            type: "add_challenge",
            dispute,
            amount: bond
          };
        }
        if (this.matchesEventName(discriminator, "RewardClaimedEvent")) {
          const dispute = new import_web33.PublicKey(data.slice(8, 40)).toBase58();
          const recipient = new import_web33.PublicKey(data.slice(40, 72)).toBase58();
          if (recipient !== userPubkey.toBase58()) continue;
          const rewardType = data[72];
          const amount = readU64LE(data, 73);
          const typeMap = {
            0: "claim_juror",
            1: "claim_challenger",
            2: "claim_defender",
            3: "claim_restorer"
          };
          return {
            type: typeMap[rewardType] || "claim_unknown",
            dispute,
            amount
          };
        }
        if (this.matchesEventName(discriminator, "RecordClosedEvent")) {
          const dispute = new import_web33.PublicKey(data.slice(8, 40)).toBase58();
          const recordOwner = new import_web33.PublicKey(data.slice(40, 72)).toBase58();
          if (recordOwner !== userPubkey.toBase58()) continue;
          const recordType = data[72];
          const rentReturned = readU64LE(data, 73);
          const typeMap = {
            0: "close_vote",
            1: "close_challenger",
            2: "close_defender"
          };
          return {
            type: typeMap[recordType] || "close_unknown",
            dispute,
            rentReclaimed: rentReturned
          };
        }
        if (this.matchesEventName(discriminator, "DefenderStakedEvent")) {
          const subject = new import_web33.PublicKey(data.slice(8, 40)).toBase58();
          const defender = new import_web33.PublicKey(data.slice(40, 72)).toBase58();
          if (defender !== userPubkey.toBase58()) continue;
          const stakeAmount = readU64LE(data, 72);
          return {
            type: "defend",
            subject,
            amount: stakeAmount
          };
        }
      }
    } catch (err) {
      console.warn("[parseAnchorEventsFromLogs] Error parsing events:", err);
    }
    return null;
  }
  /**
   * Check if a discriminator matches an event name
   * Uses pre-computed EVENT_DISCRIMINATORS to avoid crypto dependency
   */
  matchesEventName(discriminator, eventName) {
    const expected = _TribunalCraftClient.EVENT_DISCRIMINATORS[eventName];
    return expected ? discriminator === expected : false;
  }
  /**
   * Extract vote choice and rationale from instruction data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractVoteDetailsFromTx(tx) {
    try {
      const instructions = tx.transaction.message.instructions;
      for (const ix of instructions) {
        const programId = tx.transaction.message.accountKeys[ix.programIdIndex];
        const programKey = programId?.pubkey?.toBase58?.() || programId?.toBase58?.();
        if (programKey !== this.programId.toBase58()) continue;
        const data = Buffer.from(ix.data, "base64");
        if (data.length < 9) continue;
        const discriminator = data.slice(0, 8).toString("hex");
        if (discriminator === "07d560abfc3b3717") {
          const choiceByte = data[8];
          const choice = choiceByte === 0 ? "ForChallenger" : "ForDefender";
          if (data.length > 17) {
            const cidLength = data.readUInt32LE(17);
            if (cidLength > 0 && cidLength < 100 && data.length >= 21 + cidLength) {
              const rationaleCid = data.slice(21, 21 + cidLength).toString("utf8");
              return { choice, rationaleCid };
            }
          }
          return { choice };
        }
        if (discriminator === "7a7b5cf0fbcdbd20") {
          const choiceByte = data[8];
          const choice = choiceByte === 0 ? "ForRestoration" : "AgainstRestoration";
          if (data.length > 17) {
            const cidLength = data.readUInt32LE(17);
            if (cidLength > 0 && cidLength < 100 && data.length >= 21 + cidLength) {
              const rationaleCid = data.slice(21, 21 + cidLength).toString("utf8");
              return { choice, rationaleCid };
            }
          }
          return { choice };
        }
      }
    } catch (err) {
    }
    return null;
  }
  /**
   * Try to infer dispute outcome from transaction logs
   */
  inferOutcomeFromLogs(logs) {
    for (const log of logs) {
      if (log.includes("ChallengerWins") || log.includes("challenger wins") || log.includes("challenger_wins")) {
        return "ChallengerWins";
      }
      if (log.includes("DefenderWins") || log.includes("defender wins") || log.includes("defender_wins")) {
        return "DefenderWins";
      }
      if (log.includes("NoParticipation") || log.includes("no participation") || log.includes("no_participation")) {
        return "NoParticipation";
      }
    }
    return void 0;
  }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractAccountsFromTx(tx) {
    try {
      const accounts = tx.transaction.message.accountKeys;
      const result = {};
      const systemAccounts = /* @__PURE__ */ new Set([
        "11111111111111111111111111111111",
        // System Program
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        // Token Program
        "SysvarRent111111111111111111111111111111111",
        // Rent Sysvar
        "SysvarC1ock11111111111111111111111111111111",
        // Clock Sysvar
        this.programId.toBase58()
      ]);
      const writableAccounts = [];
      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        const key = acc.pubkey?.toBase58?.() || acc.toBase58?.();
        if (!key) continue;
        if (systemAccounts.has(key)) continue;
        if (acc.signer) continue;
        const preBalance = tx.meta?.preBalances?.[i] || 0;
        const postBalance = tx.meta?.postBalances?.[i] || 0;
        if (preBalance !== postBalance || acc.writable) {
          writableAccounts.push(key);
        }
      }
      if (writableAccounts.length >= 2) {
        result.dispute = writableAccounts[1];
      }
      if (writableAccounts.length >= 4) {
        result.subject = writableAccounts[3];
      }
      if (!result.dispute) {
        const nonSystemAccounts = [];
        for (let i = 0; i < accounts.length; i++) {
          const acc = accounts[i];
          const key = acc.pubkey?.toBase58?.() || acc.toBase58?.();
          if (!key) continue;
          if (systemAccounts.has(key)) continue;
          if (acc.signer) continue;
          nonSystemAccounts.push(key);
        }
        if (nonSystemAccounts.length >= 2) {
          result.dispute = nonSystemAccounts[1];
        }
        if (nonSystemAccounts.length >= 4) {
          result.subject = nonSystemAccounts[3];
        }
      }
      return result;
    } catch {
      return {};
    }
  }
  /**
   * Extract balance changes for the user from transaction
   */
  extractBalanceChanges(tx, userPubkey) {
    try {
      const accounts = tx.transaction.message.accountKeys;
      const preBalances = tx.meta?.preBalances || [];
      const postBalances = tx.meta?.postBalances || [];
      let received = 0;
      let sent = 0;
      let rentReclaimed = 0;
      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        const key = acc.pubkey?.toBase58?.() || acc.toBase58?.();
        if (key === userPubkey.toBase58()) {
          const pre = preBalances[i] || 0;
          const post = postBalances[i] || 0;
          const diff = post - pre;
          if (diff > 0) {
            received = diff;
          } else if (diff < 0) {
            sent = Math.abs(diff);
          }
          break;
        }
      }
      for (let i = 0; i < accounts.length; i++) {
        const pre = preBalances[i] || 0;
        const post = postBalances[i] || 0;
        if (pre > 0 && post === 0) {
          rentReclaimed += pre;
        }
      }
      return { received, sent, rentReclaimed };
    } catch {
      return { received: 0, sent: 0, rentReclaimed: 0 };
    }
  }
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
  async fetchMultiple(requests) {
    if (requests.length === 0) return [];
    const addresses = requests.map((r) => r.address);
    const accountInfos = await this.connection.getMultipleAccountsInfo(addresses);
    return accountInfos.map((info, i) => {
      if (!info || !info.data) return null;
      const { type } = requests[i];
      try {
        const anchorName = type.charAt(0).toUpperCase() + type.slice(1);
        return this.anchorProgram.coder.accounts.decode(anchorName, info.data);
      } catch (err) {
        return null;
      }
    });
  }
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
  async fetchModalData(subjectId, disputeRound, userPubkey) {
    const [disputePda] = this.pda.dispute(subjectId);
    const [escrowPda] = this.pda.escrow(subjectId);
    const requests = [
      { address: disputePda, type: "dispute" },
      { address: escrowPda, type: "escrow" }
    ];
    let jurorIdx = -1, challengerIdx = -1, defenderIdx = -1;
    if (userPubkey) {
      jurorIdx = requests.length;
      const [jurorPda] = this.pda.jurorRecord(subjectId, userPubkey, disputeRound);
      requests.push({ address: jurorPda, type: "jurorRecord" });
      challengerIdx = requests.length;
      const [challengerPda] = this.pda.challengerRecord(subjectId, userPubkey, disputeRound);
      requests.push({ address: challengerPda, type: "challengerRecord" });
      defenderIdx = requests.length;
      const [defenderPda] = this.pda.defenderRecord(subjectId, userPubkey, disputeRound);
      requests.push({ address: defenderPda, type: "defenderRecord" });
    }
    const results = await this.fetchMultiple(requests);
    return {
      dispute: results[0],
      escrow: results[1],
      jurorRecord: jurorIdx >= 0 ? results[jurorIdx] : null,
      challengerRecord: challengerIdx >= 0 ? results[challengerIdx] : null,
      defenderRecord: defenderIdx >= 0 ? results[defenderIdx] : null
    };
  }
};
// ===========================================================================
// Transaction History (for closed records)
// ===========================================================================
/**
 * Activity types that can be parsed from transaction history
 */
_TribunalCraftClient.ACTIVITY_TYPES = {
  VOTE: "vote",
  CHALLENGE: "challenge",
  DEFEND: "defend",
  CLAIM_JUROR: "claim_juror",
  CLAIM_CHALLENGER: "claim_challenger",
  CLAIM_DEFENDER: "claim_defender",
  CLOSE_VOTE: "close_vote",
  CLOSE_CHALLENGER: "close_challenger",
  CLOSE_DEFENDER: "close_defender",
  UNLOCK_STAKE: "unlock_stake"
};
/**
 * Instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
 */
_TribunalCraftClient.INSTRUCTION_DISCRIMINATORS = {
  vote_on_dispute: "07d560abfc3b3717",
  vote_on_restore: "7a7b5cf0fbcdbd20",
  submit_dispute: "d40f5c9c6f3c6d3c",
  // Will need to verify
  resolve_dispute: "e706ca0660670ce6"
};
// Pre-computed event discriminators: sha256("event:<EventName>")[0..8]
// These are constants and don't change, so we avoid runtime crypto usage
_TribunalCraftClient.EVENT_DISCRIMINATORS = {
  VoteEvent: "c347fa697877ea86",
  RestoreVoteEvent: "36daf12c5af7d2ee",
  DisputeCreatedEvent: "59a2309e1e7491f7",
  ChallengerJoinedEvent: "a35f6083ed61e523",
  RewardClaimedEvent: "f62bd7e45231e638",
  RecordClosedEvent: "7fc441d571b25037",
  DefenderStakedEvent: "03ba63387dd7d992"
};
// ===========================================================================
// Batch Fetching - Single RPC call for multiple accounts
// ===========================================================================
/**
 * Account types that can be batch fetched
 */
_TribunalCraftClient.ACCOUNT_TYPES = [
  "dispute",
  "escrow",
  "jurorRecord",
  "challengerRecord",
  "defenderRecord",
  "jurorPool",
  "challengerPool",
  "defenderPool",
  "subject"
];
var TribunalCraftClient = _TribunalCraftClient;

// src/types.ts
var SubjectStatusEnum = {
  Dormant: { dormant: {} },
  Valid: { valid: {} },
  Disputed: { disputed: {} },
  Invalid: { invalid: {} },
  Restoring: { restoring: {} }
};
var DisputeStatusEnum = {
  None: { none: {} },
  Pending: { pending: {} },
  Resolved: { resolved: {} }
};
var ResolutionOutcomeEnum = {
  None: { none: {} },
  ChallengerWins: { challengerWins: {} },
  DefenderWins: { defenderWins: {} },
  NoParticipation: { noParticipation: {} }
};
var DisputeTypeEnum = {
  Other: { other: {} },
  Breach: { breach: {} },
  Fraud: { fraud: {} },
  QualityDispute: { qualityDispute: {} },
  NonDelivery: { nonDelivery: {} },
  Misrepresentation: { misrepresentation: {} },
  PolicyViolation: { policyViolation: {} },
  DamagesClaim: { damagesClaim: {} }
};
var VoteChoiceEnum = {
  ForChallenger: { forChallenger: {} },
  ForDefender: { forDefender: {} }
};
var RestoreVoteChoiceEnum = {
  ForRestoration: { forRestoration: {} },
  AgainstRestoration: { againstRestoration: {} }
};
var BondSourceEnum = {
  Direct: { direct: {} },
  Pool: { pool: {} }
};
function isSubjectDormant(status) {
  return "dormant" in status;
}
function isSubjectValid(status) {
  return "valid" in status;
}
function isSubjectDisputed(status) {
  return "disputed" in status;
}
function isSubjectInvalid(status) {
  return "invalid" in status;
}
function isSubjectRestoring(status) {
  return "restoring" in status;
}
function isDisputeNone(status) {
  return "none" in status;
}
function isDisputePending(status) {
  return "pending" in status;
}
function isDisputeResolved(status) {
  return "resolved" in status;
}
function isChallengerWins(outcome) {
  return "challengerWins" in outcome;
}
function isDefenderWins(outcome) {
  return "defenderWins" in outcome;
}
function isNoParticipation(outcome) {
  return "noParticipation" in outcome;
}
function getDisputeTypeName(disputeType) {
  if ("other" in disputeType) return "Other";
  if ("breach" in disputeType) return "Breach";
  if ("fraud" in disputeType) return "Fraud";
  if ("qualityDispute" in disputeType) return "Quality Dispute";
  if ("nonDelivery" in disputeType) return "Non-Delivery";
  if ("misrepresentation" in disputeType) return "Misrepresentation";
  if ("policyViolation" in disputeType) return "Policy Violation";
  if ("damagesClaim" in disputeType) return "Damages Claim";
  return "Unknown";
}
function getOutcomeName(outcome) {
  if ("none" in outcome) return "None";
  if ("challengerWins" in outcome) return "Challenger Wins";
  if ("defenderWins" in outcome) return "Defender Wins";
  if ("noParticipation" in outcome) return "No Participation";
  return "Unknown";
}
function getBondSourceName(source) {
  if ("direct" in source) return "Direct";
  if ("pool" in source) return "Pool";
  return "Unknown";
}

// src/rewards.ts
function safeToNumber(value) {
  if (value === void 0) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}
function calculateJurorReward(roundResult, jurorRecord) {
  const jurorPool = safeToNumber(roundResult.jurorPool);
  const totalVoteWeight = safeToNumber(roundResult.totalVoteWeight);
  const votingPower = safeToNumber(jurorRecord.votingPower);
  const jurorPoolShare = totalVoteWeight > 0 ? votingPower / totalVoteWeight * jurorPool : 0;
  const votePercentage = totalVoteWeight > 0 ? votingPower / totalVoteWeight * 100 : 0;
  return {
    total: jurorPoolShare,
    jurorPoolShare,
    votingPower,
    totalVoteWeight,
    votePercentage
  };
}
function calculateChallengerReward(roundResult, challengerRecord) {
  const outcome = roundResult.outcome;
  const challengerWins = isChallengerWins(outcome);
  const noParticipation = isNoParticipation(outcome);
  const winnerPool = safeToNumber(roundResult.winnerPool);
  const totalStake = safeToNumber(roundResult.totalStake);
  const bondAtRisk = safeToNumber(roundResult.bondAtRisk);
  const stake = safeToNumber(challengerRecord.stake);
  let winnerPoolShare = 0;
  if (challengerWins && totalStake > 0) {
    winnerPoolShare = stake / totalStake * winnerPool;
  } else if (noParticipation) {
    const totalPool = totalStake + bondAtRisk;
    if (totalPool > 0) {
      winnerPoolShare = stake / totalPool * winnerPool;
    }
  }
  const poolPercentage = totalStake > 0 ? stake / totalStake * 100 : 0;
  return {
    total: winnerPoolShare,
    winnerPoolShare,
    stake,
    totalStake,
    poolPercentage
  };
}
function calculateDefenderReward(roundResult, defenderRecord) {
  const outcome = roundResult.outcome;
  const defenderWins = isDefenderWins(outcome);
  const noParticipation = isNoParticipation(outcome);
  const winnerPool = safeToNumber(roundResult.winnerPool);
  const bondAtRisk = safeToNumber(roundResult.bondAtRisk);
  const safeBond = safeToNumber(roundResult.safeBond);
  const totalStake = safeToNumber(roundResult.totalStake);
  const bond = safeToNumber(defenderRecord.bond);
  const availableBond = bondAtRisk + safeBond;
  const safeBondShare = availableBond > 0 ? safeBond * bond / availableBond : 0;
  const defenderAtRisk = availableBond > 0 ? bondAtRisk * bond / availableBond : 0;
  let winnerPoolShare = 0;
  if (defenderWins && bondAtRisk > 0) {
    winnerPoolShare = defenderAtRisk / bondAtRisk * winnerPool;
  } else if (noParticipation) {
    const totalPool = totalStake + bondAtRisk;
    if (totalPool > 0) {
      winnerPoolShare = defenderAtRisk / totalPool * winnerPool;
    }
  }
  const poolPercentage = availableBond > 0 ? bond / availableBond * 100 : 0;
  return {
    total: winnerPoolShare + safeBondShare,
    safeBondShare,
    winnerPoolShare,
    bond,
    totalBondAtRisk: bondAtRisk,
    safeBond,
    poolPercentage
  };
}
function calculateUserRewards(roundResult, records) {
  const outcome = roundResult.outcome;
  const challengerWins = isChallengerWins(outcome);
  const defenderWins = isDefenderWins(outcome);
  let total = 0;
  let juror;
  let challenger;
  let defender;
  if (records.jurorRecord) {
    juror = calculateJurorReward(roundResult, records.jurorRecord);
    total += juror.total;
  }
  if (records.challengerRecord) {
    challenger = calculateChallengerReward(roundResult, records.challengerRecord);
    total += challenger.total;
  }
  if (records.defenderRecord) {
    defender = calculateDefenderReward(roundResult, records.defenderRecord);
    total += defender.total;
  }
  return {
    total,
    juror,
    challenger,
    defender,
    challengerWins,
    defenderWins
  };
}
function isJurorRewardClaimable(jurorRecord) {
  return !jurorRecord.rewardClaimed;
}
function isChallengerRewardClaimable(challengerRecord, outcome) {
  return !challengerRecord.rewardClaimed && isChallengerWins(outcome);
}
function isDefenderRewardClaimable(defenderRecord) {
  return !defenderRecord.rewardClaimed;
}
function lamportsToSol(lamports, decimals = 6) {
  return (lamports / 1e9).toFixed(decimals);
}

// src/events.ts
var import_web34 = require("@solana/web3.js");
var import_anchor2 = require("@coral-xyz/anchor");
function parseClaimRole(role) {
  if ("defender" in role) return "Defender";
  if ("challenger" in role) return "Challenger";
  if ("juror" in role) return "Juror";
  return "Defender";
}
function parseOutcome(outcome) {
  if ("challengerWins" in outcome) return "ChallengerWins";
  if ("defenderWins" in outcome) return "DefenderWins";
  if ("noParticipation" in outcome) return "NoParticipation";
  return "None";
}
function createEventParser() {
  const coder = new import_anchor2.BorshCoder(idl_default);
  return new import_anchor2.EventParser(new import_web34.PublicKey(PROGRAM_ID), coder);
}
function parseEventsFromLogs(logs) {
  const parser = createEventParser();
  const events = [];
  for (const event of parser.parseLogs(logs)) {
    switch (event.name) {
      case "RewardClaimedEvent":
        events.push({
          type: "RewardClaimed",
          data: {
            subjectId: event.data.subjectId,
            round: event.data.round?.toNumber?.() ?? Number(event.data.round),
            claimer: event.data.claimer,
            role: parseClaimRole(event.data.role),
            amount: event.data.amount?.toNumber?.() ?? Number(event.data.amount),
            timestamp: event.data.timestamp?.toNumber?.() ?? Number(event.data.timestamp)
          }
        });
        break;
      case "RecordClosedEvent":
        events.push({
          type: "RecordClosed",
          data: {
            subjectId: event.data.subjectId,
            round: event.data.round?.toNumber?.() ?? Number(event.data.round),
            owner: event.data.owner,
            role: parseClaimRole(event.data.role),
            rentReturned: event.data.rentReturned?.toNumber?.() ?? Number(event.data.rentReturned),
            timestamp: event.data.timestamp?.toNumber?.() ?? Number(event.data.timestamp)
          }
        });
        break;
      case "StakeUnlockedEvent":
        events.push({
          type: "StakeUnlocked",
          data: {
            subjectId: event.data.subjectId,
            round: event.data.round?.toNumber?.() ?? Number(event.data.round),
            juror: event.data.juror,
            amount: event.data.amount?.toNumber?.() ?? Number(event.data.amount),
            timestamp: event.data.timestamp?.toNumber?.() ?? Number(event.data.timestamp)
          }
        });
        break;
      case "DisputeResolvedEvent":
        events.push({
          type: "DisputeResolved",
          data: {
            subjectId: event.data.subjectId,
            round: event.data.round?.toNumber?.() ?? Number(event.data.round),
            outcome: parseOutcome(event.data.outcome),
            totalStake: event.data.totalStake?.toNumber?.() ?? Number(event.data.totalStake),
            bondAtRisk: event.data.bondAtRisk?.toNumber?.() ?? Number(event.data.bondAtRisk),
            winnerPool: event.data.winnerPool?.toNumber?.() ?? Number(event.data.winnerPool),
            jurorPool: event.data.jurorPool?.toNumber?.() ?? Number(event.data.jurorPool),
            resolvedAt: event.data.resolvedAt?.toNumber?.() ?? Number(event.data.resolvedAt),
            timestamp: event.data.timestamp?.toNumber?.() ?? Number(event.data.timestamp)
          }
        });
        break;
    }
  }
  return events;
}
async function fetchClaimHistory(connection, claimer, options) {
  const claims = [];
  console.log("[SDK:fetchClaimHistory] Fetching signatures for:", claimer.toBase58());
  const signatures = await connection.getSignaturesForAddress(claimer, {
    limit: options?.limit ?? 100,
    before: options?.before
  });
  console.log("[SDK:fetchClaimHistory] Found signatures:", signatures.length);
  let tribunalTxCount = 0;
  for (const sig of signatures) {
    try {
      const tx = await connection.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0
      });
      if (!tx?.meta?.logMessages) continue;
      const programIdStr = PROGRAM_ID.toString();
      const involvesTribunal = tx.meta.logMessages.some(
        (log) => log.includes(programIdStr)
      );
      if (!involvesTribunal) continue;
      tribunalTxCount++;
      const events = parseEventsFromLogs(tx.meta.logMessages);
      if (events.length > 0) {
        console.log("[SDK:fetchClaimHistory] Tx", sig.signature.slice(0, 8), "events:", events.map((e) => e.type));
      }
      for (const event of events) {
        if (event.type === "RewardClaimed") {
          console.log("[SDK:fetchClaimHistory] Found RewardClaimed:", {
            claimer: event.data.claimer.toBase58(),
            expectedClaimer: claimer.toBase58(),
            matches: event.data.claimer.equals(claimer),
            subjectId: event.data.subjectId.toBase58(),
            round: event.data.round,
            amount: event.data.amount
          });
          if (event.data.claimer.equals(claimer)) {
            claims.push(event.data);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to parse transaction ${sig.signature}:`, error);
    }
  }
  console.log("[SDK:fetchClaimHistory] Tribunal txs:", tribunalTxCount, "claims found:", claims.length);
  return claims;
}
async function fetchClaimHistoryForSubject(connection, subjectId, escrowAddress, options) {
  const claims = [];
  const signatures = await connection.getSignaturesForAddress(escrowAddress, {
    limit: options?.limit ?? 100
  });
  for (const sig of signatures) {
    try {
      const tx = await connection.getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0
      });
      if (!tx?.meta?.logMessages) continue;
      const events = parseEventsFromLogs(tx.meta.logMessages);
      for (const event of events) {
        if (event.type === "RewardClaimed" && event.data.subjectId.equals(subjectId)) {
          claims.push(event.data);
        }
      }
    } catch (error) {
      console.warn(`Failed to parse transaction ${sig.signature}:`, error);
    }
  }
  return claims;
}
async function getClaimSummaryFromHistory(connection, claimer, subjectId, round, escrowAddress) {
  console.log("[SDK:getClaimSummaryFromHistory] Fetching claims for:", {
    claimer: claimer.toBase58(),
    subjectId: subjectId.toBase58(),
    round,
    escrowAddress: escrowAddress?.toBase58()
  });
  let claims;
  if (escrowAddress) {
    const allClaims = await fetchClaimHistoryForSubject(connection, subjectId, escrowAddress, { limit: 50 });
    claims = allClaims.filter((c) => c.claimer.equals(claimer));
    console.log("[SDK:getClaimSummaryFromHistory] Escrow query: found", allClaims.length, "claims,", claims.length, "for this user");
  } else {
    claims = await fetchClaimHistory(connection, claimer, { limit: 50 });
    console.log("[SDK:getClaimSummaryFromHistory] User query: found", claims.length, "claims");
  }
  const summary = { total: 0 };
  for (const claim of claims) {
    if (claim.subjectId.equals(subjectId) && claim.round === round) {
      console.log("[SDK:getClaimSummaryFromHistory] Match:", claim.role, claim.amount);
      switch (claim.role) {
        case "Defender":
          summary.defender = claim;
          break;
        case "Challenger":
          summary.challenger = claim;
          break;
        case "Juror":
          summary.juror = claim;
          break;
      }
      summary.total += claim.amount;
    }
  }
  console.log("[SDK:getClaimSummaryFromHistory] Summary total:", summary.total);
  return summary;
}
async function parseEventsFromTransaction(connection, signature) {
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0
  });
  if (!tx?.meta?.logMessages) {
    return [];
  }
  return parseEventsFromLogs(tx.meta.logMessages);
}

// src/errors.ts
var import_web35 = require("@solana/web3.js");
var import_anchor3 = require("@coral-xyz/anchor");
var PROGRAM_ERRORS = {
  6e3: { name: "Unauthorized", message: "You are not authorized to perform this action" },
  6001: { name: "InvalidConfig", message: "Invalid configuration parameter" },
  // Stake errors
  6002: { name: "StakeBelowMinimum", message: "Stake amount is below the minimum required" },
  6003: { name: "InsufficientAvailableStake", message: "You don't have enough available stake" },
  6004: { name: "InsufficientHeldStake", message: "Insufficient held stake for this operation" },
  6005: { name: "StakeStillLocked", message: "Your stake is still locked (7 days after resolution)" },
  6006: { name: "StakeAlreadyUnlocked", message: "This stake has already been unlocked" },
  // Bond errors
  6007: { name: "BondBelowMinimum", message: "Bond amount is below the minimum required" },
  6008: { name: "BondExceedsAvailable", message: "Bond amount exceeds your available stake" },
  // Subject errors
  6009: { name: "SubjectCannotBeStaked", message: "This subject cannot accept additional stakes" },
  6010: { name: "SubjectCannotBeDisputed", message: "This subject cannot be disputed at this time" },
  6011: { name: "SubjectCannotBeRestored", message: "This subject cannot be restored at this time" },
  // Restoration errors
  6012: { name: "RestoreStakeBelowMinimum", message: "Restore stake must match previous dispute total" },
  6013: { name: "NotARestore", message: "This dispute is not a restoration request" },
  // Dispute errors
  6014: { name: "CannotSelfDispute", message: "You cannot dispute your own subject" },
  6015: { name: "DisputeAlreadyExists", message: "A dispute already exists for this subject" },
  6016: { name: "DisputeNotFound", message: "The dispute was not found" },
  6017: { name: "DisputeAlreadyResolved", message: "This dispute has already been resolved" },
  6018: { name: "VotingNotEnded", message: "The voting period has not ended yet" },
  6019: { name: "VotingEnded", message: "The voting period has already ended" },
  // Vote errors
  6020: { name: "CannotVoteOnOwnDispute", message: "You cannot vote on your own dispute" },
  6021: { name: "AlreadyVoted", message: "You have already voted on this dispute" },
  6022: { name: "VoteAllocationBelowMinimum", message: "Vote stake allocation is below the minimum" },
  6023: { name: "InvalidVoteChoice", message: "Invalid vote choice" },
  // Juror errors
  6024: { name: "JurorNotActive", message: "You must be an active juror to perform this action" },
  6025: { name: "JurorAlreadyRegistered", message: "You are already registered as a juror" },
  // Challenger errors
  6026: { name: "ChallengerNotFound", message: "Challenger record not found" },
  // Reward errors
  6027: { name: "RewardAlreadyClaimed", message: "This reward has already been claimed" },
  6028: { name: "RewardNotClaimed", message: "You must claim your reward first" },
  6029: { name: "NotEligibleForReward", message: "You are not eligible for this reward" },
  6030: { name: "ReputationAlreadyProcessed", message: "Reputation has already been processed for this vote" },
  // Math errors
  6031: { name: "ArithmeticOverflow", message: "Calculation error: arithmetic overflow" },
  6032: { name: "DivisionByZero", message: "Calculation error: division by zero" },
  // Escrow errors
  6033: { name: "ClaimsNotComplete", message: "Not all claims have been processed" }
};
var ANCHOR_ERRORS = {
  "AccountNotInitialized": "Protocol not initialized. Please contact the administrator.",
  "AccountDidNotDeserialize": "Invalid account data. The account may be corrupted.",
  "AccountDidNotSerialize": "Failed to save account data.",
  "AccountOwnedByWrongProgram": "Account belongs to a different program.",
  "InvalidProgramId": "Invalid program ID.",
  "InvalidProgramExecutable": "Program is not executable.",
  "AccountMismatch": "Account does not match expected address.",
  "expected this account to be already initialized": "Protocol not initialized. Please contact the administrator.",
  "ConstraintMut": "Account is not mutable.",
  "ConstraintHasOne": "Account constraint violated.",
  "ConstraintSigner": "Missing required signature.",
  "ConstraintRaw": "Constraint check failed.",
  "ConstraintOwner": "Account owner mismatch.",
  "ConstraintSeeds": "PDA seeds mismatch."
};
var SOLANA_ERRORS = {
  "Blockhash not found": "Transaction expired. Please try again.",
  "insufficient lamports": "Insufficient SOL balance to complete this transaction",
  "insufficient funds": "Insufficient SOL balance to complete this transaction",
  "Transaction simulation failed": "Transaction simulation failed",
  "Account not found": "Required account not found on chain",
  "Account does not exist": "Required account not found on chain",
  "custom program error": "Program execution error",
  "already in use": "This account is already in use",
  "Transaction was not confirmed": "Transaction was not confirmed. Please try again.",
  "block height exceeded": "Transaction expired. Please try again.",
  "Wallet not connected": "Please connect your wallet to continue",
  "Wallet disconnected": "Wallet disconnected. Please reconnect to continue",
  "User rejected": "Transaction was cancelled"
};
function extractErrorCode(input) {
  if (typeof input === "string") {
    const hexMatch = input.match(/0x([0-9a-fA-F]+)/);
    if (hexMatch) {
      const code = parseInt(hexMatch[1], 16);
      if (code >= 6e3 && code <= 6100) return code;
    }
    const decMatch = input.match(/\b(6\d{3})\b/);
    if (decMatch) {
      return parseInt(decMatch[1], 10);
    }
    const customMatch = input.match(/custom program error: 0x([0-9a-fA-F]+)/i);
    if (customMatch) {
      return parseInt(customMatch[1], 16);
    }
  }
  if (typeof input === "object" && input !== null) {
    if ("InstructionError" in input) {
      const [, instructionError] = input.InstructionError;
      if (typeof instructionError === "object" && "Custom" in instructionError) {
        return instructionError.Custom;
      }
    }
  }
  return null;
}
function parseTransactionError(error) {
  if (error instanceof import_anchor3.AnchorError) {
    const errorCode = error.error.errorCode.number;
    const programError = PROGRAM_ERRORS[errorCode];
    if (programError) {
      return {
        code: errorCode,
        name: programError.name,
        message: programError.message,
        raw: error.message,
        logs: error.logs
      };
    }
    return {
      code: errorCode,
      name: error.error.errorCode.code,
      message: error.error.errorMessage || error.message,
      raw: error.message,
      logs: error.logs
    };
  }
  if (error instanceof import_anchor3.ProgramError) {
    const programError = PROGRAM_ERRORS[error.code];
    if (programError) {
      return {
        code: error.code,
        name: programError.name,
        message: programError.message,
        raw: error.message
      };
    }
    return {
      code: error.code,
      name: "ProgramError",
      message: error.msg || error.message,
      raw: error.message
    };
  }
  if (error instanceof import_web35.SendTransactionError) {
    const errorMsg = error.message;
    const logs = error.logs;
    const errorCode = extractErrorCode(errorMsg);
    if (errorCode !== null) {
      const programError = PROGRAM_ERRORS[errorCode];
      if (programError) {
        return {
          code: errorCode,
          name: programError.name,
          message: programError.message,
          raw: errorMsg,
          logs
        };
      }
    }
    if (logs) {
      for (const log of logs) {
        const logErrorCode = extractErrorCode(log);
        if (logErrorCode !== null) {
          const programError = PROGRAM_ERRORS[logErrorCode];
          if (programError) {
            return {
              code: logErrorCode,
              name: programError.name,
              message: programError.message,
              raw: errorMsg,
              logs
            };
          }
        }
        const errorCodeMatch = log.match(/Error Code: (\w+)/);
        if (errorCodeMatch) {
          const errorName = errorCodeMatch[1];
          for (const [code, err] of Object.entries(PROGRAM_ERRORS)) {
            if (err.name === errorName) {
              return {
                code: parseInt(code),
                name: err.name,
                message: err.message,
                raw: errorMsg,
                logs
              };
            }
          }
        }
      }
    }
    for (const [key, message] of Object.entries(SOLANA_ERRORS)) {
      if (errorMsg.toLowerCase().includes(key.toLowerCase())) {
        return {
          code: null,
          name: key,
          message,
          raw: errorMsg,
          logs
        };
      }
    }
    return {
      code: null,
      name: "TransactionError",
      message: errorMsg,
      raw: errorMsg,
      logs
    };
  }
  if (error instanceof Error) {
    const errorMsg = error.message;
    const logs = error.logs;
    const errorCode = extractErrorCode(errorMsg);
    if (errorCode !== null) {
      const programError = PROGRAM_ERRORS[errorCode];
      if (programError) {
        return {
          code: errorCode,
          name: programError.name,
          message: programError.message,
          raw: errorMsg,
          logs
        };
      }
    }
    if (logs) {
      for (const log of logs) {
        const logErrorCode = extractErrorCode(log);
        if (logErrorCode !== null) {
          const programError = PROGRAM_ERRORS[logErrorCode];
          if (programError) {
            return {
              code: logErrorCode,
              name: programError.name,
              message: programError.message,
              raw: errorMsg,
              logs
            };
          }
        }
      }
    }
    for (const [code, err] of Object.entries(PROGRAM_ERRORS)) {
      if (errorMsg.includes(err.name)) {
        return {
          code: parseInt(code),
          name: err.name,
          message: err.message,
          raw: errorMsg,
          logs
        };
      }
    }
    for (const [key, message] of Object.entries(SOLANA_ERRORS)) {
      if (errorMsg.toLowerCase().includes(key.toLowerCase())) {
        return {
          code: null,
          name: key,
          message,
          raw: errorMsg,
          logs
        };
      }
    }
    if (errorMsg.includes("0x1") || errorMsg.includes("insufficient")) {
      return {
        code: null,
        name: "InsufficientFunds",
        message: "Insufficient SOL balance to complete this transaction",
        raw: errorMsg,
        logs
      };
    }
    return {
      code: null,
      name: "Error",
      message: errorMsg,
      raw: errorMsg,
      logs
    };
  }
  return {
    code: null,
    name: "UnknownError",
    message: String(error),
    raw: String(error)
  };
}
function parseSimulationError(err, logs) {
  if (typeof err === "object" && err !== null) {
    const errorCode = extractErrorCode(err);
    if (errorCode !== null) {
      const programError = PROGRAM_ERRORS[errorCode];
      if (programError) {
        return {
          code: errorCode,
          name: programError.name,
          message: programError.message,
          raw: JSON.stringify(err),
          logs
        };
      }
    }
  }
  if (logs) {
    for (const log of logs) {
      const errorCode = extractErrorCode(log);
      if (errorCode !== null) {
        const programError = PROGRAM_ERRORS[errorCode];
        if (programError) {
          return {
            code: errorCode,
            name: programError.name,
            message: programError.message,
            raw: log,
            logs
          };
        }
      }
      const errorCodeMatch = log.match(/Error Code: (\w+)/);
      if (errorCodeMatch) {
        const errorName = errorCodeMatch[1];
        for (const [code, errDef] of Object.entries(PROGRAM_ERRORS)) {
          if (errDef.name === errorName) {
            return {
              code: parseInt(code),
              name: errDef.name,
              message: errDef.message,
              raw: log,
              logs
            };
          }
        }
        const anchorMsg = ANCHOR_ERRORS[errorName];
        if (anchorMsg) {
          return {
            code: null,
            name: errorName,
            message: anchorMsg,
            raw: log,
            logs
          };
        }
      }
      for (const [pattern, message] of Object.entries(ANCHOR_ERRORS)) {
        if (log.includes(pattern)) {
          return {
            code: null,
            name: pattern.replace(/\s+/g, ""),
            message,
            raw: log,
            logs
          };
        }
      }
      const errorMsgMatch = log.match(/Error Message: (.+)/);
      if (errorMsgMatch) {
        const errorMsg = errorMsgMatch[1];
        for (const [pattern, message] of Object.entries(ANCHOR_ERRORS)) {
          if (errorMsg.includes(pattern)) {
            return {
              code: null,
              name: pattern.replace(/\s+/g, ""),
              message,
              raw: log,
              logs
            };
          }
        }
        return {
          code: null,
          name: "ProgramError",
          message: errorMsg,
          raw: log,
          logs
        };
      }
    }
  }
  return {
    code: null,
    name: "SimulationFailed",
    message: "Transaction simulation failed",
    raw: JSON.stringify(err),
    logs
  };
}
async function simulateTransaction(connection, transaction) {
  try {
    let simulation;
    if (transaction instanceof import_web35.VersionedTransaction) {
      simulation = await connection.simulateTransaction(transaction, {
        sigVerify: false,
        replaceRecentBlockhash: true
      });
    } else {
      simulation = await connection.simulateTransaction(transaction, void 0, true);
    }
    if (simulation.value.err) {
      return {
        success: false,
        error: parseSimulationError(
          simulation.value.err,
          simulation.value.logs || void 0
        ),
        logs: simulation.value.logs || void 0,
        unitsConsumed: simulation.value.unitsConsumed || void 0
      };
    }
    return {
      success: true,
      logs: simulation.value.logs || void 0,
      unitsConsumed: simulation.value.unitsConsumed || void 0
    };
  } catch (error) {
    return {
      success: false,
      error: parseTransactionError(error)
    };
  }
}
var TribunalError = class extends Error {
  constructor(error) {
    super(error.message);
    this.name = "TribunalError";
    this.code = error.code;
    this.errorName = error.name;
    this.raw = error.raw;
    this.logs = error.logs;
  }
};
async function withErrorHandling(fn) {
  try {
    return await fn();
  } catch (error) {
    const parsed = parseTransactionError(error);
    throw new TribunalError(parsed);
  }
}
function getProgramErrors() {
  return { ...PROGRAM_ERRORS };
}
function getErrorByCode(code) {
  return PROGRAM_ERRORS[code];
}
function getErrorByName(name) {
  for (const [code, err] of Object.entries(PROGRAM_ERRORS)) {
    if (err.name === name) {
      return { code: parseInt(code), ...err };
    }
  }
  return void 0;
}

// src/content-types.ts
function createSubjectContent(partial) {
  return {
    version: 1,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    ...partial
  };
}
function createDisputeContent(partial) {
  return {
    version: 1,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    evidence: [],
    ...partial
  };
}
function createVoteRationaleContent(partial) {
  return {
    version: 1,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    ...partial
  };
}
function validateSubjectContent(content) {
  if (!content || typeof content !== "object") return false;
  const c = content;
  return c.version === 1 && typeof c.title === "string" && typeof c.description === "string" && typeof c.category === "string" && typeof c.terms === "object" && c.terms !== null && typeof c.terms.text === "string";
}
function validateDisputeContent(content) {
  if (!content || typeof content !== "object") return false;
  const c = content;
  return c.version === 1 && typeof c.title === "string" && typeof c.reason === "string" && typeof c.type === "string" && typeof c.subjectCid === "string" && typeof c.requestedOutcome === "string" && Array.isArray(c.evidence);
}
function validateVoteRationaleContent(content) {
  if (!content || typeof content !== "object") return false;
  const c = content;
  return c.version === 1 && typeof c.rationale === "string";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BASE_CHALLENGER_BOND,
  BOT_REWARD_BPS,
  BondSourceEnum,
  CHALLENGER_POOL_SEED,
  CHALLENGER_RECORD_SEED,
  CLAIM_GRACE_PERIOD,
  DEFENDER_POOL_SEED,
  DEFENDER_RECORD_SEED,
  DISPUTE_SEED,
  DisputeStatusEnum,
  DisputeTypeEnum,
  ESCROW_SEED,
  IDL,
  INITIAL_REPUTATION,
  JUROR_POOL_SEED,
  JUROR_RECORD_SEED,
  JUROR_SHARE_BPS,
  MAX_VOTING_PERIOD,
  MIN_CHALLENGER_BOND,
  MIN_DEFENDER_STAKE,
  MIN_JUROR_STAKE,
  MIN_VOTING_PERIOD,
  PDA,
  PLATFORM_SHARE_BPS,
  PROGRAM_ID,
  PROTOCOL_CONFIG_SEED,
  REPUTATION_GAIN_RATE,
  REPUTATION_LOSS_RATE,
  REP_100_PERCENT,
  REP_PRECISION,
  ResolutionOutcomeEnum,
  RestoreVoteChoiceEnum,
  STAKE_UNLOCK_BUFFER,
  SUBJECT_SEED,
  SubjectStatusEnum,
  TOTAL_FEE_BPS,
  TREASURY_SWEEP_PERIOD,
  TribunalCraftClient,
  TribunalError,
  VoteChoiceEnum,
  WINNER_SHARE_BPS,
  calculateChallengerReward,
  calculateDefenderReward,
  calculateJurorReward,
  calculateMinBond,
  calculateUserRewards,
  createDisputeContent,
  createEventParser,
  createSubjectContent,
  createVoteRationaleContent,
  fetchClaimHistory,
  fetchClaimHistoryForSubject,
  formatReputation,
  getBondSourceName,
  getClaimSummaryFromHistory,
  getDisputeTypeName,
  getErrorByCode,
  getErrorByName,
  getOutcomeName,
  getProgramErrors,
  integerSqrt,
  isChallengerRewardClaimable,
  isChallengerWins,
  isDefenderRewardClaimable,
  isDefenderWins,
  isDisputeNone,
  isDisputePending,
  isDisputeResolved,
  isJurorRewardClaimable,
  isNoParticipation,
  isSubjectDisputed,
  isSubjectDormant,
  isSubjectInvalid,
  isSubjectRestoring,
  isSubjectValid,
  lamportsToSol,
  parseEventsFromLogs,
  parseEventsFromTransaction,
  parseSimulationError,
  parseTransactionError,
  pda,
  simulateTransaction,
  validateDisputeContent,
  validateSubjectContent,
  validateVoteRationaleContent,
  withErrorHandling
});
