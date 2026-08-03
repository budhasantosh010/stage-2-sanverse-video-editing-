# Responsive geometry

Measured CSS pixels in the real in-app browser after device-scale calibration:

| Viewport | AI | Media | Preview | Tool | Timeline | Page overflow |
|---|---:|---:|---:|---:|---:|---:|
| 1440×900 | 52×722 | 220×443 | 811×443 | 309×443 | 1356×271 | 0×0 |
| 1280×800 | overlay | 220×374 | 651×374 | 309×374 | 1197×240 | 0×0 |
| 1238×728 | overlay | 220×302 | 608×302 | 309×302 | 1153×240 | 0×0 |
| 1024×768 | overlay | collapsed | 940×309 | collapsed | 940×258 | 0×0 |
| 390×843 | off-canvas | hidden | 339×425 | hidden | 339×492 | 0 horizontal |

Every row contained exactly one native video.

At 1024, Show Media and Show Tool opened 380×645 fixed drawers. At 390, Show
Media opened a 366×719 sheet. The controls were outside the panel nodes they
reveal and horizontal overflow remained zero.
