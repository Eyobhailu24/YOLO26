# YOLO26 Vision Studio

React + TypeScript frontend for the local FastAPI detection server, using
shadcn/ui components, Radix UI, and Tailwind CSS v4.

The appearance menu persists Light, Dark, or System in browser localStorage.
System appearance responds to changes in the OS preference. A small head script
applies the saved preference before the page renders.

From the repository root:

```powershell
npm --prefix frontend ci --include=dev
npm --prefix frontend run build
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000. For hot reload, start the API and run
`npm --prefix frontend run dev`; Vite proxies `/api` to the Python server.

Cloudinary credentials belong in the root `.env`, never frontend environment
variables. See the root README for setup, tests, storage, and API behavior.

Run `npm --prefix frontend test` from the repository root for interaction tests.
Owned shadcn component sources live under `src/components/ui/`, with configuration
in `components.json`. `src/Studio.tsx` contains the screen layout, while
`src/hooks/use-studio.ts` owns uploads, predictions, source selection, and history.
