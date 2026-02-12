interface LocationErrorProps {
  error: string | null
}

export function LocationError({ error }: LocationErrorProps) {
  if (!error) return null

  return (
    <div className="mt-3 p-3 bg-red-100 dark:bg-red-900 rounded-md" role="alert">
      <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
    </div>
  )
}
