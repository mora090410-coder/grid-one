# Third-party notices

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
