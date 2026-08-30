NiSa AI — ready Vercel project

Files:
- index.html
- api/chat.js

Deploy:
1. Replace the files in your Vercel project with these files.
2. In Vercel Project Settings → Environment Variables, add:
   GROQ_API_KEY = your Groq API key
3. Redeploy.

The API uses Groq's qwen/qwen3.6-27b vision model so image questions work.
Never put the API key inside index.html.
