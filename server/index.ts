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
    console.log('[research] incoming', req.originalUrl, req.query);
    const topic = String(req.query.topic || '').trim();
    const maxPages = Math.min(200, Number(req.query.maxPages || 40));
    const maxTimeSec = Math.min(300, Number(req.query.maxTime || 90));
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
      const result = await performWebResearch(topic, { maxPages, maxTimeSec });
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

  async function performWebResearch(topic: string, opts: { maxPages?: number; maxTimeSec?: number } = {}) {
    const now = Date.now();
    // cache
    const cached = researchCache.get(topic.toLowerCase());
    if (cached && now - cached.ts < CACHE_TTL) {
      return { topic, summary: cached.summary, sources: cached.sources };
    }
    // deep crawling strategy: perform multiple targeted site-specific searches and then BFS crawl
  const maxPages = opts.maxPages || 80;
  const maxTimeMs = (opts.maxTimeSec || 120) * 1000;
    const startTime = Date.now();

    const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; IAmyBot/1.0; +https://example.local)' };

    // helper to perform a DuckDuckGo HTML search for a query
    async function ddgSearch(q: string) {
      try {
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const r = await axios.get(ddgUrl, { headers, timeout: 10000 });
        const $: CheerioAPI = load(r.data);
        const out: string[] = [];
        $('a[href^="http"]').each((_: number, el: any) => {
          const href = $(el).attr('href');
          if (href && href.startsWith('http') && !href.includes('duckduckgo.com')) out.push(href);
        });
        return Array.from(new Set(out));
      } catch (err) {
        return [];
      }
    }

    // fallback: Bing HTML search parser
    async function bingSearch(q: string) {
      try {
        const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
        const r = await axios.get(bingUrl, { headers, timeout: 10000 });
        const $: CheerioAPI = load(r.data);
        const out: string[] = [];
        // common pattern: results under li.b_algo a
        $('li.b_algo a').each((_: number, el: any) => {
          const href = $(el).attr('href');
          if (href && href.startsWith('http')) out.push(href);
        });
        // fallback: any external anchors
        if (out.length === 0) {
          $('a[href^="http"]').each((_: number, el: any) => {
            const href = $(el).attr('href');
            if (href && href.startsWith('http') && !href.includes('bing.com')) out.push(href);
          });
        }
        return Array.from(new Set(out));
      } catch (err) {
        return [];
      }
    }

    // priority domains to prefer (expanded)
    const priorityDomains = [
      'github.com',
      'stackoverflow.com',
      'developer.mozilla.org',
      'docs.python.org',
      'dev.to',
      'medium.com',
      'npmjs.com',
      'docs.microsoft.com',
      'readthedocs.io',
      'gist.github.com',
      'towardsdatascience.com',
      'wikipedia.org',
      'stackoverflow.blog',
      'blog.rust-lang.org',
      'microsoft.com',
      'aws.amazon.com',
      'cloud.google.com'
    ];

    const seeds = new Set<string>();
    // build richer set of query variations to capture tutorials, errors, examples and stack traces
    const qBase = topic;
    const variations = [
      qBase,
      `"${qBase}"`,
      `${qBase} example`,
      `${qBase} tutorial`,
      `${qBase} how to`,
      `${qBase} error`,
      `${qBase} stack trace`,
      `${qBase} installation`,
      `${qBase} guide`,
    ];

    // add site-specific variations (prioritize technical domains)
    const siteQueries = priorityDomains.flatMap(d => [`site:${d} ${qBase}`, `site:${d} ${qBase} example`, `site:${d} ${qBase} error`]);
    const queries = [...variations, ...siteQueries];

    // run searches in parallel batches to increase coverage quickly but politely
    const batchSize = 6;
    for (let i = 0; i < queries.length && seeds.size < Math.min(240, maxPages * 6); i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      try {
        const results = await Promise.allSettled(batch.map(q => ddgSearch(q)));
        for (const r of results) {
          if (r.status === 'fulfilled') {
            for (const u of r.value) {
              if (seeds.size >= Math.min(240, maxPages * 6)) break;
              seeds.add(u);
            }
          }
        }
      } catch (e) {
        // ignore batch errors and continue
      }
      // small pause between batches
      await new Promise((r) => setTimeout(r, 200));
    }

    // fallback: if seeds are still empty, run a plain ddgSearch on topic
    if (seeds.size === 0) {
      try {
        const f = await ddgSearch(topic);
        for (const u of f) seeds.add(u);
      } catch {}
    }

  const sources: string[] = [];
  const fragments: Array<{ text: string; code: Array<{ code: string; lang?: string }> }> = [];

    // BFS crawl queue
    // prioritize seeds from priority domains first
    const seedArr = Array.from(seeds);
    seedArr.sort((a, b) => {
      const pa = priorityDomains.findIndex(d => a.includes(d));
      const pb = priorityDomains.findIndex(d => b.includes(d));
      if (pa === -1 && pb === -1) return 0;
      if (pa === -1) return 1;
      if (pb === -1) return -1;
      return pa - pb;
    });

    const queue: string[] = seedArr.slice(0, Math.max(40, Math.min(200, seedArr.length)));
    const visited = new Set<string>();
    let pagesFetched = 0;

  // process queue until limits
  while (queue.length > 0 && pagesFetched < maxPages && (Date.now() - startTime) < maxTimeMs) {
      const url = queue.shift()!;
      if (!url || visited.has(url)) continue;
      visited.add(url);
      try {
        // respect robots.txt
        const parsed = new URL(url);
        const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
        try {
          const robotsTxt = await axios.get(robotsUrl, { timeout: 4000 }).then(r => r.data).catch(() => '');
          const robots = robotsParser(robotsUrl, robotsTxt);
          if (!robots.isAllowed(url, 'IAmyBot')) continue;
        } catch {}

        const pageResp = await axios.get(url, { headers, timeout: 12000 });
        const dom = new JSDOM(pageResp.data, { url });
        const reader = new Readability(dom.window.document as any);
        const article = reader.parse();
          if (article && article.textContent) {
          pagesFetched++;
          const text = article.textContent.trim();
          const excerpt = text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 60).join('\n\n');
          // extract code snippets (with language detection)
          const codes: Array<{ code: string; lang?: string }> = [];
          try {
            const doc = dom.window.document;
            const codeEls = Array.from(doc.querySelectorAll('pre code, code[class*="language-"], pre')) as Element[];
            for (const el of codeEls) {
              const txt = el.textContent?.trim();
              if (txt && txt.length > 10) {
                let lang: string | undefined = undefined;
                try {
                  const cls = (el.getAttribute && el.getAttribute('class')) || '';
                  if (cls) {
                    const m = cls.match(/language-([a-z0-9]+)/i) || cls.match(/lang-([a-z0-9]+)/i);
                    if (m) lang = m[1].toLowerCase();
                  }
                } catch (e) {}
                if (!lang) {
                  const sample = txt.slice(0, 200).toLowerCase();
                  if (/^\s*def\s+\w+\s*\(|import\s+\w+|print\(/.test(sample)) lang = 'python';
                  else if (/\b(console\.log|function\s+\w+|=>|const\s+\w+|let\s+\w+|import\s+.+from)/.test(sample)) lang = 'javascript';
                  else if (/#include\s+<|int\s+main\(|std::/.test(sample)) lang = 'cpp';
                  else if (/^\s*class\s+\w+|package\s+|public\s+static\s+void/.test(sample)) lang = 'java';
                  else if (/^\s*<\?php|echo\s+\$/.test(sample)) lang = 'php';
                }
                codes.push({ code: txt.substring(0, 3000), lang });
              }
              if (codes.length >= 12) break;
            }
          } catch (err) {}

          fragments.push({ text: excerpt.substring(0, 5000), code: codes });
          sources.push(url);

          // collect internal links to expand the crawl
          try {
            const anchors = Array.from(dom.window.document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
            for (const a of anchors) {
              try {
                const href = a.getAttribute('href') || '';
                if (!href) continue;
                // skip mailto and javascript
                if (href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
                const u = new URL(href, url).toString();
                if (!visited.has(u) && queue.length < maxPages * 3) {
                  // prefer same-host links
                  if (u.includes(parsed.host) || priorityDomains.some(d => u.includes(d))) {
                    queue.unshift(u);
                  } else {
                    queue.push(u);
                  }
                }
              } catch (err) { /* ignore bad hrefs */ }
            }
          } catch (err) {}
        }
      } catch (err) {
        // ignore failures
      }
      // small delay to avoid hammering targets
      await new Promise((r) => setTimeout(r, 120));
    }

    // compose a simple summary from fragments' text
    const summary = fragments.map(f => f.text).slice(0, 8).join('\n\n---\n\n');
    const result = { topic, summary: summary || '', sources, fragments };
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
