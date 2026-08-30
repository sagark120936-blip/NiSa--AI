NiSa AI Professional Build

Files:
- index.html
- api/chat.js

Vercel:
1. Replace your existing index.html with this index.html.
2. Replace your existing api/chat.js with this api/chat.js.
3. In Vercel Project Settings -> Environment Variables add:
   GROQ_API_KEY = your Groq API key
4. Redeploy.

Important:
- Never put GROQ_API_KEY inside index.html.
- GET /api/chat returns a small configuration test.
- The app uses qwen/qwen3.6-27b for text + image input.
