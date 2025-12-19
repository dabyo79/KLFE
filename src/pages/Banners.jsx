import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const BUCKET = 'laptopbanchon'

export default function Banners() {
  const [list, setList] = useState([])
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')

  const load = async () => {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .order('sort_index', { ascending: true })   // ← dùng sort_index
    .order('created_at', { ascending: false })  // phụ, nếu muốn

  if (error) {
    alert(error.message)
    return
  }
  setList(data ?? [])
}

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async (e) => {
  e.preventDefault()
  let imageurl = ''
  if (file) {
    const ext = file.name.split('.').pop()
    const path = `banners/${crypto.randomUUID()}.${ext}`
    const { error: uploadErr } = await supabase
      .storage
      .from(BUCKET)
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      alert(uploadErr.message)
      return
    }

    imageurl = supabase
      .storage
      .from(BUCKET)
      .getPublicUrl(path).data.publicUrl
  }

  // tìm sort_index lớn nhất hiện có
  const maxSort = list.length > 0
    ? Math.max(...list.map(b => b.sort_index ?? 0))
    : 0

  const { error } = await supabase.from('banners').insert({
    title,
    imageurl,
    sort_index: maxSort + 1
  })

  if (error) alert(error.message)
  else {
    setTitle('')
    setFile(null)
    load()
  }
}



  const handleDelete = async (id) => {
    if (!confirm('Xoá banner này?')) return
    await supabase.from('banners').delete().eq('id', id)
    load()
  }
const moveBanner = async (id, direction) => {
  // direction: -1 = lên, +1 = xuống
  const index = list.findIndex((b) => b.id === id)
  if (index === -1) return

  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= list.length) return

  const current = list[index]
  const target = list[newIndex]

  // swap sort_index
  const { error: e1 } = await supabase
    .from('banners')
    .update({ sort_index: target.sort_index })
    .eq('id', current.id)

  const { error: e2 } = await supabase
    .from('banners')
    .update({ sort_index: current.sort_index })
    .eq('id', target.id)

  if (e1 || e2) {
    alert(e1?.message || e2?.message)
    return
  }

  // reload danh sách
  load()
}


  return (
    <div>
      <h4>🖼 Banners</h4>
      <form className="row g-3 mb-3" onSubmit={handleAdd}>
        <div className="col-md-4">
          <input
            className="form-control"
            placeholder="Tiêu đề"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <input
            className="form-control"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="col-md-2">
          <button className="btn btn-primary">Thêm</button>
        </div>
      </form>

      <div className="row g-3">
  {list.map((b, idx) => (
    <div className="col-md-3" key={b.id}>
      <div className="card">
        {b.imageurl && (
          <img
            src={b.imageurl}
            className="card-img-top"
            style={{ height: 120, objectFit: 'auto' }}
          />
        )}
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-semibold">{b.title}</div>
            <small className="text-muted">#{b.sort_index}</small>
          </div>

          <div className="d-flex justify-content-between">
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={idx === 0}
                onClick={() => moveBanner(b.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={idx === list.length - 1}
                onClick={() => moveBanner(b.id, +1)}
              >
                ↓
              </button>
            </div>

            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => handleDelete(b.id)}
            >
              Xoá
            </button>
          </div>
        </div>
      </div>
    </div>
  ))}
  {list.length === 0 && <p className="text-muted">Chưa có banner</p>}
</div>

    </div>
  )
}
