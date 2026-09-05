import { CheckCircle, ChevronDown, ChevronRight, FolderOpen, Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildQuestionBankFolderChildrenMap } from "@shared/questionBankFolders";

export type QuestionBankFolderRow = {
  id: number;
  name: string;
  parentId?: number | null;
  questionCount?: number;
};

type QuestionBankFolderTreeProps = {
  folders: QuestionBankFolderRow[];
  selectedFolderId?: number;
  expandedFolderIds: Set<number>;
  onToggleFolder: (folderId: number) => void;
  onSelectFolder: (folderId: number) => void;
  editingFolderId: number | null;
  editingFolderName: string;
  onEditingFolderNameChange: (value: string) => void;
  onStartEditFolder: (folder: QuestionBankFolderRow) => void;
  onSaveEditFolder: () => void;
  onCancelEditFolder: () => void;
  onDeleteFolder: (folder: QuestionBankFolderRow) => void;
  onAddSubfolder: (parentId: number) => void;
  accent?: "purple" | "teal";
};

function FolderTreeNode({
  folder,
  depth,
  childrenByParent,
  ...props
}: QuestionBankFolderTreeProps & {
  folder: QuestionBankFolderRow;
  depth: number;
  childrenByParent: Map<number | null, QuestionBankFolderRow[]>;
}) {
  const children = childrenByParent.get(folder.id) ?? [];
  const isExpanded = props.expandedFolderIds.has(folder.id);
  const isSelected = props.selectedFolderId === folder.id;
  const accentSelected = props.accent === "teal" ? "bg-teal-600 text-white border-teal-600" : "bg-purple-100 border-purple-400";
  const accentIdle = props.accent === "teal" ? "bg-white border-teal-200 hover:bg-teal-50" : "bg-white border-purple-200";

  return (
    <div>
      <div
        className={cn("flex items-center gap-1 rounded-lg border px-2 py-1.5", isSelected ? accentSelected : accentIdle)}
        style={{ marginLeft: `${depth * 14}px` }}
      >
        {children.length > 0 ? (
          <button type="button" onClick={() => props.onToggleFolder(folder.id)} className="rounded p-0.5 text-current/70 hover:text-current" aria-label={isExpanded ? "Collapse folder" : "Expand folder"}>
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="inline-block w-4" />
        )}
        <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-80" />
        {props.editingFolderId === folder.id ? (
          <Input
            value={props.editingFolderName}
            onChange={(e) => props.onEditingFolderNameChange(e.target.value)}
            className="h-7 flex-1 bg-white text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") props.onSaveEditFolder();
              if (e.key === "Escape") props.onCancelEditFolder();
            }}
            autoFocus
          />
        ) : (
          <button type="button" onClick={() => props.onSelectFolder(folder.id)} className="min-w-0 flex-1 truncate text-left text-sm font-medium">
            {folder.name}
            {folder.questionCount ? <span className="ml-1 text-xs opacity-70">({folder.questionCount})</span> : null}
          </button>
        )}
        <div className="flex items-center gap-0.5">
          {props.editingFolderId === folder.id ? (
            <>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={props.onSaveEditFolder} disabled={!props.editingFolderName.trim()}><CheckCircle className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={props.onCancelEditFolder}><X className="h-3.5 w-3.5" /></Button>
            </>
          ) : (
            <>
              <button type="button" title="Add subfolder" onClick={() => props.onAddSubfolder(folder.id)} className="rounded p-1 opacity-70 hover:opacity-100"><Plus className="h-3.5 w-3.5" /></button>
              <button type="button" title="Rename folder" onClick={() => props.onStartEditFolder(folder)} className="rounded p-1 opacity-70 hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" title="Delete folder" onClick={() => props.onDeleteFolder(folder)} className="rounded p-1 text-red-500 opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      </div>
      {isExpanded && children.length > 0 && (
        <div className="mt-1 space-y-1">
          {children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              {...props}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function QuestionBankFolderTree(props: QuestionBankFolderTreeProps) {
  const childrenByParent = buildQuestionBankFolderChildrenMap(props.folders);
  const roots = childrenByParent.get(null) ?? [];

  return (
    <div className="space-y-1">
      {roots.map((folder) => (
        <FolderTreeNode key={folder.id} folder={folder} depth={0} childrenByParent={childrenByParent} {...props} />
      ))}
    </div>
  );
}
