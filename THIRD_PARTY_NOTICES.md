# Third-party notices

## Motion ideas consulted, not copied

The homepage entrance, create-preview crossfade, primary-control hover, digit roll, and pricing-card hover adapt interaction ideas from 21st.dev components (Text Effect, Blur Fade, Interactive Hover Button, Number Flow, Spotlight Card). Those components are published under the MIT license and depend on framer-motion. GridOne did not copy their source. The behavior is reimplemented with the existing CSS motion tokens, `prefers-reduced-motion`, and GSAP score explanation. Button Magnetic, Dot Pattern, shaders, and particle effects were not used.

## Codenotch motion and attachment reference

The shared GridOne ContextNotch uses a web translation of the motion response/damping constants and clipped edge-attachment interaction described in Codenotch's NotchMotion.swift, NotchRootView.swift, SideNotchShape.swift, and ProviderRing.swift.

Source: https://github.com/vinzdg/codenotch
Pinned revision: 32512080d5ff506e6405b9a1a2f82264136ae06d

This is not the native application, macOS glass, or hardware integration. No provider icons or bundled assets are used. Web springs sample the damped unit-step response with angular frequency 2π/response and damping ratio dampingFraction, ending at rest after twice the response interval. This is a documented physical approximation, not a claim of pixel-identical SwiftUI timing.

MIT License

Copyright (c) 2026 Vinz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Web fonts: Geist, Geist Mono, Instrument Serif

GridOne self-hosts the WOFF2 subset files that Google Fonts serves for these families, in `public/fonts/`, unmodified. All three are licensed under the SIL Open Font License, Version 1.1; the full license text ships beside the files.

- Geist and Geist Mono: Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font). License: `public/fonts/OFL-Geist.txt`.
- Instrument Serif: Copyright 2022 The Instrument Serif Project Authors (https://github.com/Instrument/instrument-serif). License: `public/fonts/OFL-InstrumentSerif.txt`.
