#!/usr/bin/env python3
"""
Update all navigator pages to use the shared ProtocolProgressBar component.
Uses simple string replacement to swap the inline progress bar div with the component.
"""
import os

PAGES_DIR = "/home/ubuntu/ultrasound-assist/client/src/pages"

NAVIGATOR_FILES = [
    "AbdominalNavigator.tsx",
    "AbdominalVascularNavigator.tsx",
    "AccreditationNavigator.tsx",
    "AortaNavigator.tsx",
    "ArterialNavigator.tsx",
    "BreastNavigator.tsx",
    "CarotidNavigator.tsx",
    "FetalNavigator.tsx",
    "MSKNavigator.tsx",
    "OB1Navigator.tsx",
    "OB23Navigator.tsx",
    "POCUSCardiacNavigator.tsx",
    "POCUSEfastNavigator.tsx",
    "POCUSLungNavigator.tsx",
    "POCUSRushNavigator.tsx",
    "PelvicGynNavigator.tsx",
    "ScrotumNavigator.tsx",
    "TCDNavigator.tsx",
    "ThyroidNavigator.tsx",
    "VenousNavigator.tsx",
]

# The exact inline progress bar block to replace (as it appears in the files)
OLD_BLOCK = '''        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">Protocol Progress</div>
            <div className="text-sm font-bold text-[#189aa1]">{checked.size}/{totalItems} items</div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
            <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "#189aa1" }} />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{progress}% complete</span>
            <span className="text-amber-600 font-medium">{checkedCritical}/{criticalItems} critical items</span>
          </div>
          {checked.size > 0 && (
            <button onClick={resetChecklist} className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">Reset checklist</button>
          )}
        </div>'''

NEW_BLOCK = '''        <ProtocolProgressBar
          checked={checked.size}
          total={totalItems}
          onReset={resetChecklist}
          checkedCritical={checkedCritical}
          totalCritical={criticalItems}
        />'''

IMPORT_LINE = 'import ProtocolProgressBar from "../components/ProtocolProgressBar";\n'

def process_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    changed = False

    # 1. Replace the inline progress bar block
    if OLD_BLOCK in content:
        content = content.replace(OLD_BLOCK, NEW_BLOCK)
        changed = True

    # 2. Add import if not already present
    if 'ProtocolProgressBar' in content and IMPORT_LINE.strip() not in content:
        # Insert after the last import line
        lines = content.split('\n')
        last_import_idx = -1
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import_idx = i
        if last_import_idx >= 0:
            lines.insert(last_import_idx + 1, IMPORT_LINE.rstrip())
            content = '\n'.join(lines)
            changed = True

    if changed:
        print(f"  ✓ Updated {os.path.basename(filepath)}")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    else:
        # Check if it already uses the component
        if 'ProtocolProgressBar' in content:
            print(f"  ✓ Already using ProtocolProgressBar: {os.path.basename(filepath)}")
        else:
            print(f"  ⚠ Pattern not found in {os.path.basename(filepath)} - check manually")

def main():
    print("Updating navigator progress bars...\n")
    for filename in NAVIGATOR_FILES:
        filepath = os.path.join(PAGES_DIR, filename)
        if os.path.exists(filepath):
            process_file(filepath)
        else:
            print(f"  ✗ File not found: {filename}")
    print("\nDone!")

if __name__ == "__main__":
    main()
