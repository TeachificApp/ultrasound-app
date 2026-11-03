import { FormEvent, useRef, useState } from "react";
import {
  Check,
  Download,
  ExternalLink,
  FilePlus2,
  Loader2,
  MapPinned,
  Pencil,
  Plus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  EXPO_RESOURCE_FILE_ACCEPT,
  expoResourceFileError,
  expoResourceMimeType,
} from "@shared/expoPartnerResourceUpload";

export type ExpoPartnerOperationsSection =
  | "map"
  | "prospectus"
  | "resources"
  | "exhibitors";
type ResourceType =
  | "floor_plan"
  | "booth_setup"
  | "logistics"
  | "document"
  | "other";
type BoothStatus = "available" | "reserved" | "sold" | "unavailable";
type ResourceForm = {
  id?: number;
  title: string;
  description: string;
  resourceUrl: string;
  resourceType: ResourceType;
  isPublished: boolean;
  sortOrder: string;
};
type BoothForm = {
  id?: number;
  boothCode: string;
  zoneLabel: string;
  dimensions: string;
  description: string;
  mapReference: string;
  availabilityStatus: BoothStatus;
  sortOrder: string;
};
const resourceLabels: Record<ResourceType, string> = {
  floor_plan: "Floor plan / event map",
  booth_setup: "Booth setup",
  logistics: "Logistics",
  document: "Document / exhibitor prospectus",
  other: "Other",
};
const emptyBooth = (): BoothForm => ({
  boothCode: "",
  zoneLabel: "",
  dimensions: "",
  description: "",
  mapReference: "",
  availabilityStatus: "available",
  sortOrder: "0",
});
const emptyResource = (resourceType: ResourceType): ResourceForm => ({
  title: "",
  description: "",
  resourceUrl: "",
  resourceType,
  isPublished: false,
  sortOrder: "0",
});
const safeResourceHref = (url: string | null) =>
  url &&
  (/^https?:\/\//i.test(url) ||
    /^\/manus-storage\/[a-zA-Z0-9/_\-.]+$/.test(url))
    ? url
    : undefined;

// Reset unsaved forms when switching events or sections, including any selected file.
export function ExpoPartnerOperationsPanel({
  eventId,
  section,
}: {
  eventId: number;
  section?: ExpoPartnerOperationsSection;
}) {
  return (
    <PartnerOperations
      key={`${eventId}:${section ?? "all"}`}
      eventId={eventId}
      section={section}
    />
  );
}

