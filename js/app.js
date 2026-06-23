/* ============================================
   闪电充电 v2.0 - 核心应用逻辑
   前端技术栈：原生 JS + CSS3 + SVG
   适合作为招聘展示案例
   ============================================ */

// ============ 全局状态管理 ============
const AppState = {
  currentPage: 'home',
  currentStation: null,
  currentCharger: null,
  chargingSession: null,
  chargingTimer: null,
  selectedCoupon: null,
  orders: [...MockData.orders],
  rechargeAmount: 100,
  rechargeMethod: 'wechat',
  permissionGranted: { location: false, push: false },
};

// ============ 工具函数 ============
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
}

function showToast(message, duration = 2000) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), duration);
}

function showLoading() { $('#loading').style.display = 'flex'; }
function hideLoading() { $('#loading').style.display = 'none'; }

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' +
    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// ============ 启动流程 ============
function initSplash() {
  // 启动页展示 2 秒
  setTimeout(() => {
    $('#splash-screen').classList.add('hide');
    // 启动页消失后，检查是否需要展示权限弹窗
    setTimeout(() => showPermissionFlow(), 500);
  }, 2000);
}

function showPermissionFlow() {
  // 先展示定位权限
  $('#permission-modal').style.display = 'flex';
}

function handlePermission(granted) {
  AppState.permissionGranted.location = granted;
  $('#permission-modal').style.display = 'none';

  if (granted) {
    showToast('定位授权成功 📍');
    // 定位授权后短暂延迟再展示推送权限
    setTimeout(() => {
      $('#push-modal').style.display = 'flex';
    }, 600);
  } else {
    showToast('可在设置中开启定位以获取附近电站');
    setTimeout(() => {
      $('#push-modal').style.display = 'flex';
    }, 600);
  }
}

function handlePushPermission(granted) {
  AppState.permissionGranted.push = granted;
  $('#push-modal').style.display = 'none';
  if (granted) {
    showToast('通知已开启 🔔');
  }
}

// ============ 页面导航路由 ============
function navigateTo(pageName, params = {}) {
  if (AppState.chargingSession && !['charging', 'home'].includes(pageName)) {
    showToast('充电中，请先结束充电');
    return;
  }

  // 切换页面显示
  $$('.page').forEach(p => p.classList.remove('active'));
  const pageEl = $(`#page-${pageName}`);
  if (pageEl) pageEl.classList.add('active');

  // 更新底部导航
  const navMap = {
    home: 'home', map: 'map', scan: 'scan',
    orders: 'orders', profile: 'profile',
    station: null, charging: null, recharge: null,
    coupon: null, invoice: null, vehicle: null,
  };
  const navTarget = navMap[pageName];

  $$('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === navTarget) item.classList.add('active');
  });

  AppState.currentPage = pageName;

  // 渲染目标页面
  const renderMap = {
    home: renderHome,
    station: () => {
      const station = params.stationId ? MockData.stations.find(s => s.id === params.stationId) : AppState.currentStation;
      if (station) { AppState.currentStation = station; renderStationDetail(station); }
    },
    map: renderMapPage,
    scan: renderScan,
    charging: renderCharging,
    orders: () => renderOrders(),
    profile: renderProfile,
    recharge: renderRecharge,
    coupon: renderCoupon,
    invoice: renderInvoice,
    vehicle: renderVehicle,
  };

  if (renderMap[pageName]) renderMap[pageName]();
  window.scrollTo(0, 0);
}

// ============ 首页 ============
function renderHome() {
  const container = $('#page-home');
  const user = MockData.user;

  // 公告轮播索引
  const noticeIdx = Math.floor(Math.random() * MockData.notices.length);

  container.innerHTML = `
    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-input-wrap">
        <i class="fas fa-search"></i>
        <input type="text" placeholder="搜索充电站、地址" onfocus="showToast('搜索功能开发中')">
      </div>
    </div>

    <!-- 公告条 -->
    <div class="notice-bar">
      <i class="fas fa-bullhorn"></i>
      <span>${MockData.notices[noticeIdx]}</span>
    </div>

    <!-- 横幅 -->
    <div class="banner-wrap">
      <div class="banner" onclick="showToast('活动详情页开发中')">
        <div class="banner-tag">限时活动</div>
        <div class="banner-title">充电满30减8元</div>
        <div class="banner-desc">新老用户均可参与，优惠券自动到账</div>
      </div>
    </div>

    <!-- 余额卡片 -->
    <div class="balance-card">
      <div class="balance-header">
        <div>
          <div class="balance-label">账户余额</div>
          <div class="balance-amount">${user.balance.toFixed(2)}<span>元</span></div>
        </div>
        <div style="text-align:right;">
          <div class="balance-label">${user.memberName}</div>
          <div style="font-size:16px;font-weight:700;">${user.points}<span style="font-size:11px;font-weight:400;">积分</span></div>
        </div>
      </div>
      <div class="balance-sub">累计充电 ${user.totalCharged.toFixed(1)} kWh · 碳减排 ${user.carbonSaved.toFixed(1)} kg</div>
      <div class="balance-actions">
        <button class="balance-btn" onclick="navigateTo('recharge')">充值</button>
        <button class="balance-btn" onclick="navigateTo('orders')">账单</button>
        <button class="balance-btn" onclick="navigateTo('invoice')">发票</button>
        <button class="balance-btn" onclick="navigateTo('coupon')">${MockData.coupons.filter(c=>!c.used).length}张券</button>
      </div>
    </div>

    <!-- 快捷功能 -->
    <div class="quick-actions">
      <div class="quick-action-item" onclick="navigateTo('scan')">
        <div class="quick-action-icon green"><i class="fas fa-bolt"></i></div>
        <div class="quick-action-label">扫码充电</div>
      </div>
      <div class="quick-action-item" onclick="navigateTo('map')">
        <div class="quick-action-icon orange"><i class="fas fa-map-marker-alt"></i></div>
        <div class="quick-action-label">附近电站</div>
      </div>
      <div class="quick-action-item" onclick="navigateTo('orders')">
        <div class="quick-action-icon blue"><i class="fas fa-receipt"></i></div>
        <div class="quick-action-label">充电订单</div>
      </div>
      <div class="quick-action-item" onclick="navigateTo('vehicle')">
        <div class="quick-action-icon purple"><i class="fas fa-car"></i></div>
        <div class="quick-action-label">我的车辆</div>
      </div>
    </div>

    <!-- 附近充电站列表 -->
    <div class="section-header">
      <div class="section-title">附近充电站</div>
      <div class="section-more" onclick="navigateTo('map')">查看地图 <i class="fas fa-chevron-right"></i></div>
    </div>
    <div id="station-list">
      ${MockData.stations.map(s => renderStationCard(s)).join('')}
    </div>
  `;
}

