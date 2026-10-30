/* ===== ビジュアルプログラミングの試作（コンソールの中。台帳Z-231。2026-10-30）=====
   目的：ビューワー（部品を置いた画面）と、その中のスクリプト（規則）が、Chromeの開発者ツール（F12）のように、対応して見えること。
   最初の到達点：メモ帳のようなテキストエディタを、この仕組み（部品＋規則）だけで組めること（見本＝VPR.sample()）。
   ・左＝ビューワー（部品を実際に動かす／「調べる」で、押した部品を選ぶ）。右＝スクリプト（文／コード）。
   ・対応の表示：部品を選ぶ→それを使う行が光る。行を押す→その行が使う部品が光る。動かすと、実行された行と変わった部品が一瞬光り、下に記録が出る。
   ・スクリプトは「コード」で編集できる（JSON。反映すると、すぐ動作が変わる）。書き換えたスクリプトは、この端末にだけ覚える。
   ・規則の評価は VPR（2465-vp-rules.js。画面に触れない）。ここは画面だけ。部品の種類は VPK の表に1項目足せば増える。
   ・コンソールの決まり：本体の作品・Undo・保存（snap／ser／US／AC／LAYERS／DOC）には触れない。保存先は `am_vplab*` だけ（メモ帳の `am_memo` にも触れない）。
   ・ユーザーが書いた名前や文字は、必ず textContent で出す（HTMLとして解釈しない）。 */
const VPL={LS:'am_vplab',LSS:'am_vplab_s_',LSB:'am_vplab_bad',prog:null,S:{},R:{},K:{},el:null,mode:'run',view:'text',editing:false,selPart:null,selLine:null,log:[],started:false};
const vplLs={get(k){try{return localStorage.getItem(k)}catch(_){return null}},set(k,v){try{localStorage.setItem(k,v);return true}catch(_){return false}},del(k){try{localStorage.removeItem(k)}catch(_){}}};
const vplQ=s=>VPL.el&&VPL.el.querySelector(s);
const vplMk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
const vplShort=v=>{const s=String(v==null?'':v).replace(/\n/g,'⏎');return s.length>24?s.slice(0,24)+'…':s};
const vplName=id=>{const p=VPL.prog.parts.find(x=>x&&x.id===id);return p?(p.name||p.id):null};

/* 部品の種類の表。mount(箱,部品,状態,知らせる)→描き直す関数。1項目足せば、新しい部品が使える */
const VPK={
  label:{name:'文字の表示',mount(box,p,S){const d=vplMk('div','vplabel'+(S.strong?' vpstrong':''));box.appendChild(d);return()=>{d.textContent=S.text==null?'':String(S.text);box.hidden=!!S.hidden}}},
  button:{name:'ボタン',mount(box,p,S,emit){const b=vplMk('button');b.type='button';b.onclick=()=>emit({type:'click',target:p.id});box.appendChild(b);return()=>{b.textContent=S.label==null?'':String(S.label);b.disabled=!!S.disabled;box.hidden=!!S.hidden}}},
  textarea:{name:'文字の入力欄',mount(box,p,S,emit){const t=vplMk('textarea');t.spellcheck=false;t.autocomplete='off';t.setAttribute('aria-label',p.name||p.id);
    t.oninput=()=>{S.text=t.value;emit({type:'change',target:p.id})};box.appendChild(t);
    return()=>{const v=S.text==null?'':String(S.text);if(t.value!==v)t.value=v;t.placeholder=S.placeholder||'';t.disabled=!!S.disabled;box.hidden=!!S.hidden}}}
};

/* 部品の世界（VPRに渡す）。状態は VPL.S[id]、描き直しは VPL.R[id] */
const vplWorld={
  has:id=>Object.prototype.hasOwnProperty.call(VPL.S,id),
  get:(id,k)=>VPL.S[id][k],
  set:(id,k,v)=>{VPL.S[id][k]=v;const r=VPL.R[id];if(r)r()},
  store:{get:k=>vplLs.get(VPL.LSS+k),set:(k,v)=>vplLs.set(VPL.LSS+k,v)}
};

