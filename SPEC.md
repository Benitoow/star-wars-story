# Star Wars Story Manager — Interactive Dashboard

## 1. Project Overview

**Project Name:** Star Wars Story Manager  
**Type:** Progressive Web App (PWA) with offline support  
**Core Functionality:** A sophisticated dashboard for creating, managing, and sharing interactive Star Wars stories with AI-powered generation, local-first storage, and collaborative features.  
**Target Users:** Star Wars fans and creative writers who want to create personalized interactive stories.

## 2. Architecture

### 2.1 Tech Stack
- **Framework:** SvelteKit (lightweight, fast, excellent DX)
- **Language:** TypeScript
- **Storage:** Dexie.js (IndexedDB wrapper)
- **Build:** Vite
- **Styling:** Custom CSS with CSS variables
- **PWA:** Vite PWA plugin

### 2.2 Project Structure
```
star-wars-story/
├── src/
│   ├── lib/
│   │   ├── components/     # Reusable UI components
│   │   ├── stores/         # Svelte stores for state
│   │   ├── db/              # Dexie.js database schema
│   │   ├── utils/           # Utility functions
│   │   └── i18n/           # Internationalization
│   ├── routes/
│   │   ├── +page.svelte    # Dashboard (main)
│   │   ├── story/[id]/     # Story editor/viewer
│   │   ├── settings/        # User preferences
│   │   └── onboarding/      # First-time user tour
│   └── app.html
├── static/
│   ├── icons/              # PWA icons
│   └── sw.js              # Service worker
├── SPEC.md
├── package.json
└── svelte.config.js
```

## 3. Data Model

### 3.1 Database Schema (IndexedDB via Dexie.js)

```typescript
interface Story {
  id: string;              // UUID
  title: string;
  content: string;         // Rich text JSON or Markdown
  setup: {
    era: string;
    faction: string;
    role: string;
    premise: string;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastPlayedAt?: Date;
    playCount: number;
    wordCount: number;
  };
  tags: string[];
  folderId?: string;
  theme?: StoryTheme;
  version: number;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
}

interface Folder {
  id: string;
  name: string;
  parentId?: string;
  color: string;
  createdAt: Date;
}

interface UserPreferences {
  id: 'preferences';       // Singleton
  uiLanguage: string;
  theme: 'light' | 'dark' | 'auto';
  defaultImageProvider?: string;
  defaultImgModel?: string;
  autoSave: boolean;
  autoSaveInterval: number; // ms
  showOnboarding: boolean;
  shortcuts: ShortcutMap;
  profiles: CreativeProfile[];
  activeProfileId?: string;
}

interface CreativeProfile {
  id: string;
  name: string;
  icon: string;
  config: {
    defaultEra?: string;
    defaultFaction?: string;
    defaultRole?: string;
    defaultPremise?: string;
    preferredImageProvider?: string;
    preferredImgModel?: string;
    customPromptPrefix?: string;
  };
}

interface AppState {
  id: 'appState';          // Singleton
  currentStoryId?: string;
  recentStories: string[];   // Story IDs
  trashCleanUpDate?: Date;
  firstVisitDate: Date;
  analytics: AnalyticsData;
}

interface StoryVersion {
  id: string;
  storyId: string;
  content: string;
  setup: Story['setup'];
  savedAt: Date;
  version: number;
}

interface AnalyticsData {
  storiesCreated: number;
  totalPlayTime: number;    // minutes
  choicesMade: number;
  imagesGenerated: number;
  weeklyStats: WeeklyStat[];
}

interface WeeklyStat {
  weekStart: Date;
  storiesCreated: number;
  timeSpent: number;
  favoriteFaction?: string;
  favoriteRole?: string;
}
```

### 3.2 Storage Configuration
```javascript
const db = new Dexie('StarWarsStoryDB');
db.version(1).stores({
  stories: 'id, title, folderId, *tags, createdAt, updatedAt, isArchived, isDeleted',
  folders: 'id, parentId, name',
  storyVersions: 'id, storyId, savedAt, version',
  preferences: 'id',
  appState: 'id'
});
```

