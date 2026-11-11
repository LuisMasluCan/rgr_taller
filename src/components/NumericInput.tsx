import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number | string
  onChange: (value: string) => void
}

function NumericInput({ value, onChange, onFocus, ...inputProps }: Props) {
  const [draft, setDraft] = useState(String(value))
  const isFocused = useRef(false)
  const displayedValue = String(value)

  useEffect(() => {
    if (!isFocused.current && draft !== displayedValue) {
      // Sync external changes while preserving an intentionally empty field.
      // oxlint-disable-next-line react/set-state-in-effect
      setDraft(displayedValue)
    }
  }, [displayedValue, draft])

  return (
    <input
      {...inputProps}
      type="number"
      value={draft}
      onFocus={(event) => {
        isFocused.current = true
        onFocus?.(event)
        if (/^0+(?:\.0+)?$/.test(event.currentTarget.value)) {
          setDraft('')
          onChange('')
        }
      }}
      onChange={(event) => {
        const nextValue = event.target.value
        setDraft(nextValue)
        onChange(nextValue)
      }}
      onBlur={(event) => {
        inputProps.onBlur?.(event)
        isFocused.current = false
        setDraft(displayedValue)
      }}
    />
  )
}

export default NumericInput
