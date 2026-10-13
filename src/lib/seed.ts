import { all, bulkInsert, deleteRows, insertRow, listByUser, updateRows, type DbTransaction } from "@/db/jsondb";
import { getCurrency } from "@/lib/currency";
import { hashPassword } from "@/lib/auth";

export const DEMO_EMAIL = "demo@moneta.app";
export const DEMO_PASSWORD = "demo1234";
// Previous brand address still works for existing demo users.
export const LEGACY_DEMO_EMAIL = "demo@Amir.app";

type CatDef = { key: string; name: string; icon: string; color: string; kind: "expense" | "income" };

const C = {
  iris: "#847dff",
  cyan: "#00b3dd",
  pale: "#d1c9ff",
  deep: "#4b49aa",
  orchid: "#dd90d8",
  peri: "#90b8f0",
  copper: "#cc9166",
  sage: "#8fb8a0",
};

const ADULT_CATS: CatDef[] = [
  { key: "housing", name: "Housing", icon: "home", color: C.deep, kind: "expense" },
  { key: "groceries", name: "Groceries", icon: "shopping-basket", color: C.sage, kind: "expense" },
  { key: "dining", name: "Dining", icon: "utensils", color: C.orchid, kind: "expense" },
  { key: "transport", name: "Transport", icon: "bus", color: C.cyan, kind: "expense" },
  { key: "utilities", name: "Utilities", icon: "zap", color: C.copper, kind: "expense" },
  { key: "shopping", name: "Shopping", icon: "shopping-bag", color: C.iris, kind: "expense" },
  { key: "fun", name: "Entertainment", icon: "film", color: C.peri, kind: "expense" },
  { key: "health", name: "Health", icon: "heart-pulse", color: C.pale, kind: "expense" },
  { key: "travel", name: "Travel", icon: "plane", color: C.cyan, kind: "expense" },
  { key: "salary", name: "Salary", icon: "briefcase", color: C.sage, kind: "income" },
  { key: "freelance", name: "Freelance", icon: "laptop", color: C.iris, kind: "income" },
];

const STUDENT_CATS: CatDef[] = [
  { key: "housing", name: "Rent", icon: "home", color: C.deep, kind: "expense" },
  { key: "tuition", name: "Tuition", icon: "graduation-cap", color: C.iris, kind: "expense" },
  { key: "groceries", name: "Food", icon: "utensils", color: C.sage, kind: "expense" },
  { key: "dining", name: "Coffee", icon: "coffee", color: C.copper, kind: "expense" },
  { key: "transport", name: "Transport", icon: "bus", color: C.cyan, kind: "expense" },
  { key: "books", name: "Books", icon: "book-open", color: C.pale, kind: "expense" },
  { key: "fun", name: "Fun", icon: "film", color: C.orchid, kind: "expense" },
  { key: "shopping", name: "Shopping", icon: "shopping-bag", color: C.peri, kind: "expense" },
  { key: "health", name: "Health", icon: "heart-pulse", color: C.pale, kind: "expense" },
  { key: "utilities", name: "Phone & subs", icon: "smartphone", color: C.copper, kind: "expense" },
  { key: "salary", name: "Allowance", icon: "wallet", color: C.sage, kind: "income" },
  { key: "freelance", name: "Part-time job", icon: "briefcase", color: C.iris, kind: "income" },
];

export const DEFAULT_INCOME_USD = { adult: 5200, student: 1400 };

