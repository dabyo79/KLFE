import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Bar, Line, Radar, Doughnut } from "react-chartjs-2";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
  ArcElement,
  
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
  ArcElement,

);

// bảng màu dùng chung
const BAR_COLORS = [
  "rgba(99, 102, 241, 0.7)",   // Indigo
  "rgba(59, 130, 246, 0.7)",   // Blue
  "rgba(16, 185, 129, 0.7)",   // Emerald
  "rgba(251, 191, 36, 0.7)",   // Amber
  "rgba(239, 68, 68, 0.7)",    // Red
  "rgba(168, 85, 247, 0.7)",   // Purple
  "rgba(236, 72, 153, 0.7)",   // Pink
];

function PodiumUserCard({ user, rank, variant }) {
  const badgeClass =
    variant === "first"
      ? "podium-badge-first"
      : variant === "second"
      ? "podium-badge-second"
      : "podium-badge-third";

  return (
    <div className={`podium-card podium-${variant} text-center`}>
      <div className="position-relative d-inline-block mb-2">
        <img
          src={user.avatar_url}
          alt={user.full_name}
          className="podium-avatar"
        />
        <div className={`podium-badge ${badgeClass}`}>{rank}</div>
      </div>
      <div className="fw-semibold">{user.full_name}</div>
      <small className="text-muted">
        {user.total_search} lần dùng gợi ý
      </small>
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    laptops: 0,
    banners: 0,
  });

  const [flaskData, setFlaskData] = useState(null);
  const [flaskLoading, setFlaskLoading] = useState(true);
  const [priceBucketStats, setPriceBucketStats] = useState({});
  const [usageQueryStats, setUsageQueryStats] = useState({});
  const [shipTab, setShipTab] = useState("total"); // "total" | "month"
  const [shipInTransitMonth, setShipInTransitMonth] = useState(0);
  const [shipDeliveredMonth, setShipDeliveredMonth] = useState(0);
  const [shipCancelledMonth, setShipCancelledMonth] = useState(0);
  const [shipReturnMonth, setShipReturnMonth] = useState(0);
  const [shipWaitConfirmMonth, setShipWaitConfirmMonth] = useState(0);
  const [shipWaitPickupMonth, setShipWaitPickupMonth] = useState(0);

  // viewMode: "main" = dashboard tổng, "laptop" = các biểu đồ riêng laptop
  const [viewMode, setViewMode] = useState("main");

  // dữ liệu phân bố giá laptop
  const [priceHist, setPriceHist] = useState({
    labels: [],
    counts: [],
  });
  const [priceLoading, setPriceLoading] = useState(true);
  // dữ liệu số lượng laptop theo hãng
  const [brandHist, setBrandHist] = useState({
    labels: [],
    counts: [],
  });
  const [brandLoading, setBrandLoading] = useState(true);
  // dữ liệu số lượng laptop theo mục đích sử dụng
  const [purposeHist, setPurposeHist] = useState({
    labels: [],
    counts: [],
  });
  const [purposeLoading, setPurposeLoading] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);

  // ===== SUPABASE COUNTERS =====
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: laptopCount } = await supabase
        .from("laptops")
        .select("*", { count: "exact", head: true });

      const { count: bannerCount, error: bannerErr } = await supabase
        .from("banners")
        .select("*", { count: "exact", head: true });

      setStats({
        users: userCount ?? 0,
        laptops: laptopCount ?? 0,
        banners: bannerErr ? 0 : bannerCount ?? 0,
      });

      setLoading(false);
    };

    load();
  }, []);

  // ===== FLASK LOGS =====
  useEffect(() => {
    const loadFlask = async () => {
      try {
        setFlaskLoading(true);
        const res = await fetch("https://klcntt.onrender.com/admin/api/stats_json");
        const data = await res.json();
        setFlaskData(data);
        setPriceBucketStats(data.price_query_buckets || {});
        setUsageQueryStats(data.usage_query_counts || {});
        const monthShip = data.shipping_status_this_month || {};
        setShipInTransitMonth(monthShip.in_transit || 0);
        setShipDeliveredMonth(monthShip.delivered || 0);
        setShipCancelledMonth(monthShip.cancelled || 0);
        setShipReturnMonth(monthShip.tra_hang || 0);
        setShipWaitConfirmMonth(monthShip.wait_confirm || 0);
        setShipWaitPickupMonth(monthShip.wait_pickup || 0);
      } finally {
        setFlaskLoading(false);
      }
    };

    loadFlask();
  }, [reloadKey]);

  // ===== PHÂN BỐ GIÁ LAPTOP (TỪ SUPABASE) =====
  useEffect(() => {
    const loadPrices = async () => {
      setPriceLoading(true);

      const { data, error } = await supabase
        .from("laptops")
        .select("id, price");

      if (error) {
        console.error("Lỗi load giá laptop:", error);
        setPriceHist({ labels: [], counts: [] });
        setPriceLoading(false);
        return;
      }

      // định nghĩa các khoảng giá (đơn vị: triệu)
      const bins = [
        { min: 0, max: 10, label: "0–10" },
        { min: 10, max: 15, label: "10–15" },
        { min: 15, max: 20, label: "15–20" },
        { min: 20, max: 25, label: "20–25" },
        { min: 25, max: 30, label: "25–30" },
        { min: 30, max: 40, label: "30–40" },
        { min: 40, max: 50, label: "40–50" },
        { min: 50, max: Infinity, label: "Trên 50" },
      ];

      const counts = Array(bins.length).fill(0);

      (data || []).forEach((row) => {
        if (row.price == null) return;

        // giả sử price lưu VND, đổi sang triệu
        const priceMillions = row.price / 1000000;

        const idx = bins.findIndex(
          (b) => priceMillions >= b.min && priceMillions < b.max
        );
        if (idx >= 0) counts[idx] += 1;
      });

      setPriceHist({
        labels: bins.map((b) => b.label),
        counts,
      });

      setPriceLoading(false);
    };

    loadPrices();
  }, []);
  // ===== PHÂN BỐ SỐ LƯỢNG LAPTOP THEO HÃNG =====
useEffect(() => {
  const loadBrandCounts = async () => {
    setBrandLoading(true);

    const { data, error } = await supabase
      .from("laptops")
      .select("id, brand");

    if (error) {
      console.error("Lỗi load brand laptop:", error);
      setBrandHist({ labels: [], counts: [] });
      setBrandLoading(false);
      return;
    }

    const counter = {};

    (data || []).forEach((row) => {
      const brand = (row.brand || "").trim();
      if (!brand) return;
      const key = brand.toUpperCase(); // hiển thị nhất quán
      counter[key] = (counter[key] || 0) + 1;
    });

    const entries = Object.entries(counter); // [ [ "DELL", 5 ], ... ]
    // sort giảm dần theo số lượng
    entries.sort((a, b) => b[1] - a[1]);

    setBrandHist({
      labels: entries.map((e) => e[0]),
      counts: entries.map((e) => e[1]),
    });

    setBrandLoading(false);
  };

  loadBrandCounts();
}, []);

// ===== PHÂN BỐ SỐ LƯỢNG LAPTOP THEO MỤC ĐÍCH SỬ DỤNG =====
useEffect(() => {
  const loadPurposeCounts = async () => {
    setPurposeLoading(true);

    const { data, error } = await supabase
      .from("laptops")
      .select("id, purpose");

    if (error) {
      console.error("Lỗi load purpose laptop:", error);
      setPurposeHist({ labels: [], counts: [] });
      setPurposeLoading(false);
      return;
    }

    const counter = {};

    (data || []).forEach((row) => {
      let p = (row.purpose || "").trim();
      if (!p) return;

      // chuẩn hoá hiển thị (VD: viết hoa chữ cái đầu)
      p = p.toLowerCase();
      const mapping = {
        hoc: "Học tập",
        "học tập": "Học tập",
        gaming: "Gaming",
        "văn phòng": "Văn phòng",
        "van phong": "Văn phòng",
        "doanh nhân": "Doanh nhân",
        "lap trinh": "Lập trình",
        "lập trình": "Lập trình",
        "đồ họa": "Đồ hoạ",
        "do hoa": "Đồ hoạ",
      };
      const display = mapping[p] || row.purpose; // nếu không map được thì dùng nguyên gốc

      counter[display] = (counter[display] || 0) + 1;
    });

    const entries = Object.entries(counter); // [ [ "Gaming", 5 ], ... ]
    // sort giảm dần cho dễ nhìn
    entries.sort((a, b) => b[1] - a[1]);

    setPurposeHist({
      labels: entries.map((e) => e[0]),
      counts: entries.map((e) => e[1]),
    });

    setPurposeLoading(false);
  };

  loadPurposeCounts();
}, []);

  // ====== TÁCH DỮ LIỆU TỪ FLASK ======
  const logs = flaskData?.logs || [];
  const trafficLogs = flaskData?.traffic_logs || [];
  // ====== Thống kê cửa hàng từ Flask ======
const revenue = flaskData?.revenue || {};
const ordersSummary = flaskData?.orders_summary || {};
const shippingStatus = flaskData?.shipping_status || {};

const conversion = flaskData?.conversion || {};

const revenueToday = revenue.today || 0;
const revenue7Days = revenue.last7_days || 0;
const revenueThisMonth = revenue.this_month || 0;
const revenuePrevMonth = revenue.prev_month || 0;
const revenueChangePercent = revenue.month_change_percent ?? null;

const ordersToday = ordersSummary.today || 0;
const ordersPending = ordersSummary.pending || 0;
const ordersSuccess = ordersSummary.success || 0;
const ordersCancelled = ordersSummary.cancelled || 0;

