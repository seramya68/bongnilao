
const characters = window.CHARACTERS || [];
const stories = window.STORIES || {};

let saved = new Set(JSON.parse(localStorage.getItem("bongSaved") || "[]"));
let currentId = null;
let currentChapter = "background";
let readerSize = 15;
let currentMusicCharacterId = null;

let reviewStats = {};
let currentProfileReviews = [];
let myCurrentReview = null;
let notificationCounts = {};
let characterLinkOverrides = {};
let myNotificationSubscription = null;
let currentEventPrompt = "";
let activeEventCategory = "Tất cả";
let currentEventIndex = -1;
const playgroundData = window.CHARACTER_PLAYGROUND || {};
let reviewDraft = {
  love_rating: 5,
  realism_rating: 5,
  chemistry_rating: 5,
  story_rating: 5
};

let sb = null;
let backendReady = false;
let authSession = null;
let currentProfile = null;

const $ = id => document.getElementById(id);

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function escapeHTML(s=""){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));
}

function showToast(message){
  const t=$("toast");
  if(!t)return;
  t.textContent=message;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>t.classList.remove("show"),2300);
}

function imgPath(c,file){
  return `assets/images/${c.folder}/${file}`;
}

function fallbackImage(img){
  img.style.display="none";
  const parent=img.parentElement;

  if(parent && !parent.querySelector(".missing-img")){
    const box=document.createElement("div");
    box.className="missing-img";
    box.style.cssText=
      "aspect-ratio:3/4;display:grid;place-items:center;background:linear-gradient(135deg,#dba1b1,#7f2945);color:rgba(255,255,255,.6);font-size:42px";
    box.textContent="♡";
    parent.appendChild(box);
  }
}

function findChar(id){
  return characters.find(c=>c.id===id);
}

function slugify(text){
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/đ/g,"d")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"");
}

function setAuthMessage(id,text,type=""){
  const el=$(id);
  if(!el)return;
  el.textContent=text;
  el.className="auth-message"+(type?` ${type}`:"");
}

/* =========================================================
   LOCAL FAVORITES
   Favorites stay local for now.
   ========================================================= */

function saveFavorites(){
  localStorage.setItem("bongSaved",JSON.stringify([...saved]));
  if($("savedCount")) $("savedCount").textContent=saved.size;
}

function toggleFavorite(id){
  saved.has(id) ? saved.delete(id) : saved.add(id);
  saveFavorites();
  renderAll();

  if(currentId===id){
    updateProfileFavorite();
  }
}

function updateProfileFavorite(){
  const btn=$("profileFav");
  if(!btn)return;
  const isSaved=saved.has(currentId);
  btn.textContent=isSaved ? "♥" : "♡";
  btn.title=isSaved ? "Bỏ lưu nhân vật" : "Lưu nhân vật";
  btn.classList.toggle("saved",isSaved);
}

function toggleCurrentFavorite(){
  if(currentId)toggleFavorite(currentId);
}

/* =========================================================
   CHARACTER CARDS
   ========================================================= */

function tagHTML(tags=[]){
  return `
    <div class="tag-list">
      ${tags.map(t=>`<span class="char-tag">${escapeHTML(t)}</span>`).join("")}
    </div>
  `;
}

function displayCategoryLabel(category){
  if(category==="Chồng Tây")return "Nhà ngoại";
  if(category==="Chồng Việt Nam")return "Nhà nội";
  return category || "";
}

function displayCategoryNote(category){
  if(category==="Chồng Tây")return "trai Tây";
  if(category==="Chồng Việt Nam")return "trai Việt";
  return "";
}

function resolvePlaygroundKey(c){
  if(!c)return "";

  const candidates=[
    c.id,
    c.slug,
    slugify(c.name || "")
  ].filter(Boolean);

  const aliases={
    "milan-nguyen-van-dijk":"milan",
    "milan-nguyen-van-dijk-":"milan",
    "james-jamie-whitmore":"jamie",
    "jamie-whitmore":"jamie",
    "noah-minh-nguyen":"noah",
    "nguyen-minh-khai":"minhkhai",
    "le-hai-phong":"haiphong"
  };

  for(const raw of candidates){
    const key=String(raw);
    if(playgroundData[key])return key;
    if(playgroundData[aliases[key]])return aliases[key];
  }

  return "";
}

function getPlayground(c){
  const key=resolvePlaygroundKey(c);
  return key ? playgroundData[key] : null;
}

function shortJob(job=""){
  return String(job || "").split("·")[0].trim();
}

function cleanAge(age=""){
  const value=String(age || "").trim();
  if(!value)return "";
  return /tuổi/i.test(value) ? value : `${value} tuổi`;
}

function cardTagline(c){
  const data=getPlayground(c);
  return data?.cardHook || data?.tagline || c.quote || "Mở hồ sơ để xem plot và bắt đầu chơi.";
}

function metaHTML(c,profile=false){
  return `
    <div class="${profile ? "profile-meta" : "character-meta"}">
      <div class="meta-row">
        <span class="meta-label">Tuổi</span>
        <span class="meta-value">${escapeHTML(c.age || "")}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Nghề nghiệp</span>
        <span class="meta-value">${escapeHTML(c.job || "")}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Nơi ở</span>
        <span class="meta-value">${escapeHTML(c.location || "")}</span>
      </div>
    </div>
  `;
}


function cardRatingHTML(characterKey){
  const stat=reviewStats[characterKey];

  if(!stat || !stat.count){
    return `
      <div class="card-rating-line">
        <span class="card-rating-heart">♡</span>
        <span class="card-rating-muted">Chưa có đánh giá</span>
      </div>
    `;
  }

  return `
    <div class="card-rating-line">
      <span class="card-rating-heart">♥</span>
      <strong>${stat.avg.toFixed(1)}</strong>
      <span>/5 · ${stat.count} đánh giá</span>
    </div>
  `;
}


function cardWaitingHTML(c){
  if(c.ggai)return "";
  const count=Number(notificationCounts[c.id] || 0);
  return `
    <div class="card-waiting-line">
      <span>🔔</span>
      ${count ? `<span><strong>${count}</strong> người đang chờ link</span>` : `<span>Đang chờ link GGAI</span>`}
    </div>
  `;
}

function cardHTML(c){
  const age=cleanAge(c.age);
  const job=shortJob(c.job);
  const quick=[age,job].filter(Boolean).join(" · ");
  const location=c.location || "";

  return `
    <article class="card card-v12">
      <div class="card-photo-wrap card-photo-wrap-v12" onclick="openProfile('${c.id}')">
        <img
          class="card-photo card-photo-v12"
          src="${imgPath(c,"profile.jpg")}"
          alt="${escapeHTML(c.name)}"
          onerror="fallbackImage(this)"
        >

        <span class="category-badge category-badge-v12">${escapeHTML(displayCategoryLabel(c.category))}</span>

        <button
          class="fav-btn fav-btn-v12 ${saved.has(c.id) ? "saved" : ""}"
          onclick="event.stopPropagation();toggleFavorite('${c.id}')"
          aria-label="Lưu ${escapeHTML(c.name)}"
        >${saved.has(c.id) ? "♥" : "♡"}</button>

        <div class="card-photo-gradient-v12"></div>
        <div class="card-photo-name-v12">
          <h3>${escapeHTML(c.name)}</h3>
          <div>${escapeHTML(quick)}</div>
        </div>
      </div>

      <div class="card-body card-body-v12">
        ${location ? `<div class="card-location-v12">⌖ ${escapeHTML(location)}</div>` : ""}
        <p class="card-hook-v12">${escapeHTML(cardTagline(c))}</p>

        <div class="card-status-row-v12">
          ${cardRatingHTML(c.id)}
          ${!c.ggai ? cardWaitingHTML(c) : `<span class="card-link-ready-v12">GGAI ✓</span>`}
        </div>

        <div class="card-actions card-actions-v12">
          <button class="profile-btn" onclick="openProfile('${c.id}')">Xem hồ sơ</button>
          <button class="story-btn" onclick="openReader('${c.id}','background')" aria-label="Đọc truyện">↗</button>
        </div>
      </div>
    </article>
  `;
}

function renderAll(){
  const q=$("searchInput")?.value.trim().toLowerCase() || "";

  [
    ["Chồng Tây","westernGrid","westernCount"],
    ["Chồng Việt Nam","vietnamGrid","vietnamCount"]
  ].forEach(([category,gridId,countId])=>{
    let list=characters.filter(c=>c.category===category);

    if(q){
      list=list.filter(c=>
        [
          c.name,c.age,c.job,c.location,c.quote,
          ...(c.tags || [])
        ].join(" ").toLowerCase().includes(q)
      );
    }

    $(gridId).innerHTML=list.length
      ? list.map(cardHTML).join("")
      : `<div class="empty">Không thấy ai khớp từ khóa này =)))</div>`;

    $(countId).textContent=list.length;
  });

  if($("savedCount")) $("savedCount").textContent=saved.size;
}