function PartnerOperations({
  eventId,
  section,
}: {
  eventId: number;
  section?: ExpoPartnerOperationsSection;
}) {
  const utils = trpc.useUtils();
  const operations = trpc.vendorPortal.adminExpoOperations.useQuery({
    eventId,
  });
  const defaultType: ResourceType =
    section === "prospectus" ? "document" : "floor_plan";
  const showResources = section !== "exhibitors";
  const showBooths = !section || section === "exhibitors";
  const fixedType = section === "map" || section === "prospectus";
  const [resource, setResource] = useState<ResourceForm>(() =>
    emptyResource(defaultType)
  );
  const [upload, setUpload] = useState(() => emptyResource(defaultType));
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const resourceForm = useRef<HTMLFormElement>(null);
  const boothForm = useRef<HTMLFormElement>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [booth, setBooth] = useState<BoothForm>(emptyBooth);
  const refresh = async () => {
    await Promise.all([
      utils.vendorPortal.adminExpoOperations.invalidate({ eventId }),
      utils.vendorPortal.myPortal.invalidate(),
    ]);
  };
  const saveResource = trpc.vendorPortal.adminSaveExpoResource.useMutation({
    onSuccess: async () => {
      toast.success("Partner resource saved.");
      setResource(emptyResource(defaultType));
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const uploadResource = trpc.vendorPortal.adminUploadExpoResource.useMutation({
    onSuccess: async () => {
      toast.success("File uploaded as a new resource version.");
      setUpload(emptyResource(defaultType));
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const saveBooth = trpc.vendorPortal.adminSaveExpoBooth.useMutation({
    onSuccess: async () => {
      toast.success("Booth inventory saved.");
      setBooth(emptyBooth());
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const review = trpc.vendorPortal.adminReviewExpoBoothRequest.useMutation({
    onSuccess: async () => {
      toast.success("Booth request updated.");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const submitResource = (event: FormEvent) => {
    event.preventDefault();
    saveResource.mutate({
      eventId,
      ...resource,
      resourceUrl: resource.resourceUrl || undefined,
      description: resource.description || undefined,
      sortOrder: Number(resource.sortOrder),
    });
  };
  const submitBooth = (event: FormEvent) => {
    event.preventDefault();
    saveBooth.mutate({
      eventId,
      ...booth,
      zoneLabel: booth.zoneLabel || undefined,
      dimensions: booth.dimensions || undefined,
      description: booth.description || undefined,
      mapReference: booth.mapReference || undefined,
      sortOrder: Number(booth.sortOrder),
    });
  };
  const submitUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    const mimeType = file.type || expoResourceMimeType(file.name) || "";
    const error = expoResourceFileError(file.name, mimeType, file.size);
    if (error) {
      toast.error(error);
      return;
    }
    setReadingFile(true);
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        const readError = () =>
          reject(
            new Error(
              "The selected file could not be read. Please choose it again."
            )
          );
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : readError();
        reader.onerror = readError;
        reader.onabort = readError;
        reader.readAsDataURL(file);
      });
      // Browsers that omit MIME produce application/octet-stream; use the validated extension's MIME.
      const normalizedDataUri = `data:${mimeType};base64,${dataUri.slice(dataUri.indexOf(",") + 1)}`;
      await uploadResource.mutateAsync({
        eventId,
        title: upload.title,
        description: upload.description || undefined,
        resourceType: upload.resourceType,
        isPublished: upload.isPublished,
        sortOrder: Number(upload.sortOrder),
        fileName: file.name,
        mimeType,
        dataUri: normalizedDataUri,
      });
    } catch (error) {
      // Mutation failures are handled by onError; only show a local file-read error here.
      if (
        error instanceof Error &&
        error.message ===
          "The selected file could not be read. Please choose it again."
      ) {
        toast.error(error.message);
      }
    } finally {
      setReadingFile(false);
    }
  };
  const resources = (operations.data?.resources ?? []).filter(item =>
    section === "map"
      ? item.resourceType === "floor_plan"
      : section === "prospectus"
        ? item.resourceType === "document"
        : true
  );
  const title =
    section === "map"
      ? "Event Map & floor plans"
      : section === "prospectus"
        ? "Exhibitor Prospectus"
        : section === "exhibitors"
          ? "Exhibitor booth operations"
          : section === "resources"
            ? "All partner resources"
            : "Resources, event maps & booth inventory";
  const uploadBusy = readingFile || uploadResource.isPending;

  return (
    <section className="mt-7 rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.18em] text-[#087f8c]">
        Approved vendor & exhibitor tools · Event #{eventId}
      </p>
      <h2 className="mt-1 text-xl font-black text-[#062634]">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        Only published resources and available inventory are shown in the
        approved Partner Portal for published events. Booth requests require
        administrator confirmation.
      </p>
      {section === "prospectus" && (
        <p className="mt-2 text-sm text-slate-600">
          Prospectuses use the existing Document resource type. This view
          includes all document resources for this event; other resource types
          remain in Resources.
        </p>
      )}
      {operations.isLoading ? (
        <div className="flex gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#087f8c]" />
          Loading partner operations…
        </div>
      ) : operations.isError ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {operations.error.message}
          <Button
            variant="outline"
            className="ml-3"
            onClick={() => void operations.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          {showResources && (
            <>
              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <form
                  onSubmit={submitUpload}
                  className="rounded-2xl bg-[#f4fbfc] p-5"
                >
                  <fieldset disabled={uploadBusy}>
                    <div className="flex items-center gap-2">
                      <Upload className="h-5 w-5 text-[#087f8c]" />
                      <h3 className="font-black text-[#062634]">
                        Upload{" "}
                        {section === "map"
                          ? "event map"
                          : section === "prospectus"
                            ? "prospectus"
                            : "partner file"}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Each upload creates a new resource row. Previous files
                      stay intact; edit an older version to unpublish it if
                      needed.
                    </p>
                    <label className="mt-4 grid gap-1 text-sm font-bold">
                      File
                      <input
                        ref={fileInput}
                        required
                        type="file"
                        accept={EXPO_RESOURCE_FILE_ACCEPT}
                        className="input file:mr-3 file:rounded-md file:border-0 file:bg-cyan-100 file:px-3 file:py-1 file:text-[#087f8c]"
                        onChange={e => {
                          const selected = e.target.files?.[0] ?? null;
                          if (selected) {
                            const error = expoResourceFileError(
                              selected.name,
                              selected.type ||
                                expoResourceMimeType(selected.name) ||
                                "",
                              selected.size
                            );
                            if (error) {
                              toast.error(error);
                              e.target.value = "";
                              setFile(null);
                              return;
                            }
                            setUpload(previous => ({
                              ...previous,
                              title:
                                previous.title ||
                                selected.name.replace(/\.[^.]+$/, ""),
                            }));
                          }
                          setFile(selected);
                        }}
                      />
                    </label>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      PDF, Word, Excel, PowerPoint, PNG, JPEG or WebP · Max 10
                      MB · No SVG or macro-enabled files.
                    </p>
                    <label className="mt-3 grid gap-1 text-sm font-bold">
                      Title
                      <input
                        required
                        minLength={2}
                        maxLength={255}
                        value={upload.title}
                        onChange={e =>
                          setUpload(p => ({ ...p, title: e.target.value }))
                        }
                        className="input"
                      />
                    </label>
                    {!fixedType && (
                      <label className="mt-3 grid gap-1 text-sm font-bold">
                        Type
                        <select
                          value={upload.resourceType}
                          onChange={e =>
                            setUpload(p => ({
                              ...p,
                              resourceType: e.target.value as ResourceType,
                            }))
                          }
                          className="input"
                        >
                          {Object.entries(resourceLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    )}
                    <label className="mt-3 grid gap-1 text-sm font-bold">
                      Description
                      <textarea
                        maxLength={8000}
                        value={upload.description}
                        onChange={e =>
                          setUpload(p => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        rows={3}
                        className="input"
                      />
                    </label>
                    <label className="mt-3 grid gap-1 text-sm font-bold">
                      Display order
                      <input
                        type="number"
                        required
                        min={0}
                        max={10000}
                        step={1}
                        value={upload.sortOrder}
                        onChange={e =>
                          setUpload(p => ({ ...p, sortOrder: e.target.value }))
                        }
                        className="input"
                      />
                    </label>
                    <label className="mt-3 flex items-center gap-2 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={upload.isPublished}
                        onChange={e =>
                          setUpload(p => ({
                            ...p,
                            isPublished: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#087f8c]"
                      />
                      Publish to approved partners
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      Unchecked files remain drafts and are not listed in the
                      Partner Portal.
                    </p>
                    <Button
                      disabled={!file || uploadBusy}
                      className="mt-4 bg-[#0c9ba3] hover:bg-[#0a858d]"
                    >
                      {uploadBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {uploadBusy ? "Uploading…" : "Upload new version"}
                    </Button>
                  </fieldset>
                </form>
                <form
                  ref={resourceForm}
                  onSubmit={submitResource}
                  className="rounded-2xl bg-[#f4fbfc] p-5"
                >
                  <fieldset disabled={saveResource.isPending}>
                    <div className="flex items-center gap-2">
                      <FilePlus2 className="h-5 w-5 text-[#087f8c]" />
                      <h3 className="font-black text-[#062634]">
                        {resource.id
                          ? `Edit resource #${resource.id}`
                          : "Add resource link or instructions"}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {resource.id
                        ? "Edit this row’s metadata, link, order or publishing status. To replace a file, upload a new version instead."
                        : "Keep existing map links, external prospectuses and text instructions alongside uploaded files."}
                    </p>
                    <label className="mt-4 grid gap-1 text-sm font-bold">
                      Title
                      <input
                        required
                        minLength={2}
                        maxLength={255}
                        value={resource.title}
                        onChange={e =>
                          setResource(p => ({ ...p, title: e.target.value }))
                        }
                        className="input"
                      />
                    </label>
                    {!fixedType && (
                      <label className="mt-3 grid gap-1 text-sm font-bold">
                        Type
                        <select
                          value={resource.resourceType}
                          onChange={e =>
                            setResource(p => ({
                              ...p,
                              resourceType: e.target.value as ResourceType,
                            }))
                          }
                          className="input"
                        >
                          {Object.entries(resourceLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    )}
                    <label className="mt-3 grid gap-1 text-sm font-bold">
                      Resource URL{" "}
                      <span className="font-normal text-slate-400">
                        (optional for instructions)
                      </span>
                      <input
                        type="text"
                        inputMode="url"
                        maxLength={2048}
                        placeholder="https://…"
                        value={resource.resourceUrl}
                        onChange={e =>
                          setResource(p => ({
                            ...p,
                            resourceUrl: e.target.value,
                          }))
                        }
                        className="input"
                      />
                    </label>
                    <label className="mt-3 grid gap-1 text-sm font-bold">
                      Description
                      <textarea
                        maxLength={8000}
                        value={resource.description}
                        onChange={e =>
                          setResource(p => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        rows={3}
                        className="input"
                      />
                    </label>
                    <label className="mt-3 grid gap-1 text-sm font-bold">
                      Display order
                      <input
                        required
                        type="number"
                        min={0}
                        max={10000}
                        step={1}
                        value={resource.sortOrder}
                        onChange={e =>
                          setResource(p => ({
                            ...p,
                            sortOrder: e.target.value,
                          }))
                        }
                        className="input"
                      />
                    </label>
                    <label className="mt-3 flex items-center gap-2 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={resource.isPublished}
                        onChange={e =>
                          setResource(p => ({
                            ...p,
                            isPublished: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#087f8c]"
                      />
                      Publish to approved partners
                    </label>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        disabled={saveResource.isPending}
                        className="bg-[#0c9ba3] hover:bg-[#0a858d]"
                      >
                        {saveResource.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        {resource.id ? "Save changes" : "Save resource"}
                      </Button>
                      {resource.id && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setResource(emptyResource(defaultType))
                          }
                        >
                          Cancel editing
                        </Button>
                      )}
                    </div>
                  </fieldset>
                </form>
              </div>
              <div className="mt-7">
                <h3 className="font-black text-[#062634]">
                  {section === "map"
                    ? "Event map files & links"
                    : section === "prospectus"
                      ? "Prospectus & document files / links"
                      : "All configured resources"}
                </h3>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {resources.length ? (
                    resources.map(item => {
                      const href = safeResourceHref(item.resourceUrl);
                      return (
                        <article
                          key={item.id}
                          className="rounded-xl border border-slate-100 p-4 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-[#062634]">
                              {item.title}
                            </h4>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${item.isPublished ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                            >
                              {item.isPublished ? "Published" : "Draft"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {resourceLabels[item.resourceType]} · #{item.id} ·
                            Order {item.sortOrder}
                          </p>
                          {item.description && (
                            <p className="mt-2 whitespace-pre-line break-words text-slate-600">
                              {item.description}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {href && (
                              <>
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-bold text-[#087f8c] hover:underline"
                                >
                                  Open resource
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                                <a
                                  href={href}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-bold text-[#087f8c] hover:underline"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Download file
                                </a>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={saveResource.isPending}
                              onClick={() => {
                                setResource({
                                  id: item.id,
                                  title: item.title,
                                  description: item.description ?? "",
                                  resourceUrl: item.resourceUrl ?? "",
                                  resourceType: item.resourceType,
                                  isPublished: item.isPublished,
                                  sortOrder: String(item.sortOrder),
                                });
                                resourceForm.current?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                                resourceForm.current
                                  ?.querySelector("input")
                                  ?.focus({ preventScroll: true });
                              }}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit / publish
                            </Button>
                          </div>
                          {!item.resourceUrl && (
                            <p className="mt-2 text-xs text-slate-500">
                              Text instructions · no linked file
                            </p>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <Empty
                      text={
                        section === "map"
                          ? "No floor plans configured for this event. Upload a map or add an existing map link."
                          : section === "prospectus"
                            ? "No document resources configured. Upload an exhibitor prospectus or add a document link."
                            : "No partner resources configured."
                      }
                    />
                  )}
                </div>
                {resources.some(item => Boolean(item.resourceUrl)) && (
                  <p className="mt-3 text-xs text-slate-500">
                    External storage may open files in a new tab; use the
                    browser’s download option if needed.
                  </p>
                )}
              </div>
            </>
          )}
          {showBooths && (
            <>
              <div className="mt-7 grid gap-6 xl:grid-cols-2">
                <form
                  ref={boothForm}
                  onSubmit={submitBooth}
                  className="rounded-2xl bg-[#f4fbfc] p-5"
                >
                  <fieldset disabled={saveBooth.isPending}>
                    <div className="flex items-center gap-2">
                      <MapPinned className="h-5 w-5 text-[#087f8c]" />
                      <h3 className="font-black text-[#062634]">
                        {booth.id
                          ? `Edit booth ${booth.boothCode}`
                          : "Add booth inventory"}
                      </h3>
                    </div>
                    <label className="mt-4 grid gap-1 text-sm font-bold">
                      Booth code
                      <input
                        required
                        maxLength={100}
                        value={booth.boothCode}
                        onChange={e =>
                          setBooth(p => ({ ...p, boothCode: e.target.value }))
                        }
                        className="input"
                      />
                    </label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm font-bold">
                        Zone
                        <input
                          maxLength={255}
                          value={booth.zoneLabel}
                          onChange={e =>
                            setBooth(p => ({ ...p, zoneLabel: e.target.value }))
                          }
                          className="input"
                        />
                      </label>
                      <label className="grid gap-1 text-sm font-bold">
                        Dimensions
                        <input
                          maxLength={100}
                          value={booth.dimensions}
                          onChange={e =>
                            setBooth(p => ({
                              ...p,
                              dimensions: e.target.value,
                            }))
                          }
                          className="input"
                        />
                      </label>
                    </div>
                    <label className="mt-3 grid gap-1 text-sm font-bold">
                      Map reference
                      <input
                        maxLength={255}
                        value={booth.mapReference}
                        onChange={e =>
                          setBooth(p => ({
                            ...p,
                            mapReference: e.target.value,
                          }))
                        }
                        className="input"
                      />
                    </label>
                    <label className="mt-3 grid gap-1 text-sm font-bold">
                      Description
                      <textarea
                        maxLength={4000}
                        value={booth.description}
                        onChange={e =>
                          setBooth(p => ({ ...p, description: e.target.value }))
                        }
                        rows={3}
                        className="input"
                      />
                    </label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm font-bold">
                        Availability
                        <select
                          value={booth.availabilityStatus}
                          onChange={e =>
                            setBooth(p => ({
                              ...p,
                              availabilityStatus: e.target.value as BoothStatus,
                            }))
                          }
                          className="input"
                        >
                          <option value="available">Available</option>
                          <option value="reserved">Reserved</option>
                          <option value="sold">Sold</option>
                          <option value="unavailable">Unavailable</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm font-bold">
                        Display order
                        <input
                          required
                          type="number"
                          min={0}
                          max={10000}
                          step={1}
                          value={booth.sortOrder}
                          onChange={e =>
                            setBooth(p => ({ ...p, sortOrder: e.target.value }))
                          }
                          className="input"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        disabled={saveBooth.isPending}
                        className="bg-[#0c9ba3] hover:bg-[#0a858d]"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {booth.id ? "Save booth changes" : "Save booth"}
                      </Button>
                      {booth.id && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setBooth(emptyBooth())}
                        >
                          Cancel editing
                        </Button>
                      )}
                    </div>
                  </fieldset>
                </form>
                <div>
                  <h3 className="font-black text-[#062634]">Booth inventory</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Only available booths appear for new partner requests. Do
                    not release a reserved booth without reviewing its existing
                    assignment.
                  </p>
                  <div className="mt-3 space-y-2">
                    {operations.data?.booths.length ? (
                      operations.data.booths.map(item => (
                        <article
                          key={item.id}
                          className="rounded-xl border border-slate-100 p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[#062634]">
                              {item.boothCode}
                            </span>
                            <span className="text-slate-500">
                              {item.zoneLabel || "—"}
                            </span>
                            <span className="rounded-full bg-[#eefbfb] px-2 py-0.5 text-[10px] font-black text-[#087f8c]">
                              {item.availabilityStatus}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {[item.dimensions, item.mapReference]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {item.description && (
                            <p className="mt-2 whitespace-pre-line text-slate-600">
                              {item.description}
                            </p>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            disabled={saveBooth.isPending}
                            onClick={() => {
                              setBooth({
                                id: item.id,
                                boothCode: item.boothCode,
                                zoneLabel: item.zoneLabel ?? "",
                                dimensions: item.dimensions ?? "",
                                description: item.description ?? "",
                                mapReference: item.mapReference ?? "",
                                availabilityStatus: item.availabilityStatus,
                                sortOrder: String(item.sortOrder),
                              });
                              boothForm.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                              boothForm.current
                                ?.querySelector("input")
                                ?.focus({ preventScroll: true });
                            }}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Edit booth
                          </Button>
                        </article>
                      ))
                    ) : (
                      <Empty text="No booth inventory configured." />
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-7">
                <h3 className="font-black text-[#062634]">
                  Exhibitor booth selection requests
                </h3>
                <div className="mt-3 space-y-2">
                  {operations.data?.boothRequests.length ? (
                    operations.data.boothRequests.map(request => (
                      <article
                        key={request.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-bold text-[#062634]">
                            {request.boothCode} · {request.organizationName}
                          </p>
                          <p className="mt-1 break-words text-sm text-slate-600">
                            {request.contactName} · {request.contactEmail}
                          </p>
                          {request.vendorNote && (
                            <p className="mt-1 text-xs text-slate-500">
                              Partner note: {request.vendorNote}
                            </p>
                          )}
                          {request.adminNote && (
                            <p className="mt-1 text-xs text-slate-500">
                              Admin note: {request.adminNote}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold capitalize text-slate-600">
                            {request.status}
                          </span>
                          {request.status === "requested" && (
                            <>
                              <Button
                                size="sm"
                                disabled={review.isPending}
                                onClick={() =>
                                  review.mutate({
                                    requestId: request.id,
                                    status: "confirmed",
                                  })
                                }
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                <Check className="mr-1 h-3.5 w-3.5" />
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                disabled={review.isPending}
                                variant="outline"
                                onClick={() =>
                                  review.mutate({
                                    requestId: request.id,
                                    status: "declined",
                                  })
                                }
                              >
                                Decline
                              </Button>
                            </>
                          )}
                        </div>
                      </article>
                    ))
                  ) : (
                    <Empty text="No booth requests submitted for this event." />
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-cyan-200 p-4 text-sm text-slate-500">
      {text}
    </p>
  );
}
