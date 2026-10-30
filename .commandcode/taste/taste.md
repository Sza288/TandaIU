# Taste

## Workflow
- Wants all edits left uncommitted in the working tree: never `git commit` or `git push` (nor destructive git commands) unless explicitly asked. Confidence: 0.85
- Does not accept "passing automated tests" as proof of success — automated checks must be paired with direct visual/manual verification of the actual result. Confidence: 0.85
- Wants root-cause diagnosis before parameter tweaks: investigate the actual technical cause and report it, rather than nudging durations/easing/constants until the symptom seems to go away. Confidence: 0.8
- Pre-existing local working-tree changes must be preserved: don't revert, rewrite, or touch unrelated local modifications made outside the current task. Confidence: 0.75
