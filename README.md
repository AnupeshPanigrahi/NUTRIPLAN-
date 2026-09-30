# NutriPlan: Smart Food, Better Health

A static website plus one serverless function, ready for Vercel.

- **Login / Register** (demo accounts saved in the browser)
- **Food plan**: day meal plan from age, body, budget and health needs
- **Fortify**: scan a sample food, see nutrition gaps, improve it with sliders
- **Reuse**: leftover meal ideas, money saved, waste avoided
- **Care**: health card, readings with trend chart, medicines, doctor-visit prep
- **Doctor**: sample consultation booking
- **AI helper**: chat and inline AI buttons (needs the API key, see below)
- Accessibility: text size, high contrast, dark mode, read aloud, reduced motion

## Project structure

```
nutriplan/
├─ index.html            page markup
├─ assets/styles.css     all styles and animations
├─ assets/app.js         all front-end logic
├─ api/chat.js           serverless AI endpoint (keeps the API key secret)
├─ favicon.svg
├─ manifest.webmanifest
├─ vercel.json           security headers + function settings
├─ package.json
└─ .env.example
```

No build step and no dependencies.

## Deploy on Vercel (easiest: GitHub)

1. Create a GitHub repository and upload everything in this folder.
2. Go to https://vercel.com/new and import the repository.
3. Framework Preset: **Other**. Leave Build Command and Output Directory empty.
4. Open **Environment Variables** and add `ANTHROPIC_API_KEY` (get one at https://console.anthropic.com).
5. Click **Deploy**. Your site is live at `https://<project>.vercel.app`.

Without the key the website still works. The AI helper then shows built-in tips.

### Deploy with the Vercel CLI instead

```bash
npm i -g vercel
vercel login
vercel            # first deploy (preview)
vercel env add ANTHROPIC_API_KEY
vercel --prod     # production deploy
```

## Run locally

```bash
cp .env.example .env.local     # then put your key inside
vercel dev                     # http://localhost:3000
```

(Opening `index.html` directly also works for the non-AI parts, but `/api/chat` needs `vercel dev`.)

## Settings (environment variables)

| Name | Purpose |
|------|---------|
| `ANTHROPIC_API_KEY` | Required for AI. Never put it in front-end code. |
| `MODEL_QUICK` / `MODEL_DEFAULT` | Change the AI models (defaults are set in `api/chat.js`). |
| `ALLOWED_ORIGIN` | Your site URL. Blocks other websites from using your endpoint. |
| `RATE_LIMIT_PER_MINUTE` | Requests per visitor per minute (default 20). |

## Important notes before real users

- **Accounts are a demo.** Login data is saved only in the visitor's browser and is not secure. For real users, add a real backend and auth (for example Supabase, Firebase or Auth.js) and a database.
- **Health data** (readings, medicines) is stored only on the visitor's device. If you move it to a server you need consent, encryption and compliance with applicable law (for example India's DPDP Act).
- **The AI costs money** per request. Keep `ALLOWED_ORIGIN` and the rate limit set. The built-in rate limit is per server instance; for strict limits use Vercel KV or Upstash.
- **Doctors are sample profiles.** No real booking happens. Connect a real scheduling service before using this for care.
- Nutrition values and costs are approximate and for learning, not medical advice.

## Customise

- Colours: CSS variables at the top of `assets/styles.css`.
- Foods, dishes, recipes, doctors: arrays near the top of each section in `assets/app.js`.
- AI behaviour and safety rules: `systemPrompt()` in `api/chat.js`.