function renderStationCard(station) {
  const availableCount = station.chargers.filter(c => c.status === 'available').length;
  const fastCount = station.chargers.filter(c => c.type === 'fast' && c.status === 'available').length;
  const slowCount = station.chargers.filter(c => c.type === 'slow' && c.status === 'available').length;

  let statusHtml, statusCls;
  if (availableCount === 0) {
    statusHtml = '已满'; statusCls = 'status-busy';
  } else if (availableCount <= 3) {
    statusHtml = `仅剩${availableCount}个`; statusCls = 'status-busy';
  } else {
    statusHtml = `空闲${availableCount}个`; statusCls = 'status-available';
  }

  return `
    <div class="station-card" onclick="navigateTo('station', {stationId: ${station.id}})">
      <div class="station-thumb">
        <i class="fas fa-charging-station"></i>
      </div>
      <div class="station-info">
        <div class="station-name">${station.name}</div>
        <div class="station-addr"><i class="fas fa-map-marker-alt"></i> ${station.address}</div>
        <div class="station-meta">
          <span class="station-distance"><i class="fas fa-location-dot"></i> ${station.distance}km</span>
          <span class="tag tag-orange">快充 ${fastCount}</span>
          <span class="tag tag-green">慢充 ${slowCount}</span>
          <span class="station-price">¥${station.price}/度</span>
        </div>
      </div>
      <div class="station-status">
        <div class="${statusCls}"><i class="fas fa-circle"></i> ${statusHtml}</div>
        <span style="font-size:11px;color:var(--text-muted);">共${station.total}桩</span>
      </div>
    </div>
  `;
}

