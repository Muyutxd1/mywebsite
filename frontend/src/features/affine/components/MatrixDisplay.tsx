import { buildFullMatrix, fmtMatVal, type Mat } from '../lib/affineMath'

/** Live bracketed 3×3 matrix display. */
export function MatrixDisplay({
  transformMatrix,
  projectiveMode,
  projectiveG,
  projectiveH,
}: {
  transformMatrix: Mat
  projectiveMode: boolean
  projectiveG: number
  projectiveH: number
}) {
  const M = buildFullMatrix({ transformMatrix, projectiveMode, projectiveG, projectiveH })
  const rows = [
    [M[0], M[1], M[2]],
    [M[3], M[4], M[5]],
    [M[6], M[7], M[8]],
  ]
  return (
    <div className="flex items-stretch justify-center gap-1 py-1 font-mono text-sm text-fg-soft">
      <span className="w-2 rounded-l-sm border-y border-l border-border" aria-hidden />
      <table className="border-separate" style={{ borderSpacing: '0.55rem 0.15rem' }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td
                  key={j}
                  className="text-right tabular-nums text-fg"
                  style={{ minWidth: '2.4ch' }}
                >
                  {fmtMatVal(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <span className="w-2 rounded-r-sm border-y border-r border-border" aria-hidden />
    </div>
  )
}
