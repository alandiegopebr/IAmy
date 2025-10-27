import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import axios from 'axios';

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

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  // Simple research endpoint that fetches a summary from Wikipedia (pt -> en fallback)
  app.get('/api/research', async (req, res) => {
    const topic = String(req.query.topic || '').trim();
    if (!topic) {
      return res.status(400).json({ error: 'Missing topic parameter' });
    }

    const encode = (s: string) => encodeURIComponent(s.replace(/\s+/g, '_'));
    const endpoints = [
      `https://pt.wikipedia.org/api/rest_v1/page/summary/${encode(topic)}`,
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encode(topic)}`,
    ];

    for (const url of endpoints) {
      try {
        const r = await axios.get(url, { timeout: 5000 });
        if (r.status === 200 && r.data && (r.data.extract || r.data.extract_html)) {
          return res.json({
            topic: r.data.title || topic,
            summary: r.data.extract || r.data.extract_html || '',
            source: url,
          });
        }
      } catch (err) {
        // try next
      }
    }

    return res.status(404).json({ error: 'No summary found for topic' });
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
