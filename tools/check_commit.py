"""確定／レイヤーとして保存／色を合わせる／パーツ切り出しへの調整反映の機械的な確認（台帳Z-83・Z-84・Z-85）。Playwright + Chromium。
使い方:  python3 tools/check_commit.py <HTMLの絶対パス>
内容:    1 確定（全体）：焼き込み前後で見た目が同じ・強さが0に戻る・Undo/Redo   2 確定（範囲指定・縦横比が違う絵）
         3 レイヤーとして保存：新レイヤーに切り離し・元は調整前に戻る・重ねると調整後と同じ・Undo/Redo
         4 断る場合（調整なし・大きすぎる質感・物理つき・ロック中）   5 シートが動き・歪み・ぼかしを引き継ぐ
         6 色を合わせる（強さ0／100・明るさなし・範囲・レイヤー・未選択）   7 パーツのコピー・複製が調整込み
         8 保存→読込  9 実際のボタン（#cmOk）と、タブでの表示
各項目 OK / NG（要確認）を出す。改修前のHTMLに流すと、ボタンが無いので 1〜9 の大半が NG かエラーになる（検知力の確認用）。
アプリ内部の名前（cmCommit, cmMatch, cmAsLayer, boxCv, ensureAdj, US, LAYERS 等）に依存する。改名したらここも直す。
"""
import sys
from playwright.sync_api import sync_playwright

F=sys.argv[1]
res=[]
def rep(name,ok,detail=''):
    res.append(bool(ok));print(('OK  ' if ok else 'NG（要確認） ')+name+(('  '+str(detail)) if detail!='' else ''))

HELP="""window.T={
 mk(w,h,s){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),id=g.createImageData(w,h),d=id.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4,n=((x*7+y*13+s*31)%17)/17;
   d[j]=Math.max(0,Math.min(255,110+60*Math.sin(x*.05+s)+25*n));d[j+1]=Math.max(0,Math.min(255,120+55*Math.sin(y*.06+s*2)+20*n));d[j+2]=Math.max(0,Math.min(255,100+50*Math.sin((x+y)*.04)+30*n));d[j+3]=255}
  g.putImageData(id,0,0);return c},
 solid(w,h,rgb,nz){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),id=g.createImageData(w,h),d=id.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4,n=(Math.sin(x*1.7+y*2.3)+Math.sin(x*.31-y*.43))*.5*nz;
   d[j]=Math.max(0,Math.min(255,rgb[0]+n));d[j+1]=Math.max(0,Math.min(255,rgb[1]+n));d[j+2]=Math.max(0,Math.min(255,rgb[2]+n));d[j+3]=255}
  g.putImageData(id,0,0);return c},
 snap(l,adj){return boxCv(l,{adj,full:true}).c},
 data(c){return c.getContext('2d').getImageData(0,0,c.width,c.height).data},
 diff(a,b,x0f,x1f){x0f=x0f||0;x1f=x1f===undefined?1:x1f;if(a.width!==b.width||a.height!==b.height)return{max:999,mean:999,amax:999,size:[a.width,a.height,b.width,b.height]};
  const A=T.data(a),B=T.data(b),w=a.width,h=a.height,xa=Math.floor(w*x0f),xb=Math.ceil(w*x1f);let mx=0,am=0,s=0,n=0;
  for(let y=0;y<h;y++)for(let x=xa;x<xb;x++){const j=(y*w+x)*4;for(let k=0;k<3;k++){const v=Math.abs(A[j+k]-B[j+k]);if(v>mx)mx=v;s+=v;n++}const q=Math.abs(A[j+3]-B[j+3]);if(q>am)am=q}
  return{max:mx,mean:+(s/Math.max(1,n)).toFixed(3),amax:am}},
 mean(c,x0f,x1f){x0f=x0f||0;x1f=x1f===undefined?1:x1f;const D=T.data(c),w=c.width,h=c.height,xa=Math.floor(w*x0f),xb=Math.ceil(w*x1f);let r=0,g=0,b=0,n=0;
  for(let y=0;y<h;y++)for(let x=xa;x<xb;x++){const j=(y*w+x)*4;if(D[j+3]<8)continue;r+=D[j];g+=D[j+1];b+=D[j+2];n++}
  return n?[r/n,g/n,b/n]:[0,0,0]},
 alpha(c,x0f,x1f){const D=T.data(c),w=c.width,h=c.height,xa=Math.floor(w*x0f),xb=Math.ceil(w*x1f);let s=0,n=0;
  for(let y=0;y<h;y++)for(let x=xa;x<xb;x++){s+=D[(y*w+x)*4+3];n++}return s/Math.max(1,n)},
 comp(a,b){const c=document.createElement('canvas');c.width=a.width;c.height=a.height;const g=c.getContext('2d');g.drawImage(a,0,0);g.drawImage(b,0,0,a.width,a.height);return c},
 leftMask(l,frac){const m=l.adjm=nb(),g=m.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,Math.round(512*frac),512);l.hasAdjM=true;l.adjRng=true;l.adjmv=(l.adjmv|0)+7;adjDirty(l)},
 reset(){AC.splice(0);LAYERS.splice(0,LAYERS.length,{id:1,name:'レイヤー1',visible:true,locked:false});curLid=1;cmAsLayer=false;cmWithL=true;US.length=0;RS.length=0},
 layerOn(on){cmAsLayer=on;const ck=$('cmLy');ck.checked=on;ck.dispatchEvent(new Event('change'))}
};"""

