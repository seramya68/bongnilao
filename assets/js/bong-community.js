/* Nhà của Bông — Community v1: chỉ Bông phản hồi, tim review, tin tức trên web.
   Phụ thuộc: app.js và Supabase; tải file này SAU app.js. */
(() => {
  'use strict';
  const get = (id) => document.getElementById(id);
  const db = () => (typeof sb !== 'undefined' ? sb : null);
  const user = () => (typeof authSession !== 'undefined' ? authSession?.user : null);
  const admin = () => (typeof isAdminSession === 'function' && isAdminSession());
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = (message) => typeof showToast === 'function' ? showToast(message) : alert(message);
  const state = { news: [], seen: new Set(), loaded: false, showing: false, editing: null, busyLikes: new Set() };

  const dateText = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric'});
  };
  function validLink(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    try { const url = new URL(s); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  }
  function localKey() { return 'bong_news_seen_v1_' + (user()?.id || 'guest'); }
  function getLocalSeen(key) {
    try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v.filter(x=>typeof x==='string') : []; }
    catch { return []; }
  }
  function saveLocalSeen() {
    try { localStorage.setItem(localKey(), JSON.stringify([...state.seen])); }
    catch { /* private mode */ }
  }
  async function loadSeen() {
    state.seen = new Set([...getLocalSeen('bong_news_seen_v1_guest'), ...getLocalSeen(localKey())]);
    if (!db() || !user()) return;
    const { data, error } = await db().from('bong_announcement_reads')
      .select('announcement_id').eq('user_id', user().id);
    if (error) { console.warn('Bông: chưa tải được lịch sử đọc thông báo', error.message); return; }
    (data || []).forEach(row => state.seen.add(row.announcement_id));
    saveLocalSeen();
  }
  async function markSeen(ids) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) return;
    unique.forEach(id => state.seen.add(id));
    saveLocalSeen();
    updateBadge();
    if (db() && user()) {
      const rows = unique.map(announcement_id => ({announcement_id, user_id: user().id}));
      const { error } = await db().from('bong_announcement_reads')
        .upsert(rows, {onConflict:'user_id,announcement_id', ignoreDuplicates:true});
      if (error) console.warn('Bông: chưa đồng bộ lịch sử đọc', error.message);
    }
  }
  function unread() { return state.news.filter(n => !state.seen.has(n.id)); }
  function updateBadge() {
    const n = unread().length + (typeof bongInboxUnread==='function' ? bongInboxUnread() : 0);
    const badge = get('bongNewsBadge');
    if (badge) { badge.textContent = n > 9 ? '9+' : String(n); badge.hidden = n === 0; }
    const btn = get('bongNewsBell');
    if (btn) btn.setAttribute('aria-label', n ? `Thông báo từ Bông, ${n} tin mới` : 'Thông báo từ Bông');
  }
  function cardHTML(n) {
    const link = validLink(n.link_url);
    return `<article class="bong-news-item${n.is_pinned ? ' pinned' : ''}">
      <div class="bong-news-meta">${n.is_pinned ? '📌 Ghim · ' : ''}${esc(dateText(n.created_at))}</div>
      <h4>${esc(n.title)}</h4><p>${esc(n.body)}</p>
      ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Xem thêm ↗</a>` : ''}
    </article>`;
  }
  function showNews(history=false) {
    if (state.showing) return;
    if (!history && !unread().length) return;
    state.showing = true;
    const rows = history ? state.news : unread();
    const overlay = get('bongNewsOverlay');
    get('bongNewsTitle').textContent = history ? 'Tin từ Bông ♡' : 'Bông có tin mới nè ♡';
    const inboxCount=history && typeof bongInboxUnread==='function' ? bongInboxUnread() : 0;
    const inboxCard=inboxCount ? `<article class="bong-news-item"><h4>💬 Bông đã nhắn cho bạn ♡</h4><p>Bạn có ${inboxCount} tin nhắn chưa đọc.</p><button type="button" class="inbox-news-open" id="bongNewsOpenInbox">Mở hộp thư</button></article>` : '';
    get('bongNewsList').innerHTML = inboxCard + (rows.length ? rows.map(cardHTML).join('') : inboxCard ? '' : '<p class="bong-news-empty">Chưa có thông báo nào hết á ♡</p>');
    get('bongNewsOpenInbox')?.addEventListener('click',()=>{closeNews();if(typeof toggleChat==='function'&&!get('chat')?.classList.contains('show'))toggleChat();});
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('bong-news-open');
    // Ghi nhận đã xem ngay khi popup thực sự được mở, không thông báo lặp lại.
    void markSeen(rows.map(n=>n.id));
  }
  function closeNews() {
    get('bongNewsOverlay')?.classList.remove('show');
    get('bongNewsOverlay')?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('bong-news-open');
    state.showing = false;
  }
  function maybeShowPopup() {
    if (!state.loaded || state.showing || !unread().length) return;
    const welcome = get('welcomeOverlay');
    if (welcome && !welcome.classList.contains('hidden')) return;
    if (document.querySelector('.overlay.show')) return; // Không che modal đang mở
    showNews(false);
  }
  async function refreshNews() {
    if (!db()) return;
    const {data, error} = await db().from('bong_announcements')
      .select('id,title,body,link_url,is_pinned,created_at')
      .order('created_at', {ascending:false}).limit(100);
    if (error) { console.warn('Bông: chưa tải được thông báo, cần chạy SQL trước', error.message); return; }
    state.news = (data || []).sort((a,b) => Number(b.is_pinned) - Number(a.is_pinned) || new Date(b.created_at) - new Date(a.created_at));
    await loadSeen();
    state.loaded = true;
    updateBadge();
    maybeShowPopup();
  }

  function installUI() {
    if (get('bongNewsBell')) return;
    const top = document.querySelector('.top-actions-v5');
    if (top) {
      const bell = document.createElement('button');
      bell.type='button'; bell.className='bong-news-bell'; bell.id='bongNewsBell';
      bell.innerHTML='🔔 <span id="bongNewsBadge" class="bong-news-badge" hidden>0</span>';
      bell.setAttribute('aria-label','Thông báo từ Bông');
      bell.addEventListener('click', () => showNews(true));
      top.insertBefore(bell, top.firstChild);
    }
    const overlay = document.createElement('div');
    overlay.className='bong-news-overlay'; overlay.id='bongNewsOverlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML=`<section class="bong-news-modal" role="dialog" aria-modal="true" aria-labelledby="bongNewsTitle">
      <div class="bong-news-head"><div><small>NHÀ CỦA BÔNG · NEWS</small><h3 id="bongNewsTitle">Tin từ Bông ♡</h3></div>
      <button type="button" class="bong-news-close" aria-label="Đóng">×</button></div>
      <div id="bongNewsList" class="bong-news-list"></div>
      <div class="bong-news-foot"><button type="button" class="bong-news-done">Đã xem ♡</button></div>
    </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if(e.target===overlay)closeNews(); });
    overlay.querySelector('.bong-news-close').addEventListener('click',closeNews);
    overlay.querySelector('.bong-news-done').addEventListener('click',closeNews);
    document.addEventListener('keydown', e => { if(e.key==='Escape' && state.showing)closeNews(); });
    const welcome=get('welcomeOverlay');
    if (welcome) new MutationObserver(maybeShowPopup).observe(welcome,{attributes:true,attributeFilter:['class']});
    document.addEventListener('click', e => {
      const btn=e.target.closest('.admin-nav-btn[data-admin]');
      if(btn && btn.dataset.admin!=='bongnews')get('adminBongnewsPanel')?.classList.add('hidden');
    },true);
    installAdmin();
  }

  function installAdmin() {
    const nav=document.querySelector('.admin-nav');
    const content=document.querySelector('.admin-content');
    if (!nav || !content || get('adminBongnewsPanel')) return;
    const button=document.createElement('button');
    button.className='admin-nav-btn'; button.dataset.admin='bongnews';
    button.textContent='📣 Thông báo web';
    button.addEventListener('click', () => {
      if (!admin()) return toast('Chỉ Bông Admin được đăng thông báo.');
      document.querySelectorAll('.admin-panel-view').forEach(p=>p.classList.add('hidden'));
      document.querySelectorAll('.admin-nav-btn[data-admin]').forEach(b=>b.classList.remove('active'));
      get('adminBongnewsPanel').classList.remove('hidden');
      button.classList.add('active');
      void renderAdminNews();
    });
    const logout=nav.querySelector('.admin-nav-btn.danger');
    nav.insertBefore(button, logout || null);
    const panel=document.createElement('div');
    panel.id='adminBongnewsPanel';panel.className='admin-panel-view hidden';
    panel.innerHTML=`<div class="admin-section-head"><div><h2>📣 Tin mới từ Bông</h2>
      <p>Đăng cập nhật prompt, thêm char, sửa lỗi… Tin sẽ hiện trên website.</p></div></div>
      <div class="bong-admin-news-form">
        <label>Tiêu đề<input id="bongAdminNewsTitle" maxlength="140" placeholder="Ví dụ: Bông vừa sửa prompt anh Quân ♡"></label>
        <label>Nội dung<textarea id="bongAdminNewsBody" maxlength="2000" rows="5" placeholder="Viết tin ngắn gọn cho mọi người..."></textarea></label>
        <label>Link liên quan (không bắt buộc)<input id="bongAdminNewsLink" type="url" placeholder="https://..."></label>
        <label class="bong-admin-news-pin"><input id="bongAdminNewsPin" type="checkbox"> Ghim thông báo này</label>
        <div class="bong-admin-news-actions"><button id="bongAdminNewsSave" type="button">Đăng thông báo ♡</button>
          <button id="bongAdminNewsCancel" type="button" class="secondary" hidden>Hủy sửa</button></div>
        <p id="bongAdminNewsMessage" class="bong-admin-news-message" role="status"></p>
      </div><div id="bongAdminNewsList" class="bong-admin-news-list"></div>`;
    content.appendChild(panel);
    get('bongAdminNewsSave').addEventListener('click',saveAdminNews);
    get('bongAdminNewsCancel').addEventListener('click',resetAdminForm);
    get('bongAdminNewsList').addEventListener('click', async e => {
      const button=e.target.closest('button[data-action]');
      if(!button || !admin())return;
      const id=button.dataset.id;
      if(button.dataset.action==='edit') {
        const row=adminNewsCache.find(x=>x.id===id);if(!row)return;
        state.editing=id;
        get('bongAdminNewsTitle').value=row.title;
        get('bongAdminNewsBody').value=row.body;
        get('bongAdminNewsLink').value=row.link_url||'';
        get('bongAdminNewsPin').checked=!!row.is_pinned;
        get('bongAdminNewsSave').textContent='Lưu chỉnh sửa';
        get('bongAdminNewsCancel').hidden=false;
        get('bongAdminNewsTitle').focus();
      } else if(button.dataset.action==='delete') {
        if(!confirm('Xóa thông báo này khỏi website?'))return;
        const {error}=await db().from('bong_announcements').delete().eq('id',id);
        if(error)return toast('Chưa xóa được: '+error.message);
        await renderAdminNews();await refreshNews();
      }
    });
  }
  let adminNewsCache=[];
  function resetAdminForm() {
    state.editing=null;
    ['bongAdminNewsTitle','bongAdminNewsBody','bongAdminNewsLink'].forEach(id=>get(id).value='');
    get('bongAdminNewsPin').checked=false;
    get('bongAdminNewsSave').textContent='Đăng thông báo ♡';
    get('bongAdminNewsCancel').hidden=true;
    get('bongAdminNewsMessage').textContent='';
  }
  async function renderAdminNews() {
    if(!admin() || !db())return;
    const list=get('bongAdminNewsList');
    list.innerHTML='<p class="bong-news-empty">Đang tải...</p>';
    const {data,error}=await db().from('bong_announcements')
      .select('id,title,body,link_url,is_pinned,created_at')
      .order('created_at',{ascending:false}).limit(100);
    if(error){list.textContent='Chưa tải được thông báo. Hãy chạy SQL trong Supabase trước.';return;}
    adminNewsCache=data||[];
    list.innerHTML=adminNewsCache.length ? adminNewsCache.map(row=>`<div class="bong-admin-news-row">
      <div><strong>${esc(row.title)}</strong><small>${esc(dateText(row.created_at))}${row.is_pinned?' · 📌':''}</small>
      <p>${esc(row.body)}</p></div>
      <div class="bong-admin-news-row-actions"><button type="button" data-action="edit" data-id="${esc(row.id)}">Sửa</button>
      <button type="button" data-action="delete" data-id="${esc(row.id)}">Xóa</button></div></div>`).join('')
      : '<p class="bong-news-empty">Bông chưa đăng tin nào ♡</p>';
  }
  async function saveAdminNews() {
    if(!admin() || !db())return;
    const title=get('bongAdminNewsTitle').value.trim();
    const body=get('bongAdminNewsBody').value.trim();
    const rawLink=get('bongAdminNewsLink').value.trim();
    const link=validLink(rawLink);
    const message=get('bongAdminNewsMessage');
    if(!title || !body){message.textContent='Nhập tiêu đề và nội dung nha.';return;}
    if(rawLink && !link){message.textContent='Link phải bắt đầu bằng https:// hoặc http://';return;}
    const payload={title,body,link_url:link||null,is_pinned:get('bongAdminNewsPin').checked,updated_at:new Date().toISOString()};
    get('bongAdminNewsSave').disabled=true;
    message.textContent='Đang lưu...';
    const query=state.editing
      ? db().from('bong_announcements').update(payload).eq('id',state.editing)
      : db().from('bong_announcements').insert(payload);
    const {error}=await query;
    get('bongAdminNewsSave').disabled=false;
    if(error){message.textContent='Chưa lưu được: '+error.message;return;}
    resetAdminForm();toast('Đã đăng tin từ Bông ♡');
    await renderAdminNews();await refreshNews();
  }

  // Chỉ thả tim review; người chơi KHÔNG có ô trả lời. Phản hồi của Bông
  // dùng chức năng Admin đã tồn tại trong app.js.
  const originalLoadReviews=window.loadCharacterReviews;
  if(typeof originalLoadReviews==='function') {
    window.loadCharacterReviews=async function(...args) {
      const result=await originalLoadReviews.apply(this,args);
      await decorateReviewLikes();
      return result;
    };
  }
  async function decorateReviewLikes() {
    const list=get('profileReviewList');
    if(!list || !db() || typeof currentProfileReviews==='undefined')return;
    const rows=currentProfileReviews || [];
    if(!rows.length)return;
    const ids=rows.map(x=>x.id);
    const {data,error}=await db().from('bong_review_likes')
      .select('review_id,user_id').in('review_id',ids);
    if(error){console.warn('Bông: chưa tải được lượt tim',error.message);return;}
    const likes=new Map();
    (data||[]).forEach(r=>{
      if(!likes.has(r.review_id))likes.set(r.review_id,{count:0,mine:false});
      const item=likes.get(r.review_id);item.count++;
      if(user()?.id===r.user_id)item.mine=true;
    });
    const cards=[...list.querySelectorAll('.public-review-card')];
    rows.forEach((r,index)=>{
      const card=cards[index];if(!card)return;
      card.querySelector('.bong-review-like')?.remove();
      const item=likes.get(r.id)||{count:0,mine:false};
      const btn=document.createElement('button');btn.type='button';
      btn.className='bong-review-like'+(item.mine?' liked':'');
      btn.setAttribute('aria-pressed',String(item.mine));
      btn.textContent=`♥ ${item.count} · ${item.mine?'Đã thích':'Thích review'}`;
      btn.addEventListener('click',()=>toggleReviewLike(r.id,item.mine));
      card.appendChild(btn);
    });
  }
  async function toggleReviewLike(id,liked) {
    if(!user()) { toast('Đăng nhập để thả tim review nha ♡'); if(typeof openAuth==='function')openAuth(); return; }
    if(!db() || state.busyLikes.has(id))return;
    state.busyLikes.add(id);
    const query=liked ? db().from('bong_review_likes').delete().eq('review_id',id).eq('user_id',user().id)
      : db().from('bong_review_likes').insert({review_id:id,user_id:user().id});
    const {error}=await query;
    state.busyLikes.delete(id);
    if(error){toast('Chưa thả tim được: '+error.message);return;}
    await decorateReviewLikes();
  }
  function initWhenReady() {
    installUI();
    window.addEventListener('bong:inbox-unread',updateBadge);
    updateBadge();
    let attempts=0;
    const timer=setInterval(async()=>{
      attempts++;
      if(db()){
        clearInterval(timer);
        await refreshNews();
        // Nếu login/logout sau đó, đồng bộ lại trạng thái đã xem.
        db().auth.onAuthStateChange((_event)=>setTimeout(()=>{void refreshNews();void decorateReviewLikes();},500));
      }else if(attempts>=40){clearInterval(timer);}
    },350);
    document.addEventListener('visibilitychange',()=>{
      if(!document.hidden && db())void refreshNews();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initWhenReady);
  else initWhenReady();
})();
