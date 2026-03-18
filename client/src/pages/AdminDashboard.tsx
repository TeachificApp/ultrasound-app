import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, FileText, Music, Plus, Settings, Shield, Users } from "lucide-react";
import { CATEGORY_LABELS } from "@shared/appConstants";

function FlashcardForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ question: "", answer: "", category: "abdominal", difficulty: "basic" });
  const createMutation = trpc.flashcards.create.useMutation({
    onSuccess: () => { toast.success("Flashcard created"); onSuccess(); setForm({ question: "", answer: "", category: "abdominal", difficulty: "basic" }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2"><Plus size={14} /> New Flashcard</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Question</label>
          <textarea value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
            className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background resize-none" rows={2} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Answer</label>
          <textarea value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))}
            className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background resize-none" rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-border rounded-md bg-background">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Difficulty</label>
            <select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-border rounded-md bg-background">
              <option value="basic">Basic</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>
        <Button size="sm" className="w-full"
          onClick={() => createMutation.mutate({ ...form, difficulty: form.difficulty as "basic" | "intermediate" | "advanced" })}
          disabled={createMutation.isPending || !form.question || !form.answer}>
          {createMutation.isPending ? "Creating..." : "Create Flashcard"}
        </Button>
      </CardContent>
    </Card>
  );
}

function SoundByteForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", category: "abdominal", videoUrl: "", duration: "", isPremium: false });
  const createMutation = trpc.soundbytes.create.useMutation({
    onSuccess: () => { toast.success("SoundByte created"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2"><Plus size={14} /> New SoundByte</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Title</label>
          <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Description</label>
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background resize-none" rows={2} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Video URL (YouTube/Vimeo)</label>
          <input type="url" value={form.videoUrl} onChange={e => setForm(p => ({ ...p, videoUrl: e.target.value }))}
            className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background" placeholder="https://" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-border rounded-md bg-background">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Duration</label>
            <input type="text" value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-border rounded-md bg-background" placeholder="e.g. 4:30" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isPremium" checked={form.isPremium} onChange={e => setForm(p => ({ ...p, isPremium: e.target.checked }))} />
          <label htmlFor="isPremium" className="text-xs text-muted-foreground">Premium only</label>
        </div>
        <Button size="sm" className="w-full" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.title}>
          {createMutation.isPending ? "Creating..." : "Create SoundByte"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CaseForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ title: "", clinicalHistory: "", category: "abdominal", caseType: "image", isPremium: false });
  const createMutation = trpc.cases.create.useMutation({
    onSuccess: () => { toast.success("Case created"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2"><Plus size={14} /> New Case</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Title</label>
          <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Clinical History</label>
          <textarea value={form.clinicalHistory} onChange={e => setForm(p => ({ ...p, clinicalHistory: e.target.value }))}
            className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background resize-none" rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-border rounded-md bg-background">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Case Type</label>
            <select value={form.caseType} onChange={e => setForm(p => ({ ...p, caseType: e.target.value }))}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-border rounded-md bg-background">
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="scenario">Scenario</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="casePremium" checked={form.isPremium} onChange={e => setForm(p => ({ ...p, isPremium: e.target.checked }))} />
          <label htmlFor="casePremium" className="text-xs text-muted-foreground">Premium only</label>
        </div>
        <Button size="sm" className="w-full"    onClick={() => createMutation.mutate({ ...form, caseType: form.caseType as "image" | "video" | "scenario" })} disabled={createMutation.isPending || !form.title}>
          {createMutation.isPending ? "Creating..." : "Create Case"}      </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const usersQuery = trpc.admin.users.useQuery();
  const statsQuery = trpc.admin.stats.useQuery();

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="text-center p-8">
          <Shield size={32} className="text-red-500 mx-auto mb-3" />
          <p className="font-semibold">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-1">Admin access required</p>
          <Link href="/"><Button className="mt-4" variant="outline">Go Home</Button></Link>
        </Card>
      </div>
    );
  }

  const stats = statsQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Settings size={18} />
            <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>Admin Dashboard</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Users", value: stats?.users ?? "—", icon: <Users size={16} /> },
            { label: "Flashcards", value: stats?.flashcards ?? "—", icon: <BookOpen size={16} /> },
            { label: "Cases", value: stats?.cases ?? "—", icon: <FileText size={16} /> },
            { label: "SoundBytes", value: stats?.soundbytes ?? "—", icon: <Music size={16} /> },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <div className="text-primary mb-1 flex justify-center">{s.icon}</div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="content">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">Add Content</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4 mt-4">
            <FlashcardForm onSuccess={() => setRefreshKey(k => k + 1)} />
            <SoundByteForm onSuccess={() => setRefreshKey(k => k + 1)} />
            <CaseForm onSuccess={() => setRefreshKey(k => k + 1)} />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2"><Users size={14} /> Users</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {usersQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : (
                  <div className="space-y-2">
                    {(usersQuery.data ?? []).map((u: any) => (
                      <div key={u.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <div className="text-sm font-medium">{u.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{u.email ?? u.openId ?? ""}</div>
                        </div>
                        <div className="flex gap-1.5">
                          <Badge variant={u.role === "admin" ? "default" : "outline"} className="text-[10px]">{u.role}</Badge>
                          {u.membershipTier && (
                            <Badge className="text-[10px] bg-yellow-100 text-yellow-800">{u.membershipTier}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhook" className="mt-4">
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm">Thinkific Webhook Configuration</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Configure your Thinkific webhook to point to the following URL to automatically sync membership status:
                </p>
                <div className="bg-muted rounded-lg p-3">
                  <code className="text-xs break-all">{window.location.origin}/api/webhook/thinkific</code>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p><strong>Events to subscribe:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>enrollment.created</li>
                    <li>enrollment.updated</li>
                    <li>enrollment.expired</li>
                    <li>user.created</li>
                  </ul>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p><strong>Membership Bundle IDs:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Free: ultrasoundassist-app-free-member-access</li>
                    <li>Premium: ultrasoundassist-app-premium-membership</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