function showSaved(){
  const ids=[...saved];

  if(!ids.length){
    showToast("Chưa lưu chồng nào hết á =)))");
    return;
  }

  if($("searchInput")) $("searchInput").value="";

  const west=characters.filter(c=>ids.includes(c.id)&&c.category==="Chồng Tây");
  const viet=characters.filter(c=>ids.includes(c.id)&&c.category==="Chồng Việt Nam");

  $("westernGrid").innerHTML=west.length
    ? west.map(cardHTML).join("")
    : `<div class="empty">Chưa lưu Chồng Tây nào.</div>`;

  $("vietnamGrid").innerHTML=viet.length
    ? viet.map(cardHTML).join("")
    : `<div class="empty">Chưa lưu Chồng Việt Nam nào.</div>`;

  $("westernCount").textContent=west.length;
  $("vietnamCount").textContent=viet.length;

  $("library").scrollIntoView({behavior:"smooth"});
}

/* =========================================================
   PROFILE + GALLERY
   ========================================================= */

function openProfile(id){
  const c=findChar(id);
  if(!c)return;

  currentId=id;
  activeEventCategory="Tất cả";
  currentEventIndex=-1;
  currentEventPrompt="";

  $("profileName").textContent=c.name;
  $("profileSub").textContent=displayCategoryLabel(c.category);

  const quick=[cleanAge(c.age),shortJob(c.job)].filter(Boolean).join(" · ");
  $("profileQuickline").textContent=quick;
  $("profileQuote").textContent=c.quote || cardTagline(c);
  $("profileMeta").innerHTML=metaHTML(c,true)+tagHTML(c.tags || []);

  $("profileMain").src=imgPath(c,"profile.jpg");
  $("profileMain").style.display="block";

  $("galleryGrid").innerHTML=[1,2,3,4].map(n=>`
    <img
      class="gallery-img"
      src="${imgPath(c,`${n}.jpg`)}"
      alt="${escapeHTML(c.name)} ${n}"
      onclick="openLightbox(this.src)"
      onerror="this.style.display='none'"
    >
  `).join("");

  const ggai=$("ggaiBtn");
  if(c.ggai){
    ggai.textContent="Chơi ngay ↗";
    ggai.classList.remove("disabled");
  }else{
    ggai.textContent="🔔 Báo tui khi có link";
    ggai.classList.remove("disabled");
  }

  renderCharacterPlayground(c);
  switchProfileTab("overview");
  updateProfileFavorite();
  $("profileOverlay").classList.add("show");
  playCharacterMusic(id);
  loadCharacterReviews(id);
}

/* =========================================================
   V12 — CHARACTER PLAYGROUND
   ========================================================= */

function switchProfileTab(tab,button=null){
  const tabs=["overview","story","npcs","play","reviews"];

  tabs.forEach(name=>{
    const panel=$("profileTab"+name[0].toUpperCase()+name.slice(1));
    panel?.classList.toggle("hidden",name!==tab);
  });

  document.querySelectorAll("[data-profile-tab]").forEach(btn=>{
    btn.classList.toggle("active",btn.dataset.profileTab===tab);
  });

  if(button)button.classList.add("active");
}

function renderCharacterPlayground(c){
  const data=getPlayground(c);

  const role=data?.playerRole || {
    title:"Vai của bạn trong câu chuyện",
    text:"Char này chưa có bản tóm tắt vai người chơi. Đọc Background Story để lấy đúng context trước khi bắt đầu nha."
  };

  $("profilePlayerRoleTitle").textContent=role.title;
  $("profilePlayerRoleText").textContent=role.text;

  const npcList=$("profileNpcList");
  const npcs=data?.npcs || [];

  npcList.innerHTML=npcs.length
    ? npcs.map((npc,index)=>`
        <article class="npc-card-v12">
          <div class="npc-avatar-v12">${escapeHTML((npc.name || "?").trim().charAt(0).toUpperCase())}</div>
          <div class="npc-copy-v12">
            <div class="npc-number-v12">NPC ${String(index+1).padStart(2,"0")}</div>
            <h4>${escapeHTML(npc.name)}</h4>
            <strong>${escapeHTML(npc.role || "")}</strong>
            <p>${escapeHTML(npc.note || "")}</p>
            ${npc.cue ? `<small>↳ ${escapeHTML(npc.cue)}</small>` : ""}
          </div>
        </article>
      `).join("")
    : `<div class="npc-empty-v12">Char này chưa có NPC guide. Bông sẽ bổ sung sau ♡</div>`;

  renderEventFilters(c);
  renderEventList(c);

  const events=data?.events || [];
  if($("profileEventCount")){
    $("profileEventCount").textContent=events.length ? `${events.length} event riêng · chọn mood hoặc bốc ngẫu nhiên` : "Chưa có event riêng";
  }
  if(events.length){
    selectCharacterEvent(0);
  }else{
    clearEventSpotlight(c);
  }
}

function renderEventFilters(c){
  const data=getPlayground(c);
  const events=data?.events || [];
  const categories=["Tất cả",...new Set(events.map(x=>x.category).filter(Boolean))];

  $("profileEventFilters").innerHTML=categories.map(category=>`
    <button
      class="event-filter-btn-v12 ${category===activeEventCategory ? "active" : ""}"
      onclick="setEventCategory('${escapeHTML(category).replace(/'/g,"&#039;")}')"
    >${escapeHTML(category)}</button>
  `).join("");
}

function setEventCategory(category){
  activeEventCategory=category;
  const c=findChar(currentId);
  if(!c)return;
  renderEventFilters(c);
  renderEventList(c);
}

function filteredCharacterEvents(c){
  const events=getPlayground(c)?.events || [];
  return events
    .map((event,index)=>({...event,__index:index}))
    .filter(event=>activeEventCategory==="Tất cả" || event.category===activeEventCategory);
}

function renderEventList(c){
  const list=filteredCharacterEvents(c);
  const box=$("profileEventList");

  if(!list.length){
    box.innerHTML=`<div class="event-empty-v12">Chưa có event trong nhóm này.</div>`;
    return;
  }

  box.innerHTML=list.map(event=>`
    <button class="event-mini-card-v12 ${event.__index===currentEventIndex ? "active" : ""}" onclick="selectCharacterEvent(${event.__index})">
      <span>${escapeHTML(event.category || "Event")}</span>
      <strong>${escapeHTML(event.title)}</strong>
      <small>${escapeHTML(event.teaser || event.description || "")}</small>
    </button>
  `).join("");
}

function selectCharacterEvent(index){
  const c=findChar(currentId);
  const events=getPlayground(c)?.events || [];
  const event=events[index];
  if(!event)return;

  currentEventIndex=index;
  currentEventPrompt=event.prompt || "";

  $("profileEventCategory").textContent=event.category || "Event";
  $("profileEventTitle").textContent=event.title || "Event";
  $("profileEventDescription").textContent=event.description || "";
  $("profileEventPrompt").textContent=currentEventPrompt || "—";

  renderEventList(c);
}

function shuffleCharacterEvent(){
  const c=findChar(currentId);
  if(!c)return;

  const list=filteredCharacterEvents(c);
  if(!list.length){
    showToast("Nhóm này chưa có event nha.");
    return;
  }

  let pool=list;
  if(pool.length>1 && currentEventIndex>=0){
    pool=pool.filter(x=>x.__index!==currentEventIndex);
  }

  const pick=pool[Math.floor(Math.random()*pool.length)];
  selectCharacterEvent(pick.__index);
  showToast(`🎲 ${pick.title}`);
}

async function copyCurrentEventPrompt(){
  if(!currentEventPrompt){
    showToast("Chọn một event trước nha ♡");
    return false;
  }

  try{
    await navigator.clipboard.writeText(currentEventPrompt);
    showToast("Đã copy tin nhắn mở màn ♡");
    return true;
  }catch{
    const area=document.createElement("textarea");
    area.value=currentEventPrompt;
    area.style.position="fixed";
    area.style.opacity="0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    showToast("Đã copy tin nhắn mở màn ♡");
    return true;
  }
}

