# Prior-art design research and inspiration map

This is an **inspiration and mechanism inventory**, not an endorsement of software quality, activity, security, licensing, or suitability for copying. A previous landscape comparison surfaced 65 projects; many names were not individually security- or source-audited. Verify the exact upstream version, license, and issue history before adopting code or a dependency.

## Core mechanism patterns

| Pattern | Projects to compare | Proposed lesson | Decision status |
|---|---|---|---|
| Encrypted and offline notes | Standard Notes, Notesnook, Joplin, LibreNotes | Separation of client content and relay, import/export, conflict recovery | ADAPT, TEST |
| Zero-friction capture | Memos, Blinko, Simplenote, Markor | Capture first, organize later | ADOPT |
| Durable Markdown knowledge | Obsidian, SilverBullet, Foam, QOwnNotes | Portable text, extensible commands and backlinks | ADAPT |
| Typed knowledge records | Anytype, SiYuan, Trilium, AFFiNE | Stable IDs, relations, context lenses and saved views | ADAPT |
| Research preservation | Karakeep, Linkwarden, Readeck, ArchiveBox, Zotero | Save source/provenance and allow offline reading | LATER |
| Document ingestion | Paperless-ngx, Shiori, wallabag | Preserve original file and derivation trace | LATER |
| Programmatic knowledge | TiddlyWiki, DokuWiki, Wiki.js, XWiki | Structured content and controlled extension mechanisms | LATER |
| Personal AI retrieval | Khoj, Reor, Open Notebook, AnythingLLM, Onyx | Optional, permissioned query over selected data | LATER |
| Multiuser editing | CryptPad, HedgeDoc, Etherpad, Docmost | Real collaboration is expensive and not a v1 requirement | AVOID v1 |
| Local-first engine patterns | Yjs, Automerge, Actual Budget | Local durability, convergence, transport/recovery boundaries | EXPERIMENT |

## 65 reviewed candidate projects from earlier landscape pass

These are research starting points, not all equally independent; some are derivative products or historical-only references.

1. Standard Notes — https://github.com/standardnotes/app
2. Notesnook — https://github.com/streetwriters/notesnook
3. Joplin — https://github.com/laurent22/joplin
4. LibreNotes — https://github.com/Piliii/LibreNotes
5. keepIT — https://github.com/Richy1989/keepIT
6. Simplenote — https://github.com/Automattic/simplenote-electron
7. Markor — https://github.com/gsantner/markor
8. Quillpad — https://github.com/quillpad/quillpad
9. Nextcloud Notes — https://github.com/nextcloud/notes
10. Saber — https://github.com/saber-notes/saber
11. Fossify Notes — https://github.com/FossifyOrg/Notes
12. Beaver Notes — https://github.com/Beaver-Notes/Beaver-Notes
13. Memos — https://github.com/usememos/memos
14. Blinko — https://github.com/blinkospace/blinko
15. Flatnotes — https://github.com/dullage/flatnotes
16. Globnotes — https://github.com/alexindigo/globnotes
17. Dnote — https://github.com/dnote/dnote
18. nb — https://github.com/xwmx/nb
19. QOwnNotes — https://github.com/pbek/QOwnNotes
20. Bangle.io — https://github.com/bangle-io/bangle-io
21. Mark Text — https://github.com/marktext/marktext
22. Notable — https://github.com/notable/notable
23. Noteless — https://github.com/redsolver/noteless
24. Noted — https://github.com/thomasgauvin/noted
25. Obsidian — https://obsidian.md/
26. Logseq — https://github.com/logseq/logseq
27. SiYuan — https://github.com/siyuan-note/siyuan
28. Trilium — https://github.com/TriliumNext/Trilium
29. SilverBullet — https://github.com/silverbulletmd/silverbullet
30. Foam — https://github.com/foambubble/foam
31. TiddlyWiki — https://github.com/TiddlyWiki/TiddlyWiki5
32. Dendron — https://github.com/dendronhq/dendron
33. org-roam — https://github.com/org-roam/org-roam
34. Tangent — https://github.com/suchnsuch/Tangent
35. Zettlr — https://github.com/Zettlr/Zettlr
36. VNote — https://github.com/vnotex/vnote
37. Athens Research — https://github.com/athensresearch/athens
38. Anytype — https://github.com/anyproto/anytype-ts
39. Knopo — https://github.com/alkalim/Knopo
40. AFFiNE — https://github.com/toeverything/affine
41. AppFlowy — https://github.com/AppFlowy-IO/AppFlowy
42. BookStack — https://codeberg.org/bookstack/bookstack
43. Wiki.js — https://github.com/requarks/wiki
44. Docmost — https://github.com/docmost/docmost
45. Outline — https://github.com/outline/outline
46. DokuWiki — https://github.com/dokuwiki/dokuwiki
47. XWiki — https://github.com/xwiki/xwiki-platform
48. HedgeDoc — https://github.com/hedgedoc/hedgedoc
49. Etherpad — https://github.com/ether/etherpad
50. CryptPad — https://github.com/cryptpad/cryptpad
51. Karakeep — https://github.com/karakeep-app/karakeep
52. Linkwarden — https://github.com/linkwarden/linkwarden
53. linkding — https://github.com/sissbruecker/linkding
54. Readeck — https://github.com/readeck/readeck
55. wallabag — https://github.com/wallabag/wallabag
56. Shiori — https://github.com/go-shiori/shiori
57. ArchiveBox — https://github.com/ArchiveBox/ArchiveBox
58. Paperless-ngx — https://github.com/paperless-ngx/paperless-ngx
59. Zotero — https://github.com/zotero/zotero
60. Archivy — https://github.com/archivy/archivy
61. Khoj — https://github.com/khoj-ai/khoj
62. Open Notebook — https://github.com/lfnovo/open-notebook
63. Reor — https://github.com/reorproject/reor
64. AnythingLLM — https://github.com/Mintplex-Labs/anything-llm
65. Onyx — https://github.com/onyx-dot-app/onyx

## Verified architectural source pointers (documentation, not proof of our design)

- https://docs.yjs.dev/getting-started/allowing-offline-editing — Yjs IndexedDB offline persistence.
- https://automerge.org/docs/tutorial/local-sync/ — Automerge local storage and network adapters.
- https://developer.android.com/develop/background-work — Android background-work architecture and restrictions.
- https://standardnotes.com/help/14/how-do-i-create-and-import-backups-of-my-standard-notes-data — Standard Notes decrypted and encrypted backup exports.

## Research hygiene / next inspection

- Confirm repos are still accessible and review recent releases, active issues, current licenses and maintenance state before using upstream libraries.
- Inspect at least one mature example and one plausible counterexample for each major mechanism.
- For encryption claims, read actual key management and attack model, not product pages alone.
- Do not lift upstream GPL/AGPL/BSL-licensed code into a repository of unknown license without proper legal/licensing analysis.