import { barcodeBars } from '@/lib/format';

export default function Barcode({ seed }: { seed: string }) {
  const bars = barcodeBars(seed);
  return (
    <div className="barcode" aria-hidden="true">
      {bars.map((b, i) => (
        <div key={i} style={{ width: b.width, height: `${b.height}%` }} />
      ))}
    </div>
  );
}
