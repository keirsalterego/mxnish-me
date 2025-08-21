import { Client } from "@notionhq/client";
import type { APIRoute } from "astro";

export const get: APIRoute = async () => {
  try {
    // Initialize the Notion client
    const notion = new Client({ auth: import.meta.env.NOTION_API_KEY });
    
    // Get the page ID from environment variables
    const pageId = import.meta.env.NOTION_PAGE_ID;
    
    if (!pageId) {
      throw new Error("NOTION_PAGE_ID is not set in environment variables");
    }
    
    // Fetch the page content
    const page = await notion.pages.retrieve({ page_id: pageId });
    
    // Fetch the page blocks
    const { results } = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100, // Adjust as needed
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        page,
        blocks: results,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching Notion content:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to fetch Notion content",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
