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

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:

1. **Render CV**: renders `cv/resume.yaml` to PDF (artifact `cv`).
2. **Build website**: drops that PDF into `static/`, then runs `npm run check` and `npm run build` (artifact `site`).

To also get a private, full résumé with your phone number (artifact `cv-full-private`, kept 7 days), add a repo
secret named `CV_PHONE`:

```sh
gh secret set CV_PHONE
```

## Layout

- `src/lib/content.ts`: every fact the site shows
- `src/lib/chapters/`: one component per chapter (U1 Speechify … J8 Contact)
- `src/lib/kit/`: shared pieces (scroll pinning, chapter header, copper trace, palettes)
- `src/lib/scene/`: the procedural Quest 3 and the QuestNav field
- `src/routes/simple/`: the plain, printable version
- Debug routes: `/lab?c=<chapter>&p=<0..1>` and `/model?yaw=&pitch=&explode=`
