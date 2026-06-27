import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIES, getCategoryMeta } from '../lib/categories'

const emptyItem = () => ({ title: '', amount: '', category: 'Food' })

export default function Templates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formName, setFormName] = useState('')
  const [formItems, setFormItems] = useState([emptyItem()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchTemplates() }, [])

  async function fetchTemplates() {
    const { data } = await supabase
      .from('quick_log_templates')
      .select('*')
      .order('created_at', { ascending: false })
    setTemplates(data ?? [])
    setLoading(false)
  }

  function startNew() {
    setEditingId(null)
    setFormName('')
    setFormItems([emptyItem()])
    setError('')
    setShowForm(true)
  }

  function startEdit(template) {
    setEditingId(template.id)
    setFormName(template.name)
    setFormItems(template.items.map(i => ({ ...i, amount: String(i.amount) })))
    setError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setError('')
  }

  function updateItem(index, field, value) {
    setFormItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function addItem() {
    setFormItems(prev => [...prev, emptyItem()])
  }

  function removeItem(index) {
    if (formItems.length === 1) return
    setFormItems(prev => prev.filter((_, i) => i !== index))
  }

  async function saveTemplate() {
    if (!formName.trim()) { setError('Template name is required'); return }
    const validItems = formItems.filter(i => i.title.trim() && i.amount && !isNaN(parseFloat(i.amount)) && parseFloat(i.amount) > 0)
    if (validItems.length === 0) { setError('Add at least one item with a title and amount'); return }

    setSaving(true)
    setError('')
    const items = validItems.map(i => ({
      title: i.title.trim(),
      amount: parseFloat(i.amount),
      category: i.category,
    }))

    let err
    if (editingId) {
      ;({ error: err } = await supabase
        .from('quick_log_templates')
        .update({ name: formName.trim(), items })
        .eq('id', editingId))
    } else {
      ;({ error: err } = await supabase
        .from('quick_log_templates')
        .insert({ user_id: user.id, name: formName.trim(), items }))
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false)
    setEditingId(null)
    fetchTemplates()
  }

  async function deleteTemplate(id) {
    setTemplates(prev => prev.filter(t => t.id !== id))
    const { error } = await supabase.from('quick_log_templates').delete().eq('id', id)
    if (error) fetchTemplates()
  }

  const fmt = (n) => `৳${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <main className="min-h-screen px-4 sm:px-8 py-10 max-w-3xl mx-auto fade-up">

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--n900)', letterSpacing: '-0.04em' }}>
            Your <span className="serif-accent">templates</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--n350)' }}>One-tap presets for your routine days</p>
        </div>
        {!showForm && (
          <button onClick={startNew} className="btn-ink text-sm px-5 py-2.5 rounded-full font-semibold flex-shrink-0">
            + New template
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="card p-6 mb-6 pop-in">
          <h2 className="text-base font-bold mb-5" style={{ color: 'var(--n900)' }}>
            {editingId ? 'Edit template' : 'New template'}
          </h2>

          {error && (
            <div className="mb-4 rounded-xl px-4 py-3 text-sm"
              style={{ backgroundColor: 'var(--err-bg)', color: 'var(--err-txt)', border: '1px solid var(--err-border)' }}>
              {error}
            </div>
          )}

          {/* Name */}
          <div className="mb-5">
            <label className="text-xs uppercase font-semibold mb-1.5 block" style={{ color: 'var(--n300)', letterSpacing: '0.07em' }}>
              Template name
            </label>
            <input
              type="text"
              placeholder="e.g. Uni Day, Date Night, Rest Day…"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              autoFocus
              className="w-full rounded-xl px-3.5 py-2.5 text-sm"
              style={inputStyle}
            />
          </div>

          {/* Items */}
          <div className="mb-5">
            <label className="text-xs uppercase font-semibold mb-2 block" style={{ color: 'var(--n300)', letterSpacing: '0.07em' }}>
              Items
            </label>
            <div className="flex flex-col gap-2">
              {formItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Lunch, Transport…"
                    value={item.title}
                    onChange={e => updateItem(i, 'title', e.target.value)}
                    className="flex-1 min-w-0 rounded-xl px-3.5 py-2 text-sm"
                    style={inputStyle}
                  />
                  <div className="flex items-center rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1.5px solid var(--border-2)' }}>
                    <span className="px-2 text-sm" style={{ color: 'var(--n300)' }}>৳</span>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="1"
                      value={item.amount}
                      onChange={e => updateItem(i, 'amount', e.target.value)}
                      className="w-20 py-2 pr-2 text-sm text-right tabular-nums"
                      style={{ background: 'transparent', color: 'var(--n900)', outline: 'none', border: 'none' }}
                    />
                  </div>
                  <select
                    value={item.category}
                    onChange={e => updateItem(i, 'category', e.target.value)}
                    className="rounded-xl px-2.5 py-2 text-sm flex-shrink-0"
                    style={inputStyle}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeItem(i)}
                    disabled={formItems.length === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      color: formItems.length === 1 ? 'var(--n200)' : 'var(--n400)',
                      cursor: formItems.length === 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-3 text-sm font-medium link-ink">+ Add item</button>
          </div>

          <div className="flex gap-2">
            <button onClick={saveTemplate} disabled={saving} className="btn-ink text-sm px-5 py-2.5 rounded-full font-semibold">
              {saving ? 'Saving…' : (editingId ? 'Update template' : 'Save template')}
            </button>
            <button onClick={cancelForm} className="btn-soft text-sm px-5 py-2.5 rounded-full font-medium">Cancel</button>
          </div>
        </div>
      )}

      {/* Template list */}
      {loading ? (
        <Spinner />
      ) : templates.length === 0 && !showForm ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">⚡</p>
          <p className="text-base font-semibold mb-1" style={{ color: 'var(--n700)' }}>No templates yet</p>
          <p className="text-sm mb-5" style={{ color: 'var(--n350)' }}>
            Create one to log a whole day's expenses in a single tap.
          </p>
          <button onClick={startNew} className="link-ink text-sm">Create your first template →</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map(template => {
            const total = template.items.reduce((s, i) => s + Number(i.amount), 0)
            return (
              <div key={template.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--n900)' }}>{template.name}</h3>
                    <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--n350)' }}>
                      {template.items.length} item{template.items.length !== 1 ? 's' : ''} · {fmt(total)} total
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => startEdit(template)} className="btn-soft text-xs px-3.5 py-1.5 rounded-full">Edit</button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="text-xs px-3 py-1.5 rounded-full"
                      style={{ color: 'var(--n250)' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--n250)'}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {template.items.map((item, i) => {
                    const meta = getCategoryMeta(item.category)
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                        style={{ backgroundColor: `${meta.color}12`, border: `1px solid ${meta.color}28` }}
                      >
                        <span>{meta.emoji}</span>
                        <span style={{ color: 'var(--n600)' }}>{item.title}</span>
                        <span style={{ color: 'var(--n200)' }}>·</span>
                        <span className="font-semibold tabular-nums" style={{ color: meta.color }}>{fmt(item.amount)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1.5px solid var(--border-2)',
  color: 'var(--n900)',
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border-2)', borderTopColor: 'var(--ink)' }} />
    </div>
  )
}
