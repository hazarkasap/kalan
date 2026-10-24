type CrashButtonProps = {
  onCrash: () => void
}

export function CrashButton({ onCrash }: CrashButtonProps) {
  return (
    <button type="button" className="crash" onClick={onCrash}>
      Market crash
    </button>
  )
}
