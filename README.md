# Friday

Friday is a voice-first personal intelligence assistant web app designed for GitHub Pages.

## Highlights

- Professional, calm assistant persona focused on concise, actionable guidance
- Web Speech API voice recognition (where supported)
- `speechSynthesis` voice responses
- Daily strategic briefing generation
- Conversation history persistence in local storage
- Opportunity, market, geopolitical, weather, and productivity guidance modes
- Futuristic dark UI with blue/cyan glow accents and a prominent mic button
- Progressive Web App support (manifest + service worker) for install/offline shell caching
- Mobile-first layout and iPhone home-screen compatibility metadata

## Run locally

Open `./index.html` in a modern browser (HTTPS or localhost recommended for speech features).

## AI backend integration

`./js/app.js` posts conversation requests to `https://friday-backend-lake.vercel.app/api/chat` and falls back to local canned replies only if the backend request fails.