/* ---- 読み込み・保存（スクリプトだけ。部品の状態は保存しない） ---- */
function vplLoadProg(){
  const raw=vplLs.get(VPL.LS);let o=null;
  if(raw){
    try{o=JSON.parse(raw);if(VPR.validate(o).errs.length)throw 0}
    catch(_){vplLs.set(VPL.LSB,raw);o=null}   /* 読めない中身は、消さずに別のキーへ残す */
  }
  VPL.prog=o||VPR.sample();
}
const vplSaveProg=()=>vplLs.set(VPL.LS,JSON.stringify(VPL.prog));

/* ---- ビューワー（部品を並べる） ---- */
function vplBuild(keep){
  const root=vplQ('#vpView');root.innerHTML='';
  const oldS=VPL.S,oldK=VPL.K;VPL.S={};VPL.R={};VPL.K={};
  for(const p of VPL.prog.parts){
    if(!p||typeof p.id!=='string')continue;
    const box=vplMk('div','vpp');box.dataset.part=p.id;box.dataset.kind=String(p.kind||'');
    const st=Object.assign({},p.props||{});
    if(keep&&oldS[p.id]&&oldK[p.id]===p.kind)Object.assign(st,oldS[p.id]);   /* 書き換えた後も、同じ部品なら今の値を残す */
    VPL.S[p.id]=st;VPL.K[p.id]=p.kind;
    const tag=vplMk('span','vptag',p.id);box.appendChild(tag);
    if(VPK[p.kind]){const r=VPK[p.kind].mount(box,p,st,vplEmit);VPL.R[p.id]=r;r()}
    else box.appendChild(vplMk('div','vplabel','（未対応の部品：'+String(p.kind)+'）'));
    root.appendChild(box);
  }
  vplInert();
}
/* 「調べる」の間は、部品の中身を動かせない（押す・フォーカス・キー入力）。部品の箱だけが押せる */
function vplInert(){
  const on=VPL.mode==='insp';
  for(const c of vplQ('#vpView').querySelectorAll('.vpp>*:not(.vptag)'))c.inert=on;
}

/* ---- 入力を受けて動かす・光らせる・記録する ---- */
function vplEmit(ev){
  let tr;
  try{tr=VPR.dispatch(VPL.prog,ev,vplWorld)}
  catch(e){vplMsg('動かせませんでした：'+(e&&e.message||e),1);return}
  vplFlash(tr);vplLogAdd(ev,tr);vplInfo();
}
function vplFl(el,cls){if(!el)return;cls=cls||'vpfl';el.classList.remove('vpfl','vpng');void el.offsetWidth;el.classList.add(cls);clearTimeout(el._vt);el._vt=setTimeout(()=>el.classList.remove('vpfl','vpng'),1000)}
function vplFlash(tr){
  const lines=[...vplQ('#vpScript').querySelectorAll('.vpl')],boxes=[...vplQ('#vpView').querySelectorAll('.vpp')];
  for(const r of tr){
    const ncond=(VPL.prog.rules.find(x=>x&&x.id===r.rule)||{}).if;
    const nc=Array.isArray(ncond)?ncond.length:0,lastIf=r.ifOk?nc-1:r.failIdx;
    for(const l of lines){
      if(l.dataset.rule!==r.rule)continue;
      const s=l.dataset.sec,i=l.dataset.i===''||l.dataset.i==null?-1:+l.dataset.i;
      if(s==='head'||s==='on')vplFl(l);
      else if(s==='if'&&i>=0&&i<=lastIf)vplFl(l,r.ifOk||i<lastIf?'vpfl':'vpng');
      else if(s==='do'&&i>=0){const a=r.acts[i];if(a)vplFl(l,a.ok?'vpfl':'vpng')}
    }
    for(const a of r.acts)for(const id of a.touched)for(const b of boxes)if(b.dataset.part===id)vplFl(b);
  }
}
function vplEvText(e){
  const n=id=>{const s=vplName(id);return '「'+(s==null?id:s)+'」'};
  return e.type==='start'?'始まった':e.type==='click'?n(e.target)+'を押した':e.type==='change'?n(e.target)+'が書き換えられた':String(e.type);
}
function vplLogAdd(ev,tr){
  let t=vplEvText(ev)+' → ';
  if(!tr.length)t+='合う規則なし';
  else t+=tr.map(r=>{
    if(!r.ifOk)return r.rule+'：'+(r.why||'条件が合わず、何もしない');
    const bad=r.acts.find(a=>!a.ok);
    return r.rule+'：'+(bad?'動作'+(bad.i+1)+'で止まった（'+bad.why+'）':'動作'+r.acts.length+'件を実行');
  }).join('　／　');
  VPL.log.unshift(t);if(VPL.log.length>10)VPL.log.length=10;
  const box=vplQ('#vpLog');box.innerHTML='';box.appendChild(vplMk('b','',(VPL.log.length?'実行の記録（新しい順）':'')));
  for(const s of VPL.log)box.appendChild(vplMk('div','',s));
}

