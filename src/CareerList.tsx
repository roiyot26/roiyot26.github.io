import { content } from './content'

/** Years and roles only (no company names), the same list as the CV. */
export function Experience({ heading = false }: { heading?: boolean }) {
  return (
    <>
      {heading && <h2 id="l-path">{content.career.title}</h2>}
      <ol className="career">
        {content.career.experience.map((x) => (
          <li key={x.years}>
            <strong>
              {x.years}: {x.role}
            </strong>
            <span>{x.summary}</span>
          </li>
        ))}
      </ol>
    </>
  )
}
