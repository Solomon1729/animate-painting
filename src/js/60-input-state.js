
/* 入力: ドラッグ・2本指ズーム・空き地ドラッグで画面移動 */
const sp=e=>{const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}};
const wp=q=>({x:(q.x-Z.x)/Z.s,y:(q.y-Z.y)/Z.s});
const cap=e=>{try{cv.setPointerCapture(e.pointerId)}catch(_){}};
const up=()=>{editing=false;tgt=null;drawing=false;lp=null;pan=null;pid=-1;wg=null;wbg=null;dragOff=null;boxStart=null;boxEnd=null};