def page(p,w=420,h=900):
    b=p.chromium.launch();pg=b.new_page(viewport={'width':w,'height':h})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]));pg.goto('file://'+F);pg.wait_for_timeout(500)
    pg.evaluate(HELP);return b,pg,errs

with sync_playwright() as p:
    # ---------- 1 確定（全体） ----------
    print('== 1 確定（全体）==')
    b,pg,errs=page(p)
    r=pg.evaluate("""async()=>{
      T.reset();const c=T.mk(256,192,1),l=add(null,c,{size:1});
      const a=ensureAdj(l);a.brightness=30;a.saturation=40;a.contrast=20;ensureLF(l).clarity.amount=60;adjDirty(l);
      const before=T.snap(l,true),raw=T.snap(l,false),n0=US.length;
      T.layerOn(false);await cmCommit();
      const after=T.snap(l,false),r={moved:T.diff(raw,before),d:T.diff(before,after),adjA:adjActive(l),lfA:lfActive(l),us:US.length-n0,imgNew:l.img!==c,cvNull:l.cv===null};
      undo();const l3=sel;r.undo={bri:ensureAdj(l3).brightness,clar:ensureLF(l3).clarity.amount,sameImg:l3.img===c,d:T.diff(before,T.snap(l3,true))};
      redo();const l4=sel;r.redo={adjA:adjActive(l4),lfA:lfActive(l4),d:T.diff(before,T.snap(l4,false))};
      return r}""")
    rep('調整が見た目を変えている（検査の前提：調整前後の差が大きい）',r['moved']['mean']>6,r['moved'])
    rep('焼き込み前後で見た目が同じ（最大差≤3、平均≤0.6）',r['d']['max']<=3 and r['d']['mean']<=.6,r['d'])
    rep('確定後は色調整・質感の強さが0（調整は掛からない）',not r['adjA'] and not r['lfA'])
    rep('絵が新しいCanvasに入れ替わり、取り消し履歴が1つ増える',r['imgNew'] and r['cvNull'] and r['us']>=1,{'imgNew':r['imgNew'],'us':r['us']})
    rep('Undoで調整値（明るさ30・明瞭度60）と元の絵に戻り、見た目も確定前と同じ',r['undo']['bri']==30 and r['undo']['clar']==60 and r['undo']['sameImg'] and r['undo']['d']['max']<=3,r['undo'])
    rep('Redoで再び確定後（強さ0・見た目同じ）',not r['redo']['adjA'] and not r['redo']['lfA'] and r['redo']['d']['max']<=3,r['redo'])
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 2 確定（範囲指定・縦横比が違う絵） ----------
    print('== 2 確定（範囲指定・300×180）==')
    b,pg,errs=page(p)
    r=pg.evaluate("""async()=>{
      T.reset();const c=T.mk(300,180,2),l=add(null,c,{size:1});ensureAdj(l).brightness=60;T.leftMask(l,.5);
      const raw=T.snap(l,false),before=T.snap(l,true);await cmCommit();const after=T.snap(l,false);
      return{d:T.diff(before,after),left:T.diff(raw,after,0,.45),right:T.diff(raw,after,.55,1),adjA:adjActive(l),rng:l.adjRng,hasM:l.hasAdjM}}""")
    rep('範囲指定の確定でも、焼き込み前後で見た目が同じ（最大差≤3）',r['d']['max']<=3,r['d'])
    rep('塗った左側だけが変わり、右側は元のまま',r['left']['mean']>8 and r['right']['max']<=1,{'left':r['left'],'right':r['right']})
    rep('範囲の指定と塗った範囲は残り、強さだけ0（続けて同じ範囲を調整できる）',(not r['adjA']) and r['rng'] and r['hasM'])
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 3 レイヤーとして保存 ----------
    print('== 3 レイヤーとして保存（範囲指定）==')
    b,pg,errs=page(p)
    r=pg.evaluate("""async()=>{
      T.reset();const c=T.mk(300,180,2),l=add(null,c,{size:1,name:'人物'});ensureAdj(l).brightness=60;T.leftMask(l,.5);
      const raw=T.snap(l,false),before=T.snap(l,true),n0=[AC.length,LAYERS.length];
      T.layerOn(true);await cmCommit();
      const sheet=AC[AC.length-1],baseAfter=T.snap(l,false),sh=boxCv(sheet,{adj:true,full:true}).c;
      const r={n0,n1:[AC.length,LAYERS.length],sameObj:sheet!==l,sheetIdx:LAYERS.findIndex(y=>y.id===sheet.layerId),baseIdx:LAYERS.findIndex(y=>y.id===l.layerId),selIsBase:sel===l,
        baseSame:l.img===c,baseDiff:T.diff(raw,baseAfter),comp:T.diff(before,T.comp(baseAfter,sh)),aL:T.alpha(sh,0,.45),aR:T.alpha(sh,.55,1),
        baseAdj:adjActive(l),sheetAdj:adjActive(sheet),sheetName:sheet.name,lname:(LAYERS.find(y=>y.id===sheet.layerId)||{}).name,sheetSize:sheet.size,baseSize:l.size,fx:[sheet.fx,l.fx],fy:[sheet.fy,l.fy]};
      undo();r.undo={ac:AC.length,ly:LAYERS.length,bri:ensureAdj(sel).brightness};
      redo();r.redo={ac:AC.length,ly:LAYERS.length};return r}""")
    rep('オブジェクト+1・レイヤー+1',r['n1']==[r['n0'][0]+1,r['n0'][1]+1],{'前':r['n0'],'後':r['n1']})
    rep('新レイヤーは元のレイヤーのすぐ上、シートはその中の別オブジェクト',r['sameObj'] and r['sheetIdx']==r['baseIdx']+1,{'sheet':r['sheetIdx'],'base':r['baseIdx'],'layer':r['lname'],'name':r['sheetName']})
    rep('選択は元のオブジェクトのまま（続けて全体を調整できる）',r['selIsBase'])
    rep('元の絵は元の画像そのもの（絵は変えず、調整の強さだけ0）',r['baseSame'] and r['baseDiff']['max']==0 and not r['baseAdj'],{'baseDiff':r['baseDiff']})
    rep('シートは範囲の所だけ（左は不透明、右は透明）',r['aL']>=250 and r['aR']<=3,{'左α':round(r['aL'],1),'右α':round(r['aR'],1)})
    rep('元の絵の上にシートを重ねると、調整後の見た目と同じ（最大差≤3）',r['comp']['max']<=3,r['comp'])
    rep('シートは元と同じ位置・大きさ',r['fx'][0]==r['fx'][1] and r['fy'][0]==r['fy'][1] and r['sheetSize']==r['baseSize'],{'fx':r['fx'],'fy':r['fy']})
    rep('シートには調整が掛からない（二重がけしない）',not r['sheetAdj'])
    rep('Undoで1つ戻る（オブジェクト・レイヤー・調整値）／Redoで再現',r['undo']['ac']==r['n0'][0] and r['undo']['ly']==r['n0'][1] and r['undo']['bri']==60 and r['redo']['ac']==r['n1'][0] and r['redo']['ly']==r['n1'][1],{'undo':r['undo'],'redo':r['redo']})
    rep('エラーなし',not errs,errs)
    print('== 3b レイヤーとして保存（全体）==')
    r=pg.evaluate("""async()=>{
      T.reset();const c=T.mk(200,200,4),l=add(null,c,{size:1});const a=ensureAdj(l);a.saturation=50;a.hue=40;adjDirty(l);ensureLF(l).texture.amount=50;
      const before=T.snap(l,true);T.layerOn(true);await cmCommit();
      const sheet=AC[AC.length-1],sh=boxCv(sheet,{adj:true,full:true}).c;
      return{ac:AC.length,ly:LAYERS.length,aAll:T.alpha(sh,0,1),d:T.diff(before,sh),baseAdj:adjActive(l)||lfActive(l)}}""")
    rep('全体の調整は、絵ぜんたいが不透明のシートになる（見た目は調整後と同じ）',r['ac']==2 and r['ly']==2 and r['aAll']>=254 and r['d']['max']<=3 and not r['baseAdj'],r)
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 4 断る場合 ----------
    print('== 4 断る場合 ==')
    b,pg,errs=page(p)
    r=pg.evaluate("""async()=>{
      const out={};T.reset();let l=add(null,T.mk(64,64,1),{size:1});
      let u0=US.length,a0=AC.length;await cmCommit();out.none={us:US.length-u0,ac:AC.length-a0,note:$('ht').textContent};
      /* 質感だけ・14メガ画素（上限12メガ）→断る */
      T.reset();const big=document.createElement('canvas');big.width=4200;big.height=3400;big.getContext('2d').fillRect(0,0,10,10);l=add(null,big,{size:1});ensureLF(l).clarity.amount=50;
      u0=US.length;await cmCommit();out.big={us:US.length-u0,same:l.img===big,lf:lfActive(l),note:$('ht').textContent};
      /* 物理が有効＋レイヤーとして保存→断る（通常の確定はできる） */
      T.reset();l=add(null,T.mk(64,64,1),{size:1});ensureAdj(l).brightness=40;adjDirty(l);ensurePhys(l).on=true;T.layerOn(true);a0=AC.length;await cmCommit();out.phys={ac:AC.length-a0,adjA:adjActive(l),note:$('ht').textContent};
      T.layerOn(false);await cmCommit();out.physPlain={adjA:adjActive(l)};
      /* ロック中→何もしない */
      T.reset();l=add(null,T.mk(64,64,1),{size:1});ensureAdj(l).brightness=40;adjDirty(l);LAYERS[0].locked=true;u0=US.length;await cmCommit();out.lock={adjA:adjActive(l),us:US.length-u0};
      /* 範囲が空＋レイヤー→何もしない */
      T.reset();l=add(null,T.mk(64,64,1),{size:1});ensureAdj(l).brightness=40;l.adjm=nb();l.hasAdjM=false;l.adjRng=true;adjDirty(l);T.layerOn(true);a0=AC.length;await cmCommit();out.empty={ac:AC.length-a0,adjA:adjActive(l)};
      return out}""")
    rep('調整が無い時は何もしない（履歴も増やさない）',r['none']['us']==0 and r['none']['ac']==0,r['none'])
    rep('質感があり12メガ画素を超える絵は、断る（絵・調整はそのまま）',r['big']['us']==0 and r['big']['same'] and r['big']['lf'] and '大きすぎ' in r['big']['note'],r['big'])
    rep('物理が有効だと「レイヤーとして保存」は断り、通常の確定はできる',r['phys']['ac']==0 and r['phys']['adjA'] and not r['physPlain']['adjA'],{'phys':r['phys'],'plain':r['physPlain']})
    rep('ロック中のレイヤーでは確定できない',r['lock']['adjA'] and r['lock']['us']==0,r['lock'])
    rep('範囲が空の時は、レイヤーを作らない',r['empty']['ac']==0 and r['empty']['adjA'],r['empty'])
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 5 シートが動き・歪み・ぼかしを引き継ぐ ----------
    print('== 5 シートの引き継ぎ ==')
    b,pg,errs=page(p)
    r=pg.evaluate("""async()=>{
      T.reset();const l=add(null,T.mk(128,128,5),{size:1.3,fx:.4,fy:.6});ensureAdj(l).brightness=40;adjDirty(l);
      l.ch.m={a:.2,hz:1.5,w:'sin',d:30,e:0,ph:.4};l.rot=12;l.face=-1;l.dm=meshNew();l.blur=5;l.name='動くやつ';
      T.layerOn(true);await cmCommit();const s=AC[AC.length-1];
      const r={ids:[l.id,s.id],m:[s.ch.m.a,s.ch.m.hz,s.ch.m.d],ph:[s.ch.m.ph,l.ch.m.ph],sepCh:s.ch!==l.ch&&s.ch.m!==l.ch.m,dm:!!s.dm&&s.dm!==l.dm&&s.dm.d!==l.dm.d&&s.dm.n===l.dm.n,
        blur:[s.blur,l.blur],rot:[s.rot,l.rot],face:[s.face,l.face],phys:s.phys,adjA:adjActive(s),sepMask:s.mask!==l.mask,sepBite:s.bite!==l.bite,att:[s.att,l.att]};
      for(let i=0;i<4;i++)paintFrame();return r}""")
    pg.wait_for_timeout(400)
    rep('動き・向き・回転・ぼかしを引き継ぐ（別オブジェクトとして独立）',r['m']==[.2,1.5,30] and r['sepCh'] and r['blur']==[5,5] and r['rot']==[12,12] and r['face']==[-1,-1],r)
    rep('動きの位相をそろえて始める（そろって動く）',abs(r['ph'][0]-r['ph'][1])<1e-9,r['ph'])
    rep('歪みのメッシュは複製（共有しない）',r['dm'])
    rep('物理は引き継がない・マスク/biteは独立',r['phys'] is None and r['sepMask'] and r['sepBite'])
    rep('エラーなし（歪み・動き付きシートを描画しても）',not errs,errs);b.close()

    # ---------- 6 色を合わせる ----------
    print('== 6 色を合わせる ==')
    b,pg,errs=page(p)
    r=pg.evaluate("""async()=>{
      const out={};const setup=()=>{T.reset();const ref=add(null,T.solid(200,200,[230,140,60],10),{size:1,name:'参照'}),tg=add(null,T.solid(200,200,[70,100,150],30),{size:1,name:'対象'});
        setSel(tg);$('cmRef').value=String(ref.id);return[ref,tg]};
      let [ref,tg]=setup();const m0=T.mean(T.snap(tg,false)),mr=T.mean(T.snap(ref,false));out.ref=mr;out.start=m0;
      out.opts=[...$('cmRef').options].map(o=>o.textContent);
      $('cmStr').value=100;await cmMatch();out.full=T.mean(T.snap(tg,false));out.fullAdj=adjActive(tg);
      /* 強さ0 */
      [ref,tg]=setup();let b4=T.snap(tg,false);$('cmStr').value=0;await cmMatch();out.zero=T.diff(b4,T.snap(tg,false));
      /* 強さ50 */
      [ref,tg]=setup();$('cmStr').value=50;await cmMatch();out.half=T.mean(T.snap(tg,false));
      /* 明るさは合わせない */
      [ref,tg]=setup();$('cmStr').value=100;cmWithL=false;cmUi();const y=m=>.299*m[0]+.587*m[1]+.114*m[2];const mb=T.mean(T.snap(tg,false));await cmMatch();const ma=T.mean(T.snap(tg,false));cmWithL=true;cmUi();
      out.noL={dY:y(ma)-y(mb),dRB:(ma[0]-ma[2])-(mb[0]-mb[2])};
      /* 範囲（左半分だけ） */
      [ref,tg]=setup();T.leftMask(tg,.5);b4=T.snap(tg,false);$('cmStr').value=100;await cmMatch();const af=T.snap(tg,false);out.rngR=T.diff(b4,af,.55,1);out.rngL=T.mean(af,0,.45);
      /* レイヤーとして保存 */
      [ref,tg]=setup();b4=T.snap(tg,false);T.layerOn(true);$('cmStr').value=100;const a0=AC.length,l0=LAYERS.length;await cmMatch();T.layerOn(false);
      const sh=AC[AC.length-1];out.layer={ac:AC.length-a0,ly:LAYERS.length-l0,base:T.diff(b4,T.snap(tg,false)),sheet:T.mean(boxCv(sh,{adj:true,full:true}).c)};
      /* 未選択 */
      [ref,tg]=setup();$('cmRef').value='';b4=T.snap(tg,false);const u0=US.length;await cmMatch();out.none={d:T.diff(b4,T.snap(tg,false)),us:US.length-u0,note:$('ht').textContent};
      /* Undo */
      [ref,tg]=setup();b4=T.snap(tg,false);$('cmStr').value=100;await cmMatch();undo();out.undo=T.diff(b4,T.snap(sel,false));
      return out}""")
    ref=r['ref']
    def near(m,t,tol): return all(abs(m[i]-t[i])<=tol for i in range(3))
    rep('合わせる先の選択肢に、ほかのオブジェクトだけが並ぶ',r['opts']==['合わせる先を選ぶ','参照'],r['opts'])
    rep('強さ100：対象の平均色が、参照の平均色に近づく（各色±14）',near(r['full'],ref,14) and not near(r['start'],ref,40),{'参照':[round(x) for x in ref],'前':[round(x) for x in r['start']],'後':[round(x) for x in r['full']]})
    rep('合わせた後は調整の強さが0（焼き込み）',not r['fullAdj'])
    rep('強さ0：見た目が変わらない（最大差≤2）',r['zero']['max']<=2,r['zero'])
    rep('強さ50：開始と参照のちょうど中間あたり（各色±16）',near(r['half'],[(r['start'][i]+ref[i])/2 for i in range(3)],16),[round(x) for x in r['half']])
    rep('「明るさも合わせる」を切ると、明るさはほぼ保ち（|ΔY|≤8）、色みは参照へ動く（R−Bが+40以上）',abs(r['noL']['dY'])<=8 and r['noL']['dRB']>=40,r['noL'])
    rep('範囲指定（左半分）：右は元のまま、左は参照に近づく',r['rngR']['max']<=1 and near(r['rngL'],ref,16),{'右':r['rngR'],'左':[round(x) for x in r['rngL']]})
    rep('レイヤーとして保存：新レイヤーに置き、元は変わらず、シートは参照に近い色',r['layer']['ac']==1 and r['layer']['ly']==1 and r['layer']['base']['max']==0 and near(r['layer']['sheet'],ref,14),r['layer'])
    rep('合わせる先が未選択なら何もしない',r['none']['d']['max']==0 and r['none']['us']==0 and '選んで' in r['none']['note'],r['none'])
    rep('Undoで元の色に戻る',r['undo']['max']==0,r['undo'])
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 7 パーツのコピー・複製が調整込み ----------
    print('== 7 パーツのコピー・複製（Z-83）==')
    b,pg,errs=page(p)
    r=pg.evaluate("""async()=>{
      T.reset();const l=add(null,T.mk(200,200,3),{size:1});ensureAdj(l).brightness=50;adjDirty(l);
      const rawM=T.mean(T.snap(l,false)),adjM=T.mean(T.snap(l,true));
      fillSel('sm','#ff5d8f');takePart(false);const cp=T.mean(CL[0].c);
      const n0=AC.length;$('pdup').click();const dup=sel,dupM=T.mean(dup.img);
      const out={rawM,adjM,cp,dupM,added:AC.length-n0,dupAdj:adjActive(dup),origAdj:adjActive(l)};
      /* 切り取り：元に残る側は元画像のまま、調整は引き続き掛かる */
      setSel(l);fillSel('sm','#ff5d8f');takePart(true);out.cutHole=l.base?T.alpha(l.base,0,1):-1;out.origAdj2=adjActive(l);return out}""")
    close=lambda a,b,t: all(abs(a[i]-b[i])<=t for i in range(3))
    rep('検査の前提：調整で平均の明るさがはっきり変わる',abs(r['adjM'][0]-r['rawM'][0])>15,{'raw':[round(x) for x in r['rawM']],'adj':[round(x) for x in r['adjM']]})
    rep('コピーしたパーツの色は、調整後の見た目と同じ（元画像の色ではない）',close(r['cp'],r['adjM'],4) and not close(r['cp'],r['rawM'],10),{'cp':[round(x) for x in r['cp']]})
    rep('「全体を複製」も調整後の見た目で、複製側には調整が掛からない（二重がけしない）',r['added']==1 and close(r['dupM'],r['adjM'],4) and not r['dupAdj'] and r['origAdj'],{'dup':[round(x) for x in r['dupM']]})
    rep('切り取り：元に残る側は透明になり、調整の強さは元のまま',r['cutHole']<=3 and r['origAdj2'],{'α':r['cutHole']})
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 8 保存→読込 ----------
    print('== 8 保存→読込 ==')
    b,pg,errs=page(p)
    r=pg.evaluate("""async()=>{
      T.reset();const l=add(null,T.mk(200,120,2),{size:1,name:'人物'});ensureAdj(l).brightness=60;T.leftMask(l,.5);T.layerOn(true);await cmCommit();
      const sheetM=T.mean(boxCv(AC[AC.length-1],{adj:true,full:true}).c);const s=ser();await loadProj(s);
      const sh=AC[AC.length-1];return{ac:AC.length,ly:LAYERS.length,names:AC.map(a=>a.name),lnames:LAYERS.map(y=>y.name),same:T.mean(boxCv(sh,{adj:true,full:true}).c),sheetM,baseBri:ensureAdj(AC[0]).brightness,layerOK:LAYERS.some(y=>y.id===sh.layerId)}}""")
    rep('保存→読込で、オブジェクト2・レイヤー2・シートの絵・元の調整値（強さ0）が残る',r['ac']==2 and r['ly']==2 and r['layerOK'] and r['baseBri']==0 and all(abs(r['same'][i]-r['sheetM'][i])<=2 for i in range(3)),r)
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 9 実際のボタンとタブ ----------
    print('== 9 実際のボタン／タブ ==')
    b,pg,errs=page(p)
    pg.evaluate("T.reset();const l=add(null,T.mk(128,128,1),{size:1});ensureAdj(l).brightness=50;adjDirty(l);setTab('adj')")
    pg.wait_for_timeout(200)
    vis=pg.evaluate("[$('cmBox').offsetParent!==null,$('cmMatch').offsetParent!==null,$('cmBox').parentNode.dataset.tab]")
    pg.evaluate("setTab('fx')");pg.wait_for_timeout(100)
    vis2=pg.evaluate("[$('cmBox').offsetParent!==null,$('cmMatch').offsetParent!==null,$('cmBox').parentNode.dataset.tab]")
    rep('「確定」は色調整タブと質感タブの両方の末尾に出る／「色を合わせる」は色調整タブだけ',vis==[True,True,'adj'] and vis2==[True,False,'fx'],{'adj':vis,'fx':vis2})
    try:
        pg.evaluate("setTab('adj')");pg.wait_for_timeout(100)
        pg.click('#cmOk',timeout=5000);pg.wait_for_timeout(800)
        r=pg.evaluate("({adjA:adjActive(sel),us:US.length,note:$('ht').textContent})")
        rep('画面のボタン（#cmOk）を押すと確定でき、Undoに積まれる',(not r['adjA']) and r['us']>=1,r)
        pg.evaluate("undo()");pg.wait_for_timeout(100)
        rep('その後Undoで調整が戻る',pg.evaluate("adjActive(sel)"))
    except Exception as e:
        rep('画面のボタンを押せる',False,str(e)[:160])
    rep('エラーなし',not errs,errs);b.close()

print('== 判定 ==',('すべてOK' if all(res) else 'NGあり（%d / %d）'%(res.count(False),len(res))))
sys.exit(0 if all(res) else 1)
