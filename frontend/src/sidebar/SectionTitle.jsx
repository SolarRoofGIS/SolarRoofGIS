export default function SectionTitle({ children, aside }) {
  return (
    <div className="section-title">
      <h3>{children}</h3>
      {aside}
    </div>
  );
}
