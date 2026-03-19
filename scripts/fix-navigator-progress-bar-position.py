#!/usr/bin/env python3
"""
Move ProtocolProgressBar outside the container div in all navigator pages.
The component needs to be a direct child of Layout (not inside container)
so that sticky positioning works correctly.
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

# Pattern: ProtocolProgressBar is inside <div className="container py-6">
# We need to move it before that div

OLD_INSIDE_CONTAINER = '''      <div className="container py-6">
        <ProtocolProgressBar
          checked={checked.size}
          total={totalItems}
          onReset={resetChecklist}
          checkedCritical={checkedCritical}
          totalCritical={criticalItems}
        />'''

NEW_OUTSIDE_CONTAINER = '''      <ProtocolProgressBar
        checked={checked.size}
        total={totalItems}
        onReset={resetChecklist}
        checkedCritical={checkedCritical}
        totalCritical={criticalItems}
      />
      <div className="container py-6">'''

def process_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    if OLD_INSIDE_CONTAINER in content:
        content = content.replace(OLD_INSIDE_CONTAINER, NEW_OUTSIDE_CONTAINER)
        print(f"  ✓ Fixed position in {os.path.basename(filepath)}")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    elif 'ProtocolProgressBar' in content:
        # Check if already outside container
        if 'container py-6' in content:
            # Check relative position
            pb_idx = content.find('<ProtocolProgressBar')
            container_idx = content.find('<div className="container py-6">')
            if pb_idx < container_idx:
                print(f"  ✓ Already correctly positioned: {os.path.basename(filepath)}")
            else:
                print(f"  ⚠ Different structure in {os.path.basename(filepath)} - check manually")
        else:
            print(f"  ⚠ No container py-6 found in {os.path.basename(filepath)} - check manually")
    else:
        print(f"  - No ProtocolProgressBar in {os.path.basename(filepath)}")

def main():
    print("Fixing ProtocolProgressBar position in all navigators...\n")
    for filename in NAVIGATOR_FILES:
        filepath = os.path.join(PAGES_DIR, filename)
        if os.path.exists(filepath):
            process_file(filepath)
        else:
            print(f"  ✗ File not found: {filename}")
    print("\nDone!")

if __name__ == "__main__":
    main()