// ============ 地图页 ============
function renderMapPage() {
  const container = $('#page-map');
  const stations = MockData.stations;

  // 基于假坐标计算在地图上的位置百分比
  const minLat = 22.51, maxLat = 22.55;
  const minLng = 113.93, maxLng = 113.96;

  const markersHtml = stations.map(s => {
    const top = ((maxLat - s.lat) / (maxLat - minLat)) * 100;
    const left = ((s.lng - minLng) / (maxLng - minLng)) * 100;
    const avail = s.chargers.filter(c => c.status === 'available').length;
    const dotColor = avail === 0 ? 'var(--text-muted)' : avail <= 3 ? 'var(--warning)' : 'var(--primary)';
    return `
      <div class="map-marker" style="top:${20 + top * 0.55}%;left:${15 + left * 0.7}%;"
           onclick="navigateTo('station',{stationId:${s.id}})">
        <div class="map-marker-icon" style="background:${dotColor};">
          <i class="fas fa-charging-station"></i>
        </div>
        <div class="map-marker-label">${s.name.substring(0, 6)}...</div>
        <div class="map-marker-price">¥${s.price}/度</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="header">
      <div class="header-title">充电站地图</div>
      <div class="header-action" onclick="navigateTo('scan')">扫码</div>
    </div>
    <div class="map-container">
      <div class="map-bg">
        <div class="map-grid"></div>
        <!-- 模拟道路 -->
        <div class="map-road h" style="top:35%;"></div>
        <div class="map-road h" style="top:65%;"></div>
        <div class="map-road v" style="left:30%;"></div>
        <div class="map-road v" style="left:60%;"></div>
        <!-- 充电站标记 -->
        ${markersHtml}
      </div>
      <!-- 图例 -->
      <div class="map-legend">
        <div class="map-legend-item"><span class="map-legend-dot green"></span> 空闲充足</div>
        <div class="map-legend-item"><span class="map-legend-dot orange"></span> 即将满位</div>
        <div class="map-legend-item"><span class="map-legend-dot gray"></span> 已满/离线</div>
      </div>
      <!-- 定位按钮 -->
      <div class="map-locate-btn" onclick="showToast('定位中...');setTimeout(()=>showToast('已定位到当前位置📍'),1000);">
        <i class="fas fa-location-crosshairs"></i>
      </div>
      <!-- 底部推荐卡片 -->
      <div class="map-bottom-card" onclick="navigateTo('station',{stationId:1})">
        <i class="fas fa-charging-station"></i>
        <div>
          <div class="title">距离最近：特来电（科技园店）</div>
          <div class="sub">0.8km · 空闲8个 · ¥1.25/度</div>
        </div>
        <i class="fas fa-chevron-right" style="color:var(--text-muted);"></i>
      </div>
    </div>
  `;
}

// ============ 充电站详情 ============
function renderStationDetail(station) {
  const container = $('#page-station');
  const availableCount = station.chargers.filter(c => c.status === 'available').length;

  container.innerHTML = `
    <div class="station-detail-header">
      <div class="station-detail-back" onclick="navigateTo('home')">
        <i class="fas fa-arrow-left"></i>
      </div>
    </div>
    <div class="station-detail-info">
      <div class="station-detail-name">${station.name}</div>
      <div class="station-detail-addr"><i class="fas fa-map-marker-alt"></i> ${station.address}</div>
      <div class="station-detail-tags">
        ${station.tags.map(t => `<span class="tag tag-blue">${t}</span>`).join('')}
        <span style="color:var(--warning);font-size:13px;margin-left:auto;">⭐ ${station.rating}</span>
      </div>
      <div class="detail-info-row">
        <span class="detail-info-label">运营商</span>
        <span class="detail-info-value">${station.operator}</span>
      </div>
      <div class="detail-info-row">
        <span class="detail-info-label">距离</span>
        <span class="detail-info-value">${station.distance} km</span>
      </div>
      <div class="detail-info-row">
        <span class="detail-info-label">充电桩总数</span>
        <span class="detail-info-value">${station.total} 个</span>
      </div>
      <div class="detail-info-row">
        <span class="detail-info-label">空闲桩数</span>
        <span class="detail-info-value" style="color:var(--primary);">${availableCount} 个</span>
      </div>
      <div class="detail-info-row">
        <span class="detail-info-label">开放时间</span>
        <span class="detail-info-value">${station.openTime}</span>
      </div>
    </div>

    <div class="section-header" style="margin-top:6px;">
      <div class="section-title">选择充电桩</div>
      <div style="font-size:11px;color:var(--text-muted);">
        <span style="color:var(--primary);margin-right:10px;">🟢 空闲</span>
        <span style="color:var(--warning);margin-right:10px;">🟡 使用中</span>
        <span>⚪ 离线</span>
      </div>
    </div>
    <div class="charger-list">
      ${station.chargers.map(c => renderChargerItem(c, station)).join('')}
    </div>
  `;
}

function renderChargerItem(charger, station) {
  const statusMap = {
    available: { text: '空闲', color: 'var(--primary)' },
    charging: { text: '使用中', color: 'var(--warning)' },
    offline: { text: '离线', color: 'var(--text-muted)' },
  };
  const status = statusMap[charger.status];
  const typeIcon = charger.type === 'fast' ? 'fa-bolt' : 'fa-plug';
  const typeCls = charger.type === 'fast' ? 'fast' : 'slow';
  const typeName = charger.type === 'fast' ? '快充' : '慢充';
  const offlineClass = charger.status === 'offline' ? 'offline' : '';

  const clickAction = charger.status === 'available'
    ? `startChargeFlow('${charger.id}', ${station.id})`
    : `showToast('该充电桩${status.text}')`;

  return `
    <div class="charger-item ${offlineClass}" onclick="${clickAction}">
      <div class="charger-left">
        <div class="charger-icon ${typeCls}">
          <i class="fas ${typeIcon}"></i>
        </div>
        <div class="charger-info">
          <h4>${charger.id}号桩 <span class="tag tag-${charger.type === 'fast' ? 'blue' : 'green'}">${typeName}</span></h4>
          <p>功率 ${charger.power} · ${charger.connector}</p>
        </div>
      </div>
      <div class="charger-right">
        <div class="charger-price">¥${charger.price}<span>/度</span></div>
        <div class="charger-avail" style="color:${status.color};">● ${status.text}</div>
      </div>
    </div>
  `;
}

// ============ 扫码页 ============
function renderScan() {
  const container = $('#page-scan');
  container.innerHTML = `
    <div class="scan-page">
      <div class="scan-frame">
        <div class="scan-line"></div>
        <i class="fas fa-qrcode" style="color:rgba(255,255,255,0.08);font-size:80px;"></i>
      </div>
      <div class="scan-tip">将二维码放入框内，即可自动扫描</div>
      <div class="scan-input-area">
        <input type="text" id="scan-input" placeholder="或手动输入充电桩编号（如 A01）" maxlength="10">
        <button class="btn btn-primary btn-lg" onclick="manualScanStart()">
          <i class="fas fa-bolt"></i> 开始充电
        </button>
        <button class="btn btn-outline btn-lg" onclick="simulateScan()" style="margin-top:8px;">
          <i class="fas fa-camera"></i> 模拟扫码（演示用）
        </button>
        <p style="text-align:center;margin-top:12px;font-size:12px;color:var(--text-muted);">
          可输入编号：A01, A04, D01, D05, F01, H05, I01 等
        </p>
      </div>
    </div>
  `;
}

function simulateScan() {
  const stationsWithAvailable = MockData.stations.filter(s =>
    s.chargers.some(c => c.status === 'available')
  );
  if (stationsWithAvailable.length === 0) {
    showToast('附近暂无空闲充电桩');
    return;
  }
  const station = stationsWithAvailable[Math.floor(Math.random() * stationsWithAvailable.length)];
  const availableChargers = station.chargers.filter(c => c.status === 'available');
  const charger = availableChargers[Math.floor(Math.random() * availableChargers.length)];

  showToast(`已识别充电桩 ${charger.id}`, 1500);
  setTimeout(() => startChargeFlow(charger.id, station.id), 1000);
}

function manualScanStart() {
  const input = $('#scan-input');
  const code = input.value.trim().toUpperCase();
  if (!code) { showToast('请输入充电桩编号'); return; }

  let foundStation = null, foundCharger = null;
  for (const station of MockData.stations) {
    const charger = station.chargers.find(c => c.id === code);
    if (charger) { foundStation = station; foundCharger = charger; break; }
  }

  if (!foundCharger) { showToast('未找到该充电桩，请检查编号'); return; }
  if (foundCharger.status !== 'available') { showToast('该充电桩当前不可用'); return; }

  startChargeFlow(foundCharger.id, foundStation.id);
}

// ============ 充电流程 ============
function startChargeFlow(chargerId, stationId) {
  const station = MockData.stations.find(s => s.id === stationId);
  const charger = station.chargers.find(c => c.id === chargerId);
  if (!charger || charger.status !== 'available') { showToast('该充电桩暂不可用'); return; }

  AppState.currentStation = station;
  AppState.currentCharger = charger;
  showChargeConfirmModal(station, charger);
}

function showChargeConfirmModal(station, charger) {
  const oldOverlay = document.querySelector('.modal-overlay');
  if (oldOverlay) oldOverlay.remove();

  const typeName = charger.type === 'fast' ? '快充' : '慢充';
  const estimatedTime = charger.type === 'fast' ? '约30-40分钟' : '约6-8小时';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-size:36px;margin-bottom:6px;">🔌</div>
        <h3 style="font-size:17px;font-weight:700;">确认开始充电</h3>
      </div>
      <div class="pay-detail">
        <div class="pay-detail-row"><span>充电站</span><span style="font-weight:500;">${station.name}</span></div>
        <div class="pay-detail-row"><span>充电桩</span><span style="font-weight:500;">${charger.id}号桩 (${typeName} ${charger.power})</span></div>
        <div class="pay-detail-row"><span>接口标准</span><span>${charger.connector}</span></div>
        <div class="pay-detail-row"><span>电价</span><span style="color:var(--warning);font-weight:600;">¥${charger.price}/度</span></div>
        <div class="pay-detail-row"><span>预计时长</span><span>${estimatedTime}</span></div>
        <div class="pay-detail-row"><span>账户余额</span><span style="color:var(--primary);">¥${MockData.user.balance.toFixed(2)}</span></div>
      </div>
      <button class="btn btn-primary btn-lg" onclick="confirmStartCharge()" style="margin-top:14px;">
        <i class="fas fa-bolt"></i> 确认启动
      </button>
      <button class="btn btn-outline btn-lg" onclick="closeModal()" style="margin-top:8px;">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}

function confirmStartCharge() {
  closeModal();
  const station = AppState.currentStation;
  const charger = AppState.currentCharger;
  if (!station || !charger) return;

  charger.status = 'charging';

  AppState.chargingSession = {
    station, charger,
    startTime: new Date(),
    elapsedSeconds: 0,
    energy: 0,
    cost: 0,
    targetPercent: 90,
    chargeHistory: [],
  };

  showToast('充电已启动 ⚡', 1500);
  setTimeout(() => navigateTo('charging'), 800);
}

// ============ 充电中页面 ============
function renderCharging() {
  const container = $('#page-charging');

  if (!AppState.chargingSession) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-bolt"></i>
        <p>当前没有正在进行的充电</p>
        <button class="btn btn-primary" onclick="navigateTo('scan')" style="margin-top:14px;">去充电</button>
      </div>`;
    return;
  }

  const session = AppState.chargingSession;
  const percent = Math.min(Math.floor((session.elapsedSeconds / 2400) * 100), 99);
  const circumference = 2 * Math.PI * 82;
  const offset = circumference - (percent / 100) * circumference;

  // 生成充电曲线柱状图
  const barsHtml = Array.from({ length: 20 }, (_, i) => {
    const barPercent = Math.min((session.elapsedSeconds / 2400) * 100, 100);
    const barH = Math.min((i / 20) * barPercent * 1.5, 100);
    return `<div class="charge-curve-bar" style="height:${Math.max(barH, 4)}%;${i < (percent/5) ? 'background:var(--primary);' : 'background:#e5e7eb;'}"></div>`;
  }).join('');

  container.innerHTML = `
    <div class="charging-page">
      <div class="charging-circle">
        <svg width="190" height="190" viewBox="0 0 190 190">
          <circle class="charging-circle-bg" cx="95" cy="95" r="82"></circle>
          <circle class="charging-circle-progress" cx="95" cy="95" r="82"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
        </svg>
        <div class="charging-circle-content">
          <div class="charging-battery-icon"><i class="fas fa-bolt"></i></div>
          <div class="charging-percent">${percent}%</div>
        </div>
      </div>
      <div class="charging-status-text">
        ⚡ 充电中 - 预计充满还需${formatDuration(Math.max(Math.floor((2400 - session.elapsedSeconds) / 60), 1))}
      </div>
      <div class="charging-info-grid">
        <div class="charging-info-item">
          <div class="charging-info-label">已充电量</div>
          <div class="charging-info-value">${session.energy.toFixed(2)} <span style="font-size:12px;">kWh</span></div>
        </div>
        <div class="charging-info-item">
          <div class="charging-info-label">充电费用</div>
          <div class="charging-info-value" style="color:var(--warning);">¥${session.cost.toFixed(2)}</div>
        </div>
        <div class="charging-info-item">
          <div class="charging-info-label">已充时长</div>
          <div class="charging-info-value small">${formatDuration(Math.floor(session.elapsedSeconds / 60))}</div>
        </div>
        <div class="charging-info-item">
          <div class="charging-info-label">当前功率</div>
          <div class="charging-info-value small">${session.charger.power}</div>
        </div>
      </div>

      <!-- 充电曲线 -->
      <div class="charge-curve-wrap">
        <h4>📈 充电功率曲线</h4>
        <div class="charge-curve">${barsHtml}</div>
      </div>

      <div style="padding:0 16px;margin-bottom:6px;">
        <div style="background:var(--card-bg);border-radius:var(--radius-sm);padding:12px 16px;text-align:left;box-shadow:var(--shadow);">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;">充电桩信息</div>
          <div style="font-size:14px;font-weight:500;">${session.station.name}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${session.charger.id}号桩 · ${session.charger.type === 'fast' ? '快充' : '慢充'} · ${session.charger.connector} · ¥${session.charger.price}/度</div>
        </div>
      </div>
      <div class="charging-actions">
        <button class="btn btn-danger btn-lg" onclick="stopCharging()">
          <i class="fas fa-stop-circle"></i> 结束充电
        </button>
        <button class="btn btn-outline btn-lg" onclick="showToast('充电完成后将自动推送通知')">
          <i class="fas fa-bell"></i> 充满提醒
        </button>
      </div>
    </div>
  `;

  startChargingTimer();
}

function startChargingTimer() {
  if (AppState.chargingTimer) return;

  AppState.chargingTimer = setInterval(() => {
    if (!AppState.chargingSession) {
      clearInterval(AppState.chargingTimer);
      AppState.chargingTimer = null;
      return;
    }

    const session = AppState.chargingSession;
    session.elapsedSeconds += 1;

    const rate = session.charger.type === 'fast' ? 0.013 : 0.002;
    session.energy += rate;
    session.cost = session.energy * session.charger.price;

    // 记录充电曲线数据
    if (session.elapsedSeconds % 120 === 0) {
      session.chargeHistory.push({ time: session.elapsedSeconds, power: parseFloat(session.charger.power) });
    }

    updateChargingUI();

    if (session.elapsedSeconds >= 2400) {
      stopCharging(true);
    }
  }, 1000);
}

function updateChargingUI() {
  const session = AppState.chargingSession;
  if (!session) return;

  const percent = Math.min(Math.floor((session.elapsedSeconds / 2400) * 100), 99);
  const circumference = 2 * Math.PI * 82;
  const offset = circumference - (percent / 100) * circumference;

  const progressCircle = document.querySelector('.charging-circle-progress');
  if (progressCircle) progressCircle.setAttribute('stroke-dashoffset', offset);

  const percentEl = document.querySelector('.charging-percent');
  if (percentEl) percentEl.textContent = percent + '%';

  const statusText = document.querySelector('.charging-status-text');
  if (statusText) {
    const remaining = Math.max(Math.floor((2400 - session.elapsedSeconds) / 60), 1);
    statusText.innerHTML = `⚡ 充电中 - 预计充满还需${formatDuration(remaining)}`;
  }

  const infoValues = document.querySelectorAll('.charging-info-value');
  if (infoValues.length >= 4) {
    infoValues[0].innerHTML = `${session.energy.toFixed(2)} <span style="font-size:12px;">kWh</span>`;
    infoValues[1].textContent = `¥${session.cost.toFixed(2)}`;
    infoValues[2].textContent = formatDuration(Math.floor(session.elapsedSeconds / 60));
  }

  // 更新曲线柱状图
  const bars = document.querySelectorAll('.charge-curve-bar');
  const barPercent = Math.min((session.elapsedSeconds / 2400) * 100, 100);
  bars.forEach((bar, i) => {
    const barH = Math.min((i / bars.length) * barPercent * 1.5, 100);
    bar.style.height = Math.max(barH, 4) + '%';
    bar.style.background = i < (percent / 5) ? 'var(--primary)' : '#e5e7eb';
  });
}

function stopCharging(autoComplete = false) {
  if (!AppState.chargingSession) return;

  clearInterval(AppState.chargingTimer);
  AppState.chargingTimer = null;

  const session = AppState.chargingSession;
  session.charger.status = 'available';

  const order = {
    id: 'ORD' + Date.now(),
    stationName: session.station.name,
    chargerId: session.charger.id,
    chargerType: session.charger.type,
    power: session.charger.power,
    startTime: session.startTime.toISOString(),
    endTime: new Date().toISOString(),
    duration: Math.floor(session.elapsedSeconds / 60),
    energy: parseFloat(session.energy.toFixed(2)),
    price: session.charger.price,
    amount: parseFloat(session.cost.toFixed(2)),
    couponAmount: AppState.selectedCoupon ? AppState.selectedCoupon.amount : 0,
    actualPay: parseFloat((session.cost - (AppState.selectedCoupon ? AppState.selectedCoupon.amount : 0)).toFixed(2)),
    status: 'completed',
    payMethod: '余额',
  };

  AppState.orders.unshift(order);
  MockData.user.balance -= order.actualPay;
  MockData.user.totalCharged += order.energy;
  MockData.user.totalOrders += 1;
  MockData.user.points += Math.floor(order.energy * 10);

  AppState.chargingSession = null;
  AppState.selectedCoupon = null;

  showPaymentResultModal(order, autoComplete);

  if (AppState.currentPage === 'home') renderHome();
}

function showPaymentResultModal(order, autoComplete) {
  const oldOverlay = document.querySelector('.modal-overlay');
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet pay-modal-content">
      <div class="modal-handle"></div>
      <div style="font-size:50px;margin:10px 0;">${autoComplete ? '🔋' : '✅'}</div>
      <h3 style="font-size:17px;font-weight:700;margin-bottom:2px;">
        ${autoComplete ? '充电已完成' : '充电已结束'}
      </h3>
      <div class="pay-amount">¥${order.actualPay.toFixed(2)}<span></span></div>
      <div class="pay-detail">
        <div class="pay-detail-row"><span>充电站</span><span>${order.stationName}</span></div>
        <div class="pay-detail-row"><span>充电桩</span><span>${order.chargerId}号桩 · ${order.chargerType === 'fast' ? '快充' : '慢充'}</span></div>
        <div class="pay-detail-row"><span>充电时长</span><span>${formatDuration(order.duration)}</span></div>
        <div class="pay-detail-row"><span>充电电量</span><span>${order.energy} kWh</span></div>
        <div class="pay-detail-row"><span>单价</span><span>¥${order.price}/度</span></div>
        ${order.couponAmount > 0 ? `<div class="pay-detail-row"><span>优惠券</span><span style="color:var(--danger);">-¥${order.couponAmount.toFixed(2)}</span></div>` : ''}
        <hr class="order-divider">
        <div class="pay-detail-row" style="font-weight:700;font-size:15px;">
          <span>实付金额</span>
          <span style="color:var(--primary);">¥${order.actualPay.toFixed(2)}</span>
        </div>
        <div class="pay-detail-row" style="color:var(--text-muted);">
          <span>余额支付 · 剩余</span>
          <span>¥${Math.max(0, MockData.user.balance).toFixed(2)}</span>
        </div>
      </div>
      <button class="btn btn-primary btn-lg" onclick="closeModal();navigateTo('home')">返回首页</button>
      <button class="btn btn-outline btn-lg" onclick="closeModal();navigateTo('orders')" style="margin-top:7px;">查看订单</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { closeModal(); navigateTo('home'); }
  });
}

// ============ 订单页 ============
function renderOrders(filter = 'all') {
  const container = $('#page-orders');
  let filtered = AppState.orders;
  if (filter === 'ongoing') filtered = AppState.orders.filter(o => o.status === 'ongoing');
  else if (filter === 'completed') filtered = AppState.orders.filter(o => o.status === 'completed');

  container.innerHTML = `
    <div class="order-tabs">
      <div class="order-tab ${filter==='all'?'active':''}" onclick="renderOrders('all')">全部</div>
      <div class="order-tab ${filter==='ongoing'?'active':''}" onclick="renderOrders('ongoing')">进行中</div>
      <div class="order-tab ${filter==='completed'?'active':''}" onclick="renderOrders('completed')">已完成</div>
    </div>
    <div id="order-list">
      ${filtered.length === 0
        ? `<div class="empty-state"><i class="fas fa-receipt"></i><p>暂无相关订单</p></div>`
        : filtered.map(o => renderOrderCard(o)).join('')}
    </div>
  `;
}

function renderOrderCard(order) {
  const statusMap = {
    completed: { text: '已完成', cls: 'completed' },
    ongoing: { text: '进行中', cls: 'ongoing' },
    cancelled: { text: '已取消', cls: 'cancelled' },
  };
  const status = statusMap[order.status];
  const typeName = order.chargerType === 'fast' ? '快充' : '慢充';
  const timeStr = formatDate(order.startTime);

  return `
    <div class="order-card">
      <div class="order-card-header">
        <span class="order-station">${order.stationName}</span>
        <span class="order-status-badge ${status.cls}">${status.text}</span>
      </div>
      <div class="order-detail-row">
        <span>充电桩 ${order.chargerId}号 · ${typeName}${order.power ? ' · ' + order.power : ''}</span>
        <span>${timeStr}</span>
      </div>
      ${order.status === 'completed' ? `
        <div class="order-detail-row"><span>充电时长</span><span>${formatDuration(order.duration)}</span></div>
        <div class="order-detail-row"><span>充电电量</span><span>${order.energy} kWh</span></div>
        ${order.couponAmount > 0 ? `<div class="order-detail-row"><span>优惠</span><span style="color:var(--danger);">-¥${order.couponAmount.toFixed(2)}</span></div>` : ''}
        <hr class="order-divider">
        <div class="order-total"><span>实付</span><span class="order-total-price">¥${(order.actualPay || order.amount).toFixed(2)}</span></div>
      ` : `
        <div class="order-detail-row" style="color:var(--info);margin-top:7px;">
          <span><i class="fas fa-bolt"></i> 充电中...</span>
        </div>
      `}
    </div>
  `;
}

// ============ 个人中心 ============
function renderProfile() {
  const container = $('#page-profile');
  const user = MockData.user;

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar"><i class="fas fa-user"></i></div>
      <div class="profile-name">${user.name}</div>
      <div class="profile-phone">${user.phone} · ${user.memberName}</div>
    </div>
    <div class="profile-stats">
      <div class="profile-stat">
        <div class="profile-stat-value">${user.totalOrders}</div>
        <div class="profile-stat-label">充电次数</div>
      </div>
      <div class="profile-stat">
        <div class="profile-stat-value">${user.totalCharged.toFixed(1)}</div>
        <div class="profile-stat-label">累计电量(kWh)</div>
      </div>
      <div class="profile-stat">
        <div class="profile-stat-value">${user.carbonSaved.toFixed(1)}</div>
        <div class="profile-stat-label">碳减排(kg)</div>
      </div>
    </div>
    <div class="profile-menu">
      <div class="profile-menu-item" onclick="navigateTo('recharge')">
        <div class="profile-menu-icon" style="background:#e6faf1;color:var(--primary);"><i class="fas fa-wallet"></i></div>
        <div class="profile-menu-text">我的钱包</div>
        <span style="color:var(--primary);font-weight:600;margin-right:8px;">¥${user.balance.toFixed(2)}</span>
        <div class="profile-menu-arrow"><i class="fas fa-chevron-right"></i></div>
      </div>
      <div class="profile-menu-item" onclick="navigateTo('vehicle')">
        <div class="profile-menu-icon" style="background:#e3f2fd;color:#1565c0;"><i class="fas fa-car"></i></div>
        <div class="profile-menu-text">我的车辆</div>
        <span style="color:var(--text-muted);font-size:12px;margin-right:8px;">${user.vehicles.length}辆</span>
        <div class="profile-menu-arrow"><i class="fas fa-chevron-right"></i></div>
      </div>
      <div class="profile-menu-item" onclick="navigateTo('coupon')">
        <div class="profile-menu-icon" style="background:#fff3e0;color:#e65100;"><i class="fas fa-ticket-alt"></i></div>
        <div class="profile-menu-text">优惠券</div>
        <span class="tag tag-orange" style="margin-right:8px;">${MockData.coupons.filter(c=>!c.used).length}张可用</span>
        <div class="profile-menu-arrow"><i class="fas fa-chevron-right"></i></div>
      </div>
      <div class="profile-menu-item" onclick="navigateTo('orders')">
        <div class="profile-menu-icon" style="background:#f3e8ff;color:var(--purple);"><i class="fas fa-receipt"></i></div>
        <div class="profile-menu-text">充电记录</div>
        <div class="profile-menu-arrow"><i class="fas fa-chevron-right"></i></div>
      </div>
      <div class="profile-menu-item" onclick="navigateTo('invoice')">
        <div class="profile-menu-icon" style="background:#e8f5e9;color:#2e7d32;"><i class="fas fa-file-invoice"></i></div>
        <div class="profile-menu-text">发票管理</div>
        <span style="color:var(--text-muted);font-size:12px;margin-right:8px;">${MockData.invoices.length}张</span>
        <div class="profile-menu-arrow"><i class="fas fa-chevron-right"></i></div>
      </div>
      <div class="profile-menu-item" onclick="showToast('设置页面开发中')">
        <div class="profile-menu-icon" style="background:#f3f4f6;color:#6b7280;"><i class="fas fa-cog"></i></div>
        <div class="profile-menu-text">设置</div>
        <div class="profile-menu-arrow"><i class="fas fa-chevron-right"></i></div>
      </div>
      <div class="profile-menu-item" onclick="showToast('客服接入中...')">
        <div class="profile-menu-icon" style="background:#fce4ec;color:#c62828;"><i class="fas fa-headset"></i></div>
        <div class="profile-menu-text">联系客服</div>
        <div class="profile-menu-arrow"><i class="fas fa-chevron-right"></i></div>
      </div>
    </div>
  `;
}

// ============ 充值页 ============
function renderRecharge() {
  const container = $('#page-recharge');
  const amounts = [50, 100, 200, 300, 500, 1000];
  const bonuses = { 50: 0, 100: 5, 200: 15, 300: 30, 500: 60, 1000: 150 };

  container.innerHTML = `
    <div class="header">
      <div class="header-back" onclick="navigateTo('profile')"><i class="fas fa-arrow-left"></i></div>
      <div class="header-title">账户充值</div>
      <div style="width:34px;"></div>
    </div>
    <div style="text-align:center;padding:20px 16px;">
      <div style="font-size:14px;color:var(--text-muted);">当前余额</div>
      <div style="font-size:36px;font-weight:800;color:var(--primary);margin:4px 0;">¥${MockData.user.balance.toFixed(2)}</div>
    </div>
    <div class="section-header"><div class="section-title">选择充值金额</div></div>
    <div class="recharge-amounts">
      ${amounts.map(a => `
        <div class="recharge-amount-item ${AppState.rechargeAmount === a ? 'active' : ''}"
             onclick="selectRechargeAmount(${a})">
          <div class="amount">¥${a}</div>
          ${bonuses[a] > 0 ? `<div class="bonus">送¥${bonuses[a]}</div>` : ''}
        </div>
      `).join('')}
    </div>
    <div class="recharge-custom">
      <span>¥</span>
      <input type="number" placeholder="自定义金额" value="${AppState.rechargeAmount}" onchange="AppState.rechargeAmount=parseFloat(this.value)||100">
    </div>
    <div class="section-header"><div class="section-title">支付方式</div></div>
    <div class="recharge-methods">
      <div class="recharge-method-item ${AppState.rechargeMethod==='wechat'?'active':''}" onclick="AppState.rechargeMethod='wechat';renderRecharge();">
        <span class="icon" style="color:#07c160;">💚</span>
        <span class="name">微信支付</span>
        <span class="check"><i class="fas ${AppState.rechargeMethod==='wechat'?'fa-check-circle':'fa-circle'}"></i></span>
      </div>
      <div class="recharge-method-item ${AppState.rechargeMethod==='alipay'?'active':''}" onclick="AppState.rechargeMethod='alipay';renderRecharge();">
        <span class="icon" style="color:#1677ff;">💙</span>
        <span class="name">支付宝</span>
        <span class="check"><i class="fas ${AppState.rechargeMethod==='alipay'?'fa-check-circle':'fa-circle'}"></i></span>
      </div>
    </div>
    <div style="padding:0 16px;">
      <button class="btn btn-primary btn-lg" onclick="confirmRecharge()">
        确认充值 ¥${AppState.rechargeAmount}
      </button>
    </div>
  `;
}

function selectRechargeAmount(amount) {
  AppState.rechargeAmount = amount;
  renderRecharge();
}

function confirmRecharge() {
  showLoading();
  setTimeout(() => {
    hideLoading();
    MockData.user.balance += AppState.rechargeAmount;
    const bonus = { 50: 0, 100: 5, 200: 15, 300: 30, 500: 60, 1000: 150 }[AppState.rechargeAmount] || 0;
    if (bonus > 0) MockData.user.balance += bonus;
    showToast(`充值成功！到账¥${AppState.rechargeAmount + bonus}`);
    setTimeout(() => navigateTo('profile'), 1000);
  }, 1500);
}

// ============ 优惠券页 ============
function renderCoupon() {
  const container = $('#page-coupon');
  const unused = MockData.coupons.filter(c => !c.used);
  const used = MockData.coupons.filter(c => c.used);

  container.innerHTML = `
    <div class="header">
      <div class="header-back" onclick="navigateTo('profile')"><i class="fas fa-arrow-left"></i></div>
      <div class="header-title">我的优惠券</div>
      <div style="width:34px;"></div>
    </div>
    <div class="section-header"><div class="section-title">可使用 (${unused.length})</div></div>
    ${unused.length === 0 ? '<div class="empty-state" style="padding:30px;"><i class="fas fa-ticket-alt"></i><p>暂无可用的优惠券</p></div>' : ''}
    ${unused.map(c => `
      <div class="coupon-card" onclick="AppState.selectedCoupon=${JSON.stringify(c).replace(/"/g,'&quot;')};showToast('已选择：${c.name}')">
        <div class="coupon-left">
          <div class="amount">${c.type === 'rate' ? (c.discount*10).toFixed(1)+'折' : '¥'+c.amount}</div>
          <div class="unit">${c.type === 'rate' ? '折扣券' : '满减券'}</div>
        </div>
        <div class="coupon-right">
          <div class="name">${c.name}</div>
          <div class="condition">${c.minAmount > 0 ? '满¥'+c.minAmount+'可用' : '无门槛'}</div>
          <div class="expire">有效期至 ${c.expireDate}</div>
        </div>
      </div>
    `).join('')}
    ${used.length > 0 ? `
      <div class="section-header" style="margin-top:8px;"><div class="section-title">已使用/已过期 (${used.length})</div></div>
      ${used.map(c => `
        <div class="coupon-card coupon-used">
          <div class="coupon-left" style="background:linear-gradient(135deg,#9ca3af,#d1d5db);">
            <div class="amount">¥${c.amount}</div>
            <div class="unit">已使用</div>
          </div>
          <div class="coupon-right">
            <div class="name">${c.name}</div>
            <div class="condition">已使用</div>
          </div>
        </div>
      `).join('')}
    ` : ''}
  `;
}

