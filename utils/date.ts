//app/utils/date.ts
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInDays,
  format,
} from "date-fns";

export function formatDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatShortDate(date: Date | string): string {
  return format(new Date(date), "MMM d");
}

export function formatRelativeDate(date: Date | string): string {
  const daysUntil = differenceInDays(new Date(date), new Date());

  if (daysUntil < 0) return formatDate(date);
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil === 2) return "In 2 days";
  if (daysUntil < 7) return `In ${daysUntil} days`;
  const weeks = Math.floor(daysUntil / 7);
  if (daysUntil < 30) return `In ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  return formatDate(date);
}
export function getDaysUntil(date: Date | string): number {
  return differenceInDays(new Date(date), new Date());
}

export function calculateNextBillingDate(
  startDate: Date,
  billingCycle: string,
  customCycleDays?: number,
): Date {
  const now = new Date();
  let nextDate = new Date(startDate);

  switch (billingCycle) {
    case "weekly":
      while (nextDate <= now) {
        nextDate = addWeeks(nextDate, 1);
      }
      break;
    case "monthly":
      while (nextDate <= now) {
        nextDate = addMonths(nextDate, 1);
      }
      break;
    case "yearly":
      while (nextDate <= now) {
        nextDate = addYears(nextDate, 1);
      }
      break;
    case "custom":
      if (customCycleDays && customCycleDays > 0) {
        while (nextDate <= now) {
          nextDate = addDays(nextDate, customCycleDays);
        }
      } else {
        throw new Error(
          "customCycleDays must be a positive number for custom billing cycle",
        );
      }
      break;
    default:
      throw new Error(`Unknown billing cycle: ${billingCycle}`);
  }

  return nextDate;
}
export function formatCurrency(
  amount: number,
  currency: string = "USD",
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
