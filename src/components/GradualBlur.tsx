export function GradualBlur({
  position = "bottom",
  layers = 6,
  strength = 1.6,
  className = "",
}: {
  position?: "top" | "bottom";
  layers?: number;
  strength?: number;
  className?: string;
}) {
  const dir = position === "bottom" ? "to bottom" : "to top";
  const step = 100 / (layers + 1);
  return (
    <div aria-hidden className={`gblur ${className}`}>
      {Array.from({ length: layers }).map((_, i) => {
        const a = i * step;
        const mask = `linear-gradient(${dir}, rgba(0,0,0,0) ${a}%, #000 ${a + step}%, #000 ${a + step * 2}%, rgba(0,0,0,0) ${a + step * 3}%)`;
        const blur = `blur(${(Math.pow(2, i) * strength * 0.5).toFixed(2)}px)`;
        return (
          <div
            key={i}
            style={{ backdropFilter: blur, WebkitBackdropFilter: blur, maskImage: mask, WebkitMaskImage: mask }}
          />
        );
      })}
    </div>
  );
}
