export type Persona = "student" | "adult";

export type User = {
  id: number;
  email: string;
  name: string;
  currency: string;
  monthlyIncome: number;
  persona: Persona;
  isDemo: boolean;
  aiPersonality: string;
  thinkingLevel: string;
  hasPin: boolean;
  onboardingComplete: boolean;
};

export type Category = {
  id: number;
  name: string;
  icon: string;
  color: string;
  kind: "expense" | "income";
};

export type Tx = {
  id: number;
  categoryId: number | null;
  type: "expense" | "income";
  amount: number;
  note: string;
  date: string; // YYYY-MM-DD
};

export type Budget = { id: number; categoryId: number; monthlyLimit: number };

export type Goal = {
  id: number;
  name: string;
  icon: string;
  target: number;
  saved: number;
  deadline: string | null;
};

export type Recurring = {
  id: number;
  categoryId: number | null;
  name: string;
  amount: number;
  dayOfMonth: number;
  active: boolean;
};

export type AppData = {
  user: User;
  categories: Category[];
  transactions: Tx[];
  budgets: Budget[];
  goals: Goal[];
  recurring: Recurring[];
};

export type ResourceMap = {
  categories: Category;
  transactions: Tx;
  budgets: Budget;
  goals: Goal;
  recurring: Recurring;
};
export type ResourceName = keyof ResourceMap;
