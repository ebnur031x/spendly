import { useRef, useEffect } from 'react'
import { useToast } from '../context/ToastContext'

/* Soft-delete for any list: the real (async) delete doesn't fire until a
   10s grace window passes, undoable via the toast's "Undo" button or
   Ctrl+Z / Cmd+Z at any point during that window. Only one delete is ever
   undoable at a time — starting a new one immediately commits whatever was
   still pending, so Ctrl+Z always targets "the last thing I deleted."

   Usage: const { deleteWithUndo } = useUndoableDelete()
   deleteWithUndo({
     message: `Deleted "${item.title}"`,
     remove:  () => setItems(prev => prev.filter(i => i.id !== item.id)),  // optimistic UI removal, now
     commit:  () => api.delete(item.id),                                  // the real delete, after 10s
     restore: () => setItems(prevSnapshot),                               // undo — back to before `remove`
   }) */
export function useUndoableDelete() {
  const { toast, dismiss } = useToast()
  const pendingRef = useRef(null) // { commit, restore, timerId, toastId }

  useEffect(() => {
    function onKeyDown(e) {
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z'
      if (!isUndo || !pendingRef.current) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function commitPending() {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    pending.commit()
  }

  function undo() {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    clearTimeout(pending.timerId)
    dismiss(pending.toastId)
    pending.restore()
  }

  function deleteWithUndo({ message, remove, commit, restore }) {
    commitPending() // an earlier pending delete, if any, is no longer "the last thing" — finalize it
    remove()
    const timerId = setTimeout(commitPending, 10000)
    const toastId = toast({ message, actionLabel: 'Undo', onAction: undo, duration: 10000 })
    pendingRef.current = { commit, restore, timerId, toastId }
  }

  return { deleteWithUndo }
}
