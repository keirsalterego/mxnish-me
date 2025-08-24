import type { APIRoute } from "astro";
import { getJournalEntries, getJournalEntry } from "../../utils/journal";

export const GET: APIRoute = async ({ url }) => {
  const searchParams = new URL(url).searchParams;
  const slug = searchParams.get("slug");

  try {
    if (slug) {
      // Get specific journal entry
      const entry = await getJournalEntry(slug);
      if (!entry) {
        return new Response(JSON.stringify({ error: "Journal entry not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify(entry), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      // Get all journal entries
      const entries = await getJournalEntries();
      return new Response(JSON.stringify(entries), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error("Journal API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
