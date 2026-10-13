import { deleteRows, insertRow, listByUser, updateRows } from "@/db/jsondb";
import { serBudget, serCategory, serGoal, serRecurring, serTx } from "@/lib/data";
import type { ResourceName } from "@/lib/types";

/** Canonical form for comparing category names (case/whitespace-insensitive). */
export function normalizeCategoryName(n: unknown): string {
  return String(n ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Fold one category into another: rewire refs, resolve budgets, delete the loser. */
export async function mergeCategoryInto(userId: number, dropId: number, keepId: number): Promise<void> {
  if (dropId === keepId) return;
  await updateRows("transactions", (r) => r.userId === userId && r.categoryId === dropId, { categoryId: keepId } as never);
  await updateRows("recurring", (r) => r.userId === userId && r.categoryId === dropId, { categoryId: keepId } as never);
  const keepHasBudget = (await listByUser("budgets", userId)).some((b) => b.categoryId === keepId);
  if (keepHasBudget) {
    await deleteRows("budgets", (r) => r.userId === userId && r.categoryId === dropId);
  } else {
    await updateRows("budgets", (r) => r.userId === userId && r.categoryId === dropId, { categoryId: keepId } as never);
  }
  await deleteRows("categories", (r) => r.id === dropId && r.userId === userId);
}

/** Merge same-name + same-kind categories (keeps the oldest). Returns merges done. */
export async function mergeDuplicateCategories(userId: number): Promise<number> {
  const cats = await listByUser("categories", userId);
  const seen = new Map<string, { id: number }>();
  let merged = 0;
  for (const c of cats) {
    const key = `${c.kind}::${normalizeCategoryName(c.name)}`;
    const first = seen.get(key);
    if (!first) seen.set(key, c);
    else {
      await mergeCategoryInto(userId, c.id, first.id);
      merged++;
    }
  }
  return merged;
}

type Body = Record<string, unknown>;
type Built = { values: Body } | { error: string };

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v)
    ? v
    : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))
      ? Number(v)
      : null;

async function ownsCategory(userId: number, id: unknown) {
  if (id === null || id === undefined) return true;
  const n = num(id);
  if (n === null) return false;
  const cats = await listByUser("categories", userId);
  return cats.some((c) => c.id === n);
}

type Cfg = {
  ser: (r: never) => unknown;
  build: (b: Body, partial: boolean, userId: number) => Promise<Built>;
};

const txCfg: Cfg = {
  ser: (r: never) => serTx(r as Parameters<typeof serTx>[0]),
  build: async (b, partial, uid) => {
    const v: Body = {};
    if (!partial || "type" in b) {
      if (b.type !== "expense" && b.type !== "income") return { error: "Invalid type" };
      v.type = b.type;
    }
    if (!partial || "amount" in b) {
      const a = num(b.amount);
      if (a === null || a <= 0 || a > 1e12) return { error: "Enter a valid amount" };
      v.amount = String(a);
    }
    if (!partial || "date" in b) {
      if (!isDate(b.date)) return { error: "Invalid date" };
      v.date = b.date;
    }
    if ("note" in b) v.note = String(b.note ?? "").slice(0, 120);
    if ("categoryId" in b) {
      if (!(await ownsCategory(uid, b.categoryId))) return { error: "Unknown category" };
      v.categoryId = b.categoryId === null ? null : Number(b.categoryId);
    }
    return { values: v };
  },
};