/* ---- スクリプトの行（文／コード）。各行＝{k?,t,rule?,sec?,i?,parts,part?,cls?} ---- */
function vplTextLines(prog){
  const L=[],N=vplName;
  prog.rules.forEach(r=>{
    const all=VPR.targets(r);
    L.push({t:r.id+(r.label?' ・ '+r.label:'')+(r.off===true?'（止めてある）':''),rule:r.id,sec:'head',parts:all,cls:'vprh'});
    L.push({k:'いつ',t:VPR.doc('on',r.on,N),rule:r.id,sec:'on',parts:VPR.stepTargets('on',r.on)});
    (Array.isArray(r.if)?r.if:[]).forEach((c,i)=>L.push({k:'もし',t:VPR.doc('if',c,N),rule:r.id,sec:'if',i,parts:VPR.stepTargets('if',c)}));
    (Array.isArray(r.do)?r.do:[]).forEach((a,i)=>L.push({k:'なら',t:(i+1)+'. '+VPR.doc('do',a,N),rule:r.id,sec:'do',i,parts:VPR.stepTargets('do',a)}));
  });
  return L;
}
/* コードの行。つなげると、そのまま読み戻せるJSONになる（反映の元） */
function vplCodeLines(prog){
  const L=[],J=JSON.stringify,ind=n=>'  '.repeat(n),add=(t,m)=>L.push(Object.assign({t,parts:[]},m||{}));
  const keys=Object.keys(prog);
  add('{');
  keys.forEach((k,ki)=>{
    const c=ki<keys.length-1?',':'';
    if(k==='parts'&&Array.isArray(prog.parts)){
      add(ind(1)+'"parts": [');
      prog.parts.forEach((p,i)=>add(ind(2)+J(p)+(i<prog.parts.length-1?',':''),{sec:'part',part:p&&p.id,parts:p&&typeof p.id==='string'?[p.id]:[]}));
      add(ind(1)+']'+c);
    }else if(k==='rules'&&Array.isArray(prog.rules)){
      add(ind(1)+'"rules": [');
      prog.rules.forEach((r,ri)=>{
        const rk=Object.keys(r),m={rule:r.id};
        add(ind(2)+'{',Object.assign({sec:'head',parts:VPR.targets(r)},m));
        rk.forEach((key,j)=>{
          const cc=j<rk.length-1?',':'';
          if((key==='if'||key==='do')&&Array.isArray(r[key])&&r[key].length){
            const un=[];r[key].forEach(x=>{for(const id of VPR.stepTargets(key,x))if(!un.includes(id))un.push(id)});
            add(ind(3)+J(key)+': [',Object.assign({sec:key==='if'?'ifh':'doh',parts:un},m));
            r[key].forEach((x,i)=>add(ind(4)+J(x)+(i<r[key].length-1?',':''),Object.assign({sec:key,i,parts:VPR.stepTargets(key,x)},m)));
            add(ind(3)+']'+cc,Object.assign({sec:'close'},m));
          }else add(ind(3)+J(key)+': '+J(r[key])+cc,Object.assign({sec:key==='on'?'on':'etc',parts:key==='on'?VPR.stepTargets('on',r.on):[]},m));
        });
        add(ind(2)+'}'+(ri<prog.rules.length-1?',':''),Object.assign({sec:'close'},m));
      });
      add(ind(1)+']'+c);
    }else add(ind(1)+J(k)+': '+J(prog[k])+c);
  });
  add('}');
  return L;
}
const vplCodeText=()=>vplCodeLines(VPL.prog).map(l=>l.t).join('\n');

