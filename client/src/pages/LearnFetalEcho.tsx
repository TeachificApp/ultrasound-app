import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, Crown, ExternalLink, GraduationCap, Heart, Lock } from "lucide-react";
import { THINKIFIC_LINKS } from "@shared/appConstants";

const courses = [
  {
    id: 1,
    title: "Fetal Echocardiography Fundamentals",
    description: "Master the systematic approach to fetal cardiac evaluation including all standard views, normal anatomy, and common congenital heart defects.",
    modules: 8,
    duration: "4 hours",
    level: "Beginner",
    premium: false,
    topics: ["Indications & Timing", "Cardiac Position & Axis", "4-Chamber View", "Outflow Tracts", "Arches & Veins", "Arrhythmias", "Common CHD", "Reporting"],
  },
  {
    id: 2,
    title: "Congenital Heart Defects: Recognition & Classification",
    description: "In-depth review of the most common and complex congenital heart defects detectable by fetal echocardiography.",
    modules: 12,
    duration: "6 hours",
    level: "Intermediate",
    premium: true,
    topics: ["VSD & ASD", "AVSD", "Tetralogy of Fallot", "Transposition", "HLHS", "Coarctation", "Pulmonary Atresia", "Truncus Arteriosus", "TAPVR", "Ebstein Anomaly", "Heterotaxy", "Tumors & Cardiomyopathy"],
  },
  {
    id: 3,
    title: "Fetal Arrhythmia Evaluation",
    description: "Comprehensive guide to identifying and classifying fetal arrhythmias using M-mode and Doppler techniques.",
    modules: 6,
    duration: "3 hours",
    level: "Intermediate",
    premium: true,
    topics: ["Normal Rhythm", "PACs & PVCs", "SVT", "Atrial Flutter", "Heart Block", "Management"],
  },
  {
    id: 4,
    title: "Advanced Fetal Echo: Complex Lesions",
    description: "Advanced cases and complex congenital heart disease for experienced practitioners.",
    modules: 10,
    duration: "5 hours",
    level: "Advanced",
    premium: true,
    topics: ["Heterotaxy Syndromes", "Single Ventricle", "DORV", "Complex TGA", "Interrupted Arch", "Vascular Rings", "Cardiac Tumors", "Hydrops & CHD", "Genetic Syndromes", "Counseling"],
  },
];

const levelColors: Record<string, string> = {
  Beginner: "bg-green-100 text-green-800",
  Intermediate: "bg-blue-100 text-blue-800",
  Advanced: "bg-teal-100 text-teal-800",
};

export default function LearnFetalEcho() {
  const { user, isAuthenticated } = useAuth();
  const isPremium = user?.isPremium === true || user?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <GraduationCap size={18} />
            <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>Learn Fetal Echo</h1>
          </div>
          <p className="text-white/80 text-xs mt-0.5">Structured fetal echocardiography education</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Premium Banner */}
        {!isPremium && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <Crown size={14} className="inline text-yellow-500 mr-1" />
                <span className="font-semibold">Premium</span>
                <span className="text-muted-foreground"> unlocks all courses</span>
              </div>
              <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">Upgrade</Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Intro */}
        <Card className="border-pink-200 bg-pink-50">
          <CardContent className="p-4 flex items-start gap-3">
            <Heart size={20} className="text-pink-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm mb-1">Fetal Echocardiography Education</div>
              <p className="text-xs text-muted-foreground">
                Comprehensive fetal echo curriculum developed by All About Ultrasound™. Courses are hosted on our Thinkific platform for the best learning experience.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Courses */}
        <div className="space-y-3">
          {courses.map(course => {
            const isLocked = course.premium && !isPremium;
            return (
              <Card key={course.id} className={`transition-all ${isLocked ? "opacity-80" : "hover:shadow-md hover:border-primary/40"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isLocked ? "bg-muted" : "bg-pink-100"}`}>
                        {isLocked ? <Lock size={16} className="text-muted-foreground" /> : <BookOpen size={16} className="text-pink-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm leading-tight">{course.title}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${levelColors[course.level]}`}>{course.level}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{course.modules} modules</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{course.duration}</span>
                          {course.premium && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                              <Crown size={8} className="inline mr-0.5" /> Premium
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3">{course.description}</p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {course.topics.map(topic => (
                      <span key={topic} className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
                        {topic}
                      </span>
                    ))}
                  </div>

                  {isLocked ? (
                    <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs w-full gap-1">
                        <Crown size={12} /> Upgrade to Access
                      </Button>
                    </a>
                  ) : (
                    <a href={THINKIFIC_LINKS.freeMembership} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="w-full gap-1 text-xs">
                        <ExternalLink size={12} /> Start Course on Thinkific
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!isAuthenticated && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Sign in to track your course progress</p>
              <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
