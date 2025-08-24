import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface JournalEntry {
  slug: string;
  title: string;
  date: Date;
  description?: string;
  content: string;
  rawContent: string;
}

export interface JournalFrontmatter {
  title: string;
  date: string;
  description?: string;
}

function parseFrontmatter(content: string): { frontmatter: JournalFrontmatter; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    throw new Error('No frontmatter found');
  }

  const [, frontmatterStr, body] = match;
  const frontmatter: any = {};
  
  // Simple YAML parser for our specific needs
  frontmatterStr.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  });

  return {
    frontmatter: frontmatter as JournalFrontmatter,
    body: body.trim()
  };
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  const journalDir = path.join(process.cwd(), 'obsidian', 'journal');
  
  try {
    const files = await fs.readdir(journalDir);
    const markdownFiles = files.filter(file => file.endsWith('.md'));
    
    const entries: JournalEntry[] = [];
    
    for (const file of markdownFiles) {
      try {
        const filePath = path.join(journalDir, file);
        const rawContent = await fs.readFile(filePath, 'utf-8');
        const { frontmatter, body } = parseFrontmatter(rawContent);
        
        const slug = path.basename(file, '.md');
        
        entries.push({
          slug,
          title: frontmatter.title,
          date: new Date(frontmatter.date),
          description: frontmatter.description,
          content: body,
          rawContent
        });
      } catch (error) {
        console.warn(`Failed to parse journal entry ${file}:`, error);
      }
    }
    
    // Sort by date descending
    return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch (error) {
    console.error('Failed to read journal directory:', error);
    return [];
  }
}

export async function getJournalEntry(slug: string): Promise<JournalEntry | null> {
  const entries = await getJournalEntries();
  return entries.find(entry => entry.slug === slug) || null;
}