## 4. Core Features

### 4.1 Dashboard
- **Story Grid/List View:** Toggle between grid and list display
- **Quick Stats:** Stories created, time played, favorites
- **Search Bar:** Full-text search across titles, content, tags
- **Filter Bar:** By era, faction, role, tags, date, status
- **Sort Options:** Date created, last modified, last played, alphabetical, popularity
- **Bulk Actions:** Select multiple, archive, delete, move to folder
- **Empty State:** Guided creation with templates

### 4.2 Story Creation Flow
1. **Quick Create:** One-click start with random setup
2. **Guided Create:** Step-by-step era/faction/role/premise selection
3. **Template Create:** Start from predefined templates
4. **Import Create:** Import from Markdown/JSON/ZIP

### 4.3 Story Editor
- **Split View:** Narrative editor + live preview
- **Rich Text Editor:** Bold, italic, headers, quotes, lists
- **AI Integration Panel:** Generation controls, parameter tuning
- **Version History:** Visual timeline with restore options
- **Auto-save:** Configurable interval with visual indicator
- **Metadata Editor:** Tags, folder, theme customization

### 4.4 Story Player/Viewer
- **Immersive Mode:** Full-screen, minimal UI
- **Chapter Navigation:** Visual chapter list
- **Progress Indicator:** Turn counter, chapter progress
- **Save/Load:** Multiple save slots per story
- **Image Gallery:** Generated images in story

### 4.5 Folder System
- **Nested Folders:** Drag-drop hierarchy
- **Folder Colors:** Custom color coding
- **Smart Folders:** Auto-populated by filters (Recently Played, Favorites, etc.)
- **Folder Statistics:** Story count, total word count

### 4.6 Search & Discovery
- **Full-Text Search:** Title, content, tags
- **Filter Combinations:** Era + Faction + Role + Tags
- **Recent Searches:** History with quick access
- **Suggestions:** Based on current selection

### 4.7 Trash & Recovery
- **Soft Delete:** Moved to trash, not permanent
- **30-Day Retention:** Auto-permanent delete after 30 days
- **Restore Options:** Single or bulk restore
- **Empty Trash:** Secure permanent deletion with confirmation

### 4.8 Export/Import
- **Export Formats:** Markdown, JSON, PDF (future), HTML
- **Project Export:** ZIP with images and metadata
- **Import Formats:** Markdown, JSON, ZIP
- **Backup/Restore:** Full app state backup

### 4.9 Settings & Preferences
- **Appearance:** Theme (light/dark/auto), font size, spacing
- **AI Providers:** API key management, model selection
- **Image Generation:** Provider, model, quality settings
- **Creative Profiles:** Predefined configurations
- **Shortcuts:** Customizable keyboard shortcuts
- **Data Management:** Export backup, import, clear data
- **Accessibility:** High contrast, reduced motion, screen reader

### 4.10 Onboarding
- **Welcome Tour:** 4-step guided introduction
- **Feature Highlights:** Contextual tooltips
- **Sample Story:** Pre-loaded demo story
- **Achievement Badges:** First story, first export, etc.

## 5. UI/UX Design

### 5.1 Layout System
- **Mobile (< 640px):** Single column, bottom nav
- **Tablet (640-1024px):** Sidebar collapsible
- **Desktop (> 1024px):** Full sidebar, multi-panel

### 5.2 Navigation
- **Main Navigation:** Sidebar (desktop) / Bottom tabs (mobile)
  - Dashboard (home)
  - All Stories
  - Folders
  - Trash
  - Settings
- **Contextual Nav:** Breadcrumbs, back buttons
- **Quick Actions:** Floating action button for new story

### 5.3 Theming
- **Light Theme:** Clean white backgrounds, subtle shadows
- **Dark Theme:** Deep navy/black, muted accents
- **Dynamic Theme:** Based on time of day
- **Custom Accent Colors:** User-selectable primary color

