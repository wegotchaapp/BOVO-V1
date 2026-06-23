export enum UserRole {
  USER = 'user',
  PREMIUM_USER = 'premium_user',
  DRIVER = 'driver',
  TS_AGENT = 'ts_agent',
  ADMIN = 'admin',
}

export enum TripStatus {
  POSTED = 'posted',
  BOOKED = 'booked',
  CONFIRMED = 'confirmed',
  EN_ROUTE = 'en_route',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  EN_ROUTE = 'en_route',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DECLINED = 'declined',
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  FAILED = 'failed',
  REQUIRES_INPUT = 'requires_input',
  EXPIRED = 'expired',
}

export enum BackgroundCheckStatus {
  PENDING = 'pending',
  CLEAR = 'clear',
  CONSIDER = 'consider',
  ADVERSE = 'adverse',
}

export enum SosTriggerType {
  BUTTON = 'button',
  VOLUME_SEQUENCE = 'volume_sequence',
  UNSAFE_FEELING = 'unsafe_feeling',
}

export enum SosStatus {
  ACTIVE = 'active',
  FALSE_ALARM = 'false_alarm',
  DISPATCHED = 'dispatched',
  RESOLVED = 'resolved',
}

export enum ReportSeverity {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
}

export enum ReportCategory {
  SEXUAL_MISCONDUCT = 'sexual_misconduct',
  WEAPONS_THREAT = 'weapons_threat',
  CRIMINAL_ALLEGATION = 'criminal_allegations',
  UNSAFE_DRIVING = 'unsafe_driving',
  HARASSMENT = 'harassment',
  DISCRIMINATION = 'discrimination',
  VEHICLE_CONDITION = 'vehicle_condition',
  NO_SHOW = 'no_show',
  ROUTE_FRAUD = 'route_fraud',
  MINOR_DISPUTE = 'minor_dispute',
}

export enum ModerationActionType {
  DISMISS = 'dismiss',
  WARNING = 'warning',
  TEMP_SUSPENSION = 'temp_suspension',
  PERMANENT_BAN = 'permanent_ban',
  LAW_ENFORCEMENT_REFERRAL = 'law_enforcement_referral',
}

export enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium',
}

export enum LuggageType {
  CARRY_ON = 'carry_on',
  STANDARD = 'standard',
  LARGE = 'large',
  OVERSIZED = 'oversized',
}

export enum VehicleCategory {
  COMPACT = 'compact',
  STANDARD_SEDAN = 'standard_sedan',
  SUV_CROSSOVER = 'suv_crossover',
  LARGE_SUV = 'large_suv',
  TRUCK = 'truck',
  VAN = 'van',
}

export enum ConversationStyle {
  QUIET = 'quiet',
  FRIENDLY = 'friendly',
  CHATTY = 'chatty',
}

export enum MusicPreference {
  NO_MUSIC = 'no_music',
  BACKGROUND = 'background',
  DRIVER_CHOICE = 'driver_choice',
}

export enum SmokingPreference {
  NEVER = 'never',
  ONLY_STOPS = 'only_stops',
  ALLOWED = 'allowed',
}

export enum PetPreference {
  NEVER = 'never',
  WITH_APPROVAL = 'with_approval',
  WELCOME = 'welcome',
}

export enum LuggageCapacity {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  EXTRA = 'extra',
}

export enum DeviationStatus {
  PENDING = 'pending',
  RESPONDED_OK = 'responded_ok',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  FALSE_ALARM = 'false_alarm',
}

export enum AppealStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  GRANTED = 'granted',
  DENIED = 'denied',
}

export enum AuditEventType {
  TNS_ACTION = 't&s_action',
  ACCOUNT_CHANGE = 'account_change',
  PAYMENT_EVENT = 'payment_event',
  SOS_EVENT = 'sos_event',
  APPEAL_ACTION = 'appeal_action',
}

export enum ChatMessageFlagCategory {
  CONTACT_INFO_SHARE = 'contact_info_share',
  PROFANITY = 'profanity',
  HARASSMENT = 'harassment',
  SUSPECTED_SCAM = 'suspected_scam',
}

export enum ChatEvent {
  MESSAGE_SENT = 'chat.message.sent',
  MESSAGE_READ = 'chat.message.read',
  CALL_INITIATED = 'chat.call.initiated',
  BLOCK_APPLIED = 'chat.block.applied',
}