// ============ 发票页 ============
function renderInvoice() {
  const container = $('#page-invoice');
  container.innerHTML = `
    <div class="header">
      <div class="header-back" onclick="navigateTo('profile')"><i class="fas fa-arrow-left"></i></div>
      <div class="header-title">发票管理</div>
      <div style="width:34px;"></div>
    </div>
    ${MockData.invoices.length === 0 ? '<div class="empty-state"><i class="fas fa-file-invoice"></i><p>暂无发票记录</p></div>' : ''}
    ${MockData.invoices.map(inv => `
      <div class="invoice-card">
        <div class="title">${inv.type} · ${inv.company}</div>
        <div class="row"><span>发票编号</span><span>${inv.id}</span></div>
        <div class="row"><span>关联订单</span><span>${inv.orderId}</span></div>
        <div class="row"><span>开票日期</span><span>${inv.date}</span></div>
        <div class="amount">¥${inv.amount.toFixed(2)}</div>
      </div>
    `).join('')}
    <div style="padding:0 16px;">
      <button class="btn btn-outline btn-lg" onclick="showToast('开票功能开发中')">
        <i class="fas fa-plus"></i> 申请开票
      </button>
    </div>
  `;
}

// ============ 车辆管理页 ============
function renderVehicle() {
  const container = $('#page-vehicle');
  const vehicles = MockData.user.vehicles;

  container.innerHTML = `
    <div class="header">
      <div class="header-back" onclick="navigateTo('profile')"><i class="fas fa-arrow-left"></i></div>
      <div class="header-title">我的车辆</div>
      <div style="width:34px;"></div>
    </div>
    ${vehicles.map(v => `
      <div class="vehicle-card">
        <div class="vehicle-icon" style="background:${v.color}20;color:${v.color};">
          <i class="fas fa-car-side"></i>
        </div>
        <div class="vehicle-info">
          <div class="name">${v.brand}</div>
          <div class="plate">${v.plate}</div>
          <div class="battery">
            🔋 电池 ${v.batteryCapacity}kWh · 当前电量 ${v.currentCharge}%
            <div style="background:#e5e7eb;border-radius:10px;height:6px;margin-top:4px;overflow:hidden;">
              <div style="width:${v.currentCharge}%;height:100%;background:${v.currentCharge > 50 ? 'var(--primary)' : v.currentCharge > 20 ? 'var(--warning)' : 'var(--danger)'};border-radius:10px;transition:width 0.5s;"></div>
            </div>
          </div>
        </div>
        <div class="vehicle-edit" onclick="showToast('编辑车辆')"><i class="fas fa-ellipsis-v"></i></div>
      </div>
    `).join('')}
    <div class="add-vehicle" onclick="showToast('添加车辆功能开发中')">
      <i class="fas fa-plus-circle" style="font-size:32px;display:block;margin-bottom:8px;"></i>
      添加新车辆
    </div>
  `;
}

// ============ 初始化 ============
function initApp() {
  // 绑定底部导航
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page) navigateTo(page);
    });
  });

  // 启动启动页
  initSplash();

  // 初始渲染首页
  renderHome();
}

document.addEventListener('DOMContentLoaded', initApp);
