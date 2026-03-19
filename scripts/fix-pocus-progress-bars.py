#!/usr/bin/env python3
"""
Fix the 4 POCUS navigator progress bars to use the shared ProtocolProgressBar component.
These navigators use checkedCount (not checked.size) and have different inline progress bar structures.
"""
import os
import re

PAGES_DIR = "/home/ubuntu/ultrasound-assist/client/src/pages"

POCUS_FILES = [
    "POCUSCardiacNavigator.tsx",
    "POCUSEfastNavigator.tsx",
    "POCUSLungNavigator.tsx",
    "POCUSRushNavigator.tsx",
]

def process_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    filename = os.path.basename(filepath)

    # 1. Add resetAll function if not present
    # Find the line with checkedCount definition and add resetAll after it
    if 'resetAll' not in content and 'setChecked' in content:
        # Add resetAll after the checkedCount line
        content = re.sub(
            r'(const checkedCount = Object\.values\(checked\)\.filter\(Boolean\)\.length;)',
            r'\1\n  const resetAll = () => setChecked({});',
            content
        )

    # 2. Replace the inline progress bar block and move it outside the container
    # The pattern: <div className="container py-6 space-y-6">
    #   {/* ... Progress ... */}
    #   <div className="bg-white rounded-xl border border-gray-100 p-4" ...>
    #     ... progress bar content ...
    #   </div>
    # Replace with: ProtocolProgressBar outside container, then container without progress block

    # Find and replace the progress block inside the container
    # Pattern matches the progress div block (from the comment to the closing </div>)
    progress_block_pattern = re.compile(
        r'(\s*\{/\* [─\-]* Progress [─\-]*\*/\}\s*|\s*\{/\* Progress \*/\}\s*)'
        r'<div className="bg-white rounded-xl border border-gray-100 p-4"[^>]*>'
        r'.*?'
        r'</div>\n',
        re.DOTALL
    )

    # Check if we can find the progress block
    match = progress_block_pattern.search(content)
    if match:
        # Remove the progress block from inside the container
        content = progress_block_pattern.sub('', content, count=1)

        # Now find the container py-6 div and add ProtocolProgressBar before it
        content = re.sub(
            r'(\s*</div>\s*\n\s*<div className="container py-6 space-y-6">)',
            r'\n      <ProtocolProgressBar\n        checked={checkedCount}\n        total={totalItems}\n        onReset={resetAll}\n      />\1',
            content,
            count=1
        )
        print(f"  ✓ Fixed {filename}")
    else:
        # Try a simpler approach - just check if it already uses ProtocolProgressBar correctly
        if 'checked={checkedCount}' in content:
            print(f"  ✓ Already using ProtocolProgressBar correctly: {filename}")
        else:
            print(f"  ⚠ Could not find progress block in {filename} - manual fix needed")
        return

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

def main():
    print("Fixing POCUS navigator progress bars...\n")
    for filename in POCUS_FILES:
        filepath = os.path.join(PAGES_DIR, filename)
        if os.path.exists(filepath):
            process_file(filepath)
        else:
            print(f"  ✗ File not found: {filename}")
    print("\nDone!")

if __name__ == "__main__":
    main()
