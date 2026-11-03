# Signal Path — Sean Ernstes' portfolio

A one-page portfolio drawn like a PCB fabrication sheet, built with SvelteKit and three.js.

```sh
npm install
npm run dev        # http://localhost:5173
npm run check
npm run build
```

## Résumé

`cv/resume.yaml` is the one and only copy of the résumé, rendered with [RenderCV](https://github.com/rendercv/rendercv)
2.8 through `scripts/render-cv.mjs`. Its `phone: ${CV_PHONE}` line is a placeholder: public renders drop it, full
renders fill it in. The number itself is never committed.

```sh
npm run cv         # public PDF → static/Sean_Ernstes_Resume.pdf
npm run cv:full    # full PDF → .cv-out/full/ (needs CV_PHONE in the environment or a gitignored .env)
```

## CI

- **`ci.yml`** (every push to `main` and every PR): renders the public PDF into `static/`, then runs `npm run check` and
  `npm run build`.
- **`cv.yml`** (pushes to `main` that touch the CV, or run by hand): renders the full PDF with the `CV_PHONE` secret and
  saves it as a **draft** release. Drafts are only visible to people with write access, so it stays private on this
  public repo. Never publish one.

Latest full résumé:

```sh
gh release download "$(gh release list --repo SeanErn/portfolio --limit 1 --json tagName --jq '.[0].tagName')" \
  --repo SeanErn/portfolio --pattern '*.pdf'
```

## Layout

- `src/lib/content.ts`: every fact the site shows
- `src/lib/chapters/`: one component per chapter (U1 Speechify … J8 Contact)
- `src/lib/kit/`: shared pieces (scroll pinning, chapter header, copper trace)
- `src/lib/scene/`: the procedural Quest 3 and the QuestNav field
- `src/routes/simple/`: the plain, printable version
- Debug routes: `/lab?c=<chapter>&p=<0..1>` and `/model?yaw=&pitch=&explode=`
