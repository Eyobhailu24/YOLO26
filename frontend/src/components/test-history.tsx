import { useState } from "react";
import { ArrowRight, Search, FolderClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Result, ModelInfo } from "@/api";

export function TestHistory({
  history,
  models,
  onOpen,
  disabled,
}: {
  history: Result[];
  models: ModelInfo[];
  onOpen: (id: string) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = history.filter((item) =>
    `${item.filename} ${models.find((model) => model.id === item.model)?.name || item.model}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5">
        <div>
          <h2 className="font-semibold">
            Your experiments{" "}
            <Badge variant="secondary" className="ml-2">
              {history.length}
            </Badge>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Open a result to review it or run the same image with another model.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Search test history"
            placeholder="Search images or models…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      {filtered.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Image</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Objects</TableHead>
              <TableHead>Prediction</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>
                <span className="sr-only">Open test</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="pl-5">
                  <button
                    disabled={disabled}
                    onClick={() => onOpen(item.id)}
                    className="flex items-center gap-3 text-left disabled:opacity-50"
                  >
                    <img
                      src={item.original_url}
                      alt=""
                      className="size-10 rounded-md border object-cover"
                    />
                    <span className="max-w-44 truncate text-sm font-medium">
                      {item.filename}
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {item.width} × {item.height}
                      </span>
                    </span>
                  </button>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {models.find((model) => model.id === item.model)?.name ||
                      item.model}
                  </Badge>
                </TableCell>
                <TableCell>{item.detections.length}</TableCell>
                <TableCell>{item.prediction_ms.toFixed(0)} ms</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={`Open ${item.filename}`}
                    onClick={() => onOpen(item.id)}
                  >
                    <ArrowRight className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col items-center gap-3 px-5 py-20 text-center">
          <FolderClock className="size-8 text-muted-foreground/60" />
          <h3 className="text-sm font-medium">
            {query
              ? "No matching experiments"
              : "Your first experiment starts here"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {query
              ? "Try another image name or model."
              : "Run a detection and your result will appear here."}
          </p>
        </div>
      )}
    </div>
  );
}
