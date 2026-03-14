import './style.css'

// 画面要素
const loginScreen = document.querySelector<HTMLElement>('#login-screen');
const dashboardScreen = document.querySelector<HTMLElement>('#dashboard-screen');

// ログインボタン
const btnLoginAdmin = document.querySelector<HTMLButtonElement>('#btn-login-admin');
const btnLoginStaffA = document.querySelector<HTMLButtonElement>('#btn-login-staff-a');
const btnLoginStaffB = document.querySelector<HTMLButtonElement>('#btn-login-staff-b');
const btnLoginStaffC = document.querySelector<HTMLButtonElement>('#btn-login-staff-c');
const btnLogout = document.querySelector<HTMLButtonElement>('#btn-logout');

// ダッシュボード要素
const menuItems = document.querySelectorAll<HTMLButtonElement>('.menu-item, .sub-item');
const framesWrapper = document.querySelector<HTMLDivElement>('#frames-wrapper');
const loadingOverlay = document.querySelector<HTMLDivElement>('#loading');
const roleBadge = document.querySelector<HTMLElement>('#role-badge');

// 指示書3: 冪等性の担保ロジック
function generateIdempotencyKey(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 指示書3: エラー時のフォールバックUI
function showErrorFallback(message: string, targetFrame: HTMLIFrameElement) {
  targetFrame.srcdoc = `
    <div style="font-family: sans-serif; padding: 40px; text-align: center; color: #64748b;">
      <h2 style="color: #d93025;">⚠️ 接続が不安定です</h2>
      <p>${message}</p>
      <button onclick="window.parent.location.reload()" style="padding: 10px 20px; border-radius: 8px; border: none; background: #2da44e; color: white; cursor: pointer;">
        再試行する
      </button>
    </div>
  `;
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
export let currentStaffId: string | null = null;

function switchScreen(screen: 'login' | 'dashboard') {
  if (screen === 'login') {
    loginScreen?.classList.add('active');
    dashboardScreen?.classList.remove('active');
  } else {
    loginScreen?.classList.remove('active');
    dashboardScreen?.classList.add('active');
  }
}

let updateMenuVisibility = function (role: 'admin' | 'staff') {
  // 職員用の権限設定を読み込む（職員IDごとに分ける）
  const suffix = currentStaffId ? currentStaffId : 'default';
  const STAFF_PERMS_KEY = `octopus_staff_permissions_${suffix}`;
  const staffPerms = JSON.parse(localStorage.getItem(STAFF_PERMS_KEY) || '{}');

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
    const appId = item.getAttribute('data-app');
    
    // 管理者はすべて表示、もしくは admin 制限のないものを表示
    if (role === 'admin') {
      item.classList.remove('hidden');
    } else {
      // 職員(staff)の場合
      if (itemRole === 'staff') {
        // 設定データで明示的に false (OFF) にされていなければ表示
        if (appId && staffPerms[appId] === false) {
          item.classList.add('hidden');
        } else {
          item.classList.remove('hidden');
        }
      } else if (!itemRole) {
        // 役割指定がないアイテムも表示対象とするが、同じく権限チェックを入れるか？
        // ここでは通常表示とする。特定アプリに限定したい場合は data-role="staff" 推奨。
        if (appId && staffPerms[appId] === false) {
          item.classList.add('hidden');
        } else {
          item.classList.remove('hidden');
        }
      } else {
        item.classList.add('hidden');
      }
    }
  });

  // メニュー区切り線 (menu-divider) の表示制御
  document.querySelectorAll('.menu-divider').forEach(divider => {
    const dividerRole = divider.getAttribute('data-role');
    if (role === 'admin' || dividerRole !== 'admin') {
      divider.classList.remove('hidden');
    } else {
      divider.classList.add('hidden');
    }
  });

  // ロールに応じたバッジの更新
  if (roleBadge) {
    roleBadge.textContent = role === 'admin' ? '管理者' : '現場職員';
    roleBadge.className = `current-role-badge ${role === 'admin' ? 'role-admin' : 'role-staff'}`;
  }

  // 表示するアプリを決定して初期化クリックする
  const activeItem = document.querySelector<HTMLButtonElement>('.menu-item.active');
  if (activeItem && !activeItem.classList.contains('hidden')) {
    activeItem.click();
  } else {
    const firstVisible = Array.from(menuItems).find(i => !i.classList.contains('hidden'));
    if (firstVisible) {
      firstVisible.click();
    } else {
      // 表示できるものが一つもない場合、フレームをクリア
      frameCache.forEach(frame => frame.classList.remove('active'));
      if (framesWrapper) framesWrapper.innerHTML = '';
      frameCache.clear();
    }
  }
}



btnLoginAdmin?.addEventListener('click', () => {
  currentUserRole = 'admin';
  currentStaffId = null;
  switchScreen('dashboard');
  updateMenuVisibility('admin');
});

function handleStaffLogin(staffId: string, badgeName: string) {
  currentUserRole = 'staff';
  currentStaffId = staffId;
  switchScreen('dashboard');
  updateMenuVisibility('staff');
  if (roleBadge) {
    roleBadge.textContent = badgeName;
  }
}

btnLoginStaffA?.addEventListener('click', () => handleStaffLogin('staff_a', '職員A'));
btnLoginStaffB?.addEventListener('click', () => handleStaffLogin('staff_b', '職員B'));
btnLoginStaffC?.addEventListener('click', () => handleStaffLogin('staff_c', '職員C'));

btnLogout?.addEventListener('click', () => {
  switchScreen('login');
});

// ===== アプリのキャッシュ＆プリロード管理 =====
const frameCache = new Map<string, HTMLIFrameElement>();
let preloadQueue: string[] = [];
let isPreloading = false;

