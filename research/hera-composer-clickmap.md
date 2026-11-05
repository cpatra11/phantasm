# Hera composer click-map — verified live (app.hera.video, fresh board, Nov 4)

Method: browser-driven (Chrome/CDP) on a new editable board. Every chip, pill
and menu below was clicked and screenshotted (`/tmp/hera-*.png`, runtime scratch).
Read-only template boards hide the composer ("You can view this board but not
edit it"), so the above-card toolbar could not be captured live this session.

## Left chat panel (board view)

- Thin rail (~44 px, icon only): logo, panels, chat (active), `+` (new chat).
- Panel header: board title ("Untitled canvas") + `+ Add brand` button.
- `New chat ▾` switcher → popover: **Search chats**, chats grouped by day
  ("Today"), current chat ticked. This is Hera's chat-history surface.
- Empty state: "Ask for images, designs, animations or a storyboard. Select
  cards to use them."
- Composer is a card pinned to the panel bottom.

## Composer

Mode chips (order matters): **Image ⌥1 · Storyboard ⌥2 · Design ⌥3 ·
Animation ⌥4**. The selected chip expands to icon + label; the rest collapse
to icons. Placeholder examples rotate (moodboard / product shots / animate…).

Parameter pills per mode (`+` = upload/reference attach, opens file picker):

| Pill | Image | Storyboard | Design | Animation |
| --- | --- | --- | --- | --- |
| Aspect | ✓ | ✓ | ✓ | ✓ |
| Count (+Variety) | ✓ | — | ✓ | ✓ |
| Scenes | — | ✓ | — | — |
| Duration | — | — | — | ✓ |
| Effort | ✓ | ✓ | ✓ | ✓ |

Menus (all popovers above the pill, selected row ticked):

- **Aspect**: Auto ✓ / 16:9 / 9:16 / 1:1 / 4:5. Sticky across mode switches.
- **Count**: header "Count"; **Auto** — "Hera reads the count from your
  message." ✓; segmented **1 2 3 4 5 6**; header "Variety": **Close** "Small
  differences" / **Balanced** "Clearly different, same idea" ✓ / **Wide**
  "Different takes".
- **Scenes**: segmented **1–7** (default 3). No Auto.
- **Duration**: segmented Auto / 5s / 10s / 15s / 20s / 30s; **Custom seconds**
  input; note "Hera picks the length, up to 120 s."
- **Effort** (pill label = current value, default Medium): note "Higher effort
  means better creations, but takes longer and uses more credits"; **Low /
  Medium ✓ / High** (High dimmed on the free plan).

## Board chrome

- `Add brand` → modal "Select a Brand Kit — Choose a saved or public Brand
  Kit." (Brand Kits / Public / My tabs, View / Apply).
- `Share` → "Collaborate with others", "Who has access: Only me", Copy link.
- Board `⋯` → Copy to New Canvas / Move to a folder / Move to a workspace /
  Delete.
- Canvas toolbar (bottom right): Select (V) / Pan / zoom % / arrange /
  add image / add note.

## Phantasm mapping

Implemented in `components/AgentSidebar.tsx` + `lib/agent/params.ts`:
mode order/shortcuts, per-mode pills and menus copied 1:1; chat switcher with
search + local thread history (`phantasm-chats:v1`); parameters sent to
`/api/agent` (`aspect`, `count` 1–6, `variety`, `scenes` 1–7, `durationMs`
3–120 s, `effort`). Known gaps vs Hera: generation still authors a 9:16 master
(the aspect pill is sent as a format instruction; 1:1/4:5 masters are not
generated yet), and effort changes agent step budget, not credit cost.
