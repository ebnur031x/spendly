// Premium "living" brand mark: metallic gradient tile, serif S, slow shine sweep.
export default function Logo({ size = 34, word = false, wordSize = 16 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span
        className="spendly-mark"
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
      >
        <span className="spendly-mark__shine" />
        <span className="spendly-mark__s" style={{ fontSize: Math.round(size * 0.54) }}>S</span>
      </span>
      {word && <span className="spendly-word" style={{ fontSize: wordSize }}>Spendly</span>}
    </span>
  )
}
