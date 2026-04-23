const $ = (id) => document.getElementById(id);

const els = {
  backendUrl: $('backendUrl'),
  adAccountId: $('adAccountId'),
  objective: $('objective'),
  postId: $('postId'),
  batchInput: $('batchInput'),
  runFullFlowBtn: $('runFullFlowBtn'),
  openAdsManagerBtn: $('openAdsManagerBtn'),
  status: $('status'),
  authStatus: $('authStatus'),
  loginFacebookBtn: $('loginFacebookBtn')
};

function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
  
  function setStatusHtml(html) {
    els.status.innerHTML = html;
  }
  
  function setStatus(message) {
    setStatusHtml(`<div class="log-line">${escapeHtml(message)}</div>`);
  }
  
  function appendStatus(message, type = 'normal') {
    const cls = `log-line log-${type}`;
    const icon =
      type === 'success' ? '✅' :
      type === 'error' ? '❌' :
      type === 'running' ? '⏳' :
      type === 'section' ? '📌' :
      '•';
  
    els.status.innerHTML += `<div class="${cls}">${icon} ${escapeHtml(message)}</div>`;
  }
  
  function appendStatusLink(label, url) {
    const safeLabel = escapeHtml(label);
    const safeUrl = escapeHtml(url);
  
    els.status.innerHTML += `
      <div class="log-line log-link">
        🔗 ${safeLabel}: <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Mở Ads Manager</a>
      </div>
    `;
  }
  function appendNameLink(name, url) {
    const safeName = escapeHtml(name);
    const safeUrl = escapeHtml(url);
  
    els.status.innerHTML += `
      <div class="log-line log-success">
        ✅ ${safeName} - <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Mở link</a>
      </div>
    `;
  }
  
  function appendDivider() {
    els.status.innerHTML += `<div class="log-divider"></div>`;
  }

function parseBatchInput(raw) {
  const lines = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  const items = [];
  const errors = [];

  for (const [index, line] of lines.entries()) {
    const parts = line.split('|').map((s) => s.trim());

    if (parts.length !== 3) {
      errors.push(`Dòng ${index + 1} sai format: ${line}`);
      continue;
    }

    const [pageId, pageName, budgetRaw] = parts;
    const budget = Number(budgetRaw);

    if (!pageId) {
      errors.push(`Dòng ${index + 1} thiếu pageId`);
      continue;
    }

    if (!pageName) {
      errors.push(`Dòng ${index + 1} thiếu pageName`);
      continue;
    }

    if (!Number.isFinite(budget) || budget <= 0) {
      errors.push(`Dòng ${index + 1} budget không hợp lệ: ${budgetRaw}`);
      continue;
    }

    items.push({ pageId, pageName, budget });
  }

  return { items, errors };
}

function buildPayloadFromFirstItem(item) {
  return {
    adAccountId: els.adAccountId.value.trim(),
    campaignName: `AUTO ${item.pageName} - ${item.pageId}`,
    adSetName: `Nhóm QC - ${item.pageName} - ${item.pageId}`,
    adName: `Ad - ${item.pageName} - ${item.pageId}`,
    objective: els.objective.value || 'OUTCOME_ENGAGEMENT',
    dailyBudget: item.budget,
    pageId: item.pageId,
    pageName: item.pageName,
    optimizationGoal: 'CONVERSATIONS',
    postId: els.postId.value.trim() || ''
  };
}

async function checkFacebookAuth() {
  const backendUrl = els.backendUrl.value.trim() || 'http://localhost:3000';

  try {
    const res = await fetch(`${backendUrl}/auth/status`);
    const data = await res.json();

    if (data?.hasToken) {
      els.authStatus.textContent = 'Đã kết nối Facebook';
      els.authStatus.className = 'auth-status ok';
      els.loginFacebookBtn.textContent = 'Kết nối lại Facebook';
    } else {
      els.authStatus.textContent = 'Chưa kết nối Facebook';
      els.authStatus.className = 'auth-status warn';
      els.loginFacebookBtn.textContent = 'Đăng nhập Facebook';
    }
  } catch (err) {
    els.authStatus.textContent = 'Không kết nối được backend';
    els.authStatus.className = 'auth-status warn';
  }
}

let running = false;

async function runFullFlow() {
    if (running) return;
    running = true;
  
    setStatusHtml('');
  
    try {
      const { items, errors } = parseBatchInput(els.batchInput.value || '');
  
      if (errors.length) {
        throw new Error(`Lỗi input:\n${errors.join('\n')}`);
      }
  
      if (!items.length) {
        throw new Error('Không có record hợp lệ.');
      }
  
      const backendUrl = els.backendUrl.value.trim() || 'http://localhost:3000';
  
      appendStatus(`Bắt đầu chạy ${items.length} dòng`, 'section');
  
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const payload = buildPayloadFromFirstItem(item);
  
        appendDivider();
        appendStatus(`Dòng ${i + 1}/${items.length}: ${item.pageName} (${item.pageId})`, 'running');
  
        try {
          const res = await fetch(`${backendUrl}/flow/run-full-draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
  
          const data = await res.json();
  
          if (!res.ok || !data?.ok) {
            appendStatus(`${item.pageName} - ${data?.error || 'Lỗi backend'}`, 'error');
            continue;
          }
  
          if (data.adsManagerUrl) {
            appendNameLink(item.pageName, data.adsManagerUrl);
          } else {
            appendStatus(`${item.pageName} - Thành công`, 'success');
          }
        } catch (err) {
          appendStatus(`${item.pageName} - ${err.message}`, 'error');
        }
      }
  
      appendDivider();
      appendStatus('Đã chạy xong tất cả các dòng.', 'section');
    } catch (err) {
      setStatusHtml('');
      appendStatus(err.message, 'error');
      console.error(err);
    } finally {
      running = false;
    }
  }

function openAdsManager() {
  const backendUrl = els.backendUrl.value.trim() || 'http://localhost:3000';
  window.open(backendUrl.replace(/\/$/, '') + '/auth/status', '_blank');
}

els.loginFacebookBtn.addEventListener('click', () => {
  const backendUrl = els.backendUrl.value.trim() || 'http://localhost:3000';
  window.open(`${backendUrl}/auth/facebook/start`, '_blank');
});

els.runFullFlowBtn.addEventListener('click', runFullFlow);
els.openAdsManagerBtn.addEventListener('click', openAdsManager);
els.backendUrl.addEventListener('change', checkFacebookAuth);

checkFacebookAuth();