const ordersWaitConfirm = ordersSummary.pending_wait_confirm || 0;
const ordersWaitPickup = ordersSummary.pending_wait_pickup || 0;
const ordersShipping = ordersSummary.pending_shipping || 0;



const conversionRate = conversion.rate || 0;

  const topSearchUsers = (flaskData?.top_search_users || []).slice(0, 20);
  const brandFromLogs = (flaskData?.brand_from_logs || [])
    .slice()
    .sort((a, b) => (b.total || 0) - (a.total || 0));

  const topClicked = flaskData?.top_clicked_laptops || [];
  const topCart = flaskData?.top_cart_laptops || [];
  const topSold30 = flaskData?.top_sold_laptops_30d || [];

// Map loại truy vấn → nhãn tiếng Việt


// ===== Thống kê theo loại truy vấn (query_type) =====
const queryTypeStats = (() => {
  if (!logs.length) return { labels: [], counts: [] };

  const map = new Map();

  logs.forEach((log) => {
    let t = (log.query_type || "khác").toString().trim().toLowerCase();

    // chuẩn hóa
    if (t === "filter_only") t = "filter_only";
    if (t === "keyword")     t = "keyword";
    if (t === "hybrid")      t = "hybrid";
    if (t === "content_rec") t = "content_rec";

    map.set(t, (map.get(t) || 0) + 1);
  });

  const labelMap = {
    keyword:      "Tìm theo từ khóa",
    filter_only:  "Lọc theo điều kiện",
    hybrid:       "Kết hợp (keyword + lọc)",
    content_rec:  "Gợi ý theo ML",
    "khác":       "Khác",
  };

  const keys   = Array.from(map.keys());
  const labels = keys.map(k => labelMap[k] || k);
  const counts = keys.map(k => map.get(k));

  return { labels, counts };
})();


const queryTypeChartData = {
  labels: queryTypeStats.labels,
  datasets: [
    {
      label: "Số truy vấn",
      data: queryTypeStats.counts,
      backgroundColor: queryTypeStats.labels.map(
        (_, i) => BAR_COLORS[i % BAR_COLORS.length]
      ),
      borderColor: queryTypeStats.labels.map(
        (_, i) => BAR_COLORS[i % BAR_COLORS.length].replace("0.7", "1")
      ),
      borderWidth: 1,
      borderRadius: 10,
    },
  ],
};
const commonNoLegend = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true },
  },
};

const queryTypeChartOptions = {
  ...commonNoLegend,
  scales: {
    x: {
      title: { display: true, text: "Loại truy vấn" },
      ticks: {
        callback: function (value) {
          const label = this.getLabelForValue(value);
          if (!label) return "";

          // Nếu label dài thì tách thành nhiều dòng
          const maxLen = 12; // độ dài tối đa mỗi dòng
          if (label.length <= maxLen) return label;

          // Tự động xuống dòng
          const words = label.split(" ");
          let lines = [];
          let current = "";

          words.forEach((w) => {
            if ((current + " " + w).trim().length > maxLen) {
              lines.push(current);
              current = w;
            } else {
              current += (current ? " " : "") + w;
            }
          });
          if (current) lines.push(current);

          return lines; // Chart.js sẽ tự xuống dòng
        },
      },
    },
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 },
      title: { display: true, text: "Số truy vấn" },
    },
  },
};


  // ===== Thống kê truy vấn theo khoảng giá =====
// ===== Thống kê truy vấn theo khoảng giá =====
const queryPriceHist = (() => {
  const stats = priceBucketStats || {};

  // 1. Thứ tự cố định mà bạn muốn hiển thị
  const labelOrder = ["<10tr", "10-20tr", "20-30tr", "30-40tr", ">40tr", "Tất cả"];

  // 2. labels chính là labelOrder
  const labels = labelOrder;

  // 3. counts lấy theo đúng thứ tự đó
  const counts = labelOrder.map((label) => stats[label] || 0);

  return { labels, counts };
})();



const queryPriceChartData = {
  labels: queryPriceHist.labels,
  datasets: [
    {
      label: "Số truy vấn",
      data: queryPriceHist.counts,
      backgroundColor: "rgba(33, 150, 243, 0.7)",
      borderColor: "rgba(33, 150, 243, 1)",
      borderWidth: 1,
      borderRadius: 10,
      barThickness: 28,
    },
  ],
};

const queryPriceChartOptions = {
  ...commonNoLegend,
  scales: {
    x: {
      title: { display: true, text: "Khoảng giá (triệu VNĐ)" },
    },
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 },
      title: { display: true, text: "Số truy vấn" },
    },
  },
};

// ===== Thống kê truy vấn theo mục đích =====
const queryPurposeHist = (() => {
  const stats = usageQueryStats;
  const labels = Object.keys(stats);
  const counts = labels.map((k) => stats[k] || 0);
  return { labels, counts };
})();


const queryPurposeChartData = {
  labels: queryPurposeHist.labels,
  datasets: [
    {
      label: "Số truy vấn",
      data: queryPurposeHist.counts,
      backgroundColor: queryPurposeHist.labels.map(
        (_, i) => BAR_COLORS[i % BAR_COLORS.length]
      ),
      borderColor: queryPurposeHist.labels.map(
        (_, i) => BAR_COLORS[i % BAR_COLORS.length].replace("0.7", "1")
      ),
      borderWidth: 1,
      borderRadius: 10,
    },
  ],
};

const queryPurposeChartOptions = {
  ...commonNoLegend,
  scales: {
    x: {
      title: { display: true, text: "Mục đích sử dụng" },
      ticks: {
        callback: function (value) {
          const label = this.getLabelForValue(value);
          if (!label) return "";
          const maxLen = 14;
          if (label.length <= maxLen) return label;
          return [label.slice(0, maxLen), label.slice(maxLen)];
        },
      },
    },
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 },
      title: { display: true, text: "Số truy vấn" },
    },
  },
};

// ===== Thống kê truy vấn theo kênh (Web / Chatbot / App) =====
const channelStats = (() => {
  if (!logs.length) return { labels: [], counts: [], total: 0 };

  const map = new Map();

  const normalizeChannel = (raw) => {
    if (!raw) return "Khác";
    const s = String(raw).toLowerCase();

    if (s.includes("android") || s.includes("app")) return "App Android";
    if (s.includes("chatbot") || s.includes("bot"))
      return "Chatbot";
    if (s.includes("web") || s.includes("form")) return "Web form";

    return "Khác";
  };

  logs.forEach((log) => {
  const raw = log.device;  // lấy đúng field device
  const label = normalizeChannel(raw);
  map.set(label, (map.get(label) || 0) + 1);
});


  const labels = Array.from(map.keys());
  const counts = labels.map((l) => map.get(l));
  const total = counts.reduce((sum, v) => sum + v, 0);

  return { labels, counts, total };
})();

const channelChartData = {
  labels: channelStats.labels,
  datasets: [
    {
      label: "Số truy vấn",
      data: channelStats.counts,
      backgroundColor: "rgba(102, 187, 106, 0.9)",
      borderColor: "rgba(56, 142, 60, 1)",
      borderWidth: 1,
      borderRadius: 10,
      barThickness: 36,
    },
  ],
};

const channelChartOptions = {
  ...commonNoLegend,
  scales: {
    x: {
      title: { display: true, text: "Kênh truy vấn" },
    },
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 },
      title: { display: true, text: "Số truy vấn" },
    },
  },
};

  // ====== 1. Lượt gợi ý 7 ngày gần nhất (ngang) ======
const searchesByDate = {};
logs.forEach((item) => {
  const d = item.created_at ? item.created_at.slice(0, 10) : "không rõ";
  searchesByDate[d] = (searchesByDate[d] || 0) + 1;
});

// Tạo mảng 7 ngày gần nhất (tính theo today)
const today = new Date();
const latest7 = [];

for (let i = 6; i >= 0; i--) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
  latest7.push(dateStr);
}


const flaskLineData = {
  labels: latest7,
  datasets: [
    {
      label: "Lượt gợi ý",
      data: latest7.map((d) => searchesByDate[d]),
      borderColor: "rgba(54, 235, 123, 1)",          // đường xanh
      backgroundColor: "rgba(54, 235, 151, 0.15)",   // fill nhẹ dưới đường
      fill: true,
      tension: 0.3,          // đường cong nhẹ
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: "rgba(54, 235, 111, 1)",
    },
  ],
};


  const flaskLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: true,
      callbacks: {
        label: (ctx) => `Lượt gợi ý: ${ctx.parsed.y}`,
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        maxRotation: 0,
        minRotation: 0,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        display: true,
      },
      ticks: {
        // tuỳ data thật, bạn có thể chỉnh stepSize cho phù hợp
        stepSize: 10,
      },
    },
  },
};


  

  // ===== traffic theo giờ hôm nay =====
  const trafficToday = (() => {
    if (!trafficLogs.length) return { labels: [], counts: [] };

    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();

    const counts = Array(24).fill(0);

    trafficLogs.forEach((l) => {
      let rawTs = l.ts || l.created_at;
      if (!rawTs) return;

      if (
        typeof rawTs === "string" &&
        rawTs.includes(" ") &&
        !rawTs.includes("T")
      ) {
        rawTs = rawTs.replace(" ", "T");
      }

      const d = new Date(rawTs);
      if (Number.isNaN(d.getTime())) return;

      if (
        d.getFullYear() !== todayY ||
        d.getMonth() !== todayM ||
        d.getDate() !== todayD
      ) {
        return;
      }

      const hour = d.getHours();
      if (hour >= 0 && hour < 24) {
        counts[hour] = (counts[hour] || 0) + 1;
      }
    });

    const allLabels = Array.from({ length: 24 }, (_, h) =>
      `${h.toString().padStart(2, "0")} giờ`
    );

    const currentHour = now.getHours();
    const upto = currentHour + 1;

    return {
      labels: allLabels.slice(0, upto),
      counts: counts.slice(0, upto),
    };
  })();

  const trafficLineData = {
    labels: trafficToday.labels,
    datasets: [
      {
        label: "Lượt truy cập",
        data: trafficToday.counts,
        borderColor: "rgba(255, 159, 64, 1)",
        backgroundColor: "rgba(255, 159, 64, 0.15)",
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: "#000",
        borderWidth: 2,
        borderDash: [6, 4],
      },
    ],
  };
  const trafficLineOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  // ====== 2. chart top user dùng gợi ý ======
  // Biểu đồ tiến trình cho Top Users
