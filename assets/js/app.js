
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
  if(!$("profileFav"))return;
  $("profileFav").textContent=
    saved.has(currentId) ? "♥ Đã lưu" : "♡ Lưu nhân vật";
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

function cardHTML(c){
  return `
    <article class="card">
      <div class="card-photo-wrap">
        <img
          class="card-photo"
          src="${imgPath(c,"profile.jpg")}"
          alt="${escapeHTML(c.name)}"
          onerror="fallbackImage(this)"
        >

        <span class="category-badge">${escapeHTML(c.category)}</span>

        <button
          class="fav-btn ${saved.has(c.id) ? "saved" : ""}"
          onclick="toggleFavorite('${c.id}')"
        >
          ${saved.has(c.id) ? "♥" : "♡"}
        </button>
      </div>

      <div class="card-body">
        <h3>${escapeHTML(c.name)}</h3>
        ${metaHTML(c)}
        ${tagHTML(c.tags || [])}

        ${cardRatingHTML(c.id)}

        <p class="quote" style="margin-top:12px">
          ${escapeHTML(c.quote || "")}
        </p>

        <div class="card-actions">
          <button class="profile-btn" onclick="openProfile('${c.id}')">
            Xem hồ sơ
          </button>

          <button class="story-btn" onclick="openReader('${c.id}','background')">
            Đọc truyện
          </button>
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

  $("profileName").textContent=c.name;
  $("profileSub").textContent=c.category;
  $("profileQuote").textContent=c.quote || "";
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
    ggai.href=c.ggai;
    ggai.textContent="Mở GGAI ↗";
    ggai.classList.remove("disabled");
  }else{
    ggai.href="#";
    ggai.textContent="GGAI sẽ thêm sau";
    ggai.classList.add("disabled");
  }

  updateProfileFavorite();
  $("profileOverlay").classList.add("show");
  playCharacterMusic(id);
  loadCharacterReviews(id);
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
}

function switchAdminTab(tab,button){
  ["messages","characters","reviews","upload"].forEach(x=>{
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
              ${escapeHTML(c.category)} ·
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

        <div class="admin-card-actions">
          <button onclick="adminDeleteReview('${r.id}')">Xóa review</button>
        </div>
      </article>
    `;
  }).join("");
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
