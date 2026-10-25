import { createUniqueId } from 'solid-js';

/**
 * A word cut out of a solid rectangle: the letterforms are holes (SVG mask), so whatever is behind
 * the block shows through. The real word is kept as sr-only text; the SVG is aria-hidden.
 */
export default function KnockoutText(props: { text: string; class?: string }) {
  const id = createUniqueId();
  // Rough advance width for a bold uppercase sans at font-size 80 plus padding.
  const width = () => Math.round(props.text.length * 62 + 56);
  const height = 110;
  return (
    <span class={`inline-block align-middle ${props.class ?? ''}`}>
      <span class="sr-only">{props.text}</span>
      <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${width()} ${height}`} class="h-[1.15em] w-auto">
        <defs>
          <linearGradient id={`ko-fill-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0ea5e9" />
            <stop offset="100%" stop-color="#0369a1" />
          </linearGradient>
          <mask id={`ko-mask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={width()} height={height}>
            <rect width={width()} height={height} fill="white" />
            <text
              x="50%"
              y="54%"
              dominant-baseline="middle"
              text-anchor="middle"
              font-family="Outfit, Inter, system-ui, sans-serif"
              font-weight="800"
              font-size="80"
              letter-spacing="2"
              textLength={width() - 56}
              lengthAdjust="spacingAndGlyphs"
              fill="black"
            >
              {props.text.toUpperCase()}
            </text>
          </mask>
        </defs>
        <rect width={width()} height={height} rx="4" fill={`url(#ko-fill-${id})`} mask={`url(#ko-mask-${id})`} />
      </svg>
    </span>
  );
}