export async function seedCategories(userId: number, persona: "student" | "adult") {
  const defs = persona === "student" ? STUDENT_CATS : ADULT_CATS;
  const rows = await bulkInsert(
    "categories",
    defs.map((d) => ({ userId, name: d.name, icon: d.icon, color: d.color, kind: d.kind })),
  );
  const map: Record<string, number> = {};
  defs.forEach((d, i) => {
    map[d.key] = rows[i].id;
  });
  return map;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Tpl = { names: string[]; cat: string; min: number; max: number; perWeek: number };

const ADULT_TPL: Tpl[] = [
  { names: ["Whole Foods", "Trader Joe's", "Aldi", "Costco run"], cat: "groceries", min: 22, max: 95, perWeek: 2 },
  { names: ["Blue Bottle coffee", "Flat white", "Morning latte"], cat: "dining", min: 4, max: 7, perWeek: 3 },
  { names: ["Sushi dinner", "Pizza night", "Weekend brunch", "Thai takeaway"], cat: "dining", min: 14, max: 78, perWeek: 1.8 },
  { names: ["Uber", "Metro top-up", "Fuel", "Parking"], cat: "transport", min: 6, max: 48, perWeek: 2 },
  { names: ["Amazon", "Uniqlo", "Apple Store", "IKEA"], cat: "shopping", min: 15, max: 140, perWeek: 0.8 },
  { names: ["Cinema", "Concert tickets", "Steam game", "Bowling"], cat: "fun", min: 10, max: 70, perWeek: 0.7 },
  { names: ["Pharmacy", "Dentist copay", "Physio"], cat: "health", min: 12, max: 90, perWeek: 0.3 },
  { names: ["Weekend flight", "Airbnb deposit"], cat: "travel", min: 120, max: 320, perWeek: 0.06 },
];
const STUDENT_TPL: Tpl[] = [
  { names: ["Campus cafeteria", "Tesco Express", "Lidl", "Noodle bar"], cat: "groceries", min: 5, max: 28, perWeek: 3.2 },
  { names: ["Campus café", "Starbucks", "Iced latte"], cat: "dining", min: 3, max: 6, perWeek: 3.5 },
  { names: ["Bus pass top-up", "Uber", "Train to home"], cat: "transport", min: 3, max: 18, perWeek: 1.5 },
  { names: ["Textbook", "Notebooks & pens", "Course pack"], cat: "books", min: 12, max: 70, perWeek: 0.3 },
  { names: ["Cinema", "Club night", "Steam game", "Pizza with friends"], cat: "fun", min: 8, max: 40, perWeek: 1.1 },
  { names: ["Amazon", "H&M", "Thrift haul"], cat: "shopping", min: 12, max: 60, perWeek: 0.5 },
  { names: ["Pharmacy", "Vitamins"], cat: "health", min: 5, max: 25, perWeek: 0.25 },
];

type Rec = { name: string; cat: string; usd: number; day: number };
const ADULT_REC: Rec[] = [
  { name: "Rent", cat: "housing", usd: 1450, day: 1 },
  { name: "Gym membership", cat: "health", usd: 42, day: 3 },
  { name: "Electric & water", cat: "utilities", usd: 96, day: 8 },
  { name: "Internet", cat: "utilities", usd: 59, day: 12 },
  { name: "Netflix", cat: "fun", usd: 15.49, day: 15 },
  { name: "Spotify", cat: "fun", usd: 11.99, day: 17 },
  { name: "Phone plan", cat: "utilities", usd: 38, day: 20 },
];
const STUDENT_REC: Rec[] = [
  { name: "Rent — shared flat", cat: "housing", usd: 520, day: 1 },
  { name: "Tuition instalment", cat: "tuition", usd: 280, day: 10 },
  { name: "Gym (student)", cat: "health", usd: 20, day: 5 },
  { name: "Phone plan", cat: "utilities", usd: 18, day: 14 },
  { name: "Spotify Student", cat: "utilities", usd: 5.99, day: 17 },
  { name: "Netflix", cat: "utilities", usd: 9.99, day: 21 },
];

const ADULT_BUDGETS: Record<string, number> = {
  housing: 1500, groceries: 450, dining: 260, transport: 160, utilities: 220, shopping: 200, fun: 120, health: 120,
};
const STUDENT_BUDGETS: Record<string, number> = {
  housing: 550, tuition: 300, groceries: 160, dining: 40, transport: 50, books: 60, fun: 70, shopping: 50, utilities: 60,
};

export async function seedSample(
  userId: number,
  persona: "student" | "adult",
  currency: string,
  catMap?: Record<string, number>,
) {
  const cur = getCurrency(currency);
  const rate = cur.rate;
  const conv = (usd: number) => {
    const v = usd * rate;
    if (rate >= 50) return Math.round(v / 5) * 5;
    if (v > 40) return Math.round(v);
    return Math.round(v * 100) / 100;
  };
  const map = catMap ?? (await seedCategories(userId, persona));
  const rand = rng(userId * 7919 + 13);
  const tpls = persona === "student" ? STUDENT_TPL : ADULT_TPL;
  const recs = persona === "student" ? STUDENT_REC : ADULT_REC;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const DAYS = 95;

  const createdAt = new Date().toISOString();
  // Accumulate everything and bulk-insert per table (one counter transaction
  // + one bulk commit each) — hundreds of sequential insertRow calls would
  // each cost 2+ Firestore round-trips and time out.
  const txns: Omit<DbTransaction, "id">[] = [];
  for (let i = DAYS; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = iso(d);
    for (const t of tpls) {
      if (rand() < t.perWeek / 7) {
        const name = t.names[Math.floor(rand() * t.names.length)];
        const usd = t.min + rand() * (t.max - t.min);
        txns.push({
          userId, categoryId: map[t.cat], type: "expense", amount: String(conv(usd)), note: name, date: ds, createdAt,
        });
      }
    }
    for (const r of recs) {
      if (d.getDate() === r.day) {
        txns.push({
          userId, categoryId: map[r.cat], type: "expense", amount: String(conv(r.usd)), note: r.name, date: ds, createdAt,
        });
      }
    }
    if (persona === "adult") {
      if (d.getDate() === 1)
        txns.push({
          userId, categoryId: map.salary, type: "income", amount: String(conv(5200)), note: "Monthly salary", date: ds, createdAt,
        });
      if (d.getDate() === 19 && rand() < 0.8)
        txns.push({
          userId, categoryId: map.freelance, type: "income", amount: String(conv(300 + Math.round(rand() * 400))), note: "Freelance invoice", date: ds, createdAt,
        });
    } else {
      if (d.getDate() === 1)
        txns.push({
          userId, categoryId: map.salary, type: "income", amount: String(conv(800)), note: "Monthly allowance", date: ds, createdAt,
        });
      if (d.getDay() === 5 && d.getDate() % 2 === 0)
        txns.push({
          userId, categoryId: map.freelance, type: "income", amount: String(conv(150 + Math.round(rand() * 80))), note: "Café shift pay", date: ds, createdAt,
        });
    }
  }
  await bulkInsert("transactions", txns);

  const bdg = persona === "student" ? STUDENT_BUDGETS : ADULT_BUDGETS;
  await bulkInsert(
    "budgets",
    Object.entries(bdg)
      .filter(([k]) => map[k] != null)
      .map(([k, usd]) => ({ userId, categoryId: map[k], monthlyLimit: String(conv(usd)) })),
  );

  await bulkInsert(
    "recurring",
    recs.map((r) => ({
      userId, categoryId: map[r.cat], name: r.name, amount: String(conv(r.usd)), dayOfMonth: r.day, active: true,
    })),
  );

  const fut = (months: number) => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + months);
    return iso(d);
  };
  const goalDefs =
    persona === "student"
      ? [
          { name: "Semester abroad", icon: "plane", target: 3000, saved: 920, deadline: fut(8) },
          { name: "New MacBook", icon: "laptop", target: 1200, saved: 410, deadline: fut(5) },
          { name: "Emergency stash", icon: "piggy-bank", target: 1000, saved: 300, deadline: null as string | null },
        ]
      : [
          { name: "Emergency fund", icon: "shield", target: 10000, saved: 4200, deadline: null as string | null },
          { name: "Lisbon trip", icon: "plane", target: 2400, saved: 1380, deadline: fut(4) },
          { name: "New laptop", icon: "laptop", target: 1800, saved: 650, deadline: fut(6) },
        ];
  await bulkInsert(
    "goals",
    goalDefs.map((g) => ({
      userId, name: g.name, icon: g.icon, target: String(conv(g.target)), saved: String(conv(g.saved)), deadline: g.deadline,
    })),
  );
}