async function copyAndOpenCurrentEvent(){
  const copied=await copyCurrentEventPrompt();
  if(!copied)return;
  setTimeout(()=>handleGgaiAction(),180);
}

function clearEventSpotlight(c){
  currentEventPrompt="";
  currentEventIndex=-1;
  $("profileEventCategory").textContent="Event";
  $("profileEventTitle").textContent="Chưa có event riêng";
  $("profileEventDescription").textContent=`Bông chưa viết event riêng cho ${c?.name || "char này"}.`;
  $("profileEventPrompt").textContent="—";
}

/* =========================================================
   STORY RENDERING
   ========================================================= */

function cleanRaw(raw){
  return String(raw || "")
    .replace(/\r\n/g,"\n")
    .replace(/&#xA0;|&#x20;/gi," ")
    .replace(/\\&/g,"&")
    .replace(/\\(?=\n)/g,"")
    .replace(/\n[ \t]*\\[ \t]*\n/g,"\n\n")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

function normalizedLine(line){
  return line
    .normalize("NFKC")
    .replace(/[#*_\\[\]()":]/g,"")
    .trim()
    .toUpperCase();
}

function splitStory(raw){
  const text=cleanRaw(raw);
  const lines=text.split("\n");

  let bg=-1;
  let opening=-1;

  lines.forEach((line,i)=>{
    const n=normalizedLine(line);

    if(
      bg<0 &&
      (n.includes("BACKGROUND STORY") || n.includes("BG STORY"))
    ){
      bg=i;
    }

    if(opening<0 && n.includes("OPENING SCENE")){
      opening=i;
    }
  });

  const bgStart=bg>=0 ? bg+1 : 0;
  const bgEnd=opening>=0 ? opening : lines.length;
  const opStart=opening>=0 ? opening+1 : lines.length;

  return {
    background:lines.slice(bgStart,bgEnd).join("\n").trim(),
    opening:lines.slice(opStart).join("\n").trim()
  };
}

function inlineMD(s){
  let out=escapeHTML(s);

  out=out.replace(/\\([*_#\[\]])/g,"$1");
  out=out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );
  out=out.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>");
  out=out.replace(/__([^_]+)__/g,"<strong>$1</strong>");
  out=out.replace(/\*([^*\n]+)\*/g,"<em>$1</em>");
  out=out.replace(/_([^_\n]+)_/g,"<em>$1</em>");

  return out;
}

function renderStory(text){
  const cleaned=cleanRaw(text);
  if(!cleaned)return "";

  const lines=cleaned.split("\n");
  const html=[];

  for(const rawLine of lines){
    const line=rawLine.trim();

    if(!line){
      html.push(`<div class="story-spacer"></div>`);
      continue;
    }

    if(/^[-—]{3,}$/.test(line)){
      html.push("<hr>");
      continue;
    }

    if(/^###\s+/.test(line)){
      html.push(`<h3>${inlineMD(line.replace(/^###\s+/,""))}</h3>`);
      continue;
    }

    if(/^##\s+/.test(line)){
      html.push(`<h2>${inlineMD(line.replace(/^##\s+/,""))}</h2>`);
      continue;
    }

    if(/^#\s+/.test(line)){
      html.push(`<h1>${inlineMD(line.replace(/^#\s+/,""))}</h1>`);
      continue;
    }

    if(/^>\s+/.test(line)){
      html.push(`<blockquote>${inlineMD(line.replace(/^>\s+/,""))}</blockquote>`);
      continue;
    }

    html.push(`<p>${inlineMD(line)}</p>`);
  }

  return html.join("");
}

function openReader(id,chapter="background"){
  const c=findChar(id);
  if(!c)return;

  currentId=id;
  currentChapter=chapter;

  $("profileOverlay").classList.remove("show");
  $("readerOverlay").classList.add("show");

  setChapter(chapter);
  playCharacterMusic(id);
}

function setChapter(chapter){
  const c=findChar(currentId);
  if(!c)return;

  const parts=splitStory(stories[currentId] || "");
  currentChapter=chapter;

  $("bgBtn").classList.toggle("active",chapter==="background");
  $("openingBtn").classList.toggle("active",chapter==="opening");

  $("readerTitle").textContent=
    `${c.name} — ${chapter==="background" ? "Background Story" : "Opening Scene"}`;

  const content=parts[chapter];

  $("readerContent").innerHTML=content
    ? renderStory(content)
    : `<p>Phần này chưa có nội dung.</p>`;

  $("readerContent").style.fontSize=readerSize+"px";
  $("readerOverlay").querySelector(".modal").scrollTop=0;
}

function changeFont(d){
  readerSize=Math.max(12,Math.min(22,readerSize+d));
  $("readerContent").style.fontSize=readerSize+"px";
}

/* =========================================================
   MUSIC PER CHARACTER
   ========================================================= */

function characterMusicPath(c){
  return c && c.music ? `assets/music/${c.music}` : "";
}

async function playCharacterMusic(id){
  const c=findChar(id);
  const audio=$("characterMusic");

  if(!c || !audio)return;

  const path=characterMusicPath(c);

  if(!path){
    currentMusicCharacterId=null;
    audio.pause();
    audio.removeAttribute("src");
    syncAudioButtons(false,c);
    return;
  }

  if(currentMusicCharacterId!==id){
    currentMusicCharacterId=id;
    audio.src=path;
    audio.volume=.6;
    audio.load();
  }

  try{
    await audio.play();
    syncAudioButtons(true,c);
  }catch{
    syncAudioButtons(false,c);
    showToast(`Bấm ♫ để phát nhạc của ${c.name} nha`);
  }
}

function syncAudioButtons(isPlaying,c=findChar(currentId)){
  const profileBtn=$("audioToggleButton");
  const readerBtn=$("readerAudioButton");
  const bar=$("characterAudioBar");

  if(c){
    if($("audioCharacterName")){
      $("audioCharacterName").textContent=`Nhạc của ${c.name}`;
    }

    if($("audioFileName")){
      $("audioFileName").textContent=c.music || "Chưa có file nhạc";
    }
  }

  const hasMusic=!!(c && c.music);

  if(bar)bar.style.display=hasMusic ? "flex" : "none";
  if(readerBtn)readerBtn.style.display=hasMusic ? "" : "none";

  if(profileBtn){
    profileBtn.textContent=isPlaying ? "❚❚ Tắt nhạc" : "▶ Bật nhạc";
    profileBtn.classList.toggle("paused",!isPlaying);
  }

  if(readerBtn){
    readerBtn.textContent=isPlaying ? "♫ Tắt nhạc" : "♫ Bật nhạc";
    readerBtn.classList.toggle("paused",!isPlaying);
  }
}

async function toggleCharacterMusic(){
  const audio=$("characterMusic");
  const c=findChar(currentId);

  if(!audio || !c || !c.music)return;

  if(audio.paused){
    if(currentMusicCharacterId!==currentId){
      await playCharacterMusic(currentId);
      return;
    }

    try{
      await audio.play();
      syncAudioButtons(true,c);
    }catch{
      showToast("Không phát được file nhạc. Kiểm tra assets/music nha.");
    }
  }else{
    audio.pause();
    syncAudioButtons(false,c);
  }
}

/* =========================================================
   LIGHTBOX + OVERLAYS
   ========================================================= */

function openLightbox(src){
  $("lightboxImg").src=src;
  $("lightboxOverlay").classList.add("show");
}

function closeOverlay(id){
  $(id)?.classList.remove("show");

  if(id==="profileOverlay" || id==="readerOverlay"){
    const profileOpen=$("profileOverlay")?.classList.contains("show");
    const readerOpen=$("readerOverlay")?.classList.contains("show");

    if(!profileOpen && !readerOpen){
      const audio=$("characterMusic");

      if(audio){
        audio.pause();
        syncAudioButtons(false,findChar(currentId));
      }
    }
  }
}

function overlayClose(e,id){
  if(e.target.id===id)closeOverlay(id);
}

function scrollToCategory(id){
  $(id).scrollIntoView({behavior:"smooth"});
}

/* =========================================================
   SUPABASE BOOT
   ========================================================= */

function supabaseConfigured(){
  const cfg=window.BONG_SUPABASE_CONFIG || {};

  return (
    typeof cfg.url==="string" &&
    typeof cfg.anonKey==="string" &&
    cfg.url.startsWith("https://") &&
    !cfg.url.includes("PASTE_") &&
    cfg.anonKey.length>20 &&
    !cfg.anonKey.includes("PASTE_")
  );
}

async function initSupabase(){
  if(!supabaseConfigured()){
    backendReady=false;
    updateBackendStatus(
      "Chưa nối Supabase: điền Project URL và anon/public key trong assets/js/supabase-config.js."
    );
    updateAuthButton();
    return;
  }

  if(!window.supabase?.createClient){
    backendReady=false;
    updateBackendStatus("Không tải được Supabase JS.");
    updateAuthButton();
    return;
  }

  const cfg=window.BONG_SUPABASE_CONFIG;

  sb=window.supabase.createClient(cfg.url,cfg.anonKey,{
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
    }
  });

  backendReady=true;
  updateBackendStatus("Supabase đã kết nối ♡");

  const {
    data:{session}
  }=await sb.auth.getSession();

  authSession=session;

  if(session){
    await loadCurrentProfile();
    await loadChatThread();
  }

  await loadDatabaseCharacters();
  await loadCharacterLinks();
  await loadNotificationCounts();
  await loadReviewStats();

  sb.auth.onAuthStateChange(async (_event,session)=>{
    authSession=session;

    if(session){
      await loadCurrentProfile();
      await loadChatThread();
    }else{
      currentProfile=null;
      clearChatThreadUI();
    }

    updateAuthButton();
    await loadReviewStats();
  });

  updateAuthButton();
}

function updateBackendStatus(text){
  if($("backendStatus"))$("backendStatus").textContent=text;
}

/* =========================================================
   AUTH
   Supabase Auth is email/password internally.
   To keep the UI username-only, a deterministic virtual email is used.
   Email confirmation should be disabled for this project.
   ========================================================= */

function normalizeUsername(username){
  return String(username || "")
    .trim()
    .toLowerCase();
}

function usernameToVirtualEmail(username){
  return `${normalizeUsername(username)}@users.nhacuabong.local`;
}

function switchAuthTab(tab){
  const signup=tab==="signup";

  $("signupTabBtn")?.classList.toggle("active",signup);
  $("loginTabBtn")?.classList.toggle("active",!signup);
  $("signupPanel")?.classList.toggle("hidden",!signup);
  $("loginPanel")?.classList.toggle("hidden",signup);

  setAuthMessage("signupMessage","");
  setAuthMessage("loginMessage","");
}

function openAuth(){
  if(currentProfile?.role==="admin"){
    openAdmin();
    return;
  }

  if(authSession){
    const who=currentProfile?.display_name || currentProfile?.username || "tài khoản này";
    const wantLogout=confirm(`Đang đăng nhập là ${who}.\n\nĐăng xuất?`);

    if(wantLogout){
      logoutSupabase();
    }

    return;
  }

  if(!backendReady){
    showToast("Chưa cấu hình Supabase nên chưa đăng nhập được nha.");
    return;
  }

  $("authOverlay")?.classList.add("show");
  switchAuthTab("signup");
}

async function signupLocal(){
  if(!backendReady){
    setAuthMessage(
      "signupMessage",
      "Chưa cấu hình Supabase.",
      "error"
    );
    return;
  }

  const displayName=$("signupDisplayName").value.trim();
  const username=normalizeUsername($("signupUsername").value);
  const pass=$("signupPassword").value;
  const pass2=$("signupPassword2").value;

  if(!displayName || !username || !pass || !pass2){
    setAuthMessage("signupMessage","Điền đủ 4 ô trước nha =)))","error");
    return;
  }

  if(!/^[a-z0-9._-]{3,24}$/.test(username)){
    setAuthMessage(
      "signupMessage",
      "Username 3–24 ký tự, chỉ dùng chữ thường, số, ., _ hoặc -.",
      "error"
    );
    return;
  }

  if(pass.length<6){
    setAuthMessage("signupMessage","Password ít nhất 6 ký tự nha.","error");
    return;
  }

  if(pass!==pass2){
    setAuthMessage("signupMessage","Hai password chưa giống nhau.","error");
    return;
  }

  const email=usernameToVirtualEmail(username);

  const {data,error}=await sb.auth.signUp({
    email,
    password:pass,
    options:{
      data:{
        username,
        display_name:displayName
      }
    }
  });

  if(error){
    setAuthMessage("signupMessage",error.message,"error");
    return;
  }

  if(!data.session){
    setAuthMessage(
      "signupMessage",
      "Tài khoản đã tạo nhưng project đang bật xác nhận email. Tắt Confirm email trong Supabase Auth để dùng username-only.",
      "error"
    );
    return;
  }

  authSession=data.session;
  await loadCurrentProfile();

  setAuthMessage("signupMessage","Tạo tài khoản xong ♡","success");

  setTimeout(()=>{
    closeOverlay("authOverlay");
    showToast(`Chào ${displayName} ♡`);
  },350);
}

async function loginLocal(){
  if(!backendReady){
    setAuthMessage("loginMessage","Chưa cấu hình Supabase.","error");
    return;
  }

  const username=normalizeUsername($("loginUsername").value);
  const pass=$("loginPassword").value;

  if(!username || !pass){
    setAuthMessage("loginMessage","Nhập username với password trước nha.","error");
    return;
  }

  const {data,error}=await sb.auth.signInWithPassword({
    email:usernameToVirtualEmail(username),
    password:pass
  });

  if(error){
    setAuthMessage("loginMessage","Username hoặc password chưa đúng.","error");
    return;
  }

  authSession=data.session;
  await loadCurrentProfile();
  await loadChatThread();

  setAuthMessage("loginMessage","Đăng nhập thành công ♡","success");

  setTimeout(()=>{
    closeOverlay("authOverlay");
    showToast(`Chào lại ${currentProfile?.display_name || username} ♡`);
  },300);
}

async function logoutSupabase(){
  if(sb){
    await sb.auth.signOut();
  }

  authSession=null;
  currentProfile=null;
  updateAuthButton();
  showToast("Đã đăng xuất ♡");
}

async function loadCurrentProfile(){
  if(!sb || !authSession?.user){
    currentProfile=null;
    updateAuthButton();
    return;
  }

  const {data,error}=await sb
    .from("profiles")
    .select("id,username,display_name,role")
    .eq("id",authSession.user.id)
    .single();

  if(error){
    console.error("profile",error);
    currentProfile=null;
  }else{
    currentProfile=data;
  }

  updateAuthButton();
}

function updateAuthButton(){
  const btn=$("authButton");
  if(!btn)return;

  if(!backendReady){
    btn.textContent="Chưa nối Supabase";
    btn.classList.remove("logged");
    return;
  }

  if(currentProfile?.role==="admin"){
    btn.textContent="Bông Admin ⚙";
    btn.classList.add("logged");
    btn.title="Mở Admin Dashboard";
    return;
  }

  if(authSession){
    btn.textContent=`${currentProfile?.display_name || currentProfile?.username || "Tài khoản"} ♡`;
    btn.classList.add("logged");
    btn.title="Bấm để đăng xuất";
    return;
  }

  btn.textContent="Đăng nhập / Đăng ký";
  btn.classList.remove("logged");
  btn.title="";
}

/* =========================================================
   DATABASE CHARACTERS
   Existing 5 static characters remain local.
   New admin characters come from Supabase.
   ========================================================= */

async function loadDatabaseCharacters(){
  if(!sb)return;

  const {data,error}=await sb
    .from("characters")
    .select(`
      id,
      slug,
      name,
      category,
      age,
      job,
      location,
      quote,
      tags,
      image_folder,
      music_file,
      ggai_url,
      is_published,
      character_stories (
        background_story,
        opening_scene
      )
    `)
    .order("created_at",{ascending:true});

  if(error){
    console.error("characters fetch",error);
    return;
  }

  for(const row of (data || [])){
    if(characters.some(c=>c.dbId===row.id || c.id===row.id)){
      continue;
    }

    const c={
      id:row.id,
      dbId:row.id,
      slug:row.slug,
      name:row.name,
      category:row.category,
      age:row.age || "",
      job:row.job || "",
      location:row.location || "",
      quote:row.quote || "",
      tags:row.tags || [],
      folder:row.image_folder || "",
      music:row.music_file || "",
      ggai:row.ggai_url || ""
    };

    characters.push(c);

    const storyRow=Array.isArray(row.character_stories)
      ? row.character_stories[0]
      : row.character_stories;

    stories[c.id]=
      `BACKGROUND STORY\n\n${storyRow?.background_story || ""}`+
      `\n\nOPENING SCENE\n\n${storyRow?.opening_scene || ""}`;
  }

  renderAll();
}

/* =========================================================
   CHAT — SUPABASE
   ========================================================= */

function toggleChat(){
  $("chat")?.classList.toggle("show");

  if($("chat")?.classList.contains("show")){
    if(!authSession){
      $("chatBody").innerHTML=
        `<div class="bubble admin">Đăng nhập trước rồi nhắn Bông nha 🌷</div>`;
    }else{
      loadChatThread();
    }
  }
}

function clearChatThreadUI(){
  if($("chatBody")){
    $("chatBody").innerHTML=
      `<div class="bubble admin">Bông đây 🌷 Có gì nhắn tui nha.</div>`;
  }
}

async function loadChatThread(){
  if(!sb || !authSession?.user || !$("chatBody")){
    return;
  }

  const {data,error}=await sb
    .from("messages")
    .select("id,sender_role,body,created_at")
    .eq("user_id",authSession.user.id)
    .order("created_at",{ascending:true});

  if(error){
    console.error("chat fetch",error);
    return;
  }

  const box=$("chatBody");

  if(!data?.length){
    box.innerHTML=
      `<div class="bubble admin">Bông đây 🌷 Có gì nhắn tui nha.</div>`;
    return;
  }

  box.innerHTML=data.map(m=>`
    <div class="bubble ${m.sender_role==="admin" ? "admin" : "me"}">
      ${escapeHTML(m.body)}
    </div>
  `).join("");

  box.scrollTop=box.scrollHeight;
}

async function sendChat(){
  const input=$("chatInput");
  const value=input.value.trim();

  if(!value)return;

  if(!backendReady || !authSession?.user){
    showToast("Đăng nhập trước rồi nhắn Bông nha ♡");
    openAuth();
    return;
  }

  input.disabled=true;

  const {error}=await sb
    .from("messages")
    .insert({
      user_id:authSession.user.id,
      sender_role:"user",
      body:value
    });

  input.disabled=false;

  if(error){
    console.error("message insert",error);
    showToast("Gửi tin nhắn chưa được, thử lại nha.");
    return;
  }

  input.value="";
  await loadChatThread();

  if(currentProfile?.role==="admin"){
    await renderAdminMessages();
  }
}

/* =========================================================
   ADMIN — SUPABASE
   ========================================================= */

function isAdminSession(){
  return currentProfile?.role==="admin";
}

async function openAdmin(){
  if(!isAdminSession()){
    showToast("Chỉ Bông Admin mới mở được phần này.");
    return;
  }

  $("adminOverlay").classList.add("show");
  await renderAdminMessages();
  await renderAdminCharacters();
  await renderAdminReviews();
  await renderAdminLinks();
}

function switchAdminTab(tab,button){
  ["messages","characters","reviews","links","upload"].forEach(x=>{
    $(`admin${x[0].toUpperCase()+x.slice(1)}Panel`)
      ?.classList.toggle("hidden",x!==tab);
  });

  document
    .querySelectorAll(".admin-nav-btn[data-admin]")
    .forEach(b=>b.classList.remove("active"));

  button?.classList.add("active");

  if(tab==="messages")renderAdminMessages();
  if(tab==="characters")renderAdminCharacters();
  if(tab==="reviews")renderAdminReviews();
  if(tab==="links")renderAdminLinks();
}

async function renderAdminMessages(){
  const list=$("adminMessagesList");
  if(!list || !sb || !isAdminSession())return;

  const {data,error}=await sb
    .from("messages")
    .select(`
      id,
      user_id,
      sender_role,
      body,
      read_by_admin,
      created_at,
      profiles:user_id (
        username,
        display_name
      )
    `)
    .order("created_at",{ascending:false})
    .limit(200);

  if(error){
    console.error("admin messages",error);
    list.innerHTML=
      `<div class="admin-empty">Không tải được tin nhắn.</div>`;
    return;
  }

  const userMessages=(data || []).filter(m=>m.sender_role==="user");

  $("adminMessageCount").textContent=userMessages.length;

  if(!userMessages.length){
    list.innerHTML=
      `<div class="admin-empty">Chưa có tin nhắn nào gửi Bông ♡</div>`;
    return;
  }

  list.innerHTML=userMessages.map(m=>{
    const p=Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;

    return `
      <article class="admin-message-card">
        <div class="admin-message-top">
          <div class="admin-message-name">
            ${escapeHTML(p?.display_name || p?.username || "User")}
          </div>

          <div class="admin-message-time">
            ${new Date(m.created_at).toLocaleString("vi-VN")}
          </div>
        </div>

        ${
          p?.username
          ? `<div class="admin-message-time">@${escapeHTML(p.username)}</div>`
          : ""
        }

        <div class="admin-message-text">
          ${escapeHTML(m.body)}
        </div>

        <div class="admin-card-actions">
          <button onclick="markAdminMessageRead('${m.id}')">
            ${m.read_by_admin ? "Đã đọc" : "Đánh dấu đã đọc"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

async function markAdminMessageRead(id){
  if(!sb || !isAdminSession())return;

  const {error}=await sb
    .from("messages")
    .update({read_by_admin:true})
    .eq("id",id);

  if(error){
    showToast("Chưa cập nhật được tin nhắn.");
    return;
  }

  await renderAdminMessages();
}

async function renderAdminCharacters(){
  const list=$("adminCharacterList");
  if(!list || !sb || !isAdminSession())return;

  const {data,error}=await sb
    .from("characters")
    .select(`
      id,
      name,
      category,
      age,
      job,
      location,
      music_file,
      is_published,
      character_pro5 (
        character_id
      )
    `)
    .order("created_at",{ascending:false});

  if(error){
    console.error("admin characters",error);
    list.innerHTML=
      `<div class="admin-empty">Không tải được nhân vật Supabase.</div>`;
    return;
  }

  if(!data?.length){
    list.innerHTML=
      `<div class="admin-empty">Chưa có nhân vật nào được lưu vào Supabase.</div>`;
    return;
  }

  list.innerHTML=data.map(c=>{
    const hasPro5=
      Array.isArray(c.character_pro5)
      ? c.character_pro5.length>0
      : !!c.character_pro5;

    return `
      <article class="admin-character-card">
        <div class="admin-character-top">
          <div>
            <div class="admin-character-name">${escapeHTML(c.name)}</div>
            <div class="admin-character-meta">
              ${escapeHTML(displayCategoryLabel(c.category))} ·
              ${escapeHTML(c.age)} ·
              ${escapeHTML(c.job)}
            </div>
          </div>

          <div class="admin-character-meta">
            ${hasPro5 ? "PRO5 ✓" : "Chưa có PRO5"}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

async function adminAddCharacter(){
  if(!sb || !isAdminSession()){
    setAuthMessage(
      "adminUploadMessage",
      "Chưa có quyền Admin.",
      "error"
    );
    return;
  }

  const name=$("adminName").value.trim();
  const category=$("adminCategory").value;
  const age=$("adminAge").value.trim();
  const job=$("adminJob").value.trim();
  const location=$("adminLocation").value.trim();
  const folder=$("adminFolder").value.trim();
  const music=$("adminMusic").value.trim();
  const ggai=$("adminGgai").value.trim();
  const quote=$("adminQuote").value.trim();
  const background=$("adminBackground").value.trim();
  const opening=$("adminOpening").value.trim();
  const pro5=$("adminPro5")?.value || "";

  const tags=$("adminTags")
    .value
    .split(",")
    .map(x=>x.trim())
    .filter(Boolean)
    .slice(0,5);

  if(!name || !age || !job || !location || !folder){
    setAuthMessage(
      "adminUploadMessage",
      "Ít nhất phải có tên, tuổi, nghề, nơi ở và folder ảnh.",
      "error"
    );
    return;
  }

  let slug=slugify(name);

  const {data:character,error:charError}=await sb
    .from("characters")
    .insert({
      slug,
      name,
      category,
      age,
      job,
      location,
      quote:quote || "Chưa có quote.",
      tags,
      image_folder:folder,
      music_file:music,
      ggai_url:ggai,
      is_published:true,
      created_by:authSession.user.id
    })
    .select("id")
    .single();

  if(charError){
    setAuthMessage(
      "adminUploadMessage",
      `Không lưu được nhân vật: ${charError.message}`,
      "error"
    );
    return;
  }

  const {error:storyError}=await sb
    .from("character_stories")
    .insert({
      character_id:character.id,
      background_story:background,
      opening_scene:opening
    });

  if(storyError){
    setAuthMessage(
      "adminUploadMessage",
      `Đã tạo nhân vật nhưng lỗi story: ${storyError.message}`,
      "error"
    );
    return;
  }

  if(pro5.trim()){
    const {error:pro5Error}=await sb
      .from("character_pro5")
      .insert({
        character_id:character.id,
        content:pro5
      });

    if(pro5Error){
      setAuthMessage(
        "adminUploadMessage",
        `Đã lưu nhân vật/story nhưng lỗi PRO5: ${pro5Error.message}`,
        "error"
      );
      return;
    }
  }

  setAuthMessage(
    "adminUploadMessage",
    "Đã lưu nhân vật + story + PRO5 vào Supabase ♡",
    "success"
  );

  [
    "adminName",
    "adminAge",
    "adminJob",
    "adminLocation",
    "adminFolder",
    "adminMusic",
    "adminGgai",
    "adminTags",
    "adminQuote",
    "adminBackground",
    "adminOpening",
    "adminPro5"
  ].forEach(id=>{
    if($(id))$(id).value="";
  });

  await loadDatabaseCharacters();
  await renderAdminCharacters();
}

async function adminLogout(){
  closeOverlay("adminOverlay");
  await logoutSupabase();
}

/* =========================================================
   INIT
   ========================================================= */

$("chatInput")?.addEventListener("keydown",e=>{
  if(e.key==="Enter")sendChat();
});

$("searchInput")?.addEventListener("input",renderAll);

renderAll();
saveFavorites();
clearChatThreadUI();
updateAuthButton();

initSupabase();


/* =========================================================
   V7 — WELCOME + RANDOM HUSBAND
   ========================================================= */

function initWelcome(){
  const hidden = localStorage.getItem("bongHideWelcome") === "1";

  if(hidden){
    $("welcomeOverlay")?.classList.add("hidden");
  }else{
    $("welcomeOverlay")?.classList.remove("hidden");
  }
}

function enterBongHouse(){
  const dontShow = $("dontShowWelcome")?.checked;

  if(dontShow){
    localStorage.setItem("bongHideWelcome","1");
  }

  $("welcomeOverlay")?.classList.add("hidden");
}

function enterAndRandom(){
  enterBongHouse();

  setTimeout(()=>{
    randomCharacter();
  },180);
}

function resetWelcome(){
  localStorage.removeItem("bongHideWelcome");
  $("welcomeOverlay")?.classList.remove("hidden");
}

function randomCharacter(){
  if(!characters.length){
    showToast("Thư viện chưa có nhân vật nào hết á =)))");
    return;
  }

  const pick = characters[Math.floor(Math.random()*characters.length)];

  const result = $("randomResult");

  if(result){
    result.innerHTML = `Hôm nay là <b>${escapeHTML(pick.name)}</b> ♡`;
    result.classList.remove("show");

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        result.classList.add("show");
      });
    });
  }

  showToast(`🎲 Bông bốc trúng ${pick.name}`);

  setTimeout(()=>{
    openProfile(pick.id);
  },420);
}

initWelcome();


/* =========================================================
   V8 — HERO RANDOM
   ========================================================= */

function randomCharacterFromHero(){
  if(!characters.length){
    showToast("Thư viện chưa có nhân vật nào hết á =)))");
    return;
  }

  const pick=characters[Math.floor(Math.random()*characters.length)];
  const text=$("heroRandomText");

  if(text){
    text.innerHTML=`Hôm nay Bông chọn <strong>${escapeHTML(pick.name)}</strong> cho bạn ♡`;
  }

  showToast(`🎲 Hôm nay là ${pick.name}`);

  setTimeout(()=>{
    openProfile(pick.id);
  },520);
}

/* keep old randomCharacter compatible if another old button calls it */
function randomCharacter(){
  randomCharacterFromHero();
}

/* Welcome V8 only enters the house. No random action here. */
function enterAndRandom(){
  enterBongHouse();
}



/* =========================================================
   V9 — COMMUNITY REVIEWS
   ========================================================= */

async function loadReviewStats(){
  if(!sb)return;

  const {data,error}=await sb
    .from("character_reviews")
    .select(`
      character_key,
      overall,
      love_rating,
      realism_rating,
      chemistry_rating,
      story_rating
    `);

  if(error){
    console.error("review stats",error);
    return;
  }

  const grouped={};

  for(const r of (data || [])){
    if(!grouped[r.character_key]){
      grouped[r.character_key]={
        count:0,
        total:0,
        love:0,
        realism:0,
        chemistry:0,
        story:0
      };
    }

    const g=grouped[r.character_key];
    g.count++;
    g.total+=Number(r.overall || 0);
    g.love+=Number(r.love_rating || 0);
    g.realism+=Number(r.realism_rating || 0);
    g.chemistry+=Number(r.chemistry_rating || 0);
    g.story+=Number(r.story_rating || 0);
  }

  reviewStats={};

  Object.entries(grouped).forEach(([key,g])=>{
    reviewStats[key]={
      count:g.count,
      avg:g.count ? g.total/g.count : 0,
      love:g.count ? g.love/g.count : 0,
      realism:g.count ? g.realism/g.count : 0,
      chemistry:g.count ? g.chemistry/g.count : 0,
      story:g.count ? g.story/g.count : 0
    };
  });

  renderAll();

  if(currentId){
    renderProfileReviewOverview(currentId);
  }
}

function metricBar(label,value){
  const pct=Math.max(0,Math.min(100,(Number(value || 0)/5)*100));

  return `
    <div class="review-metric">
      <span class="review-metric-name">${escapeHTML(label)}</span>
      <div class="review-metric-bar">
        <div class="review-metric-fill" style="width:${pct}%"></div>
      </div>
      <span class="review-metric-score">${Number(value || 0).toFixed(1)}</span>
    </div>
  `;
}

function renderProfileReviewOverview(characterKey){
  const stat=reviewStats[characterKey];

  if(!stat || !stat.count){
    $("profileReviewScore").textContent="—";
    $("profileReviewCount").textContent="Chưa có đánh giá";
    $("profileReviewBreakdown").innerHTML=
      `<div class="review-empty">Chưa đủ dữ liệu để chấm điểm.</div>`;
    return;
  }

  $("profileReviewScore").textContent=stat.avg.toFixed(1);
  $("profileReviewCount").textContent=
    `${stat.count} đánh giá`;

  $("profileReviewBreakdown").innerHTML=
    metricBar("Cách yêu",stat.love)+
    metricBar("Độ chân thật",stat.realism)+
    metricBar("Chemistry",stat.chemistry)+
    metricBar("Cốt truyện",stat.story);
}

async function loadCharacterReviews(characterKey){
  renderProfileReviewOverview(characterKey);

  if(!sb){
    return;
  }

  const {data,error}=await sb
    .from("character_reviews")
    .select(`
      id,
      user_id,
      reviewer_name,
      love_rating,
      realism_rating,
      chemistry_rating,
      story_rating,
      overall,
      comment,
      tips,
      improvement,
      admin_reply,
      admin_reply_at,
      created_at,
      updated_at
    `)
    .eq("character_key",characterKey)
    .order("created_at",{ascending:false})
    .limit(30);

  if(error){
    console.error("reviews fetch",error);
    $("profileReviewList").innerHTML=
      `<div class="review-empty">Chưa tải được review.</div>`;
    return;
  }

  currentProfileReviews=data || [];
  renderPublicReviewList();

  myCurrentReview=
    authSession?.user
    ? currentProfileReviews.find(r=>r.user_id===authSession.user.id) || null
    : null;
}

function renderPublicReviewList(){
  const list=$("profileReviewList");

  if(!list)return;

  if(!currentProfileReviews.length){
    list.innerHTML=
      `<div class="review-empty">Chưa có ai review anh này hết á =)))</div>`;
    return;
  }

  list.innerHTML=currentProfileReviews.map(r=>{
    const comment=r.comment?.trim();
    const tips=r.tips?.trim();
    const improvement=r.improvement?.trim();

    return `
      <article class="public-review-card">
        <div class="public-review-top">
          <div>
            <div class="public-review-name">${escapeHTML(r.reviewer_name || "Người dùng")}</div>
            <div class="public-review-date">
              ${new Date(r.created_at).toLocaleDateString("vi-VN")}
            </div>
          </div>

          <div class="public-review-score">
            ♥ ${Number(r.overall).toFixed(1)}/5
          </div>
        </div>

        <div class="public-review-metrics">
          <span class="public-review-chip">Cách yêu ${r.love_rating}/5</span>
          <span class="public-review-chip">Chân thật ${r.realism_rating}/5</span>
          <span class="public-review-chip">Chemistry ${r.chemistry_rating}/5</span>
          <span class="public-review-chip">Cốt truyện ${r.story_rating}/5</span>
        </div>

        ${
          comment
          ? `<div class="public-review-text">${escapeHTML(comment)}</div>`
          : ""
        }

        ${
          tips
          ? `<div class="public-review-extra"><strong>Tips:</strong> ${escapeHTML(tips)}</div>`
          : ""
        }

        ${
          improvement
          ? `<div class="public-review-extra"><strong>Mong Bông cải thiện:</strong> ${escapeHTML(improvement)}</div>`
          : ""
        }

        ${
          (r.admin_reply || "").trim()
          ? `<div class="public-review-reply">
              <div class="public-review-reply-head">🌸 Bông trả lời${r.admin_reply_at ? ` · ${new Date(r.admin_reply_at).toLocaleDateString("vi-VN")}` : ""}</div>
              <div class="public-review-reply-text">${escapeHTML(r.admin_reply)}</div>
            </div>`
          : ""
        }
      </article>
    `;
  }).join("");
}

function resetReviewDraft(){
  reviewDraft={
    love_rating:5,
    realism_rating:5,
    chemistry_rating:5,
    story_rating:5
  };

  $("reviewComment").value="";
  $("reviewTips").value="";
  $("reviewImprovement").value="";
  setAuthMessage("reviewMessage","");
}

async function openReviewModal(){
  if(!backendReady || !authSession?.user){
    showToast("Đăng nhập trước rồi review nha ♡");
    openAuth();
    return;
  }

  const c=findChar(currentId);

  if(!c)return;

  $("reviewCharacterName").textContent=c.name;

  resetReviewDraft();

  $("playedQuestion").classList.remove("hidden");
  $("reviewForm").classList.add("hidden");
  $("reviewNotPlayed").classList.add("hidden");
  $("reviewDeleteButton").classList.add("hidden");

  const {data,error}=await sb
    .from("character_reviews")
    .select("*")
    .eq("character_key",currentId)
    .eq("user_id",authSession.user.id)
    .maybeSingle();

  if(!error && data){
    myCurrentReview=data;

    reviewDraft={
      love_rating:data.love_rating,
      realism_rating:data.realism_rating,
      chemistry_rating:data.chemistry_rating,
      story_rating:data.story_rating
    };

    $("reviewComment").value=data.comment || "";
    $("reviewTips").value=data.tips || "";
    $("reviewImprovement").value=data.improvement || "";
    $("reviewDeleteButton").classList.remove("hidden");

    setPlayedStatus(true,false);
  }else{
    myCurrentReview=null;
  }

  $("reviewOverlay").classList.add("show");
  renderHeartPickers();
}

function setPlayedStatus(played,rerender=true){
  $("playedQuestion").classList.add("hidden");

  if(!played){
    $("reviewForm").classList.add("hidden");
    $("reviewNotPlayed").classList.remove("hidden");
    return;
  }

  $("reviewNotPlayed").classList.add("hidden");
  $("reviewForm").classList.remove("hidden");

  if(rerender){
    renderHeartPickers();
  }
}

function renderHeartPickers(){
  document.querySelectorAll(".heart-picker").forEach(container=>{
    const field=container.dataset.field;
    const value=Number(reviewDraft[field] || 5);

    container.innerHTML=[1,2,3,4,5].map(n=>`
      <button
        type="button"
        class="heart-rate-btn ${n<=value ? "active" : ""}"
        onclick="setReviewRating('${field}',${n})"
        aria-label="${n}/5"
      >♥</button>
    `).join("");
  });

  updateReviewLiveScore();
}

function setReviewRating(field,value){
  reviewDraft[field]=value;
  renderHeartPickers();
}

function updateReviewLiveScore(){
  const values=[
    reviewDraft.love_rating,
    reviewDraft.realism_rating,
    reviewDraft.chemistry_rating,
    reviewDraft.story_rating
  ].map(Number);

  const avg=values.reduce((a,b)=>a+b,0)/values.length;

  $("reviewLiveScore").textContent=avg.toFixed(1);
}

async function submitReview(){
  if(!sb || !authSession?.user){
    showToast("Đăng nhập trước nha.");
    return;
  }

  const reviewerName=
    currentProfile?.display_name ||
    currentProfile?.username ||
    "Người dùng";

  const payload={
    character_key:currentId,
    user_id:authSession.user.id,
    reviewer_name:reviewerName,
    played:true,
    love_rating:Number(reviewDraft.love_rating),
    realism_rating:Number(reviewDraft.realism_rating),
    chemistry_rating:Number(reviewDraft.chemistry_rating),
    story_rating:Number(reviewDraft.story_rating),
    comment:$("reviewComment").value.trim(),
    tips:$("reviewTips").value.trim(),
    improvement:$("reviewImprovement").value.trim()
  };

  setAuthMessage("reviewMessage","Đang lưu review...");

  const {error}=await sb
    .from("character_reviews")
    .upsert(payload,{
      onConflict:"user_id,character_key"
    });

  if(error){
    console.error("review upsert",error);
    setAuthMessage(
      "reviewMessage",
      `Chưa lưu được review: ${error.message}`,
      "error"
    );
    return;
  }

  setAuthMessage("reviewMessage","Đã đăng đánh giá ♡","success");

  await loadReviewStats();
  await loadCharacterReviews(currentId);

  setTimeout(()=>{
    closeOverlay("reviewOverlay");
    showToast("Review lên sóng rồi ♡");
  },450);
}

async function deleteMyReview(){
  if(!sb || !authSession?.user || !currentId)return;

  if(!confirm("Xóa review của bạn cho nhân vật này nha?")){
    return;
  }

  const {error}=await sb
    .from("character_reviews")
    .delete()
    .eq("character_key",currentId)
    .eq("user_id",authSession.user.id);

  if(error){
    setAuthMessage(
      "reviewMessage",
      "Chưa xóa được review.",
      "error"
    );
    return;
  }

  myCurrentReview=null;
  closeOverlay("reviewOverlay");
  await loadReviewStats();
  await loadCharacterReviews(currentId);
  showToast("Đã xóa review.");
}

/* ADMIN REVIEWS */

async function renderAdminReviews(){
  const list=$("adminReviewsList");

  if(!list || !sb || !isAdminSession())return;

  const {data,error}=await sb
    .from("character_reviews")
    .select(`
      id,
      character_key,
      reviewer_name,
      overall,
      love_rating,
      realism_rating,
      chemistry_rating,
      story_rating,
      comment,
      tips,
      improvement,
      admin_reply,
      admin_reply_at,
      created_at
    `)
    .order("created_at",{ascending:false})
    .limit(300);

  if(error){
    console.error("admin reviews",error);
    list.innerHTML=
      `<div class="admin-empty">Không tải được đánh giá.</div>`;
    return;
  }

  $("adminReviewCount").textContent=data?.length || 0;

  if(!data?.length){
    list.innerHTML=
      `<div class="admin-empty">Chưa có review nào ♡</div>`;
    return;
  }

  list.innerHTML=data.map(r=>{
    const c=findChar(r.character_key);
    const characterName=c?.name || r.character_key;

    return `
      <article class="admin-message-card">
        <div class="admin-message-top">
          <div>
            <div class="admin-message-name">${escapeHTML(r.reviewer_name || "Người dùng")}</div>
            <div class="admin-review-character">${escapeHTML(characterName)} · ♥ ${Number(r.overall).toFixed(1)}/5</div>
          </div>

          <div class="admin-message-time">
            ${new Date(r.created_at).toLocaleString("vi-VN")}
          </div>
        </div>

        <div class="admin-review-grid">
          <span class="public-review-chip">Yêu ${r.love_rating}</span>
          <span class="public-review-chip">Thật ${r.realism_rating}</span>
          <span class="public-review-chip">Chemistry ${r.chemistry_rating}</span>
          <span class="public-review-chip">Story ${r.story_rating}</span>
        </div>

        ${
          r.comment
          ? `<div class="admin-message-text">${escapeHTML(r.comment)}</div>`
          : ""
        }

        ${
          r.tips
          ? `<div class="public-review-extra"><strong>Tips:</strong> ${escapeHTML(r.tips)}</div>`
          : ""
        }

        ${
          r.improvement
          ? `<div class="public-review-extra"><strong>Góp ý:</strong> ${escapeHTML(r.improvement)}</div>`
          : ""
        }

        <div class="admin-review-reply-box">
          <label class="admin-reply-label">Trả lời review này</label>
          <textarea class="admin-reply-textarea" id="adminReply_${r.id}" placeholder="Viết phản hồi của Bông cho review này...">${escapeHTML(r.admin_reply || "")}</textarea>
          <div class="admin-reply-meta">${r.admin_reply_at ? `Đã trả lời: ${new Date(r.admin_reply_at).toLocaleString("vi-VN")}` : `Chưa có phản hồi từ Bông.`}</div>
        </div>

        <div class="admin-card-actions">
          <button onclick="adminReplyReview('${r.id}')">Lưu phản hồi</button>
          <button onclick="adminDeleteReview('${r.id}')">Xóa review</button>
        </div>
      </article>
    `;
  }).join("");
}

async function adminReplyReview(id){
  if(!sb || !isAdminSession())return;

  const el=$("adminReply_"+id);
  if(!el)return;

  const reply=(el.value || "").trim();
  if(reply.length>1200){
    showToast("Phản hồi tối đa 1200 ký tự nha.");
    return;
  }

  const payload={
    admin_reply: reply,
    admin_reply_at: reply ? new Date().toISOString() : null
  };

  const {error}=await sb
    .from("character_reviews")
    .update(payload)
    .eq("id",id);

  if(error){
    console.error("admin reply review",error);
    showToast("Chưa lưu được phản hồi.");
    return;
  }

  showToast(reply ? "Đã lưu phản hồi của Bông." : "Đã xóa phản hồi.");
  await renderAdminReviews();
  if(currentId){
    await loadCharacterReviews(currentId);
  }
}

async function adminDeleteReview(id){
  if(!sb || !isAdminSession())return;

  if(!confirm("Xóa review này khỏi cộng đồng?")){
    return;
  }

  const {error}=await sb
    .from("character_reviews")
    .delete()
    .eq("id",id);

  if(error){
    showToast("Chưa xóa được review.");
    return;
  }

  showToast("Đã xóa review.");
  await renderAdminReviews();
  await loadReviewStats();

  if(currentId){
    await loadCharacterReviews(currentId);
  }
}


/* =========================================================
   V10 — CHARACTER LINK WAITLIST + EMAIL NOTIFICATIONS
   ========================================================= */
async function loadCharacterLinks(){
  if(!sb)return;
  const {data,error}=await sb.from("character_links").select("character_key,ggai_url");
  if(error){console.error("character links",error);return;}
  characterLinkOverrides={};
  for(const row of (data || [])){
    characterLinkOverrides[row.character_key]=row.ggai_url;
    const c=findChar(row.character_key);
    if(c && row.ggai_url)c.ggai=row.ggai_url;
  }
  renderAll();
}

async function loadNotificationCounts(){
  if(!sb)return;
  const {data,error}=await sb.rpc("get_character_notification_counts");
  if(error){console.error("notification counts",error);return;}
  notificationCounts={};
  for(const row of (data || []))notificationCounts[row.character_key]=Number(row.waiting_count || 0);
  renderAll();
}

function handleGgaiAction(){
  const c=findChar(currentId);if(!c)return;
  if(c.ggai){window.open(c.ggai,"_blank","noopener");return;}
  openNotifyModal();
}

async function openNotifyModal(){
  if(!authSession?.user){showToast("Đăng nhập trước rồi Bông mới nhớ email được nha ♡");openAuth();return;}
  const c=findChar(currentId);if(!c)return;
  $("notifyCharacterName").textContent=c.name;
  setAuthMessage("notifyMessage","");
  $("notifyEmail").disabled=false;
  $("notifySubscribeButton").classList.remove("hidden");
  $("notifyUnsubscribeButton").classList.add("hidden");
  const remembered=localStorage.getItem("bongNotifyEmail") || "";
  $("notifyEmail").value=remembered;
  const {data,error}=await sb.from("character_notifications").select("id,email,notified_at").eq("character_key",currentId).eq("user_id",authSession.user.id).maybeSingle();
  if(!error && data){
    myNotificationSubscription=data;
    $("notifyEmail").value=data.email || remembered;
    $("notifySubscribeButton").textContent="✓ Đã đăng ký";
    $("notifyUnsubscribeButton").classList.remove("hidden");
  }else{
    myNotificationSubscription=null;
    $("notifySubscribeButton").textContent="🔔 Báo tui khi có link";
  }
  $("notifyOverlay").classList.add("show");
}

function validNotifyEmail(email){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);}

async function subscribeCharacterLink(){
  if(!sb || !authSession?.user){showToast("Đăng nhập trước nha.");return;}
  const email=$("notifyEmail").value.trim().toLowerCase();
  if(!validNotifyEmail(email)){setAuthMessage("notifyMessage","Email chưa đúng định dạng á.","error");return;}
  localStorage.setItem("bongNotifyEmail",email);
  setAuthMessage("notifyMessage","Đang lưu...");
  const {error}=await sb.from("character_notifications").upsert({character_key:currentId,user_id:authSession.user.id,email,notified_at:null},{onConflict:"user_id,character_key"});
  if(error){setAuthMessage("notifyMessage",`Chưa đăng ký được: ${error.message}`,"error");return;}
  setAuthMessage("notifyMessage","Đã đăng ký ♡ Có link Bông sẽ báo mail.","success");
  $("notifySubscribeButton").textContent="✓ Đã đăng ký";
  $("notifyUnsubscribeButton").classList.remove("hidden");
  await loadNotificationCounts();
}

async function unsubscribeCharacterLink(){
  if(!sb || !authSession?.user)return;
  const {error}=await sb.from("character_notifications").delete().eq("character_key",currentId).eq("user_id",authSession.user.id);
  if(error){setAuthMessage("notifyMessage","Chưa hủy được đăng ký.","error");return;}
  myNotificationSubscription=null;
  $("notifySubscribeButton").textContent="🔔 Báo tui khi có link";
  $("notifyUnsubscribeButton").classList.add("hidden");
  setAuthMessage("notifyMessage","Đã hủy đăng ký thông báo.","success");
  await loadNotificationCounts();
}

async function renderAdminLinks(){
  if(!isAdminSession())return;
  const select=$("adminNotifyCharacter");if(!select)return;
  await loadNotificationCounts();
  const sorted=[...characters].sort((a,b)=>a.name.localeCompare(b.name,"vi"));
  select.innerHTML=sorted.map(c=>`<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join("");
  syncAdminNotifyInfo();
}

function syncAdminNotifyInfo(){
  const id=$("adminNotifyCharacter")?.value;
  const c=findChar(id);if(!c)return;
  const count=Number(notificationCounts[id] || 0);
  $("adminNotifyUrl").value=c.ggai || "";
  $("adminNotifySummary").innerHTML=`<strong>${escapeHTML(c.name)}</strong><br>🔔 ${count} người đang chờ link${c.ggai ? `<br>Link hiện tại: ${escapeHTML(c.ggai)}` : `<br>Chưa có link GGAI.`}`;
}

async function publishCharacterLinkAndNotify(){
  if(!sb || !isAdminSession())return;
  const characterKey=$("adminNotifyCharacter").value;
  const c=findChar(characterKey);
  const ggaiUrl=$("adminNotifyUrl").value.trim();
  if(!c || !ggaiUrl.startsWith("http")){setAuthMessage("adminNotifyMessage","Điền link GGAI hợp lệ trước nha.","error");return;}
  setAuthMessage("adminNotifyMessage","Đang đăng link và gửi thông báo...");
  const {data:{session}}=await sb.auth.getSession();
  if(!session){setAuthMessage("adminNotifyMessage","Session Admin hết hạn, đăng nhập lại nha.","error");return;}
  const endpoint=`${window.BONG_SUPABASE_CONFIG.url}/functions/v1/notify-character-link`;
  const response=await fetch(endpoint,{method:"POST",headers:{"Authorization":`Bearer ${session.access_token}`,"apikey":window.BONG_SUPABASE_CONFIG.anonKey,"Content-Type":"application/json"},body:JSON.stringify({characterKey,characterName:c.name,ggaiUrl})});
  let result={};try{result=await response.json();}catch{}
  if(!response.ok){setAuthMessage("adminNotifyMessage",result.error || "Edge Function chưa chạy được.","error");return;}
  c.ggai=ggaiUrl;characterLinkOverrides[characterKey]=ggaiUrl;
  await loadCharacterLinks();await loadNotificationCounts();
  if(result.emailConfigured===false){
    setAuthMessage("adminNotifyMessage",`Đã lưu link ♡ Có ${result.pending || 0} người đang chờ, nhưng Resend chưa được cấu hình nên chưa gửi mail.`,"success");
  }else{
    setAuthMessage("adminNotifyMessage",`Xong ♡ Đã gửi ${result.notified || 0} email${result.failed ? `, lỗi ${result.failed}` : ""}.`,"success");
  }
  syncAdminNotifyInfo();
}
