/** Web translation of Codenotch NotchMotion (MIT; see THIRD_PARTY_NOTICES.md).
 * Swift spring response is mapped to natural angular frequency 2π / response,
 * dampingFraction to damping ratio. Sample the unit step, not an ease surrogate.
 * Finite 2-response window ends at rest. No layout/text scale transforms.
 */
export const notchMotion = {
  unfold: [0.42, 0.78], contents: [0.36, 0.82], glide: [0.5, 0.86], reading: [0.9, 0.9],
} as const;
export function springFrames(response: number, damping: number, frame: (progress: number) => Keyframe): Keyframe[] {
  const omega = 2 * Math.PI / response;
  const damped = omega * Math.sqrt(1 - damping * damping);
  return Array.from({ length: 91 }, (_, index) => {
    const time = index / 90 * response * 2;
    const value = index === 90 ? 1 : 1 - Math.exp(-damping * omega * time)
      * (Math.cos(damped * time) + damping * omega / damped * Math.sin(damped * time));
    return { ...frame(value), offset: index / 90 };
  });
}
export const reducedNotchMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Every animation, including a standalone reading ring, owns its preference
 * listener. Geometry callers set the resting styles before starting animation,
 * so cancellation immediately exposes the correct finished state. */
export function notchAnimate(element: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
  if (!element.animate || reducedNotchMotion()) return undefined;
  const animation = element.animate(frames, options);
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const cancelForPreference = () => { if (media?.matches) animation.cancel(); };
  const release = () => media?.removeEventListener?.('change', cancelForPreference);
  media?.addEventListener?.('change', cancelForPreference);
  animation.addEventListener('finish', release, { once: true });
  animation.addEventListener('cancel', release, { once: true });
  return animation;
}
export function springTo(element: Element, kind: keyof typeof notchMotion, frame: (progress: number) => Keyframe, delay = 0) {
  const [response, damping] = notchMotion[kind];
  return notchAnimate(element, springFrames(response, damping, frame), { duration: response * 2000, delay, fill: 'backwards', easing: 'linear' });
}