### 5.4 Animations & Transitions
- **Page Transitions:** Slide/fade between routes
- **Micro-interactions:** Button hover, card press, save indicator
- **Loading States:** Skeleton screens, progress bars
- **Success Feedback:** Toast notifications, glow effects

### 5.5 Components
- **Button:** Primary, secondary, ghost, danger variants
- **Card:** Story preview card with hover actions
- **Modal:** Centered overlay with backdrop blur
- **Toast:** Bottom-right notifications
- **Dropdown:** Context menus, select menus
- **Tooltip:** Hover information bubbles
- **Badge:** Tags, counts, status indicators
- **Progress:** Linear and circular variants
- **Skeleton:** Loading placeholders

## 6. PWA Features

### 6.1 Service Worker
- **Caching:** App shell, static assets, fonts
- **Offline Support:** Full functionality without network
- **Background Sync:** Queue actions for when online
- **Update Notification:** New version available prompt

### 6.2 Manifest
- **Install Prompt:** Custom install banner
- **Icons:** 192x192, 512x512, maskable
- **Theme Color:** Dynamic based on theme
- **Display Mode:** Standalone, minimal-ui

### 6.3 Push Notifications (Future)
- **Save Reminders:** Periodic auto-save prompts
- **Version Alerts:** New app version available
- **Custom Alerts:** User-defined reminders

## 7. Performance

### 7.1 Targets
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3s
- **Bundle Size:** < 500KB gzipped
- **PWA Install Size:** < 10MB

### 7.2 Optimization
- **Code Splitting:** Route-based lazy loading
- **Image Optimization:** WebP, lazy loading
- **Virtual Scrolling:** For long lists (100+ items)
- **Debouncing:** Search input, auto-save
- **Memoization:** Expensive computations

## 8. Accessibility

### 8.1 WCAG 2.1 AA Compliance
- **Color Contrast:** Minimum 4.5:1 ratio
- **Keyboard Navigation:** Full functionality without mouse
- **Focus Indicators:** Visible focus rings
- **Screen Readers:** ARIA labels, semantic HTML
- **Reduced Motion:** Respect prefers-reduced-motion
- **Text Scaling:** Support up to 200% zoom

### 8.2 Keyboard Shortcuts
- `Ctrl/Cmd + N`: New story
- `Ctrl/Cmd + S`: Save story
- `Ctrl/Cmd + F`: Search
- `Ctrl/Cmd + B`: Toggle sidebar
- `Escape`: Close modal/deselect
- `?`: Show shortcuts help

## 9. Security

### 9.1 Client-Side Encryption (Optional)
- **Key Generation:** Web Crypto API
- **Encryption:** AES-GCM for sensitive content
- **Key Storage:** IndexedDB (user must remember passphrase)

### 9.2 Privacy
- **No External Tracking:** Zero analytics by default
- **Local Processing:** All generation done locally or via user-provided API keys
- **Data Isolation:** Each story's data kept separate
- **Secure Delete:** Overwrite on permanent delete

## 10. Data Flow

### 10.1 Story Creation
1. User clicks "New Story"
2. Setup modal opens with era/faction/role/premise
3. User confirms → Story created in DB
4. Redirect to story editor
5. AI generates initial content
6. Auto-save kicks in

### 10.2 Story Playback
1. User selects story from dashboard
2. Story state loaded from DB
3. Player view rendered
4. User makes choices
5. AI generates continuation
6. Story updated in DB
7. Version snapshot created (every 5 turns)

### 10.3 Auto-save Cycle
1. Timer starts on first edit
2. Debounced save on change (500ms)
3. Visual indicator shows "Saving..."
4. On success: "Saved" with timestamp
5. Version created at milestones

## 11. Error Handling

### 11.1 API Errors
- **Connection Failed:** Retry with exponential backoff
- **Auth Error:** Prompt for new API key
- **Rate Limited:** Queue requests, notify user
- **Generation Failed:** Fallback message, retry option

### 11.2 Storage Errors
- **Quota Exceeded:** Prompt to delete old content
- **Corruption Detected:** Attempt recovery, restore from version
- **Migration Failed:** Rollback, notify user

