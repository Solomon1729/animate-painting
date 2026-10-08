
/* 動きの基本: 往復(方向つき)・回転・のび縮み × 波形。全波形は -1〜+1 */
const K=[['m','往復',4,.05],['r','回転',360,5],['s','のび縮み',.5,.02]];
const WN={sin:'なめらか',tri:'三角',bounce:'バウンド',hold:'止め動き',step:'カクカク',ramp:'一方向',decay:'ぷるっ(減衰)',kick:'ドン',noise:'ゆらゆら',circle:'円(往復のみ)',eight:'8の字(往復のみ)'};
const H0=p=>p<.3?E(p/.3):p<.55?1:p<.85?1-E((p-.55)/.3):0;
const WV={sin:p=>Math.sin(p*6.2832),bounce:p=>2*Math.abs(Math.sin(p*Math.PI))-1,hold:p=>2*H0(p)-1,step:p=>Math.sin(6.2832*Math.floor(p*6)/6)/.866,ramp:p=>2*p-1,
 tri:p=>p<.5?4*p-1:3-4*p,decay:p=>Math.sin(p*31.416)*Math.exp(-4*p),kick:p=>2*(p<.12?E(p/.12):1-E((p-.12)/.88))-1,
 noise:p=>(Math.sin(p*12.566+1)+Math.sin(p*18.85+2)*.6+Math.sin(p*31.416+4)*.4)/2,circle:p=>Math.sin(p*6.2832),eight:p=>Math.sin(p*6.2832)};
const cc0=()=>({a:0,hz:1,w:'sin',d:0,e:0,ph:0});
const mkc=()=>({m:cc0(),r:cc0(),s:cc0()});

const Z={s:1,x:0,y:0};
const foldSet=new Set(),lyPop=document.getElementById('lypop');
let LAYERS=[{id:1,name:'レイヤー1',visible:true,locked:false}],curLid=1,physHideEx=true,noFrame=false,wAct=false,tgtBak=null;
let hk=0,fc=0,warpMs=0,dirtyProj=false,bpn=false,berase=false,psn=false,serase=false,pbox=false,showBm=false,cmp=false,wmode='brush',wTouch=0,wbg=null,wHov=null,dragOff=null,eraseStrength=1,showBounds=false,tool='move',wt='b',wg=null,pl=null,tm=null,pw=10,pcol='#e0245e',AC=[],sel=null,uid=0,last=0,paused=false,gs=1,guide=false,editing=false,tgt=null,paint=false,erase=false,brushMask=14,brushBlur=14,brushParts=14,adjMode='',adjBrush=20,adjShow=false,lp=null,drawing=false,pid=-1,pan=null,pz0=null,zshown=false,boxStart=null,boxEnd=null;
const ptrs=new Map();
const byId=id=>AC.find(a=>a.id===id);
const EPAL=['🐻','🐥','🧒','🐱','🐶','🍎','🍜','🥤','🥄','🛏️','🎩','⚽'];
const EDESC={'🐻':'くま','🐥':'ひよこ','🧒':'こども','🐱':'ねこ','🐶':'いぬ','🍎':'りんご','🍜':'めん','🥤':'のみもの','🥄':'スプーン','🛏️':'ベッド','🎩':'ぼうし','⚽':'ボール'};
const pc=()=>sel;

function add(em,im,o){
  /* オブジェクト数の上限は設けない（台帳Z-79。旧：8個）。初期位置は4列×4段で回す（段が画面の外へ出ないように） */
  const id=++uid,a={id,name:'オブジェクト'+id,img:im||emo(em||EPAL[AC.length%EPAL.length]),fx:.2+.2*(AC.length%4),fy:.6+.09*(Math.floor(AC.length/4)%4),
    size:1,pv:0,face:1,rot:0,rr:0,ch:mkc(),to:null,att:false,maskTo:false,ox:.5,oy:.05,front:true,keep:0,eat:false,bite:nb(),mask:nb(),hasMask:false,wx:0,wy:0,pins:[],blur:0,bm:null,hasBm:false,bmOn:false,adj:null,adjm:null,hasAdjM:false};
  if(o)for(const k in o)if(o[k]!==undefined)a[k]=o[k];
  AC.push(a);setSel(a);return a;
}
