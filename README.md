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
- **`cv.yml`** (pushes to `main` that change `cv/`, or run by hand): pushes `cv/resume.yaml` to the private
  [SeanErn/cv-private](https://github.com/SeanErn/cv-private) repo using the `CV_SYNC_KEY` deploy key (write access to
  that repo only). cv-private adds the phone number from its own `CV_PHONE` secret and publishes the full résumé as a
  private release. This repo holds no phone number anywhere, so it can be public.

Latest full résumé:

```sh
gh release download --repo SeanErn/cv-private --pattern '*.pdf'
```

## Layout

- `src/lib/content.ts`: every fact the site shows
- `src/lib/chapters/`: one component per chapter (U1 Speechify … J8 Contact)
- `src/lib/kit/`: shared pieces (scroll pinning, chapter header, copper trace)
- `src/lib/scene/`: the procedural Quest 3 and the QuestNav field
- `src/routes/simple/`: the plain, printable version
- Debug routes: `/lab?c=<chapter>&p=<0..1>` and `/model?yaw=&pitch=&explode=`
