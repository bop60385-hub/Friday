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

Open `/home/runner/work/Friday/Friday/index.html` in a modern browser (HTTPS or localhost recommended for speech features).

## Future AI API integration

`/home/runner/work/Friday/Friday/app.js` includes an async `queryExternalAI(prompt)` hook for integrating external AI providers later.
