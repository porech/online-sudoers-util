interface HelpTextProps {
  children: string
}
export function HelpText({ children }: HelpTextProps) {
  // Plain inline help text. No tooltip/icon: the text is always shown next to
  // the control, so a duplicate title tooltip would be redundant.
  return (
    <span className="help" role="note">
      {children}
    </span>
  )
}
