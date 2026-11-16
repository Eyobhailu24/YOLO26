import { Check, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CloudinarySetup({
  open,
  onOpenChange,
  onSample,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSample: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cloud className="size-5" />
          </div>
          <DialogTitle>Connect your image library</DialogTitle>
          <DialogDescription>
            Cloudinary stores your original uploads. Detection and test history
            run on this computer.
          </DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
          <li>
            Copy <code className="text-foreground">.env.example</code> to{" "}
            <code className="text-foreground">.env</code> in the project folder.
          </li>
          <li>Add your Cloudinary cloud name, API key, and API secret.</li>
          <li>Restart the dashboard, then select your image.</li>
        </ol>
        <pre className="overflow-auto rounded-lg border bg-muted/50 p-4 text-xs leading-6">
          CLOUDINARY_CLOUD_NAME=your_cloud_name{"\n"}
          CLOUDINARY_API_KEY=your_api_key{"\n"}
          CLOUDINARY_API_SECRET=your_api_secret
        </pre>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="size-4 text-emerald-500" />
          Your API secret stays on the Python server.
        </p>
        <Button
          onClick={() => {
            onOpenChange(false);
            onSample();
          }}
        >
          Use the sample image
        </Button>
      </DialogContent>
    </Dialog>
  );
}
