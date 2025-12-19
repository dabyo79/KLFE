import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Laptops() {
  const [list, setList] = useState([])
  const [editingId, setEditingId] = useState(null)

  // ô tìm kiếm
  const [search, setSearch] = useState('')

  // PHÂN TRANG
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10) // số dòng / trang

  // form state
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [cpu, setCpu] = useState('')
  const [ramGb, setRamGb] = useState('')
  const [storageGb, setStorageGb] = useState('')
  const [storageType, setStorageType] = useState('')
  const [gpu, setGpu] = useState('')
  const [screenSize, setScreenSize] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [purpose, setPurpose] = useState('')
  const [price, setPrice] = useState('')
  const [promoPrice, setPromoPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  const [inStock, setInStock] = useState(true)
  const [stockMap, setStockMap] = useState({})
  const [uploading, setUploading] = useState(false)

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setBrand('')
    setCpu('')
    setRamGb('')
    setStorageGb('')
    setStorageType('')
    setGpu('')
    setScreenSize('')
    setWeightKg('')
    setPurpose('')
    setPrice('')
    setPromoPrice('')
    setImageUrl('')
    setDescription('')
    setInStock(true)
  }

  const load = async () => {
    const { data, error } = await supabase
      .from('laptops')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error(error)
      alert('Lỗi tải danh sách laptop: ' + error.message)
      return
    }
    setList(data ?? [])
  }

  const loadStock = async () => {
    const { data, error } = await supabase
      .from('laptop_stock')
      .select('id, stock_qty')

    if (error) {
      console.error(error)
      return
    }

    const map = {}
    ;(data ?? []).forEach((row) => {
      map[row.id] = row.stock_qty ?? 0
    })
    setStockMap(map)
  }

  useEffect(() => {
    load()
    loadStock()
  }, [])

  // Khi search / list / pageSize đổi -> về trang 1
  useEffect(() => {
    setPage(1)
  }, [search, list.length, pageSize])

  const handleEdit = (item) => {
    setEditingId(item.id)
    setName(item.name ?? '')
    setBrand(item.brand ?? '')
    setCpu(item.cpu ?? '')
    setRamGb(item.ram_gb ?? '')
    setStorageGb(item.storage_gb ?? '')
    setStorageType(item.storage_type ?? '')
    setGpu(item.gpu ?? '')
    setScreenSize(item.screen_size ?? '')
    setWeightKg(item.weight_kg ?? '')
    setPurpose(item.purpose ?? '')
    setPrice(item.price ?? '')
    setPromoPrice(item.promo_price ?? '')
    setImageUrl(item.image_url ?? '')
    setDescription(item.description ?? '')
  }

  // upload ảnh lên Supabase Storage (JSX thuần)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${fileExt}`
      const filePath = `laptops/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('laptop-images') // đúng tên bucket
        .upload(filePath, file)

      if (uploadError) {
        console.error(uploadError)
        alert('Lỗi upload ảnh: ' + uploadError.message)
        return
      }

      const { data } = supabase.storage
        .from('laptop-images')
        .getPublicUrl(filePath)

      if (data && data.publicUrl) {
        setImageUrl(data.publicUrl)
      } else {
        alert('Không lấy được public URL của ảnh')
      }
    } catch (err) {
      console.error(err)
      alert('Có lỗi xảy ra khi upload ảnh')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Xoá laptop này?')) return
    const { error } = await supabase.from('laptops').delete().eq('id', id)
    if (error) {
      alert('Lỗi xoá: ' + error.message)
      return
    }
    if (editingId === id) resetForm()
    load()
    loadStock()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const payload = {
      name: name.trim(),
      brand: brand.trim() || null,

      cpu: cpu.trim() || null,
      ram_gb: ramGb ? Number(ramGb) : null,
      storage_gb: storageGb ? Number(storageGb) : null,
      storage_type: storageType.trim() || null,
      gpu: gpu.trim() || null,

      screen_size: screenSize ? Number(screenSize) : null,
      weight_kg: weightKg ? Number(weightKg) : null,
      purpose: purpose.trim() || null,

      price: price ? Number(price) : null,
      promo_price: promoPrice ? Number(promoPrice) : null,

      image_url: imageUrl.trim() || null,
      description: description.trim() || null,
    }

    let error
    if (editingId) {
      const res = await supabase.from('laptops').update(payload).eq('id', editingId)
      error = res.error
    } else {
      const res = await supabase.from('laptops').insert(payload)
      error = res.error
    }

    if (error) {
      alert('Lỗi lưu: ' + error.message)
      return
    }

    resetForm()
    load()
    loadStock()
  }

  // ===== LỌC THEO Ô TÌM KIẾM =====
  const filteredList = list.filter((l) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const name = (l.name || '').toLowerCase()
    const brand = (l.brand || '').toLowerCase()
    const cpu = (l.cpu || '').toLowerCase()
    return name.includes(q) || brand.includes(q) || cpu.includes(q)
  })

  // ===== PHÂN TRANG =====
  const totalItems = filteredList.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const pageItems = filteredList.slice(startIndex, endIndex)

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return
    setPage(p)
  }

  const renderPageNumbers = () => {
    const pages = []
    const maxButtons = 5
    let start = Math.max(1, currentPage - 2)
    let end = Math.min(totalPages, start + maxButtons - 1)
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1)
    }
    for (let p = start; p <= end; p++) {
      pages.push(p)
    }
    return pages
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">💻 Quản lý Laptop</h4>

        <div className="d-flex align-items-center gap-2">
          {/* chọn số dòng / trang */}
          <div className="me-2 d-flex align-items-center">
            <span className="me-1 small text-muted">Hiển thị</span>
            <select
              className="form-select form-select-sm"
              style={{ width: 80 }}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>

          {/* Ô tìm kiếm */}
          <div className="input-group" style={{ maxWidth: 320 }}>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Tìm theo tên / brand / CPU..."
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
      </div>

      {/* FORM THÊM / SỬA */}
      <form className="mb-4" onSubmit={handleSubmit}>
        {/* HÀNG 1 */}
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label">Tên laptop *</label>
            <input
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">Thương hiệu</label>
            <input
              className="form-control"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Asus, Dell..."
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">CPU</label>
            <input
              className="form-control"
              value={cpu}
              onChange={(e) => setCpu(e.target.value)}
              placeholder="i5-1240P..."
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">RAM (GB)</label>
            <input
              type="number"
              className="form-control"
              value={ramGb}
              onChange={(e) => setRamGb(e.target.value)}
              min="0"
            />
          </div>
        </div>

        {/* HÀNG 2 */}
        <div className="row g-3 mt-1">
          <div className="col-md-3">
            <label className="form-label">SSD/HDD (GB)</label>
            <input
              type="number"
              className="form-control"
              value={storageGb}
              onChange={(e) => setStorageGb(e.target.value)}
              min="0"
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">Loại ổ</label>
            <input
              className="form-control"
              value={storageType}
              onChange={(e) => setStorageType(e.target.value)}
              placeholder="SSD, HDD..."
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">Màn hình (inch)</label>
            <input
              type="number"
              step="0.1"
              className="form-control"
              value={screenSize}
              onChange={(e) => setScreenSize(e.target.value)}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">Cân nặng (kg)</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Mục đích / Tag</label>
            <input
              className="form-control"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Văn phòng, gaming, học sinh..."
            />
          </div>
        </div>

        {/* HÀNG 3 */}
        <div className="row g-3 mt-1">
          <div className="col-md-3">
            <label className="form-label">GPU</label>
            <input
              className="form-control"
              value={gpu}
              onChange={(e) => setGpu(e.target.value)}
              placeholder="RTX 3050..."
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Giá gốc</label>
            <input
              type="number"
              className="form-control"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0"
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Giá khuyến mãi</label>
            <input
              type="number"
              className="form-control"
              value={promoPrice}
              onChange={(e) => setPromoPrice(e.target.value)}
              min="0"
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Image URL (ảnh đại diện)</label>
            <input
              className="form-control mb-2"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />

            <input
              type="file"
              accept="image/*"
              className="form-control form-control-sm"
              onChange={handleFileChange}
            />
            {uploading && (
              <small className="text-muted">Đang upload ảnh...</small>
            )}
          </div>
        </div>

        {/* HÀNG 4 */}
        <div className="row g-3 mt-1">
          <div className="col-md-9">
            <label className="form-label">Mô tả</label>
            <textarea
              className="form-control"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="col-md-3 d-flex flex-column justify-content-end">
            <div className="form-check mb-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="inStockCheck"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
                disabled
              />
              <label className="form-check-label" htmlFor="inStockCheck">
                Còn hàng (trạng thái lấy theo tồn kho)
              </label>
            </div>

            <div>
              <button className="btn btn-primary me-2" type="submit">
                {editingId ? 'Cập nhật' : 'Thêm mới'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                >
                  Huỷ sửa
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* DANH SÁCH Laptops */}
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th>Ảnh</th>
              <th>Tên</th>
              <th>Brand</th>
              <th>CPU</th>
              <th>RAM</th>
              <th>SSD/HDD</th>
              <th>Giá</th>
              <th>KM</th>
              <th>Còn hàng</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((l) => (
              <tr key={l.id}>
                <td style={{ width: 70 }}>
                  {l.image_url ? (
                    <img
                      src={l.image_url}
                      alt={l.name}
                      style={{
                        width: 60,
                        height: 40,
                        objectFit: 'cover',
                        borderRadius: 4,
                      }}
                    />
                  ) : (
                    <span className="text-muted small">No img</span>
                  )}
                </td>
                <td>{l.name}</td>
                <td>{l.brand}</td>
                <td>{l.cpu}</td>
                <td>{l.ram_gb ? `${l.ram_gb} GB` : ''}</td>
                <td>{l.storage_gb ? `${l.storage_gb} GB` : ''}</td>
                <td>{l.price != null ? l.price.toLocaleString('vi-VN') : ''}</td>
                <td>
                  {l.promo_price != null
                    ? l.promo_price.toLocaleString('vi-VN')
                    : ''}
                </td>
                <td>
                  {(stockMap[l.id] ?? 0) > 0 ? (
                    <span className="badge bg-success">
                      Còn {stockMap[l.id]} cái
                    </span>
                  ) : (
                    <span className="badge bg-secondary">Hết</span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-primary me-1"
                    onClick={() => handleEdit(l)}
                  >
                    Sửa
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDelete(l.id)}
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={10} className="text-muted text-center">
                  Không tìm thấy laptop phù hợp
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* THANH PHÂN TRANG */}
      <div className="d-flex justify-content-between align-items-center mt-2">
        <div className="small text-muted">
          Đang hiển thị{' '}
          {totalItems === 0
            ? '0'
            : `${startIndex + 1}–${Math.min(endIndex, totalItems)}`}{' '}
          / {totalItems} laptop
        </div>

        <nav>
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => goToPage(currentPage - 1)}
              >
                «
              </button>
            </li>

            {renderPageNumbers().map((p) => (
              <li
                key={p}
                className={`page-item ${p === currentPage ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="page-link"
                  onClick={() => goToPage(p)}
                >
                  {p}
                </button>
              </li>
            ))}

            <li
              className={`page-item ${
                currentPage === totalPages ? 'disabled' : ''
              }`}
            >
              <button
                type="button"
                className="page-link"
                onClick={() => goToPage(currentPage + 1)}
              >
                »
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
