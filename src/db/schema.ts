// Moneta local storage schema (JSON text files in ./data/*.json).
// Types mirror the previous Postgres tables so the rest of the app is unchanged.
export type {
  DbBudget as budgetsRow,
  DbCategory as categoriesRow,
  DbGoal as goalsRow,
  DbRecurring as recurringRow,
  DbSession as sessionsRow,
  DbTransaction as transactionsRow,
  DbUser as usersRow,
} from "@/db/jsondb";

export type { DbUser as SessionUserRow } from "@/db/jsondb";
