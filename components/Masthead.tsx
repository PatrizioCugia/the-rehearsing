/**
 * The title treatment from the project banners: a heavy serif wordmark — "The"
 * in bright green, "Rehearsing" in dark forest green — over the white uppercase
 * production credit. Colors and font mirror scripts/banner-text.py.
 */
export default function Masthead({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <p
        className="uppercase tracking-[0.3em] text-white/90 mb-1.5"
        style={{ fontFamily: "Arial, sans-serif", fontSize: "0.62rem", fontWeight: 700 }}
      >
        An Interhuman AI Production
      </p>
      <p
        className="leading-[0.95]"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700 }}
      >
        <span className="block text-2xl md:text-[1.75rem]" style={{ color: "#148C50" }}>
          The
        </span>
        <span className="block text-5xl md:text-6xl" style={{ color: "#006437" }}>
          Rehearsing
        </span>
      </p>
    </div>
  );
}