export async function clearUserData(userId: number) {
  await deleteRows("transactions", (r) => r.userId === userId);
  await deleteRows("budgets", (r) => r.userId === userId);
  await deleteRows("goals", (r) => r.userId === userId);
  await deleteRows("recurring", (r) => r.userId === userId);
}

export async function createDemoUser(opts: { email: string; persona: "student" | "adult"; currency: string; name?: string }) {
  const cur = getCurrency(opts.currency);
  const income = Math.round(DEFAULT_INCOME_USD[opts.persona] * cur.rate);
  const { createUser } = await import("@/lib/auth");
  const user = await createUser({
    email: opts.email,
    name: opts.name ?? (opts.persona === "student" ? "Maya" : "Alex"),
    passwordHash: hashPassword(DEMO_PASSWORD),
    currency: cur.code,
    monthlyIncome: String(income),
    persona: opts.persona,
    isDemo: true,
    aiPersonality: "calm",
    thinkingLevel: "medium",
    pinHash: null,
    onboardingComplete: true,
  });
  await seedSample(user.id, opts.persona, cur.code);
  return user;
}

/** Remove stale throwaway demo accounts (cascade deletes their data). */
export async function cleanupDemos() {
  const { deleteUserCascade } = await import("@/lib/auth");
  const cutoff = Date.now() - 36 * 3600_000;
  const users = await all("users");
  for (const u of users) {
    if (!u.isDemo || u.email === DEMO_EMAIL || u.email === LEGACY_DEMO_EMAIL) continue;
    if (Date.parse(u.createdAt) < cutoff) await deleteUserCascade(u.id);
  }
}

export async function setUserIncome(userId: number, monthlyIncome: string) {
  await updateRows("users", (u) => u.id === userId, { monthlyIncome });
}
