/* ===== 見た目（スキン・文字・角の丸み・密度・アイコン）。台帳Z-186 =====
   UIの一時設定：作品・Undo・保存には入れず、localStorage（am_skin）にだけ覚える。
   CSSは styles.css 先頭の変数（--rk 角の丸み／--bw 枠線／--dp 余白／--fw 太字／--font／--ei 絵文字）。<html> の data-skin／font／round／dens／icon に反映する（'auto'＝属性なし＝スキンまかせ）。
   ちらつき防止のため、同じ読み込みを document-prefix.html の先頭でも行う（ここは画面の部品とつなぐ側）。
   増やす時：SKIN.T の表に1行足し、styles.css に :root[data-…="…"]{…} を1行足す。 */
const SKIN={
  LS:'am_skin',
  T:{
    skin:[['auto','自動（端末の明暗に合わせる）'],['light','ライト'],['dark','ダーク'],['graphite','グラファイト'],['paper','ペーパー'],['contrast','ハイコントラスト'],['pop','ポップ（従来の見た目）']],
    font:[['auto','テーマに合わせる'],['gothic','ゴシック'],['maru','丸ゴシック'],['serif','明朝']],
    round:[['auto','テーマに合わせる'],['sharp','角ばる'],['soft','ふつう'],['round','丸い']],
    dens:[['auto','テーマに合わせる'],['compact','コンパクト'],['std','ふつう'],['comfy','ゆったり']],
    icon:[['auto','テーマに合わせる'],['color','カラー絵文字'],['mono','単色']]},
  IDS:{skin:['skS','skq'],font:['skF'],round:['skR'],dens:['skD'],icon:['skI']},   /* 設定 → それを操作する<select>（背景・出力タブと👁メニューの2か所） */
  cur:{skin:'auto',font:'auto',round:'auto',dens:'auto',icon:'auto'}};
const skinOk=(k,v)=>!!SKIN.T[k]&&SKIN.T[k].some(x=>x[0]===v);
function skinRead(){try{const o=JSON.parse(localStorage.getItem(SKIN.LS)||'null');if(o&&typeof o==='object')for(const k in SKIN.T)if(skinOk(k,o[k]))SKIN.cur[k]=o[k]}catch(_){}}
/* 丸ゴシック（Zen Maru Gothic）は、使う時だけ読み込む（既定の見た目では外部へ通信しない）。早い読み込み（document-prefix.html）と同じ条件 */
function skinFont(){const c=SKIN.cur,need=c.font==='maru'||(c.skin==='pop'&&c.font==='auto');
  if(need&&!document.getElementById('amfont')){const l=document.createElement('link');l.rel='stylesheet';l.id='amfont';l.href='https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;900&display=swap';document.head.appendChild(l)}}
function skinApply(){const r=document.documentElement;for(const k in SKIN.T){const v=SKIN.cur[k];if(v&&v!=='auto')r.setAttribute('data-'+k,v);else r.removeAttribute('data-'+k)}skinFont()}
function skinSave(){try{if(Object.values(SKIN.cur).every(v=>v==='auto'))localStorage.removeItem(SKIN.LS);else localStorage.setItem(SKIN.LS,JSON.stringify(SKIN.cur))}catch(_){}}
function skinUi(){for(const k in SKIN.IDS)for(const id of SKIN.IDS[k]){const e=$(id);if(e&&e.value!==SKIN.cur[k])e.value=SKIN.cur[k]}
  const rs=$('skRst');if(rs)rs.disabled=Object.values(SKIN.cur).every(v=>v==='auto')}
function skinSet(k,v){
  if(!skinOk(k,v))return false;SKIN.cur[k]=v;skinApply();skinSave();skinUi();
  try{fit();tpClamp()}catch(_){}   /* 密度・文字で枠の高さが変わるので、キャンバスと操作窓の位置を合わせ直す */
  return true}
function skinReset(){for(const k in SKIN.cur)SKIN.cur[k]='auto';skinApply();skinSave();skinUi();try{fit();tpClamp()}catch(_){}}
function skinInit(){
  for(const k in SKIN.IDS)for(const id of SKIN.IDS[k]){const e=$(id);if(!e)continue;
    if(!e.options.length)for(const[v,t]of SKIN.T[k]){const o=document.createElement('option');o.value=v;o.textContent=t;e.appendChild(o)}
    e.onchange=()=>skinSet(k,e.value)}
  const rs=$('skRst');if(rs)rs.onclick=skinReset;
  skinRead();skinApply();skinUi()}
skinInit();
