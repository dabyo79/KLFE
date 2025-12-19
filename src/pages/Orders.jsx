import React, { useEffect, useState } from "react";


const API_BASE = "https://klcntt.onrender.com";

const STATUS_OPTIONS = [
  "Chờ xác nhận",
  "Chờ lấy hàng",
  "Chờ giao hàng",
  "Hoàn thành",
  "Đã hủy",
  "Trả hàng",
];
const STATUS_TRANSITIONS = {
  "Chờ xác nhận": ["Chờ xác nhận", "Chờ lấy hàng", "Đã hủy"],
  "Chờ lấy hàng": ["Chờ lấy hàng", "Chờ giao hàng", "Đã hủy"],
  "Chờ giao hàng": ["Chờ giao hàng", "Hoàn thành", "Trả hàng"],
  "Hoàn thành": ["Hoàn thành"],
  "Đã hủy": ["Đã hủy"],
  "Trả hàng": ["Trả hàng"],
};

function getAllowedStatuses(currentStatus) {
  return STATUS_TRANSITIONS[currentStatus] || [currentStatus];
}

function formatVnd(v) {
  if (v == null) return "";
  return (
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(v) +
    " đ"
  );
}

function formatDateTime(str) {
  if (!str) return "";
  // "2025-11-23T03:21:45.123456+00:00" -> "2025-11-23 03:21"
  return str.replace("T", " ").slice(0, 16);
}
function getStatusOptionsForOrder(o) {
  // Các trạng thái được chọn bằng tay
  const base = STATUS_OPTIONS.filter(
    (st) => st !== "Đã hủy" && st !== "Trả hàng"
  );

  // Nếu đơn hiện đang là Đã hủy / Trả hàng, vẫn phải hiển thị option đó
  // để <select value={o.status}> không bị lỗi
  if (o.status === "Đã hủy" || o.status === "Trả hàng") {
    return [o.status];
  }

  return base;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;      // muốn 50 thì để 50
  const [total, setTotal] = useState(0);
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;
  const loadOrders = async (targetPage = page) => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (keyword.trim()) params.append("q", keyword.trim());
      if (statusFilter && statusFilter !== "all")
        params.append("status", statusFilter);
      if (monthFilter) params.append("month", monthFilter);
      params.append("page", String(targetPage));
      params.append("page_size", String(PAGE_SIZE));

      const res = await fetch(
        `${API_BASE}/admin/api/orders?` + params.toString()
      );
      const data = await res.json();

      if (!data.ok) {
        setError(data.reason || "Lỗi tải đơn hàng");
        setOrders([]);
        setTotal(0);
      } else {
        setOrders(data.items || []);
        // backend trả về total tổng số bản ghi
        setTotal(data.total || 0);
        setPage(data.page || targetPage);
      }
    } catch (e) {
      console.error(e);
      setError("Không kết nối được tới server");
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };


  const loadOrderDetail = async (orderId) => {
    // click lại dòng đang mở => đóng panel chi tiết
    if (orderId === selectedOrderId) {
      setSelectedOrderId(null);
      setOrderDetail(null);
      return;
    }

    setSelectedOrderId(orderId);
    setOrderDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/api/orders/${orderId}`);
      const data = await res.json();
      if (!data.ok) {
        alert("Không tải được chi tiết đơn");
        return;
      }
      setOrderDetail(data);
    } catch (e) {
      console.error(e);
      alert("Lỗi tải chi tiết đơn");
    } finally {
      setDetailLoading(false);
    }
  };

  // đổi trạng thái đơn
  const updateOrderStatus = async (orderId, newStatus, options = {}) => {
  const { allowSpecial = false } = options;

  // Không cho set Đã hủy / Trả hàng bằng tay (ví dụ từ dropdown)
  if (!allowSpecial && (newStatus === "Đã hủy" || newStatus === "Trả hàng")) {
    alert("Không được đổi sang trạng thái Đã hủy / Trả hàng bằng tay.");
    return;
  }

  if (
    !window.confirm(
      `Xác nhận đổi trạng thái đơn này thành "${newStatus}"?`
    )
  ) {
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/admin/api/orders/${orderId}/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }
    );
    const data = await res.json();
    if (!data.ok) {
      alert("Đổi trạng thái thất bại: " + (data.reason || ""));
      return;
    }
    await loadOrders();
    if (orderId === selectedOrderId) {
      await loadOrderDetail(orderId);
    }
  } catch (e) {
    console.error(e);
    alert("Không kết nối được tới server");
  }
};


  // chấp nhận yêu cầu hủy: chỉ cần set status = "Đã hủy"
  const handleApproveCancel = async (orderId) => {
    if (!window.confirm("Xác nhận chấp nhận yêu cầu hủy đơn này?")) return;
    await updateOrderStatus(orderId, "Đã hủy", { allowSpecial: true });
  };

  // từ chối yêu cầu hủy
  const handleRejectCancel = async (orderId) => {
    const reason = window.prompt(
      "Nhập lý do từ chối yêu cầu hủy (sẽ báo lại cho khách):"
    );
    if (!reason || !reason.trim()) return;

    try {
      const res = await fetch(
        `${API_BASE}/admin/api/orders/${orderId}/reject_cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );
      const data = await res.json();
      if (!data.ok) {
        alert("Từ chối yêu cầu hủy thất bại: " + (data.reason || ""));
        return;
      }
      await loadOrders();
      if (orderId === selectedOrderId) {
        await loadOrderDetail(orderId);
      }
    } catch (e) {
      console.error(e);
      alert("Không kết nối được tới server");
    }
  };

  // chấp nhận trả hàng
  const handleAcceptReturn = async (orderId) => {
    if (!window.confirm("Xác nhận chấp nhận yêu cầu trả hàng?")) return;
    try {
      const res = await fetch(
        `${API_BASE}/admin/api/orders/${orderId}/accept_return`,
        {
          method: "POST",
        }
      );
      const data = await res.json();
      if (!data.ok) {
        alert("Xử lý yêu cầu trả hàng thất bại: " + (data.reason || ""));
        return;
      }
      await loadOrders();
      if (orderId === selectedOrderId) {
        await loadOrderDetail(orderId);
      }
    } catch (e) {
      console.error(e);
      alert("Không kết nối được tới server");
    }
  };

  // từ chối trả hàng
  const handleRejectReturn = async (orderId) => {
    const reason = window.prompt(
      "Nhập lý do từ chối trả hàng (sẽ báo lại cho khách):"
    );
    if (!reason || !reason.trim()) return;

    try {
      const res = await fetch(
        `${API_BASE}/admin/api/orders/${orderId}/reject_return`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );
      const data = await res.json();
      if (!data.ok) {
        alert("Từ chối yêu cầu trả hàng thất bại: " + (data.reason || ""));
        return;
      }
      await loadOrders();
      if (orderId === selectedOrderId) {
        await loadOrderDetail(orderId);
      }
    } catch (e) {
      console.error(e);
      alert("Không kết nối được tới server");
    }
  };

  useEffect(() => {
    loadOrders(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFilterClick = () => {
    loadOrders(1);
  };
const handleReload = () => {
  // Nếu muốn chỉ load lại dữ liệu với bộ lọc hiện tại + giữ nguyên trang:
  loadOrders(page);

  // Nếu muốn về trang 1 luôn thì dùng:
  // loadOrders(1);

  // Nếu muốn đồng thời đóng panel chi tiết:
  // setSelectedOrderId(null);
  // setOrderDetail(null);
};
  return (
    <div className="admin-orders-page">
      <div className="d-flex justify-content-between align-items-center ">
      <h1>Quản lý đơn hàng</h1>
      <button
          className="btn btn-outline-primary d-flex align-items-center gap-2  mb-2"
          onClick={handleReload}
        >
          <i className="fas fa-sync"></i> Làm mới
        </button>
        </div>
      <div className="filters-row">
        <div>
          <label>Tìm kiếm:&nbsp;</label>
          <input
            type="text"
            placeholder="Mã đơn, SĐT, ghi chú..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div>
          <label>Trạng thái:&nbsp;</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tất cả</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Tháng:&nbsp;</label>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={onFilterClick}>Lọc</button>

      </div>

      {loading ? (
        <p>Đang tải danh sách đơn...</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : orders.length === 0 ? (
        <p>Chưa có đơn nào.</p>
      ) : (
        <table className="orders-table">
  <thead>
    <tr>
      <th>Mã đơn</th>
      <th>Ngày tạo</th>
      <th>Khách / ghi chú</th>
      <th>Thanh toán</th>
      <th>Trạng thái</th>
      <th>Hủy / trả hàng</th>
      <th>Tổng</th>
      <th>Thao tác</th>
    </tr>
  </thead>
  <tbody>
    {orders.map((o) => {
        const locked = isLockedOrder(o);
        return (
        <tr
            key={o.id}
            onClick={() => loadOrderDetail(o.id)}
            className="row-clickable"
        >
        {/* Mã đơn */}
        <td>#{String(o.id).slice(-8)}</td>

        {/* Ngày tạo */}
        <td>{formatDateTime(o.created_at)}</td>

        {/* Khách + ghi chú */}
        <td>
          <div><b>SĐT:</b> {o.phone_number || "-"}</div>
          {o.content && (
            <div className="sub-text">Ghi chú: {o.content}</div>
          )}
        </td>

        {/* Thanh toán */}
        <td>{o.payment_method || "-"}</td>

        {/* Trạng thái (pill màu) */}
        <td className="status-col">
          <span className={`status-pill status-${o.status}`}>
            {o.status}
          </span>
        </td>

        {/* Hủy / trả hàng – gộp tag info */}
        <td onClick={(e) => e.stopPropagation()}>
          {/* Hủy */}
          {o.cancel_request_reason && (
            <div className="tag tag-warning">
              Yêu cầu hủy: {o.cancel_request_reason}
              {o.cancel_request_at && (
                <span className="tag-time">
                  {" "}
                  · {formatDateTime(o.cancel_request_at)}
                </span>
              )}
            </div>
          )}
          {o.cancel_reject_reason && (
            <div className="tag tag-danger">
              Từ chối hủy: {o.cancel_reject_reason}
              {o.cancel_reject_at && (
                <span className="tag-time">
                  {" "}
                  · {formatDateTime(o.cancel_reject_at)}
                </span>
              )}
            </div>
          )}

          {/* Trả hàng */}
          {o.return_request_reason && (
            <div className="tag tag-info">
              Trả hàng: {o.return_request_reason}
              {o.return_request_at && (
                <span className="tag-time">
                  {" "}
                  · {formatDateTime(o.return_request_at)}
                </span>
              )}
            </div>
          )}
          {o.return_reject_reason && (
            <div className="tag tag-muted">
              Từ chối trả: {o.return_reject_reason}
            </div>
          )}
        </td>

        {/* Tổng tiền */}
        <td>
        <div className="order-total">{formatVnd(o.total_amount)}</div>
      </td>

      <td onClick={(e) => e.stopPropagation()}>
        <select
  className="select select-sm"
  value={o.status}
  disabled={locked || o.status === "Đã hủy" || o.status === "Trả hàng"}
  onChange={(e) => updateOrderStatus(o.id, e.target.value)}
>
  {getStatusOptionsForOrder(o).map((st) => (
      <option key={st} value={st}>
        {st}
      </option>
    ))}
  </select>


        {locked && (
          <div className="locked-text">
            Đơn đã khóa chỉnh sửa sau 3 ngày
          </div>
        )}

        {!locked && o.cancel_request_reason &&
          !o.cancel_reject_reason &&
          o.status !== "Đã hủy" &&
          o.status !== "Hoàn thành" && (
            <div className="action-row">
              <button
                className="btn btn-xs btn-success"
                onClick={() => handleApproveCancel(o.id)}
              >
                Chấp nhận hủy
              </button>
              <button
                className="btn btn-xs btn-danger"
                onClick={() => handleRejectCancel(o.id)}
              >
                Từ chối hủy
              </button>
            </div>
          )}

        {!locked && o.return_request_reason && !o.return_reject_reason && o.status !== "Trả hàng" && (
          <div className="action-row">
            <button
              className="btn btn-xs btn-success"
              onClick={() => handleAcceptReturn(o.id)}
            >
              Chấp nhận trả
            </button>
            <button
              className="btn btn-xs btn-danger"
              onClick={() => handleRejectReturn(o.id)}
            >
              Từ chối trả
            </button>
          </div>
        )}
      </td>
    </tr>
  );
})}
  </tbody>
</table>
)} 
    {orders.length > 0 && (
        <div className="pagination-row">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => loadOrders(page - 1)}
          >
            ‹ Trước
          </button>

          <span className="pagination-info">
            Trang {page} / {totalPages}{" "}
            {total > 0 && `(Tổng ${total} đơn)`}
          </span>

          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => loadOrders(page + 1)}
          >
            Sau ›
          </button>
        </div>

      )}

      {selectedOrderId && (
        <div className="order-detail-box">
          {detailLoading || !orderDetail ? (
            <p>Đang tải chi tiết đơn...</p>
          ) : (
            <OrderDetailPanel detail={orderDetail} />
          )}
        </div>
      )}
    </div>
  );
}
function isLockedOrder(o) {
  if (!o.created_at) return false;
  if (o.status !== "Hoàn thành" && o.status !== "Đã hủy") return false;

  const created = new Date(o.created_at);
  const now = new Date();
  const diffMs = now - created;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 3;
}

function OrderDetailPanel({ detail }) {
  const { order, items } = detail;

  // đoán 1 số field tên khách – tùy backend của bạn
  const customerName =
    order.customer_name ||
    order.full_name ||
    "Khách hàng";

  const hasCancelInfo =
    !!order.cancel_request_reason || !!order.cancel_reject_reason;

  const hasReturnInfo =
    !!order.return_request_reason || !!order.return_reject_reason;

  return (
    <div className="order-detail-card">
      {/* Header: mã đơn + trạng thái */}
      <div className="order-detail-header">
        <div>
          <h2 className="order-detail-title">
            Chi tiết đơn <span>#{String(order.id).slice(-8)}</span>
          </h2>
          <div className="order-detail-sub">
            Tạo lúc {formatDateTime(order.created_at)}
          </div>
        </div>

        <div className={`detail-status-pill1 status-${order.status}`}>
          {order.status}
        </div>
      </div>

      {/* Lưới thông tin chính */}
      <div className="order-detail-grid">
        <div className="detail-item">
          <div className="detail-label">Khách hàng</div>
          <div className="detail-value">{customerName}</div>
        </div>

        <div className="detail-item">
          <div className="detail-label">Số điện thoại</div>
          <div className="detail-value">
            {order.phone_number || "—"}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">Địa chỉ</div>
          <div className="detail-value">
            {order.address || "—"}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">Phương thức thanh toán</div>
          <div className="detail-value">
            {order.payment_method || "—"}
          </div>
        </div>

        
      </div>

      {/* Ghi chú nếu có */}
      {order.content && (
        <div className="detail-note-block">
          <div className="detail-label">Ghi chú của khách</div>
          <div className="detail-value">{order.content}</div>
        </div>
      )}

      {/* Khối yêu cầu hủy nếu có */}
      {hasCancelInfo && (
        <div className="detail-section">
          <div className="detail-section-title">Yêu cầu hủy đơn</div>

          {order.cancel_request_reason && (
            <div className="detail-tag detail-tag-warning">
              <div className="detail-tag-label">Lý do khách hủy</div>
              <div className="detail-tag-body">
                {order.cancel_request_reason}
                {order.cancel_request_at && (
                  <span className="detail-tag-time">
                    {" · "}
                    {formatDateTime(order.cancel_request_at)}
                  </span>
                )}
              </div>
            </div>
          )}

          {order.cancel_reject_reason && (
            <div className="detail-tag detail-tag-danger">
              <div className="detail-tag-label">Lý do từ chối hủy</div>
              <div className="detail-tag-body">
                {order.cancel_reject_reason}
                {order.cancel_reject_at && (
                  <span className="detail-tag-time">
                    {" · "}
                    {formatDateTime(order.cancel_reject_at)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Khối yêu cầu trả hàng nếu có */}
      {hasReturnInfo && (
        <div className="detail-section">
          <div className="detail-section-title">Yêu cầu trả hàng</div>

          {order.return_request_reason && (
            <div className="detail-tag detail-tag-info">
              <div className="detail-tag-label">Lý do khách trả</div>
              <div className="detail-tag-body">
                {order.return_request_reason}
                {order.return_request_at && (
                  <span className="detail-tag-time">
                    {" · "}
                    {formatDateTime(order.return_request_at)}
                  </span>
                )}
              </div>
            </div>
          )}

          {order.return_reject_reason && (
            <div className="detail-tag detail-tag-muted">
              <div className="detail-tag-label">Lý do từ chối trả</div>
              <div className="detail-tag-body">
                {order.return_reject_reason}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Danh sách sản phẩm */}
      <div className="detail-section">
        <div className="detail-section-title">Sản phẩm</div>

        {(!items || items.length === 0) && (
          <p className="detail-empty">Không có sản phẩm.</p>
        )}

        {items && items.length > 0 && (
          <div className="order-products-list">
            {items.map((p) => (
              <div key={p.laptop_id} className="order-product-row">
                <img
                  src={p.image_url || "/static/noimage.png"}
                  alt={p.name || "Laptop"}
                  className="order-product-img"
                />
                <div className="order-product-info">
                  <div className="name">{p.name || "Sản phẩm"}</div>
                  <div className="sub">
                    x{p.quantity} ·{" "}
                    {formatVnd((p.price || 0) * p.quantity)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Tổng tiền ở cuối, dưới danh sách sản phẩm */}
<div className="order-detail-total-row">
  <span className="label">Tổng cộng:</span>
  <span className="value">
    {formatVnd(order.total_amount || 0)}
  </span>
</div>

    </div>
  );
}


