# AI Square — UI Components + Star Background Kit

Motion-Primitives style UI components (Accordion, BorderTrail, Dock,
ScrollProgress) plus the minimal starfield background, packaged as a
drop-in kit for the **ai-square-v2** project.

## 📦 What's inside

```
src/
├── components/
│   ├── MinimalStarfield.jsx        ← minimal star background (canvas)
│   ├── AccordionVariant.jsx        ← animated FAQ accordion
│   ├── BorderTrailCard1.jsx        ← glowing border-trail loading card
│   ├── AppleStyleDock.jsx          ← Apple-style magnification dock
│   ├── ScrollProgressBasic3.jsx    ← spring scroll-progress demo
│   └── core/
│       ├── accordion.jsx           ← Accordion / Item / Trigger / Content
│       ├── border-trail.jsx        ← BorderTrail
│       ├── dock.jsx                ← Dock / Item / Label / Icon
│       └── scroll-progress.jsx     ← ScrollProgress
├── pages/
│   └── StarUIPlayground.jsx        ← OPTIONAL demo page (all of the above + stars)
└── styles/
    ├── accordion-primitives.css
    ├── border-trail.css
    ├── dock.css
    ├── scroll-progress.css
    └── starfield.css               ← only for OTHER projects (already in ai-square-v2)
```

## 1️⃣ Add to your project (2 minutes)

1. Unzip this file.
2. Copy the `src/components`, `src/styles` (and optionally `src/pages`)
   folders into your project's `src/` folder — **merge/overwrite** when asked.
   (In ai-square-v2 every path matches exactly; nothing else changes.)
3. Install the animation engine (one time):

   ```bash
   npm install motion
   ```

4. Make sure the `@` alias exists in `vite.config.js` (already present in
   ai-square-v2). For other projects add:

   ```js
   import { fileURLToPath, URL } from 'node:url';
   // inside defineConfig:
   resolve: {
     alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
   },
   ```

No Tailwind needed — each component's utility classes are provided by the
small scoped CSS files in `src/styles/`. Existing site styles are untouched.

## 2️⃣ Use the components

```jsx
import { AccordionVariant } from './components/AccordionVariant.jsx';
import { BorderTrailCard1 } from './components/BorderTrailCard1.jsx';
import { AppleStyleDock } from './components/AppleStyleDock.jsx';
import { ScrollProgressBasic3 } from './components/ScrollProgressBasic3.jsx';
import MinimalStarfield from './components/MinimalStarfield.jsx';
```

Preview everything on the star background with the demo page — add a route:

```jsx
import StarUIPlayground from './pages/StarUIPlayground.jsx';
// <Route path="/ui-kit" element={<StarUIPlayground />} />
```

## 3️⃣ Upload to Git (GitHub website — no commands needed)

1. Open your GitHub repository in the browser.
2. **Add file → Upload files**, drag the unzipped `src` folder contents in
   (keep the same folder paths: `src/components/...`, `src/styles/...`).
   Also upload an updated `package.json` + `package-lock.json` if you ran
   `npm install motion` locally — or simply add `"motion"` to dependencies.
3. Commit message suggestion: `feat: add UI kit (accordion, border trail, dock, scroll progress) + star background`
4. Click **Commit changes**.

   *Using git locally instead?*
   ```bash
   git add -A
   git commit -m "feat: add UI kit + star background components"
   git push
   ```

## 4️⃣ Deploy on Render

Nothing special — Render rebuilds automatically on every Git push:

1. Your service (from `render.yaml`) runs `npm install && npm run build`
   then `npm start` — the new components are built in automatically.
2. Watch the deploy log until **Live** ✅.
3. Open your site and check the pages where you placed the components
   (or `/ui-kit` if you added the demo route).

> ⚠️ Reminders: keep `node_modules`, `client_bundle`, `data/` and
> `storage/` OUT of Git (already in `.gitignore`) — Render installs and
> builds everything itself.

## Notes

- `MinimalStarfield` variants: `variant="hero"` (homepage hero) and
  `variant="ambient"` (all public pages, fixed behind content).
- All components respect dark/light via `prefers-color-scheme` and stay
  scoped (`.mp-*`) — they never override your site design.
- `StarUIPlayground.jsx` is a demo only — safe to delete in production.
