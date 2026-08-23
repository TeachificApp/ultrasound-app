import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export type UnassignedStudentRow = {
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
};

type Props = {
  students: UnassignedStudentRow[];
  onAssign: (userId: number) => void;
  onBulkAssign?: (userIds: number[]) => void;
  assignLabel?: string;
  isAssigning?: boolean;
  isBulkAssigning?: boolean;
  description?: string;
  emptyMessage?: string;
};

export function UnassignedStudentsAssignPanel({
  students,
  onAssign,
  onBulkAssign,
  assignLabel = "Add",
  isAssigning = false,
  isBulkAssigning = false,
  description = "Enrolled in this product but not assigned here yet.",
  emptyMessage = "No unassigned students.",
}: Props) {
  const [bulkSelected, setBulkSelected] = useState<number[]>([]);

  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500 italic">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-medium text-gray-700">
            Available to assign ({students.length})
          </div>
          <div className="text-xs text-gray-500">{description}</div>
        </div>
        {onBulkAssign && bulkSelected.length > 0 && (
          <Button
            size="sm"
            className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
            disabled={isBulkAssigning}
            onClick={() => {
              onBulkAssign(bulkSelected);
              setBulkSelected([]);
            }}
          >
            {isBulkAssigning ? <Loader2 className="w-3 h-3 animate-spin" /> : `Add ${bulkSelected.length} selected`}
          </Button>
        )}
      </div>
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden max-h-56 overflow-y-auto">
        {students.map((student) => (
          <div key={student.userId} className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50">
            {onBulkAssign && (
              <input
                type="checkbox"
                checked={bulkSelected.includes(student.userId)}
                onChange={(e) =>
                  setBulkSelected((prev) =>
                    e.target.checked
                      ? [...prev, student.userId]
                      : prev.filter((id) => id !== student.userId),
                  )
                }
                className="w-3.5 h-3.5 accent-teal-600"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-800">{student.userName || "Student"}</span>
              {student.userEmail && <span className="text-xs text-gray-400 ml-2">{student.userEmail}</span>}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-teal-600 hover:text-teal-800 h-7 px-2"
              disabled={isAssigning}
              onClick={() => onAssign(student.userId)}
            >
              {isAssigning ? <Loader2 className="w-3 h-3 animate-spin" /> : assignLabel}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