### 11.3 UI Error States
- **Empty Search:** Friendly message with suggestions
- **Load Failed:** Retry button, error details
- **Offline:** Indication banner, cached content available

## 12. Future Roadmap

### 12.1 Phase 2 Features
- Real-time collaboration via WebRTC or WebSockets
- Cloud sync (optional, encrypted)
- Plugin system for extensions
- Text-to-speech narration
- Video export from story

### 12.2 Phase 3 Features
- Community features (share, like, remix)
- Marketplace for story templates
- Mobile companion app
- Advanced analytics dashboard

---

## Implementation Notes

### Critical Paths
1. Dashboard with story CRUD
2. Story editor with auto-save
3. IndexedDB integration
4. PWA manifest and service worker
5. Settings persistence

### MVP Scope
- Single user, single device
- No real-time collaboration
- No cloud sync
- Basic export (Markdown, JSON)

### Testing Strategy
- Unit tests for stores and utilities
- Component tests for UI interactions
- E2E tests for critical flows
- Manual testing on multiple devices

---

## 13. SVG Assets Organization

### 13.1 Asset Location
All SVG assets are located in `/svg/` directory at project root.

### 13.2 Asset Categories

#### Faction Emblems (9 total)
| Filename | Faction | Color |
|----------|---------|-------|
| `jedi-order-svgrepo-com.svg` | Jedi Order | #4ec9b0 |
| `starwars-sith-svgrepo-com.svg` | Sith Order | #e51414 |
| `Emblem_of_the_First_Galactic_Empire.svg` | Galactic Empire | #c41e3a |
| `Emblem_of_the_First_Order.svg` | First Order | #1a1a2e |
| `brand-galactic-republic-svgrepo-com.svg` | Galactic Republic | #3498db |
| `AncientRepublic.svg` | Old Republic | #820 |
| `Desilijic_clan_vector.svg` | Hutt Cartel | #BC2729 |

#### Character Icons (4 total)
| Filename | Character Type | Use Case |
|----------|---------------|----------|
| `noun-storm-trooper-49992.svg` | Stormtrooper | Imperial roles |
| `scifi-starwars-boba-fett-svgrepo-com.svg` | Boba Fett | Bounty hunter |
| `mandalorian-svgrepo-com.svg` | Mandalorian | Mandalorian roles |
| `alone-characterized-embodied-svgrepo-com.svg` | Scout/Survivor | Neutral roles |

#### Ships (1+)
| Filename | Ship | Use Case |
|----------|------|----------|
| `millennium-falcon-svgrepo-com.svg` | Millennium Falcon | Smuggler, travel choices |
| (TODO: add X-wing, TIE fighter, etc.) | | |

#### Lightsabers (2)
| Filename | Type | Use Case |
|----------|------|----------|
| `lightsaber-svgrepo-com.svg` | Generic Lightsaber | Sith, generic Force |
| `luke-skywalker-lightsaber-svgrepo-com.svg` | Luke's Green Saber | Jedi roles |

### 13.3 Configuration File
All assets are organized in `/src/lib/config/assets.ts`:
- `FACTIONS[]` - Faction definitions with SVG paths
- `ROLES[]` - Character roles with attributes and skills
- `SHIPS[]` - Vehicle definitions
- `CHOICE_TYPES` - Story choice categories
- `ERAS[]` - Historical periods
- `getSvgPath(filename)` - Helper to resolve SVG paths

### 13.4 SVG Icon Component
Use `<SvgIcon>` component to display icons:
```svelte
<script>
  import SvgIcon from '$lib/components/SvgIcon.svelte';
</script>

<SvgIcon filename="jedi-order-svgrepo-com.svg" size={32} color="#4ec9b0" />
```

### 13.5 Missing Icons (TODO)
The following icons need to be created or sourced:
- [ ] Rebel Alliance emblem (currently uses Republic icon)
- [ ] X-Wing fighter
- [ ] TIE Fighter
- [ ] Star Destroyer
- [ ] T-16 skyhopper
- [ ] Slave I (Boba Fett's ship)
