import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const API_BASE = "http://127.0.0.1:5000";

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, { method: "GET" });
  const text = await r.text();
  if (!r.ok) throw new Error(text || `GET ${path} failed`);
  return text ? JSON.parse(text) : null;
}

async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  if (!r.ok) throw new Error(text || `POST ${path} failed`);

  // parse JSON nếu có vẻ là JSON, còn lại trả text
  const t = (text || "").trim();
  if (!t) return null;
  if (t.startsWith("{") || t.startsWith("[")) return JSON.parse(t);
  return { raw: t };
}


export default function AdminShopChat() {
  const [convs, setConvs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");

  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [adminId, setAdminId] = useState(null);

useEffect(() => {
  (async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id || null;
    setAdminId(uid);

    // check role trong profiles
    if (uid) {
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single();

      if (p?.role !== "admin") {
        setErr("Bạn không có quyền admin.");
      }
    }
  })();
}, []);

  const bottomRef = useRef(null);
  const selectedIdRef = useRef(null);
  const [menu, setMenu] = useState({ open: false, id: null, x: 0, y: 0 });
  const menuRef = useRef(null);

  useEffect(() => {
    function onDown(e) {
      if (!menu.open) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setMenu({ open: false, id: null, x: 0, y: 0 });
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu.open]);

  function openMenu(e, msgId) {
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ open: true, id: msgId, x: r.right - 140, y: r.bottom + 6 }); // 140 = width menu
  }
  async function recallMessage(messageId) {
  if (!messageId) return;

  // optimistic: biến thành placeholder
  setMessages(prev =>
    prev.map(m => m.id === messageId
      ? { ...m, is_recalled: true, content: "Tin nhắn đã thu hồi" }
      : m
    )
  );

  setMenu({ open: false, id: null, x: 0, y: 0 });

  try {
    await apiPost("/admin/api/shop_chat/recall", {
      admin_id: adminId,
      message_id: messageId,
    });
  } catch (e) {
    setErr(String(e.message || e));
    await loadMessages(selectedId); // rollback
  }
}

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const scrollToBottom = () =>
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  const selectedConv = useMemo(
    () => convs.find((c) => c.id === selectedId) || null,
    [convs, selectedId]
  );

  const addMessageIfNotExists = (row) => {
    setMessages((prev) => {
      if (!row?.id) return prev;
      if (prev.some((x) => x.id === row.id)) return prev;
      return [...prev, row];
    });
  };

  async function loadConversations() {
    setLoadingConvs(true);
    setErr("");
    try {
      const rows = await apiGet("/admin/api/shop_chat/conversations");
      const list = Array.isArray(rows) ? rows : [];
      setConvs(list);

      // auto select only when chưa chọn gì
      if (!selectedIdRef.current && list.length) {
        setSelectedId(list[0].id);
      }

      // nếu selectedId hiện tại không còn tồn tại (ví dụ bị đóng/xóa), chọn lại
      if (selectedIdRef.current && list.length) {
        const stillExists = list.some((c) => c.id === selectedIdRef.current);
        if (!stillExists) setSelectedId(list[0].id);
      }
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoadingConvs(false);
    }
  }

  async function loadMessages(conversationId) {
    if (!conversationId) return;
    setLoadingMsgs(true);
    setErr("");
    try {
      const rows = await apiGet(
        `/admin/api/shop_chat/messages?conversation_id=${conversationId}`
      );
      const list = Array.isArray(rows) ? rows : [];
      setMessages(list);
      setTimeout(scrollToBottom, 30);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoadingMsgs(false);
    }
  }
  function timeAgo(ts) {
  const t = ts ? new Date(ts).getTime() : null;
  if (!t) return "";
  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s trước`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} giờ trước`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} ngày trước`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week} tuần trước`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} tháng trước`;
  const year = Math.floor(day / 365);
  return `${year} năm trước`;
}

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !selectedId) return;

    setDraft("");
    setErr("");

    // optimistic UI (tạm)
    const tmpId = `tmp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tmpId,
        sender_role: "admin",
        sender_id: adminId,
        content: text,
        created_at: new Date().toISOString(),
        _tmp: true,
      },
    ]);
    setTimeout(scrollToBottom, 30);

    try {
      await apiPost("/admin/api/shop_chat/send", {
        conversation_id: selectedId,
        admin_id: adminId,
        message: text,
      });

      // KHÔNG bắt buộc loadMessages ngay.
      // Realtime sẽ bắn INSERT và add vào. Nhưng để chắc chắn sync đúng thứ tự:
      await loadMessages(selectedId);
      await loadConversations();
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  // A) Subscribe thay đổi conversations -> chỉ reload list
  useEffect(() => {
    loadConversations();

    const ch = supabase
      .channel("admin_shop_conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_conversations" },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // B) Khi chọn conv -> load messages + subscribe INSERT messages của conv đó
  useEffect(() => {
  if (!selectedId || !adminId) return;


  loadMessages(selectedId);
  apiPost("/admin/api/shop_chat/mark_read", { conversation_id: selectedId, admin_id: adminId })
    .then(() => {
      // optimistic: set unread_count=0 tại local
      setConvs(prev => prev.map(c => c.id === selectedId ? { ...c, unread_count: 0, last_admin_read_at: new Date().toISOString() } : c));
    })
    .catch(() => {});
  const ch = supabase
    .channel(`admin_shop_messages_${selectedId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "shop_messages",
        filter: `conversation_id=eq.${selectedId}`,
      },
      (payload) => {
        addMessageIfNotExists(payload.new);
        setTimeout(scrollToBottom, 30);
      }
    )
    .on(
  "postgres_changes",
  { event: "UPDATE", schema: "public", table: "shop_messages", filter: `conversation_id=eq.${selectedId}` },
  (payload) => {
    const row = payload.new;
    setMessages(prev => prev.map(m => (m.id === row.id ? { ...m, ...row } : m)));
  }
)

    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "shop_messages",
        filter: `conversation_id=eq.${selectedId}`,
      },
      (payload) => {
        const deletedId = payload.old?.id;
        if (!deletedId) return;
        setMessages((prev) => prev.filter((m) => m.id !== deletedId));
      }
    )
    .subscribe();

  return () => supabase.removeChannel(ch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedId, adminId]);

  const lastMsgId = useMemo(() => {
  if (!messages?.length) return null;
  // nếu messages đã luôn sort theo created_at ASC thì dùng messages[messages.length-1].id là đủ
  return messages[messages.length - 1].id;
 }, [messages]);

  return (
    <div style={styles.wrap}>
      <div style={styles.left}>
        <div style={styles.leftHeader}>
          <div style={{ fontWeight: 700 }}>Shop Inbox</div>
          <button style={styles.btn} onClick={loadConversations} disabled={loadingConvs}>
            Refresh
          </button>
        </div>

        {loadingConvs && <div style={styles.muted}>Loading...</div>}

        <div style={styles.list}>
          {convs.map((c) => {
            const active = c.id === selectedId;
            return (
              <div
                key={c.id}
                style={{ ...styles.item, ...(active ? styles.itemActive : null) }}
                onClick={() => setSelectedId(c.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
    <img
      src={c.user_avatar_url || "/default-avatar.png"}
      alt=""
      style={styles.avatar}
      onError={(e) => (e.currentTarget.src = "/default-avatar.png")}
    />
    <div style={{ minWidth: 0 }}>
      <div style={styles.userName}>
        {c.user_name || c.user_id}
      </div>
      <div style={styles.sub}>
  Last: {timeAgo(c.last_message_at || c.updated_at || c.created_at)}
</div>

    </div>
  </div>

  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    {c.unread_count > 0 && <div style={styles.unreadBadge}>{c.unread_count}</div>}
    <div style={styles.badge}>{c.status}</div>
  </div>
</div>

              </div>
            );
          })}

          {!loadingConvs && convs.length === 0 && (
            <div style={styles.muted}>Chưa có cuộc hội thoại nào.</div>
          )}
        </div>
      </div>

      <div style={styles.right}>
        <div style={styles.rightHeader}>
  <div>
    

    {selectedConv && (
      <div style={{ ...styles.sub, display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <img
          src={selectedConv.user_avatar_url || "/default-avatar.png"}
          alt="avatar"
          style={{ width: 40, height: 40, borderRadius: 999}}
          onError={(e) => { e.currentTarget.src = "/default-avatar.png"; }}
        />
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, }}>
            {selectedConv.user_name || "Người dùng"}
          </div>
          
        </div>
      </div>
    )}
  </div>
</div>


        {err && <div style={styles.err}>{err}</div>}

        <div style={styles.chat}>
          {loadingMsgs && <div style={styles.muted}>Loading messages...</div>}

          {messages.map((m) => {
  const isAdminMsg = m.sender_role === "admin";
const recalled = m.is_recalled === true;

// chỉ show status khi: (1) tin này là admin, (2) là tin cuối cùng, (3) chưa thu hồi
const showStatus = isAdminMsg && m.id === lastMsgId && !recalled;

// seen: dựa last_user_read_at (backend trả về trong selectedConv)
const userReadAt = selectedConv?.last_user_read_at ? new Date(selectedConv.last_user_read_at) : null;
const seenByUser = showStatus && userReadAt && new Date(m.created_at) <= userReadAt;

// nếu muốn đẹp hơn cho tin tmp:
const isTmp = String(m.id || "").startsWith("tmp-") || m._tmp === true;
const statusText = isTmp ? "Đang gửi..." : (seenByUser ? "Đã xem" : "Đã gửi");


  // chỉ hiện ⋮ khi là tin admin + chưa thu hồi + không phải tmp
  const canRecall =
    isAdminMsg && !recalled && !String(m.id || "").startsWith("tmp-");

  return (
    <div
      key={m.id}
      style={{
        ...styles.msgRow,
        justifyContent: isAdminMsg ? "flex-end" : "flex-start",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      {canRecall && (
        <button
          style={styles.kebabOutside}
          onClick={(e) => openMenu(e, m.id)}
          title="Tùy chọn"
        >
          ⋮
        </button>
      )}

      {/* Cột chứa bubble + meta ở ngoài bubble */}
      <div
        style={{
          ...styles.msgCol,
          alignItems: isAdminMsg ? "flex-end" : "flex-start",
        }}
      >
        {/* Bubble */}
        <div
          style={{
            ...styles.bubble,
            ...(isAdminMsg ? styles.bubbleAdmin : styles.bubbleUser),
            ...(recalled ? styles.bubbleRecalled : null),
          }}
        >
          <div
            style={{
              whiteSpace: "pre-wrap",
              fontStyle: recalled ? "italic" : "normal",
            }}
          >
            {recalled ? "Tin nhắn đã thu hồi" : m.content}
          </div>
        </div>

        {/* Meta nằm ngoài bubble (nền trắng) */}
        <div
          style={{
            ...styles.metaBelow,
            alignItems: isAdminMsg ? "flex-end" : "flex-start",
          }}
        >
          <div style={styles.timeText}>{fmtTime(m.created_at)}</div>
          {showStatus && (
  <div style={styles.statusText}>{statusText}</div>
)}

        </div>
      </div>

      {/* Menu */}
      {menu.open && menu.id === m.id && (
        <div ref={menuRef} style={{ ...styles.menu, top: menu.y, left: menu.x }}>
          <button style={styles.menuItem} onClick={() => recallMessage(m.id)}>
            Thu hồi
          </button>
        </div>
      )}
    </div>
  );
})}





          <div ref={bottomRef} />
        </div>

        <div style={styles.inputBar}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nhập tin nhắn cho khách..."
            style={styles.input}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={!selectedId}
          />
          <button style={styles.btnPrimary} onClick={sendMessage} disabled={!selectedId}>
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", height: "calc(100vh - 80px)", gap: 12 },
  left: { width: 380, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" },
  right: { flex: 1, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" },

  leftHeader: { padding: 12, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" },
  rightHeader: { padding: 12, borderBottom: "1px solid #e5e7eb" },

  list: { padding: 8, overflow: "auto", height: "100%" },
  item: { padding: 10, borderRadius: 10, border: "1px solid #f3f4f6", marginBottom: 8, cursor: "pointer" },
  itemActive: { border: "1px solid #111827", background: "#f9fafb" },

  badge: { fontSize: 12, padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb", color: "#111827" },
  sub: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  muted: { padding: 12, color: "#6b7280" },
  err: { padding: 10, background: "#fef2f2", color: "#991b1b", borderBottom: "1px solid #fecaca" },

  chat: { flex: 1, padding: 12, overflow: "auto", background: "#f9fafb" },
  msgRow: { display: "flex", marginBottom: 10 },
  bubble: { maxWidth: 520, padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" },
  bubbleUser: { background: "#ffffff" },
  bubbleAdmin: { background: "#111827", color: "#ffffff", border: "1px solid #111827" },
  time: { fontSize: 11, opacity: 0.7, marginTop: 6 },

  inputBar: { padding: 10, borderTop: "1px solid #e5e7eb", display: "flex", gap: 8 },
  input: { flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", outline: "none" },
  btn: { padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" },
  btnPrimary: { padding: "10px 14px", borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer" },
  kebab: {
  position: "absolute",
  top: 6,
  right: 6,
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  lineHeight: "26px",
  fontSize: 18,
},

menu: {
  position: "fixed",
  width: 140,
  zIndex: 9999,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  overflow: "hidden",
},

menuItem: {
  width: "100%",
  padding: "10px 12px",
  textAlign: "left",
  background: "#fff",
  border: "none",
  cursor: "pointer",
},
kebabOutside: {
  width: 30,
  height: 30,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  lineHeight: "28px",
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 4, // canh ngang top bubble
},
bubbleRecalled: {
  background: "#f3f4f6",
  color: "#6b7280",
  border: "1px solid #e5e7eb",
},
avatar: {
  width: 36,
  height: 36,
  borderRadius: 999,
  objectFit: "cover",
  border: "1px solid #e5e7eb",
},
userName: {
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 220,
},
unreadBadge: {
  minWidth: 22,
  height: 22,
  padding: "0 6px",
  borderRadius: 999,
  background: "#ef4444",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
},
metaRow: {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginTop: 6,
  opacity: 0.75,
  fontSize: 11,
},
status: { whiteSpace: "nowrap" },

msgCol: {
  display: "flex",
  flexDirection: "column",
},

metaBelow: {
  marginTop: 4,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  fontSize: 11,
  color: "#6b7280",
},

timeText: {
  opacity: 0.75,
},

statusText: {
  opacity: 0.9,
  whiteSpace: "nowrap",
},

};
