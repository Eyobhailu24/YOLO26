import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Studio from "./Studio";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSwitch } from "@/components/theme-switch";
import { TestHistory } from "@/components/test-history";

const models = [
  {
    id: "yolo26n.pt",
    name: "YOLO26 Nano",
    family: "YOLO26",
    description: "Fast",
    size: "2.4M",
  },
  {
    id: "yolo26x.pt",
    name: "YOLO26 XLarge",
    family: "YOLO26",
    description: "Largest",
    size: "55.7M",
  },
  {
    id: "rtdetr-l.pt",
    name: "RT-DETR Large",
    family: "RT-DETR",
    description: "Transformer",
    size: "32M",
  },
];
const prediction = {
  id: "result-1",
  filename: "bus.jpg",
  created_at: "2026-11-15T20:00:00Z",
  model: "yolo26x.pt",
  confidence: 0.25,
  imgsz: 640,
  width: 810,
  height: 1080,
  original_url: "/original.jpg",
  annotated_url: "/annotated.jpg",
  detections: [
    { class_id: 5, class_name: "bus", confidence: 0.95, xyxy: [1, 2, 3, 4] },
  ],
  prediction_ms: 50,
  total_ms: 70,
  cold_start: false,
  source: "sample",
  device: "cpu",
};

function mockApi() {
  const fetchMock = vi.fn(async (path: string, options?: RequestInit) => {
    let body: unknown;
    if (path === "/api/health")
      body = {
        cloudinary_configured: false,
        environment: { hardware: "Test CPU", device: "cpu" },
        models: models.map((item) => item.id),
        model_catalog: models,
      };
    else if (path === "/api/predictions" && options?.method === "POST")
      body = prediction;
    else if (path === "/api/predictions") body = [];
    else throw new Error("Unexpected request: " + path);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("appearance", () => {
  it("changes light/dark modes and remembers the selection", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeSwitch />
      </ThemeProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: "Change color theme" }),
    );
    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("yolo26-theme")).toBe("dark");
    await user.click(
      screen.getByRole("button", { name: "Change color theme" }),
    );
    await user.click(screen.getByRole("menuitemradio", { name: "Light" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("yolo26-theme")).toBe("light");
  });
  it("restores a saved dark theme on startup", () => {
    localStorage.setItem("yolo26-theme", "dark");
    render(
      <ThemeProvider>
        <ThemeSwitch />
      </ThemeProvider>,
    );
    expect(document.documentElement).toHaveClass("dark");
  });
});

describe("studio interactions", () => {
  it("submits a larger model selection and exposes real exports", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Studio />
      </ThemeProvider>,
    );
    await screen.findByText("3 models");
    await user.click(screen.getByRole("combobox", { name: "Detection model" }));
    await user.click(screen.getByRole("option", { name: "YOLO26 XLarge" }));
    await user.click(screen.getByRole("button", { name: "Run detection" }));
    await screen.findByText("bus", { selector: "td" });
    const request = fetchMock.mock.calls.find(
      ([, options]) => options?.method === "POST",
    );
    expect(JSON.parse(String(request?.[1]?.body)).model).toBe("yolo26x.pt");
    await user.click(screen.getByRole("button", { name: "Download results" }));
    expect(
      screen.getByRole("menuitem", { name: "Annotated image" }),
    ).toHaveAttribute("href", "/api/predictions/result-1/download?kind=image");
    expect(
      screen.getByRole("menuitem", { name: "Detection JSON" }),
    ).toHaveAttribute("href", "/api/predictions/result-1/download?kind=json");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("tab", { name: "Compare" }));
    expect(screen.getByAltText("Original")).toBeInTheDocument();
    expect(screen.getByAltText("Detection")).toBeInTheDocument();
  });
  it("shows Cloudinary setup for an upload when credentials are missing", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Studio />
      </ThemeProvider>,
    );
    await screen.findByText("3 models");
    await user.upload(
      screen.getByLabelText("Choose image file"),
      new File(["image"], "example.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Run detection" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Connect your image library",
    );
    expect(
      fetchMock.mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(false);
    await user.click(
      screen.getByRole("button", { name: "Use the sample image" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
  it("navigates to searchable history", async () => {
    mockApi();
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Studio />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(
      await screen.findByLabelText("Search test history"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your first experiment starts here"),
    ).toBeInTheDocument();
  });
  it("filters saved tests by model and opens the chosen result", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const second = {
      ...prediction,
      id: "result-2",
      filename: "street.png",
      model: "rtdetr-l.pt",
    };
    render(
      <TestHistory
        history={[prediction, second]}
        models={models}
        onOpen={onOpen}
        disabled={false}
      />,
    );
    await user.type(screen.getByLabelText("Search test history"), "RT-DETR");
    expect(screen.queryByText("bus.jpg")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open street.png" }));
    expect(onOpen).toHaveBeenCalledWith("result-2");
  });
});
