export type ComplaintType =
  | "ORGANISER_DID_NOT_BOOK"
  | "GAME_CANCELLED_WITHOUT_NOTICE"
  | "OTHER";

export type ComplaintStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "RESOLVED"
  | "REFUNDED"
  | "REJECTED";
