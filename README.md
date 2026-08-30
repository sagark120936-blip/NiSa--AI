NiSa AI FINAL FIX

Replace:
1. index.html
2. api/chat.js

Then deploy/redeploy on Vercel.

Make sure Vercel Environment Variables contains:
GROQ_API_KEY = your Groq API key

Important:
- Do NOT put the API key in index.html.
- The backend uses qwen/qwen3.6-27b for text + images.
- Reasoning is explicitly hidden.
- Old <think> content is removed from browser history on reload.
