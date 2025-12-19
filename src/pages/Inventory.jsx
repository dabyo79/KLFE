import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')   // 👈 ô tìm kiếm

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('laptop_stock') // view kho
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      alert('Lỗi tải dữ liệu kho: ' + error.message)
    } else {
      setItems(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const adjustStock = async (laptopId, currentQty, direction) => {
    const label = direction === 'in' ? 'nhập thêm' : 'xuất / bán bớt'
    const sign = direction === 'in' ? +1 : -1

    const qtyStr = window.prompt(`Bạn muốn ${label} bao nhiêu cái?`, '1')
    if (!qtyStr) return
    const qty = parseInt(qtyStr, 10)
    if (isNaN(qty) || qty <= 0) {
      alert('Số lượng không hợp lệ')
      return
    }

    if (direction === 'out' && currentQty - qty < 0) {
      const ok = window.confirm(
        `Hiện chỉ còn ${currentQty} cái, bạn vẫn muốn trừ ${qty} (tồn kho sẽ âm)?`
      )
      if (!ok) return
    }

    const reason = window.prompt('Ghi chú (lý do nhập/xuất)?', '') || null

    const { error } = await supabase.from('inventory_logs').insert({
      laptop_id: laptopId,
      change_qty: sign * qty,
      reason,
    })

    if (error) {
      alert('Lỗi ghi log kho: ' + error.message)
    } else {
      load()
    }
  }

  // ===== LỌC THEO SEARCH =====
  const filteredItems = items.filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true

    const name = (row.name || '').toLowerCase()
    const brand = (row.brand || '').toLowerCase()
    return name.includes(q) || brand.includes(q)
  })

  return (
    <div>
      {/* header + search */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">📦 Quản lý kho laptop</h4>

        <div className="input-group" style={{ maxWidth: 320 }}>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Tìm theo tên / brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setSearch('')}
            >
              X
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-muted">Đang tải...</p>}

      <table className="table table-striped align-middle mt-2">
        <thead>
          <tr>
            <th>Ảnh</th>
            <th style={{ width: '40%' }}>Sản phẩm</th>
            <th>Thương hiệu</th>
            <th className="text-center">Tồn kho</th>
            <th className="text-end">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((row) => (
            <tr key={row.id}>
              <td>
  {row.image_url ? (
    <img
      src={row.image_url}
      alt={row.name}
      style={{
        width: 60,
        height: 60,
        objectFit: 'cover',
        borderRadius: 4,
      }}
    />
  ) : (
    <span className="text-muted">Không có ảnh</span>
  )}
</td>

              <td>{row.name}</td>
              <td>{row.brand}</td>
              <td className="text-center">{row.stock_qty}</td>
              <td className="text-end">
                <button
                  className="btn btn-sm btn-outline-success me-2"
                  onClick={() => adjustStock(row.id, row.stock_qty, 'in')}
                >
                  + Nhập
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => adjustStock(row.id, row.stock_qty, 'out')}
                >
                  - Xuất
                </button>
              </td>
            </tr>
          ))}
          {filteredItems.length === 0 && !loading && (
            <tr>
              <td colSpan={4} className="text-center text-muted py-4">
                Không tìm thấy sản phẩm phù hợp
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
