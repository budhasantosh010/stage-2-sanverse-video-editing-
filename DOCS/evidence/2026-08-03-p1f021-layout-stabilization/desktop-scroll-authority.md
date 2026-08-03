# Desktop scroll authority

At 1440×900, 1280×800, 1238×728, and 1024×768 the document reported zero horizontal and vertical overflow. Media, Inspector, AI content, and Timeline retain bounded internal overflow. Preview and root panel wrappers do not create competing scroll surfaces.

At 390×843 the document intentionally owns vertical scrolling and has no horizontal overflow.
