/** Deterministic star-field box-shadow generation for the Cosmos background. */

/** Multiplicative LCG so re-renders never reshuffle the sky. */
function lcg(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

/** Build one box-shadow star layer (one shadow per star point). */
export function makeStars(count: number, maxSize: number, color: string, seed: number): string {
  const rand = lcg(seed)
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.round(rand() * 10000) / 100
    const y = Math.round(rand() * 10000) / 100
    const size = Math.max(1, Math.round(rand() * maxSize * 10) / 10)
    parts.push(`${x}vw ${y}vh 0 ${size}px ${color}`)
  }
  return parts.join(', ')
}

/** Build one galaxy-band layer: stars concentrated along a diagonal. */
export function makeBandStars(count: number, color: string, seed: number): string {
  const rand = lcg(seed)
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const t = rand()
    const x = Math.round((t * 100 + (rand() - 0.5) * 16) * 10) / 10
    const y = Math.round((18 + t * 42 + (rand() - 0.5) * 24) * 10) / 10
    const size = Math.max(1, Math.round(rand() * 1.8 * 10) / 10)
    parts.push(`${x}vw ${y}vh 0 ${size}px ${color}`)
  }
  return parts.join(', ')
}