// Màu xám xanh đơn sắc
const BASE_BAR = "rgba(100, 116, 139, 0.7)";
const HIGHLIGHT_BAR = "rgba(100, 116, 139, 1)"; // cho top 1

const maxTopUserValue = topSearchUsers.length
  ? Math.max(...topSearchUsers.map((u) => u.total_search || 0))
  : 0;

const chartTopUsers = {
  labels: topSearchUsers.map((u) => u.full_name || u.user_id),
  datasets: [
    {
      label: "Số lần dùng gợi ý",
      data: topSearchUsers.map((u) => u.total_search || 0),
      backgroundColor: topSearchUsers.map((u) =>
        (u.total_search || 0) === maxTopUserValue ? HIGHLIGHT_BAR : BASE_BAR
      ),
      borderColor: topSearchUsers.map((u) =>
        (u.total_search || 0) === maxTopUserValue
          ? HIGHLIGHT_BAR
          : BASE_BAR.replace("0.7", "1")
      ),
      borderWidth: 1,
      barThickness: 18,
      borderRadius: 6,
      categoryPercentage: 0.7,
      barPercentage: 0.8,
    },
  ],
};
// Sắp xếp user theo số lần dùng gợi ý (giảm dần)
const rankedUsers = [...(topSearchUsers || [])]
  .map((u) => ({
    ...u,
    total_search: u.total_search || 0,
  }))
  .sort((a, b) => b.total_search - a.total_search);


const topUsersOptions = {
  responsive: true,
  plugins: {
    legend: { display: false },
  },
  indexAxis: "y", // 👉 thanh ngang
  layout: {
    padding: { top: 10, bottom: 10, left: 5, right: 20 },
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
      },
      title: {
        display: true,
        text: "Số lần dùng gợi ý",
      },
      grid: {
        display: true,
      },
    },
    y: {
      grid: {
        display: false,
      },
      ticks: {
        padding: 8,
        callback: function (value) {
          const label = this.getLabelForValue(value);
          if (!label) return "";
          const maxLen = 18;
          return label.length <= maxLen
            ? label
            : label.slice(0, maxLen) + "…";
        },
      },
    },
  },
};



  // ====== 3. chart brand ======  
  // Sắp xếp brand theo lượt tìm (giảm dần)
const sortedBrandFromLogs = [...brandFromLogs].sort(
  (a, b) => b.total - a.total
);

const brandChartData = {
  labels: sortedBrandFromLogs.map((b) => b.brand.toUpperCase()),
  datasets: [
    {
      label: "Số lần được tìm",
      data: sortedBrandFromLogs.map((b) => b.total),
      backgroundColor: sortedBrandFromLogs.map(
        (_, i) => BAR_COLORS[i % BAR_COLORS.length]
      ),
      borderColor: "#ffffff",
      borderWidth: 2,
      hoverOffset: 8,
    },
  ],
};

// Nếu muốn option riêng cho biểu đồ tròn
const brandChartOptions = {
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 14,
        font: { size: 11 },
      },
    },
  },
  maintainAspectRatio: false,
};

  const GREEN_PALETTE_10 = [
  "#002400", // 1 đậm nhất
  "#003300", // 2
  "#004d00", // 3
  "#006600", // 4
  "#008000", // 5
  "#009933", // 6
  "#00b34c", // 7
  "#00cc66", // 8
  "#5be389ff", // 9
  "#80e8a3ff"  // 10 nhạt nhất
];

  // ====== 4. chart laptop click ======
  const clickedChartData = {
    labels: topClicked.map((x) => x.name || x.laptop_id),
    datasets: [
      {
        label: "Lượt click",
        data: topClicked.map((x) => x.total_click),
        backgroundColor: topClicked.map(
          (_, i) => GREEN_PALETTE_10[i % GREEN_PALETTE_10.length]
        ),
        borderColor: topClicked.map(
          (_, i) => GREEN_PALETTE_10[i % GREEN_PALETTE_10.length].replace("0.7", "1")
        ),
        borderWidth: 1,
      },
    ],
  };
  const clickedChartOptions = {
    ...commonNoLegend,
    scales: {
      x: {
        ticks: {
          callback: function (value) {
            const label = this.getLabelForValue(value);
            if (!label) return "";
            const maxLen = 12;
            if (label.length <= maxLen) return label;
            return [label.slice(0, maxLen), label.slice(maxLen, maxLen * 2)];
          },
        },
      },
      y: { beginAtZero: true },
    },
  };
const BLUE_PALETTE_10 = [
  "#050e4f",
  "#07166f",
  "#0a1f8f",
  "#102ca7",
  "#1a3fb7",
  "#2557c0",
  "#3273c9",
  "#4a94dd",
  "#32b0e6",
  "#19cbee", // 1 sáng nhất (cyan)

  
];

  // ====== 5. chart laptop trong giỏ ======
  const cartChartData = {
    labels: topCart.map((x) => x.name || x.laptop_id),
    datasets: [
      {
        label: "Số lần nằm trong giỏ",
        data: topCart.map((x) => x.total_cart || 0),
        backgroundColor: topCart.map(
          (_, i) => BLUE_PALETTE_10[i % BLUE_PALETTE_10.length]
        ),
        borderColor: topCart.map(
          (_, i) => BLUE_PALETTE_10[i % BLUE_PALETTE_10.length].replace("0.7", "1")
        ),
        borderWidth: 1,
      },
    ],
  };
  const cartChartOptions = {
    ...clickedChartOptions,
  };
  // ====== 7. chart top laptop bán chạy 30 ngày ======
const soldChartData = {
  labels: topSold30.map((x) => x.name || x.laptop_id),
  datasets: [
    {
      label: "Số lượng bán (30 ngày)",
      data: topSold30.map(
        (x) => x.total_sold_30d ?? x.total_sold ?? 0
      ),
      backgroundColor: "rgba(255, 159, 64, 0.9)",   // cam
      borderColor: "rgba(255, 159, 64, 1)",
      borderWidth: 1,
      borderRadius: 8,
      barThickness: 24,
    },
  ],
};

const soldChartOptions = {
  ...commonNoLegend,
  scales: {
    x: {
      ticks: {
        callback: function (value) {
          const label = this.getLabelForValue(value);
          if (!label) return "";
          const maxLen = 14;
          if (label.length <= maxLen) return label;
          return [label.slice(0, maxLen), label.slice(maxLen, maxLen * 2)];
        },
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
      },
      title: {
        display: true,
        text: "Số lượng bán (30 ngày)",
      },
    },
  },
};

  // ====== 6. chart phân bố mức giá laptop ======
  const priceHistData = {
  labels: priceHist.labels,
  datasets: [
    {
      label: "Số mẫu laptop",
      data: priceHist.counts,
      backgroundColor: "rgba(92, 107, 192, 0.7)", // xanh tím
      borderColor: "rgba(92, 107, 192, 1)",       // viền xanh tím đậm hơn
      borderWidth: 1,
      borderRadius: 16,
      barThickness: 30,
    },
  ],
};


  const priceHistOptions = {
    ...commonNoLegend,
    scales: {
      x: {
        title: {
          display: true,
          text: "Khoảng giá (triệu VNĐ)",
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
        title: {
          display: true,
          text: "Số lượng mẫu laptop",
        },
      },
    },
  };
const BRAND_GRADIENT_COLORS = [
  
  "rgba(100, 181, 246, 0.9)",
  "rgba(66, 165, 245, 0.9)",
  "rgba(33, 150, 243, 0.9)",  // xanh nước biển
  "rgba(30, 136, 229, 0.9)",
  "rgba(25, 118, 210, 0.9)",
  "rgba(21, 101, 192, 0.9)",
  "rgba(13, 71, 161, 0.9)",   // xanh rất đậm
];
// màu tăng dần: xanh da trời → xanh nước biển → xanh đậm → tím xanh


  // ====== Biểu đồ số lượng laptop theo hãng ======
// màu bắt đầu (xanh dương) và kết thúc (tím đậm)
// brandCounts là mảng số lượng, bạn đã có ở trên:
const brandCounts = brandHist.counts || [];

const brandLaptopsData = {
  labels: brandHist.labels,
  datasets: [
    {
      label: "Số mẫu laptop",
      data: brandCounts,
      backgroundColor: brandCounts.map((_, i) => {
        const n = brandCounts.length || 1;
        const paletteLen = BRAND_GRADIENT_COLORS.length;

        if (n === 1) {
          // nếu chỉ có 1 hãng thì dùng màu đậm
          return BRAND_GRADIENT_COLORS[paletteLen - 1];
        }

        // brandFromLogs / brandHist đã sort giảm dần:
        // i = 0  -> hãng nhiều nhất  -> màu ĐẬM NHẤT
        // i = n-1-> hãng ít nhất     -> màu NHẠT NHẤT
        const t = i / (n - 1); // 0..1
        const idxFromLightToDark = Math.round(t * (paletteLen - 1));
        const idx = (paletteLen - 1) - idxFromLightToDark; // đảo lại: 0 -> đậm, n-1 -> nhạt

        return BRAND_GRADIENT_COLORS[idx];
      }),
      borderColor: brandCounts.map((_, i) => {
        const n = brandCounts.length || 1;
        const paletteLen = BRAND_GRADIENT_COLORS.length;

        if (n === 1) {
          return BRAND_GRADIENT_COLORS[paletteLen - 1].replace("0.9", "1");
        }

        const t = i / (n - 1);
        const idxFromLightToDark = Math.round(t * (paletteLen - 1));
        const idx = (paletteLen - 1) - idxFromLightToDark;

        return BRAND_GRADIENT_COLORS[idx].replace("0.9", "1");
      }),
      borderWidth: 1,
      borderRadius: 0,
      barPercentage: 1,
      categoryPercentage: 0.6,
    },
  ],
};





const brandLaptopsOptions = {
  responsive: true,
  plugins: {
    legend: { display: false },
  },
  indexAxis: "y", // bar ngang
  layout: {
    padding: {
      top: 10,
      bottom: 10,
      left: 5,
      right: 15,
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
      },
      title: {
        display: true,
        text: "Số lượng mẫu laptop",
      },
      grid: {
        display: true,
      },
    },
    y: {
      offset: true, // 👈 chừa thêm khoảng trên/dưới cho các bar
      title: {
        display: true,
        text: "Hãng",
      },
      ticks: {
        padding: 12, // 👈 nhãn và bar cách nhau xa hơn
        callback: function (value) {
          const label = this.getLabelForValue(value);
          if (!label) return "";
          const maxLen = 10;
          if (label.length <= maxLen) return label;
          return [label.slice(0, maxLen), label.slice(maxLen)];
        },
      },
      grid: {
        display: false,
      },
    },
  },
};

