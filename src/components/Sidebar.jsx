/* eslint-disable react/prop-types */
export default function Sidebar({ activeTab, setActiveTab, adminInfo }) {
  return (
    <div
      className="sidebar"
      style={{
        height: '100vh',
        background: '#343a40',
        color: '#fff',
        position: 'fixed',
        width: 250,
        top: 0,
        left: 0,
        paddingTop: 20,
      }}
    >
      <div className="text-center  px-2">
        <img
          src={
            'https://korlofxtailwltuhydya.supabase.co/storage/v1/object/public/laptopbanchon/logo_moi.png'
          }
        
          width="200"
          height="200"
          
        />
        
      </div>

      <a
  href="#"
  className={activeTab === 'dashboard' ? 'active-tab' : ''}
  onClick={() => setActiveTab('dashboard')}
>
  📈 Thống kê
</a>

<a
  href="#"
  className={activeTab === 'users' ? 'active-tab' : ''}
  onClick={() => setActiveTab('users')}
>
  👤 Danh sách người dùng
</a>

<a
  href="#"
  className={activeTab === 'products' ? 'active-tab' : ''}
  onClick={() => setActiveTab('products')}
>
  📦 Danh sách sản phẩm
</a>

<a
  href="#"
  className={activeTab === 'inventory' ? 'active-tab' : ''}
  onClick={() => setActiveTab('inventory')}
>
  🗃 Danh sách tồn kho
</a>

<a
  href="#"
  className={activeTab === 'orders' ? 'active-tab' : ''}
  onClick={() => setActiveTab('orders')}
>
  🧾 Danh sách đơn hàng
</a>

<a
  href="#"
  className={activeTab === 'banners' ? 'active-tab' : ''}
  onClick={() => setActiveTab('banners')}
>
  🖼 Danh sách Banners
</a>
<p>_______________________________________</p>
<a
  href="#"
  className={activeTab === 'charts' ? 'active-tab' : ''}
  onClick={() => setActiveTab('charts')}
>
  💬 Tin nhắn
</a>
      
    
      <style>{`
        .sidebar a {
          display:block;
          padding:12px 20px;
          color:white;
          text-decoration:none;
        }
        .sidebar a:hover{
          background:#495057;
        }
        .sidebar a.active-tab{
          background:#f8d7b3;
          color:#d9480f !important;
          font-weight:bold;
        }
      `}</style>
    </div>
  )
}
