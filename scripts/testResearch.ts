import axios from 'axios';
import { load } from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

async function ddgSearch(q: string) {
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; IAmyTest/1.0)' };
    const r = await axios.get(ddgUrl, { headers, timeout: 10000 });
    const $ = load(r.data);
    const out: string[] = [];
    $('a[href^="http"]').each((_: number, el: any) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http') && !href.includes('duckduckgo.com')) out.push(href);
    });
    // dedupe
    return Array.from(new Set(out));
    return out;
  } catch (err) {
    return [];
  }
}

async function fetchAndExtract(url: string) {
  try {
    const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; IAmyTest/1.0)' };
    const resp = await axios.get(url, { headers, timeout: 12000 });
    const dom = new JSDOM(resp.data, { url });
    const reader = new Readability(dom.window.document as any);
    const article = reader.parse();
    const text = article?.textContent?.trim() || '';
    const excerpt = text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 40).join('\n\n');
    // extract code samples
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
          codes.push({ code: txt.substring(0, 2000), lang });
        }
        if (codes.length >= 6) break;
      }
    } catch (e) {}

    return { url, excerpt: excerpt.substring(0, 3000), codes };
  } catch (err) {
    return null;
  }
}

(async () => {
  const topic = process.argv[2] || 'React hooks';
  console.log('Searching for:', topic);
  const queries = [topic, `${topic} example`, `${topic} tutorial`, `${topic} error`, `${topic} stack trace`];
  const seeds = new Set<string>();
  for (const q of queries) {
    const found = await ddgSearch(q);
    for (const u of found.slice(0, 8)) seeds.add(u);
    if (seeds.size >= 20) break;
    await new Promise(r => setTimeout(r, 200));
  }
  const seedArr = Array.from(seeds).slice(0, 10);
  console.log('Seeds found:', seedArr.length);
  const results = [] as any[];
  for (const s of seedArr) {
    const r = await fetchAndExtract(s);
    if (r) results.push(r);
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(JSON.stringify({ topic, seeds: seedArr, results }, null, 2));
})();