const catCfg: Cfg = {
  ser: (r: never) => serCategory(r as Parameters<typeof serCategory>[0]),
  build: async (b) => {
    const v: Body = {};
    if ("name" in b || true) {
      // create requires name; patch may omit
    }
    if ("name" in b) {
      const n = String(b.name ?? "").trim().slice(0, 32);
      if (!n) return { error: "Name is required" };
      v.name = n;
    }
    if ("icon" in b) v.icon = String(b.icon).slice(0, 32);
    if ("color" in b && /^#[0-9a-fA-F]{6}$/.test(String(b.color))) v.color = String(b.color);
    if ("kind" in b && (b.kind === "expense" || b.kind === "income")) v.kind = b.kind;
    return { values: v };
  },
};

const budgetCfg: Cfg = {
  ser: (r: never) => serBudget(r as Parameters<typeof serBudget>[0]),
  build: async (b, partial, uid) => {
    const v: Body = {};
    if (!partial || "categoryId" in b) {
      if (!(await ownsCategory(uid, b.categoryId)) || b.categoryId == null) return { error: "Pick a category" };
      v.categoryId = Number(b.categoryId);
    }
    if (!partial || "monthlyLimit" in b) {
      const a = num(b.monthlyLimit);
      if (a === null || a <= 0) return { error: "Enter a valid limit" };
      v.monthlyLimit = String(a);
    }
    return { values: v };
  },
};

const goalCfg: Cfg = {
  ser: (r: never) => serGoal(r as Parameters<typeof serGoal>[0]),
  build: async (b) => {
    const v: Body = {};
    if ("name" in b) {
      const n = String(b.name ?? "").trim().slice(0, 48);
      if (!n) return { error: "Name is required" };
      v.name = n;
    }
    if ("target" in b) {
      const a = num(b.target);
      if (a === null || a <= 0) return { error: "Enter a valid target" };
      v.target = String(a);
    }
    if ("saved" in b) {
      const a = num(b.saved);
      if (a === null || a < 0) return { error: "Invalid saved amount" };
      v.saved = String(a);
    }
    if ("icon" in b) v.icon = String(b.icon).slice(0, 32);
    if ("deadline" in b) v.deadline = isDate(b.deadline) ? b.deadline : null;
    return { values: v };
  },
};

const recCfg: Cfg = {
  ser: (r: never) => serRecurring(r as Parameters<typeof serRecurring>[0]),
  build: async (b, partial, uid) => {
    const v: Body = {};
    if (!partial || "name" in b) {
      const n = String(b.name ?? "").trim().slice(0, 48);
      if (!n) return { error: "Name is required" };
      v.name = n;
    }
    if (!partial || "amount" in b) {
      const a = num(b.amount);
      if (a === null || a <= 0) return { error: "Enter a valid amount" };
      v.amount = String(a);
    }
    if ("dayOfMonth" in b) {
      const d = num(b.dayOfMonth);
      if (d === null || d < 1 || d > 31) return { error: "Day must be 1–31" };
      v.dayOfMonth = Math.round(d);
    }
    if ("active" in b) v.active = Boolean(b.active);
    if ("categoryId" in b) {
      if (!(await ownsCategory(uid, b.categoryId))) return { error: "Unknown category" };
      v.categoryId = b.categoryId === null ? null : Number(b.categoryId);
    }
    return { values: v };
  },
};

export const RESOURCES: Record<ResourceName, Cfg & { table: ResourceName; idKey: "id" }> = {
  transactions: { ...txCfg, table: "transactions", idKey: "id" },
  categories: { ...catCfg, table: "categories", idKey: "id" },
  budgets: { ...budgetCfg, table: "budgets", idKey: "id" },
  goals: { ...goalCfg, table: "goals", idKey: "id" },
  recurring: { ...recCfg, table: "recurring", idKey: "id" },
};

export function getResource(name: string) {
  return (RESOURCES as Record<string, (typeof RESOURCES)[ResourceName]>)[name] ?? null;
}

// CRUD against JSON text files.
export async function createItem(resource: ResourceName, userId: number, values: Body) {
  const table = RESOURCES[resource].table;
  if (resource === "transactions") {
    return insertRow(table, {
      userId,
      categoryId: (values.categoryId as number | null) ?? null,
      type: String(values.type ?? "expense"),
      amount: String(values.amount ?? "0"),
      note: String(values.note ?? ""),
      date: String(values.date ?? ""),
      createdAt: new Date().toISOString(),
    } as never) as Promise<never>;
  }
  if (resource === "categories") {
    // Idempotent create: same name + kind returns the existing row instead
    // of a visible duplicate tile.
    const kind = String(values.kind ?? "expense");
    const name = String(values.name ?? "");
    const existing = (await listByUser("categories", userId)).find(
      (c) => c.kind === kind && normalizeCategoryName(c.name) === normalizeCategoryName(name),
    );
    if (existing) return existing as never;
    return insertRow(table, {
      userId,
      name: String(values.name ?? ""),
      icon: String(values.icon ?? "wallet"),
      color: String(values.color ?? "#847dff"),
      kind: String(values.kind ?? "expense"),
    } as never) as Promise<never>;
  }
  if (resource === "budgets") {
    return insertRow(table, {
      userId,
      categoryId: Number(values.categoryId),
      monthlyLimit: String(values.monthlyLimit),
    } as never) as Promise<never>;
  }
  if (resource === "goals") {
    return insertRow(table, {
      userId,
      name: String(values.name ?? ""),
      icon: String(values.icon ?? "piggy-bank"),
      target: String(values.target ?? "0"),
      saved: String(values.saved ?? "0"),
      deadline: (values.deadline as string | null) ?? null,
    } as never) as Promise<never>;
  }
  return insertRow(table, {
    userId,
    categoryId: (values.categoryId as number | null) ?? null,
    name: String(values.name ?? ""),
    amount: String(values.amount ?? "0"),
    dayOfMonth: Number(values.dayOfMonth ?? 1),
    active: Boolean(values.active ?? true),
  } as never) as Promise<never>;
}

export async function updateItem(resource: ResourceName, userId: number, id: number, patch: Body) {
  const table = RESOURCES[resource].table;
  if (resource === "categories" && typeof patch.name === "string") {
    // Renaming onto an existing same-kind name merges instead of duplicating.
    const cats = await listByUser("categories", userId);
    const me = cats.find((c) => c.id === id);
    const kind = typeof patch.kind === "string" ? patch.kind : (me?.kind ?? "expense");
    const clash = cats.find(
      (c) => c.id !== id && c.kind === kind && normalizeCategoryName(c.name) === normalizeCategoryName(patch.name),
    );
    if (clash && me) {
      await mergeCategoryInto(userId, me.id, clash.id);
      if (patch.kind === "income" || patch.kind === "expense") {
        await updateRows("categories", (c) => c.id === clash.id, { kind: patch.kind } as never);
        return { ...clash, kind: patch.kind } as never;
      }
      return clash as never;
    }
  }
  const rows = await updateRows(table, (r: { id: number; userId: number }) => r.id === id && r.userId === userId, patch as never);
  return (rows[0] ?? null) as never;
}

export async function deleteItem(resource: ResourceName, userId: number, id: number) {
  const table = RESOURCES[resource].table;
  await deleteRows(table, (r: { id: number; userId: number }) => r.id === id && r.userId === userId);
  if (resource === "categories") {
    // Null out references, drop budgets for the removed category.
    await updateRows("transactions", (r) => r.userId === userId && r.categoryId === id, { categoryId: null } as never);
    await updateRows("recurring", (r) => r.userId === userId && r.categoryId === id, { categoryId: null } as never);
    await deleteRows("budgets", (r) => r.userId === userId && r.categoryId === id);
  }
}

export async function findBudget(userId: number, categoryId: number) {
  const rows = await listByUser("budgets", userId);
  return rows.find((b) => b.categoryId === categoryId) ?? null;
}

export async function setBudgetLimit(id: number, monthlyLimit: string) {
  const rows = await updateRows("budgets", (b) => b.id === id, { monthlyLimit });
  return rows[0] ?? null;
}
