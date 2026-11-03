# Signal Path — Sean Ernstes' portfolio

A one-page portfolio drawn like a PCB fabrication sheet, built with SvelteKit and three.js.

```sh
npm install
npm run dev        # http://localhost:5173
npm run check
npm run build
```

## Résumé

`cv/resume.yaml` is the source for the PDF résumé, rendered with [RenderCV](https://github.com/rendercv/rendercv) 2.8.

```sh
npm run cv         # renders cv/resume.yaml → static/Sean_Ernstes_Resume.pdf
```

The phone number is deliberately not in the YAML, so it never lands in git history or the public PDF.

## CI

- **`ci.yml`** (every push to `main` and every PR): renders a public, phone-free PDF from `cv/resume.yaml`, drops it
  into `static/`, then runs `npm run check` and `npm run build` (artifacts `cv` and `site`).
- **`cv.yml`** (pushes to `main` that change `cv/`, or run by hand): renders the full résumé with the phone number from
  the `CV_PHONE` repo secret and publishes it as a release of this private repo. It refuses to run if the repo is ever
  made public, since releases would become public too.

Latest full résumé:

```sh
gh release download --repo SeanErn/signal-path --pattern '*.pdf'
```

## Layout

- `src/lib/content.ts`: every fact the site shows
- `src/lib/chapters/`: one component per chapter (U1 Speechify … J8 Contact)
- `src/lib/kit/`: shared pieces (scroll pinning, chapter header, copper trace, palettes)
- `src/lib/scene/`: the procedural Quest 3 and the QuestNav field
- `src/routes/simple/`: the plain, printable version
- Debug routes: `/lab?c=<chapter>&p=<0..1>` and `/model?yaw=&pitch=&explode=`