// ====== Biểu đồ số lượng laptop theo mục đích sử dụng ======
// ====== Biểu đồ số lượng laptop theo mục đích sử dụng (Radar) ======
const purposeChartData = {
  labels: purposeHist.labels,
  datasets: [
    {
      label: "Số mẫu laptop",
      data: purposeHist.counts,
      backgroundColor: "rgba(54, 162, 235, 0.3)",
      borderColor: "rgba(54, 162, 235, 1)",
      pointBackgroundColor: "rgba(54, 162, 235, 1)",
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    },
  ],
};

const purposeChartOptions = {
  responsive: true,
  plugins: {
    legend: { display: false },
  },
  scales: {
    r: {
      beginAtZero: true,
      ticks: {
        stepSize: 3,
      },
      pointLabels: {
        font: {
          size: 12,
        },
      },
      grid: {
        circular: true,
        color: "rgba(0, 0, 0, 0.18)", // 👈 màu đường vòng (đậm hơn)
        lineWidth: 1.2,               // 👈 độ dày đường vòng
      },
      angleLines: {
        color: "rgba(0, 0, 0, 0.12)", // nếu muốn mấy tia từ tâm đậm hơn/nhạt hơn
        lineWidth: 1,
      },
    },
  },
};

// ====== Biểu đồ so sánh Precision@K giữa Baseline vs Content-based ======
const modelPkLabels = ["K = 3", "K = 5", "K = 10"];

const baselinePrecision = [0.42, 0.40, 0.37];   
const contentPrecision  = [0.68, 0.65, 0.61];

const baselineRecall = [0.30, 0.33, 0.36];
const contentRecall  = [0.55, 0.59, 0.63];


// ====== Biểu đồ gộp Precision@K + Recall@K ======
// ====== Precision@K ======
const precisionChartData = {
  labels: modelPkLabels,
  datasets: [
    {
      label: "Baseline",
      data: baselinePrecision,
      backgroundColor: "rgba(144, 202, 249, 0.9)", // xanh dương nhạt
      borderRadius: 8,
      barThickness: 28,
    },
    {
      label: "Content-based",
      data: contentPrecision,
      backgroundColor: "rgba(94, 53, 177, 0.9)", // tím đậm
      borderRadius: 8,
      barThickness: 28,
    },
  ],
};

const precisionChartOptions = {
  responsive: true,
  plugins: {
    legend: {
      display: true,
      position: "top",
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const v = ctx.raw ?? 0;
          return `${ctx.dataset.label}: ${(v * 100).toFixed(1)}%`;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 1,
      ticks: {
        stepSize: 0.1,
        callback: (value) => `${value * 100}%`,
      },
      title: {
        display: true,
        text: "Precision@K",
      },
    },
    x: {
      title: {
        display: true,
        text: "K (số lượng gợi ý đầu)",
      },
    },
  },
  categoryPercentage: 0.7,
  barPercentage: 0.9,
};

// ====== Recall@K ======
const recallChartData = {
  labels: modelPkLabels,
  datasets: [
    {
      label: "Baseline",
      data: baselineRecall,
      backgroundColor: "rgba(129, 212, 250, 0.9)", // xanh dương sáng
      borderRadius: 8,
      barThickness: 28,
    },
    {
      label: "Content-based",
      data: contentRecall,
      backgroundColor: "rgba(0, 151, 167, 0.9)", // xanh ngọc đậm
      borderRadius: 8,
      barThickness: 28,
    },
  ],
};

const recallChartOptions = {
  responsive: true,
  plugins: {
    legend: {
      display: true,
      position: "top",
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const v = ctx.raw ?? 0;
          return `${ctx.dataset.label}: ${(v * 100).toFixed(1)}%`;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 1,
      ticks: {
        stepSize: 0.1,
        callback: (value) => `${value * 100}%`,
      },
      title: {
        display: true,
        text: "Recall@K",
      },
    },
    x: {
      title: {
        display: true,
        text: "K (số lượng gợi ý đầu)",
      },
    },
  },
  categoryPercentage: 0.7,
  barPercentage: 0.9,
};


// ====== Thời gian phản hồi trung bình (demo) ======
// TODO: sau này bạn đo thật rồi thay 3 số này
const responseTimeLabels = [
  "App Android",
  "Chatbot",
 
];

// đơn vị: mili-giây (ms) – ví dụ
const avgResponseTimes = [240, 310, 280];

const responseTimeLineData = {
  labels: responseTimeLabels,
  datasets: [
    {
      label: "Thời gian phản hồi trung bình (ms)",
      data: avgResponseTimes,
      borderColor: "rgba(33, 150, 243, 1)",       // xanh dương
      backgroundColor: "rgba(33, 150, 243, 0.15)", // tô nền mờ
      tension: 0.4,                  // bo cong đường
      fill: true,                    // tô phần dưới đường
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: "#1976d2",
      borderWidth: 2,
    },
  ],
};

const responseTimeLineOptions = {
  responsive: true,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const v = ctx.raw ?? 0;
          return `~ ${v.toFixed(0)} ms`;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => `${value} ms`,
      },
      title: {
        display: true,
        text: "Thời gian phản hồi (ms)",
      },
    },
    x: {
      title: {
        display: true,
        text: "Kịch bản gợi ý",
      },
    },
  },
};



// ===== Doanh thu: so sánh tháng này / tháng trước =====
const monthlySeries = revenue.last_5_months || []; // mảng 5 phần tử như JSON trên

const revenueLabels = monthlySeries.map((m) => m.label); // ["07/2025", ...]
const revenueValues = monthlySeries.map((m) => m.total); // [2100000000, ...]

const revenueCompareData = {
  labels: revenueLabels,
  datasets: [
    {
      type: "bar",
      label: "Doanh thu (VNĐ)",
      data: revenueValues,
      backgroundColor: "rgba(99, 102, 241, 0.8)",   // tím xanh đồng nhất
      borderRadius: 10,
      barThickness: 32,
    },
  ],
};


const revenueCompareOptions = {
  ...commonNoLegend,
  scales: {
    x: {
      title: { display: true, text: "Tháng" },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: "Doanh thu (VNĐ)" },
      ticks: {
        callback: (value) =>
          value.toLocaleString("vi-VN", { maximumFractionDigits: 0 }),
      },
    },
  },
};



// ===== Trạng thái vận chuyển =====
// ===== Gauge: Tỉ lệ trạng thái đơn hàng (100% = tổng số đơn) =====
// ===== Gauge: Tỉ lệ trạng thái đơn hàng (100% = tổng số đơn) =====

// Ưu tiên lấy từ shipping_status nếu có, nếu không thì fallback qua orders_summary
// Ưu tiên lấy từ orders_summary.tra_hang, rồi đến shipping_status.tra_hang
// ================= SHIPPING STATS ====================

// tổng số đơn trả (fallback giữa orders_summary & shipping_status)
const ordersReturn =
  ordersSummary.tra_hang ||
  shippingStatus.tra_hang ||
  0;

// Đơn đang xử lý = chờ xác nhận + chờ lấy hàng + đang giao (TOÀN BỘ)
const ordersProcessing =
  ordersWaitConfirm + ordersWaitPickup + ordersShipping;

// tab hiện tại
const isMonthView = shipTab === "month";

// ====== DATA ĐANG DÙNG CHO VIEW (gauge + bảng) ======
const gaugeSuccess     = isMonthView ? shipDeliveredMonth  : ordersSuccess;
const gaugeReturn      = isMonthView ? shipReturnMonth     : ordersReturn;
const gaugeProcessing  = isMonthView ? shipInTransitMonth  : ordersProcessing;
const gaugeCancelled   = isMonthView ? shipCancelledMonth  : ordersCancelled;

// tổng đơn theo TAB hiện tại
const totalOrdersGauge =
  gaugeSuccess + gaugeReturn + gaugeProcessing + gaugeCancelled;

