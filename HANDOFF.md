# Fitness App Codex Handoff

## Current Project
- Source project: `/Users/keichang/Desktop/一些有趣的項目/Fitnessapp`
- Backup/reference copy: `/Users/keichang/Desktop/codex/fitness/project-files`
- Stack: React 19 + Vite + Supabase client
- Prototype rule: UI mock/local state only for new features; no Supabase schema changes yet.

## Product Direction
- Visual style is moving toward an Apple/iOS mobile app feel: clean light-gray app background, white/glass cards, subtle shadows, frosted bottom navigation/sheets, and orange/pink only as the accent system for fitness energy.
- Bottom nav now has 4 tabs: `摘要`, `訓練`, `飲食`, `AI`.
- Profile/settings is opened by tapping the top-right avatar `K` on the dashboard.

## Implemented Feedback
- Dashboard recent training is grouped by date.
- Each date card expands to show exercises; each exercise expands to show sets and notes.
- Date cards keep swipe-style edit/delete actions.
- Exercise thumbnails now use lightweight SVG/CSS art instead of the generic `FIT` tile.
- Core exercises use duration + load/bodyweight instead of weight/reps/1RM.
- Training tab is now an exercise progress screen with selectable exercises, line chart, and per-date records.
- Training tab now uses a `查詢動作` selector instead of fixed chips. The selector opens a bottom sheet with categories `上肢`, `下肢`, `有氧`, `核心`, then lets the user pick a specific exercise.
- Training progress line charts show numeric labels at each point so small changes are readable.
- Diet tab has a monthly calendar; selecting a date shows meals, macros, and a short AI suggestion.
- Add meal bottom sheet supports frequent foods, manual entry, and a photo placeholder.
- AI tab now has a real chat input and send button, with mock contextual replies.
- Profile page uses weekly weight logging, goal settings, editable macro targets, and AI recalculation.
- Profile weight chart now shows numeric weight labels at each point.
- Profile goal editing now labels every input, uses multi-select goals (`增肌`, `減脂`, `維持體重`, `提升運動表現`), clarifies the weekly training-days field, and places AI recalculation directly above the macro target inputs.

## Key Files
- `src/App.jsx`: app shell and 4-tab navigation.
- `src/screens/HomeScreen.jsx`: dashboard, profile overlay, grouped recent training.
- `src/screens/TrainingScreen.jsx`: exercise progress chart and record cards.
- `src/screens/DietScreen.jsx`: diet calendar and add-meal sheet.
- `src/screens/CoachScreen.jsx`: chat-like AI coach.
- `src/screens/ProfileScreen.jsx`: weekly weight and editable goals.
- `src/components/NewSessionModal.jsx`: exercise picker and training entry modal.
- `src/lib/prototypeData.js`: mock sessions, meal calendar, progress data, exercise categories, AI context.
- `src/index.css`: iOS-inspired light design tokens, shared UI helpers, goal form styles, and exercise picker styles.

## Verified
- `npm run build` passes.
- Browser smoke checks passed for:
  - dashboard grouped recent training
  - training progress tab
  - training exercise category picker
  - profile goal-edit bottom sheet
  - diet calendar and add-meal sheet
  - AI chat input and mock reply
  - top-right avatar opening profile/settings

## Next Useful Step
- Let the user test the flow naturally, then decide which prototype states should become real Supabase tables or columns.