function vplScript(){
  const sc=vplQ('#vpScript');sc.innerHTML='';sc.classList.toggle('vpcode',VPL.view==='code'&&!VPL.editing);
  vplQ('#vpVText').classList.toggle('on',VPL.view==='text');vplQ('#vpVCode').classList.toggle('on',VPL.view==='code');
  vplQ('#vpVText').setAttribute('aria-pressed',VPL.view==='text');vplQ('#vpVCode').setAttribute('aria-pressed',VPL.view==='code');
  vplQ('#vpEdit').hidden=!(VPL.view==='code'&&!VPL.editing);vplQ('#vpApply').hidden=!VPL.editing;vplQ('#vpCancel').hidden=!VPL.editing;
  vplQ('#vpVText').disabled=VPL.editing;vplQ('#vpVCode').disabled=VPL.editing;
  if(VPL.editing){
    const ta=vplMk('textarea','vpedit');ta.id='vpEditTa';ta.value=vplCodeText();ta.spellcheck=false;ta.setAttribute('aria-label','スクリプト（コード）を書き換える');
    sc.appendChild(ta);return;
  }
  const lines=VPL.view==='code'?vplCodeLines(VPL.prog):vplTextLines(VPL.prog);
  lines.forEach((m,n)=>{
    const d=vplMk('div','vpl'+(m.cls?' '+m.cls:''));
    if(m.k)d.appendChild(vplMk('b','vpk',m.k+' '));
    d.appendChild(document.createTextNode(m.t));
    d.dataset.n=String(n);d.dataset.rule=m.rule==null?'':String(m.rule);d.dataset.sec=m.sec||'';d.dataset.i=m.i==null?'':String(m.i);d.dataset.parts=(m.parts||[]).join(' ');d.dataset.part=m.part==null?'':String(m.part);
    d.tabIndex=0;d.setAttribute('role','button');
    sc.appendChild(d);
  });
  vplApplySel();
}

