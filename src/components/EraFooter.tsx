const visits = '00420';

export default function EraFooter() {
  return (
    <div className="era" aria-hidden="true">
      <hr />
      <p>
        You are visitor number{' '}
        <span className="counter">
          {[...visits].map((digit, i) => {
            return <span key={i}>{digit}</span>;
          })}
        </span>
      </p>

      <p>Best viewed with Netscape Navigator 2.0 at 640 × 480</p>
    </div>
  );
}
