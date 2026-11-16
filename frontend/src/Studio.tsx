import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  Cloud,
  Cpu,
  Crosshair,
  FileImage,
  FolderClock,
  Layers3,
  LoaderCircle,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Timer,
  UploadCloud,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CloudinarySetup } from "@/components/cloudinary-setup";
import { TestHistory } from "@/components/test-history";
import { ThemeSwitch } from "@/components/theme-switch";
import { useStudio } from "@/hooks/use-studio";
import { cn } from "@/lib/utils";

export default function Studio() {
  const studio = useStudio();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { result, busy, model, history, connected } = studio;
  const models = studio.health?.model_catalog || [
    {
      id: "yolo26n.pt",
      name: "YOLO26 Nano",
      family: "YOLO26",
      description: "Lightweight starting point",
      size: "2.4M",
    },
  ];
  const selected = models.find((item) => item.id === model) || models[0];
  const classes = [
    ...new Set(result?.detections.map((item) => item.class_name) || []),
  ];
  const average = result?.detections.length
    ? (result.detections.reduce((sum, item) => sum + item.confidence, 0) /
        result.detections.length) *
      100
    : null;
  const stats = [
    {
      label: "Objects detected",
      value: result ? result.detections.length : "—",
      icon: Crosshair,
      note: "Across the entire image",
    },
    {
      label: "Unique classes",
      value: result ? classes.length : "—",
      icon: Layers3,
      note: "80 supported COCO classes",
    },
    {
      label: "Avg. confidence",
      value: average !== null ? `${average.toFixed(1)}%` : "—",
      icon: ScanLine,
      note: "Model confidence, not accuracy",
    },
    {
      label: "Prediction time",
      value: result ? `${result.prediction_ms.toFixed(0)} ms` : "—",
      icon: Timer,
      note: result?.cold_start
        ? "Includes first-run warm-up"
        : "Preprocess, inference, postprocess",
    },
  ];
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ScanLine className="size-6" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight">
                YOLO26{" "}
                <span className="font-normal text-muted-foreground">
                  Studio
                </span>
              </div>
              <p className="text-[10px] tracking-[.18em] text-muted-foreground uppercase">
                Computer vision playground
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  connected ? "bg-emerald-500" : "bg-amber-500",
                )}
              />
              {connected ? "Engine online" : "Connecting"}
            </span>
            <ThemeSwitch />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-7 sm:px-8 sm:py-10 lg:px-12">
        <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-primary">
              <span className="h-px w-5 bg-primary" />
              THE IMAGE LAB
            </div>
            <h1 className="text-3xl font-semibold tracking-[-.045em] sm:text-4xl">
              A clearer picture.
              <span className="text-muted-foreground">
                {" "}
                One detection away.
              </span>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Upload an image, choose your model, and look a little closer.
            </p>
          </div>
          <Tabs value={studio.page} onValueChange={studio.setPage}>
            <TabsList className="h-10">
              <TabsTrigger value="playground" className="gap-2">
                <ScanLine className="size-4" />
                Playground
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <FolderClock className="size-4" />
                History{" "}
                <span className="ml-1 text-xs opacity-60">
                  {history.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {studio.error && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <span>{studio.error}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss error"
              onClick={() => studio.setError("")}
            >
              <X />
            </Button>
          </div>
        )}
        {!connected && (
          <p
            role="status"
            className="mb-6 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground"
          >
            Connecting to the local Python server. Run start-dashboard.ps1 if
            this message persists.
          </p>
        )}
        {studio.page === "history" ? (
          <TestHistory
            history={history}
            models={models}
            disabled={!!busy}
            onOpen={(id) => void studio.openResult(id)}
          />
        ) : (
          <>
            <section
              aria-label="Detection summary"
              className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5"
            >
              {stats.map(({ label, value, icon: Icon, note }) => (
                <Card key={label} className="gap-3 py-5 shadow-xs">
                  <CardContent className="px-4 sm:px-5">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{label}</span>
                      <Icon className="size-4 text-primary/75" />
                    </div>
                    <p className="my-3 text-3xl font-semibold tracking-tight tabular-nums">
                      {value}
                    </p>
                    <p className="text-[11px] leading-4 text-muted-foreground">
                      {note}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </section>
            <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)]">
              <Card className="gap-0 overflow-hidden py-0 shadow-xs">
                <CardHeader className="border-b px-5 py-4">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <SlidersHorizontal className="size-4 text-primary" />
                    Configure a test
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-5">
                  <section className="space-y-3">
                    <Label>Source image</Label>
                    <input
                      ref={input}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      aria-label="Choose image file"
                      onChange={(event) => {
                        studio.choose(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                    <button
                      disabled={!!busy}
                      onClick={() => input.current?.click()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        studio.choose(event.dataTransfer.files[0]);
                      }}
                      className={cn(
                        "group flex w-full flex-col items-center rounded-xl border border-dashed p-6 text-center transition-colors outline-none hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                        dragging
                          ? "border-primary bg-primary/10"
                          : "border-input bg-muted/25",
                      )}
                    >
                      <span className="mb-3 flex size-11 items-center justify-center rounded-xl border bg-background text-primary shadow-xs">
                        <UploadCloud className="size-5" />
                      </span>
                      <span className="text-sm font-medium">
                        Drop an image or{" "}
                        <span className="text-primary">browse</span>
                      </span>
                      <span className="mt-2 text-xs text-muted-foreground">
                        JPG, PNG, WebP · up to 10 MB
                      </span>
                    </button>
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-2.5">
                      <img
                        src={studio.preview}
                        alt="Selected image"
                        className="size-10 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {studio.sourceName}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {studio.sample
                            ? "Sample image"
                            : studio.previousId
                              ? "Saved locally · ready to rerun"
                              : "Uploads to Cloudinary"}
                        </p>
                      </div>
                      <Check className="size-4 text-emerald-500" />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-full text-xs text-muted-foreground"
                      disabled={!!busy}
                      onClick={studio.chooseSample}
                    >
                      <FileImage />
                      Use sample image
                    </Button>
                  </section>
                  <section className="space-y-3 border-t pt-5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="model">Detection model</Label>
                      <Badge variant="secondary" className="text-[10px]">
                        {models.length} models
                      </Badge>
                    </div>
                    <Select
                      value={model}
                      onValueChange={studio.setModel}
                      disabled={!!busy}
                    >
                      <SelectTrigger id="model" className="w-full">
                        <SelectValue>{selected.name}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {[...new Set(models.map((item) => item.family))].map(
                          (family) => (
                            <SelectGroup key={family}>
                              <SelectLabel>{family}</SelectLabel>
                              {models
                                .filter((item) => item.family === family)
                                .map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {selected.description}{" "}
                      <span className="text-foreground/65">
                        · {selected.size} parameters
                      </span>
                    </p>
                  </section>
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="confidence">Confidence threshold</Label>
                      <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary tabular-nums">
                        {studio.confidence}%
                      </span>
                    </div>
                    <Slider
                      id="confidence"
                      aria-label="Confidence threshold"
                      min={1}
                      max={95}
                      step={1}
                      value={[studio.confidence]}
                      onValueChange={(values) =>
                        studio.setConfidence(values[0])
                      }
                      disabled={!!busy}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>More detections</span>
                      <span>Higher confidence</span>
                    </div>
                  </section>
                  <section className="space-y-3">
                    <Label htmlFor="resolution">Input resolution</Label>
                    <Select
                      value={String(studio.size)}
                      onValueChange={(value) => studio.setSize(Number(value))}
                      disabled={!!busy}
                    >
                      <SelectTrigger id="resolution" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="320">320 × 320 · Faster</SelectItem>
                        <SelectItem value="640">
                          640 × 640 · Balanced
                        </SelectItem>
                        <SelectItem value="960">
                          960 × 960 · More detail
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </section>
                  <div className="space-y-3 border-t pt-5">
                    <Button
                      className="h-11 w-full shadow-sm"
                      disabled={!!busy || !connected}
                      onClick={() => void studio.run()}
                    >
                      {busy ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <ScanLine />
                      )}
                      {busy || "Run detection"}
                      {!busy && <ArrowRight className="ml-auto" />}
                    </Button>
                    <p className="text-center text-[10px] leading-4 text-muted-foreground">
                      New models download on first use. Larger models may take
                      longer.
                    </p>
                  </div>
                  {studio.health?.cloudinary_configured ? (
                    <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                      <Cloud className="size-3.5" />
                      <span className="size-1 rounded-full bg-emerald-500" />
                      Cloudinary configured
                    </p>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => studio.setSetupOpen(true)}
                    >
                      <Cloud />
                      Connect Cloudinary
                    </Button>
                  )}
                </CardContent>
              </Card>
              <div className="min-w-0 space-y-5">
                <Card className="gap-0 overflow-hidden py-0 shadow-xs">
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">
                        Detection canvas
                      </CardTitle>
                      {result && (
                        <Badge
                          variant="secondary"
                          className="gap-1 text-[10px]"
                        >
                          <Check className="size-3" />
                          Complete
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Tabs value={studio.view} onValueChange={studio.setView}>
                        <TabsList className="h-8">
                          <TabsTrigger value="detection" className="text-xs">
                            Detection
                          </TabsTrigger>
                          <TabsTrigger
                            value="original"
                            className="text-xs"
                            disabled={!result}
                          >
                            Original
                          </TabsTrigger>
                          <TabsTrigger
                            value="compare"
                            className="text-xs"
                            disabled={!result}
                          >
                            Compare
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      {result && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label="Download results"
                            >
                              <ArrowDownToLine />
                              <span className="hidden sm:inline">Export</span>
                              <ChevronDown />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <a
                                href={`/api/predictions/${result.id}/download?kind=image`}
                              >
                                <FileImage />
                                Annotated image
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a
                                href={`/api/predictions/${result.id}/download?kind=json`}
                              >
                                <ArrowDownToLine />
                                Detection JSON
                              </a>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <div className="relative p-3 sm:p-5">
                    <div
                      aria-busy={!!busy}
                      className="canvas-grid relative flex h-[380px] items-center justify-center overflow-hidden rounded-lg border bg-muted/40 sm:h-[440px] xl:h-[480px]"
                    >
                      {studio.view === "compare" && result ? (
                        <div className="grid size-full grid-cols-2 divide-x">
                          {[
                            { src: result.original_url, label: "Original" },
                            { src: result.annotated_url, label: "Detection" },
                          ].map((item) => (
                            <div
                              className="relative flex min-w-0 items-center"
                              key={item.label}
                            >
                              <Badge
                                variant="secondary"
                                className="absolute top-3 left-3 z-10 text-[10px]"
                              >
                                {item.label}
                              </Badge>
                              <img
                                className="size-full object-contain"
                                src={item.src}
                                alt={item.label}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <img
                          className="size-full object-contain"
                          src={
                            result
                              ? studio.view === "original"
                                ? result.original_url
                                : result.annotated_url
                              : studio.preview
                          }
                          alt={
                            result && studio.view === "detection"
                              ? "Annotated detections"
                              : "Image preview"
                          }
                        />
                      )}{" "}
                      {!result && !busy && (
                        <span className="absolute right-3 bottom-3 rounded-lg border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
                          Image ready. Let's see what's inside.
                        </span>
                      )}
                      {busy && (
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm"
                          role="status"
                        >
                          <LoaderCircle className="size-8 animate-spin text-primary" />
                          <p className="text-sm font-medium">{busy}</p>
                          <p className="px-5 text-center text-xs text-muted-foreground">
                            The first run also loads the model. Keep this page
                            open.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="max-w-full truncate">
                        {result
                          ? `${result.width} × ${result.height} px · ${result.filename}`
                          : studio.sourceName}
                      </span>
                      <span>
                        {result
                          ? `${result.total_ms.toFixed(0)} ms total · ${result.device === "cpu" ? "CPU" : "GPU"}`
                          : "Pretrained object detection"}
                      </span>
                    </div>
                  </div>
                </Card>
                <Card className="gap-0 overflow-hidden py-0 shadow-xs">
                  <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
                    <CardTitle className="text-sm">
                      Detected objects{" "}
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        {result?.detections.length || 0}
                      </Badge>
                    </CardTitle>
                    {result && (
                      <span className="text-xs text-muted-foreground">
                        {models.find((item) => item.id === result.model)
                          ?.name || result.model}
                      </span>
                    )}
                  </CardHeader>
                  {result?.detections.length ? (
                    <div className="max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-5">Class</TableHead>
                            <TableHead>Confidence</TableHead>
                            <TableHead className="hidden sm:table-cell">
                              Bounding box (px)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.detections.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="pl-5 font-medium capitalize">
                                {item.class_name}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <span className="w-12 text-xs tabular-nums">
                                    {(item.confidence * 100).toFixed(1)}%
                                  </span>
                                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                    <span
                                      className="block h-full rounded-full bg-primary"
                                      style={{
                                        width: `${item.confidence * 100}%`,
                                      }}
                                    />
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden font-mono text-[11px] text-muted-foreground sm:table-cell">
                                {item.xyxy
                                  .map((value) => Math.round(value))
                                  .join(", ")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3 px-4 py-10 text-sm text-muted-foreground">
                      <Crosshair className="size-5 opacity-60" />
                      <span>
                        {result
                          ? "No objects found. Try a lower threshold."
                          : "Your detected objects will appear here."}
                      </span>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <Cpu className="size-3.5" />
            {studio.health?.environment.hardware || "Local inference engine"}
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            Local inference ? Cloudinary uploads
          </span>
        </footer>
      </main>
      <CloudinarySetup
        open={studio.setupOpen}
        onOpenChange={studio.setSetupOpen}
        onSample={studio.chooseSample}
      />
    </div>
  );
}
