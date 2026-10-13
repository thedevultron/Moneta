import { listByUser } from "@/db/jsondb";
import type { DbBudget, DbCategory, DbGoal, DbRecurring, DbTransaction } from "@/db/jsondb";
import type { SessionUser } from "@/lib/auth";
import { publicUser } from "@/lib/auth";
import type { AppData, Budget, Category, Goal, Recurring, Tx } from "@/lib/types";

export const serCategory = (r: DbCategory): Category => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  color: r.color,
  kind: r.kind as Category["kind"],
});
export const serTx = (r: DbTransaction): Tx => ({
  id: r.id,
  categoryId: r.categoryId,
  type: r.type as Tx["type"],
  amount: Number(r.amount),
  note: r.note,
  date: r.date,
});
export const serBudget = (r: DbBudget): Budget => ({
  id: r.id,
  categoryId: r.categoryId,
  monthlyLimit: Number(r.monthlyLimit),
});
export const serGoal = (r: DbGoal): Goal => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  target: Number(r.target),
  saved: Number(r.saved),
  deadline: r.deadline,
});
export const serRecurring = (r: DbRecurring): Recurring => ({
  id: r.id,
  categoryId: r.categoryId,
  name: r.name,
  amount: Number(r.amount),
  dayOfMonth: r.dayOfMonth,
  active: r.active,
});

export async function loadAll(user: SessionUser): Promise<AppData> {
  const [cats, txs, bdg, gls, rec] = await Promise.all([
    listByUser("categories", user.id),
    listByUser("transactions", user.id),
    listByUser("budgets", user.id),
    listByUser("goals", user.id),
    listByUser("recurring", user.id),
  ]);
  cats.sort((a, b) => a.id - b.id);
  txs.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const txSlice = txs.slice(0, 3000);
  bdg.sort((a, b) => a.id - b.id);
  gls.sort((a, b) => a.id - b.id);
  rec.sort((a, b) => a.dayOfMonth - b.dayOfMonth || a.id - b.id);
  return {
    user: publicUser(user),
    categories: cats.map(serCategory),
    transactions: txSlice.map(serTx),
    budgets: bdg.map(serBudget),
    goals: gls.map(serGoal),
    recurring: rec.map(serRecurring),
  };
}
