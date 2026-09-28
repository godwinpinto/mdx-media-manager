/** The name, one span per letter (dashes accented), for the outro */
export function Wordmark({ id }: { id: string }) {
  return (
    <div id={id} className="mark">
      {[...'mdx-media-manager'].map((c, i) => (
        <span key={i} className={`ch ${c === '-' ? 'dash' : ''}`}>
          {c}
        </span>
      ))}
    </div>
  );
}
