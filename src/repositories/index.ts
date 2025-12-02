// Export all repository functions from a single file for easier imports

// User repository
export {
  createOrUpdateUser,
  getUserByWalletAddress,
  updateUserProfile
} from './user.repository';

// Permissions repository
export {
  getPermissions,
  updatePermissions,
  setNotificationPermission,
  setContactsPermission
} from './permissions.repository';

// Transactions repository
export {
  recordTransaction,
  updateTransactionStatus,
  getTransactionHistory,
  getTransaction
} from './transactions.repository';

// Verifications repository
export {
  recordVerification,
  isVerified,
  getUserVerifications
} from './verifications.repository';

// Energy repository
export {
  EnergyRepository,
  DEFAULT_MAX_ENERGY,
  DEFAULT_ENERGY_REPLENISH_MINUTES
} from './energy.repository';

// Elemental Essences repository
export {
  ElementalEssencesRepository
} from './elemental-essences.repository';

// Seasonal Championship repository
export {
  SeasonalChampionshipRepository
} from './seasonal-championship.repository';

// Export types
export type { UserData } from './user.repository';
export type { PermissionData } from './permissions.repository';
export type { TransactionData } from './transactions.repository';
export type { VerificationData } from './verifications.repository';
export type { EnergyData } from './energy.repository';
export type { ElementalEssences, EssenceType } from './elemental-essences.repository';
export type {
  Season,
  PlayerSeasonStats,
  LeaderboardEntry,
  SeasonReward,
  SeasonTransaction,
  SeasonStatus,
  TierType,
  SeasonTransactionType,
  EssenceCost
} from './seasonal-championship.repository';