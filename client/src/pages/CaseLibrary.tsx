import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Eye, FileText, Plus, Search } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@shared/appConstants";

const CASE_TYPES = ["all", "image", "video", "scenario"];

export default function CaseLibrary() {
  const { user, isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const casesQuery = trpc.cases.list.useQuery({
    category: selectedCategory !== "all" ? selectedCategory : undefined,
    caseType: selectedType !== "all" ? selectedType : undefined,
  });

  const cases = casesQuery.data ?? [];
  const filteredCases = cases.filter(c =>
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} />
            Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileText size={18} />
                <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>Case Library</h1>
              </div>
              <p className="text-white/80 text-xs mt-0.5">Clinical ultrasound cases for learning</p>
            </div>
            {isAuthenticated && (
              <Link href="/case-library/submit">
                <Button size="sm" variant="outline" className="border-white text-white hover:bg-white/20 gap-1 text-xs">
                  <Plus size={12} /> Submit Case
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search cases..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background"
          />
        </div>

        {/* Category Filter */}
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedCategory === "all" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-primary/10"
              }`}
            >
              All
            </button>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  selectedCategory === key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex gap-2">
          {CASE_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                selectedType === type ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-primary/10"
              }`}
            >
              {type === "all" ? "All Types" : type}
            </button>
          ))}
        </div>

        {/* Cases List */}
        {casesQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCases.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No cases found.</p>
              {isAuthenticated && (
                <p className="text-xs text-muted-foreground mt-1">Be the first to submit a case!</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCases.map(c => (
              <Link key={c.id} href={`/case-library/${c.id}`}>
                <Card className="hover:shadow-md transition-all cursor-pointer hover:border-primary/40">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm mb-1 truncate">{c.title}</div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge className={`text-[10px] ${CATEGORY_COLORS[c.category] ?? "bg-gray-100 text-gray-800"}`}>
                            {CATEGORY_LABELS[c.category] ?? c.category}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">{c.caseType}</Badge>
                        </div>
                        {c.clinicalHistory && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{c.clinicalHistory}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        <Eye size={12} />
                        {c.displayViewCount > 0 ? c.displayViewCount : c.viewCount}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {!isAuthenticated && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Sign in to submit cases and view full details</p>
              <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
