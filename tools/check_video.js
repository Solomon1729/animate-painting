/* 動画タブの検査（台帳Z-44・Z-250。2026-11-04）。使い方：node tools/check_video.js <HTMLの絶対パス>
   要：playwright（NODE_PATH）・ffmpeg（検査用の短い動画WebMを作る）。ヘッドレスのみ・実機（スマホ）未確認。
   読み込み・動画が出る・色シート（黒→青）・時間の範囲・なめらかな端・場所・歪み5種の速さ・指でなぞって場所を選ぶ・
   書き出し（実時間・等倍・音声・出力の大きさ）・書き出し後に拡大と状態が戻る、を確かめる。
   台帳Z-251〜Z-254：効果の数に制限がない（注意だけ）・スロー再生・コマ送り・コマ番号・このコマだけ・円形の枠・枠の直接操作（移動・縁の伸縮・カーソル）・
   いまのコマを絵にする・重さの設定の保存・書き出しの間だけ速さ×1、を確かめる（part3）。 */
const {chromium}=require('playwright');
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const HTML0=process.argv[2]||path.resolve(__dirname,'..','index.html');
const HTML='file://'+HTML0+'?start=sample&ui=win';
const D=fs.mkdtempSync(path.join(os.tmpdir(),'chkvideo-'))+'/';
const VID=D+'test.webm';
try{cp.execFileSync('ffmpeg',['-y','-loglevel','error','-f','lavfi','-i','testsrc2=duration=8:size=640x360:rate=30','-f','lavfi','-i','sine=frequency=440:duration=8','-c:v','libvpx','-b:v','1M','-c:a','libvorbis','-shortest',VID])}catch(e){console.log('SKIP ffmpegが無いので検査用の動画を作れません');process.exit(0)}
let ok=0,ng=0;const chk=(n,c,x)=>{if(c){ok++;console.log('OK  ',n,x===undefined?'':x)}else{ng++;console.log('NG  ',n,x===undefined?'':x)}};
const part1=(async()=>{
  const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const pg=await b.newPage({viewport:{width:900,height:900}});
  const errs=[];pg.on('pageerror',e=>errs.push(String(e)));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.goto(HTML);await pg.waitForTimeout(800);
  chk('起動でエラーなし',errs.length===0,errs.join('|'));
  chk('動画タブのボタンがある',await pg.locator('#tabs [data-t="vd"]').count()===1);
  await pg.click('#tabs [data-t="vd"]');await pg.waitForTimeout(200);
  chk('動画タブが開く',await pg.locator('.tab[data-tab="vd"].on').count()===1);
  chk('動画なしでvdDrawが何もしない',await pg.evaluate(()=>{paintFrame();return VD.ok===false}));
  // 読み込み
  await pg.setInputFiles('#vdFile',VID);
  await pg.waitForFunction(()=>VD.ok,null,{timeout:15000});
  await pg.waitForTimeout(700);
  const info=await pg.evaluate(()=>({w:vdV.videoWidth,h:vdV.videoHeight,d:vdV.duration,info:$('vdInfo').textContent,rs:vdV.readyState}));
  chk('動画が読めた',info.w===640&&info.h===360&&info.d>7,JSON.stringify(info));
  // 読み込み後、ビューワーに動画が出る（紙の中央付近が背景の白ではない）
  const px=async(fx,fy)=>pg.evaluate(([fx,fy])=>{const c=cv.getContext('2d');const x=Math.floor(cv.width*fx),y=Math.floor(cv.height*fy);const d=c.getImageData(x,y,2,2).data;return[d[0],d[1],d[2]]},[fx,fy]);
  const diff=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);
  // 検査しやすいように、ほかのオブジェクトを消し、紙を動画と同じ大きさにする
  await pg.evaluate(()=>{AC.slice().forEach(l=>{try{sel=l;}catch(_){}});});
  await pg.click('#vdFit');await pg.waitForTimeout(300);
  chk('キャンバスが動画の大きさ',await pg.evaluate(()=>DOC.w===640&&DOC.h===360),await pg.evaluate(()=>JSON.stringify(DOC)));
  // 絵（絵文字）が重なる所を避けるため、紙の左上の隅を見る
  await pg.evaluate(()=>{vdV.pause();vdV.currentTime=1.0});await pg.waitForTimeout(500);
  const shot=async(n)=>{await pg.evaluate(()=>{paintFrame()});return pg.locator('#cv').screenshot({path:D+n+'.png'})};
  const base=await px(.06,.9);
  chk('動画の絵が出ている（白ではない）',!(base[0]>245&&base[1]>245&&base[2]>245),JSON.stringify(base));
  // 色シート：比較（明）の青100％ → 黒い所が青になる
  const dark=await pg.evaluate(()=>{ // 暗い画素を探す
    const c=cv.getContext('2d');const w=cv.width,h=cv.height,d=c.getImageData(0,0,w,h).data;let best=null,bv=1e9;
    for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){const i=(y*w+x)*4,s=d[i]+d[i+1]+d[i+2];if(s<bv){bv=s;best=[x/w,y/h]}}
    return{pos:best,v:bv}});
  chk('暗い所がある',dark.v<90,JSON.stringify(dark));
  const before=await px(dark.pos[0],dark.pos[1]);
  await pg.evaluate(()=>{const f=vdCur();f.ca=100;f.cc='#0000ff';f.cm='lighten';vdUi()});
  await pg.waitForTimeout(150);await pg.evaluate(()=>paintFrame());
  const after=await px(dark.pos[0],dark.pos[1]);
  chk('黒が青になった（比較（明）：青が最大になり、赤・緑は変わらない）',after[2]>200&&Math.abs(after[0]-before[0])<6&&Math.abs(after[1]-before[1])<6,JSON.stringify({before,after}));
  await shot('color');
  // 時間の範囲：2〜4秒だけ
  await pg.evaluate(()=>{const f=vdCur();f.a=2;f.b=4;f.ramp=0;vdUi()});
  const at=async(t)=>{await pg.evaluate(async t=>{vdV.pause();await vdSeekTo(t);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))},t);return px(dark.pos[0],dark.pos[1])};
  const p1=await at(1),p3=await at(3),p5=await at(5);
  // p1,p5は効果なし（暗くない場所かもしれないので、効果の有無は「青成分が増えているか」ではなく、効果オフ時の同じ時刻と比べる）
  await pg.evaluate(()=>{vdCur().on=false});
  const q1=await at(1),q3=await at(3),q5=await at(5);
  chk('時間の外（1秒・5秒）は変わらない',diff(p1,q1)<12&&diff(p5,q5)<12,JSON.stringify({p1,q1,p5,q5}));
  chk('時間の中（3秒）は変わる',diff(p3,q3)>30||p3[2]>q3[2]+30,JSON.stringify({p3,q3}));
  await pg.evaluate(()=>{const f=vdCur();f.on=true;f.ca=0;f.a=0;f.b=0;f.ramp=.5});
  // ramp：端はなめらか
  await pg.evaluate(()=>{const f=vdCur();f.ca=100;f.a=2;f.b=4;f.ramp=1;});
  const r1=await at(2.1),r2=await at(3);
  await pg.evaluate(()=>{vdCur().on=false});const r1o=await at(2.1),r2o=await at(3);
  chk('rampの途中は弱く、中は強い',diff(r2,r2o)>=diff(r1,r1o),JSON.stringify({d1:diff(r1,r1o),d2:diff(r2,r2o)}));
  // 場所：四角の外は変わらない
  await pg.evaluate(()=>{const f=vdCur();f.on=true;f.ca=100;f.a=0;f.b=0;f.ramp=0;f.x=.5;f.y=0;f.w=.5;f.h=1});
  await pg.evaluate(async()=>{vdV.pause();await vdSeekTo(1.5);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  const leftA=await px(.1,.5),rightA=await px(.9,.5);
  await pg.evaluate(()=>{vdCur().on=false});await pg.evaluate(()=>paintFrame());
  const leftB=await px(.1,.5),rightB=await px(.9,.5);
  chk('四角の外（左）は変わらない',diff(leftA,leftB)<12,JSON.stringify({leftA,leftB}));
  await pg.evaluate(()=>{vdCur().on=true});
  // 歪み
  await pg.evaluate(()=>{const f=vdCur();f.x=0;f.y=0;f.w=1;f.h=1;f.ca=0;f.wt='wh';f.ws=80;f.wf=6;f.wp=0;f.a=0;f.b=0;f.ramp=0});
  await pg.evaluate(async()=>{vdV.pause();await vdSeekTo(1.5);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  const warpImg=await pg.evaluate(()=>{paintFrame();const c=cv.getContext('2d');return Array.from(c.getImageData(0,0,cv.width,cv.height).data.slice(0,400000))});
  await pg.evaluate(()=>{vdCur().wt='none';paintFrame()});
  const flatImg=await pg.evaluate(()=>{paintFrame();const c=cv.getContext('2d');return Array.from(c.getImageData(0,0,cv.width,cv.height).data.slice(0,400000))});
  let nd=0;for(let i=0;i<warpImg.length;i+=4)if(Math.abs(warpImg[i]-flatImg[i])+Math.abs(warpImg[i+1]-flatImg[i+1])+Math.abs(warpImg[i+2]-flatImg[i+2])>60)nd++;
  chk('歪みで絵が変わる',nd>500,nd);
  for(const ty of['wv','ww','bulge','swirl']){
    const t=await pg.evaluate(async ty=>{const f=vdCur();f.wt=ty;f.ws=70;const t0=performance.now();for(let i=0;i<10;i++)paintFrame();return(performance.now()-t0)/10},ty);
    chk('歪み '+ty+' が動く・速さ',t<60,t.toFixed(1)+'ms/コマ');
    await pg.evaluate(()=>{});
  }
  await shot('swirl');
  chk('途中でエラーなし',errs.length===0,errs.join('|'));
  // 指でなぞって場所を選ぶ
  await pg.evaluate(()=>{const f=vdCur();f.wt='none';f.ca=100;f.x=0;f.y=0;f.w=1;f.h=1});
  await pg.click('#vdPick');
  chk('なぞり選びがオン',await pg.evaluate(()=>VD.pick));
  const bb=await pg.locator('#cv').boundingBox();
  await pg.mouse.move(bb.x+bb.width*.25,bb.y+bb.height*.25);await pg.mouse.down();await pg.mouse.move(bb.x+bb.width*.5,bb.y+bb.height*.5,{steps:6});await pg.mouse.move(bb.x+bb.width*.75,bb.y+bb.height*.7,{steps:6});await pg.mouse.up();
  await pg.waitForTimeout(150);
  const R=await pg.evaluate(()=>({pick:VD.pick,r:vdRegion(vdCur())}));
  chk('なぞった四角が入った',!R.pick&&Math.abs(R.r.x-.25)<.05&&Math.abs(R.r.y-.25)<.05&&Math.abs(R.r.w-.5)<.06&&Math.abs(R.r.h-.45)<.06,JSON.stringify(R));
  // 範囲の枠が描かれる（画面だけ）
  await shot('pick');
    await b.close();
})

const part2=()=>(async()=>{
  const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const pg=await b.newPage({viewport:{width:900,height:900}});
  const errs=[];pg.on('pageerror',e=>errs.push(String(e)));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.goto(HTML);await pg.waitForTimeout(800);
  await pg.click('#tabs [data-t="vd"]');
  await pg.setInputFiles('#vdFile',VID);
  await pg.waitForFunction(()=>VD.ok,null,{timeout:15000});await pg.waitForTimeout(500);
  await pg.click('#vdFit');await pg.waitForTimeout(300);
  // 効果：青の色シート（時間 1〜3秒）＋水面の歪み
  await pg.evaluate(()=>{const f=vdCur();f.a=1;f.b=3;f.ramp=.3;f.ca=60;f.cc='#0000ff';f.cm='screen';f.wt='ww';f.ws=60;f.wf=5;f.wp=1;vdUi()});
  // 拡大してから書き出す（書き出しは等倍で、終わったら元へ戻る）
  await pg.evaluate(()=>{Z.s=2;Z.x=-50;Z.y=-20});
  await pg.evaluate(()=>{$('vdExS').value=0;$('vdExE').value=4});
  const t0=Date.now();
  await pg.click('#vdExGo');
  await pg.waitForTimeout(1200);
  const mid=await pg.evaluate(()=>({rec:!!VD.rec,btn:$('vdExGo').textContent,tx:$('vdExTx').textContent,Z:[Z.s,Z.x,Z.y],hk:hk,split:vwNoSplit,cw:cv.width,ch:cv.height}));
  chk('書き出し中の状態（等倍・全体・640×360）',mid.rec&&mid.Z[0]===1&&mid.Z[1]===0&&mid.split&&mid.cw===640&&mid.ch===360,JSON.stringify(mid));
  await pg.waitForFunction(()=>!VD.rec,null,{timeout:30000});
  const el=(Date.now()-t0)/1000;
  chk('実時間（4秒の範囲に約4〜8秒）',el>3.5&&el<10,el.toFixed(1)+'s');
  const after=await pg.evaluate(()=>({Z:[Z.s,Z.x,Z.y],hk:hk,split:vwNoSplit,exp:VD.exp,tx:$('vdExTx').textContent,link:!!document.querySelector('#vdOut a'),cw:cv.width,ch:cv.height,W:W,H:H,dpr:dpr}));
  chk('書き出し後に拡大・状態が戻る',after.Z[0]===2&&after.Z[1]===-50&&after.Z[2]===-20&&after.hk===0&&!after.split&&!after.exp&&after.link,JSON.stringify(after));
  const b64=await pg.evaluate(async()=>{const r=await fetch(VD.outUrl);const bl=await r.blob();const buf=new Uint8Array(await bl.arrayBuffer());let s='';for(let i=0;i<buf.length;i+=32768)s+=String.fromCharCode.apply(null,buf.subarray(i,i+32768));return btoa(s)});
  fs.writeFileSync(D+'out.webm',Buffer.from(b64,'base64'));
  chk('出力ファイルがある',fs.statSync(D+'out.webm').size>20000,fs.statSync(D+'out.webm').size);
  try{const pr=cp.execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,width,height','-of','csv=p=0',D+'out.webm']).toString();
    chk('出力は640×360で、映像と音声がある',/video,640,360/.test(pr)&&/audio/.test(pr),pr.replace(/\n/g,' '))}catch(e){console.log('SKIP ffprobeが無い')}
  chk('エラーなし',errs.length===0,errs.join('|'));
  await b.close();
})();


const part3=()=>(async()=>{
  const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const pg=await b.newPage({viewport:{width:900,height:900}});
  const errs=[];pg.on('pageerror',e=>errs.push(String(e)));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.goto(HTML);await pg.waitForTimeout(800);
  await pg.click('#tabs [data-t="vd"]');
  await pg.setInputFiles('#vdFile',VID);
  await pg.waitForFunction(()=>VD.ok,null,{timeout:15000});await pg.waitForTimeout(2200);
  await pg.click('#vdFit');await pg.waitForTimeout(300);
  // 効果の数に制限がない（注意だけ）
  await pg.evaluate(()=>{for(let i=0;i<11;i++)$('vdFxAdd').click()});
  const n=await pg.evaluate(()=>({n:VD.fx.length,ht:$('ht').textContent,hid:$('hint').hidden}));
  chk('効果は8個を超えて足せる・注意が出る',n.n===12&&!n.hid&&/効果が 12 個/.test(n.ht)&&/制限はありません/.test(n.ht),JSON.stringify(n));
  await pg.evaluate(()=>{while(VD.fx.length>1)$('vdFxDel').click()});
  // 重さの設定：保存される・0＝元のまま
  await pg.evaluate(()=>{[['vdWarnN',3],['vdCapS',0],['vdCapE',2048]].forEach(([id,v])=>{const e=$(id);e.value=v;e.dispatchEvent(new Event('input'))})});   /* 別タブの中なので、画面操作ではなく値の入力で */
  const st=await pg.evaluate(()=>({w:VD.warn,c:VD.cap,e:VD.capExp,ls:localStorage.getItem('am_vdset')}));
  chk('重さの設定が入り、端末に覚える',st.w===3&&st.c===0&&st.e===2048&&/"capExp":2048/.test(st.ls),JSON.stringify(st));
  await pg.evaluate(()=>{VD.warn=8;VD.cap=640;VD.capExp=1024});
  // スロー再生
  await pg.evaluate(()=>vdSetRate(.25));
  const r1=await pg.evaluate(()=>({r:vdV.playbackRate,d:vdV.defaultPlaybackRate,on:document.querySelector('.vdr[data-r="0.25"]').classList.contains('on'),v:$('vdRate').value}));
  chk('スロー再生（×0.25）が効く',Math.abs(r1.r-.25)<1e-6&&Math.abs(r1.d-.25)<1e-6&&r1.on&&+r1.v===.25,JSON.stringify(r1));
  await pg.evaluate(()=>{vdV.pause();vdV.playbackRate=.25;vdV.currentTime=1;vdV.play()});
  const t0=await pg.evaluate(()=>vdV.currentTime);await pg.waitForTimeout(1600);
  const t1=await pg.evaluate(()=>vdV.currentTime);await pg.evaluate(()=>vdV.pause());
  chk('実際に遅く進む（1.6秒で0.2〜0.6秒）',t1-t0>.2&&t1-t0<.6,(t1-t0).toFixed(2));
  await pg.evaluate(()=>vdSetRate(1));
  // コマ数と、コマ送り
  const fp=await pg.evaluate(()=>({fps:VD.fps,m:VD.fpsMeasured}));
  chk('1秒のコマ数を測れた（30）',Math.abs(fp.fps-30)<1&&fp.m===true,JSON.stringify(fp));
  await pg.evaluate(async()=>{vdV.pause();await vdSeekTo(2.0166)});
  await pg.click('#vdStP1');await pg.waitForTimeout(400);
  const f1=await pg.evaluate(()=>({t:vdV.currentTime,i:vdFr(vdV.currentTime),ui:$('vdFrame').textContent}));
  chk('1コマ進む（コマ61→62）',f1.i===61&&/コマ 62 \//.test(f1.ui),JSON.stringify(f1));
  await pg.click('#vdStM10');await pg.waitForTimeout(400);
  const f2=await pg.evaluate(()=>vdFr(vdV.currentTime));
  chk('10コマ戻る',f2===51,f2);
  await pg.keyboard.press('Shift+ArrowRight');await pg.waitForTimeout(400);
  const f3=await pg.evaluate(()=>vdFr(vdV.currentTime));
  chk('キーボードの Shift+→ で10コマ進む',f3===61,f3);
  await pg.evaluate(async()=>{vdV.pause();await vdSeekTo(0)});await pg.click('#vdStM1');await pg.waitForTimeout(300);
  chk('先頭より前へは戻らない',await pg.evaluate(()=>vdFr(vdV.currentTime)===0));
  // このコマだけ
  await pg.evaluate(async()=>{vdV.pause();await vdSeekTo(1.5166)});await pg.click('#vdOne');
  const one=await pg.evaluate(()=>{const f=vdCur();return{a:f.a,b:f.b,ramp:f.ramp,fa:$('vdFa').value,fb:$('vdFb').value}});
  chk('このコマだけ（a〜bが1コマ分）',Math.abs(one.b-one.a-1/30)<1e-3&&one.ramp===0&&one.fa==='46'&&one.fb==='46',JSON.stringify(one));
  await pg.fill('#vdFa','10');await pg.fill('#vdFb','20');await pg.evaluate(()=>{$('vdFb').dispatchEvent(new Event('change'));document.activeElement&&document.activeElement.blur()});
  const fr=await pg.evaluate(()=>({a:vdCur().a,b:vdCur().b}));
  chk('コマ番号で範囲を入れられる（10〜20コマ）',Math.abs(fr.a-9/30)<1e-3&&Math.abs(fr.b-20/30)<1e-3,JSON.stringify(fr));
  // 円形の枠
  await pg.evaluate(()=>{const f=vdCur();f.a=0;f.b=0;f.ramp=0;f.x=.2;f.y=.1;f.w=.5;f.h=.8;vdUi()});
  await pg.click('#vdCirc');
  const ci=await pg.evaluate(()=>{const g=vdGeom(),f=vdCur(),R=vdRegion(f);return{sh:f.sh,pw:R.w*g.vw,ph:R.h*g.vh,sel:$('vdShape').value}});
  chk('「円にする」で縦横が同じ画素になる',ci.sh==='ellipse'&&Math.abs(ci.pw-ci.ph)<1.5&&ci.sel==='ellipse',JSON.stringify(ci));
  // 円形の外は変わらず、中は変わる（色シート：赤100％）
  await pg.evaluate(()=>{const f=vdCur();f.ca=100;f.cc='#ff00ff';f.cm='source-over';f.wt='none';f.x=.25;f.y=.0;f.h=1;f.w=1*vdGeom().vh/vdGeom().vw;vdUi();vdV.pause();});
  await pg.evaluate(async()=>{await vdSeekTo(1);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  const px=async(fx,fy)=>pg.evaluate(([fx,fy])=>{paintFrame();const c=cv.getContext('2d');const x=Math.floor(cv.width*fx),y=Math.floor(cv.height*fy);const d=c.getImageData(x,y,2,2).data;return[d[0],d[1],d[2]]},[fx,fy]);
  const cx=await pg.evaluate(()=>{const g=vdGeom(),f=vdCur(),R=vdRegion(f);return[(g.x+(R.x+R.w/2)*g.w)/W,(g.y+(R.y+R.h/2)*g.h)/H,(g.x+(R.x+.04*R.w)*g.w)/W,(g.y+(R.y+.04*R.h)*g.h)/H]});
  const inC=await px(cx[0],cx[1]),corner=await px(cx[2],cx[3]);
  chk('円の中は色が重なり、四角の隅（円の外）は重ならない',inC[0]>200&&inC[2]>200&&!(corner[0]>200&&corner[2]>200&&corner[1]<60),JSON.stringify({inC,corner,cx,f:await pg.evaluate(()=>JSON.stringify(vdCur())),k:await pg.evaluate(()=>vdFactor(vdCur(),vdV.currentTime)),t:await pg.evaluate(()=>vdV.currentTime),n:await pg.evaluate(()=>VD.fx.length)}));
  // 枠の直接操作
  await pg.evaluate(()=>{const f=vdCur();f.sh='rect';f.ca=0;f.x=.3;f.y=.3;f.w=.4;f.h=.4;vdUi()});
  const geo=await pg.evaluate(()=>{const g=vdGeom(),r=cv.getBoundingClientRect(),R=vdRegion(vdCur());return{g,r:{x:r.x,y:r.y,w:r.width,h:r.height},R,W,H,Zs:Z.s,Zx:Z.x,Zy:Z.y}});
  const toS=(fx,fy)=>{const px_=geo.g.x+fx*geo.g.w,py_=geo.g.y+fy*geo.g.h;return[geo.r.x+(px_*geo.Zs+geo.Zx)*geo.r.w/geo.W,geo.r.y+(py_*geo.Zs+geo.Zy)*geo.r.h/geo.H]};
  // 縁にマウスを重ねるとカーソルが変わる
  let [sx,sy]=toS(.3+.4,.3+.2);await pg.mouse.move(sx,sy);await pg.waitForTimeout(80);
  chk('右の縁にマウスを重ねると ↔ のカーソル',await pg.evaluate(()=>getComputedStyle(cv).cursor)==='ew-resize',await pg.evaluate(()=>getComputedStyle(cv).cursor));
  [sx,sy]=toS(.3+.4,.3+.4);await pg.mouse.move(sx,sy);await pg.waitForTimeout(80);
  chk('右下の角は斜めのカーソル',await pg.evaluate(()=>getComputedStyle(cv).cursor)==='nwse-resize',await pg.evaluate(()=>getComputedStyle(cv).cursor));
  [sx,sy]=toS(.5,.5);await pg.mouse.move(sx,sy);await pg.waitForTimeout(80);
  chk('中では移動のカーソル',await pg.evaluate(()=>getComputedStyle(cv).cursor)==='move',await pg.evaluate(()=>getComputedStyle(cv).cursor));
  // 中をドラッグ＝移動（幅・高さは変わらない）
  const dragF=async(from,to)=>{const [ax,ay]=toS(...from),[bx,by]=toS(...to);await pg.mouse.move(ax,ay);await pg.mouse.down();await pg.mouse.move((ax+bx)/2,(ay+by)/2,{steps:4});await pg.mouse.move(bx,by,{steps:4});await pg.mouse.up();await pg.waitForTimeout(100)};
  const nAC=await pg.evaluate(()=>AC.length);
  await dragF([.5,.5],[.6,.45]);
  let R=await pg.evaluate(()=>{const f=vdCur();return{x:f.x,y:f.y,w:f.w,h:f.h,n:AC.length}});
  chk('中をドラッグすると移動（大きさはそのまま）・絵は動かない',Math.abs(R.x-.4)<.03&&Math.abs(R.y-.25)<.03&&Math.abs(R.w-.4)<.005&&Math.abs(R.h-.4)<.005&&R.n===nAC,JSON.stringify(R));
  // 右の縁をドラッグ＝幅だけ変わる
  await dragF([.8,.45],[.9,.45]);
  R=await pg.evaluate(()=>{const f=vdCur();return{x:f.x,y:f.y,w:f.w,h:f.h}});
  chk('右の縁をドラッグすると幅だけ変わる',Math.abs(R.w-.5)<.03&&Math.abs(R.x-.4)<.02&&Math.abs(R.h-.4)<.01,JSON.stringify(R));
  // 左上の角＝左上が動き、右下は動かない
  await dragF([.4,.25],[.5,.35]);
  R=await pg.evaluate(()=>{const f=vdCur();return{x:f.x,y:f.y,r:f.x+f.w,b:f.y+f.h}});
  chk('左上の角をドラッグすると、右下は動かない',Math.abs(R.x-.5)<.03&&Math.abs(R.y-.35)<.03&&Math.abs(R.r-.9)<.03&&Math.abs(R.b-.65)<.03,JSON.stringify(R));
  // 枠の外のドラッグはアプリ側へ（直接操作は奪わない）
  const before=await pg.evaluate(()=>({x:vdCur().x,y:vdCur().y,w:vdCur().w,h:vdCur().h}));
  await dragF([.05,.9],[.15,.95]);
  const after=await pg.evaluate(()=>({x:vdCur().x,y:vdCur().y,w:vdCur().w,h:vdCur().h}));
  chk('枠の外のドラッグでは枠は変わらない',JSON.stringify(before)===JSON.stringify(after));
  // 直接操作をオフにすると、中をドラッグしても枠は動かない
  await pg.evaluate(()=>{$('vdDirect').checked=false;$('vdDirect').dispatchEvent(new Event('change'))});
  await dragF([.7,.5],[.6,.4]);
  const off=await pg.evaluate(()=>({x:vdCur().x,y:vdCur().y,w:vdCur().w,h:vdCur().h}));
  chk('直接操作オフでは枠は動かない',JSON.stringify(off)===JSON.stringify(after));
  await pg.evaluate(()=>{$('vdDirect').checked=true;$('vdDirect').dispatchEvent(new Event('change'))});
  // 枠に一番近い所を指（タッチ）で押す：許容が広い
  // いまのコマを絵にする
  await pg.evaluate(async()=>{vdV.pause();await vdSeekTo(3)});
  const n0=await pg.evaluate(()=>AC.length);await pg.click('#vdGrab');
  const gr=await pg.evaluate(()=>{const l=AC[AC.length-1],g=vdGeom();return{n:AC.length,name:l.name,w:l.img.width,h:l.img.height,size:l.size,exp:Math.max(g.w,g.h)/S0}});
  chk('このコマを絵にして重ねる（動画の原寸・動画と同じ大きさ）',gr.n===n0+1&&/^コマ\d+$/.test(gr.name)&&gr.w===640&&gr.h===360&&Math.abs(gr.size-gr.exp)<.01,JSON.stringify(gr));
  // 書き出しの縮み：大きいキャンバスでは、注意が出る・設定で縮めなくできる
  await pg.evaluate(()=>{setCanvasSize(5000,3000);vdUi()});await pg.waitForTimeout(250);
  const ex1=await pg.evaluate(()=>({n:$('vdExNote').textContent,o:vdOutSize(),k:vdExK()}));
  chk('大きいキャンバスの書き出しは縮み、注意が出る',ex1.k<1&&ex1.o[0]<5000&&/【注意】/.test(ex1.n)&&/830万画素/.test(ex1.n),JSON.stringify(ex1));
  await pg.evaluate(()=>{const e=$('vdExMax');e.value=0;e.dispatchEvent(new Event('input'))});
  const ex2=await pg.evaluate(()=>({n:$('vdExNote').textContent,o:vdOutSize(),k:vdExK(),ls:localStorage.getItem('am_vdset')}));
  chk('上限を0にすると縮めない・注意も消える・覚える',ex2.k===1&&ex2.o[0]===5000&&!/【注意】/.test(ex2.n)&&/"exMax":0/.test(ex2.ls),JSON.stringify(ex2));
  await pg.evaluate(()=>{VD.exMax=8300000});await pg.click('#vdFit');await pg.waitForTimeout(300);
  // 書き出しの間は×1、終わったら戻る
  await pg.evaluate(()=>vdSetRate(.5));
  await pg.evaluate(()=>{$('vdExS').value=0;$('vdExE').value=1});
  await pg.click('#vdExGo');await pg.waitForTimeout(500);
  const rr=await pg.evaluate(()=>({rec:!!VD.rec,r:vdV.playbackRate}));
  chk('書き出し中だけ速さ×1',rr.rec&&Math.abs(rr.r-1)<1e-6,JSON.stringify(rr));
  await pg.waitForFunction(()=>!VD.rec,null,{timeout:20000});
  const rb=await pg.evaluate(()=>({r:vdV.playbackRate,d:vdV.defaultPlaybackRate,v:VD.rate}));
  chk('書き出しが終わると×0.5に戻る',Math.abs(rb.r-.5)<1e-6&&Math.abs(rb.d-.5)<1e-6&&rb.v===.5,JSON.stringify(rb));
  chk('エラーなし',errs.length===0,errs.join('|'));
  await b.close();
})();

const part2f=part2;
part1().then(()=>part2f()).then(()=>part3()).then(()=>{console.log('OK',ok,'NG',ng);process.exit(ng?1:0)}).catch(e=>{console.log('FATAL',e);process.exit(1)});
