import axios from 'axios';
import { load } from 'cheerio';

const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; IAmyTest/1.0)' };

async function ddgSearch(q: string) {
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const r = await axios.get(ddgUrl, { headers, timeout: 10000 });
    const $ = load(r.data);
    const out: string[] = [];
    $('a.result__a').each((_, el: any) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) out.push(href);
    });
    if (out.length === 0) {
      $('a').each((_, el: any) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) out.push(href);
      });
    }
    return out;
  } catch (err: any) {
    console.error('ddgSearch error for', q, err?.message || err);
    return [];
  }
}

async function run() {
  const topic = process.argv.slice(2).join(' ') || 'React hooks';
  console.log('Testing DuckDuckGo search variations for:', topic);
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
  ];
  const siteQueries = priorityDomains.flatMap(d => [`site:${d} ${qBase}`, `site:${d} ${qBase} example`, `site:${d} ${qBase} error`]);
  const queries = [...variations, ...siteQueries];

  const batchSize = 5;
  const seeds = new Set<string>();
  for (let i = 0; i < queries.length && seeds.size < 200; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    console.log('Searching batch:', batch.join(' | '));
    const results = await Promise.allSettled(batch.map(q => ddgSearch(q)));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const u of r.value) {
          if (seeds.size >= 200) break;
          seeds.add(u);
        }
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\nFound seeds count:', seeds.size);
  let i = 0;
  for (const s of seeds) {
    console.log(`${++i}. ${s}`);
    if (i >= 50) break;
  }
}

run().catch((err: any) => { console.error(err); process.exit(1); });
