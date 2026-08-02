# Performance Observation

The production web build transformed 199 modules. Output: CSS 86.45 kB (15.16 kB gzip); JavaScript 589.63 kB (164.68 kB gzip). The existing runtime font URL remains unresolved at build time and the JavaScript chunk exceeds Vite's 500 kB advisory threshold. Neither warning blocked the local workflow; code splitting remains later optimization work, not part of P1-F.0.2.
