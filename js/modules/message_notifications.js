// Both in-app banners and system notifications use the same chat target.
let notificationDataReady = false;
let pendingNotificationTarget = null;

function openNotificationChat(target) {
    if (!target || !['private', 'group'].includes(target.chatType) || typeof target.chatId !== 'string') return false;
    if (!notificationDataReady) { pendingNotificationTarget = target; return false; }
    const list = target.chatType === 'group' ? db.groups : db.characters;
    if (!(list || []).some(chat => chat.id === target.chatId)) {
        showToast('这条通知对应的聊天已不存在');
        return false;
    }
    openChatRoom(target.chatId, target.chatType);
    return true;
}

function getMessageAlertMode() {
    return (db.magicRoom && db.magicRoom.messageAlertMode) || 'system';
}

function playMessageAlert(source) {
    const mode = getMessageAlertMode();
    if (mode === 'sound' && source) playSound(source);
    else if (mode === 'system' && !document.hidden && typeof navigator.vibrate === 'function') {
        navigator.vibrate([35, 40, 35]);
    }
}

function getSystemNotificationSupportText() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent || '')
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = !!navigator.standalone || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches);
    if (ios && !standalone) return 'iPhone 请先在 Safari 分享菜单中“添加到主屏幕”，从桌面打开后申请通知权限（需 iOS 16.4+）。';
    if (!('Notification' in window) || !navigator.serviceWorker) return '当前环境不支持系统通知；应用内弹窗仍可使用。';
    const states = {granted:'已授权系统通知',denied:'通知被拒绝，请在 iOS/浏览器设置中开启',default:'尚未申请通知权限'};
    return (states[Notification.permission] || '') + '。当前应用会使用保活音频提高后台继续运行的机会；如果 iOS 完全挂起网页，网络请求仍可能被暂停。';
}

function setupMessageNotifications() {
    notificationDataReady = true;
    const params = new URL(location.href).searchParams;
    if (params.has('uwuChat')) {
        pendingNotificationTarget = {chatId: params.get('uwuChat'), chatType: params.get('uwuChatType') || 'private'};
        const url = new URL(location.href);
        url.searchParams.delete('uwuChat'); url.searchParams.delete('uwuChatType');
        history.replaceState(null, '', url.href);
    }
    if (pendingNotificationTarget) {
        const target = pendingNotificationTarget; pendingNotificationTarget = null;
        openNotificationChat(target);
    }
}

if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'OPEN_UWU_CHAT') openNotificationChat(event.data.target);
});

// Only retries local IndexedDB writes. Never restarts a model call on resume.
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof retryPendingChatPersistence === 'function') {
        retryPendingChatPersistence().catch(error => {
            console.error('[uwu] foreground storage retry failed', error);
            showToast(error.message);
        });
        if (typeof renderMessages === 'function' && document.getElementById('chat-room-screen')?.classList.contains('active')) {
            renderMessages(false, false);
        }
    }
});
