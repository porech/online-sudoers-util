interface HelpTextProps {
  children: string
}
export function HelpText({ children }: HelpTextProps) {
  return (
    <span className="help" title={children} role="note">
      ⓘ {children}
    </span>
  )
}
