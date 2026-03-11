import './style.css'

// 画面要素
const loginScreen = document.querySelector<HTMLElement>('#login-screen');
const dashboardScreen = document.querySelector<HTMLElement>('#dashboard-screen');

// ログインボタン
const btnLoginAdmin = document.querySelector<HTMLButtonElement>('#btn-login-admin');
const btnLoginStaff = document.querySelector<HTMLButtonElement>('#btn-login-staff');
const btnLogout = document.querySelector<HTMLButtonElement>('#btn-logout');

// ダッシュボード要素
const menuItems = document.querySelectorAll<HTMLButtonElement>('.menu-item, .sub-item');
const appFrame = document.querySelector<HTMLIFrameElement>('#app-frame');
const loadingOverlay = document.querySelector<HTMLDivElement>('#loading');
const roleBadge = document.querySelector<HTMLElement>('#role-badge');

// 指示書3: 冪等性の担保ロジック
function generateIdempotencyKey(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 指示書3: エラー時のフォールバックUI
function showErrorFallback(message: string) {
  if (appFrame) {
    appFrame.srcdoc = `
      <div style="font-family: sans-serif; padding: 40px; text-align: center; color: #64748b;">
        <h2 style="color: #d93025;">⚠️ 接続が不安定です</h2>
        <p>${message}</p>
        <button onclick="window.parent.location.reload()" style="padding: 10px 20px; border-radius: 8px; border: none; background: #2da44e; color: white; cursor: pointer;">
          再試行する
        </button>
      </div>
    `;
  }
}

// 指示書1: 安全な通信イベントの設計
const messageOrigin = window.location.origin;

function initMessageBridge() {
  window.addEventListener('message', (event) => {
    if (event.origin !== messageOrigin) return;
    console.log('子画面からのメッセージを受診:', event.data);
    
    // アプリからの準備完了通知などでローディングを消すなどの拡張が可能
    if (event.data.type === 'APP_READY') {
      loadingOverlay?.classList.remove('visible');
    }
  });
}

initMessageBridge();

let currentUserRole: 'admin' | 'staff' | null = null;

function switchScreen(screen: 'login' | 'dashboard') {
  if (screen === 'login') {
    loginScreen?.classList.add('active');
    dashboardScreen?.classList.remove('active');
  } else {
    loginScreen?.classList.remove('active');
    dashboardScreen?.classList.add('active');
  }
}

function updateMenuVisibility(role: 'admin' | 'staff') {
  // メニューグループ（サブメニューを持つ親）の制御
  document.querySelectorAll('.menu-group').forEach(group => {
    const groupRole = group.getAttribute('data-role');
    if (role === 'admin' || groupRole !== 'admin') {
      group.classList.remove('hidden');
    } else {
      group.classList.add('hidden');
    }
  });

  menuItems.forEach(item => {
    const itemRole = item.getAttribute('data-role');
    if (role === 'admin' || !itemRole) {
      item.classList.remove('hidden');
    } else {
      if (itemRole === 'staff') {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    }
  });

  // ロールに応じたバッジの更新
  if (roleBadge) {
    roleBadge.textContent = role === 'admin' ? '管理者' : '現場職員';
    roleBadge.className = `current-role-badge ${role === 'admin' ? 'role-admin' : 'role-staff'}`;
  }

  // 表示されていないアプリが選択されていた場合、最初の表示アイテムに切り替える
  const activeItem = document.querySelector<HTMLButtonElement>('.menu-item.active');
  if (!activeItem || activeItem.classList.contains('hidden')) {
    const firstVisible = Array.from(menuItems).find(i => !i.classList.contains('hidden'));
    if (firstVisible) firstVisible.click();
  }
}

// ログイン処理
btnLoginAdmin?.addEventListener('click', () => {
  currentUserRole = 'admin';
  switchScreen('dashboard');
  updateMenuVisibility('admin');
});

btnLoginStaff?.addEventListener('click', () => {
  currentUserRole = 'staff';
  switchScreen('dashboard');
  updateMenuVisibility('staff');
});

btnLogout?.addEventListener('click', () => {
  switchScreen('login');
});

// メニュークリック
if (menuItems && appFrame && loadingOverlay) {
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const appId = item.getAttribute('data-app');
      if (appId && appId.trim() !== '') {
        loadingOverlay.classList.add('visible');
        
        // 指示書1: セキュリティとパフォーマンス
        appFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        appFrame.setAttribute('loading', 'lazy');
        
        // パス解決ロジックの改善
        let finalSrc = '';
        if (appId.startsWith('http')) {
          finalSrc = appId;
        } else if (appId.startsWith('/') || appId.includes('.html')) {
          // すでにパス形式（/apps/app1.html 等）の場合はそのまま使用
          finalSrc = appId;
        } else {
          // 短縮ID（app1 等）の場合は /apps/ フォルダ内を参照
          finalSrc = `/apps/${appId}.html`;
        }

        // マトリョーシカ防止: 自分自身を読み込まないようにチェック
        if (finalSrc === window.location.pathname || finalSrc === window.location.href) {
          console.warn('マトリョーシカ防止: ポータル自体をiframeに読み込むことはできません。');
          loadingOverlay.classList.remove('visible');
          return;
        }

        appFrame.src = finalSrc;
      }
    });
  });

  appFrame.addEventListener('load', () => {
    // 指示書1 & 4: 認可情報およびユーザーの安全な配布
    // 外部アプリ側で受信できるようターゲットオリジンを適切に設定
    const targetOrigin = appFrame.src.startsWith('http') 
      ? new URL(appFrame.src).origin 
      : messageOrigin;

    appFrame.contentWindow?.postMessage({
      type: 'PORTAL_AUTH_DATA',
      payload: { 
        userId: 'user_777', // シミュレーション用のID
        role: currentUserRole, 
        token: 'dummy-jwt-token',
        idempotencyKey: generateIdempotencyKey()
      }
    }, targetOrigin);
    
    loadingOverlay.classList.remove('visible');
  });
}

// 指示書: アプリリンクの動的設定
const STORAGE_KEY = 'octopus_app_links';

function applyDynamicLinks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  const links = JSON.parse(saved);
  menuItems.forEach(item => {
    const originalAppId = item.getAttribute('data-app');
    if (originalAppId && links[originalAppId]) {
      item.setAttribute('data-app', links[originalAppId]);
    }
  });
}

// 初期化
applyDynamicLinks();

window.addEventListener('message', (event) => {
  if (event.origin !== messageOrigin) return;
  if (event.data.type === 'SETTINGS_UPDATED') {
    applyDynamicLinks();
  }
});

// 指示書3: ネットワークエラー等の検知
window.addEventListener('offline', () => {
  showErrorFallback('ネットワーク接続が切断されました。インターネット接続を確認してください。');
});
