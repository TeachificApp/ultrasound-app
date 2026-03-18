import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Crown, Eye, FileText, Lock } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS, THINKIFIC_LINKS } from "@shared/appConstants";

export default function CaseDetail({ params }: { params: { id: string } }) {
  const { user, isAuthenticated } = useAuth();
  const isPremium = user?.membershipTier === "premium" || user?.role === "admin";
  const caseId = parseInt(params.id, 10);

  const caseQuery = trpc.cases.getById.useQuery({ id: caseId }, { enabled: !isNaN(caseId) });
  const caseData = caseQuery.data;

  if (caseQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="aaus-gradient px-4 py-4 text-white">
          <div className="max-w-3xl mx-auto">
            <Link href="/case-library" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
              <ArrowLeft size={14} /> Case Library
            </Link>
            <div className="h-5 bg-white/20 rounded w-48 animate-pulse" />
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>)}
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="aaus-gradient px-4 py-4 text-white">
          <div className="max-w-3xl mx-auto">
            <Link href="/case-library" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
              <ArrowLeft size={14} /> Case Library
            </Link>
            <h1 className="text-lg font-bold">Case Not Found</h1>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <FileText size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">This case could not be found.</p>
          <Link href="/case-library"><Button className="mt-4" variant="outline">Back to Library</Button></Link>
        </div>
      </div>
    );
  }

  const isLocked = (caseData as any).isPremium && !isPremium;

  return (
    <div className="min-h-screen bg-background">
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/case-library" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} /> Case Library
          </Link>
          <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>{caseData.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`text-[10px] ${CATEGORY_COLORS[caseData.category] ?? "bg-white/20 text-white"}`}>
              {CATEGORY_LABELS[caseData.category] ?? caseData.category}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-white/40 text-white capitalize">{caseData.caseType}</Badge>
            <div className="flex items-center gap-1 text-white/70 text-xs ml-auto">
              <Eye size={11} /> {caseData.displayViewCount > 0 ? caseData.displayViewCount : caseData.viewCount} views
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Locked State */}
        {isLocked && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 flex items-center gap-3">
              <Lock size={18} className="text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-sm">Premium Case</div>
                <div className="text-xs text-muted-foreground">Upgrade to access full case details</div>
              </div>
              <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">
                  <Crown size={12} className="mr-1" /> Upgrade
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Clinical History */}
        {caseData.clinicalHistory && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Clinical History</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-sm text-foreground/80">{caseData.clinicalHistory}</p>
            </CardContent>
          </Card>
        )}

        {/* Image */}
        {caseData.imageUrl && !isLocked && (
          <Card>
            <CardContent className="p-2">
              <img src={caseData.imageUrl} alt={caseData.title} className="w-full rounded-lg object-cover" />
            </CardContent>
          </Card>
        )}

        {/* Video */}
        {caseData.videoUrl && !isLocked && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Video</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <a href={caseData.videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline">
                Watch Video →
              </a>
            </CardContent>
          </Card>
        )}

        {/* Findings */}
        {caseData.findings && !isLocked && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Ultrasound Findings</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-sm text-foreground/80">{caseData.findings}</p>
            </CardContent>
          </Card>
        )}

        {/* Diagnosis */}
        {caseData.diagnosis && !isLocked && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm text-primary">Diagnosis</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-sm font-medium">{caseData.diagnosis}</p>
            </CardContent>
          </Card>
        )}

        {/* Teaching Points */}
        {caseData.teaching && !isLocked && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Teaching Points</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-sm text-foreground/80">{caseData.teaching}</p>
            </CardContent>
          </Card>
        )}

        {/* Submitter */}
        {caseData.submitterName && (
          <div className="text-xs text-muted-foreground text-right">
            Submitted by {caseData.submitterName}
            {caseData.submitterCredentials && `, ${caseData.submitterCredentials}`}
          </div>
        )}

        {!isAuthenticated && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Sign in to access full case details</p>
              <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
