import { colors } from "@/constants/theme";

// Helper to format general display values
export const formatGeneralDisplayValue = (
  value: string | number | null | undefined
): string => {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "string") {
    return value
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return String(value);
};

// Helper to format the date
export const formatDate = (timestamp: number | null | undefined): string => {
  if (!timestamp) return "Date not set";
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

// Helper to format a price (in pence) as GBP per player, e.g. "£35" or "£12.50"
export const formatPricePerPlayer = (
  pence: number | null | undefined
): string | null => {
  if (pence === null || pence === undefined) return null;
  const pounds = pence / 100;
  const isWhole = pounds % 1 === 0;
  return `£${isWhole ? pounds.toFixed(0) : pounds.toFixed(2)}`;
};

// Helper to format a relative timestamp (e.g. "4 min ago", "2 hr ago")
export const formatRelativeTime = (
  timestamp: string | number | Date | null | undefined
): string | null => {
  if (!timestamp) return null;
  const then = new Date(timestamp).getTime();
  if (Number.isNaN(then)) return null;
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 45) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

// Helper to format Time Slot with ranges
export const formatTimeSlotDisplay = (
  timeSlotId: string | null | undefined
): string => {
  if (!timeSlotId) return "Time not set";
  switch (timeSlotId) {
    case "EARLY_MORNING":
      return "Early Morning (6am - 9am)";
    case "LATE_MORNING":
      return "Late Morning (9am - 12pm)";
    case "LUNCHTIME":
      return "Lunch Time (12pm - 3pm)";
    case "LATE_AFTERNOON":
      return "Late Afternoon (3pm - 6pm)";
    case "EVENING":
      return "Evening (After 6pm)";
    default:
      return formatGeneralDisplayValue(timeSlotId); // Fallback for unknown IDs
  }
};

// Helper to get lozenge style and text based on game type
export const getGameTypeStyle = (gameType: string | null | undefined) => {
  let lozengeStyle = {};
  let lozengeText = formatGeneralDisplayValue(gameType);

  switch (gameType) {
    case "PURELY_SOCIAL":
      lozengeStyle = {
        backgroundColor: "#4F362A",
        borderColor: colors.primary.orange,
      };
      lozengeText = "Purely Social";
      break;
    case "RELAXED_ROUND":
      lozengeStyle = {
        backgroundColor: "#4F362A",
        borderColor: colors.primary.orange,
      };
      lozengeText = "Relaxed Round";
      break;
    case "COMPETITIVE_MATCH":
      lozengeStyle = {
        backgroundColor: "#442222",
        borderColor: colors.primary.red,
      };
      lozengeText = "Competitive Match";
      break;
    case "BEGINNER_FRIENDLY":
      lozengeStyle = {
        backgroundColor: "#4A4129",
        borderColor: colors.primary.yellow,
      };
      lozengeText = "Beginner Friendly";
      break;
    default:
      lozengeStyle = {
        backgroundColor: colors.neutral.surface,
        borderColor: colors.neutral.surface,
      };
      break;
  }
  return { lozengeStyle, lozengeText };
};

// Helper to format handicap from profile's numeric handicap -- REMOVED as we now use handicap_range from onboarding
// export const formatHandicapFromProfile = (
//   handicap: number | null | undefined
// ): string => {
//   if (handicap === null || handicap === undefined) return "Handicap not set";
//   if (handicap <= 10) return "Low-Handicapper";
//   if (handicap <= 25) return "Mid-Handicapper";
//   return "High-Handicapper";
// };