// % đơn hoàn thành để vẽ chữ giữa gauge (THEO TAB)
const percentSuccessView =
  totalOrdersGauge === 0
    ? 0
    : (gaugeSuccess / totalOrdersGauge) * 100;

// ====== DATA CHO CHART DOUGHNUT ======
const orderStatusGaugeData = {
  labels: ["Hoàn thành", "Trả hàng", "Đang xử lý", "Hủy đơn"],
  datasets: [
    {
      data: [
        gaugeSuccess,
        gaugeReturn,
        gaugeProcessing,
        gaugeCancelled,
      ],
      backgroundColor: [
        "rgba(34, 197, 94, 0.9)",   // hoàn thành
        "rgba(251, 191, 36, 0.9)",  // trả hàng
        "rgba(59, 130, 246, 0.9)",  // đang xử lý
        "rgba(239, 68, 68, 0.9)",   // hủy
      ],
      borderWidth: 0,
      rotation: -90,
      circumference: 180,
      cutout: "60%",
    },
  ],
};



const orderStatusGaugeOptions = {
  maintainAspectRatio: false,
  aspectRatio: 2,          // rộng hơn cao cho giống gauge
  plugins: {
    legend: {
      display: false,
      position: "bottom",
      labels: {
        boxWidth: 12,
        font: { size: 11 },
      },
    },
    tooltip: {
      enabled: true,
      callbacks: {
        label: (ctx) => {
          const label = ctx.label || "";
          const value = ctx.raw || 0;
          const percent =
            totalOrdersGauge === 0
              ? 0
              : ((value / totalOrdersGauge) * 100).toFixed(1);
          return `${label}: ${value} đơn (${percent}%)`;
        },
      },
    },
  },
};


// Plugin vẽ % hoàn thành ở giữa gauge
// Plugin vẽ % hoàn thành ở giữa gauge
// Plugin vẽ % hoàn thành ở giữa gauge (sửa lại)
const gaugeCenterTextPlugin = {
  id: "gaugeCenterText",
  afterDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) return;

    // lấy tâm hình tròn của doughnut
    const arc = meta.data[0];
    const centerX = arc.x;
    const centerY = arc.y;

    // 👉 LẤY DỮ LIỆU TRỰC TIẾP TỪ DATASET
    const ds = chart.data.datasets[0];
    const data = ds.data || [];

    // giả định cấu trúc: [Hoàn thành, Trả hàng, Đang xử lý, Hủy đơn]
    const successVal = data[0] || 0;
    const total = data.reduce((sum, v) => sum + (v || 0), 0);

    const percent =
      total === 0 ? 0 : (successVal / total) * 100;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // vị trí dòng số %
    const mainY = centerY - 40; // chỉnh cao/thấp tuỳ giao diện

    ctx.font =
      "600 22px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#111827";
    ctx.fillText(`${percent.toFixed(1)}%`, centerX, mainY);

    // dòng chữ nhỏ bên dưới
    ctx.font =
      "400 11px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Tỉ lệ thành công", centerX, mainY + 18);

    ctx.restore();
  },
};







const revenueDailySeries =  [5, 8, 6, 10, 12, 9, 14];
const conversionSeries = [1.2, 1.5, 1.3, 1.8, 1.6, 2.0, 1.9];

const sparklineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
  scales: {
    x: { display: false, grid: { display: false } },
    y: { display: false, grid: { display: false } },
  },
};

const revenueSparkData = {
  labels: revenueDailySeries.map((_, i) => i + 1),
  datasets: [
    {
      data: revenueDailySeries,
      borderColor: "rgba(54, 162, 235, 0.9)",
      backgroundColor: "rgba(54, 162, 235, 0.15)",
      fill: true,
      tension: 0.4,
      pointRadius: 0,
    },
  ],
};