/* ---- 選ぶ・対応を光らせる ---- */
function vplApplySel(scroll){
  const sc=vplQ('#vpScript'),boxes=[...vplQ('#vpView').querySelectorAll('.vpp')],lines=[...sc.querySelectorAll('.vpl')];
  boxes.forEach(b=>b.classList.remove('sel','hl'));lines.forEach(l=>l.classList.remove('sel','hl'));
  let first=null;
  if(VPL.selPart){
    boxes.forEach(b=>{if(b.dataset.part===VPL.selPart)b.classList.add('sel')});
    lines.forEach(l=>{if(l.dataset.parts.split(' ').includes(VPL.selPart)){l.classList.add('hl');if(!first)first=l}});
  }else if(VPL.selLine){
    const hit=lines.find(l=>l.dataset.n===VPL.selLine.n);
    if(hit){hit.classList.add('sel');first=hit;const ps=VPL.selLine.parts;boxes.forEach(b=>{if(ps.includes(b.dataset.part))b.classList.add('hl')})}
  }
  if(scroll&&first)first.scrollIntoView({block:'nearest'});
  vplInfo();
}
function vplSelPart(id){VPL.selLine=null;VPL.selPart=VPL.selPart===id?null:id;vplApplySel(true)}
function vplSelLine(d){
  if(d.dataset.part){vplSelPart(d.dataset.part);return}   /* コードの「部品の定義の行」は、その部品を選ぶのと同じ */
  const s={n:d.dataset.n,rule:d.dataset.rule,sec:d.dataset.sec,i:d.dataset.i,parts:d.dataset.parts.split(' ').filter(Boolean)};
  const same=VPL.selLine&&VPL.selLine.n===s.n;
  VPL.selPart=null;VPL.selLine=same?null:s;vplApplySel(false);
}
function vplInfo(){
  const el=vplQ('#vpInfo');if(!el)return;let t='';
  if(VPL.selPart){
    const id=VPL.selPart,p=VPL.prog.parts.find(x=>x&&x.id===id),st=VPL.S[id]||{};
    const rs=VPL.prog.rules.filter(r=>VPR.targets(r).includes(id)).map(r=>r.id);
    const vals=Object.keys(st).filter(k=>Object.prototype.hasOwnProperty.call(VPR.PROPS,k)).map(k=>VPR.PROPS[k]+'＝「'+vplShort(st[k])+'」');
    t='選んだ部品：'+((p&&p.name)||id)+'（'+id+'）・'+(p&&VPK[p.kind]?VPK[p.kind].name:'未対応の部品')+'\n今の値：'+(vals.join('、')||'なし')+'\nこの部品を使う規則：'+(rs.join('、')||'なし');
  }else if(VPL.selLine){
    const s=VPL.selLine;
    const what={head:'規則全体',on:'いつ',if:'もし',do:'なら',ifh:'もし',doh:'なら',etc:'規則のほかの項目',close:'規則の一部'}[s.sec]||'規則の一部';
    t='選んだ行：規則 '+s.rule+'（'+what+(s.i!==''?(+s.i+1)+'つ目':'')+'）\nこの行が使う部品：'+(s.parts.map(id=>{const n=vplName(id);return n==null?id+'（見つかりません）':n+'（'+id+'）'}).join('、')||'なし');
  }else t=VPL.mode==='insp'?'部品を押すと、その部品を使うスクリプトの行が光ります。スクリプトの行を押すと、その行が使う部品が光ります。':'「🔍 調べる」にすると、部品を押して選べます。スクリプトの行を押すと、その行が使う部品が光ります。';
  el.textContent=t;
}
function vplMsg(t,bad){const m=vplQ('#vpMsg');m.textContent=t||'';m.hidden=!t;m.style.color=bad?'#c0392b':''}

/* ---- 画面の切り替え・編集 ---- */
function vplMode(m){
  VPL.mode=m;vplQ('#vpView').classList.toggle('insp',m==='insp');vplInert();
  for(const[id,v]of[['#vpRun','run'],['#vpInsp','insp']]){const b=vplQ(id);b.classList.toggle('on',m===v);b.setAttribute('aria-pressed',m===v)}
  vplInfo();
}
function vplApply(){
  const ta=vplQ('#vpEditTa');if(!ta)return;let o;
  try{o=JSON.parse(ta.value)}catch(e){vplMsg('反映できません。JSONとして読めません：'+(e&&e.message||e),1);return}
  const v=VPR.validate(o);
  if(v.errs.length){vplMsg('反映できません：'+v.errs.join(' ／ '),1);return}
  VPL.prog=o;const saved=vplSaveProg();VPL.editing=false;VPL.selPart=null;VPL.selLine=null;
  vplBuild(true);vplScript();vplInfo();
  vplMsg('反映しました。'+(saved?'':'（この端末では覚えられないので、画面を閉じると元に戻ります）')+(v.warn.length?'注意：'+v.warn.join(' ／ '):''),saved?0:1);
}
function vplReset(){
  if(!confirm('見本のスクリプトに戻します。書き換えたスクリプトと、端末に保存した文字は消えます。'))return;
  vplLs.del(VPL.LS);
  try{for(const k of Object.keys(localStorage))if(k.indexOf(VPL.LSS)===0)localStorage.removeItem(k)}catch(_){}
  VPL.prog=VPR.sample();VPL.editing=false;VPL.selPart=null;VPL.selLine=null;VPL.log=[];
  vplBuild(false);vplScript();vplQ('#vpLog').innerHTML='';
  vplMsg('見本に戻しました。',0);vplEmit({type:'start'});
}

