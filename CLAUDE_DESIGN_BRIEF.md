# Claude Design Brief - Fitness App

## Goal
Please beautify and refine this React fitness app UI. Keep the current product structure and interactions, but improve the visual design, spacing, hierarchy, and mobile polish.

## Desired Style
- Apple/iOS mobile app feeling.
- Clean, premium, calm, and easy to scan.
- Light gray app background, white or subtle glass cards, soft shadows, strong spacing.
- Orange/pink can remain as the energetic fitness accent, but avoid making the whole app feel overly orange.
- It should feel like a real iPhone app, not a marketing landing page.

## Current App Structure
- Bottom navigation has 4 tabs: `摘要`, `訓練`, `飲食`, `AI`.
- Dashboard/profile opens from the top-right avatar.
- Training page has an exercise query selector:
  - first choose `上肢`, `下肢`, `有氧`, `核心`
  - then choose a specific exercise
  - selected exercise updates the chart and records below.
- Charts now show numeric labels on each point.
- Profile goal sheet has labeled inputs and multi-select goals:
  - `增肌`
  - `減脂`
  - `維持體重`
  - `提升運動表現`
- AI recalculation belongs visually above the macro targets.

## Main Files To Review
- `src/index.css`: global design tokens and shared UI styles.
- `src/App.jsx`: app shell and bottom navigation.
- `src/screens/HomeScreen.jsx`: dashboard and profile entry.
- `src/screens/TrainingScreen.jsx`: exercise query, trend chart, records.
- `src/screens/ProfileScreen.jsx`: profile, weight chart, goal editing sheet.
- `src/screens/DietScreen.jsx`: diet calendar and meal sheet.
- `src/screens/CoachScreen.jsx`: AI coach screen.
- `src/components/NewSessionModal.jsx`: workout entry modal.
- `src/lib/prototypeData.js`: mock data for visual states.

## Please Preserve
- Traditional Chinese copy.
- Existing app flows and tabs.
- React/Vite structure.
- Prototype/mock-data behavior.

## Good Improvements To Make
- More consistent iOS-like card rhythm.
- Better bottom sheet design.
- Cleaner form fields and controls.
- Better chart readability without clutter.
- Better empty/selected/active states.
- More polished mobile spacing across 398px-ish viewport.
