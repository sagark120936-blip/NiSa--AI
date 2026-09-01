NiSa AI – FIXED NextGen
1. Replace your Vercel project's index.html with this index.html.
2. Replace/create api/chat.js with the included api/chat.js.
3. In Vercel → Settings → Environment Variables, add GROQ_API_KEY.
4. Redeploy.
5. Test GET /api/chat. It should show apiKeyConfigured:true.
6. If the browser still shows an old version, hard refresh / clear site data once.

Fixes included:
- Send button + Enter key robust handling
- All panels use direct event listeners
- AI Camera capture preview fixed
- Camera close/retake/use fixed
- Photo upload/compression fixed
- Voice input
- Study tools + timer
- Settings + memory
- Web toggle UI
- Quick actions
- Hidden reasoning cleanup
- Better image/text prompt behavior