// 指定したアプリIDのURLを解決する関数
function resolveAppUrl(appId: string): string {
  if (!appId || appId.trim() === '') return '';
  if (appId.startsWith('http')) return appId;
  if (appId.startsWith('/') || appId.includes('.html')) return appId;
  return `/apps/${appId}.html`;
}

// IFRAMEを生成・初期化する関数
function createFrame(appId: string): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.className = 'app-iframe';
  // サンドボックスの制限によりFirebase/Netlify各種アプリが正しく動かなくなるため解除
  frame.setAttribute('data-appid', appId);
  
  // ロード完了時の認証データ送信
  frame.addEventListener('load', () => {
    const targetOrigin = frame.src.startsWith('http') 
      ? new URL(frame.src).origin 
      : messageOrigin;

    frame.contentWindow?.postMessage({
      type: 'PORTAL_AUTH_DATA',
      payload: { 
        userId: 'user_777',
        role: currentUserRole, 
        token: 'dummy-jwt-token',
        idempotencyKey: generateIdempotencyKey()
      }
    }, targetOrigin);
    
    // 現在アクティブなフレームならローディングを消す
    if (frame.classList.contains('active') && loadingOverlay) {
      loadingOverlay.classList.remove('visible');
    }
  });

  if (framesWrapper) {
    framesWrapper.insertBefore(frame, loadingOverlay);
  }
  return frame;
}

// プリロード実行処理（1件ずつゆっくり通信を専有しないように）
async function processPreloadQueue() {
  if (isPreloading || preloadQueue.length === 0) return;
  isPreloading = true;

  const appId = preloadQueue.shift();
  if (appId && !frameCache.has(appId)) {
    const finalSrc = resolveAppUrl(appId);
    if (finalSrc && finalSrc !== window.location.pathname && finalSrc !== window.location.href) {
      console.log(`[Preload] ${appId} をバックグラウンドで読み込みます...`);
      const frame = createFrame(appId);
      frameCache.set(appId, frame);
      frame.src = finalSrc; // ロード開始
      
      // 次のプリロードまで少し待機（通信の圧迫を回避）
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  isPreloading = false;
  
  if (preloadQueue.length > 0) {
    // idleCallbackが使える場合は使い、なければsetTimeout
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => processPreloadQueue());
    } else {
      setTimeout(processPreloadQueue, 500);
    }
  }
}

// メニューからプリロードのキューを作成開始
function startBackgroundPreloads() {
  const visibleApps: string[] = [];
  menuItems.forEach(item => {
    if (!item.classList.contains('hidden')) {
      const appId = item.getAttribute('data-app');
      // 現在表示中のものは除外してキューに入れる
      if (appId && appId.trim() !== '' && !item.classList.contains('active')) {
        visibleApps.push(appId);
      }
    }
  });
  
  // リストの順番通りにプリロード
  preloadQueue = [...new Set(visibleApps)];
  
  // ログイン後、UIが落ち着いてから数秒後に開始
  setTimeout(() => {
    processPreloadQueue();
  }, 2000);
}

// ログイン成功時にプリロード開始フックを追加
let originalUpdateMenuVisibility = updateMenuVisibility;
updateMenuVisibility = function(role: 'admin' | 'staff') {
  originalUpdateMenuVisibility(role);
  startBackgroundPreloads();
}

// メニュークリック時のアプリ表示処理
if (menuItems && framesWrapper && loadingOverlay) {
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const appId = item.getAttribute('data-app');
      if (!appId || appId.trim() === '') return;

      const finalSrc = resolveAppUrl(appId);

      // マトリョーシカ防止
      if (finalSrc === window.location.pathname || finalSrc === window.location.href) {
        console.warn('マトリョーシカ防止: ポータル自体をiframeに読み込むことはできません。');
        return;
      }

      // 既存の全フレームを非表示にする
      frameCache.forEach(frame => frame.classList.remove('active'));

      if (frameCache.has(appId)) {
        // キャッシュありの場合は、そのフレームを表示するだけ（ロード一瞬）
        const cachedFrame = frameCache.get(appId)!;
        cachedFrame.classList.add('active');
        loadingOverlay.classList.remove('visible');
      } else {
        // キャッシュなしの場合は、構築してロード開始
        loadingOverlay.classList.add('visible');
        const frame = createFrame(appId);
        frameCache.set(appId, frame);
        frame.classList.add('active');
        frame.src = finalSrc;
      }
    });
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

// モバイル: タブバーをスクロールしきったら矢印インジケーターを消す
const mobileMenu = document.querySelector<HTMLElement>('.menu');
const sidebar = document.querySelector<HTMLElement>('.sidebar');
if (mobileMenu && sidebar) {
  mobileMenu.addEventListener('scroll', () => {
    const atEnd = mobileMenu.scrollLeft + mobileMenu.clientWidth >= mobileMenu.scrollWidth - 8;
    sidebar.classList.toggle('scrolled-end', atEnd);
  });
}


window.addEventListener('message', (event) => {
  if (event.origin !== messageOrigin) return;
  if (event.data.type === 'SETTINGS_UPDATED') {
    applyDynamicLinks();
  } else if (event.data.type === 'STAFF_PERMISSIONS_UPDATED') {
    // 管理画面で権限が保存されたら、メニューを即座に再描画する
    if (currentUserRole) {
      updateMenuVisibility(currentUserRole);
    }
  }
});

// 指示書3: ネットワークエラー等の検知
window.addEventListener('offline', () => {
  // 現在アクティブなフレームすべてにエラーを表示
  frameCache.forEach(frame => {
    if (frame.classList.contains('active')) {
      showErrorFallback('ネットワーク接続が切断されました。インターネット接続を確認してください。', frame);
    }
  });
});