const conversionSparkData = {
  labels: conversionSeries.map((_, i) => i + 1),
  datasets: [
    {
      data: conversionSeries,
      borderColor: "rgba(99, 102, 241, 0.8)",
      backgroundColor: "rgba(99, 102, 241, 0.15)",
      fill: true,
      tension: 0.4,
      pointRadius: 0,
    },
  ],
};
// Plugin vẽ mũi tên xu hướng trên biểu đồ doanh thu
// Plugin vẽ đường tăng trưởng ZÍC ZẮC + mũi tên ở cuối
const growthArrowPlugin = {
  id: "growthArrow",
  afterDatasetsDraw(chart) {
    const dsIndex = 0; // dùng dataset cột doanh thu
    const meta = chart.getDatasetMeta(dsIndex);
    const bars = meta?.data || [];
    if (bars.length < 2) return;

    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(220, 38, 38, 1)"; // đỏ
    ctx.fillStyle = "rgba(220, 38, 38, 1)";
    ctx.lineWidth = 3;

    const offset = 20; // đẩy mũi tên cao hơn đỉnh cột 1 chút

    // ===== 1. VẼ ĐƯỜNG GẤP KHÚC ĐI QUA TỪNG CỘT =====
    ctx.beginPath();
    // điểm đầu (cột 1)
    let p0 = bars[0].tooltipPosition();
    let prevX = p0.x;
    let prevY = p0.y - offset;
    ctx.moveTo(prevX, prevY);

    // nối lần lượt qua các cột còn lại
    for (let i = 1; i < bars.length; i++) {
      const pi = bars[i].tooltipPosition();
      const x = pi.x;
      const y = pi.y - offset;
      ctx.lineTo(x, y);
      prevX = x;
      prevY = y;
    }
    ctx.stroke();

    // ===== 2. VẼ MŨI TÊN Ở ĐẦU CUỐI =====
    const last = bars[bars.length - 1].tooltipPosition();
    const lastX = last.x;
    const lastY = last.y - offset;

    const prev = bars[bars.length - 2].tooltipPosition();
    const prevX2 = prev.x;
    const prevY2 = prev.y - offset;

    const angle = Math.atan2(lastY - prevY2, lastX - prevX2);
    const headLen = 12; // độ dài mũi tên

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(
      lastX - headLen * Math.cos(angle - Math.PI / 6),
      lastY - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      lastX - headLen * Math.cos(angle + Math.PI / 6),
      lastY - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  },
};




  // ===== RENDER =====
  return (
    <div className="container-fluid py-3 dashboard-ui">
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold">
          📊 Dashboard thống kê
          {viewMode === "user" && (
            <span className="ms-2 text-muted">/ Hành vi người dùng</span>
          )}
        
          {viewMode === "laptop" && (
            <span className="ms-2 text-muted">/ Dữ liệu Laptop</span>
          )}
          {viewMode === "model" && (
            <span className="ms-2 text-muted">/ Mô hình gợi ý</span>
          )}
        </h4>
        <button
          className="btn btn-outline-primary d-flex align-items-center gap-2"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          <i className="fas fa-sync"></i> Làm mới
        </button>
      </div>

      {/* QUICK STATS + NỘI DUNG THEO VIEWMODE */}
      {loading ? (
  <p>Đang tải dữ liệu...</p>
) : viewMode === "main" ? (

  <>
    {/* ======= QUICK STATS (MAIN) ======= */}
    <div className="row g-3 mb-4">
      {/* Shops */}
<div className="col-md-3">
  <div
          className="card stat-card shadow-sm border-0"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("main")}
        >
    <div className="card-body d-flex justify-content-between">
      <div>
        <div className="stat-value">$</div>
        <div className="stat-label">Cửa hàng</div>
      </div>
      <div className="stat-icon bg-primary-subtle text-primary">
        <i className="fas fa-store" />
      </div>
    </div>
  </div>
</div>

      {/* Users = đang ở dashboard chính */}
      <div className="col-md-3">
        <div
          className="card stat-card shadow-sm border-0 border-primary border-2"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("user")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">{stats.users}</div>
              <div className="stat-label">Người dùng</div>
            </div>
            <div className="stat-icon bg-warning-subtle text-warning">
              <i className="fas fa-users" />
            </div>
          </div>
        </div>
      </div>

      {/* Laptop = chuyển sang view laptop */}
      <div className="col-md-3">
        <div
          className="card stat-card shadow-sm border-0"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("laptop")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">{stats.laptops}</div>
              <div className="stat-label">
                Laptop{" "}
                
              </div>
            </div>
            <div className="stat-icon bg-success-subtle text-success">
              <i className="fas fa-laptop" />
            </div>
          </div>
        </div>
      </div>

      {/* Mô hình gợi ý = view model */}
      <div className="col-md-3">
        <div
          className={
            "card stat-card shadow-sm border-0" +
            (viewMode === "model" ? " border-info border-2" : "")
          }
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("model")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">@K</div>
              <div className="stat-label">Mô hình gợi ý</div>
            </div>
            <div className="stat-icon bg-info-subtle text-info">
              <i className="fas fa-brain" />
            </div>
          </div>
        </div>
      </div>

      
    </div>
    <div className="row">
            
              {/* Flask 7 ngày */}
              <div className="col-lg-6 mb-4">
              <div className="dash-section mt-4">
              <h6 className="section-title">📈 Lượt truy vấn 7 ngày gần nhất</h6>
                <div className="card p-3 shadow-sm">
                  {flaskLoading ? (
                    <p>Đang tải...</p>
                  ) : (
                    <Line data={flaskLineData} options={flaskLineOptions} />
                  )}
                </div>
              </div>
              </div>

              {/* Traffic */}
              <div className="col-lg-6 mb-4">
              <div className="dash-section mt-4">
                <h6 className="section-title">📶 Lượt truy cập theo giờ (hôm nay)</h6>
                <div className="card p-3 shadow-sm">
                  {flaskLoading ? (
                    <p>Đang tải...</p>
                  ) : trafficToday.labels.length === 0 ? (
                    <p>Hôm nay chưa có request.</p>
                  ) : (
                    <Line data={trafficLineData} options={trafficLineOptions} />
                  )}
                </div>
              </div>
            </div>
            </div>


    <div className="row">        
    <div className="col-lg-6 mb-4">
    <div className="row">
      
        {/* Doanh thu tháng này + % so với tháng trước */}
       
  <div className="col-md-6 mb-3">
  <div className="card stat-card border-0 shadow-sm h-100">
    <div className="card-body d-flex justify-content-between align-items-end">
      <div>
        <div className="small text-muted mb-3">Doanh thu tháng này</div>
        
        <div className="h4 fw-bold mb-3 text-dark text-nowrap">
  {revenueThisMonth.toLocaleString("vi-VN")}{" "}
  <span>₫</span>
</div>


        {revenueChangePercent !== null && (
          <div
            className={
              "small " +
              (revenueChangePercent >= 0 ? "text-success" : "text-danger")
            }
          >
            {revenueChangePercent >= 0 ? "▲" : "▼"}{" "}
            {Math.abs(revenueChangePercent).toFixed(1)}% so với tháng trước
          </div>
        )}
      </div>

      <div
  className="stat-sparkline"
  style={{ width: 120, height: 40, overflow: "hidden" }}
>
  <Line data={revenueSparkData} options={sparklineOptions} />
</div>

    </div>
  </div>
</div>
 {/* Tỷ lệ chuyển đổi */}
  <div className="col-md-6 mb-3">
  <div className="card stat-card border-0 shadow-sm h-100">
    <div className="card-body d-flex justify-content-between align-items-end">
      <div>
        <div className="small text-muted mb-1">Tỷ lệ chuyển đổi</div>
        <div className="h4 fw-bold mb-1 text-dark">
          {(conversionRate * 100).toFixed(1)}%
        </div>

        <div className="small text-muted">
          {conversion.view_users || 0} xem →{" "}
          {conversion.buyer_users || 0} mua (30 ngày)
        </div>
      </div>

      <div
  className="stat-sparkline"
  style={{ width: 120, height: 40, overflow: "hidden" }}
>
  <Line data={conversionSparkData} options={sparklineOptions} />
</div>

    </div>
  </div>
</div>
      </div>
    
    
            <div className="row mb-4">
  {/* Doanh thu hôm nay */}
  <div className="col-md-6">
    <div className="card stat-card shadow-sm border-0">
      <div className="card-body">
        <div className="small text-muted mb-1">Doanh thu hôm nay</div>
        <div className="h4 fw-bold mb-0">
          {revenueToday.toLocaleString("vi-VN")} ₫
        </div>
      </div>
    </div>
  </div>

  {/* Doanh thu 7 ngày gần nhất */}
  <div className="col-md-6">
    <div className="card stat-card shadow-sm border-0">
      <div className="card-body">
        <div className="small text-muted mb-1">Doanh thu 7 ngày gần nhất</div>
        <div className="h4 fw-bold mb-0">
          {revenue7Days.toLocaleString("vi-VN")} ₫
        </div>
      </div>
    </div>
  </div>

  


 

</div>
{/* ===== BIỂU ĐỒ DOANH THU & VẬN CHUYỂN ===== */}

  <div className="col-lg-12">
    <div className="card p-3 shadow-sm h-100">
  <h6 className="section-title mb-3">
    💰 Doanh thu 5 tháng gần đây
  </h6>
  {flaskLoading ? (
    <p>Đang tải...</p>
  ) : (
    <Bar
      data={revenueCompareData}
      options={revenueCompareOptions}
      plugins={[growthArrowPlugin]}
    />
  )}
</div>

 

  
  </div>
</div>
<div className="col-lg-6 mb-3">
    <div className="card p-3 shadow-sm h-100">
      <div className="d-flex justify-content-between align-items-center mb-2">
  <h6 className="section-title mb-0">
    🚚 Tình trạng vận chuyển đơn hàng
  </h6>
  <div className="btn-group btn-group-sm">
    <button
      type="button"
      className={
        "btn btn-outline-secondary" +
        (shipTab === "total" ? " active" : "")
      }
      onClick={() => setShipTab("total")}
    >
      Tổng
    </button>
    <button
      type="button"
      className={
        "btn btn-outline-secondary" +
        (shipTab === "month" ? " active" : "")
      }
      onClick={() => setShipTab("month")}
    >
      Tháng này
    </button>
  </div>
</div>

{flaskLoading ? (
  <p>Đang tải...</p>
) : totalOrdersGauge === 0 ? (
  <p>
    {shipTab === "month"
      ? "Chưa có dữ liệu đơn hàng trong tháng này."
      : "Chưa có dữ liệu đơn hàng."}
  </p>
) : (
  <>
 
      <div
        style={{
          maxWidth: 400,
          height: 220,
          margin: "0 auto",
        }}
      >
        <Doughnut
          data={orderStatusGaugeData}
          options={orderStatusGaugeOptions}
          plugins={[gaugeCenterTextPlugin]}
        />
      </div>
      <div className="d-flex justify-content-center gap-3 mt-2 small flex-wrap">
        <span className="d-flex align-items-center">
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: "rgba(34, 197, 94, 0.9)",
              display: "inline-block",
              marginRight: 6,
            }}
          />
          Hoàn thành
        </span>

        <span className="d-flex align-items-center">
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: "rgba(251, 191, 36, 0.9)",
              display: "inline-block",
              marginRight: 6,
            }}
          />
          Trả hàng
        </span>

        <span className="d-flex align-items-center">
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: "rgba(59, 130, 246, 0.9)",
              display: "inline-block",
              marginRight: 6,
            }}
          />
          Đang xử lý
        </span>

        <span className="d-flex align-items-center">
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: "rgba(239, 68, 68, 0.9)",
              display: "inline-block",
              marginRight: 6,
            }}
          />
          Hủy đơn
        </span>
      </div>


                          
                          </>
)}


      <table className="table table-sm mt-3 mb-0">
  <tbody>
    {/* Đơn hôm nay: logic giống nhau cho cả 2 tab */}
    <tr>
      <td>Đơn hôm nay</td>
      <td className="text-end fw-semibold">{ordersToday}</td>
    </tr>

    {/* Đơn chưa xử lý */}
    <tr>
  <td>Đơn chưa xử lý</td>
  <td className="text-end fw-semibold">
    {isMonthView
      ? shipWaitConfirmMonth + shipWaitPickupMonth + shipInTransitMonth
      : ordersWaitConfirm + ordersWaitPickup + ordersShipping}
  </td>
</tr>

<tr>
  <td className="ps-4">• Chờ xác nhận</td>
  <td className="text-end">
    {isMonthView ? shipWaitConfirmMonth : ordersWaitConfirm}
  </td>
</tr>
<tr>
  <td className="ps-4">• Chờ lấy hàng</td>
  <td className="text-end">
    {isMonthView ? shipWaitPickupMonth : ordersWaitPickup}
  </td>
</tr>
<tr>
  <td className="ps-4">• Đang giao</td>
  <td className="text-end">
    {isMonthView ? shipInTransitMonth : ordersShipping}
  </td>
</tr>

<tr>
  <td>Đơn thành công</td>
  <td className="text-end fw-semibold text-success">
    {isMonthView ? shipDeliveredMonth : ordersSuccess}
  </td>
</tr>
<tr>
  <td>Đơn trả</td>
  <td className="text-end fw-semibold text-warning">
    {isMonthView ? shipReturnMonth : ordersReturn}
  </td>
</tr>
<tr>
  <td>Đơn bị hủy</td>
  <td className="text-end fw-semibold text-danger">
    {isMonthView ? shipCancelledMonth : ordersCancelled}
  </td>
</tr>

  </tbody>
</table>


    </div>
  </div>
  </div>


  
  
</>
): viewMode === "user" ? (
  <>
    {/* ======= QUICK STATS (MAIN) ======= */}
    <div className="row g-3 mb-4">
      {/* Shops */}
<div className="col-md-3">
  <div
          className="card stat-card shadow-sm border-0"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("main")}
        >
    <div className="card-body d-flex justify-content-between">
      <div>
        <div className="stat-value">$</div>
        <div className="stat-label">Cửa hàng</div>
      </div>
      <div className="stat-icon bg-primary-subtle text-primary">
        <i className="fas fa-store" />
      </div>
    </div>
  </div>
