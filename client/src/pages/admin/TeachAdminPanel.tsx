/**
 * TeachAdminPanel.tsx — LMS Admin TEACH tab: manage all instructor & EducatorAssist™ content.
 */

import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Presentation, GraduationCap, Building2, ExternalLink, Shield, Users, LayoutTemplate,
} from "lucide-react";

export default function TeachAdminPanel() {
  const [search, setSearch] = useState("");
  const { data: materials, isLoading } = trpc.teach.adminListAll.useQuery();
  const { data: masters } = trpc.teach.listMasters.useQuery();
  const { data: instructors } = trpc.lmsEnrollmentAdmin.listInstructorsWithDetails.useQuery();
  const { data: educatorOrgs } = trpc.educator.adminGetAllOrgs.useQuery(undefined, {
    retry: false,
  });
  const { data: platformVisible } = trpc.educator.getPlatformVisible.useQuery();

  const filtered = (materials ?? []).filter(
    (m) =>
      !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.owner?.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.owner?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const setVisible = trpc.educator.setPlatformVisible.useMutation({
    onSuccess: (d) => toast.success(d.visible ? "EducatorAssist™ is now public" : "EducatorAssist™ hidden from public"),
    onError: (e) => toast.error(e.message),
  });

  const forceMaster = trpc.teach.adminForceMaster.useMutation({
    onSuccess: () => toast.success("Slide master forced on presentation"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Presentation className="w-4 h-4 text-teal-600" />
            TEACH — Instructor Content
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage presentations and media for LMS Instructors and EducatorAssist™ educators.
            Files are stored in the media repository under <code className="text-teal-600">Teach/user-&#123;id&#125;</code> folders.
          </p>
        </div>
        <Link href="/teach" target="_blank">
          <Button variant="outline" size="sm">
            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open TEACH
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5" /> LMS Instructors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{(instructors ?? []).length}</p>
            <p className="text-xs text-gray-400 mt-1">
              {(instructors ?? []).filter((i: { linkedUser?: unknown }) => i.linkedUser).length} with linked accounts
            </p>
            <Link href="/admin/lms?tab=instructors">
              <Button variant="link" size="sm" className="px-0 h-auto text-teal-600 text-xs mt-2">
                Manage instructor profiles →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> EducatorAssist™ Orgs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{(educatorOrgs ?? []).length}</p>
            <Badge
              variant="outline"
              className={`mt-2 text-xs ${platformVisible?.visible ? "text-green-600 border-green-200" : "text-amber-600 border-amber-200"}`}
            >
              {platformVisible?.visible ? "Public" : "Preview only — not live"}
            </Badge>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={setVisible.isPending}
                onClick={() => setVisible.mutate({ visible: !platformVisible?.visible })}
              >
                {platformVisible?.visible ? "Hide from public" : "Enable public (launch)"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> TEACH Materials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{(materials ?? []).length}</p>
            <p className="text-xs text-gray-400 mt-1">
              {(materials ?? []).filter((m) => m.ownerContext === "lms_instructor").length} LMS ·{" "}
              {(materials ?? []).filter((m) => m.ownerContext === "educator_assist").length} EducatorAssist™
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="py-3 text-xs text-amber-900 flex items-start gap-2">
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>EducatorAssist™</strong> is the separate educator subscription platform (not open for sign-up yet).
            TEACH features are built for both LMS Instructors (live today) and EducatorAssist™ org educators (ready at launch).
            Instructor file access (view / present / edit / manage / copy / download) is granted per-material by owners or admins.
          </div>
        </CardContent>
      </Card>

      {(masters ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-indigo-600" /> Slide Masters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(masters ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-1">
                <span>{m.name}{m.isGlobal ? " (global)" : ""}{m.isDefaultForced ? " · default" : ""}</span>
                <a href={`/teach/master/${m.id}/design`} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline">
                  Design
                </a>
              </div>
            ))}
            <p className="text-xs text-gray-400 pt-2">Admins can force a master onto any presentation from the editor (Force button) or below.</p>
          </CardContent>
        </Card>
      )}

      <div>
        <Input
          placeholder="Search materials by title or owner..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm h-8 text-sm mb-3"
        />
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="bg-white rounded-xl border divide-y">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No TEACH materials yet</p>
            ) : (
              filtered.map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  <Presentation className="w-4 h-4 text-teal-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{m.title}</p>
                    <p className="text-xs text-gray-400">
                      {m.owner?.name ?? "Unknown"} · {m.owner?.email ?? ""} · {m.materialType} · {m.status}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
                    {m.ownerContext.replace("_", " ")}
                  </Badge>
                  {m.materialType === "presentation" && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={`/teach/presentation/${m.id}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-600 hover:underline"
                      >
                        Edit
                      </a>
                      {(masters ?? []).length > 0 && (
                        <select
                          className="text-xs border rounded h-7 px-1"
                          defaultValue=""
                          onChange={(e) => {
                            const masterId = parseInt(e.target.value, 10);
                            if (masterId) {
                              forceMaster.mutate({ materialId: m.id, masterId });
                              e.target.value = "";
                            }
                          }}
                        >
                          <option value="">Force master…</option>
                          {(masters ?? []).map((master) => (
                            <option key={master.id} value={master.id}>{master.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
