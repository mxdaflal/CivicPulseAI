"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  CheckCircle2,
  Copy,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  categories,
  reportSchema,
  validImageHeader,
} from "@/lib/report-schema";
import { analyzeReport, type AIAnalysisResult } from "@/lib/ai-analysis";
import { reverseGeocode, formatAddress } from "@/lib/geocode";
import { supabase } from "@/lib/supabase-client";
import { Turnstile } from "@/components/turnstile";
const Map = dynamic(
  () => import("@/components/issue-map").then((m) => m.IssueMap),
  { ssr: false, loading: () => <p>Loading map…</p> },
);
const EMPTY_POINTS: [] = [];
export default function ReportPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [locating, setLocating] = useState(false);
  const [category, setCategory] = useState<string>(""),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [locationText, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null),
    [longitude, setLongitude] = useState<number | null>(null),
    [accuracy, setAccuracy] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null),
    [captchaToken, setCaptcha] = useState("");
  const [saved, setSaved] = useState<{
    tracking_id: string;
    tracking_secret?: string;
  } | null>(null);
  const requestKey = useRef<string>(""),
    photoPath = useRef<string | null>(null),
    inFlight = useRef(false);
  const [error, setError] = useState("");
  const [modelSuggestion, setModelSuggestion] =
      useState<AIAnalysisResult | null>(null),
    [modelBusy, setModelBusy] = useState(false);
  async function requestModel() {
    setModelBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-analyze", {
        body: { title, description, locationText, categoryName: category },
      });
      if (error || !data || typeof data.explanation !== "string")
        throw new Error();
      setModelSuggestion(data);
    } catch {
      setModelSuggestion(
        analyzeReport(title, description, locationText, category),
      );
      toast.info("Model unavailable. Rule-based analysis is shown.");
    } finally {
      setModelBusy(false);
    }
  }
  const point =
    latitude !== null && longitude !== null ? { latitude, longitude } : null;
  async function locate() {
    if (!navigator.geolocation)
      return setError(
        "Your browser does not support location. Enter the address manually.",
      );
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setAccuracy(pos.coords.accuracy);
        try {
          setLocation(
            formatAddress(
              await reverseGeocode(pos.coords.latitude, pos.coords.longitude),
            ),
          );
        } catch {
          setError(
            "Coordinates captured. Address lookup is unavailable; type the street or locality below.",
          );
        } finally {
          setLocating(false);
        }
      },
      (e) => {
        setLocating(false);
        setError(
          e.code === 1
            ? "Location permission denied. You can enter an address manually."
            : e.code === 3
              ? "Location timed out. Try again or enter an address."
              : "Location unavailable. Enter the address manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }
  async function clearPhoto() {
    if (photoPath.current) {
      const { error } = await supabase.storage
        .from("evidence")
        .remove([photoPath.current]);
      if (error) {
        setError("Could not remove the previous upload. Please retry.");
        return false;
      }
      photoPath.current = null;
    }
    setFile(null);
    return true;
  }
  async function chooseFile(f: File | undefined) {
    if (!f) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
      f.size > 5242880 ||
      !validImageHeader(
        new Uint8Array(await f.slice(0, 12).arrayBuffer()),
        f.type,
      )
    ) {
      setError("Choose a JPEG, PNG or WebP image under 5 MB.");
      return;
    }
    if (!(await clearPhoto())) return;
    setError("");
    setFile(f);
  }
  function next() {
    if (
      step === 0 &&
      (!category || title.trim().length < 5 || description.trim().length < 20)
    )
      return setError(
        "Choose a category, enter a title (5–150 characters) and a description (20–2,000 characters).",
      );
    if (step === 1 && locationText.trim().length < 3)
      return setError("Enter a street, locality or nearby public landmark.");
    setError("");
    setStep(step + 1);
  }
  async function submit() {
    if (inFlight.current) return;
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    const input = {
      category,
      title,
      description,
      locationText,
      latitude,
      longitude,
      accuracy,
      photoPath: photoPath.current,
      requestKey: requestKey.current,
      captchaToken,
    };
    const parsed = reportSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (file && user && !photoPath.current) {
        const form = new FormData();
        form.set("file", file);
        const upload = await fetch("/api/evidence", {
          method: "POST",
          body: form,
        });
        const uploaded = await upload.json();
        if (!upload.ok) throw new Error(uploaded.error);
        photoPath.current = uploaded.path;
      }
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, photoPath: photoPath.current }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSaved(result);
      toast.success("Your report was saved.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Submission failed. Please retry.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (saved)
    return (
      <div className="mx-auto max-w-2xl px-4 py-14">
        <Card>
          <CardContent className="p-8 space-y-5">
            <CheckCircle2 className="h-12 w-12 text-teal" />
            <h1 className="text-3xl font-bold">Report received</h1>
            <p>
              Your report is saved and awaiting human review. Keep these private
              tracking details.
            </p>
            <dl className="rounded-xl bg-secondary p-4 space-y-3 break-all">
              <dt>Reference</dt>
              <dd className="font-mono">{saved.tracking_id}</dd>
              {saved.tracking_secret && (
                <>
                  <dt>Private access key — shown once</dt>
                  <dd className="font-mono text-sm">{saved.tracking_secret}</dd>
                </>
              )}
            </dl>
            <Button
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(
                    `${saved.tracking_id}\n${saved.tracking_secret ?? "Sign in as the report owner"}`,
                  )
                  .then(() => toast.success("Tracking details copied"))
              }
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy tracking details
            </Button>
            <p className="text-sm text-muted-foreground">
              The access key grants access to your status summary. Do not share
              it publicly or put it in a URL.
            </p>
            <Button asChild>
              <Link href={`/track?id=${saved.tracking_id}`}>
                Track progress <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  const analysis = category
    ? analyzeReport(title, description, locationText, category)
    : null;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-teal">
        Your observation matters
      </p>
      <h1 className="text-3xl sm:text-4xl font-bold mt-2">
        Report a community issue
      </h1>
      <p className="text-muted-foreground mt-3">
        A few details help reviewers understand the problem. This prototype is
        not an emergency service.
      </p>
      <ol className="flex gap-3 my-8" aria-label="Report progress">
        {["Describe", "Locate & attach", "Review & send"].map((s, i) => (
          <li
            key={s}
            aria-current={step === i ? "step" : undefined}
            className={`flex-1 rounded-xl border p-3 text-sm ${step === i ? "border-primary bg-primary/5 font-bold" : ""}`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <Card>
        <CardContent className="p-5 sm:p-8 space-y-5">
          {step === 0 && (
            <>
              <fieldset>
                <legend className="font-semibold mb-3">
                  What needs attention?
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={category === c}
                      onClick={() => setCategory(c)}
                      className={`rounded-xl border p-4 text-left text-sm min-h-16 ${category === c ? "border-primary bg-primary/5 ring-1 ring-primary" : ""}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <Label htmlFor="title">Short title</Label>
                <Input
                  id="title"
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Blocked drain near the community library"
                />
              </div>
              <div>
                <Label htmlFor="description">What is happening?</Label>
                <Textarea
                  id="description"
                  rows={5}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you observed, when it started, and who may be affected. Avoid private contact details."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {description.length}/2,000 characters
                </p>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={locating}
                onClick={() => void locate()}
              >
                <MapPin className="mr-2 h-4 w-4" />
                {locating ? "Finding location…" : "Use My Current Location"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Location is requested only when you choose it. Confirm the
                address; GPS may be approximate.
              </p>
              {accuracy !== null && (
                <p>Reported GPS accuracy: ±{Math.round(accuracy)} metres</p>
              )}
              <Label htmlFor="location">
                Street / locality / public landmark
              </Label>
              <Input
                id="location"
                value={locationText}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={300}
              />
              <div className="grid grid-cols-2 gap-3">
                {(["latitude", "longitude"] as const).map((axis, i) => (
                  <div key={axis}>
                    <Label htmlFor={axis}>{axis} (optional)</Label>
                    <Input
                      id={axis}
                      type="number"
                      step="any"
                      min={i ? -180 : -90}
                      max={i ? 180 : 90}
                      value={(i ? longitude : latitude) ?? ""}
                      onChange={(e) =>
                        (i ? setLongitude : setLatitude)(
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              <Map
                value={point}
                points={EMPTY_POINTS}
                onChange={(p) => {
                  setLatitude(p.latitude);
                  setLongitude(p.longitude);
                  setAccuracy(null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Click the map or drag the marker to correct the issue location.
                Map tiles are supplied by OpenStreetMap.
              </p>
              {user ? (
                <div>
                  <Label htmlFor="photo">Private photo (optional)</Label>
                  <Input
                    id="photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(e) => void chooseFile(e.target.files?.[0])}
                  />
                  {file && (
                    <p className="text-sm">
                      {file.name}{" "}
                      <button
                        type="button"
                        onClick={() => void clearPhoto()}
                        className="underline"
                      >
                        Remove
                      </button>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG or WebP, up to 5 MB. Visible to you and authorised
                    reviewers. Avoid faces, private documents and identifying
                    details.
                  </p>
                </div>
              ) : (
                <p className="rounded-xl bg-secondary p-4 text-sm">
                  Anonymous reports are text-only.{" "}
                  <Link
                    className="underline"
                    href="/citizen/login?redirect=/report"
                  >
                    Sign in
                  </Link>{" "}
                  to attach private evidence.
                </p>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-xl font-bold">Review your report</h2>
              <dl className="space-y-3">
                <dt className="text-muted-foreground">Category</dt>
                <dd>{category}</dd>
                <dt className="text-muted-foreground">Title</dt>
                <dd>{title}</dd>
                <dt className="text-muted-foreground">Description</dt>
                <dd className="whitespace-pre-wrap">{description}</dd>
                <dt className="text-muted-foreground">Location</dt>
                <dd>{locationText}</dd>
              </dl>
              {analysis && (
                <div className="rounded-xl border p-4 text-sm">
                  <p className="font-semibold">
                    Rule-based priority suggestion: {analysis.priority_score}
                    /100
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    {analysis.explanation}
                  </p>
                  <p className="mt-2">
                    Authorised reviewers make the final decision.
                  </p>
                </div>
              )}
              {user && (
                <div>
                  <Button
                    variant="outline"
                    disabled={modelBusy}
                    onClick={() => void requestModel()}
                  >
                    {modelBusy
                      ? "Requesting…"
                      : "Request model-assisted suggestion"}
                  </Button>
                  {modelSuggestion && (
                    <div
                      role="status"
                      className="text-sm border rounded-xl p-4 mt-3"
                    >
                      <p className="font-semibold">
                        {modelSuggestion.ai_powered
                          ? "Model-assisted suggestion"
                          : "Rule-based fallback"}{" "}
                        · {modelSuggestion.suggested_category}
                      </p>
                      <p className="mt-2">{modelSuggestion.explanation}</p>
                      <p className="mt-2 text-muted-foreground">
                        Optional guidance. The stored rule-based recommendation
                        and reviewer decisions remain auditable.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {!user && <Turnstile onToken={setCaptcha} />}
              <p className="text-sm flex gap-2">
                <ShieldCheck className="h-5 w-5 shrink-0 text-teal" />
                Your detailed report and precise location are private. Only
                redacted, approximate incident summaries are public.
              </p>
            </>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex justify-between gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0 || busy}
              onClick={() => {
                setStep(step - 1);
                setError("");
              }}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            {step < 2 ? (
              <Button type="button" onClick={next}>
                Continue <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={busy || (!user && !captchaToken)}
                onClick={() => void submit()}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {busy ? "Saving report…" : "Submit report"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
