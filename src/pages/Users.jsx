import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const COLORS = [
  '#ff6384',
  '#36a2eb',
  '#ffcd56',
  '#4bc0c0',
  '#9966ff',
  '#ff9f40',
]

export default function Users() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [userStats, setUserStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // --- state phân trang ---
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url,is_locked')
        .order('created_at', { ascending: false })
      if (!error) setUsers(data ?? [])
    }
    load()
  }, [])

  const filtered = users.filter((u) => {
    const k = search.toLowerCase()
    return (
      u.full_name?.toLowerCase().includes(k) ||
      u.email?.toLowerCase().includes(k) ||
      u.role?.toLowerCase().includes(k)
    )
  })
  const toggleLockUser = async (user) => {
  if (user.role === 'admin') {
    alert('Không thể khóa tài khoản admin')
    return
  }

  const nextLocked = !user.is_locked
  const ok = window.confirm(
    `${nextLocked ? 'KHÓA' : 'MỞ KHÓA'} tài khoản:\n${user.full_name || user.email}?`
  )
  if (!ok) return

  const { error } = await supabase
    .from('profiles')
    .update({ is_locked: nextLocked })
    .eq('id', user.id)

  if (error) {
    console.error(error)
    alert(`${nextLocked ? 'Khóa' : 'Mở khóa'} tài khoản thất bại`)
    return
  }

  setUsers((prev) =>
    prev.map((u) => (u.id === user.id ? { ...u, is_locked: nextLocked } : u))
  )

  alert(nextLocked ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản')
}

  const lockUser = async (user) => {
  if (user.role === 'admin') {
    alert('Không thể khóa tài khoản admin')
    return
  }

  const ok = window.confirm(
    `Bạn có chắc muốn KHÓA tài khoản:\n${user.full_name || user.email}?`,
  )
  if (!ok) return

  const { error } = await supabase
    .from('profiles')
    .update({ is_locked: true })
    .eq('id', user.id)

  if (error) {
    console.error(error)
    alert('Khóa tài khoản thất bại')
    return
  }

  alert('Đã khóa tài khoản')

  // cập nhật lại state users cho khỏi reload
  setUsers((prev) =>
    prev.map((u) =>
      u.id === user.id ? { ...u, is_locked: true } : u,
    ),
  )
}

  // tính toán phân trang từ filtered
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE)

  // gọi flask
  const loadUserStats = async (user) => {
    setSelectedUser(user) // lưu cả tên, avatar...
    setLoadingStats(true)
    try {
      const res = await fetch(
        `https://klcntt.onrender.com/admin/api/user_stats?user_id=${user.id}`
      )
      const data = await res.json()
      setUserStats(data)
    } catch (e) {
      console.error(e)
      setUserStats(null)
    } finally {
      setLoadingStats(false)
    }
  }

  // dữ liệu từ API
  const recentRec = userStats?.recent_recommends || [] // 5 query gần nhất
  const topClicked = userStats?.top_clicked || [] // top 10 laptop click
  const longestStay = userStats?.longest_stay || [] // laptop xem lâu nhất
  const priceBuckets = userStats?.price_buckets || {} // để vẽ doughnut

  // doughnut phân khúc giá
  const priceLabels = Object.keys(priceBuckets)
  const chartPrice = {
    labels: priceLabels,
    datasets: [
      {
        data: priceLabels.map((k) => priceBuckets[k]),
        backgroundColor: priceLabels.map((_, i) => COLORS[i % COLORS.length]),
      },
    ],
  }

  return (
    <div>
      <h4>👤 Người dùng</h4>
      <div className="input-group mb-3 mt-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1) // mỗi lần search reset về trang 1
          }}
          type="text"
          className="form-control"
          placeholder="Tìm theo tên hoặc email..."
        />
        <span className="input-group-text">
          <i className="fas fa-search"></i>
        </span>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead>
            <tr>
              <th>Ảnh</th>
              <th>Tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-muted">
                  Không có người dùng
                </td>
              </tr>
            ) : (
              paginated.map((u) => (
                <tr key={u.id}>
                  <td>
                    <img
                      src={u.avatar_url || 'https://placehold.co/40x40'}
                      alt=""
                      width="40"
                      height="40"
                      style={{ borderRadius: '50%', objectFit: 'cover' }}
                    />
                  </td>
                  <td>{u.full_name || '—'}</td>
                  <td>{u.email}</td>
                  <td>
  <span
    className={`badge bg-${
      u.role === 'admin' ? 'danger' : 'secondary'
    }`}
  >
    {u.role || 'user'}
  </span>

  {u.is_locked && (
    <span className="badge bg-dark ms-1">🔒 Đã khóa</span>
  )}
</td>

                  <td className="d-flex gap-2">
  <button
    className="btn btn-sm btn-outline-primary"
    onClick={() => loadUserStats(u)}
  >
    Xem thống kê
  </button>

  {u.role !== 'admin' && (
  <button
    className={`btn btn-sm ${
      u.is_locked ? 'btn-outline-success' : 'btn-outline-danger'
    }`}
    onClick={() => toggleLockUser(u)}
  >
    {u.is_locked ? 'Mở khóa' : 'Khóa'}
  </button>
)}

</td>

                  
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* thanh phân trang */}
      {filtered.length > 0 && (
        <div className="d-flex justify-content-between align-items-center mt-2">
          <span className="text-muted small">
            Trang {safePage}/{totalPages} • {filtered.length} người dùng
          </span>
          <div className="btn-group">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              « Trước
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Sau »
            </button>
          </div>
        </div>
      )}

      {/* panel thống kê */}
      {selectedUser && (
        <div className="mt-4">
          <h5>
            Thống kê cho user:{' '}
            {selectedUser.full_name || selectedUser.email || selectedUser.id}
          </h5>
          {loadingStats ? (
            <p>Đang tải...</p>
          ) : !userStats ? (
            <p>Không lấy được dữ liệu.</p>
          ) : (
            <div className="row">
              {/* 5 lượt dùng gợi ý gần đây */}
              <div className="col-md-6 mb-4">
                <div className="card p-3 h-100">
                  <h6>5 lượt dùng gợi ý gần đây</h6>
                  {recentRec.length === 0 ? (
                    <p className="text-muted mb-0">Chưa có dữ liệu.</p>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {recentRec.map((r) => {
                        const raw = (r.raw_query || r.query || '').trim()

                        let parsed = r.parsed_struct
                        if (parsed && typeof parsed === 'string') {
                          try {
                            parsed = JSON.parse(parsed)
                          } catch {
                            parsed = null
                          }
                        }

                        const realFilterParts = []
                        if (parsed && typeof parsed === 'object') {
                          if (parsed.filter_brand) {
                            realFilterParts.push(
                              `thương hiệu=${parsed.filter_brand}`,
                            )
                          }
                          if (parsed.min_price) {
                            realFilterParts.push(
                              `giá từ ${Number(
                                parsed.min_price,
                              ).toLocaleString('vi-VN')}đ`,
                            )
                          }
                          if (parsed.max_price) {
                            realFilterParts.push(
                              `giá đến ${Number(
                                parsed.max_price,
                              ).toLocaleString('vi-VN')}đ`,
                            )
                          }
                        }

                        let line = ''
                        if (raw) {
                          line = raw
                          if (realFilterParts.length > 0) {
                            line += ' + lọc: ' + realFilterParts.join(', ')
                          }
                        } else {
                          const intentParts = []
                          if (parsed && typeof parsed === 'object') {
                            if (parsed.brand)
                              intentParts.push(`thương hiệu=${parsed.brand}`)
                            if (parsed.budget) {
                              intentParts.push(
                                `giá≤${Number(
                                  parsed.budget,
                                ).toLocaleString('vi-VN')}đ`,
                              )
                            }
                            if (
                              parsed.usage &&
                              Array.isArray(parsed.usage) &&
                              parsed.usage.length > 0
                            ) {
                              intentParts.push(
                                `mục đích=${parsed.usage.join(', ')}`,
                              )
                            }
                          }
                          if (realFilterParts.length > 0) {
                            intentParts.push(...realFilterParts)
                          }

                          line =
                            intentParts.length > 0
                              ? 'Lọc: ' + intentParts.join(', ')
                              : '(tìm tất cả)'
                        }

                        return (
                          <li
                            key={r.id || r.created_at}
                            className="list-group-item"
                          >
                            <div className="fw-semibold">{line}</div>
                            <small className="text-muted">
                              {r.created_at
                                ? new Date(r.created_at).toLocaleString()
                                : ''}
                            </small>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* 10 laptop click gần nhất */}
              <div className="col-md-6 mb-4">
                <div className="card p-3 h-100">
                  <h6>10 laptop được click xem nhiều nhất</h6>
                  {topClicked.length === 0 ? (
                    <p className="text-muted mb-0">Chưa có click nào.</p>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {topClicked.map((c) => (
                        <li
                          key={c.laptop_id}
                          className="list-group-item d-flex align-items-center gap-2"
                        >
                          {c.image_url ? (
                            <img
                              src={c.image_url}
                              alt={c.name}
                              style={{
                                width: 40,
                                height: 40,
                                objectFit: 'cover',
                                borderRadius: 6,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                background: '#eee',
                                borderRadius: 6,
                              }}
                            />
                          )}
                          <div className="flex-grow-1">
                            <div className="fw-semibold">{c.name}</div>
                            <small className="text-muted">
                              {c.price
                                ? c.price.toLocaleString('vi-VN') + ' ₫'
                                : '—'}
                            </small>
                          </div>
                          <span className="badge bg-primary rounded-pill">
                            {c.total} lần
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* laptop xem lâu nhất */}
              <div className="col-md-6 mb-4">
                <div className="card p-3 h-100">
                  <h6>Các laptop user dừng lại lâu nhất</h6>
                  {longestStay.length === 0 ? (
                    <p className="text-muted mb-0">
                      Chưa đo được thời gian xem.
                    </p>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {longestStay.map((item) => {
                        const ms = item.duration_ms || 0
                        const seconds = Math.floor(ms / 1000)
                        const minutes = Math.floor(seconds / 60)
                        const remainSeconds = seconds % 60
                        const timeText =
                          minutes > 0
                            ? `${minutes}p ${remainSeconds}s`
                            : `${remainSeconds}s`

                        return (
                          <li
                            key={item.laptop_id}
                            className="list-group-item d-flex align-items-center gap-2"
                          >
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                style={{
                                  width: 40,
                                  height: 40,
                                  objectFit: 'cover',
                                  borderRadius: 6,
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 40,
                                  height: 40,
                                  background: '#eee',
                                  borderRadius: 6,
                                }}
                              />
                            )}
                            <div className="flex-grow-1">
                              <div className="fw-semibold">
                                {item.name || 'Không rõ tên'}
                              </div>
                              {item.created_at && (
                                <small className="text-muted">
                                  {new Date(
                                    item.created_at,
                                  ).toLocaleString()}
                                </small>
                              )}
                            </div>
                            <span className="badge bg-success rounded-pill">
                              {timeText}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* giỏ hàng của user */}
              <div className="col-md-6 mb-4">
                <div className="card p-3 h-100">
                  <h6>Sản phẩm trong giỏ</h6>
                  {userStats.carts && userStats.carts.length > 0 ? (
                    <ul className="list-group list-group-flush">
                      {userStats.carts.map((c) => (
                        <li
                          key={c.id}
                          className="list-group-item d-flex align-items-center gap-2"
                        >
                          {c.image_url ? (
                            <img
                              src={c.image_url}
                              alt={c.laptop_name}
                              style={{
                                width: 40,
                                height: 40,
                                objectFit: 'cover',
                                borderRadius: 6,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                background: '#eee',
                                borderRadius: 6,
                              }}
                            />
                          )}
                          <div className="flex-grow-1">
                            <div className="fw-semibold">
                              {c.laptop_name || c.laptop_id}
                            </div>
                            {c.price && (
                              <small className="text-muted">
                                {c.price.toLocaleString('vi-VN')} ₫
                              </small>
                            )}
                          </div>
                          <span className="badge bg-primary rounded-pill">
                            x {c.quantity || 1}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted mb-0">Chưa có gì trong giỏ.</p>
                  )}
                </div>
              </div>

              {/* phân khúc giá */}
              <div className="col-md-6 mb-4">
                <div className="card p-3 h-100">
                  <h6>Phân khúc giá user hay xem</h6>
                  {priceLabels.length === 0 ? (
                    <p className="text-muted mb-0">Chưa có dữ liệu giá.</p>
                  ) : (
                    <Doughnut data={chartPrice} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

