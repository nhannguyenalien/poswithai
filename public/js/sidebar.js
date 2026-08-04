/**
 * sidebar.js — Sidebar dùng chung cho tất cả trang
 * Tự detect active theo URL hiện tại
 * Import và gọi initSidebar() trong mỗi trang
 */
import { renderUserInfo, logout } from "/js/auth.js";

const NAV = [
  { href: "/dashboard.html",            icon: "📊", label: "Tổng quan" },
  { href: "/orders.html",           icon: "🧾", label: "Bán lẻ POS" },
  { href: "/orders-wholesale.html", icon: "📦", label: "Bán sỉ" },
  { href: "/orders-list.html",      icon: "📜", label: "Danh sách đơn" },
  { href: "/products.html",         icon: "🏷️", label: "Sản phẩm" },
  { href: "/inventory.html",        icon: "🗄️", label: "Kho hàng" },
  { href: "/customers.html",        icon: "👥", label: "Khách hàng" },
  { href: "/categories.html",       icon: "🗂️", label: "Danh mục" },
  { href: "/reports.html",          icon: "📈", label: "Báo cáo" },
  { href: "/import.html",           icon: "📥", label: "Import" },
  "divider",
  { href: "/gold-prices.html",      icon: "💰", label: "Giá Vàng" },
  { href: "/gold-invoices.html",    icon: "📋", label: "HĐ Vàng" },
  { href: "/api-tokens.html",       icon: "🔑", label: "API" },
  { href: "/backup.html",           icon: "💾", label: "Sao lưu" },
  "divider",
  { href: "/settings.html",         icon: "⚙️", label: "Cài đặt" },
];

export function initSidebar() {
  const current = window.location.pathname;

  const items = NAV.map(item => {
    if (item === "divider") return `<li class="nav-item"><hr class="navbar-divider"/></li>`;
    const active = current === item.href || (current === "/" && item.href === "/dashboard.html")
      ? "active" : "";
    return `
      <li class="nav-item ${active}">
        <a class="nav-link" href="${item.href}">
          <span class="nav-link-icon">${item.icon}</span>
          <span class="nav-link-title">${item.label}</span>
        </a>
      </li>`;
  }).join("");

  const html = `
    <div class="container-fluid">
      <button class="navbar-toggler" type="button"
        data-bs-toggle="collapse" data-bs-target="#sidebar-menu">
        <span class="navbar-toggler-icon"></span>
      </button>
      <h1 class="navbar-brand navbar-brand-autodark">
        <a href="/dashboard.html">🏪 POS</a>
      </h1>
      <div class="collapse navbar-collapse" id="sidebar-menu">
        <ul class="navbar-nav pt-lg-3">${items}</ul>
        <div class="mt-auto pb-3 px-3 border-top pt-3">
          <div class="d-flex align-items-center gap-2">
            <div class="flex-fill fw-medium" id="user-name">...</div>
            <button class="btn btn-sm btn-ghost-light" id="btn-logout">↩</button>
          </div>
        </div>
      </div>
    </div>`;

  // Inject vào thẻ <aside> có sẵn trong trang
  const aside = document.querySelector("aside.navbar-vertical");
  if (aside) aside.innerHTML = html;

  // Setup logout
  renderUserInfo();
  document.getElementById("btn-logout")?.addEventListener("click", logout);
}