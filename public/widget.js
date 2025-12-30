/**
 * SOFA Chat Widget Loader
 * 외부 웹사이트에 챗봇을 임베드하기 위한 로더 스크립트
 *
 * 사용법:
 * <script src="https://yoursite.com/widget.js" data-api-key="wgt_xxx" async></script>
 *
 * 기능:
 * - 플로팅 채팅 버튼
 * - iframe 기반 채팅창
 * - 테마/위치 커스터마이징
 * - 자동 환영 메시지
 * - 방문자 컨텍스트 전달
 */
(function (w, d) {
  'use strict';

  // ============================================
  // 상수 정의
  // ============================================
  var WIDGET_ID = 'sofa-chat-widget';
  var BUTTON_ID = 'sofa-chat-button';
  var STYLE_ID = 'sofa-chat-styles';
  var NOTIFICATION_ID = 'sofa-chat-notification';

  // ============================================
  // 스크립트 태그에서 설정 추출
  // ============================================
  var scripts = d.getElementsByTagName('script');
  var currentScript = null;

  // 현재 스크립트 태그 찾기
  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].src && scripts[i].src.indexOf('widget.js') !== -1) {
      currentScript = scripts[i];
      break;
    }
  }

  if (!currentScript) {
    console.error('[SOFA Widget] Script tag not found');
    return;
  }

  var apiKey = currentScript.getAttribute('data-api-key');
  var baseUrl = currentScript.src.replace(/\/widget\.js.*/, '');

  if (!apiKey) {
    console.error('[SOFA Widget] Missing data-api-key attribute');
    return;
  }

  // ============================================
  // 중복 초기화 방지
  // ============================================
  if (d.getElementById(WIDGET_ID)) {
    console.warn('[SOFA Widget] Widget already initialized');
    return;
  }

  // ============================================
  // 설정 조회 및 초기화
  // ============================================
  fetch(baseUrl + '/api/widget/public-config?key=' + encodeURIComponent(apiKey))
    .then(function (response) {
      if (!response.ok) {
        return response.json().then(function (err) {
          throw new Error(err.error || 'Widget configuration failed');
        });
      }
      return response.json();
    })
    .then(function (data) {
      initWidget(data);
    })
    .catch(function (error) {
      console.error('[SOFA Widget]', error.message);
    });

  // ============================================
  // 위젯 초기화
  // ============================================
  function initWidget(data) {
    var config = data.config || {};
    var tenantId = data.tenantId;
    var position = config.position || 'bottom-right';
    var theme = config.theme || {};
    var primaryColor = theme.primaryColor || '#3B82F6';
    var buttonSize = theme.buttonSize || 56;

    // 스타일 주입
    injectStyles(position, primaryColor, buttonSize);

    // 버튼 생성
    var button = createButton(primaryColor);
    d.body.appendChild(button);

    // 위젯 컨테이너 생성
    var container = createContainer();
    d.body.appendChild(container);

    // iframe 생성
    var iframe = createIframe(baseUrl, tenantId, apiKey);
    container.appendChild(iframe);

    // 상태 관리
    var state = {
      isOpen: false,
      hasInteracted: false,
    };

    // 버튼 클릭 이벤트
    button.addEventListener('click', function () {
      state.hasInteracted = true;
      toggleWidget(state, container, button);
      hideNotification();
    });

    // ESC 키로 닫기
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.isOpen) {
        toggleWidget(state, container, button);
      }
    });

    // 자동 환영 메시지
    if (config.autoOpen && !state.hasInteracted) {
      var delay = config.autoOpenDelay || 5000;
      setTimeout(function () {
        if (!state.hasInteracted) {
          showNotification(config.welcomeMessage || '안녕하세요! 무엇을 도와드릴까요?');
        }
      }, delay);
    }

    // 방문자 컨텍스트를 iframe에 전달
    iframe.addEventListener('load', function () {
      try {
        iframe.contentWindow.postMessage(
          {
            type: 'SOFA_VISITOR_CONTEXT',
            data: {
              pageUrl: w.location.href,
              pageTitle: d.title,
              referrer: d.referrer,
              timestamp: new Date().toISOString(),
            },
          },
          '*'
        );
      } catch (e) {
        // 크로스 오리진 에러 무시
      }
    });
  }

  // ============================================
  // 스타일 주입
  // ============================================
  function injectStyles(position, primaryColor, buttonSize) {
    if (d.getElementById(STYLE_ID)) return;

    var positionStyles = {
      'bottom-right': { button: 'bottom: 20px; right: 20px;', container: 'bottom: 90px; right: 20px;' },
      'bottom-left': { button: 'bottom: 20px; left: 20px;', container: 'bottom: 90px; left: 20px;' },
      'top-right': { button: 'top: 20px; right: 20px;', container: 'top: 90px; right: 20px;' },
      'top-left': { button: 'top: 20px; left: 20px;', container: 'top: 90px; left: 20px;' },
    };

    var pos = positionStyles[position] || positionStyles['bottom-right'];

    var css =
      '\n      #' +
      BUTTON_ID +
      ' {\n        position: fixed;\n        ' +
      pos.button +
      '\n        width: ' +
      buttonSize +
      'px;\n        height: ' +
      buttonSize +
      'px;\n        border-radius: 50%;\n        background: ' +
      primaryColor +
      ';\n        color: white;\n        cursor: pointer;\n        box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        z-index: 2147483646;\n        transition: transform 0.2s ease, box-shadow 0.2s ease;\n        border: none;\n        outline: none;\n        padding: 0;\n      }\n      #' +
      BUTTON_ID +
      ':hover {\n        transform: scale(1.05);\n        box-shadow: 0 6px 20px rgba(0,0,0,0.2);\n      }\n      #' +
      BUTTON_ID +
      ':active {\n        transform: scale(0.95);\n      }\n      #' +
      BUTTON_ID +
      ' svg {\n        width: 24px;\n        height: 24px;\n        fill: none;\n        stroke: currentColor;\n        stroke-width: 2;\n        stroke-linecap: round;\n        stroke-linejoin: round;\n      }\n      #' +
      WIDGET_ID +
      ' {\n        position: fixed;\n        ' +
      pos.container +
      '\n        width: 400px;\n        height: 600px;\n        max-width: calc(100vw - 40px);\n        max-height: calc(100vh - 120px);\n        border-radius: 16px;\n        overflow: hidden;\n        box-shadow: 0 8px 32px rgba(0,0,0,0.2);\n        z-index: 2147483645;\n        transition: opacity 0.3s ease, transform 0.3s ease;\n        background: white;\n      }\n      #' +
      WIDGET_ID +
      '.sofa-hidden {\n        opacity: 0;\n        transform: translateY(20px) scale(0.95);\n        pointer-events: none;\n        visibility: hidden;\n      }\n      #' +
      WIDGET_ID +
      '.sofa-visible {\n        opacity: 1;\n        transform: translateY(0) scale(1);\n        visibility: visible;\n      }\n      #' +
      WIDGET_ID +
      ' iframe {\n        width: 100%;\n        height: 100%;\n        border: none;\n      }\n      #' +
      NOTIFICATION_ID +
      ' {\n        position: fixed;\n        ' +
      pos.button +
      '\n        transform: translateY(-70px);\n        background: white;\n        color: #1f2937;\n        padding: 12px 16px;\n        border-radius: 12px;\n        box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n        max-width: 280px;\n        font-size: 14px;\n        line-height: 1.4;\n        z-index: 2147483646;\n        opacity: 0;\n        transition: opacity 0.3s ease;\n        font-family: system-ui, -apple-system, sans-serif;\n      }\n      #' +
      NOTIFICATION_ID +
      '.sofa-visible {\n        opacity: 1;\n      }\n      #' +
      NOTIFICATION_ID +
      '::after {\n        content: "";\n        position: absolute;\n        bottom: -6px;\n        right: 20px;\n        width: 12px;\n        height: 12px;\n        background: white;\n        transform: rotate(45deg);\n        box-shadow: 2px 2px 4px rgba(0,0,0,0.1);\n      }\n      @media (max-width: 480px) {\n        #' +
      WIDGET_ID +
      ' {\n          width: calc(100vw - 20px);\n          height: calc(100vh - 100px);\n          left: 10px !important;\n          right: 10px !important;\n          bottom: 80px !important;\n          top: auto !important;\n          border-radius: 16px;\n        }\n        #' +
      NOTIFICATION_ID +
      ' {\n          max-width: calc(100vw - 100px);\n          right: 70px !important;\n          left: auto !important;\n        }\n      }\n    ';

    var style = d.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    d.head.appendChild(style);
  }

  // ============================================
  // 버튼 생성
  // ============================================
  function createButton() {
    var button = d.createElement('button');
    button.id = BUTTON_ID;
    button.setAttribute('aria-label', 'Open chat');
    button.setAttribute('type', 'button');
    button.innerHTML = getChatIcon();
    return button;
  }

  // ============================================
  // 컨테이너 생성
  // ============================================
  function createContainer() {
    var container = d.createElement('div');
    container.id = WIDGET_ID;
    container.className = 'sofa-hidden';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-label', 'Chat widget');
    return container;
  }

  // ============================================
  // iframe 생성
  // ============================================
  function createIframe(baseUrl, tenantId, apiKey) {
    var iframe = d.createElement('iframe');
    iframe.src = baseUrl + '/widget/' + tenantId + '?key=' + encodeURIComponent(apiKey);
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'Chat widget');
    return iframe;
  }

  // ============================================
  // 위젯 토글
  // ============================================
  function toggleWidget(state, container, button) {
    state.isOpen = !state.isOpen;

    if (state.isOpen) {
      container.className = 'sofa-visible';
      button.innerHTML = getCloseIcon();
      button.setAttribute('aria-label', 'Close chat');
      button.setAttribute('aria-expanded', 'true');
    } else {
      container.className = 'sofa-hidden';
      button.innerHTML = getChatIcon();
      button.setAttribute('aria-label', 'Open chat');
      button.setAttribute('aria-expanded', 'false');
    }
  }

  // ============================================
  // 알림 표시
  // ============================================
  function showNotification(message) {
    var existing = d.getElementById(NOTIFICATION_ID);
    if (existing) existing.remove();

    var notification = d.createElement('div');
    notification.id = NOTIFICATION_ID;
    notification.textContent = message;
    d.body.appendChild(notification);

    // 애니메이션을 위해 약간의 지연
    setTimeout(function () {
      notification.className = 'sofa-visible';
    }, 100);

    // 10초 후 자동 숨김
    setTimeout(function () {
      hideNotification();
    }, 10000);
  }

  // ============================================
  // 알림 숨기기
  // ============================================
  function hideNotification() {
    var notification = d.getElementById(NOTIFICATION_ID);
    if (notification) {
      notification.className = '';
      setTimeout(function () {
        notification.remove();
      }, 300);
    }
  }

  // ============================================
  // 아이콘 SVG
  // ============================================
  function getChatIcon() {
    return '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>';
  }

  function getCloseIcon() {
    return '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  }
})(window, document);
