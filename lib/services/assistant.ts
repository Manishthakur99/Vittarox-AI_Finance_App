import { getCategoryConfig } from "@/constants/categories";
import { assertWithinAiLimit } from "@/lib/services/aiUsage";
import type { Budget } from "@/lib/services/budgets";
import type { Transaction } from "@/lib/services/transactions";
import { formatPrice } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import { format, isSameMonth, subDays } from "date-fns";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/`{1,3}(.*?)`{1,3}/g, "$1")
    .trim();
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delayMs = 1000,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);

    if (res.ok) return res;

    if ((res.status === 503 || res.status === 429) && attempt < retries) {
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt)));
      continue;
    }

    return res;
  }
  throw new Error("Unreachable");
}

function buildContext(
  transactions: Transaction[],
  budget: Budget | null,
  currency: string,
) {
  const now = new Date();
  const cutoff = subDays(now, 30);
  const recent = transactions.filter((tx) => new Date(tx.date) >= cutoff);
  const thisMonthExpense = transactions
    .filter(
      (tx) => tx.type === "EXPENSE" && isSameMonth(new Date(tx.date), now),
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  const spentByCategory: Record<string, number> = {};
  let income = 0;
  let expense = 0;

  recent.forEach((tx) => {
    if (tx.type === "EXPENSE") {
      expense += tx.amount;
      spentByCategory[tx.category] =
        (spentByCategory[tx.category] ?? 0) + tx.amount;
    } else {
      income += tx.amount;
    }
  });

  const categoryLines = Object.entries(spentByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([category, amount]) =>
        `- ${getCategoryConfig(category as any).label}: ${formatPrice(amount, currency)}`,
    )
    .join("\n");

  const budgetLine = budget
    ? `${formatPrice(thisMonthExpense, currency)} spent of ${formatPrice(
        budget.amount,
        currency,
      )} monthly budget`
    : "No monthly budget set.";

  const txLines = recent
    .slice(0, 40)
    .map(
      (tx) =>
        `- ${format(new Date(tx.date), "d MMM yyyy")} | ${tx.type} | ${
          getCategoryConfig(tx.category).label
        } | ${formatPrice(tx.amount, currency)}${
          tx.description ? ` | ${tx.description}` : ""
        }`,
    )
    .join("\n");

  return `Last 30 days summary:
Total income: ${formatPrice(income, currency)}
Total expense: ${formatPrice(expense, currency)}

Spending by category:
${categoryLines || "No expenses recorded."}

Monthly budget:
${budgetLine}

Recent transactions:
${txLines || "No transactions recorded."}`;
}

export async function askAssistant(
  question: string,
  transactions: Transaction[],
  budget: Budget | null,
  currency: string,
  supabase: SupabaseClient,
  userId: string,
) {
  await assertWithinAiLimit(supabase, userId);

  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing EXPO_PUBLIC_GEMINI_API_KEY");

  const context = buildContext(transactions, budget, currency);

  const prompt = `You are a helpful personal finance assistant inside the Vittarox app. Answer the user's question using only the financial data below. Be concise and specific with numbers. 

IMPORTANT: Respond in plain conversational text only. Do NOT use markdown formatting — no asterisks (*), no hashtags/headings (#), no bullet points with symbols. Write in plain sentences or use simple line breaks if listing multiple items.

If the data doesn't answer the question, say so clearly and directly.

${context}

User question: ${question}`;

  const res = await fetchWithRetry(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      res.status === 503
        ? "Assistant is a bit busy right now. Please try again in a moment."
        : `Gemini request failed: ${errText}`,
    );
  }
  

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");

  return stripMarkdown(text);
}