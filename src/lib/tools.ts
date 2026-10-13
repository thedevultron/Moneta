/** Coach function tools — client-safe (also used by the Live voice session). */

const str = (d: string) => ({ type: "STRING", description: d });
const numP = (d: string) => ({ type: "NUMBER", description: d });

export const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "add_transaction",
        description: "Record a new expense or income for the user.",
        parameters: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING", enum: ["expense", "income"] },
            amount: numP("Positive amount in the user's currency"),
            note: str("Short description, e.g. 'Lunch at Pret'"),
            category_name: str("Existing category name (or a new one to be created)"),
            date: str("YYYY-MM-DD, defaults to today"),
          },
          required: ["type", "amount", "note"],
        },
      },
      {
        name: "update_transaction",
        description: "Edit an existing transaction by id.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: numP("Transaction id from context"),
            amount: numP("New amount"),
            note: str("New note"),
            category_name: str("New category name"),
            date: str("New date YYYY-MM-DD"),
          },
          required: ["id"],
        },
      },
      {
        name: "delete_transaction",
        description: "Delete a transaction by id.",
        parameters: { type: "OBJECT", properties: { id: numP("Transaction id") }, required: ["id"] },
      },
      {
        name: "set_monthly_income",
        description: "Change the user's declared monthly income.",
        parameters: { type: "OBJECT", properties: { amount: numP("Monthly income") }, required: ["amount"] },
      },
      {
        name: "set_budget",
        description: "Create or update the monthly budget limit for a category.",
        parameters: {
          type: "OBJECT",
          properties: { category_name: str("Category name"), monthly_limit: numP("Monthly limit") },
          required: ["category_name", "monthly_limit"],
        },
      },
      {
        name: "remove_budget",
        description: "Remove the budget for a category.",
        parameters: { type: "OBJECT", properties: { category_name: str("Category name") }, required: ["category_name"] },
      },
      {
        name: "create_goal",
        description: "Create a savings goal.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: str("Goal name"),
            target: numP("Target amount"),
            saved: numP("Already saved"),
            deadline: str("YYYY-MM-DD, optional"),
          },
          required: ["name", "target"],
        },
      },
      {
        name: "contribute_to_goal",
        description: "Add money to an existing savings goal.",
        parameters: {
          type: "OBJECT",
          properties: { goal_name: str("Goal name"), amount: numP("Amount to add") },
          required: ["goal_name", "amount"],
        },
      },
      {
        name: "withdraw_from_goal",
        description: "Take money out of a savings goal (reduces saved, never below zero).",
        parameters: {
          type: "OBJECT",
          properties: { goal_name: str("Goal name"), amount: numP("Amount to withdraw") },
          required: ["goal_name", "amount"],
        },
      },
      {
        name: "update_goal",
        description: "Update a savings goal: rename, change target/saved/deadline.",
        parameters: {
          type: "OBJECT",
          properties: {
            goal_name: str("Current goal name"),
            name: str("New goal name (optional)"),
            target: numP("New target amount (optional)"),
            saved: numP("New saved amount (optional)"),
            deadline: str("New deadline YYYY-MM-DD, or empty to clear (optional)"),
          },
          required: ["goal_name"],
        },
      },
      {
        name: "delete_goal",
        description: "Delete a savings goal by name.",
        parameters: { type: "OBJECT", properties: { goal_name: str("Goal name") }, required: ["goal_name"] },
      },
      {
        name: "add_recurring",
        description: "Add a recurring monthly bill or subscription.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: str("Bill name"),
            amount: numP("Monthly amount"),
            day_of_month: numP("Day 1-31"),
            category_name: str("Category name"),
          },
          required: ["name", "amount"],
        },
      },
      {
        name: "update_recurring",
        description: "Update a recurring bill: rename, change amount, due day, or pause/resume.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: str("Current bill name"),
            new_name: str("New bill name (optional)"),
            amount: numP("New monthly amount (optional)"),
            day_of_month: numP("New day 1-31 (optional)"),
            active: { type: "BOOLEAN", description: "false to pause, true to resume (optional)" },
            category_name: str("New category name (optional)"),
          },
          required: ["name"],
        },
      },
      {
        name: "delete_recurring",
        description: "Delete a recurring bill by name.",
        parameters: { type: "OBJECT", properties: { name: str("Bill name") }, required: ["name"] },
      },
      {
        name: "log_recurring_payment",
        description: "Log one payment of a recurring bill as today's expense (e.g. 'I paid Netflix').",
        parameters: {
          type: "OBJECT",
          properties: {
            name: str("Bill name"),
            date: str("Payment date YYYY-MM-DD, defaults to today (optional)"),
          },
          required: ["name"],
        },
      },
      {
        name: "spending_trend",
        description: "Monthly income vs spending for the last N months (reports-style trend).",
        parameters: {
          type: "OBJECT",
          properties: { months: numP("How many months back, 2-12, default 6 (optional)") },
        },
      },
      {
        name: "create_category",
        description: "Create a new spending or income category.",
        parameters: {
          type: "OBJECT",
          properties: { name: str("Category name"), kind: { type: "STRING", enum: ["expense", "income"] } },
          required: ["name"],
        },
      },
      {
        name: "update_category",
        description: "Rename or change a category (kind/icon/color).",
        parameters: {
          type: "OBJECT",
          properties: {
            name: str("Current category name"),
            new_name: str("New category name (optional)"),
            kind: { type: "STRING", enum: ["expense", "income"] },
          },
          required: ["name"],
        },
      },
      {
        name: "delete_category",
        description: "Delete a category by name. Its transactions become Uncategorized.",
        parameters: { type: "OBJECT", properties: { name: str("Category name") }, required: ["name"] },
      },
      {
        name: "load_sample_data",
        description: "Replace ALL the user's data with realistic sample data (seeded categories, 95 days of transactions, budgets, goals, bills). Destructive — confirm with the user first before calling.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "clear_data",
        description: "Delete ALL transactions, budgets, goals and recurring bills (keeps categories and profile). Destructive — confirm with the user first before calling.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "search_transactions",
        description: "Search past transactions by text, type and limit. Use this to pull up data before answering questions.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: str("Text to match in notes or category names (optional)"),
            type: { type: "STRING", enum: ["expense", "income"] },
            limit: numP("Max results, default 15, max 30"),
          },
        },
      },
      {
        name: "spending_by_category",
        description: "Totals per category for a month. Use to answer 'where did my money go' questions.",
        parameters: {
          type: "OBJECT",
          properties: { month: str("YYYY-MM, defaults to the current month") },
        },
      },
      {
        name: "month_totals",
        description: "Income, spending and net for a month.",
        parameters: {
          type: "OBJECT",
          properties: { month: str("YYYY-MM, defaults to the current month") },
        },
      },
      {
        name: "list_budgets",
        description: "All monthly budgets with spent-so-far this month.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "list_goals",
        description: "All savings goals with saved and target amounts.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "list_recurring",
        description: "All recurring bills and subscriptions with amounts and due days.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "navigate_page",
        description: "Navigate the user to an app route. Use when the user asks to go/open/show a page (e.g. 'take me to budgets', 'show my goals').",
        parameters: {
          type: "OBJECT",
          properties: {
            destination: {
              type: "STRING",
              enum: ["/app", "/app/transactions", "/app/budgets", "/app/goals", "/app/recurring", "/app/reports", "/app/categories", "/app/settings", "/app/more", "/app/ai"],
            },
            reason: { type: "STRING", description: "Why navigating (optional)" },
          },
          required: ["destination"],
        },
      },
      {
        name: "update_profile",
        description: "Update user display name, monthly income, currency, or AI coach personality.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "Display name (1-60 chars)" },
            monthly_income: { type: "NUMBER", description: "Declared monthly income (>= 0)" },
            currency: { type: "STRING", description: "Currency code, e.g. USD, GBP, EUR" },
            ai_personality: { type: "STRING", enum: ["calm", "hype", "strict", "playful"] },
          },
        },
      },
    ],
  },
];
