import { useEffect, useMemo, useState } from 'react'

// Pagination côté client d'un tableau déjà chargé. Renvoie la tranche courante
// et de quoi piloter la navigation. La page est ramenée dans les bornes si la
// liste rétrécit (ex. après suppression / filtrage).
export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  )

  return { pageItems, page, setPage, pageCount, total, pageSize }
}