</div>

      {/* Users = đang ở dashboard chính */}
      <div className="col-md-3">
        <div
          className="card stat-card shadow-sm border-0 border-primary border-2"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("user")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">{stats.users}</div>
              <div className="stat-label">Người dùng</div>
            </div>
            <div className="stat-icon bg-warning-subtle text-warning">
              <i className="fas fa-users" />
            </div>
          </div>
        </div>
      </div>

      {/* Laptop = chuyển sang view laptop */}
      <div className="col-md-3">
        <div
          className="card stat-card shadow-sm border-0"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("laptop")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">{stats.laptops}</div>
              <div className="stat-label">
                Laptop{" "}
                
              </div>
            </div>
            <div className="stat-icon bg-success-subtle text-success">
              <i className="fas fa-laptop" />
            </div>
          </div>
        </div>
      </div>

      {/* Mô hình gợi ý = view model */}
      <div className="col-md-3">
        <div
          className={
            "card stat-card shadow-sm border-0" +
            (viewMode === "model" ? " border-info border-2" : "")
          }
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("model")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">@K</div>
              <div className="stat-label">Mô hình gợi ý</div>
            </div>
            <div className="stat-icon bg-info-subtle text-info">
              <i className="fas fa-brain" />
            </div>
          </div>
        </div>
      </div>

      
    </div>

    {/* ======= DASHBOARD CHÍNH ======= */}
    {/* ======= DASHBOARD CHÍNH ======= */}
    <div className="d-flex justify-content-between align-items-center mb-3">
      <h5 className="section-title mb-0">💻 Thống kê chi tiết về laptop</h5>
      <button
        className="btn btn-sm btn-outline-secondary"
        onClick={() => setViewMode("main")}
      >
        Quay lại dashboard chính
      </button>
    </div>
          

            {/* RIGHT COLUMN */}
            <div className="row">
            <div className="col-lg-6 mb-4">
  <h6 className="section-title mb-3">🏷️ Brand được tìm nhiều nhất</h6>
  <div className="card p-3 shadow-sm">
    {flaskLoading ? (
      <p>Đang tải...</p>
    ) : (
      <div className="row">
        {/* Biểu đồ tròn */}
        <div className="col-12 col-md-6 d-flex justify-content-center">
          <div style={{ width: "100%", maxWidth: 260, height: 260 }}>
            <Doughnut data={brandChartData} options={brandChartOptions} />
          </div>
        </div>

        {/* Bảng dữ liệu */}
        <div className="col-12 col-md-6 mt-3 mt-md-0">
          <table className="table table-sm align-middle brand-table mb-0">
            <thead>
              <tr>
                <th>Hãng</th>
                <th className="text-end">Lượt tìm</th>
              </tr>
            </thead>
            <tbody>
              {sortedBrandFromLogs.map((row) => (
                <tr key={row.brand}>
                  <td>{row.brand.toUpperCase()}</td>
                  <td className="text-end fw-bold">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>

              
                <h6 className="section-title mb-3 mt-3">💵 Truy vấn theo khoảng giá</h6>
                 <div className="card p-3 shadow-sm">
                {flaskLoading ? (
                  <p>Đang tải...</p>
                ) : !queryPriceHist.labels.length ||
                  queryPriceHist.counts.reduce((sum, x) => sum + x, 0) === 0 ? (
                  <p>Chưa có dữ liệu khoảng giá trong log.</p>
                ) : (
                  <Bar
                    data={queryPriceChartData}
                    options={queryPriceChartOptions}
                  />
                )}
              </div>
    
</div>

{/* TOP USERS */}
<div className="col-lg-6 mb-4">
          <h6 className="section-title mb-3">👤 Top người dùng sử dụng gợi ý</h6>
<div className="card p-3 shadow-sm mb-4 ">
  {flaskLoading ? (
    <p>Đang tải...</p>
  ) : topSearchUsers.length === 0 ? (
    <p>Chưa có dữ liệu.</p>
  ) : (
    <>
      {/* ===== PODIUM 3 NGƯỜI ĐẦU ===== */}
      {(() => {
        const sorted = [...topSearchUsers].sort(
          (a, b) => (b.total_search || 0) - (a.total_search || 0)
        );
        const top3 = sorted.slice(0, 3);

        return (
          <div className="top-users-podium d-flex justify-content-center align-items-end gap-5 mb-5 mt-3">
            {/* Top 2 (trái) */}
            {top3[1] && (
              <PodiumUserCard
                user={top3[1]}
                rank={2}
                variant="second"
              />
            )}

            {/* Top 1 (giữa – cao nhất) */}
            {top3[0] && (
              <PodiumUserCard
                user={top3[0]}
                rank={1}
                variant="first"
              />
            )}

            {/* Top 3 (phải) */}
            {top3[2] && (
              <PodiumUserCard
                user={top3[2]}
                rank={3}
                variant="third"
              />
            )}
          </div>
        );
      })()}

      {/* ===== BẢNG RANKING CÒN LẠI ===== */}
      <table className="table table-borderless mb-0 align-middle">
        <tbody>
          {topSearchUsers.slice(3).map((u, idx) => (
            <tr key={u.user_id}>
              <td style={{ width: 40 }} className="text-muted">
                {idx + 4}
              </td>
              <td style={{ width: 40 }}>
                <i className="fas fa-user fs-5 text-secondary"></i>
              </td>
              <td className="fw-semibold">{u.full_name}</td>
              <td className="text-end text-muted">
                {u.total_search} lần
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )}
  </div>
  <h6 className="section-title mb-2">
                  📡 Truy vấn theo kênh (Chatbot / App)
                </h6>
              <div className="card p-3 shadow-sm ">
                
                {flaskLoading ? (
  <p>Đang tải...</p>
) : channelStats.total === 0 ? (
  <p>Chưa có dữ liệu kênh truy vấn trong log.</p>
) : (
  <>
    {/* THANH CHUNG 1 DÒNG */}
    <div className="mt-3 mb-3">
      <div className="channel-multi-bar">
        {channelStats.labels.map((label, idx) => {
          const value = channelStats.counts[idx] || 0;
          const percent =
            channelStats.total === 0 ? 0 : (value / channelStats.total) * 100;

          return (
            <div
              key={label}
              className={`channel-multi-seg channel-multi-seg-${idx}`}
              style={{ width: `${percent}%` }}
              title={`${label}: ${value} (${percent.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Nhãn + số phía dưới thanh */}
      <div className="d-flex justify-content-between flex-wrap mt-2 small">
        {channelStats.labels.map((label, idx) => {
          const value = channelStats.counts[idx] || 0;
          const percent =
            channelStats.total === 0 ? 0 : (value / channelStats.total) * 100;

          return (
            <div key={label} className="me-3 mb-1 d-flex align-items-center">
              <span
                className={`channel-dot channel-dot-${idx} me-2`}
              ></span>
              <span className="fw-semibold">{label}</span>
              <span className="text-muted ms-1">
                {value} ({percent.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>

    
  </>
)}

    </div>
</div>
</div>
        
<div className="row">
  {/* Truy vấn theo mục đích sử dụng */}
            <div className="col-lg-6 mb-4">
              <div className="card p-3 shadow-sm h-100">
                <h6 className="section-title mb-3">
                  🎯 Truy vấn theo mục đích sử dụng
                </h6>
                {flaskLoading ? (
                  <p>Đang tải...</p>
                ) : !queryPurposeHist.labels.length ||
                  queryPurposeHist.counts.reduce((sum, x) => sum + x, 0) === 0 ? (
                  <p>Chưa có dữ liệu mục đích sử dụng trong log.</p>
                ) : (
                  <Bar
                    data={queryPurposeChartData}
                    options={queryPurposeChartOptions}
                  />
                )}
              </div>
            </div>
          
           
            
            {/* Truy vấn theo loại (filter / keyword / content_rec / hybrid) */}
<div className="col-lg-6 mb-4">
  <div className="card p-3 shadow-sm h-100">
    <h6 className="section-title mb-3">🧠 Truy vấn theo loại</h6>
    {flaskLoading ? (
      <p>Đang tải...</p>
    ) : !queryTypeStats.labels.length ? (
      <p>Chưa có dữ liệu loại truy vấn.</p>
    ) : (
      <Bar data={queryTypeChartData} options={queryTypeChartOptions} />
    )}
  </div>
</div>
</div>
          


          {/* CLICK + CART */}
          <div className="row">
            <div className="col-md-6 mb-4">
              <h5 className="section-title">🖱️ Laptop được click nhiều</h5>
              <div className="card p-3 shadow-sm">
                {flaskLoading ? (
                  <p>Đang tải...</p>
                ) : (
                  <>
                    <Bar
                      data={clickedChartData}
                      options={clickedChartOptions}
                    />
                    <table className="table table-hover table-sm mt-3 align-middle">
        <thead>
          <tr>
            <th>Laptop</th>
            <th className="text-end">Click 30 ngày</th>
            <th className="text-end">Tồn kho</th>
            <th className="text-end">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {topClicked.map((r) => {
            const inStock = r.in_stock;      // boolean từ backend
            const stockQty = r.stock_qty ?? 0;

            return (
              <tr
                key={r.laptop_id}
                className={!inStock ? "table-light text-muted" : ""}
              >
                <td className="d-flex align-items-center gap-2">
                  <img src={r.image_url} className="thumb-img" alt="" />
                  {r.name}
                </td>
                <td className="text-end fw-bold">{r.total_click}</td>
                <td className="text-end">{stockQty}</td>
                <td className="text-end">
                  <span
                    className={
                      "badge " +
                      (inStock
                        ? "bg-success-subtle text-success"
                        : "bg-secondary-subtle text-secondary")
                    }
                  >
                    {inStock ? "Còn hàng" : "Hết hàng"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
                  </>
                )}
              </div>
            </div>

            <div className="col-md-6 mb-4">
  <h5 className="section-title">🛒 Laptop trong giỏ nhiều</h5>
  <div className="card p-3 shadow-sm">
    {flaskLoading ? (
      <p>Đang tải...</p>
    ) : topCart.length === 0 ? (
      <p>Chưa có dữ liệu.</p>
    ) : (
      <>
        {/* Biểu đồ cột */}
        <Bar data={cartChartData} options={cartChartOptions} />

        {/* Bảng top laptop trong giỏ */}
        <table className="table table-hover table-sm mt-3 align-middle">
          <thead>
            <tr>
              <th>Laptop</th>
              <th className="text-end">Số lần trong giỏ</th>
            </tr>
          </thead>
          <tbody>
            {topCart.map((r) => (
              <tr key={r.laptop_id}>
                <td className="d-flex align-items-center gap-2">
                  <img
                    src={r.image_url}
                    className="thumb-img"
                    alt=""
                  />
                  {r.name}
                </td>
                <td className="text-end fw-bold">
                  {r.total_cart || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )}
  </div>
</div>

          </div>
        {/* Top bán chạy 30 ngày */}
  <div className="col-lg-4 mb-4">
    <h5 className="section-title">🔥 Top laptop bán chạy (30 ngày)</h5>
    <div className="card p-3 shadow-sm">
      {flaskLoading ? (
        <p>Đang tải...</p>
      ) : topSold30.length === 0 ? (
        <p>Chưa có dữ liệu bán trong 30 ngày.</p>
      ) : (
        <>
          <Bar data={soldChartData} options={soldChartOptions} />

          <table className="table table-hover table-sm mt-3 align-middle">
            <thead>
              <tr>
                <th>Laptop</th>
                <th className="text-end">SL bán (30d)</th>
                
              </tr>
            </thead>
            <tbody>
              {topSold30.map((r) => (
                <tr key={r.laptop_id}>
                  <td className="d-flex align-items-center gap-2">
                    <img src={r.image_url} className="thumb-img" alt="" />
                    {r.name}
                  </td>
                  <td className="text-end fw-bold">
                    {r.total_sold_30d ?? r.total_sold ?? 0}
                  </td>
            
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  </div>  

       
        </>
) : viewMode === "laptop" ? (
  <>
    {/* ======= QUICK STATS (LAPTOP VIEW) ======= */}
    <div className="row g-3 mb-4">
      {/* Shops */}
<div className="col-md-3">
  <div
          className="card stat-card shadow-sm border-0"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("main")}
        >
    <div className="card-body d-flex justify-content-between">
      <div>
        <div className="stat-value">$</div>
        <div className="stat-label">Cửa hàng</div>
      </div>
      <div className="stat-icon bg-primary-subtle text-primary">
        <i className="fas fa-store" />
      </div>
    </div>
  </div>
</div>

      {/* Users = đang ở dashboard chính */}
      <div className="col-md-3">
        <div
          className="card stat-card shadow-sm border-0 border-primary border-2"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("user")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">{stats.users}</div>
              <div className="stat-label">Người dùng</div>
            </div>
            <div className="stat-icon bg-warning-subtle text-warning">
              <i className="fas fa-users" />
            </div>
          </div>
        </div>
      </div>

      {/* Laptop = chuyển sang view laptop */}
      <div className="col-md-3">
        <div
          className="card stat-card shadow-sm border-0"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("laptop")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">{stats.laptops}</div>
              <div className="stat-label">
                Laptop{" "}
                
              </div>
            </div>
            <div className="stat-icon bg-success-subtle text-success">
              <i className="fas fa-laptop" />
            </div>
          </div>
        </div>
      </div>

      {/* Mô hình gợi ý = view model */}
      <div className="col-md-3">
        <div
          className={
            "card stat-card shadow-sm border-0" +
            (viewMode === "model" ? " border-info border-2" : "")
          }
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("model")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">@K</div>
              <div className="stat-label">Mô hình gợi ý</div>
            </div>
            <div className="stat-icon bg-info-subtle text-info">
              <i className="fas fa-brain" />
            </div>
          </div>
        </div>
      </div>

      
    </div>

    {/* ======= VIEW RIÊNG CHO LAPTOP ======= */}
    <div className="d-flex justify-content-between align-items-center mb-3">
      <h5 className="section-title mb-0">💻 Thống kê chi tiết về laptop</h5>
      <button
        className="btn btn-sm btn-outline-secondary"
        onClick={() => setViewMode("main")}
      >
        Quay lại dashboard chính
      </button>
    </div>

    {/* 2 biểu đồ: giá & hãng + radar mục đích (giữ như bạn đã chỉnh) */}
    <div className="row g-3 mb-4">
      {/* Cột trái: Giá + Hãng */}
      <div className="col-lg-6 d-flex flex-column gap-3">
        {/* Phân bố mức giá */}
        <div className="card p-3 shadow-sm h-100">
          <h6 className="section-title mb-3">💰 Phân bố mức giá laptop</h6>
          {priceLoading ? (
            <p>Đang tải...</p>
          ) : !priceHist.labels.length ||
            priceHist.counts.reduce((sum, x) => sum + x, 0) === 0 ? (
            <p>Chưa có dữ liệu giá để vẽ biểu đồ.</p>
          ) : (
            <Bar data={priceHistData} options={priceHistOptions} />
          )}
        </div>

        {/*  Số lượng laptop theo hãng */}
        <div className="card p-3 shadow-sm h-100">
          <h6 className="section-title mb-3">🏭 Số lượng laptop theo hãng</h6>
          {brandLoading ? (
            <p>Đang tải...</p>
          ) : !brandHist.labels.length ||
            brandHist.counts.reduce((sum, x) => sum + x, 0) === 0 ? (
            <p>Chưa có dữ liệu hãng laptop để vẽ biểu đồ.</p>
          ) : (
            <Bar data={brandLaptopsData} options={brandLaptopsOptions} />
          )}
        </div>
      </div>

      {/* Cột phải:  Mục đích sử dụng */}
      <div className="col-lg-6">
        <div className="card p-3 shadow-sm h-100">
          <h6 className="section-title mb-3">
            🎯 Số lượng laptop theo mục đích sử dụng
          </h6>
          {purposeLoading ? (
            <p>Đang tải...</p>
          ) : !purposeHist.labels.length ||
            purposeHist.counts.reduce((sum, x) => sum + x, 0) === 0 ? (
            <p>Chưa có dữ liệu mục đích sử dụng để vẽ biểu đồ.</p>
          ) : (
            <Radar data={purposeChartData} options={purposeChartOptions} />
          )}
        </div>
      </div>
    </div>
  </>
) : viewMode === "model" ? (
  <>
    {/* ======= VIEW MÔ HÌNH GỢI Ý ======= */}
    <div className="row g-3 mb-4">
      {/* Shops */}
<div className="col-md-3">
  <div
          className="card stat-card shadow-sm border-0"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("main")}
        >
    <div className="card-body d-flex justify-content-between">
      <div>
        <div className="stat-value">$</div>
        <div className="stat-label">Cửa hàng</div>
      </div>
      <div className="stat-icon bg-primary-subtle text-primary">
        <i className="fas fa-store" />
      </div>
    </div>
  </div>
</div>

      {/* Users = đang ở dashboard chính */}
      <div className="col-md-3">
        <div
          className="card stat-card shadow-sm border-0 border-primary border-2"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("user")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">{stats.users}</div>
              <div className="stat-label">Người dùng</div>
            </div>
            <div className="stat-icon bg-warning-subtle text-warning">
              <i className="fas fa-users" />
            </div>
          </div>
        </div>
      </div>

      {/* Laptop = chuyển sang view laptop */}
      <div className="col-md-3">
        <div
          className="card stat-card shadow-sm border-0"
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("laptop")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">{stats.laptops}</div>
              <div className="stat-label">
                Laptop{" "}
                
              </div>
            </div>
            <div className="stat-icon bg-success-subtle text-success">
              <i className="fas fa-laptop" />
            </div>
          </div>
        </div>
      </div>

      {/* Mô hình gợi ý = view model */}
      <div className="col-md-3">
        <div
          className={
            "card stat-card shadow-sm border-0" +
            (viewMode === "model" ? " border-info border-2" : "")
          }
          style={{ cursor: "pointer" }}
          onClick={() => setViewMode("model")}
        >
          <div className="card-body d-flex justify-content-between">
            <div>
              <div className="stat-value">@K</div>
              <div className="stat-label">Mô hình gợi ý</div>
            </div>
            <div className="stat-icon bg-info-subtle text-info">
              <i className="fas fa-brain" />
            </div>
          </div>
        </div>
      </div>

      
    </div>

    <div className="d-flex justify-content-between align-items-center mb-3">
      <h5 className="section-title mb-0">🤖 Đánh giá mô hình gợi ý</h5>
      <button
        className="btn btn-sm btn-outline-secondary"
        onClick={() => setViewMode("main")}
      >
        Quay lại dashboard chính
      </button>
    </div>

    <div className="card p-3 shadow-sm mb-4">
  <h6 className="section-title mb-3">
    🤖 Precision@K và Recall@K: so sánh Baseline vs Content-based
  </h6>

  <div className="row">
    {/* Precision chart */}
    <div className="col-lg-6 mb-3">
      <h6 className="small fw-semibold mb-2">📈 Precision@K</h6>
      <Bar data={precisionChartData} options={precisionChartOptions} />
    </div>

    {/* Recall chart */}
    <div className="col-lg-6 mb-3">
      <h6 className="small fw-semibold mb-2">📉 Recall@K</h6>
      <Bar data={recallChartData} options={recallChartOptions} />
    </div>
  </div>

  <p className="mt-3 small text-muted">
    <strong>Baseline:</strong> lọc theo khoảng giá &amp; mục đích, sắp xếp
    theo giá tăng dần. <br />
    <strong>Mô hình content-based:</strong> dùng cosine similarity trên
    đặc trưng laptop (CPU, RAM, GPU, mục đích, v.v.) để xếp hạng. <br />
    <strong>Precision@K</strong> đo “trong K gợi ý đầu có bao nhiêu gợi ý đúng”;<br />
    <strong>Recall@K</strong> đo “trong tất cả các laptop đúng, mô hình đã gom
    được bao nhiêu cái vào top-K”.
  </p>
</div>

{/* Thời gian phản hồi trung bình */}
  <h6 className="section-title mb-3">
    ⏱️ Thời gian phản hồi trung bình theo kịch bản
  </h6>
  <Line data={responseTimeLineData} options={responseTimeLineOptions} />

  <p className="mt-3 small text-muted">
    
  </p>

  </>
): null}

    </div>
  );
}

