interface Props {
  warning: { title: string; text: string }
}

/** Aviso crítico en la barra de conducción (no desplaza el resto de la pantalla). */
export function WarningBanner({ warning }: Props) {
  return (
    <div key={warning.title} className="warning-banner" role="alert">
      <strong>{warning.title}</strong>
      <span>{warning.text}</span>
    </div>
  )
}
