# Image Merge PDF

Merge multiple images into a single PDF — free, client-side, no upload required.

**[Try it live](https://domsleee.github.io/image-merge-pdf/)**

## Features

- Drag-and-drop or click to upload PNG/JPG images
- Live PDF preview as you add images
- Drag to reorder, delete individual images
- Optional JPG compression with adjustable quality slider
- Runs entirely in the browser — no server, no data leaves your machine

## Development

```bash
npm install
npx grunt        # build to dist/
npx grunt watch  # rebuild on changes
```

## Tests

```bash
npm install --no-save puppeteer
node test/generate-images.js
node test/browser.js
```

## License

MIT
