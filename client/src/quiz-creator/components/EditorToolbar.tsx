import { useState } from "react";
import { useQuizStore } from "../store/quizStore";
import { downloadQuiz, openQuizFile } from "../lib/quizFile";
import {
  Save, FolderOpen, Play, Settings, Key, ChevronDown,
  FileText, Plus, CloudUpload, Cloud, Globe, FileArchive,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { ScormImportDialog } from "./ScormImportDialog";
import type { QuizFile } from "../types/quiz";

interface Props {
  onPreview: () => void;
  onSettings: () => void;
  onLicense: () => void;
  onCloudOpen?: () => void;
  onPublish?: () => void;
  isPublished?: boolean;
}

export function EditorToolbar({ onPreview, onSettings, onLicense, onCloudOpen, onPublish, isPublished }: Props) {
  const { quiz, isDirty, markSaved, loadQuiz, newQuiz, license } = useQuizStore();
  const [saving, setSaving] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { user } = useAuth();
  const saveToCloud = trpc.quizMaker.saveQuiz.useMutation();
  const utils = trpc.useUtils();

  const handleCloudSave = async () => {
    setCloudSaving(true);
    setFileMenuOpen(false);
    try {
      const result = await saveToCloud.mutateAsync({
        title: quiz.meta.title,
        description: quiz.meta.description || "",
        questionsJson: JSON.stringify(quiz.questions),
        settingsJson: JSON.stringify(quiz.meta),
        quizId: (quiz.meta as any).cloudId || undefined,
      });
      useQuizStore.getState().updateMeta({ cloudId: result.id } as any);
      utils.quizMaker.listQuizzes.invalidate();
      markSaved(quiz.meta.title + " (cloud)");
    } catch (err) {
      alert("Cloud save failed: " + (err as Error).message);
    } finally {
      setCloudSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const filename = await downloadQuiz(quiz, license.licenseKey);
      markSaved(filename);
    } catch (e) {
      alert("Failed to save: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".quiz";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const loaded = await openQuizFile(file, license.licenseKey);
        loadQuiz(loaded, file.name);
      } catch (err) {
        alert("Could not open file: " + (err as Error).message);
      }
    };
    input.click();
    setFileMenuOpen(false);
  };

  const handleOpenImportDialog = () => {
    setFileMenuOpen(false);
    setImportDialogOpen(true);
  };

  const handleImportComplete = (quiz: QuizFile, fileName: string) => {
    loadQuiz(quiz, fileName);
  };

  const tierBadge = {
    free: { label: "Free", color: "bg-gray-100 text-gray-600" },
    pro: { label: "Pro", color: "bg-teal-100 text-teal-700" },
    enterprise: { label: "Enterprise", color: "bg-purple-100 text-purple-700" },
  }[license.tier];

  return (
    <>
      <header
        className="h-14 flex items-center px-4 gap-3 border-b border-white/10 shrink-0"
        style={{ background: "linear-gradient(135deg, #0d1f3c 0%, #1a3356 100%)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#24abbc" }}>
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-sm">Teach</span>
            <span className="font-bold text-sm" style={{ color: "#24abbc" }}>ific</span>
            <span className="text-white/60 text-xs ml-1">QuizMaker</span>
          </div>
        </div>

        {/* Quiz title */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={quiz.meta.title}
            onChange={(e) => useQuizStore.getState().updateMeta({ title: e.target.value })}
            className="bg-transparent text-white text-sm font-medium placeholder-white/40 border-none outline-none w-full max-w-xs"
            placeholder="Untitled Quiz"
          />
          {isDirty && <span className="text-white/40 text-xs ml-2">● unsaved</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* File menu */}
          <div className="relative">
            <button
              onClick={() => setFileMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm transition-colors"
            >
              File
              <ChevronDown className="w-3 h-3" />
            </button>
            {fileMenuOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-20 w-52">
                <button
                  onClick={() => { newQuiz(); setFileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                >
                  <Plus className="w-4 h-4 text-gray-400" /> New Quiz
                </button>
                <button
                  onClick={handleOpen}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                >
                  <FolderOpen className="w-4 h-4 text-gray-400" /> Open .quiz
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={handleOpenImportDialog}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                >
                  <FileArchive className="w-4 h-4 text-teal-500" /> Import SCORM / iSpring…
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => { handleSave(); setFileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                >
                  <Save className="w-4 h-4 text-gray-400" /> Save as .quiz
                </button>
                {user && (
                  <>
                    <div className="border-t border-gray-100" />
                    <button
                      onClick={handleCloudSave}
                      disabled={cloudSaving}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 disabled:opacity-50"
                    >
                      <CloudUpload className="w-4 h-4 text-teal-500" /> {cloudSaving ? "Saving..." : "Save to Cloud"}
                    </button>
                    <button
                      onClick={() => { onCloudOpen?.(); setFileMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
                    >
                      <Cloud className="w-4 h-4 text-teal-500" /> Open from Cloud
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save"}
          </button>

          <div className="w-px h-5 bg-white/20" />

          <button
            onClick={onPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: "#24abbc" }}
          >
            <Play className="w-3.5 h-3.5" />
            Preview
          </button>

          {user && (
            <button
              onClick={onPublish}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                isPublished
                  ? "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                  : "bg-white/10 text-white/80 hover:text-white hover:bg-white/15"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              {isPublished ? "Published" : "Publish"}
            </button>
          )}

          <div className="w-px h-5 bg-white/20" />

          <button
            onClick={onSettings}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Quiz settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onLicense}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "rgba(255,255,255,0.08)" }}
            title="License"
          >
            <Key className="w-3 h-3 text-white/60" />
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${tierBadge.color}`}>
              {tierBadge.label}
            </span>
          </button>
        </div>
      </header>

      {/* SCORM / iSpring import dialog */}
      <ScormImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
      />
    </>
  );
}
