#!/usr/bin/env python3
"""Copy the shared reference files into every skill that uses them.

Each skill has to be self-contained once installed, so files several skills need live once in
shared/references/ and are copied into <skill>/references/. Edit the shared copy, then run:

    python3 scripts/sync_shared.py          # copy
    python3 scripts/sync_shared.py --check  # fail if any copy is out of date
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHARED = ROOT / "shared" / "references"
SKILLS = ROOT / "plugins" / "study-tools" / "skills"
USERS = {
    "exam-format.md": ["study-guide", "cheat-sheet", "grade-my-exam", "make-practice-exam"],
    "course-pack.md": ["study-guide", "cheat-sheet", "grade-my-exam", "make-practice-exam"],
}
BANNER = "<!-- Copied from shared/references/{name} by scripts/sync_shared.py. Edit the shared copy, not this one. -->\n"


def main():
    check = "--check" in sys.argv
    stale = []
    for name, skills in USERS.items():
        text = BANNER.format(name=name) + (SHARED / name).read_text()
        for skill in skills:
            folder = SKILLS / skill
            if not folder.is_dir():
                continue
            dest = folder / "references" / name
            if dest.exists() and dest.read_text() == text:
                continue
            if check:
                stale.append(str(dest.relative_to(ROOT)))
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(text)
                print("updated", dest.relative_to(ROOT))
    if stale:
        print("Out of date (run scripts/sync_shared.py):\n  " + "\n  ".join(stale))
        sys.exit(1)


if __name__ == "__main__":
    main()
