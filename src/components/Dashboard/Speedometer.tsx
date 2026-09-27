export function Speedometer({ speedKmh }: { speedKmh: number }) {
  // Por debajo de 0,5 km/h se muestra 0 para evitar parpadeos numéricos.
  const shown = Math.abs(speedKmh) < 0.5 ? 0 : Math.round(speedKmh)
  return (
    <div className="speedo">
      <span className="speedo-value num">{shown}</span>
      <span className="speedo-unit">km/h</span>
    </div>
  )
}
