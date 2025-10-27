import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import axios from 'axios';
import { load, CheerioAPI } from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import robotsParser from 'robots-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));


  const port = process.env.PORT || 4000;

  // Simple research endpoint that fetches a summary from Wikipedia (pt -> en fallback)
  app.get('/api/research', async (req, res) => {
    const topic = String(req.query.topic || '').trim();
    if (!topic) {
      return res.status(400).json({ error: 'Missing topic parameter' });
    }

    // Try Wikipedia first (pt -> en)
    const encode = (s: string) => encodeURIComponent(s.replace(/\s+/g, '_'));
    const wikiEndpoints = [
      `https://pt.wikipedia.org/api/rest_v1/page/summary/${encode(topic)}`,
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encode(topic)}`,
    ];

    for (const url of wikiEndpoints) {
      try {
        const r = await axios.get(url, { timeout: 5000 });
        if (r.status === 200 && r.data && (r.data.extract || r.data.extract_html)) {
          return res.json({
            topic: r.data.title || topic,
            summary: r.data.extract || r.data.extract_html || '',
            sources: [url],
          });
        }
      } catch (err) {
        // try next
      }
    }

    // If not found on Wikipedia, perform a DuckDuckGo search and scrape top results
    try {
      const result = await performWebResearch(topic);
      if (result) return res.json(result);
      // If nothing found, return empty but 200 so client can handle gracefully
      return res.json({ topic, summary: '', sources: [], notFound: true });
    } catch (err) {
      console.error('research error:', err);
      return res.status(500).json({ error: 'Internal research error' });
    }
  });

  // Simple in-memory cache and rate limiter
  const researchCache = new Map(); // topic -> { summary, sources, ts }
  const CACHE_TTL = 1000 * 60 * 60 * 24; // 24h
  const lastRequestByIp = new Map();

  async function performWebResearch(topic: string) {
    const now = Date.now();
    // cache
    const cached = researchCache.get(topic.toLowerCase());
    if (cached && now - cached.ts < CACHE_TTL) {
      return { topic, summary: cached.summary, sources: cached.sources };
    }

    // 1) DuckDuckGo HTML search to get top links
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(topic)}`;
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; IAmyBot/1.0; +https://example.local)' };
  const searchResp = await axios.get(ddgUrl, { headers, timeout: 8000 });
  const $: CheerioAPI = load(searchResp.data);
    // DuckDuckGo HTML structure: results in a tags with class 'result__a' or just .result__a
    const links: string[] = [];
    $('a.result__a').each((_: number, el: any) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) links.push(href);
    });
    // fallback: collect first regular links
    if (links.length === 0) {
      $('a').each((_: number, el: any) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) links.push(href);
      });
    }

    // Limit to top 3 unique domains
    const unique: string[] = [];
    for (const u of links) {
      if (unique.length >= 6) break; // grab up to 6 links to increase chances
      if (!unique.includes(u)) unique.push(u);
    }

    const sources: string[] = [];
    const fragments: string[] = [];

    // fetch each link and try to extract main content with Readability
    for (const url of unique.slice(0, 3)) {
      try {
        // Respect robots.txt for the host
        const parsed = new URL(url);
        const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
        try {
          const robotsTxt = await axios.get(robotsUrl, { timeout: 4000 }).then(r => r.data).catch(() => '');
          const robots = robotsParser(robotsUrl, robotsTxt);
          if (!robots.isAllowed(url, 'IAmyBot')) {
            continue;
          }
        } catch {}

        const pageResp = await axios.get(url, { headers, timeout: 8000 });
        const dom = new JSDOM(pageResp.data, { url });
        const reader = new Readability(dom.window.document as any);
        const article = reader.parse();
        if (article && article.textContent) {
          const text = article.textContent.trim();
          const excerpt = text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 10).join('\n\n');
          fragments.push(excerpt.substring(0, 2000));
          sources.push(url);
        }
      } catch (err) {
        // ignore individual failures
      }
    }

    const summary = fragments.join('\n\n---\n\n');
    const result = { topic, summary: summary || '', sources };
    researchCache.set(topic.toLowerCase(), { ...result, ts: Date.now() });
    return result;
  }

    // Handle client-side routing - serve index.html for all other routes
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });

    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}/`);
    });
}

startServer().catch(console.error);
