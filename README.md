NiSa AI — Stable Final

Folder structure:
index.html
api/chat.js

Setup:
1. Replace your existing index.html with this one.
2. Replace api/chat.js with this one.
3. Keep GROQ_API_KEY only in Vercel Environment Variables.
4. Redeploy.
5. Test https://YOUR-DOMAIN/api/chat ; it should return ok:true and apiKeyConfigured:true.

Current features kept:
- Text chat / Send
- Enter key send
- Photo upload
- Camera capture / retake / use
- Voice input
- Web toggle (uses Groq Compound for text requests)
- Study tools + timer
- Normal/Simple/Expert/Teacher/Exam/Quiz/Compare modes
- Memory
- Theme
- Export chat
- Copy / Read
- Clear chat

No API key is exposed to the browser.