CONSOLE.reg({id:'vp',ico:'🧩',name:'ビジュアルプログラミング',
  mount(el){
    VPL.el=el;
    el.innerHTML='<div class="vpgrid">'
      +'<section class="vpcol"><div class="vpbar"><b>ビューワー</b>'
      +'<span class="vpseg" role="group" aria-label="ビューワーの使い方"><button type="button" id="vpRun" class="on" aria-pressed="true" aria-label="部品を、実際に動かす">▶ 動かす</button><button type="button" id="vpInsp" aria-pressed="false" aria-label="部品を押すと、その部品を使うスクリプトの行が光る（部品は動かない）">🔍 調べる</button></span>'
      +'<button type="button" id="vpReset" aria-label="見本のスクリプトに戻す（書き換えたスクリプトと、保存した文字は消える）">↺ 見本に戻す</button></div>'
      +'<div class="vpview" id="vpView"></div><div class="note vpinfo" id="vpInfo"></div></section>'
      +'<section class="vpcol"><div class="vpbar"><b>スクリプト</b>'
      +'<span class="vpseg" role="group" aria-label="スクリプトの見せ方"><button type="button" id="vpVText" class="on" aria-pressed="true" aria-label="日本語の文で見る">文</button><button type="button" id="vpVCode" aria-pressed="false" aria-label="コード（JSON）で見る・書き換える">コード</button></span>'
      +'<button type="button" id="vpEdit" hidden aria-label="コードを書き換える">✎ 編集</button><button type="button" id="vpApply" hidden aria-label="書き換えたコードを反映する">✔ 反映</button><button type="button" id="vpCancel" hidden aria-label="書き換えをやめる">✕ やめる</button></div>'
      +'<div class="note" id="vpMsg" style="margin:0" hidden></div><div class="vpscript" id="vpScript"></div><div class="vplog note" id="vpLog"></div></section></div>';
    vplLoadProg();vplBuild(false);vplScript();vplInfo();
    vplQ('#vpRun').onclick=()=>vplMode('run');vplQ('#vpInsp').onclick=()=>vplMode('insp');vplQ('#vpReset').onclick=vplReset;
    vplQ('#vpVText').onclick=()=>{VPL.view='text';VPL.selLine=null;vplScript();vplApplySel()};
    vplQ('#vpVCode').onclick=()=>{VPL.view='code';VPL.selLine=null;vplScript();vplApplySel()};
    vplQ('#vpEdit').onclick=()=>{VPL.editing=true;vplMsg('');vplScript();const t=vplQ('#vpEditTa');if(t)t.focus()};
    vplQ('#vpCancel').onclick=()=>{VPL.editing=false;vplMsg('');vplScript();vplApplySel()};
    vplQ('#vpApply').onclick=vplApply;
    /* ビューワー：「調べる」の間は、部品を押すと選ぶ（部品は動かさない）。何も無い所を押すと、選びをはずす */
    vplQ('#vpView').addEventListener('click',e=>{
      if(VPL.mode!=='insp')return;
      const b=e.target.closest('.vpp');
      if(b)vplSelPart(b.dataset.part);else{VPL.selPart=null;VPL.selLine=null;vplApplySel()}
      e.preventDefault();e.stopPropagation();
    },true);
    /* スクリプト：行を押す（キーボードのEnter・スペースも） */
    const sc=vplQ('#vpScript');
    sc.addEventListener('click',e=>{const d=e.target.closest('.vpl');if(d)vplSelLine(d)});
    sc.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('vpl')){e.preventDefault();vplSelLine(e.target)}});
    armTips(el);
  },
  enter(){if(!VPL.started){VPL.started=true;vplEmit({type:'start'})}}
});
